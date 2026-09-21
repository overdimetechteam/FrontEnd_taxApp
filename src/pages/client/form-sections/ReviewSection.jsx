import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../../../services/api'
import { formatCurrency, formatDate } from '../../../utils/format'
import StatusBadge from '../../../components/common/StatusBadge'
import { ChevronLeft, Send, FileText, CheckCircle, AlertTriangle, Eye, Download } from 'lucide-react'
import toast from 'react-hot-toast'

function D(v) { return parseFloat(v || 0) }

export default function ReviewSection({ submissionId, submission, documents, onPrev, onGoToStep, isReadOnly }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [confirmed, setConfirmed] = useState(false)

  const localEmp        = (submission?.local_employments || []).reduce((s, lei) => s + D(lei.amount), 0)
  // Foreign Interest is exempt from tax — excluded from taxable foreign income
  // (mirrors calculate_full_tax in tax_calculator.py).
  const foreign         = D(submission?.foreign_income?.employment_service_fee)
                        + D(submission?.foreign_income?.foreign_business_income)
                        + D(submission?.foreign_income?.other_foreign_income)
  const terminal        = D(submission?.terminal_benefit?.amount)
  const rentGross       = D(submission?.rent_income?.gross_amount)
  const interest        = D(submission?.interest_income?.amount)
  const dividendTaxable = D(submission?.dividend_income?.amount)
  const soleProp        = (submission?.sole_proprietorships || []).reduce((s, sp) => s + D(sp.amount), 0)
  const otherInc        = D(submission?.other_income?.amount)
  const tbSecurities    = D(submission?.tb_securities?.gross_amount)
  const capitalGain     = Math.max(0, (submission?.disposals || []).reduce((s, d) => s + D(d.sales_proceed) - D(d.cost), 0))
  const totalAssessable = localEmp + foreign + terminal + rentGross + interest + dividendTaxable + soleProp + otherInc + tbSecurities + capitalGain

  const submitMutation = useMutation({
    mutationFn: () => api.post(`/tax/submissions/${submissionId}/submit/`),
    onSuccess: () => {
      toast.success('Form submitted successfully! Your consultant has been notified.')
      qc.invalidateQueries(['my-submissions'])
      qc.invalidateQueries(['submission', submissionId])
      navigate('/client/dashboard')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Submission failed'),
  })

  const hasDeclarant = !!submission?.declarant_details

  const sectionDocs = (section) => documents.filter(d => d.section === section)

  async function downloadDocument(doc) {
    try {
      const res = await api.get(doc.file_url, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a'); a.href = url; a.download = doc.original_filename; a.click()
    } catch { window.open(doc.file_url, '_blank') }
  }

  function SummaryRow({ label, value, highlight }) {
    return (
      <div className={`flex justify-between items-center py-2.5 border-b border-brand-gray-border last:border-0 ${highlight ? 'bg-brand-yellow/5 px-3 rounded-lg -mx-3' : ''}`}>
        <span className={`text-sm ${highlight ? 'font-semibold text-white' : 'text-brand-gray'}`}>{label}</span>
        <span className={`font-mono text-sm ${highlight ? 'font-bold text-brand-yellow text-base' : 'text-white'}`}>{value}</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className="card flex items-center justify-between">
        <div>
          <p className="text-sm text-brand-gray">Submission Status</p>
          <div className="mt-1"><StatusBadge status={submission?.status} /></div>
        </div>
        <div className="text-right">
          <p className="text-sm text-brand-gray">Tax Year</p>
          <p className="text-white font-semibold">{submission?.tax_year_label}</p>
        </div>
      </div>

      {/* Income Summary */}
      <div className="card">
        <h3 className="section-header"><FileText size={16} className="text-brand-yellow" />Income Summary</h3>
        <div className="space-y-0">
          {localEmp > 0 && (
            <SummaryRow label="Local Employment Income" value={formatCurrency(localEmp)} />
          )}
          {foreign > 0 && (
            <SummaryRow label="Foreign Income" value={formatCurrency(foreign)} />
          )}
          {terminal > 0 && (
            <SummaryRow label="Terminal Benefit" value={formatCurrency(terminal)} />
          )}
          {rentGross > 0 && (
            <SummaryRow label="Rent Income (Gross)" value={formatCurrency(rentGross)} />
          )}
          {interest > 0 && (
            <SummaryRow label="Interest Income" value={formatCurrency(interest)} />
          )}
          {capitalGain > 0 && (
            <SummaryRow label="Capital Gain (from disposal of assets)" value={formatCurrency(capitalGain)} />
          )}
          {dividendTaxable > 0 && (
            <SummaryRow label="Dividend Income" value={formatCurrency(dividendTaxable)} />
          )}
          {soleProp > 0 && (
            <SummaryRow label="Sole Proprietorship / Partnership Income" value={formatCurrency(soleProp)} />
          )}
          {otherInc > 0 && (
            <SummaryRow label="Other Income" value={formatCurrency(otherInc)} />
          )}
          {tbSecurities > 0 && (
            <SummaryRow label="T-Bills & Securities Income" value={formatCurrency(tbSecurities)} />
          )}
          <SummaryRow label="TOTAL ASSESSABLE INCOME" value={formatCurrency(totalAssessable)} highlight />
        </div>
      </div>

      {/* Documents Summary */}
      <div className="card">
        <h3 className="section-header"><FileText size={16} className="text-brand-yellow" />Uploaded Documents ({documents.length})</h3>
        {documents.length === 0 ? (
          <div className="text-center py-4 text-brand-gray text-sm">No documents uploaded yet</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {documents.map(doc => (
              <div key={doc.id} className="flex items-center gap-2 bg-brand-black-soft rounded-lg px-3 py-2">
                <FileText size={13} className="text-brand-yellow flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white truncate">{doc.original_filename}</p>
                  <p className="text-xs text-brand-gray">{doc.document_type_display}</p>
                </div>
                <div className="flex gap-1 items-center flex-shrink-0">
                  <a href={doc.file_url} target="_blank" rel="noreferrer"
                    className="p-1 text-brand-gray hover:text-brand-yellow rounded" title="View">
                    <Eye size={13} />
                  </a>
                  <button type="button" onClick={() => downloadDocument(doc)}
                    className="p-1 text-brand-gray hover:text-brand-yellow rounded" title="Download">
                    <Download size={13} />
                  </button>
                  {doc.is_verified && <CheckCircle size={12} className="text-brand-success" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Declarant */}
      {submission?.declarant_details && (
        <div className="card">
          <h3 className="section-header">Declarant Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              ['Full Name', submission.declarant_details.full_name],
              ['NIC/Passport', submission.declarant_details.nic_passport],
              ['TIN', submission.declarant_details.tin || '—'],
              ['PIN', submission.declarant_details.pin || '—'],
              ['Mobile', submission.declarant_details.mobile || '—'],
              ['Email', submission.declarant_details.email],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-brand-gray">{label}</p>
                <p className="text-sm text-white font-medium">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation warnings */}
      {!hasDeclarant && (
        <div className="bg-brand-red/10 border border-brand-red/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-brand-red flex-shrink-0 mt-0.5" />
          <p className="text-sm text-brand-gray">
            <span className="text-white font-medium">Missing: </span>
            Declarant details are required before submitting.{' '}
            <button
              type="button"
              onClick={() => onGoToStep?.(4)}
              className="text-brand-yellow underline hover:opacity-80 transition-opacity"
            >
              Go to Step 4 — Declarant Details
            </button>
          </p>
        </div>
      )}

      {/* Submit */}
      {!isReadOnly && (
        <div className="form-section">
          <h3 className="section-header text-white">Final Submission</h3>
          <p className="text-sm text-brand-gray mb-4">
            Before submitting, please confirm that all information provided is accurate and complete.
            Once submitted, you cannot edit the form unless your consultant requests additional information.
          </p>

          <label className="flex items-start gap-3 cursor-pointer mb-6">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-brand-yellow"
            />
            <span className="text-sm text-brand-gray">
              I confirm that all information provided in this tax return is true, accurate, and complete to the best of my knowledge.
              I understand that false declarations may result in legal penalties.
            </span>
          </label>

          <div className="flex justify-between">
            <button type="button" onClick={onPrev} className="btn-secondary">
              <ChevronLeft size={15} /> Previous
            </button>
            <button
              type="button"
              onClick={() => submitMutation.mutate()}
              disabled={!confirmed || !hasDeclarant || submitMutation.isPending}
              className="btn-primary"
            >
              {submitMutation.isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-brand-black border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <><Send size={15} /> Submit Tax Form</>
              )}
            </button>
          </div>
        </div>
      )}

      {isReadOnly && (
        <div className="flex justify-between">
          <button type="button" onClick={onPrev} className="btn-secondary">
            <ChevronLeft size={15} /> Previous
          </button>
        </div>
      )}
    </div>
  )
}
