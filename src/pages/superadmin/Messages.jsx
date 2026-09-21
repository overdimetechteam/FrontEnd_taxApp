import { useState, useEffect, useRef, Fragment } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import PageHeader from '../../components/common/PageHeader'
import { formatDateTime } from '../../utils/format'
import { Send, Search, Mail, MessageSquare, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'

const MESSAGE_STATUS_COLORS = {
  pending: 'bg-brand-yellow/10 text-brand-yellow',
  sending: 'bg-brand-yellow/10 text-brand-yellow',
  sent: 'bg-brand-success/10 text-brand-success',
  partially_failed: 'bg-orange-500/10 text-orange-400',
  failed: 'bg-brand-red/10 text-brand-red',
  cancelled: 'bg-brand-black-soft text-brand-gray',
}

// Mirrors ScheduledMessageCreateSerializer on the backend (MAX_RECIPIENTS,
// SYNC_SEND_THRESHOLD). Backend is authoritative — these are for UI copy only.
const RECIPIENT_CAP = 300
const SYNC_SEND_THRESHOLD = 50

const MESSAGE_STATUS_LABELS = {
  pending: 'Pending',
  sending: 'Sending',
  sent: 'Sent',
  partially_failed: 'Partially Failed',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

function MessageStatusBadge({ status }) {
  return (
    <span className={`status-badge ${MESSAGE_STATUS_COLORS[status] || 'bg-brand-black-soft text-brand-gray'}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {MESSAGE_STATUS_LABELS[status] || status}
    </span>
  )
}

export default function Messages() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [sendEmail, setSendEmail] = useState(true)
  const [sendSms, setSendSms] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [smsBody, setSmsBody] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const { data: clients = [], isError: clientsError } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients/').then(r => r.data),
  })

  const defaultedRef = useRef(false)
  useEffect(() => {
    if (!defaultedRef.current && clients.length > 0) {
      defaultedRef.current = true
      setSelectedIds(clients.filter(c => c.is_active).map(c => c.id))
    }
  }, [clients])

  const { data: history = [], isLoading: historyLoading, isError: historyError } = useQuery({
    queryKey: ['scheduled-messages'],
    queryFn: () => api.get('/notifications/scheduled-messages/').then(r => r.data),
  })

  const filteredClients = clients.filter(c =>
    !search || c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  )

  const toggleClient = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const resetForm = () => {
    setSelectedIds([])
    setEmailSubject('')
    setEmailBody('')
    setSmsBody('')
    setScheduledFor('')
  }

  const send = useMutation({
    mutationFn: ({ hadExplicitSchedule }) => api.post('/notifications/scheduled-messages/', {
      client_ids: selectedIds,
      send_email: sendEmail,
      send_sms: sendSms,
      email_subject: emailSubject,
      email_body: emailBody,
      sms_body: smsBody,
      scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null,
    }),
    onSuccess: (res, variables) => {
      const status = res.data.status
      if (status === 'pending') {
        if (variables.hadExplicitSchedule) {
          toast.success('Message scheduled')
        } else {
          // Backend auto-queued this "Send Now" click because the batch was
          // too large to send inline — see SYNC_SEND_THRESHOLD above.
          toast.success('Large batch queued — will send automatically within a couple of minutes')
        }
      } else if (status === 'sent') {
        toast.success('Message sent')
      } else if (status === 'partially_failed') {
        toast('Sent with some failures — check the history below', { icon: '⚠️' })
      } else if (status === 'failed') {
        toast.error('Message could not be delivered — check the history below for details')
      }
      if (status !== 'failed') {
        resetForm()
      }
      qc.invalidateQueries({ queryKey: ['scheduled-messages'] })
    },
    onError: (err) => {
      const detail = err.response?.data
      const first = detail && typeof detail === 'object' ? Object.values(detail).flat()[0] : null
      toast.error(typeof first === 'string' ? first : 'Failed to send message')
    },
  })

  const cancel = useMutation({
    mutationFn: (id) => api.post(`/notifications/scheduled-messages/${id}/cancel/`),
    onSuccess: () => {
      toast.success('Scheduled message cancelled')
      qc.invalidateQueries({ queryKey: ['scheduled-messages'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to cancel'),
  })

  const canSubmit = selectedIds.length > 0 && selectedIds.length <= RECIPIENT_CAP &&
    (sendEmail || sendSms) &&
    (!sendEmail || (emailSubject.trim() && emailBody.trim())) &&
    (!sendSms || smsBody.trim())

  return (
    <div className="animate-fade-in">
      <PageHeader title="Messages" subtitle="Compose and schedule email/SMS messages to your clients" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white">
              Recipients ({selectedIds.length} selected)
              {selectedIds.length > RECIPIENT_CAP && (
                <span className="block text-xs font-normal text-brand-red mt-0.5">
                  Max {RECIPIENT_CAP} recipients per send — remove {selectedIds.length - RECIPIENT_CAP} to continue
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedIds(clients.map(c => c.id))}
                className="text-xs text-brand-yellow hover:underline"
              >
                Select All
              </button>
              <span className="text-brand-gray-border">|</span>
              <button
                onClick={() => setSelectedIds([])}
                className="text-xs text-brand-gray hover:underline"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients..."
              className="input-field pl-9"
            />
          </div>
          <div className="max-h-80 overflow-y-auto space-y-1">
            {clientsError && (
              <p className="text-sm text-brand-red text-center py-4">Failed to load clients.</p>
            )}
            {!clientsError && filteredClients.map(client => (
              <label key={client.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-brand-black-soft cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(client.id)}
                  onChange={() => toggleClient(client.id)}
                  className="accent-brand-yellow"
                />
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{client.full_name}</p>
                  <p className="text-xs text-brand-gray truncate">{client.email}</p>
                </div>
              </label>
            ))}
            {!clientsError && filteredClients.length === 0 && (
              <p className="text-sm text-brand-gray text-center py-4">No clients found</p>
            )}
          </div>
        </div>

        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-white mb-3">Compose</h3>

          <div className="flex gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="accent-brand-yellow" />
              <Mail size={15} className="text-brand-gray" /> <span className="text-sm text-white">Email</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={sendSms} onChange={(e) => setSendSms(e.target.checked)} className="accent-brand-yellow" />
              <MessageSquare size={15} className="text-brand-gray" /> <span className="text-sm text-white">SMS</span>
            </label>
          </div>

          {sendEmail && (
            <div className="space-y-3 mb-4">
              <div>
                <label className="input-label">Email Subject</label>
                <input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} maxLength={200} className="input-field" placeholder="Subject line..." />
              </div>
              <div>
                <label className="input-label">Email Body</label>
                <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={5} className="input-field resize-none" placeholder="Write your email..." />
              </div>
            </div>
          )}

          {sendSms && (
            <div className="mb-4">
              <label className="input-label">SMS Body ({smsBody.length}/600)</label>
              <textarea
                value={smsBody}
                onChange={(e) => setSmsBody(e.target.value.slice(0, 600))}
                rows={3}
                className="input-field resize-none"
                placeholder="Write your SMS..."
              />
            </div>
          )}

          <div className="mb-4">
            <label className="input-label">Schedule For (optional — leave blank to send now)</label>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="input-field"
            />
          </div>

          {!scheduledFor && selectedIds.length > SYNC_SEND_THRESHOLD && (
            <p className="text-xs text-brand-gray mb-2">
              {selectedIds.length} recipients — this will be queued and sent automatically within a
              couple of minutes rather than instantly.
            </p>
          )}
          <button
            onClick={() => send.mutate({ hadExplicitSchedule: Boolean(scheduledFor) })}
            disabled={!canSubmit || send.isPending}
            className="btn-primary"
          >
            <Send size={14} /> {scheduledFor ? 'Schedule Message' : 'Send Now'}
          </button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-brand-gray-border">
          <h3 className="font-semibold text-white">History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header text-left">Recipients</th>
                <th className="table-header text-left">Channels</th>
                <th className="table-header text-left">Scheduled / Sent</th>
                <th className="table-header text-left">Status</th>
                <th className="table-header text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {historyLoading ? (
                <tr><td colSpan={5} className="table-cell text-center py-8 text-brand-gray">Loading...</td></tr>
              ) : historyError ? (
                <tr><td colSpan={5} className="table-cell text-center py-12 text-brand-red">Failed to load message history.</td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan={5} className="table-cell text-center py-12 text-brand-gray">No messages yet</td></tr>
              ) : (
                history.map(msg => (
                  <Fragment key={msg.id}>
                    <tr className="table-row">
                      <td className="table-cell">
                        <button
                          onClick={() => setExpandedId(expandedId === msg.id ? null : msg.id)}
                          className="flex items-center gap-1 text-white hover:text-brand-yellow"
                        >
                          {msg.recipient_count} client{msg.recipient_count !== 1 ? 's' : ''}
                          {expandedId === msg.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      </td>
                      <td className="table-cell text-brand-gray text-xs">
                        {[msg.send_email && 'Email', msg.send_sms && 'SMS'].filter(Boolean).join(' + ')}
                      </td>
                      <td className="table-cell text-brand-gray text-xs">
                        {formatDateTime(msg.scheduled_for || msg.sent_at || msg.created_at)}
                      </td>
                      <td className="table-cell"><MessageStatusBadge status={msg.status} /></td>
                      <td className="table-cell text-center">
                        {msg.status === 'pending' && (
                          <button
                            onClick={() => cancel.mutate(msg.id)}
                            disabled={cancel.isPending}
                            className="btn-ghost text-xs px-2 py-1.5 text-brand-red"
                            title="Cancel"
                          >
                            <XCircle size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedId === msg.id && (
                      <tr>
                        <td colSpan={5} className="table-cell bg-brand-black-soft/50">
                          <div className="space-y-1 py-1">
                            {msg.recipients.map(r => (
                              <div key={r.id} className="text-xs text-brand-gray flex items-center gap-3">
                                <span className="text-white">{r.client_name}</span>
                                <span>{r.client_email}</span>
                                {msg.send_email && <span>Email: {r.email_status}</span>}
                                {msg.send_sms && <span>SMS: {r.sms_status}</span>}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
