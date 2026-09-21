import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { formatCurrency, formatCurrencyInt, formatDate, PAYMENT_STATUS_COLORS, PAYMENT_STATUS_LABELS } from '../../utils/format'
import StatusBadge from '../../components/common/StatusBadge'
import PageHeader from '../../components/common/PageHeader'
import NumberInput from '../../components/common/NumberInput'
import {
  ArrowLeft, Calculator, Send, FileText, Eye, Download,
  CheckCircle, AlertCircle, Pencil, Save, X, ChevronDown, ChevronRight,
  User, Home, Banknote, TrendingUp, Trash2, Plus,
  History, Upload, Archive, Landmark
} from 'lucide-react'
import CashFlowSection from '../client/form-sections/CashFlowSection'

const DISPOSAL_CATEGORY_OPTIONS = [
  { value: 'land_building', label: 'Land / Building' },
  { value: 'motor_vehicle', label: 'Motor Vehicle' },
  { value: 'shares',        label: 'Shares / Securities' },
  { value: 'other',         label: 'Other' },
]
const DISPOSAL_CATEGORY_LABELS = Object.fromEntries(DISPOSAL_CATEGORY_OPTIONS.map(c => [c.value, c.label]))

function RsIcon({ size = 16, className = '' }) {
  return (
    <span
      style={{ fontSize: Math.round(size * 0.75), lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}
      className={`font-bold font-mono ${className}`}
    >
      Rs
    </span>
  )
}
import toast from 'react-hot-toast'

/* ─── Frontend tax slab calculator (mirrors tax_calculator.py) ─── */
const _SLABS = [[1_000_000, 0.06], [500_000, 0.18], [500_000, 0.24], [500_000, 0.30], [null, 0.36]]
const _SLAB_LABELS = [
  'First Rs. 1,000,000 @ 6%', 'Next Rs. 500,000 @ 18%',
  'Next Rs. 500,000 @ 24%',   'Next Rs. 500,000 @ 30%', 'Balance @ 36%',
]
const _FOREIGN_MAX_RATE = 0.15

// Local income fills each slab first at the normal rate; foreign income fills any
// remaining slab space at a rate capped at 15% (mirrors calculate_mixed_tax in
// tax_calculator.py — personal relief spillover is applied by the caller beforehand).
// Foreign income is reported by tax percentage rather than by slab — since every
// bracket above the first is capped at the same 15%, this collapses to at most two
// rows (6% and 15%) instead of one row per underlying slab.
function calculateMixedTax(taxableLocal, taxableForeign) {
  let localRemaining = Math.max(0, taxableLocal)
  let foreignRemaining = Math.max(0, taxableForeign)
  let localTax = 0, foreignTax = 0
  const localBreakdown = []
  const foreignByRate = new Map() // effective rate → { rate, taxable_amount, tax }

  _SLABS.forEach(([limit, rate], i) => {
    if (localRemaining <= 0 && foreignRemaining <= 0) return
    let capacity = limit // null = unlimited (final "balance" slab)

    const localUsed = capacity === null ? localRemaining : Math.min(localRemaining, capacity)
    if (localUsed > 0) {
      const slabTax = Math.round(localUsed * rate * 100) / 100
      localTax += slabTax
      localBreakdown.push({ label: _SLAB_LABELS[i], rate: String(rate), taxable_amount: String(localUsed), tax: String(slabTax) })
      localRemaining -= localUsed
      if (capacity !== null) capacity -= localUsed
    }

    const foreignUsed = capacity === null ? foreignRemaining : Math.min(foreignRemaining, capacity)
    if (foreignUsed > 0) {
      const effRate = Math.min(rate, _FOREIGN_MAX_RATE)
      const slabTax = Math.round(foreignUsed * effRate * 100) / 100
      foreignTax += slabTax
      const key = effRate.toFixed(4)
      const bucket = foreignByRate.get(key)
      if (bucket) {
        bucket.taxable_amount += foreignUsed
        bucket.tax += slabTax
      } else {
        foreignByRate.set(key, { rate: effRate, taxable_amount: foreignUsed, tax: slabTax })
      }
      foreignRemaining -= foreignUsed
    }
  })

  const foreignBreakdown = Array.from(foreignByRate.values()).map(b => ({
    rate: String(b.rate),
    taxable_amount: String(Math.round(b.taxable_amount * 100) / 100),
    tax: String(Math.round(b.tax * 100) / 100),
  }))

  return {
    localTax: Math.round(localTax * 100) / 100,
    foreignTax: Math.round(foreignTax * 100) / 100,
    localBreakdown,
    foreignBreakdown,
  }
}

/* ─── Static display helpers ─── */
function Row({ label, value }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-brand-gray-border last:border-0">
      <span className="text-xs text-brand-gray">{label}</span>
      <span className="text-sm text-white font-medium text-right max-w-[60%]">{value || '—'}</span>
    </div>
  )
}

function AmountRow({ label, value, highlight, sub }) {
  if (value === null || value === undefined || parseFloat(value) === 0) return null
  return (
    <div className={`flex justify-between items-center py-2 border-b border-brand-gray-border last:border-0 ${sub ? 'pl-4' : ''} ${highlight ? 'bg-brand-yellow/5 px-2 rounded-lg -mx-2 mt-1' : ''}`}>
      <span className={`text-sm ${highlight ? 'font-semibold text-white' : 'text-brand-gray'}`}>{label}</span>
      <span className={`font-mono text-sm ${highlight ? 'text-brand-yellow font-bold' : 'text-white'}`}>{formatCurrency(value)}</span>
    </div>
  )
}

/* ─── Read-only computation line ─── */
function ComputedAmount({ label, value, indent, highlight }) {
  return (
    <div className={`flex justify-between items-center py-2.5 border-b border-brand-gray-border last:border-0 ${indent ? 'pl-6' : ''} ${highlight ? 'bg-brand-yellow/5 px-2 rounded-lg -mx-2' : ''}`}>
      {label && <span className={`text-sm ${highlight ? 'font-semibold text-white' : 'text-brand-gray'}`}>{label}</span>}
      <span className={`font-mono text-sm ml-auto ${highlight ? 'text-brand-yellow font-bold text-base' : 'text-white'}`}>{formatCurrency(value)}</span>
    </div>
  )
}

/* ─── Collapsible section card ─── */
function Section({ title, icon: Icon, children, defaultOpen = false, badge, onEdit, editing }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 hover:bg-brand-black-soft transition-colors">
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 flex-1 text-left">
          {Icon && <Icon size={16} className="text-brand-yellow" />}
          <span className="font-semibold text-white text-sm">{title}</span>
          {badge !== undefined && badge > 0 && (
            <span className="text-xs bg-brand-yellow/10 text-brand-yellow px-2 py-0.5 rounded-full">{badge}</span>
          )}
          {open ? <ChevronDown size={15} className="text-brand-gray ml-1" /> : <ChevronRight size={15} className="text-brand-gray ml-1" />}
        </button>
        {onEdit && (
          <button
            onClick={onEdit}
            className={`btn-ghost text-xs px-2 py-1 ml-2 ${editing ? 'text-brand-yellow' : 'text-brand-gray'}`}
            title={editing ? 'Cancel edit' : 'Edit section'}
          >
            {editing ? <X size={13} /> : <Pencil size={13} />}
            {editing ? 'Cancel' : 'Edit'}
          </button>
        )}
      </div>
      {open && <div className="px-5 pb-5 border-t border-brand-gray-border">{children}</div>}
    </div>
  )
}

function SubHeading({ children }) {
  return <p className="text-xs text-brand-yellow font-semibold uppercase tracking-wider mt-4 mb-2 first:mt-3">{children}</p>
}

