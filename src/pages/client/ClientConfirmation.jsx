import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import PageHeader from '../../components/common/PageHeader'
import {
  CheckCircle, Banknote, Phone, Mail, ArrowLeft, Clock,
  FileText, TrendingUp, Home, Car, Landmark, PieChart,
  Wallet, Package, Building2, AlertTriangle, ChevronDown, ChevronRight, Download,
  Upload, Paperclip, X, Eye
} from 'lucide-react'
import { formatCurrency, formatDate } from '../../utils/format'
import toast from 'react-hot-toast'
import { useState, useRef } from 'react'

/* ── Collapsible section ── */
function Section({ title, icon: Icon, children, count }) {
  const [open, setOpen] = useState(true)
  if (!count) return null
  return (
    <div className="border border-brand-gray-border rounded-xl overflow-hidden mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-brand-black-soft hover:bg-brand-black-mid transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon size={15} className="text-brand-yellow" />
          <span className="text-sm font-semibold text-white">{title}</span>
          <span className="text-xs bg-brand-yellow/10 text-brand-yellow px-2 py-0.5 rounded-full">{count}</span>
        </div>
        {open ? <ChevronDown size={14} className="text-brand-gray" /> : <ChevronRight size={14} className="text-brand-gray" />}
      </button>
      {open && <div className="px-4 pb-4 pt-2">{children}</div>}
    </div>
  )
}

/* ── Simple KV row ── */
function KVRow({ label, value }) {
  if (!value || value === '0.00' || value === 'Rs. 0.00') return null
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-brand-gray-border/50 last:border-0">
      <span className="text-xs text-brand-gray">{label}</span>
      <span className="text-xs text-white font-medium text-right max-w-[55%]">{value}</span>
    </div>
  )
}

/* ── Asset mini-card ── */
function AssetCard({ children }) {
  return (
    <div className="bg-brand-black rounded-lg p-3 mb-2 last:mb-0 space-y-0.5">
      {children}
    </div>
  )
}

export default function ClientConfirmation() {
  const { submissionId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [bankSlip, setBankSlip] = useState(null)
  const [showPaymentPopup, setShowPaymentPopup] = useState(false)
  const fileInputRef = useRef()

  const { data: submission, isLoading } = useQuery({
    queryKey: ['submission', submissionId],
    queryFn: () => api.get(`/tax/submissions/${submissionId}/`).then(r => r.data),
  })

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', submissionId],
    queryFn: () => api.get(`/documents/submission/${submissionId}/`).then(r => r.data),
    enabled: !!submissionId,
  })

  async function downloadDocument(doc) {
    try {
      const res = await api.get(doc.file_url, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a'); a.href = url; a.download = doc.original_filename; a.click()
    } catch { window.open(doc.file_url, '_blank') }
  }

  function handleSlipFile(e) {
    const f = e.target.files[0]
    if (!f) return
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(f.type)) { toast.error('Only PDF, JPG, PNG or WEBP files are accepted.'); return }
    if (f.size > 10 * 1024 * 1024) { toast.error('File must be under 10 MB.'); return }
    setBankSlip(f)
  }

  const acknowledgeMutation = useMutation({
    mutationFn: () => {
      if (bankSlip) {
        const form = new FormData()
        form.append('payment_slip', bankSlip)
        return api.post(`/tax/submissions/${submissionId}/client-confirm/`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }
      return api.post(`/tax/submissions/${submissionId}/client-confirm/`)
    },
    onSuccess: () => {
      qc.invalidateQueries(['my-submissions'])
      setShowPaymentPopup(true)
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  })

  function closePaymentPopup() {
    setShowPaymentPopup(false)
    navigate('/client/dashboard')
  }

  const finalConfirmMutation = useMutation({
    mutationFn: () => api.post(`/tax/submissions/${submissionId}/client-final-confirm/`),
    onSuccess: () => {
      toast.success('Tax return confirmed. Your consultant has been notified.')
      qc.invalidateQueries(['my-submissions'])
      navigate('/client/dashboard')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-brand-yellow border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // ── Payment notice ──
  // Keep showing this view (with the popup) while the popup is open, even if the
  // submission status has since refreshed to 'confirmed' in the background — the
  // popup must only be dismissed by explicit user action, not a data refetch.
  if (submission?.status === 'awaiting_confirmation' || showPaymentPopup) {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in">
        {showPaymentPopup && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-brand-black-light border border-brand-gray-border rounded-2xl w-full max-w-md shadow-2xl animate-slide-up p-6 text-center">
              <div className="w-14 h-14 mx-auto mb-4 bg-brand-success/15 rounded-full flex items-center justify-center">
                <CheckCircle size={28} className="text-brand-success" />
              </div>
              <p className="text-base font-bold text-white mb-3">Thank you for completing your payment.</p>
              <p className="text-sm text-brand-gray mb-6">
                Your payment is currently being verified by the DPR team. Once the payment has been confirmed, your detailed tax computation will be available in the portal.
              </p>
              <button onClick={closePaymentPopup} className="btn-primary w-full justify-center">
                Got it
              </button>
            </div>
          </div>
        )}
        <button onClick={() => navigate('/client/dashboard')} className="btn-ghost mb-4 text-sm">
          <ArrowLeft size={15} /> Back to Dashboard
        </button>
        <PageHeader title="Payment Required" subtitle={`Tax Return ${submission?.tax_year_label}`} />

        <div className="card mb-6 border-brand-yellow/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-brand-yellow/15 rounded-xl flex items-center justify-center flex-shrink-0">
              <Banknote size={22} className="text-brand-yellow" />
            </div>
            <div>
              <p className="text-base font-bold text-white">Your Tax Return Has Been Processed</p>
              <p className="text-sm text-brand-gray">A payment is required to finalise your submission.</p>
            </div>
          </div>
          <div className="bg-brand-black rounded-xl p-4 space-y-3 text-sm">
            {[
              `Your tax return for ${submission?.tax_year_label} has been reviewed and processed by your consultant.`,
              'Please contact the office to arrange payment. Our Accounts Division will confirm receipt of payment.',
              'Once payment is confirmed, your consultant will send you the full tax computation for your review.',
            ].map((text, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-brand-yellow mt-1.5 flex-shrink-0" />
                <p className="text-brand-gray">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card mb-6 bg-brand-black-soft border-brand-gray-border">
          <div className="flex items-center gap-2 mb-3">
            <Phone size={15} className="text-brand-yellow" />
            <p className="text-sm font-semibold text-white">Contact Accounts Division</p>
          </div>
          <p className="text-sm text-brand-gray mb-3">Please reach out to your assigned consultant or the accounts office to make the necessary payment arrangements.</p>
          {(submission?.consultant_email || submission?.consultant_phone) && (
            <div className="space-y-2">
              {submission.consultant_name && (
                <p className="text-xs text-brand-gray uppercase tracking-wider mb-1">{submission.consultant_name}</p>
              )}
              {submission.consultant_email && (
                <a
                  href={`mailto:${submission.consultant_email}`}
                  className="flex items-center gap-2 text-sm text-white hover:text-brand-yellow transition-colors"
                >
                  <Mail size={14} className="text-brand-yellow flex-shrink-0" />
                  {submission.consultant_email}
                </a>
              )}
              {submission.consultant_phone && (
                <a
                  href={`tel:${submission.consultant_phone}`}
                  className="flex items-center gap-2 text-sm text-white hover:text-brand-yellow transition-colors"
                >
                  <Phone size={14} className="text-brand-yellow flex-shrink-0" />
                  {submission.consultant_phone}
                </a>
              )}
            </div>
          )}
        </div>

        {/* Bank Transfer Details */}
        <div className="card mb-6 border-brand-yellow/20">
          <div className="flex items-center gap-2 mb-3">
            <Landmark size={15} className="text-brand-yellow" />
            <p className="text-sm font-semibold text-white">Bank Transfer Details</p>
          </div>
          <p className="text-xs text-brand-gray mb-3">Please use the following bank account to make your payment:</p>
          <div className="bg-brand-black rounded-xl p-4 space-y-0">
            {[
              ['Account Name',   'DPR CONSULTANTS (PVT) LTD'],
              ['Account Number', '055010077041'],
              ['Bank',           'HNB'],
              ['Branch',         'Borella'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-center py-2 border-b border-brand-gray-border/40 last:border-0">
                <span className="text-xs text-brand-gray">{label}</span>
                <span className="text-sm font-semibold text-white font-mono">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          {/* Bank slip upload */}
          <div className="mb-5">
            <p className="text-xs text-brand-gray uppercase tracking-wider mb-2">
              Attach Bank Payment Slip <span className="normal-case">(PDF / Image — optional)</span>
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={handleSlipFile}
            />
            {bankSlip ? (
              <div className="flex items-center gap-2 bg-brand-black rounded-lg px-3 py-2 border border-brand-yellow/30">
                <Paperclip size={14} className="text-brand-yellow flex-shrink-0" />
                <span className="text-xs text-white truncate flex-1">{bankSlip.name}</span>
                <button onClick={() => setBankSlip(null)} className="text-brand-gray hover:text-white">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current.click()}
                className="w-full border border-dashed border-brand-gray-border rounded-lg px-4 py-3 text-xs text-brand-gray hover:border-brand-yellow/40 hover:text-brand-yellow transition-colors flex items-center justify-center gap-2"
              >
                <Upload size={14} /> Click to attach bank payment slip
              </button>
            )}
          </div>

          <p className="text-sm text-brand-gray mb-4">
            Click below to acknowledge that you have received this payment notice. This does not complete your submission — payment confirmation by Accounts Division is still required.
          </p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => navigate('/client/dashboard')} className="btn-secondary">Later</button>
            <button onClick={() => acknowledgeMutation.mutate()} disabled={acknowledgeMutation.isPending} className="btn-primary">
              {acknowledgeMutation.isPending
                ? <><span className="w-4 h-4 border-2 border-brand-black border-t-transparent rounded-full animate-spin" />Processing...</>
                : <><CheckCircle size={15} /> Acknowledge Payment Notice</>
              }
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Awaiting payment confirmation ──
  if (submission?.status === 'confirmed') {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Clock size={48} className="text-brand-yellow opacity-60" />
        <p className="text-white text-lg font-semibold">Awaiting Payment Confirmation</p>
        <p className="text-sm text-brand-gray text-center max-w-sm">Accounts Division is confirming your payment. Your consultant will send you the full tax computation once payment is confirmed.</p>
        <button onClick={() => navigate('/client/dashboard')} className="btn-primary">Back to Dashboard</button>
      </div>
    )
  }

  async function downloadPdf() {
    try {
      const res = await api.get(`/tax/submissions/${submissionId}/pdf/`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `Tax_Return_${submission?.tax_year_label?.replace(/\//g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('PDF is not available yet. Please wait for payment confirmation.')
    }
  }

  // ── Full tax computation + assets & liabilities review ──
  if (submission?.status === 'awaiting_client_review') {
    const s = submission
    const num = v => parseFloat(v || 0)

    // Foreign Interest is exempt from tax — excluded from taxable foreign income
    // (mirrors calculate_full_tax in tax_calculator.py).
    const foreignTotal = num(s.foreign_income?.employment_service_fee) +
      num(s.foreign_income?.foreign_business_income) +
      num(s.foreign_income?.other_foreign_income)
    const capitalGain = Math.max(0, (s.disposals || []).reduce((a, d) => a + num(d.sales_proceed) - num(d.cost), 0))
    const selfAssessTotal = (s.self_assessment_payments || []).reduce((a, p) => a + num(p.amount), 0)
    const soleWhtTotal = (s.sole_proprietorships || []).reduce((a, sp) => a + num(sp.wht_deducted), 0)
    const otherWhtCertsTotal = (s.wht_certificates || [])
      .filter(c => c.category !== 'rent' && c.category !== 'interest')
      .reduce((a, c) => a + num(c.amount), 0)

    // Cash-flow pre-computed totals
    const cf = s.cash_flow
    let cfOpeningTotal = 0, cfTotalReceipts = 0, cfTotalCashAvailable = 0,
        cfTotalPayments = 0, cfNetCash = 0, cfClosingTotal = 0
    if (cf?.id) {
      const openFav = (cf.opening_favourable_banks || []).reduce((a, b) => a + num(b.amount), 0)
      const openOD  = (cf.opening_overdraft_banks  || []).reduce((a, b) => a + num(b.amount), 0)
      cfOpeningTotal = num(cf.opening_cash_in_hand) + openFav - openOD
      cfTotalReceipts = [
        cf.receipt_employment_income, cf.receipt_interest_savings,
        cf.receipt_rent_income, cf.receipt_tb_securities, cf.receipt_sale_shares,
        cf.receipt_dividend_income, cf.receipt_drawings_sole_partner, cf.receipt_bank_loan,
        cf.receipt_other_loans, cf.receipt_sale_land_building, cf.receipt_sale_motor_vehicle,
        cf.receipt_sale_other_assets,
      ].reduce((a, v) => a + num(v), 0)
      cfTotalCashAvailable = cfOpeningTotal + cfTotalReceipts
      cfTotalPayments = [
        cf.payment_purchase_land_building, cf.payment_purchase_motor_vehicle,
        cf.payment_purchase_other_assets, cf.payment_repayment_bank_loan,
        cf.payment_lease_rentals, cf.payment_jewellery_gems, cf.payment_other_loans,
        cf.payment_wht, cf.payment_income_tax, cf.payment_apit,
        cf.payment_investment_shares, cf.payment_loans_given_others,
      ].reduce((a, v) => a + num(v), 0)
      cfNetCash = cfTotalCashAvailable - cfTotalPayments
      const closeFav = (cf.closing_favourable_banks || []).reduce((a, b) => a + num(b.amount), 0)
      const closeOD  = (cf.closing_overdraft_banks  || []).reduce((a, b) => a + num(b.amount), 0)
      cfClosingTotal = num(cf.closing_cash_in_hand) + closeFav - closeOD
    }

    const hasAssets = (
      s.immovable_properties?.length || s.motor_vehicles?.length ||
      s.bank_balances?.length || s.shares_stocks?.length ||
      num(s.cash_in_hand?.amount) > 0 || !!s.loans_given ||
      num(s.gold_jewellery?.value) > 0 || s.business_properties?.length ||
      s.other_assets?.length || s.disposals?.length
    )
    const hasLiabilities = s.liabilities?.length > 0
    const hasCashFlow = cf?.id && (cfOpeningTotal + cfTotalReceipts + cfTotalPayments > 0)

    // ── Reusable inline helpers ──
    function SubBar({ label, value }) {
      return (
        <div className="flex justify-between items-center py-2 bg-brand-black rounded-lg px-3 my-2">
          <span className="text-sm font-semibold text-white">{label}</span>
          <span className="font-mono text-sm font-bold text-white">{formatCurrency(value)}</span>
        </div>
      )
    }
    function SecLabel({ label }) {
      return <p className="text-xs font-semibold text-brand-gray uppercase tracking-wider mb-2 mt-4 pb-1 border-b border-brand-gray-border/40">{label}</p>
    }
    function LineRow({ label, value, deduction, dimmed }) {
      if (num(value) === 0) return null
      return (
        <div className="flex justify-between items-center py-1.5 border-b border-brand-gray-border/50 pl-3">
          <span className={`text-sm ${dimmed ? 'text-brand-gray/50' : 'text-brand-gray'}`}>{label}</span>
          <span className={`font-mono text-sm ${dimmed ? 'text-brand-gray/50' : 'text-white'}`}>
            {deduction ? `(${formatCurrency(value)})` : formatCurrency(value)}
          </span>
        </div>
      )
    }
    function CfLineRow({ label, value, deduction }) {
      if (num(value) === 0) return null
      return (
        <div className="flex justify-between items-center py-1.5 border-b border-brand-gray-border/40 pl-3">
          <span className="text-sm text-brand-gray">{label}</span>
          <span className="font-mono text-sm text-white">
            {deduction ? `(${formatCurrency(value)})` : formatCurrency(value)}
          </span>
        </div>
      )
    }

    return (
      <div className="max-w-3xl mx-auto animate-fade-in">
        <button onClick={() => navigate('/client/dashboard')} className="btn-ghost mb-4 text-sm">
          <ArrowLeft size={15} /> Back to Dashboard
        </button>

        <PageHeader
          title="Review Your Tax Return"
          subtitle={`${s.tax_year_label} · Please review all details before confirming`}
        />

        {/* ── 1. Tax Computation ── */}
        <div className="card mb-4 border-brand-yellow/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-brand-yellow/15 rounded-xl flex items-center justify-center flex-shrink-0">
              <FileText size={18} className="text-brand-yellow" />
            </div>
            <div>
              <p className="text-base font-bold text-white">Tax Computation</p>
              <p className="text-xs text-brand-gray">{s.tax_year_label}</p>
            </div>
          </div>

          {/* A. Income Sources */}
          <SecLabel label="A. Income Sources" />
          <LineRow label="Employment Income"            value={(s.local_employments || []).reduce((a, lei) => a + num(lei.amount), 0)} />
          <LineRow label="Foreign Income"               value={foreignTotal} />
          <LineRow label="Terminal Benefit"             value={s.terminal_benefit?.amount} />
          <LineRow label="Rent Income (Gross)"          value={s.rent_income?.gross_amount} />
          <LineRow label="Interest Income"              value={s.interest_income?.amount} />
          <LineRow label="Capital Gain (from disposal of assets)" value={capitalGain} />
          <LineRow label="Dividend Income (Taxable)"    value={s.dividend_income?.amount} />
          {(s.sole_proprietorships || []).map((sp, i) => (
            <LineRow key={sp.id ?? i} label={sp.business_name ? `Business Income — ${sp.business_name}` : 'Sole Proprietorship Income'} value={sp.amount} />
          ))}
          <LineRow label="Other Income"                 value={s.other_income?.amount} />
          {num(s.foreign_income?.foreign_interest_income) > 0 && (
            <LineRow label="Foreign Interest (Exempt, excluded from tax)" value={s.foreign_income.foreign_interest_income} dimmed />
          )}
          {num(s.dividend_income?.exempt_amount) > 0 && (
            <LineRow label="Exempt Dividend Income (Gross, excluded from tax)" value={s.dividend_income.exempt_amount} dimmed />
          )}
          {num(s.dividend_income?.final_wht) > 0 && (
            <LineRow label="Final WHT on Exempt Dividends" value={s.dividend_income.final_wht} dimmed />
          )}
          <SubBar label="Total Assessable Income" value={s.total_assessable_income} />

          {/* B. Deductions & Reliefs */}
          {(num(s.total_qualifying_payments) > 0 || num(s.personal_relief) > 0 || num(s.rent_relief) > 0) && (
            <>
              <SecLabel label="B. Deductions &amp; Reliefs" />
              <LineRow label="Donation — Charitable Institutions" value={s.qualifying_payments?.donation_charitable} deduction />
              <LineRow label="Donation — Government"              value={s.qualifying_payments?.donation_government} deduction />
              <LineRow label="Solar Panel Expenditure"            value={s.qualifying_payments?.solar_panels_expenditure} deduction />
              <LineRow label="Personal Relief"                    value={s.personal_relief} deduction />
              <LineRow label="Rent Relief (25% of gross rent)"   value={s.rent_relief} deduction />
            </>
          )}
          <SubBar label="Taxable Income" value={s.net_taxable_income} />

          {/* C. Foreign Income Tax */}
          {foreignTotal > 0 && (
            <>
              <SecLabel label="C. Foreign Income Tax (Progressive, capped at 15%)" />
              <LineRow label="Foreign Income"            value={foreignTotal} />
              <LineRow label="Gross Foreign Tax"         value={num(s.foreign_income_tax) + num(s.foreign_income?.foreign_tax_paid)} />
              <LineRow label="Foreign Tax Paid Abroad"   value={s.foreign_income?.foreign_tax_paid} deduction />
              <LineRow label="Net Foreign Income Tax"    value={s.foreign_income_tax} />
            </>
          )}

          {/* Capital Gains Tax — flat 15%, never reduced by credits */}
          {capitalGain > 0 && (
            <>
              <SecLabel label="Capital Gains Tax (flat 15%)" />
              <LineRow label="Capital Gain (net, from disposal of assets)" value={capitalGain} />
              <LineRow label="Capital Gains Tax"          value={s.capital_gain_tax} />
            </>
          )}

          {/* D. Tax Slab Breakdown */}
          {s.slab_breakdown?.length > 0 && (
            <>
              <SecLabel label="D. Tax on Taxable Income" />
              {s.slab_breakdown.map((sl, i) => (
                <div key={i} className="flex justify-between items-center py-1.5 border-b border-brand-gray-border/50 pl-3">
                  <span className="text-sm text-brand-gray">{sl.label}</span>
                  <span className="font-mono text-sm text-white">{formatCurrency(sl.tax)}</span>
                </div>
              ))}
            </>
          )}
          {num(s.gross_tax) > 0 && <SubBar label="Gross Tax" value={s.gross_tax} />}

          {/* E. Tax Credits — also shown when credits are fully carried forward to next
              Y/A (total_tax_credits nets to 0 in that case, but the credit itself must
              still be visible, not hidden as if it vanished) */}
          {(num(s.total_tax_credits) > 0 || num(s.wht_carried_forward) > 0 || num(s.refund_carried_forward) > 0) && (
            <>
              <SecLabel label="E. Tax Credits" />
              <LineRow label="APIT on Salary"            value={s.tax_credits?.apit_on_salary} deduction />
              <LineRow label="WHT on Rent Income"        value={s.rent_income?.wht_deducted} deduction />
              <LineRow label="WHT on Interest Income"    value={s.interest_income?.wht_deducted} deduction />
              <LineRow label="WHT on Business Income"    value={soleWhtTotal} deduction />
              <LineRow label="WHT on T-Bills / Securities" value={s.tb_securities?.wht_deducted} deduction />
              <LineRow label="WHT Certificates (Service Fees / Other)" value={otherWhtCertsTotal} deduction />
              <LineRow label="Partnership Tax Credit"    value={s.tax_credits?.partnership_tax_credit} deduction />
              <LineRow label="Capital Gains Tax"          value={s.capital_gain_tax} deduction />
              <LineRow label="Tax Refund Claim (60% from last Y/A)" value={s.tax_credits?.refund_brought_forward} deduction />
              <LineRow label="WHT Brought Forward (from last Y/A)" value={s.tax_credits?.wht_brought_forward} deduction />
              {selfAssessTotal > 0 && (
                <div className="flex justify-between items-center py-1.5 border-b border-brand-gray-border/50 pl-3">
                  <span className="text-sm text-brand-gray">Self-Assessment Payments</span>
                  <span className="font-mono text-sm text-white">({formatCurrency(selfAssessTotal)})</span>
                </div>
              )}
              <SubBar label="Total Tax Credits" value={s.total_tax_credits} />
              <LineRow label="WHT Carried Forward (to next Y/A)" value={s.wht_carried_forward} />
              <LineRow label="Refund Carried Forward (60% to next Y/A)" value={s.refund_carried_forward} />
            </>
          )}

          {/* Net Tax Payable */}
          <div className="flex justify-between items-center py-3 bg-brand-yellow/5 px-3 rounded-lg mt-2">
            <span className="text-sm font-semibold text-white flex items-center gap-2">
              <TrendingUp size={14} className="text-brand-yellow" /> Net Tax Payable
            </span>
            <span className="font-mono text-xl text-brand-yellow font-bold">{formatCurrency(s.net_tax_payable)}</span>
          </div>
        </div>

        {/* ── 2. Assets ── */}
        {hasAssets && (
          <div className="card mb-4">
            <p className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Package size={15} className="text-brand-yellow" /> Assets
            </p>

            <Section title="Immovable Properties" icon={Home} count={s.immovable_properties?.length}>
              {s.immovable_properties?.map((p, i) => (
                <AssetCard key={i}>
                  <KVRow label="Property"      value={p.situation_of_property} />
                  <KVRow label="Date Acquired" value={formatDate(p.date_of_acquisition)} />
                  <KVRow label="Cost"          value={formatCurrency(p.cost)} />
                  <KVRow label="Market Value"  value={formatCurrency(p.market_value)} />
                </AssetCard>
              ))}
            </Section>

            <Section title="Motor Vehicles" icon={Car} count={s.motor_vehicles?.length}>
              {s.motor_vehicles?.map((v, i) => (
                <AssetCard key={i}>
                  <KVRow label="Description"         value={v.description} />
                  <KVRow label="Reg. No."            value={v.registration_no} />
                  <KVRow label="Date Acquired"       value={formatDate(v.date_of_acquisition)} />
                  <KVRow label="Cost / Market Value" value={formatCurrency(v.cost_market_value)} />
                </AssetCard>
              ))}
            </Section>

            <Section title="Bank Balances" icon={Landmark} count={s.bank_balances?.length}>
              {s.bank_balances?.map((b, i) => (
                <AssetCard key={i}>
                  <KVRow label="Bank"            value={b.bank_name} />
                  <KVRow label="Account No."     value={b.account_no} />
                  <KVRow label="Amount Invested" value={formatCurrency(b.amount_invested)} />
                  <KVRow label="Interest"        value={formatCurrency(b.interest)} />
                  <KVRow label="Balance"         value={formatCurrency(b.balance)} />
                </AssetCard>
              ))}
            </Section>

            <Section title="Shares &amp; Stocks" icon={PieChart} count={s.shares_stocks?.length}>
              {s.shares_stocks?.map((sh, i) => (
                <AssetCard key={i}>
                  <KVRow label="Description"         value={sh.description} />
                  <KVRow label="No. of Shares"       value={sh.no_of_shares?.toString()} />
                  <KVRow label="Date Acquired"       value={formatDate(sh.date_of_acquisition)} />
                  <KVRow label="Cost / Market Value" value={formatCurrency(sh.cost_market_value)} />
                  <KVRow label="Net Dividend Income" value={formatCurrency(sh.net_dividend_income)} />
                </AssetCard>
              ))}
            </Section>

            {num(s.cash_in_hand?.amount) > 0 && (
              <div className="border border-brand-gray-border rounded-xl overflow-hidden mb-3">
                <div className="flex items-center gap-2 px-4 py-3 bg-brand-black-soft">
                  <Wallet size={15} className="text-brand-yellow" />
                  <span className="text-sm font-semibold text-white">Cash in Hand</span>
                </div>
                <div className="px-4 py-3">
                  <div className="flex justify-between">
                    <span className="text-xs text-brand-gray">Amount</span>
                    <span className="text-xs text-white font-mono">{formatCurrency(s.cash_in_hand?.amount)}</span>
                  </div>
                </div>
              </div>
            )}

            <Section title="Loans Given" icon={Landmark} count={s.loans_given ? 1 : 0}>
              {s.loans_given && (
                <AssetCard>
                  <KVRow label="Opening Balance"           value={formatCurrency(s.loans_given.opening_balance)} />
                  <KVRow label="Given During Year"         value={formatCurrency(s.loans_given.given_during_year)} />
                  <KVRow label="Received from Debtors"     value={formatCurrency(s.loans_given.cash_received_from_debtors)} />
                  <KVRow label="Closing Balance"           value={formatCurrency(s.loans_given.amount)} />
                </AssetCard>
              )}
            </Section>

            {num(s.gold_jewellery?.value) > 0 && (
              <div className="border border-brand-gray-border rounded-xl overflow-hidden mb-3">
                <div className="flex items-center gap-2 px-4 py-3 bg-brand-black-soft">
                  <Package size={15} className="text-brand-yellow" />
                  <span className="text-sm font-semibold text-white">Gold / Silver / Jewellery</span>
                </div>
                <div className="px-4 py-3 space-y-0.5">
                  <KVRow label="Description" value={s.gold_jewellery?.description} />
                  <KVRow label="Value"        value={formatCurrency(s.gold_jewellery?.value)} />
                </div>
              </div>
            )}

            <Section title="Business Properties" icon={Building2} count={s.business_properties?.length}>
              {s.business_properties?.map((bp, i) => (
                <AssetCard key={i}>
                  <KVRow label="Business"                 value={bp.name_of_business} />
                  <KVRow label="Current Account Balance"  value={formatCurrency(bp.current_account_balance)} />
                  <KVRow label="Capital Account Balance"  value={formatCurrency(bp.capital_account_balance)} />
                </AssetCard>
              ))}
            </Section>

            <Section title="Other Assets" icon={Package} count={s.other_assets?.length}>
              {s.other_assets?.map((a, i) => (
                <AssetCard key={i}>
                  <KVRow label="Description"      value={a.description} />
                  <KVRow label="Acquisition Type" value={a.acquisition_type} />
                  <KVRow label="Date Acquired"    value={formatDate(a.date_of_acquisition)} />
                  <KVRow label="Cost / Value"     value={formatCurrency(a.cost_value)} />
                </AssetCard>
              ))}
            </Section>

            <Section title="Disposal of Assets" icon={Package} count={s.disposals?.length}>
              {s.disposals?.map((d, i) => (
                <AssetCard key={i}>
                  <KVRow label="Description"     value={d.description} />
                  <KVRow label="Date of Disposal" value={formatDate(d.date_of_disposal)} />
                  <KVRow label="Sales Proceed"   value={formatCurrency(d.sales_proceed)} />
                  <KVRow label="Cost"            value={formatCurrency(d.cost)} />
                </AssetCard>
              ))}
            </Section>
          </div>
        )}

        {/* ── 3. Liabilities ── */}
        {hasLiabilities && (
          <div className="card mb-4">
            <p className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <AlertTriangle size={15} className="text-brand-red" /> Liabilities
            </p>
            {s.liabilities?.map((lib, i) => (
              <div key={i} className="bg-brand-black rounded-lg p-3 mb-2 last:mb-0 space-y-0.5">
                <KVRow label="Description"           value={lib.description} />
                <KVRow label="Security"              value={lib.security_on_liability} />
                <KVRow label="Date of Commencement"  value={formatDate(lib.date_of_commencement)} />
                <KVRow label="Original Amount"       value={formatCurrency(lib.original_amount)} />
                <KVRow label="Balance as at Date"    value={formatCurrency(lib.amount_as_at_date)} />
                <KVRow label="Repaid During Year"    value={formatCurrency(lib.amount_repaid_during_year)} />
              </div>
            ))}
          </div>
        )}

        {/* ── 4. Receipt & Payment Account ── */}
        {hasCashFlow && (
          <div className="card mb-4">
            <p className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Landmark size={15} className="text-brand-yellow" /> Receipt &amp; Payment Account
            </p>

            {/* Opening Balances */}
            <p className="text-xs font-semibold text-brand-gray uppercase tracking-wider mb-2 pb-1 border-b border-brand-gray-border/40">
              Opening Balances — as at 1st April
            </p>
            <CfLineRow label="Cash in Hand" value={cf.opening_cash_in_hand} />
            {(cf.opening_favourable_banks || []).map((b, i) => (
              <div key={i} className="flex justify-between items-center py-1.5 border-b border-brand-gray-border/40 pl-3">
                <span className="text-sm text-brand-gray">{b.bank_name || 'Bank'}{b.account_no ? ` (${b.account_no})` : ''}</span>
                <span className="font-mono text-sm text-white">{formatCurrency(b.amount)}</span>
              </div>
            ))}
            {(cf.opening_overdraft_banks || []).map((b, i) => (
              <div key={`od-${i}`} className="flex justify-between items-center py-1.5 border-b border-brand-gray-border/40 pl-3">
                <span className="text-sm text-brand-gray">{b.bank_name || 'Bank'} — Overdraft</span>
                <span className="font-mono text-sm text-white">({formatCurrency(b.amount)})</span>
              </div>
            ))}
            <div className="flex justify-between items-center py-2 bg-brand-black rounded-lg px-3 my-2">
              <span className="text-sm font-semibold text-white">Opening Cash Balance</span>
              <span className="font-mono text-sm font-bold text-white">{formatCurrency(cfOpeningTotal)}</span>
            </div>

            {/* Receipts */}
            {cfTotalReceipts > 0 && (
              <>
                <p className="text-xs font-semibold text-brand-gray uppercase tracking-wider mb-2 mt-4 pb-1 border-b border-brand-gray-border/40">
                  Receipts During the Year
                </p>
                <CfLineRow label="Employment Income"                    value={cf.receipt_employment_income} />
                <CfLineRow label="Interest on Savings Accounts"         value={cf.receipt_interest_savings} />
                <CfLineRow label="Rent Income"                          value={cf.receipt_rent_income} />
                <CfLineRow label="Income — T/B &amp; Securities"        value={cf.receipt_tb_securities} />
                <CfLineRow label="Sale of Shares"                       value={cf.receipt_sale_shares} />
                <CfLineRow label="Dividend Income"                      value={cf.receipt_dividend_income} />
                <CfLineRow label="Drawings — Sole / Partnership"        value={cf.receipt_drawings_sole_partner} />
                <CfLineRow label="Bank Loan Received"                   value={cf.receipt_bank_loan} />
                <CfLineRow label="Other Loans Received"                 value={cf.receipt_other_loans} />
                <CfLineRow label="Sale of Land / Building"              value={cf.receipt_sale_land_building} />
                <CfLineRow label="Sale of Motor Vehicle"                value={cf.receipt_sale_motor_vehicle} />
                <CfLineRow label="Sale of Other Assets"                 value={cf.receipt_sale_other_assets} />
                <div className="flex justify-between items-center py-2 bg-brand-black rounded-lg px-3 my-2">
                  <span className="text-sm font-semibold text-white">Total Cash Available</span>
                  <span className="font-mono text-sm font-bold text-white">{formatCurrency(cfTotalCashAvailable)}</span>
                </div>
              </>
            )}

            {/* Payments */}
            {cfTotalPayments > 0 && (
              <>
                <p className="text-xs font-semibold text-brand-gray uppercase tracking-wider mb-2 mt-4 pb-1 border-b border-brand-gray-border/40">
                  Payments During the Year
                </p>
                <CfLineRow label="Purchase of Land / Building"   value={cf.payment_purchase_land_building} deduction />
                <CfLineRow label="Purchase of Motor Vehicle"     value={cf.payment_purchase_motor_vehicle} deduction />
                <CfLineRow label="Purchase of Other Assets"      value={cf.payment_purchase_other_assets} deduction />
                <CfLineRow label="Repayment of Bank Loan"        value={cf.payment_repayment_bank_loan} deduction />
                <CfLineRow label="Lease Rentals"                 value={cf.payment_lease_rentals} deduction />
                <CfLineRow label="Purchase of Jewellery / Gems"  value={cf.payment_jewellery_gems} deduction />
                <CfLineRow label="Payment of Other Loans"        value={cf.payment_other_loans} deduction />
                <CfLineRow label="WHT"                           value={cf.payment_wht} deduction />
                <CfLineRow label="Income Tax Payments"           value={cf.payment_income_tax} deduction />
                <CfLineRow label="APIT"                          value={cf.payment_apit} deduction />
                <CfLineRow label="Investment in Shares"          value={cf.payment_investment_shares} deduction />
                <CfLineRow label="Loans Given to Others"         value={cf.payment_loans_given_others} deduction />
                <div className="flex justify-between items-center py-2 bg-brand-black rounded-lg px-3 my-2">
                  <span className="text-sm font-semibold text-white">Net Cash Available — 31st March</span>
                  <span className="font-mono text-sm font-bold text-white">{formatCurrency(cfNetCash)}</span>
                </div>
              </>
            )}

            {/* Closing Balances */}
            {cfClosingTotal > 0 && (
              <>
                <p className="text-xs font-semibold text-brand-gray uppercase tracking-wider mb-2 mt-4 pb-1 border-b border-brand-gray-border/40">
                  Closing Balances — as at 31st March
                </p>
                <CfLineRow label="Cash in Hand" value={cf.closing_cash_in_hand} />
                {(cf.closing_favourable_banks || []).map((b, i) => (
                  <div key={i} className="flex justify-between items-center py-1.5 border-b border-brand-gray-border/40 pl-3">
                    <span className="text-sm text-brand-gray">{b.bank_name || 'Bank'}{b.account_no ? ` (${b.account_no})` : ''}</span>
                    <span className="font-mono text-sm text-white">{formatCurrency(b.amount)}</span>
                  </div>
                ))}
                {(cf.closing_overdraft_banks || []).map((b, i) => (
                  <div key={`cod-${i}`} className="flex justify-between items-center py-1.5 border-b border-brand-gray-border/40 pl-3">
                    <span className="text-sm text-brand-gray">{b.bank_name || 'Bank'} — Overdraft</span>
                    <span className="font-mono text-sm text-white">({formatCurrency(b.amount)})</span>
                  </div>
                ))}
                <div className="flex justify-between items-center py-2 bg-brand-black rounded-lg px-3 my-2">
                  <span className="text-sm font-semibold text-white">Closing Cash Balance</span>
                  <span className="font-mono text-sm font-bold text-white">{formatCurrency(cfClosingTotal)}</span>
                </div>
              </>
            )}

            {/* Living Expenses */}
            {num(cf.living_expenses_year) > 0 && (
              <div className="flex justify-between items-center py-2 mt-1 border-t border-brand-gray-border">
                <span className="text-sm text-brand-gray">Living Expenses for the Year</span>
                <span className="font-mono text-sm text-white">{formatCurrency(cf.living_expenses_year)}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Uploaded Documents ── */}
        {documents.length > 0 && (
          <div className="card mb-6">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={15} className="text-brand-yellow" />
              <p className="text-sm font-semibold text-white">Uploaded Documents ({documents.length})</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {documents.map(doc => (
                <div key={doc.id} className="flex items-center gap-2 bg-brand-black rounded-lg px-3 py-2">
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
          </div>
        )}

        {/* ── Confirm button ── */}
        <div className="card">
          <p className="text-sm text-brand-gray mb-4">
            By confirming, you acknowledge that the tax computation and all details above are correct and authorise your consultant to proceed with the final submission.
          </p>
          <div className="flex gap-3 justify-end flex-wrap">
            <button onClick={() => navigate('/client/dashboard')} className="btn-secondary">Later</button>
            <button onClick={downloadPdf} className="btn-secondary flex items-center gap-2">
              <Download size={14} /> Download PDF
            </button>
            <button
              onClick={() => finalConfirmMutation.mutate()}
              disabled={finalConfirmMutation.isPending}
              className="btn-primary"
            >
              {finalConfirmMutation.isPending
                ? <><span className="w-4 h-4 border-2 border-brand-black border-t-transparent rounded-full animate-spin" />Confirming...</>
                : <><CheckCircle size={15} /> Confirm &amp; Authorise</>
              }
            </button>
          </div>
        </div>
      </div>
    )
  }

  // client_confirmed / archived — show completion screen with download
  if (['client_confirmed', 'archived'].includes(submission?.status)) {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in">
        <button onClick={() => navigate('/client/dashboard')} className="btn-ghost mb-4 text-sm">
          <ArrowLeft size={15} /> Back to Dashboard
        </button>
        <div className="card text-center py-10">
          <CheckCircle size={52} className="text-brand-success mx-auto mb-4" />
          <p className="text-white text-xl font-bold mb-1">Tax Return Confirmed</p>
          <p className="text-sm text-brand-gray mb-6">
            You have confirmed your tax return for {submission?.tax_year_label}. Your consultant will complete the final filing.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={() => navigate('/client/dashboard')} className="btn-secondary">
              Back to Dashboard
            </button>
            <button onClick={downloadPdf} className="btn-primary flex items-center gap-2">
              <Download size={15} /> Download Tax Return PDF
            </button>
            {submission?.status === 'archived' && documents.some(d => d.document_type === 'ird_return') && (
              <button
                onClick={() => downloadDocument(documents.find(d => d.document_type === 'ird_return'))}
                className="btn-primary flex items-center gap-2"
              >
                <Download size={15} /> Download IRD Return
              </button>
            )}
            {submission?.status === 'archived' && documents.some(d => d.document_type === 'ird_acknowledgement') && (
              <button
                onClick={() => downloadDocument(documents.find(d => d.document_type === 'ird_acknowledgement'))}
                className="btn-primary flex items-center gap-2"
              >
                <Download size={15} /> Download IRD Acknowledgement
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Fallback
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <CheckCircle size={48} className="text-brand-success" />
      <p className="text-white text-lg font-semibold">No pending action</p>
      <button onClick={() => navigate('/client/dashboard')} className="btn-primary">Back to Dashboard</button>
    </div>
  )
}