/* ─── Inline section edit form ─── */
function SectionEditForm({ fields, data, onSave, onCancel, saving }) {
  const [draft, setDraft] = useState(() => {
    const d = {}
    fields.forEach(f => { d[f.key] = data?.[f.key] ?? '' })
    return d
  })
  return (
    <div className="mt-3 bg-brand-black-soft rounded-xl p-4 border border-brand-yellow/20">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {fields.map(f => (
          <div key={f.key}>
            <label className="text-xs text-brand-gray mb-1 block">{f.label}</label>
            {f.type === 'textarea' ? (
              <textarea value={draft[f.key] || ''} onChange={e => setDraft(p => ({ ...p, [f.key]: e.target.value }))}
                rows={2} className="input-field resize-none text-sm" />
            ) : f.type === 'number' ? (
              <NumberInput value={draft[f.key] || ''} onChange={e => setDraft(p => ({ ...p, [f.key]: e.target.value }))}
                className="input-field text-sm text-right font-mono" />
            ) : (
              <input type="text" value={draft[f.key] || ''}
                onChange={e => setDraft(p => ({ ...p, [f.key]: e.target.value }))}
                className="input-field text-sm" />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={() => onSave(draft)} disabled={saving} className="btn-primary text-xs py-1.5 px-3">
          <Save size={12} /> {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <button onClick={onCancel} className="btn-secondary text-xs py-1.5 px-3">Cancel</button>
      </div>
    </div>
  )
}

/* ─── Editable data table for multi-row sections ─── */
function EditableDataTable({ columns, rows, onEdit, onDelete, onAdd, addLabel = 'Add Row', canEdit }) {
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState({})
  const [saving, setSaving] = useState(false)

  async function handleSave(row) {
    setSaving(true)
    try {
      await onEdit(row.id, editDraft)
      setEditingId(null)
    } catch { /* error handled in caller */ }
    setSaving(false)
  }

  if (!rows || rows.length === 0) {
    if (!canEdit) return null
    return (
      <div>
        <button onClick={onAdd} className="btn-ghost text-xs w-full mt-1"><Plus size={12} /> {addLabel}</button>
      </div>
    )
  }

  return (
    <div className="mt-2">
      <div className="overflow-x-auto rounded-lg border border-brand-gray-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-brand-black">
              {columns.map(c => <th key={c.key} className={`table-header py-2 text-xs ${c.right ? 'text-right' : 'text-left'}`}>{c.label}</th>)}
              {canEdit && <th className="table-header py-2 w-16 text-center">Edit</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              editingId === row.id ? (
                <tr key={row.id || i} className="bg-brand-yellow/5">
                  {columns.map(c => (
                    <td key={c.key} className="table-cell py-1">
                      {c.right ? (
                        <NumberInput
                          value={editDraft[c.key] ?? ''}
                          onChange={e => setEditDraft(p => ({ ...p, [c.key]: e.target.value }))}
                          className="input-field py-1 text-xs w-full text-right font-mono"
                        />
                      ) : c.options ? (
                        <select
                          value={editDraft[c.key] ?? ''}
                          onChange={e => setEditDraft(p => ({ ...p, [c.key]: e.target.value }))}
                          className="input-field py-1 text-xs w-full"
                        >
                          {c.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={editDraft[c.key] ?? ''}
                          onChange={e => setEditDraft(p => ({ ...p, [c.key]: e.target.value }))}
                          className="input-field py-1 text-xs w-full"
                        />
                      )}
                    </td>
                  ))}
                  <td className="table-cell py-1">
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => handleSave(row)} disabled={saving} className="text-brand-success hover:opacity-80"><Save size={12} /></button>
                      <button onClick={() => setEditingId(null)} className="text-brand-gray hover:text-white"><X size={12} /></button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={row.id || i} className="table-row">
                  {columns.map(c => (
                    <td key={c.key} className={`table-cell py-2 text-xs ${c.right ? 'text-right font-mono' : ''}`}>
                      {c.format ? c.format(row[c.key]) : (row[c.displayKey || c.key] || '—')}
                    </td>
                  ))}
                  {canEdit && (
                    <td className="table-cell py-2">
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => { setEditingId(row.id); setEditDraft({ ...row }) }}
                          className="text-brand-gray hover:text-brand-yellow"><Pencil size={11} /></button>
                        <button onClick={() => onDelete(row.id)} className="text-brand-gray hover:text-brand-red"><Trash2 size={11} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <button onClick={onAdd} className="btn-ghost text-xs w-full mt-2"><Plus size={12} /> {addLabel}</button>
      )}
    </div>
  )
}

/* ─── Mapping: section key → {endpoint, label, fields} ─── */
const SECTION_FIELDS = {
  foreign_income: {
    endpoint: id => `/tax/submissions/${id}/income/foreign/`,
    label: 'Foreign Income',
    fields: [
      { key: 'foreign_employer_name', label: 'Employer / Company Name', type: 'text' },
      { key: 'employment_service_fee', label: 'Employment / Service Fee (Rs.)', type: 'number' },
      { key: 'foreign_business_income', label: 'Business Income (Rs.)', type: 'number' },
      { key: 'foreign_interest_income', label: 'Foreign Interest (Rs.)', type: 'number' },
      { key: 'other_foreign_income', label: 'Other Foreign Income (Rs.)', type: 'number' },
      { key: 'foreign_tax_paid', label: 'Foreign Tax Paid (Rs.)', type: 'number' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  terminal_benefit: {
    endpoint: id => `/tax/submissions/${id}/income/terminal-benefit/`,
    label: 'Terminal Benefit',
    fields: [
      { key: 'amount', label: 'Amount (Rs.)', type: 'number' },
      { key: 'benefit_types', label: 'Benefit Types (e.g. EPF, ETF)', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  rent_income: {
    endpoint: id => `/tax/submissions/${id}/income/rent/`,
    label: 'Rent Income',
    fields: [
      { key: 'gross_amount', label: 'Gross Rent (Rs.)', type: 'number' },
      { key: 'wht_deducted', label: 'WHT Deducted (Rs.)', type: 'number' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  interest_income: {
    endpoint: id => `/tax/submissions/${id}/income/interest/`,
    label: 'Interest Income',
    fields: [
      { key: 'amount', label: 'Interest Income (Rs.)', type: 'number' },
      { key: 'wht_deducted', label: 'WHT Deducted (Rs.)', type: 'number' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  dividend_income: {
    endpoint: id => `/tax/submissions/${id}/income/dividend/`,
    label: 'Dividend Income',
    fields: [
      { key: 'amount', label: 'Taxable Dividends (Rs.)', type: 'number' },
      { key: 'exempt_amount', label: 'Exempt Dividends — Gross, Final WHT (Rs.)', type: 'number' },
      { key: 'final_wht', label: 'Final WHT on Exempt Dividends (Rs.)', type: 'number' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  sole_proprietorship: {
    endpoint: id => `/tax/submissions/${id}/income/sole-proprietorship/`,
    label: 'Sole Proprietorship',
    fields: [
      { key: 'amount', label: 'Business Income (Rs.)', type: 'number' },
      { key: 'business_name', label: 'Business Name', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  other_income: {
    endpoint: id => `/tax/submissions/${id}/income/other/`,
    label: 'Other Income',
    fields: [
      { key: 'amount', label: 'Amount (Rs.)', type: 'number' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  tb_securities: {
    endpoint: id => `/tax/submissions/${id}/income/tb-securities/`,
    label: 'T-Bills & Securities',
    fields: [
      { key: 'gross_amount', label: 'Gross Amount (Rs.)', type: 'number' },
      { key: 'wht_deducted', label: 'WHT Deducted (Rs.)', type: 'number' },
    ],
  },
  rent_income_wht: {
    endpoint: id => `/tax/submissions/${id}/income/rent/`,
    label: 'WHT on Rent Income',
    fields: [
      { key: 'wht_deducted', label: 'WHT Deducted on Rent Income (Rs.)', type: 'number' },
    ],
  },
  interest_income_wht: {
    endpoint: id => `/tax/submissions/${id}/income/interest/`,
    label: 'WHT on Interest Income',
    fields: [
      { key: 'wht_deducted', label: 'WHT Deducted on Interest Income (Rs.)', type: 'number' },
    ],
  },
  tb_securities_wht: {
    endpoint: id => `/tax/submissions/${id}/income/tb-securities/`,
    label: 'WHT on T-Bills / Securities Income',
    fields: [
      { key: 'wht_deducted', label: 'WHT Deducted on T-Bills / Securities (Rs.)', type: 'number' },
    ],
  },
  qualifying_payments: {
    endpoint: id => `/tax/submissions/${id}/qualifying-payments/`,
    label: 'Qualifying Payments',
    fields: [
      { key: 'donation_charitable', label: 'Charitable Donations (Rs.)', type: 'number' },
      { key: 'donation_government', label: 'Government Donations (Rs.)', type: 'number' },
      { key: 'solar_panels_expenditure', label: 'Solar Panels Expenditure (Rs.)', type: 'number' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  tax_credits: {
    endpoint: id => `/tax/submissions/${id}/tax-credits/`,
    label: 'Tax Credits',
    fields: [
      { key: 'apit_on_salary', label: 'APIT on Salary (Rs.)', type: 'number' },
      { key: 'partnership_tax_credit', label: 'Partnership Tax Credit (Rs.)', type: 'number' },
      { key: 'wht_brought_forward', label: 'WHT Brought Forward (Rs.)', type: 'number' },
      { key: 'refund_brought_forward', label: 'Tax Refund Claim — 60% from last Y/A (Rs.)', type: 'number' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  cash_in_hand: {
    endpoint: id => `/tax/submissions/${id}/assets/cash/`,
    label: 'Cash in Hand',
    fields: [
      { key: 'amount', label: 'Cash in Hand (Rs.)', type: 'number' },
    ],
  },
  loans_given: {
    endpoint: id => `/tax/submissions/${id}/assets/loans-given/`,
    label: 'Loans Given & Receivable',
    fields: [
      { key: 'opening_balance',            label: 'Opening Balance (Rs.)',            type: 'number' },
      { key: 'given_during_year',          label: 'Given During the Year (Rs.)',      type: 'number' },
      { key: 'cash_received_from_debtors', label: 'Cash Received from Debtors (Rs.)', type: 'number' },
      { key: 'amount',                     label: 'Balance as at 31.03 (Rs.)',         type: 'number' },
    ],
  },
  gold_jewellery: {
    endpoint: id => `/tax/submissions/${id}/assets/gold/`,
    label: 'Gold & Jewellery',
    fields: [
      { key: 'value', label: 'Value (Rs.)', type: 'number' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  declarant_details: {
    endpoint: id => `/tax/submissions/${id}/declarant/`,
    label: 'Declarant Details',
    fields: [
      { key: 'full_name', label: 'Full Name', type: 'text' },
      { key: 'nic_passport', label: 'NIC / Passport', type: 'text' },
      { key: 'tin', label: 'TIN', type: 'text' },
      { key: 'pin', label: 'PIN', type: 'text' },
      { key: 'telephone', label: 'Telephone', type: 'text' },
      { key: 'mobile', label: 'Mobile', type: 'text' },
      { key: 'email', label: 'Email', type: 'email' },
    ],
  },
}

/* ─── Main Component ─── */
export default function TaxCalculation() {
  const { submissionId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const [editingSection, setEditingSection] = useState(null)
  const [sectionSaving, setSectionSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'log'
  const [archiveModal, setArchiveModal] = useState(false)
  const [archiveIrdReturnFile, setArchiveIrdReturnFile] = useState(null)
  const [archiveAcknowledgementFile, setArchiveAcknowledgementFile] = useState(null)

  const { data: submission, isLoading } = useQuery({
    queryKey: ['submission', submissionId],
    queryFn: () => api.get(`/tax/submissions/${submissionId}/`).then(r => r.data),
  })

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', submissionId],
    queryFn: () => api.get(`/documents/submission/${submissionId}/`).then(r => r.data),
    enabled: !!submissionId,
  })

  const { data: editLogs = [] } = useQuery({
    queryKey: ['edit-logs', submissionId],
    queryFn: () => api.get(`/tax/submissions/${submissionId}/edit-logs/`).then(r => r.data),
    enabled: !!submissionId,
  })

  const confirmCalc = useMutation({
    mutationFn: () => api.post(`/tax/submissions/${submissionId}/confirm-calculation/`),
    onSuccess: () => {
      toast.success('Client notified. Accounts Division has been alerted for payment confirmation.')
      qc.invalidateQueries(['submission', submissionId])
      navigate(-1)
    },
    onError: err => toast.error(err.response?.data?.error || 'Failed'),
  })

  const finalSubmit = useMutation({
    mutationFn: () => api.post(`/tax/submissions/${submissionId}/final-submit/`),
    onSuccess: () => {
      toast.success('Tax computation sent to client for review.')
      qc.invalidateQueries(['submission', submissionId])
    },
    onError: err => {
      const data = err.response?.data
      if (data?.payment_not_received) {
        toast.error('Payment has not been received. Please wait for Accounts Division to confirm payment before submitting.', { duration: 6000 })
      } else {
        toast.error(data?.error || 'Failed to submit')
      }
    },
  })

  const archiveSubmission = useMutation({
    mutationFn: (formData) => api.post(`/tax/submissions/${submissionId}/archive/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    onSuccess: () => {
      toast.success('Submission archived. Client has been notified.')
      setArchiveModal(false)
      setArchiveIrdReturnFile(null)
      setArchiveAcknowledgementFile(null)
      qc.invalidateQueries(['submission', submissionId])
      navigate(-1)
    },
    onError: err => toast.error(err.response?.data?.error || 'Failed to archive'),
  })


  function handleArchiveSubmit() {
    if (!archiveIrdReturnFile || !archiveAcknowledgementFile) {
      toast.error('Please upload both the IRD return and the IRD acknowledgement before archiving.')
      return
    }
    const fd = new FormData()
    fd.append('ird_return', archiveIrdReturnFile)
    fd.append('acknowledgement', archiveAcknowledgementFile)
    archiveSubmission.mutate(fd)
  }

  async function saveSection(sectionKey, data) {
    const cfg = SECTION_FIELDS[sectionKey]
    if (!cfg) return
    setSectionSaving(true)
    try {
      await api.post(cfg.endpoint(submissionId), data)
      qc.invalidateQueries(['submission', submissionId])
      qc.invalidateQueries(['edit-logs', submissionId])
      setEditingSection(null)
      toast.success(`${cfg.label} updated`)
    } catch (err) {
      const msg = err.response?.data ? Object.entries(err.response.data).map(([k, v]) => `${k}: ${v}`).join(', ') : 'Failed to save'
      toast.error(msg)
    }
    setSectionSaving(false)
  }

  // Multi-row helpers
  async function patchRow(itemEndpointBase, rowId, data) {
    try {
      await api.patch(`/tax/${itemEndpointBase}/${rowId}/`, data)
      qc.invalidateQueries(['submission', submissionId])
      qc.invalidateQueries(['edit-logs', submissionId])
      toast.success('Row updated')
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to update row')
      throw e
    }
  }

  async function deleteRow(itemEndpointBase, rowId) {
    if (!window.confirm('Delete this row?')) return
    try {
      await api.delete(`/tax/${itemEndpointBase}/${rowId}/`)
      qc.invalidateQueries(['submission', submissionId])
      qc.invalidateQueries(['edit-logs', submissionId])
      toast.success('Row deleted')
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to delete row')
    }
  }

  async function addRow(listEndpoint, defaults) {
    try {
      await api.post(`/tax/submissions/${submissionId}/${listEndpoint}`, defaults)
      qc.invalidateQueries(['submission', submissionId])
      qc.invalidateQueries(['edit-logs', submissionId])
      toast.success('Row added')
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to add row')
    }
  }

  async function downloadPDF() {
    try {
      const response = await api.get(`/tax/submissions/${submissionId}/pdf/`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const a = document.createElement('a'); a.href = url
      a.download = `Tax_Return_${submission?.tax_year_label}.pdf`; a.click()
    } catch { toast.error('Failed to download PDF') }
  }

  async function downloadDocument(doc) {
    try {
      const res = await api.get(doc.file_url, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a'); a.href = url; a.download = doc.original_filename; a.click()
    } catch { window.open(doc.file_url, '_blank') }
  }

  // ── All hooks must be above any conditional return (Rules of Hooks) ──────────
  // derivedCalc: computed directly from submission income fields — always in sync,
  // no dependency on stale stored totals.
  const derivedCalc = useMemo(() => {
    const sub = submission || {}

    // ── Income sources (mirrors ReviewSection + backend calculate_full_tax) ──
    const localEmp  = (sub.local_employments || []).reduce((s, lei) => s + parseFloat(lei.amount || 0), 0)
    const fi        = sub.foreign_income || {}
    // Foreign Interest is exempt from tax — excluded from taxable foreign income
    // (mirrors calculate_full_tax in tax_calculator.py).
    const foreignAmt = parseFloat(fi.employment_service_fee  || 0) +
                       parseFloat(fi.foreign_business_income || 0) +
                       parseFloat(fi.other_foreign_income    || 0)
    const terminal  = parseFloat(sub.terminal_benefit?.amount || 0)
    const rentGross = parseFloat(sub.rent_income?.gross_amount || 0)
    const interest  = parseFloat(sub.interest_income?.amount || 0)
    const dividend  = parseFloat(sub.dividend_income?.amount || 0)
    const exemptDiv = parseFloat(sub.dividend_income?.exempt_amount || 0)
    const soleProp  = (sub.sole_proprietorships || []).reduce((s, sp) => s + parseFloat(sp.amount || 0), 0)
    const otherInc  = parseFloat(sub.other_income?.amount || 0)
    const tbSec     = parseFloat(sub.tb_securities?.gross_amount || 0)

    // Capital gains — flat 15% on net gain from disposal of assets during the year.
    // Motor vehicle disposals are excluded — personal-use motor vehicles are exempt
    // from Capital Gains Tax (mirrors calculate_capital_gain_tax in tax_calculator.py).
    const capitalGainNet = (sub.disposals || [])
      .filter(d => d.category !== 'motor_vehicle')
      .reduce((s, d) => s + parseFloat(d.sales_proceed || 0) - parseFloat(d.cost || 0), 0)
    const capitalGain    = Math.max(0, capitalGainNet)
    const capitalGainTax = Math.round(capitalGain * 0.15 * 100) / 100

    const computedTai = localEmp + foreignAmt + terminal + rentGross +
                        interest + dividend + soleProp + otherInc + tbSec + capitalGain

    // ── Qualifying payments ────────────────────────────────────────────────
    const donCharitable = parseFloat(sub.qualifying_payments?.donation_charitable || 0)
    const donGovt       = parseFloat(sub.qualifying_payments?.donation_government || 0)
    const solar         = Math.min(parseFloat(sub.qualifying_payments?.solar_panels_expenditure || 0), 600_000)
    const computedQP    = donCharitable + donGovt + solar

    // ── Reliefs ────────────────────────────────────────────────────────────
    const pr = 1_800_000
    const rr = rentGross * 0.25

    // ── Assessable / taxable income ────────────────────────────────────────
    const tai = computedTai
    const qp  = computedQP

    // Personal relief is applied to local (non-foreign) income first; any unused
    // balance then offsets foreign income (mirrors calculate_full_tax in tax_calculator.py).
    // Capital gain is excluded here — it's taxed separately at a flat 15% via
    // capitalGainTax, not at progressive slab rates (still counted in `tai` above
    // for reporting purposes only).
    const nonForeignIncome = tai - foreignAmt - capitalGain
    const localBase = Math.max(0, nonForeignIncome - qp - rr)
    const localReliefUsed = Math.min(pr, localBase)
    const taxableLocal = localBase - localReliefUsed
    const remainingRelief = pr - localReliefUsed
    const taxableForeign = Math.max(0, foreignAmt - remainingRelief)
    const netTaxable = taxableLocal + taxableForeign

    // ── Progressive slab tax — local fills slabs first; foreign fills the rest,
    // capped at 15% ─────────────────────────────────────────────────────────
    const { localTax: grossTax_, foreignTax: computedForeignGross, localBreakdown: slab_breakdown, foreignBreakdown: foreign_slab_breakdown } =
      calculateMixedTax(taxableLocal, taxableForeign)

    // ── Tax credits ────────────────────────────────────────────────────────
    const apit        = parseFloat(sub.tax_credits?.apit_on_salary              || 0)
    // WHT actually withheld at source — computed live from the income records so it
    // always feeds the total, regardless of whether the Tax Credits form was saved.
    const rentWht     = parseFloat(sub.rent_income?.wht_deducted || 0)
    const interestWht = parseFloat(sub.interest_income?.wht_deducted || 0)
    const soleWht      = (sub.sole_proprietorships || []).reduce((s, sp) => s + parseFloat(sp.wht_deducted || 0), 0)
    const tbWht        = parseFloat(sub.tb_securities?.wht_deducted || 0)
    const whtFromIncome = rentWht + interestWht + soleWht + tbWht
    // WHT certificates for categories not covered above (service fees, employment,
    // other). Rent/Interest certs are supporting evidence for whtFromIncome and are
    // excluded here to avoid double-counting.
    const whtCertsAllTotal = (sub.wht_certificates || []).reduce((acc, c) => acc + parseFloat(c.amount || 0), 0)
    const whtFromCerts = (sub.wht_certificates || [])
      .filter(c => c.category !== 'rent' && c.category !== 'interest')
      .reduce((acc, c) => acc + parseFloat(c.amount || 0), 0)
    const partnership = parseFloat(sub.tax_credits?.partnership_tax_credit      || 0)
    // NOTE: the old free-typed "Tax Refund Claim" field has been retired — the
    // credit list's "Tax Refund Claim" is now just the display name for
    // refundBroughtForward (60% of last Y/A's refund_carried_forward) below.
    const selfAssess  = (sub.self_assessment_payments || []).reduce((acc, p) => acc + parseFloat(p.amount || 0), 0)
    const whtBroughtForward = parseFloat(sub.tax_credits?.wht_brought_forward   || 0)
    const refundBroughtForward = parseFloat(sub.tax_credits?.refund_brought_forward || 0)

    // ── Foreign income tax — progressive slabs capped at 15% ──────────────
    const foreignTaxPaid = parseFloat(fi.foreign_tax_paid || 0)
    const foreignTax = Math.max(0, computedForeignGross - foreignTaxPaid)

    // ── Gross Tax (display total) = slab-wise (local) tax + foreign tax +
    // capital gains tax. Display-only figure — the credit-application steps
    // below use combinedGrossTax (local + foreign), matching calculate_full_tax
    // in tax_calculator.py, so this change does not affect Balance Tax Payable. ─
    const grossTax = grossTax_ + foreignTax + capitalGainTax

    // Combined tax base = local + foreign + Capital Gains Tax. CGT is added to
    // the gross payable here, then also listed as a Step-1 credit below (per
    // DPR instruction) so it is deducted back out — the two cancel, meaning
    // CGT's net contribution to Balance Tax Payable is Rs. 0 once run through
    // the credit steps. It is still shown on its own (flat 15% of Capital
    // Gain) via derivedCalc.capital_gain_tax and the dedicated credit-list row.
    // Credits are applied against this combined base, so a client whose income
    // is mostly/entirely foreign still benefits from their APIT/WHT/self-
    // assessment credits, instead of those credits being stranded against a
    // small/zero local tax. Mirrors calculate_full_tax's combined_gross_tax.
    // Step 1: combined tax reduced by non-WHT credits (APIT, Self-Assessment,
    // Partnership, Tax Refund Claim, Capital Gains Tax, and — per DPR — the
    // 60% Refund Brought Forward from last year), floored at zero.
    // refundBroughtForward is ALREADY the 60% slice (only 60% of last year's
    // refund_carried_forward is ever copied into it — the other 40% is never
    // transferred at all, so it's inherently never claimable or carried
    // forward any further).
    // refundCarriedForward (THIS year's new carry-forward, itself reduced to
    // 60% for next year) is computed from step1CreditsBase only — EXCLUDING
    // refundBroughtForward — so any unused portion of this year's 60% claim
    // does NOT itself spawn a further carry-forward next year. It's a
    // one-time, use-it-or-lose-it claim.
    // Step 2: what's left is reduced by WHT (this year's + brought-forward from last
    // year). Any WHT left over becomes this year's carry-forward (→ next year's B/F).
    const combinedGrossTax = grossTax_ + foreignTax + capitalGainTax
    const step1CreditsBase = apit + partnership + selfAssess + capitalGainTax
    const otherTaxCredits = step1CreditsBase + refundBroughtForward
    const whtTotal = whtFromIncome + whtFromCerts + whtBroughtForward
    const refundCarriedForward = Math.max(0, step1CreditsBase - combinedGrossTax)
    const netAfterOtherCredits = Math.max(0, combinedGrossTax - otherTaxCredits)
    const netAfterWht = netAfterOtherCredits - whtTotal
    const whtCarriedForward = netAfterWht < 0 ? -netAfterWht : 0
    const normalTax = netAfterWht < 0 ? 0 : netAfterWht
    const whtUsed = whtTotal - whtCarriedForward
    const credits = otherTaxCredits + whtUsed

    const netTax = normalTax

    return {
      total_assessable_income:   tai,
      exempt_dividend_income:    exemptDiv,
      total_qualifying_payments: qp,
      personal_relief:           pr,
      rent_relief:               rr,
      net_taxable_income:        netTaxable,
      gross_tax:                 grossTax,
      slab_breakdown,
      foreign_slab_breakdown,
      taxable_foreign:           taxableForeign,
      foreign_tax_gross:         computedForeignGross,
      wht_from_income:           whtFromIncome,
      wht_cert_total:            whtFromCerts,
      wht_cert_all_total:        whtCertsAllTotal,
      self_assess_total:         selfAssess,
      total_tax_credits:         credits,
      wht_brought_forward:       whtBroughtForward,
      wht_carried_forward:       whtCarriedForward,
      refund_brought_forward:    refundBroughtForward,
      refund_carried_forward:    refundCarriedForward,
      capital_gain:              capitalGain,
      capital_gain_tax:          capitalGainTax,
      foreign_income_tax:        foreignTax,
      net_tax_payable:           netTax,
    }
  }, [submission])
  // ─────────────────────────────────────────────────────────────────────────────

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-brand-yellow border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const s = submission
  // Super admin can edit even after the return has been confirmed and archived.
  const canEdit = s?.status !== 'archived' || user?.role === 'super_admin'
  const canConfirm = ['submitted', 'under_review', 'info_requested', 'draft'].includes(s?.status)
  const canFinalSubmit = s?.status === 'confirmed'
  const paymentReceived = s?.payment_status === 'paid'
  const canArchive = s?.status === 'client_confirmed'
  const awaitingClientReview = s?.status === 'awaiting_client_review'

  // Doc grouping
  const docsBySection = documents.reduce((acc, doc) => {
    const sec = doc.section || 'general'
    if (!acc[sec]) acc[sec] = []
    acc[sec].push(doc)
    return acc
  }, {})

  const SECTION_LABELS = {
    income: 'Income', qualifying_payments: 'Qualifying Payments', tax_credits: 'Tax Credits',
    assets: 'Assets', liabilities: 'Liabilities', declarant: 'Declarant', general: 'General',
  }

  const totalAssets = (s?.immovable_properties?.length || 0) + (s?.motor_vehicles?.length || 0) +
    (s?.bank_balances?.length || 0) + (s?.shares_stocks?.length || 0) + (s?.loans_given?.length || 0) +
    (s?.business_properties?.length || 0) + (s?.other_assets?.length || 0)

  // Action colour map for edit log
  const actionColor = { update: 'text-brand-yellow', add: 'text-brand-success', delete: 'text-brand-red' }
  const actionIcon = { update: Pencil, add: Plus, delete: Trash2 }

  return (
    <>
    <div className="animate-fade-in">
      <button onClick={() => navigate(-1)} className="btn-ghost mb-4 text-sm">
        <ArrowLeft size={15} /> Back
      </button>

      <PageHeader
        title={`Tax Review — ${s?.client_name}`}
        subtitle={`${s?.tax_year_label} · ${s?.client_email}`}
        actions={
          <div className="flex gap-2">
            <button onClick={downloadPDF} className="btn-secondary"><Download size={14} /> PDF</button>
            {canConfirm && (
              <button onClick={() => confirmCalc.mutate()} disabled={confirmCalc.isPending} className="btn-primary">
                {confirmCalc.isPending
                  ? <><span className="w-4 h-4 border-2 border-brand-black border-t-transparent rounded-full animate-spin" />Confirming...</>
                  : <><Send size={14} /> Confirm &amp; Notify Client</>
                }
              </button>
            )}
            {canFinalSubmit && (
              paymentReceived ? (
                <button
                  onClick={() => finalSubmit.mutate()}
                  disabled={finalSubmit.isPending}
                  className="btn-primary bg-brand-success border-brand-success hover:opacity-90"
                >
                  {finalSubmit.isPending
                    ? <><span className="w-4 h-4 border-2 border-brand-black border-t-transparent rounded-full animate-spin" />Sending...</>
                    : <><Send size={14} /> Send Tax Form to Client</>
                  }
                </button>
              ) : (
                <button
                  onClick={() => toast.error('Payment has not been received. Accounts Division must confirm payment before you can submit the final return.', { duration: 6000 })}
                  className="btn-secondary border-orange-500/50 text-orange-400 cursor-not-allowed opacity-80"
                >
                  <Send size={14} /> Send Tax Form to Client
                </button>
              )
            )}
            {awaitingClientReview && (
              <button disabled className="btn-secondary border-brand-info/50 text-brand-info cursor-not-allowed opacity-80">
                <CheckCircle size={14} /> Awaiting Client Review
              </button>
            )}
            {canArchive && (
              <button
                onClick={() => setArchiveModal(true)}
                className="btn-primary bg-brand-success border-brand-success hover:opacity-90"
              >
                <Archive size={14} /> Mark Complete &amp; Archive
              </button>
            )}
          </div>
        }
      />

      <div className="flex items-center gap-3 mb-5">
        <StatusBadge status={s?.status} />
        {s?.submitted_at && <span className="text-xs text-brand-gray">Submitted: {formatDate(s.submitted_at)}</span>}
      </div>

      {/* Status banners */}
      {canFinalSubmit && (
        paymentReceived ? (
          <div className="mb-5 flex items-start gap-3 bg-brand-success/10 border border-brand-success/30 rounded-xl p-4">
            <CheckCircle size={16} className="text-brand-success flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">Payment Confirmed by Accounts Division</p>
              <p className="text-xs text-brand-gray mt-0.5">You can now send the final tax return to the client for review.</p>
            </div>
          </div>
        ) : (
          <div className="mb-5 flex items-start gap-3 bg-orange-400/10 border border-orange-400/30 rounded-xl p-4">
            <AlertCircle size={16} className="text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">Awaiting Payment Confirmation</p>
              <p className="text-xs text-brand-gray mt-0.5">Client acknowledged the payment notice. Accounts Division must confirm payment before you can send the final return.</p>
            </div>
          </div>
        )
      )}
      {awaitingClientReview && (
        <div className="mb-5 flex items-start gap-3 bg-blue-400/10 border border-blue-400/30 rounded-xl p-4">
          <CheckCircle size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-white">Tax Form Sent — Awaiting Client Review</p>
            <p className="text-xs text-brand-gray mt-0.5">The client has been sent the full tax computation and will confirm once reviewed.</p>
          </div>
        </div>
      )}
      {canArchive && (
        <div className="mb-5 flex items-start gap-3 bg-brand-success/10 border border-brand-success/30 rounded-xl p-4">
          <CheckCircle size={16} className="text-brand-success flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-white">Client Has Confirmed the Tax Return</p>
            <p className="text-xs text-brand-gray mt-0.5">Click "Mark Complete &amp; Archive" to finalise and archive the submission.</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-brand-black-light border border-brand-gray-border rounded-xl p-1 w-fit">
        {[['overview', 'Overview', FileText], ['log', `Edit Log (${editLogs.length})`, History]].map(([key, label, Icon]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm transition-colors ${activeTab === key ? 'bg-brand-yellow text-brand-black font-semibold' : 'text-brand-gray hover:text-white'}`}>
            <Icon size={13} />{label}
          </button>
        ))}
      </div>

      {/* ── Edit Log Tab ── */}
      {activeTab === 'log' && (
        <div className="card">
          <h3 className="section-header"><History size={16} className="text-brand-yellow" />Edit History</h3>
          {editLogs.length === 0 ? (
            <p className="text-sm text-brand-gray text-center py-8">No consultant edits recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {editLogs.map(log => {
                const ActionIcon = actionIcon[log.action] || Pencil
                return (
                  <div key={log.id} className="bg-brand-black-soft rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <ActionIcon size={13} className={actionColor[log.action] || 'text-brand-gray'} />
                        <span className="text-sm font-semibold text-white">{log.section}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full bg-brand-black ${actionColor[log.action]}`}>
                          {log.action}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-brand-gray">{log.edited_by_name}</p>
                        <p className="text-xs text-brand-gray">{formatDate(log.edited_at)}</p>
                      </div>
                    </div>
                    {log.description && <p className="text-xs text-brand-gray mt-2">{log.description}</p>}
                    {(log.old_data || log.new_data) && (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        {log.old_data && Object.keys(log.old_data).length > 0 && (
                          <div className="bg-brand-black rounded-lg p-2">
                            <p className="text-xs text-brand-red font-semibold mb-1">Before</p>
                            {Object.entries(log.old_data).map(([k, v]) => (
                              <p key={k} className="text-xs text-brand-gray"><span className="text-white">{k}:</span> {v || '—'}</p>
                            ))}
                          </div>
                        )}
                        {log.new_data && Object.keys(log.new_data).length > 0 && (
                          <div className="bg-brand-black rounded-lg p-2">
                            <p className="text-xs text-brand-success font-semibold mb-1">After</p>
                            {Object.entries(log.new_data).map(([k, v]) => (
                              <p key={k} className="text-xs text-brand-gray"><span className="text-white">{k}:</span> {v || '—'}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Overview Tab ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2/3 */}
          <div className="lg:col-span-2 space-y-4">

            {/* ── Income ── */}
            <Section title="Income" icon={RsIcon} defaultOpen
              onEdit={canEdit ? () => setEditingSection(editingSection ? null : 'income_multi') : null}
              editing={editingSection === 'income_multi'}>

              {/* Local Employment — up to 3 employers, multi-entry editable */}
              {((s?.local_employments || []).length > 0 || canEdit) && (
                <>
                  <SubHeading>Local Employment Income</SubHeading>
                  <EditableDataTable
                    columns={[
                      { key: 'employer_name', label: 'Employer Name' },
                      { key: 'amount', label: 'Gross Income', right: true, format: formatCurrency },
                    ]}
                    rows={s?.local_employments} canEdit={canEdit}
                    onEdit={(id, data) => patchRow('income/local-employment', id, data)}
                    onDelete={id => deleteRow('income/local-employment', id)}
                    onAdd={() => (s?.local_employments || []).length >= 3
                      ? toast.error('Maximum of 3 local employers allowed.')
                      : addRow('income/local-employment/', { employer_name: '', amount: 0 })}
                    addLabel="Add Employer"
                  />
                </>
              )}

              {/* Foreign Income */}
              {(s?.foreign_income || canEdit) && (
                <>
                  <SubHeading>Foreign Income</SubHeading>
                  {s?.foreign_income && <>
                    {s.foreign_income.foreign_employer_name && (
                      <Row label="Employer / Company Name" value={s.foreign_income.foreign_employer_name} />
                    )}
                    <AmountRow label="Employment / Service Fee" value={s.foreign_income.employment_service_fee} />
                    {parseFloat(s.foreign_income.foreign_business_income || 0) > 0 && (
                      <AmountRow label="Business Income" value={s.foreign_income.foreign_business_income} />
                    )}
                    {parseFloat(s.foreign_income.foreign_interest_income || 0) > 0 && (
                      <AmountRow label="Foreign Interest (Exempt — not included in Foreign Income total)" value={s.foreign_income.foreign_interest_income} />
                    )}
                    <AmountRow label="Other Foreign Income" value={s.foreign_income.other_foreign_income} />
                  </>}
                  {canEdit && (editingSection === 'foreign_income' ? (
                    <SectionEditForm fields={SECTION_FIELDS.foreign_income.fields} data={s?.foreign_income || {}}
                      onSave={d => saveSection('foreign_income', d)} onCancel={() => setEditingSection(null)} saving={sectionSaving} />
                  ) : (
                    <button onClick={() => setEditingSection('foreign_income')} className="btn-ghost text-xs mt-1"><Pencil size={11} /> Edit</button>
                  ))}
                </>
              )}

              {/* Terminal Benefit */}
              {(s?.terminal_benefit?.amount > 0 || canEdit) && (
                <>
                  <SubHeading>Terminal Benefit</SubHeading>
                  {s?.terminal_benefit?.amount > 0 && <>
                    <AmountRow label="Amount" value={s.terminal_benefit.amount} />
                    <Row label="Benefit Types" value={s.terminal_benefit.benefit_types} />
                  </>}
                  {canEdit && (editingSection === 'terminal_benefit' ? (
                    <SectionEditForm fields={SECTION_FIELDS.terminal_benefit.fields} data={s?.terminal_benefit || {}}
                      onSave={d => saveSection('terminal_benefit', d)} onCancel={() => setEditingSection(null)} saving={sectionSaving} />
                  ) : (
                    <button onClick={() => setEditingSection('terminal_benefit')} className="btn-ghost text-xs mt-1"><Pencil size={11} /> Edit</button>
                  ))}
                </>
              )}

              {/* Rent Income */}
              {(s?.rent_income?.gross_amount > 0 || canEdit) && (
                <>
                  <SubHeading>Rent Income</SubHeading>
                  {s?.rent_income?.gross_amount > 0 && <>
                    <AmountRow label="Gross Rent" value={s.rent_income.gross_amount} />
                    <AmountRow label="WHT Deducted" value={s.rent_income.wht_deducted} sub />
                    <div className="flex justify-between items-center py-1.5 pl-4 border-b border-brand-gray-border">
                      <span className="text-sm text-brand-success">Rent Relief (25% auto)</span>
                      <span className="font-mono text-sm text-brand-success">{formatCurrency(derivedCalc.rent_relief)}</span>
                    </div>
                  </>}
                  {canEdit && (editingSection === 'rent_income' ? (
                    <SectionEditForm fields={SECTION_FIELDS.rent_income.fields} data={s?.rent_income || {}}
                      onSave={d => saveSection('rent_income', d)} onCancel={() => setEditingSection(null)} saving={sectionSaving} />
                  ) : (
                    <button onClick={() => setEditingSection('rent_income')} className="btn-ghost text-xs mt-1"><Pencil size={11} /> Edit</button>
                  ))}
                </>
              )}

              {/* Interest Income */}
              {(s?.interest_income?.amount > 0 || canEdit) && (
                <>
                  <SubHeading>Interest Income</SubHeading>
                  {s?.interest_income?.amount > 0 && <>
                    <AmountRow label="Interest" value={s.interest_income.amount} />
                    <AmountRow label="WHT Deducted" value={s.interest_income.wht_deducted} sub />
                  </>}
                  {canEdit && (editingSection === 'interest_income' ? (
                    <SectionEditForm fields={SECTION_FIELDS.interest_income.fields} data={s?.interest_income || {}}
                      onSave={d => saveSection('interest_income', d)} onCancel={() => setEditingSection(null)} saving={sectionSaving} />
                  ) : (
                    <button onClick={() => setEditingSection('interest_income')} className="btn-ghost text-xs mt-1"><Pencil size={11} /> Edit</button>
                  ))}
                </>
              )}

              {/* Capital Gain — Disposal of Assets, multi-entry, editable.
                  Same records as the client's Income form / Assets step. */}
              {((s?.disposals || []).length > 0 || canEdit) && (
                <>
                  <SubHeading>Capital Gain</SubHeading>
                  <EditableDataTable
                    columns={[
                      { key: 'description', label: 'Description' },
                      {
                        key: 'category', label: 'Category',
                        options: DISPOSAL_CATEGORY_OPTIONS,
                        format: v => DISPOSAL_CATEGORY_LABELS[v] || v,
                      },
                      { key: 'date_of_disposal', label: 'Date of Disposal' },
                      { key: 'sales_proceed', label: 'Sales Proceed', right: true, format: formatCurrency },
                      { key: 'date_acquired', label: 'Date Acquired' },
                      { key: 'cost', label: 'Cost', right: true, format: formatCurrency },
                    ]}
                    rows={s?.disposals} canEdit={canEdit}
                    onEdit={(id, data) => patchRow('assets/disposals', id, data)}
                    onDelete={id => deleteRow('assets/disposals', id)}
                    onAdd={() => addRow('assets/disposals/', { description: '', category: 'other', date_of_disposal: null, sales_proceed: 0, date_acquired: null, cost: 0 })}
                    addLabel="Add Disposal"
                  />
                  {derivedCalc.capital_gain > 0 && (
                    <AmountRow label="Net Gain (from disposal of assets)" value={derivedCalc.capital_gain} />
                  )}
                </>
              )}

              {/* Dividend Income */}
              {(s?.dividend_income?.amount > 0 || s?.dividend_income?.exempt_amount > 0 || canEdit) && (
                <>
                  <SubHeading>Dividend Income</SubHeading>
                  {(s?.dividend_income?.amount > 0 || s?.dividend_income?.exempt_amount > 0) && <>
                    <AmountRow label="Taxable Dividends" value={s.dividend_income.amount} />
                    {parseFloat(s.dividend_income.exempt_amount || 0) > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-brand-gray-border pl-4">
                        <span className="text-sm text-brand-success">Exempt Dividends (Gross)</span>
                        <span className="font-mono text-sm text-brand-success">{formatCurrency(s.dividend_income.exempt_amount)}</span>
                      </div>
                    )}
                    {parseFloat(s.dividend_income.final_wht || 0) > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-brand-gray-border pl-4">
                        <span className="text-sm text-brand-success">Final WHT</span>
                        <span className="font-mono text-sm text-brand-success">{formatCurrency(s.dividend_income.final_wht)}</span>
                      </div>
                    )}
                  </>}
                  {canEdit && (editingSection === 'dividend_income' ? (
                    <SectionEditForm fields={SECTION_FIELDS.dividend_income.fields} data={s?.dividend_income || {}}
                      onSave={d => saveSection('dividend_income', d)} onCancel={() => setEditingSection(null)} saving={sectionSaving} />
                  ) : (
                    <button onClick={() => setEditingSection('dividend_income')} className="btn-ghost text-xs mt-1"><Pencil size={11} /> Edit</button>
                  ))}
                </>
              )}

              {/* Sole Proprietorship — multi-entry, editable */}
              {((s?.sole_proprietorships || []).length > 0 || canEdit) && (
                <>
                  <SubHeading>Sole Proprietorship / Partnership</SubHeading>
                  <EditableDataTable
                    columns={[
                      { key: 'business_name', label: 'Business Name' },
                      { key: 'amount', label: 'Business Income', right: true, format: formatCurrency },
                      { key: 'wht_deducted', label: 'WHT Deducted', right: true, format: formatCurrency },
                    ]}
                    rows={s?.sole_proprietorships} canEdit={canEdit}
                    onEdit={(id, data) => patchRow('income/sole-proprietorship', id, data)}
                    onDelete={id => deleteRow('income/sole-proprietorship', id)}
                    onAdd={() => addRow('income/sole-proprietorship/', { business_name: '', amount: 0, wht_deducted: 0 })}
                    addLabel="Add Business"
                  />
                </>
              )}

              {/* Other Income */}
              {(s?.other_income?.amount > 0 || canEdit) && (
                <>
                  <SubHeading>Other Income</SubHeading>
                  {s?.other_income?.amount > 0 && <>
                    <Row label="Description" value={s.other_income.description} />
                    <AmountRow label="Amount" value={s.other_income.amount} />
                  </>}
                  {canEdit && (editingSection === 'other_income' ? (
                    <SectionEditForm fields={SECTION_FIELDS.other_income.fields} data={s?.other_income || {}}
                      onSave={d => saveSection('other_income', d)} onCancel={() => setEditingSection(null)} saving={sectionSaving} />
                  ) : (
                    <button onClick={() => setEditingSection('other_income')} className="btn-ghost text-xs mt-1"><Pencil size={11} /> Edit</button>
                  ))}
                </>
              )}

              {/* T-Bills & Securities */}
              {(s?.tb_securities?.gross_amount > 0 || canEdit) && (
                <>
                  <SubHeading>T-Bills &amp; Securities Income</SubHeading>
                  {s?.tb_securities?.gross_amount > 0 && <>
                    <AmountRow label="Gross Amount" value={s.tb_securities.gross_amount} />
                    <AmountRow label="WHT Deducted" value={s.tb_securities.wht_deducted} sub />
                  </>}
                  {canEdit && (editingSection === 'tb_securities' ? (
                    <SectionEditForm fields={SECTION_FIELDS.tb_securities.fields} data={s?.tb_securities || {}}
                      onSave={d => saveSection('tb_securities', d)} onCancel={() => setEditingSection(null)} saving={sectionSaving} />
                  ) : (
                    <button onClick={() => setEditingSection('tb_securities')} className="btn-ghost text-xs mt-1"><Pencil size={11} /> Edit</button>
                  ))}
                </>
              )}

              <div className="mt-2">
                <AmountRow label="TOTAL ASSESSABLE INCOME" value={derivedCalc.total_assessable_income} highlight />
              </div>
            </Section>

            {/* ── Qualifying Payments ── */}
            <Section title="Qualifying Payments" icon={Calculator}
              onEdit={canEdit ? () => setEditingSection(editingSection === 'qualifying_payments' ? null : 'qualifying_payments') : null}
              editing={editingSection === 'qualifying_payments'}>
              {s?.qualifying_payments ? (
                <div className="pt-3">
                  <AmountRow label="Charitable Donations" value={s.qualifying_payments.donation_charitable} />
                  <AmountRow label="Government Donations" value={s.qualifying_payments.donation_government} />
                  <AmountRow label="Solar Panels" value={s.qualifying_payments.solar_panels_expenditure} />
                  {editingSection === 'qualifying_payments' && (
                    <SectionEditForm fields={SECTION_FIELDS.qualifying_payments.fields} data={s.qualifying_payments}
                      onSave={d => saveSection('qualifying_payments', d)} onCancel={() => setEditingSection(null)} saving={sectionSaving} />
                  )}
                  <div className="mt-2">
                    <AmountRow label="Total Qualifying Payments" value={derivedCalc.total_qualifying_payments} highlight />
                  </div>
                </div>
              ) : (
                <div className="pt-3">
                  <p className="text-xs text-brand-gray text-center">No qualifying payments entered</p>
                  {canEdit && editingSection === 'qualifying_payments' && (
                    <SectionEditForm fields={SECTION_FIELDS.qualifying_payments.fields} data={{}}
                      onSave={d => saveSection('qualifying_payments', d)} onCancel={() => setEditingSection(null)} saving={sectionSaving} />
                  )}
                </div>
              )}
            </Section>

            {/* ── Tax Credits ── */}
            <Section title="Tax Credits" icon={TrendingUp}
              onEdit={canEdit ? () => setEditingSection(editingSection === 'tax_credits' ? null : 'tax_credits') : null}
              editing={editingSection === 'tax_credits'}>
              <div className="pt-3">
                {s?.tax_credits ? (
                  <>
                    <AmountRow label="APIT on Salary" value={s.tax_credits.apit_on_salary} />
                    <AmountRow label="Partnership Tax Credit" value={s.tax_credits.partnership_tax_credit} />
                    <AmountRow label="WHT Brought Forward" value={s.tax_credits.wht_brought_forward} />
                    {derivedCalc.wht_carried_forward > 0 && (
                      <AmountRow label="WHT Carried Forward (to next Y/A)" value={derivedCalc.wht_carried_forward} />
                    )}
                    <AmountRow label="Tax Refund Claim (60% from last Y/A)" value={s.tax_credits.refund_brought_forward} />
                    <div className="flex justify-between items-center py-2 border-b border-brand-gray-border last:border-0">
                      <span className="text-sm text-brand-gray">Refund Carried Forward (60% to next Y/A)</span>
                      <span className="font-mono text-sm text-white">{formatCurrency(derivedCalc.refund_carried_forward)}</span>
                    </div>
                  </>
                ) : <p className="text-xs text-brand-gray text-center">No tax credits entered</p>}
                {editingSection === 'tax_credits' && (
                  <SectionEditForm fields={SECTION_FIELDS.tax_credits.fields} data={s?.tax_credits}
                    onSave={d => saveSection('tax_credits', d)} onCancel={() => setEditingSection(null)} saving={sectionSaving} />
                )}

                {/* ── WHT from Income Sources ── */}
                {(() => {
                  const rentWHT = parseFloat(s?.rent_income?.wht_deducted || 0)
                  const intWHT  = parseFloat(s?.interest_income?.wht_deducted || 0)
                  const spWHT   = (s?.sole_proprietorships || []).reduce((sum, sp) => sum + parseFloat(sp.wht_deducted || 0), 0)
                  const tbWHT   = parseFloat(s?.tb_securities?.wht_deducted || 0)
                  const hasWHT  = rentWHT > 0 || intWHT > 0 || spWHT > 0 || tbWHT > 0
                  return (hasWHT || canEdit) ? (
                    <>
                      <SubHeading>WHT Deducted at Source (included in Total Tax Credits)</SubHeading>
                      {(rentWHT > 0 || canEdit) && (
                        <div>
                          <AmountRow label="WHT on Rent Income" value={s?.rent_income?.wht_deducted} sub />
                          {canEdit && (editingSection === 'rent_income_wht' ? (
                            <SectionEditForm fields={SECTION_FIELDS.rent_income_wht.fields} data={s?.rent_income || {}}
                              onSave={d => saveSection('rent_income_wht', d)} onCancel={() => setEditingSection(null)} saving={sectionSaving} />
                          ) : (
                            <button onClick={() => setEditingSection('rent_income_wht')} className="btn-ghost text-xs mt-1 ml-4"><Pencil size={11} /> Edit WHT</button>
                          ))}
                        </div>
                      )}
                      {(intWHT > 0 || canEdit) && (
                        <div>
                          <AmountRow label="WHT on Interest Income" value={s?.interest_income?.wht_deducted} sub />
                          {canEdit && (editingSection === 'interest_income_wht' ? (
                            <SectionEditForm fields={SECTION_FIELDS.interest_income_wht.fields} data={s?.interest_income || {}}
                              onSave={d => saveSection('interest_income_wht', d)} onCancel={() => setEditingSection(null)} saving={sectionSaving} />
                          ) : (
                            <button onClick={() => setEditingSection('interest_income_wht')} className="btn-ghost text-xs mt-1 ml-4"><Pencil size={11} /> Edit WHT</button>
                          ))}
                        </div>
                      )}
                      {spWHT > 0 && <AmountRow label="WHT on Business Income (see Sole Prop. above)" value={spWHT} sub />}
                      {(tbWHT > 0 || canEdit) && (
                        <div>
                          <AmountRow label="WHT on T-Bills / Securities Income" value={s?.tb_securities?.wht_deducted} sub />
                          {canEdit && (editingSection === 'tb_securities_wht' ? (
                            <SectionEditForm fields={SECTION_FIELDS.tb_securities_wht.fields} data={s?.tb_securities || {}}
                              onSave={d => saveSection('tb_securities_wht', d)} onCancel={() => setEditingSection(null)} saving={sectionSaving} />
                          ) : (
                            <button onClick={() => setEditingSection('tb_securities_wht')} className="btn-ghost text-xs mt-1 ml-4"><Pencil size={11} /> Edit WHT</button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : null
                })()}

                {/* ── WHT Certificates ── */}
                {((s?.wht_certificates || []).length > 0 || canEdit) && (
                  <>
                    <SubHeading>WHT Credits by Income Category (Rent/Interest shown for reference only — already counted above)</SubHeading>
                    <EditableDataTable
                      columns={[
                        { key: 'category', label: 'Category', displayKey: 'category_display',
                          options: [
                            { value: 'rent',         label: 'Rent' },
                            { value: 'interest',     label: 'Interest' },
                            { value: 'service_fees', label: 'Service Fees' },
                            { value: 'employment',   label: 'Employment (APIT)' },
                            { value: 'other',        label: 'Other' },
                          ],
                        },
                        { key: 'amount', label: 'Amount (Rs.)', right: true, format: formatCurrency },
                        { key: 'notes',  label: 'Notes' },
                      ]}
                      rows={s?.wht_certificates} canEdit={canEdit}
                      onEdit={(id, data) => patchRow('wht-certificates', id, data)}
                      onDelete={id => deleteRow('wht-certificates', id)}
                      onAdd={() => addRow('wht-certificates/', { category: 'rent', amount: 0 })}
                      addLabel="Add WHT Entry"
                    />
                    {(s?.wht_certificates || []).length > 0 && (
                      <div className="flex justify-between items-center px-2 py-1 bg-brand-black rounded-lg mt-1">
                        <span className="text-xs font-semibold text-white">Total (all certificates)</span>
                        <span className="font-mono text-xs font-semibold text-white">{formatCurrency(derivedCalc.wht_cert_all_total)}</span>
                      </div>
                    )}
                    {derivedCalc.wht_cert_total > 0 && (
                      <div className="flex justify-between items-center px-2 py-1 rounded-lg mt-1">
                        <span className="text-xs text-brand-gray">Counted toward Total Tax Credits (Service Fees / Employment / Other)</span>
                        <span className="font-mono text-xs text-brand-gray">{formatCurrency(derivedCalc.wht_cert_total)}</span>
                      </div>
                    )}
                  </>
                )}

                {/* ── Self-Assessment Installments ── */}
                {((s?.self_assessment_payments || []).length > 0 || canEdit) && (
                  <>
                    <SubHeading>Self-Assessment Installments</SubHeading>
                    <EditableDataTable
                      columns={[
                        { key: 'installment_number', label: 'Installment #' },
                        { key: 'payment_date',       label: 'Payment Date' },
                        { key: 'amount',             label: 'Amount (Rs.)', right: true, format: formatCurrency },
                      ]}
                      rows={s?.self_assessment_payments} canEdit={canEdit}
                      onEdit={(id, data) => patchRow('self-assessment', id, data)}
                      onDelete={id => deleteRow('self-assessment', id)}
                      onAdd={() => {
                        const used = new Set((s?.self_assessment_payments || []).map(p => p.installment_number))
                        const next = [1, 2, 3, 4].find(n => !used.has(n))
                        if (!next) { toast.error('All 4 installments already added.'); return }
                        addRow('self-assessment/', { installment_number: next, amount: 0 })
                      }}
                      addLabel="Add Installment"
                    />
                    {(s?.self_assessment_payments || []).length > 0 && (
                      <div className="flex justify-between items-center px-2 py-1 bg-brand-black rounded-lg mt-1">
                        <span className="text-xs font-semibold text-white">Total Self-Assessment</span>
                        <span className="font-mono text-xs font-semibold text-white">{formatCurrency(derivedCalc.self_assess_total)}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="mt-2">
                  <AmountRow label="Total Tax Credits" value={derivedCalc.total_tax_credits} highlight />
                </div>
              </div>
            </Section>

            {/* ── Assets ── */}
            <Section title="Statement of Assets" icon={Home} badge={totalAssets}>
              <div className="pt-2 space-y-4">

                {((s?.immovable_properties || []).length > 0 || canEdit) && (
                <div>
                  <SubHeading>Immovable Properties</SubHeading>
                  <EditableDataTable
                    columns={[
                      { key: 'situation_of_property', label: 'Location / Property' },
                      { key: 'date_of_acquisition', label: 'Acquired' },
                      { key: 'cost', label: 'Cost', right: true, format: formatCurrency },
                      { key: 'market_value', label: 'Market Value', right: true, format: formatCurrency },
                    ]}
                    rows={s?.immovable_properties} canEdit={canEdit}
                    onEdit={(id, data) => patchRow('assets/immovable', id, data)}
                    onDelete={id => deleteRow('assets/immovable', id)}
                    onAdd={() => addRow('assets/immovable/', { situation_of_property: '', cost: 0, market_value: 0 })}
                  />
                </div>
                )}

                {((s?.motor_vehicles || []).length > 0 || canEdit) && (
                <div>
                  <SubHeading>Motor Vehicles</SubHeading>
                  <EditableDataTable
                    columns={[
                      { key: 'description', label: 'Description' },
                      { key: 'registration_no', label: 'Reg. No.' },
                      { key: 'date_of_acquisition', label: 'Acquired' },
                      { key: 'cost_market_value', label: 'Cost / Value', right: true, format: formatCurrency },
                    ]}
                    rows={s?.motor_vehicles} canEdit={canEdit}
                    onEdit={(id, data) => patchRow('assets/vehicles', id, data)}
                    onDelete={id => deleteRow('assets/vehicles', id)}
                    onAdd={() => addRow('assets/vehicles/', { description: '', registration_no: '', cost_market_value: 0 })}
                  />
                </div>
                )}

                {((s?.bank_balances || []).length > 0 || canEdit) && (
                <div>
                  <SubHeading>Bank Balances</SubHeading>
                  <EditableDataTable
                    columns={[
                      { key: 'bank_name', label: 'Bank / Institution' },
                      { key: 'account_no', label: 'Account No.' },
                      { key: 'amount_invested', label: 'Invested', right: true, format: formatCurrency },
                      { key: 'interest', label: 'Interest', right: true, format: formatCurrency },
                      { key: 'balance', label: 'Balance', right: true, format: formatCurrency },
                    ]}
                    rows={s?.bank_balances} canEdit={canEdit}
                    onEdit={(id, data) => patchRow('assets/bank-balances', id, data)}
                    onDelete={id => deleteRow('assets/bank-balances', id)}
                    onAdd={() => addRow('assets/bank-balances/', { bank_name: '', account_no: '', balance: 0 })}
                  />
                </div>
                )}

                {((s?.shares_stocks || []).length > 0 || canEdit) && (
                <div>
                  <SubHeading>Shares &amp; Stocks</SubHeading>
                  <EditableDataTable
                    columns={[
                      { key: 'description', label: 'Description' },
                      { key: 'no_of_shares', label: 'Shares' },
                      { key: 'cost_market_value', label: 'Cost / Value', right: true, format: formatCurrency },
                      { key: 'net_dividend_income', label: 'Net Dividend', right: true, format: formatCurrency },
                    ]}
                    rows={s?.shares_stocks} canEdit={canEdit}
                    onEdit={(id, data) => patchRow('assets/shares', id, data)}
                    onDelete={id => deleteRow('assets/shares', id)}
                    onAdd={() => addRow('assets/shares/', { description: '', no_of_shares: 0, cost_market_value: 0 })}
                  />
                </div>
                )}

                {/* Cash in Hand */}
                <div>
                  <SubHeading>Cash in Hand</SubHeading>
                  {s?.cash_in_hand && <AmountRow label="Cash in Hand (Rs.)" value={s.cash_in_hand.amount} />}
                  {canEdit && (editingSection === 'cash_in_hand' ? (
                    <SectionEditForm fields={SECTION_FIELDS.cash_in_hand.fields} data={s?.cash_in_hand}
                      onSave={d => saveSection('cash_in_hand', d)} onCancel={() => setEditingSection(null)} saving={sectionSaving} />
                  ) : (
                    <button onClick={() => setEditingSection('cash_in_hand')} className="btn-ghost text-xs mt-1"><Pencil size={11} /> Edit</button>
                  ))}
                </div>

                {/* Gold & Jewellery */}
                <div>
                  <SubHeading>Gold &amp; Jewellery</SubHeading>
                  {s?.gold_jewellery && <>
                    <AmountRow label="Value (Rs.)" value={s.gold_jewellery.value} />
                    <Row label="Description" value={s.gold_jewellery.description} />
                  </>}
                  {canEdit && (editingSection === 'gold_jewellery' ? (
                    <SectionEditForm fields={SECTION_FIELDS.gold_jewellery.fields} data={s?.gold_jewellery}
                      onSave={d => saveSection('gold_jewellery', d)} onCancel={() => setEditingSection(null)} saving={sectionSaving} />
                  ) : (
                    <button onClick={() => setEditingSection('gold_jewellery')} className="btn-ghost text-xs mt-1"><Pencil size={11} /> Edit</button>
                  ))}
                </div>

                {/* Loans Given — single aggregate record (OneToOne) */}
                <div>
                  <SubHeading>Loans Given &amp; Receivable</SubHeading>
                  {s?.loans_given && (
                    <div className="space-y-0.5 mb-1">
                      <AmountRow label="Opening Balance"            value={s.loans_given.opening_balance} />
                      <AmountRow label="Given During the Year"      value={s.loans_given.given_during_year} />
                      <AmountRow label="Cash Received from Debtors" value={s.loans_given.cash_received_from_debtors} sub />
                      <AmountRow label="Balance as at 31.03"        value={s.loans_given.amount} />
                    </div>
                  )}
                  {canEdit && (editingSection === 'loans_given' ? (
                    <SectionEditForm
                      fields={SECTION_FIELDS.loans_given.fields}
                      data={s?.loans_given || {}}
                      onSave={d => saveSection('loans_given', d)}
                      onCancel={() => setEditingSection(null)}
                      saving={sectionSaving}
                    />
                  ) : (
                    <button onClick={() => setEditingSection('loans_given')} className="btn-ghost text-xs mt-1">
                      <Pencil size={11} /> Edit
                    </button>
                  ))}
                </div>

                {((s?.business_properties || []).length > 0 || canEdit) && (
                <div>
                  <SubHeading>Business Property</SubHeading>
                  <EditableDataTable
                    columns={[
                      { key: 'name_of_business', label: 'Business Name' },
                      { key: 'current_account_balance', label: 'Current A/C', right: true, format: formatCurrency },
                      { key: 'capital_account_balance', label: 'Capital A/C', right: true, format: formatCurrency },
                    ]}
                    rows={s?.business_properties} canEdit={canEdit}
                    onEdit={(id, data) => patchRow('assets/business', id, data)}
                    onDelete={id => deleteRow('assets/business', id)}
                    onAdd={() => addRow('assets/business/', { name_of_business: '', current_account_balance: 0 })}
                  />
                </div>
                )}

                {((s?.other_assets || []).length > 0 || canEdit) && (
                <div>
                  <SubHeading>Other Assets</SubHeading>
                  <EditableDataTable
                    columns={[
                      { key: 'description', label: 'Description' },
                      { key: 'acquisition_type', label: 'Type' },
                      { key: 'date_of_acquisition', label: 'Acquired' },
                      { key: 'cost_value', label: 'Cost / Value', right: true, format: formatCurrency },
                    ]}
                    rows={s?.other_assets} canEdit={canEdit}
                    onEdit={(id, data) => patchRow('assets/other', id, data)}
                    onDelete={id => deleteRow('assets/other', id)}
                    onAdd={() => addRow('assets/other/', { description: '', cost_value: 0 })}
                  />
                </div>
                )}

                {((s?.disposals || []).length > 0 || canEdit) && (
                  <div>
                    <SubHeading>Disposals During the Year</SubHeading>
                    <EditableDataTable
                      columns={[
                        { key: 'description', label: 'Description' },
                        { key: 'date_of_disposal', label: 'Disposal Date' },
                        { key: 'sales_proceed', label: 'Proceeds', right: true, format: formatCurrency },
                        { key: 'cost', label: 'Cost', right: true, format: formatCurrency },
                      ]}
                      rows={s?.disposals} canEdit={canEdit}
                      onEdit={(id, data) => patchRow('assets/disposals', id, data)}
                      onDelete={id => deleteRow('assets/disposals', id)}
                      onAdd={() => addRow('assets/disposals/', { description: '', sales_proceed: 0, cost: 0 })}
                    />
                  </div>
                )}
              </div>
            </Section>

            {/* ── Liabilities ── */}
            <Section title="Liabilities" icon={Banknote} badge={s?.liabilities?.length || 0}>
              <div className="pt-3">
                <EditableDataTable
                  columns={[
                    { key: 'description', label: 'Description' },
                    { key: 'security_on_liability', label: 'Security' },
                    { key: 'original_amount', label: 'Original', right: true, format: formatCurrency },
                    { key: 'amount_as_at_date', label: 'Balance 31.03', right: true, format: formatCurrency },
                    { key: 'amount_repaid_during_year', label: 'Repaid', right: true, format: formatCurrency },
                  ]}
                  rows={s?.liabilities} canEdit={canEdit}
                  onEdit={(id, data) => patchRow('liabilities', id, data)}
                  onDelete={id => deleteRow('liabilities', id)}
                  onAdd={() => addRow('liabilities/', { description: '', original_amount: 0, amount_as_at_date: 0 })}
                />
              </div>
            </Section>

            {/* ── Cash Flow ── */}
            <Section title="Cash Flow — Receipts & Payments" icon={Landmark}>
              <div className="pt-3">
                <CashFlowSection submissionId={submissionId} isReadOnly={!canEdit} showStepNav={false} />
              </div>
            </Section>

            {/* ── Declarant ── */}
            <Section title="Declarant Details" icon={User}
              onEdit={canEdit ? () => setEditingSection(editingSection === 'declarant_details' ? null : 'declarant_details') : null}
              editing={editingSection === 'declarant_details'}>
              {s?.declarant_details ? (
                <div className="pt-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      ['Full Name', s.declarant_details.full_name],
                      ['NIC / Passport', s.declarant_details.nic_passport],
                      ['TIN', s.declarant_details.tin || '—'],
                      ['PIN', s.declarant_details.pin || '—'],
                      ['Telephone', s.declarant_details.telephone || '—'],
                      ['Mobile', s.declarant_details.mobile || '—'],
                      ['Email', s.declarant_details.email],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-xs text-brand-gray">{label}</p>
                        <p className="text-sm text-white font-medium break-all">{value}</p>
                      </div>
                    ))}
                  </div>
                  {editingSection === 'declarant_details' && (
                    <SectionEditForm fields={SECTION_FIELDS.declarant_details.fields} data={s.declarant_details}
                      onSave={d => saveSection('declarant_details', d)} onCancel={() => setEditingSection(null)} saving={sectionSaving} />
                  )}
                </div>
              ) : (
                <div className="pt-3">
                  <p className="text-xs text-brand-gray text-center">No declarant details</p>
                  {editingSection === 'declarant_details' && (
                    <SectionEditForm fields={SECTION_FIELDS.declarant_details.fields} data={{}}
                      onSave={d => saveSection('declarant_details', d)} onCancel={() => setEditingSection(null)} saving={sectionSaving} />
                  )}
                </div>
              )}
            </Section>
          </div>

          {/* ── Right Sidebar ── */}
          <div className="space-y-4">
            {/* Tax Computation */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="section-header mb-0"><Calculator size={15} className="text-brand-yellow" />Tax Computation</h3>
              </div>
              <p className="text-xs text-brand-gray mb-3">Auto-calculated from income data</p>

              <ComputedAmount label="Assessable Income" value={derivedCalc.total_assessable_income} />
              {derivedCalc.exempt_dividend_income > 0 && (
                <div className="flex justify-between items-center py-1 pl-4">
                  <span className="text-xs text-brand-gray italic">Exempt Dividend Income (Gross)</span>
                  <span className="text-xs text-brand-success font-mono">{formatCurrency(derivedCalc.exempt_dividend_income)}</span>
                </div>
              )}
              {parseFloat(s?.foreign_income?.foreign_interest_income || 0) > 0 && (
                <div className="flex justify-between items-center py-1 pl-4">
                  <span className="text-xs text-brand-gray italic">Foreign Interest (Exempt — already excluded above, no further deduction)</span>
                  <span className="text-xs text-brand-success font-mono">{formatCurrency(s.foreign_income.foreign_interest_income)}</span>
                </div>
              )}
              {parseFloat(s?.dividend_income?.final_wht || 0) > 0 && (
                <div className="flex justify-between items-center py-1 pl-4">
                  <span className="text-xs text-brand-gray italic">Final WHT on Exempt Dividends</span>
                  <span className="text-xs text-brand-success font-mono">{formatCurrency(s.dividend_income.final_wht)}</span>
                </div>
              )}
              <ComputedAmount label="Less: Qualifying Pmts" value={derivedCalc.total_qualifying_payments} indent />
              <ComputedAmount label="Less: Personal Relief" value={derivedCalc.personal_relief} indent />
              <ComputedAmount label="Less: Rent Relief (25%)" value={derivedCalc.rent_relief} indent />
              <ComputedAmount label="Taxable Income" value={derivedCalc.net_taxable_income} highlight />

              {/* Foreign Income Tax — progressive slabs, capped at 15% (read-only) */}
              {(() => {
                const fi = s?.foreign_income || {}
                // Foreign Interest is exempt — excluded from taxable foreign income here too.
                const fiAmt = parseFloat(fi.employment_service_fee || 0) +
                              parseFloat(fi.foreign_business_income || 0) +
                              parseFloat(fi.other_foreign_income || 0)
                const fiPaid  = parseFloat(fi.foreign_tax_paid || 0)
                const fiTaxable = derivedCalc.taxable_foreign
                const fiGross = derivedCalc.foreign_tax_gross
                const fiNet   = derivedCalc.foreign_income_tax
                return (
                  <div className="mt-3 bg-brand-black-soft border border-brand-gray-border rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-brand-yellow font-semibold uppercase tracking-wider">Foreign Income Tax (max 15%)</p>
                    </div>
                    {fiAmt <= 0 ? (
                      <p className="text-xs text-brand-gray italic">No foreign income entered.</p>
                    ) : (
                      <>
                        <div className="flex justify-between items-center py-1 border-b border-brand-gray-border/50">
                          <span className="text-xs text-brand-gray">Foreign Income</span>
                          <span className="text-xs font-mono text-white">{formatCurrency(fiAmt)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-brand-gray-border/50">
                          <span className="text-xs text-brand-gray">Taxable Foreign Income (after relief)</span>
                          <span className="text-xs font-mono text-white">{formatCurrency(fiTaxable)}</span>
                        </div>
                        {derivedCalc.foreign_slab_breakdown.length > 0 && (
                          <div className="py-1.5 border-b border-brand-gray-border/50">
                            <table className="w-full text-xs">
                              <thead>
                                <tr>
                                  <th className="text-left font-medium text-brand-gray pb-1">Amount</th>
                                  <th className="text-center font-medium text-brand-gray pb-1">Rate</th>
                                  <th className="text-right font-medium text-brand-gray pb-1">Tax</th>
                                </tr>
                              </thead>
                              <tbody>
                                {derivedCalc.foreign_slab_breakdown.map((row, i) => {
                                  const pct = Math.round(parseFloat(row.rate) * 100)
                                  return (
                                    <tr key={i}>
                                      <td className="text-left font-mono text-white py-0.5">{formatCurrency(row.taxable_amount)}</td>
                                      <td className="text-center font-mono text-white py-0.5">{pct}%</td>
                                      <td className="text-right font-mono text-white py-0.5">{formatCurrency(row.tax)}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <div className="flex justify-between items-center py-1 border-b border-brand-gray-border/50">
                          <span className="text-xs text-brand-gray">Gross Foreign Tax</span>
                          <span className="text-xs font-mono text-white">{formatCurrency(fiGross)}</span>
                        </div>
                        {fiPaid > 0 && (
                          <div className="flex justify-between items-center py-1 border-b border-brand-gray-border/50 pl-3">
                            <span className="text-xs text-brand-gray">Less: Foreign Tax Paid (cage 901)</span>
                            <span className="text-xs font-mono text-white">({formatCurrency(fiPaid)})</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center pt-1.5">
                          <span className="text-xs font-semibold text-white">Net Foreign Tax Payable</span>
                          <span className="text-xs font-mono font-bold text-brand-yellow">{formatCurrency(fiNet)}</span>
                        </div>
                      </>
                    )}
                  </div>
                )
              })()}

              {/* Capital Gains Tax — flat 15%, never reduced by credits (read-only) */}
              <div className="mt-3 bg-brand-black-soft border border-brand-gray-border rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-brand-yellow font-semibold uppercase tracking-wider">Capital Gains Tax (flat 15%)</p>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-brand-gray-border/50">
                  <span className="text-xs text-brand-gray">Capital Gain (net, from disposal of assets)</span>
                  <span className="text-xs font-mono text-white">{formatCurrency(derivedCalc.capital_gain)}</span>
                </div>
                <div className="flex justify-between items-center pt-1.5">
                  <span className="text-xs font-semibold text-white">Capital Gains Tax Payable</span>
                  <span className="text-xs font-mono font-bold text-brand-yellow">{formatCurrency(derivedCalc.capital_gain_tax)}</span>
                </div>
              </div>

              <div className="h-px bg-brand-gray-border my-3" />

              {/* Slab breakdown — live from derivedCalc */}
              {derivedCalc.slab_breakdown.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-brand-gray uppercase tracking-wider mb-2">Tax Slab Breakdown</p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-brand-gray-border">
                        <th className="text-left pb-1 text-brand-gray font-medium">Slab</th>
                        <th className="text-right pb-1 text-brand-gray font-medium">Tax (Rs.)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {derivedCalc.slab_breakdown.map((row, i) => {
                        const isBalance = row.label.startsWith('Balance')
                        const displayLabel = isBalance
                          ? `Balance Rs. ${Math.round(parseFloat(row.taxable_amount || 0)).toLocaleString('en-LK')} @ 36%`
                          : row.label
                        return (
                          <tr key={i} className="border-b border-brand-gray-border/50">
                            <td className="py-1 text-brand-gray">{displayLabel}</td>
                            <td className="py-1 text-right font-mono text-white">{formatCurrencyInt(row.tax)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-between items-center py-1.5 border-b border-brand-gray-border/60">
                <span className="text-xs text-brand-gray">Capital Gains Tax (flat 15%)</span>
                <span className="text-xs font-mono text-white">{formatCurrency(derivedCalc.capital_gain_tax)}</span>
              </div>
              <ComputedAmount label="Gross Tax" value={derivedCalc.gross_tax} />
              <div className="h-px bg-brand-gray-border my-2" />
              {/* Tax credit lines — only from the Tax Credits section */}
              {parseFloat(s?.tax_credits?.apit_on_salary || 0) > 0 && (
                <div className="flex justify-between items-center py-1.5 pl-4 border-b border-brand-gray-border/60">
                  <span className="text-xs text-brand-gray">APIT on Salary</span>
                  <span className="text-xs font-mono text-white">({formatCurrency(s.tax_credits.apit_on_salary)})</span>
                </div>
              )}
              {parseFloat(s?.rent_income?.wht_deducted || 0) > 0 && (
                <div className="flex justify-between items-center py-1.5 pl-4 border-b border-brand-gray-border/60">
                  <span className="text-xs text-brand-gray">WHT on Rent Income</span>
                  <span className="text-xs font-mono text-white">({formatCurrency(s.rent_income.wht_deducted)})</span>
                </div>
              )}
              {parseFloat(s?.interest_income?.wht_deducted || 0) > 0 && (
                <div className="flex justify-between items-center py-1.5 pl-4 border-b border-brand-gray-border/60">
                  <span className="text-xs text-brand-gray">WHT on Interest Income</span>
                  <span className="text-xs font-mono text-white">({formatCurrency(s.interest_income.wht_deducted)})</span>
                </div>
              )}
              {(s?.sole_proprietorships || []).reduce((sum, sp) => sum + parseFloat(sp.wht_deducted || 0), 0) > 0 && (
                <div className="flex justify-between items-center py-1.5 pl-4 border-b border-brand-gray-border/60">
                  <span className="text-xs text-brand-gray">WHT on Business Income</span>
                  <span className="text-xs font-mono text-white">({formatCurrency((s?.sole_proprietorships || []).reduce((sum, sp) => sum + parseFloat(sp.wht_deducted || 0), 0))})</span>
                </div>
              )}
              {parseFloat(s?.tb_securities?.wht_deducted || 0) > 0 && (
                <div className="flex justify-between items-center py-1.5 pl-4 border-b border-brand-gray-border/60">
                  <span className="text-xs text-brand-gray">WHT on T-Bills / Securities</span>
                  <span className="text-xs font-mono text-white">({formatCurrency(s.tb_securities.wht_deducted)})</span>
                </div>
              )}
              {derivedCalc.wht_cert_total > 0 && (
                <div className="flex justify-between items-center py-1.5 pl-4 border-b border-brand-gray-border/60">
                  <span className="text-xs text-brand-gray">WHT Certificates (Service Fees / Employment / Other)</span>
                  <span className="text-xs font-mono text-white">({formatCurrency(derivedCalc.wht_cert_total)})</span>
                </div>
              )}
              {(s?.self_assessment_payments || []).filter(inst => parseFloat(inst.amount || 0) > 0).map(inst => (
                <div key={inst.id} className="flex justify-between items-center py-1.5 pl-4 border-b border-brand-gray-border/60">
                  <span className="text-xs text-brand-gray">Self-Assessment Installment {inst.installment_number}</span>
                  <span className="text-xs font-mono text-white">({formatCurrency(inst.amount)})</span>
                </div>
              ))}
              {parseFloat(s?.tax_credits?.partnership_tax_credit || 0) > 0 && (
                <div className="flex justify-between items-center py-1.5 pl-4 border-b border-brand-gray-border/60">
                  <span className="text-xs text-brand-gray">Partnership Tax Credit</span>
                  <span className="text-xs font-mono text-white">({formatCurrency(s.tax_credits.partnership_tax_credit)})</span>
                </div>
              )}
              {derivedCalc.capital_gain_tax > 0 && (
                <div className="flex justify-between items-center py-1.5 pl-4 border-b border-brand-gray-border/60">
                  <span className="text-xs text-brand-gray">Capital Gains Tax</span>
                  <span className="text-xs font-mono text-white">({formatCurrency(derivedCalc.capital_gain_tax)})</span>
                </div>
              )}
              {derivedCalc.refund_brought_forward > 0 && (
                <div className="flex justify-between items-center py-1.5 pl-4 border-b border-brand-gray-border/60">
                  <span className="text-xs text-brand-gray">Tax Refund Claim (60% from last Y/A)</span>
                  <span className="text-xs font-mono text-white">({formatCurrency(derivedCalc.refund_brought_forward)})</span>
                </div>
              )}
              {derivedCalc.wht_brought_forward > 0 && (
                <div className="flex justify-between items-center py-1.5 pl-4 border-b border-brand-gray-border/60">
                  <span className="text-xs text-brand-gray">WHT Brought Forward (from last Y/A)</span>
                  <span className="text-xs font-mono text-white">({formatCurrency(derivedCalc.wht_brought_forward)})</span>
                </div>
              )}
              <ComputedAmount label="Less: Total Tax Credits" value={derivedCalc.total_tax_credits} indent />
              {derivedCalc.wht_carried_forward > 0 && (
                <div className="flex justify-between items-center py-1.5 pl-4 border-b border-brand-gray-border/60">
                  <span className="text-xs text-brand-gray">WHT Carried Forward (to next Y/A)</span>
                  <span className="text-xs font-mono text-white">{formatCurrency(derivedCalc.wht_carried_forward)}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-1.5 pl-4 border-b border-brand-gray-border/60">
                <span className="text-xs text-brand-gray">Refund Carried Forward (60% to next Y/A)</span>
                <span className="text-xs font-mono text-white">{formatCurrency(derivedCalc.refund_carried_forward)}</span>
              </div>

              <div className="mt-4 bg-brand-yellow/10 border border-brand-yellow/30 rounded-xl p-4">
                <p className="text-xs text-brand-gray uppercase tracking-wider mb-2">BALANCE TAX PAYABLE</p>
                <ComputedAmount label="" value={derivedCalc.net_tax_payable} />
              </div>

              {/* Payment Status (Change 8) */}
              <div className="mt-4 border border-brand-gray-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-brand-gray uppercase tracking-wider">Payment Status</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${PAYMENT_STATUS_COLORS[s?.payment_status || 'pending']}`}>
                    {PAYMENT_STATUS_LABELS[s?.payment_status || 'pending']}
                  </span>
                </div>
                {s?.payment_updated_at && (
                  <p className="text-xs text-brand-gray">Updated: {formatDate(s.payment_updated_at)}</p>
                )}
                {s?.payment_slip_url && (
                  <a
                    href={s.payment_slip_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs text-brand-success hover:underline"
                  >
                    <Download size={12} /> View Payment Slip
                  </a>
                )}
              </div>
            </div>

            {s?.info_request_message && (
              <div className="bg-brand-red/10 border border-brand-red/20 rounded-xl p-4">
                <p className="text-xs text-brand-red font-semibold mb-1">Info Requested from Client</p>
                <p className="text-xs text-brand-gray">{s.info_request_message}</p>
              </div>
            )}

            {/* Documents */}
            <div className="card">
              <h3 className="section-header"><FileText size={16} className="text-brand-yellow" />Documents ({documents.length})</h3>
              {documents.length === 0 ? (
                <p className="text-sm text-brand-gray text-center py-4">No documents uploaded</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(docsBySection).map(([section, docs]) => (
                    <div key={section}>
                      <p className="text-xs text-brand-yellow font-semibold uppercase tracking-wider mb-2">
                        {SECTION_LABELS[section] || section}
                      </p>
                      <div className="space-y-1">
                        {docs.map(doc => (
                          <div key={doc.id} className="flex items-center gap-2 bg-brand-black-soft rounded-lg px-3 py-2">
                            <FileText size={12} className="text-brand-yellow flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-white truncate">{doc.original_filename}</p>
                              <p className="text-xs text-brand-gray">{doc.document_type_display}</p>
                            </div>
                            <div className="flex gap-1 items-center flex-shrink-0">
                              <a href={doc.file_url} target="_blank" rel="noreferrer"
                                className="p-1 text-brand-gray hover:text-brand-yellow rounded" title="View">
                                <Eye size={12} />
                              </a>
                              <button onClick={() => downloadDocument(doc)}
                                className="p-1 text-brand-gray hover:text-brand-yellow rounded" title="Download">
                                <Download size={12} />
                              </button>
                              {doc.is_verified && <CheckCircle size={12} className="text-brand-success" />}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>

      {/* ── Archive Modal ── */}
      {archiveModal && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setArchiveModal(false) }}
        >
          <div className="bg-brand-black-light border border-brand-gray-border rounded-2xl w-full max-w-md shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-brand-gray-border">
              <div className="flex items-center gap-2">
                <Archive size={17} className="text-brand-success" />
                <h3 className="text-base font-semibold text-white">Complete &amp; Archive</h3>
              </div>
              <button onClick={() => setArchiveModal(false)} className="text-brand-gray hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-brand-gray">
                Upload the IRD return and the IRD acknowledgement before archiving. Both documents will be stored in the client's archive folder.
              </p>

              <div>
                <label className="input-label">IRD Return <span className="text-brand-red">*</span></label>
                <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${archiveIrdReturnFile ? 'border-brand-success/60 bg-brand-success/5' : 'border-brand-gray-border hover:border-brand-yellow/50'}`}>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={e => setArchiveIrdReturnFile(e.target.files[0] || null)}
                  />
                  {archiveIrdReturnFile ? (
                    <>
                      <CheckCircle size={24} className="text-brand-success" />
                      <p className="text-sm font-medium text-white text-center">{archiveIrdReturnFile.name}</p>
                      <p className="text-xs text-brand-gray">{(archiveIrdReturnFile.size / 1024).toFixed(1)} KB · Click to change</p>
                    </>
                  ) : (
                    <>
                      <Upload size={24} className="text-brand-gray" />
                      <p className="text-sm text-brand-gray">Click to select file</p>
                      <p className="text-xs text-brand-gray">PDF, DOC, DOCX, JPG, PNG</p>
                    </>
                  )}
                </label>
              </div>

              <div>
                <label className="input-label">IRD Acknowledgement <span className="text-brand-red">*</span></label>
                <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${archiveAcknowledgementFile ? 'border-brand-success/60 bg-brand-success/5' : 'border-brand-gray-border hover:border-brand-yellow/50'}`}>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={e => setArchiveAcknowledgementFile(e.target.files[0] || null)}
                  />
                  {archiveAcknowledgementFile ? (
                    <>
                      <CheckCircle size={24} className="text-brand-success" />
                      <p className="text-sm font-medium text-white text-center">{archiveAcknowledgementFile.name}</p>
                      <p className="text-xs text-brand-gray">{(archiveAcknowledgementFile.size / 1024).toFixed(1)} KB · Click to change</p>
                    </>
                  ) : (
                    <>
                      <Upload size={24} className="text-brand-gray" />
                      <p className="text-sm text-brand-gray">Click to select file</p>
                      <p className="text-xs text-brand-gray">PDF, DOC, DOCX, JPG, PNG</p>
                    </>
                  )}
                </label>
              </div>
            </div>

            <div className="flex gap-3 justify-end px-6 pb-5">
              <button onClick={() => setArchiveModal(false)} className="btn-secondary">Cancel</button>
              <button
                onClick={handleArchiveSubmit}
                disabled={!archiveIrdReturnFile || !archiveAcknowledgementFile || archiveSubmission.isPending}
                className="btn-primary bg-brand-success border-brand-success hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {archiveSubmission.isPending
                  ? <><span className="w-4 h-4 border-2 border-brand-black border-t-transparent rounded-full animate-spin" />Archiving...</>
                  : <><Archive size={14} /> Confirm &amp; Archive</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
