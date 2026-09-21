import { useForm, Controller } from 'react-hook-form'
import { useState, useEffect } from 'react'
import NumberInput from '../../../components/common/NumberInput'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../../services/api'
import FileUpload from '../../../components/common/FileUpload'
import {
  Save, ChevronRight, Briefcase, Globe, Gift,
  Home, Landmark, TrendingUp, Store, MoreHorizontal,
  Receipt, CreditCard, Info, Plus, Trash2, Pencil, X, Check
} from 'lucide-react'
import toast from 'react-hot-toast'

/* ─── Reusable field row: label left, input right ─── */
function FieldRow({ label, hint, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-2 py-3 border-b border-brand-gray-border/50 last:border-0">
      <div className="sm:w-56 flex-shrink-0 pt-0.5">
        <p className="text-sm text-white font-medium leading-snug">{label}</p>
        {hint && <p className="text-xs text-brand-gray mt-0.5 leading-snug">{hint}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

/* ─── Rs. amount input ─── */
function AmountInput({ name, control, disabled, className = '' }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray text-sm font-mono select-none">Rs.</span>
      <Controller
        name={name}
        control={control}
        defaultValue=""
        render={({ field: { onChange, onBlur, value } }) => (
          <NumberInput
            value={value ?? ''}
            onChange={e => onChange(e.target.value)}
            onBlur={onBlur}
            disabled={disabled}
            placeholder=""
            className={`input-field pl-10 text-right font-mono ${className}`}
          />
        )}
      />
    </div>
  )
}

/* ─── Sub-section header with left accent bar ─── */
function SubSection({ icon: Icon, title, children }) {
  return (
    <div className="pl-4 border-l-2 border-brand-yellow/40">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-brand-yellow flex-shrink-0" />
        <span className="text-xs font-semibold text-brand-yellow uppercase tracking-widest">{title}</span>
      </div>
      {children}
    </div>
  )
}

/* ─── Card wrapper ─── */
function FormCard({ children, className = '' }) {
  return (
    <div className={`bg-brand-black-light border border-brand-gray-border rounded-2xl overflow-hidden ${className}`}>
      {children}
    </div>
  )
}

/* ─── Card section header bar ─── */
function CardHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 px-6 py-4 border-b border-brand-gray-border bg-brand-black">
      <div className="w-8 h-8 rounded-lg bg-brand-yellow/10 flex items-center justify-center flex-shrink-0">
        <Icon size={16} className="text-brand-yellow" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-brand-gray mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

/* ─── Divider between sub-sections ─── */
function Divider() {
  return <div className="h-px bg-brand-gray-border/50 my-5" />
}

/* ─── Auto-relief display pill ─── */
function ReliefPill({ label, value }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-brand-success/5 border border-brand-success/20 rounded-lg">
      <div className="flex items-center gap-1.5">
        <Info size={11} className="text-brand-success" />
        <span className="text-xs text-brand-success font-medium">{label}</span>
      </div>
      <span className="text-xs font-mono font-semibold text-brand-success">{value}</span>
    </div>
  )
}

/* ─── Main Component ─── */
export default function IncomeSection({ submissionId, documents, onUpload, onDeleteDoc, isReadOnly, onNext, onRefresh }) {
  const qc = useQueryClient()

  const queries = {
    foreign:  useQuery({ queryKey: ['income-foreign',  submissionId], queryFn: () => api.get(`/tax/submissions/${submissionId}/income/foreign/`).then(r => r.data) }),
    terminal: useQuery({ queryKey: ['income-terminal', submissionId], queryFn: () => api.get(`/tax/submissions/${submissionId}/income/terminal-benefit/`).then(r => r.data) }),
    rent:     useQuery({ queryKey: ['income-rent',     submissionId], queryFn: () => api.get(`/tax/submissions/${submissionId}/income/rent/`).then(r => r.data) }),
    interest: useQuery({ queryKey: ['income-interest', submissionId], queryFn: () => api.get(`/tax/submissions/${submissionId}/income/interest/`).then(r => r.data) }),
    dividend: useQuery({ queryKey: ['income-dividend', submissionId], queryFn: () => api.get(`/tax/submissions/${submissionId}/income/dividend/`).then(r => r.data) }),
    tb:       useQuery({ queryKey: ['income-tb',       submissionId], queryFn: () => api.get(`/tax/submissions/${submissionId}/income/tb-securities/`).then(r => r.data) }),
    sole:     useQuery({ queryKey: ['income-sole',     submissionId], queryFn: () => api.get(`/tax/submissions/${submissionId}/income/sole-proprietorship/`).then(r => r.data) }),
    other:    useQuery({ queryKey: ['income-other',    submissionId], queryFn: () => api.get(`/tax/submissions/${submissionId}/income/other/`).then(r => r.data) }),
    qp:       useQuery({ queryKey: ['qualifying-payments', submissionId], queryFn: () => api.get(`/tax/submissions/${submissionId}/qualifying-payments/`).then(r => r.data) }),
    tc:       useQuery({ queryKey: ['tax-credits',     submissionId], queryFn: () => api.get(`/tax/submissions/${submissionId}/tax-credits/`).then(r => r.data) }),
  }

  const [saving, setSaving] = useState(false)

  const { register: regIncome, control: controlIncome, handleSubmit: handleIncome, reset: resetIncome, watch: watchIncome } = useForm()
  const { register: regQP,     control: controlQP,     handleSubmit: handleQP,     reset: resetQP }     = useForm()
  const { register: regTC,     control: controlTC,     handleSubmit: handleTC,     reset: resetTC,     setValue: setValueTC } = useForm()

  const watchedRentGross   = watchIncome('rent_gross')
  const watchedRentWHT     = watchIncome('rent_wht')
  const watchedInterestWHT = watchIncome('interest_wht')
  const watchedTbWHT       = watchIncome('tb_wht')
  const liveRentRelief     = Math.round(parseFloat(watchedRentGross || 0) * 0.25 * 100) / 100
  const soleEntries        = Array.isArray(queries.sole.data) ? queries.sole.data : []
  const soleWHTTotal       = soleEntries.reduce((s, e) => s + parseFloat(e.wht_deducted || 0), 0)
  const liveWHTTotal       = Math.round((parseFloat(watchedRentWHT || 0) + parseFloat(watchedInterestWHT || 0) + soleWHTTotal + parseFloat(watchedTbWHT || 0)) * 100) / 100

  useEffect(() => {
    const d = queries
    // nv: converts 0 / "0" / "0.00" to '' so fields appear empty rather than showing "0"
    const nv = v => (v == null || v === '' || parseFloat(v) === 0) ? '' : v
    resetIncome({
      foreign_employer_name:          d.foreign.data?.foreign_employer_name || '',
      foreign_employment_service_fee: nv(d.foreign.data?.employment_service_fee),
      foreign_business_income:        nv(d.foreign.data?.foreign_business_income),
      foreign_interest:               nv(d.foreign.data?.foreign_interest_income),
      foreign_other:                  nv(d.foreign.data?.other_foreign_income),
      foreign_tax_paid:               nv(d.foreign.data?.foreign_tax_paid),
      terminal_amount:                nv(d.terminal.data?.amount),
      terminal_benefit_types:         d.terminal.data?.benefit_types || '',
      rent_gross:                     nv(d.rent.data?.gross_amount),
      rent_wht:                       nv(d.rent.data?.wht_deducted),
      interest_amount:                nv(d.interest.data?.amount),
      interest_wht:                   nv(d.interest.data?.wht_deducted),
      dividend_amount:                nv(d.dividend.data?.amount),
      dividend_exempt_amount:         nv(d.dividend.data?.exempt_amount),
      dividend_final_wht:             nv(d.dividend.data?.final_wht),
      tb_gross:                       nv(d.tb.data?.gross_amount),
      tb_wht:                         nv(d.tb.data?.wht_deducted),
      other_amount:                   nv(d.other.data?.amount),
      other_description:              d.other.data?.description || '',
    })
  }, [Object.values(queries).map(q => q.data).join(',')])

  useEffect(() => {
    const nv = v => (v == null || v === '' || parseFloat(v) === 0) ? '' : v
    resetQP({
      donation_charitable:      nv(queries.qp.data?.donation_charitable),
      donation_government:      nv(queries.qp.data?.donation_government),
      solar_panels_expenditure: nv(queries.qp.data?.solar_panels_expenditure),
    })
  }, [queries.qp.data])

  useEffect(() => {
    const nv = v => (v == null || v === '' || parseFloat(v) === 0) ? '' : v
    resetTC({
      apit_on_salary:            nv(queries.tc.data?.apit_on_salary),
      wht_rent_interest_service: nv(queries.tc.data?.wht_rent_interest_service),
      partnership_tax_credit:    nv(queries.tc.data?.partnership_tax_credit),
      wht_brought_forward:       nv(queries.tc.data?.wht_brought_forward),
      refund_brought_forward:    nv(queries.tc.data?.refund_brought_forward),
    })
  }, [queries.tc.data])

  /* Auto-populate WHT credit from income section WHT fields */
  useEffect(() => {
    const total = parseFloat(watchedRentWHT || 0) + parseFloat(watchedInterestWHT || 0) + soleWHTTotal + parseFloat(watchedTbWHT || 0)
    setValueTC('wht_rent_interest_service', total > 0 ? String(Math.round(total)) : '')
  }, [watchedRentWHT, watchedInterestWHT, soleWHTTotal, watchedTbWHT])

  async function saveIncome(data) {
    setSaving(true)
    try {
      await Promise.all([
        api.post(`/tax/submissions/${submissionId}/income/foreign/`,            { foreign_employer_name: data.foreign_employer_name || '', employment_service_fee: data.foreign_employment_service_fee || 0, foreign_business_income: data.foreign_business_income || 0, foreign_interest_income: data.foreign_interest || 0, other_foreign_income: data.foreign_other || 0, foreign_tax_paid: data.foreign_tax_paid || 0 }),
        api.post(`/tax/submissions/${submissionId}/income/terminal-benefit/`,   { amount: data.terminal_amount || 0, benefit_types: data.terminal_benefit_types }),
        api.post(`/tax/submissions/${submissionId}/income/rent/`,               { gross_amount: data.rent_gross || 0, wht_deducted: data.rent_wht || 0 }),
        api.post(`/tax/submissions/${submissionId}/income/interest/`,           { amount: data.interest_amount || 0, wht_deducted: data.interest_wht || 0 }),
        api.post(`/tax/submissions/${submissionId}/income/dividend/`,           { amount: data.dividend_amount || 0, exempt_amount: data.dividend_exempt_amount || 0, final_wht: data.dividend_final_wht || 0 }),
        api.post(`/tax/submissions/${submissionId}/income/tb-securities/`,     { gross_amount: data.tb_gross || 0, wht_deducted: data.tb_wht || 0 }),
        api.post(`/tax/submissions/${submissionId}/income/other/`,              { amount: data.other_amount || 0, description: data.other_description }),
      ])
      toast.success('Income data saved')
      onRefresh()
    } catch { toast.error('Failed to save') }
    setSaving(false)
  }

  async function saveQP(data) {
    setSaving(true)
    try {
      await api.post(`/tax/submissions/${submissionId}/qualifying-payments/`, {
        donation_charitable:      data.donation_charitable || 0,
        donation_government:      data.donation_government || 0,
        solar_panels_expenditure: data.solar_panels_expenditure || 0,
      })
      toast.success('Qualifying payments saved')
    } catch { toast.error('Failed to save') }
    setSaving(false)
  }

  async function saveTC(data) {
    setSaving(true)
    try {
      await api.post(`/tax/submissions/${submissionId}/tax-credits/`, {
        apit_on_salary:            data.apit_on_salary || 0,
        wht_rent_interest_service: data.wht_rent_interest_service || 0,
        partnership_tax_credit:    data.partnership_tax_credit || 0,
        wht_brought_forward:       data.wht_brought_forward || 0,
        refund_brought_forward:    data.refund_brought_forward || 0,
      })
      toast.success('Tax credits saved')
    } catch { toast.error('Failed to save') }
    setSaving(false)
  }

  const fp = { submissionId, documents, onUpload, onDelete: onDeleteDoc }

  return (
    <div className="space-y-5">

      {/* ══════════════════════════════════════════════════════════════
          CARD 1 — EMPLOYMENT INCOME
      ══════════════════════════════════════════════════════════════ */}
      <form onSubmit={handleIncome(saveIncome)}>
        <FormCard>
          <CardHeader icon={Briefcase} title="Employment Income" subtitle="Salary, foreign earnings and terminal benefits" />

          <div className="px-6 py-5 space-y-6">

            {/* Local Employment */}
            <SubSection icon={Briefcase} title="Local Employment">
              <LocalEmploymentEntries submissionId={submissionId} isReadOnly={isReadOnly} />
              <div className="pt-3">
                <FileUpload label="T10 / Salary Slips" documentType="t10_salary_slip" section="income" {...fp} hint="Required" />
              </div>
            </SubSection>

            <Divider />

            {/* Foreign Income */}
            <SubSection icon={Globe} title="Foreign Income">
              <FieldRow label="Employer / Company Name" hint="Name of the foreign employer or company paying the income">
                <input {...regIncome('foreign_employer_name')} className="input-field" placeholder="Company / Employer name" disabled={isReadOnly} />
              </FieldRow>
              <FieldRow label="Employment / Service Fee" hint="Foreign employment or contract income">
                <AmountInput name="foreign_employment_service_fee" control={controlIncome} disabled={isReadOnly} />
              </FieldRow>
              <FieldRow label="Foreign Business Income" hint="Profit from business carried on outside Sri Lanka">
                <AmountInput name="foreign_business_income" control={controlIncome} disabled={isReadOnly} />
              </FieldRow>
              <FieldRow label="Foreign Interest (Exempt Interest)" hint="Interest earned on foreign bank deposits / investments — exempt from tax">
                <AmountInput name="foreign_interest" control={controlIncome} disabled={isReadOnly} />
              </FieldRow>
              <FieldRow label="Other Foreign Source Income" hint="Rent, dividends from abroad">
                <AmountInput name="foreign_other" control={controlIncome} disabled={isReadOnly} />
              </FieldRow>
              <FieldRow label="Foreign Tax Paid / WHT Credit" hint="Tax withheld or paid abroad; declared in Cage 901">
                <AmountInput name="foreign_tax_paid" control={controlIncome} disabled={isReadOnly} />
              </FieldRow>
              <div className="pt-2">
                <FileUpload label="Monthly Salary Slips / Foreign Evidence" documentType="monthly_salary_slip" section="income" {...fp} hint="Foreign employment evidence" />
              </div>
            </SubSection>

            <Divider />

            {/* Terminal Benefit */}
            <SubSection icon={Gift} title="Terminal Benefit">
              <FieldRow label="Benefit Types" hint="EPF, ETF, Pension, Gratuity, etc.">
                <input {...regIncome('terminal_benefit_types')} className="input-field" placeholder="e.g., EPF, ETF, Gratuity" disabled={isReadOnly} />
              </FieldRow>
              <FieldRow label="Total Amount">
                <AmountInput name="terminal_amount" control={controlIncome} disabled={isReadOnly} />
              </FieldRow>
              <div className="pt-2">
                <FileUpload label="Tax Direction Letter / Terminal Benefit Confirmation" documentType="tax_direction_letter" section="income" {...fp} hint="One document per benefit type" />
              </div>
            </SubSection>

          </div>

          {/* ── Save button ── */}
          {!isReadOnly && (
            <div className="flex justify-end px-6 py-4 border-t border-brand-gray-border bg-brand-black/40">
              <button type="submit" disabled={saving} className="btn-primary">
                <Save size={14} /> {saving ? 'Saving…' : 'Save Employment Income'}
              </button>
            </div>
          )}
        </FormCard>


        {/* ══════════════════════════════════════════════════════════════
            CARD 2 — PASSIVE INCOME
        ══════════════════════════════════════════════════════════════ */}
        <FormCard className="mt-5">
          <CardHeader icon={Home} title="Passive Income" subtitle="Rent, interest and dividend income received during the year" />

          <div className="px-6 py-5 space-y-6">

            {/* Rent Income */}
            <SubSection icon={Home} title="Rent Income">
              <FieldRow label="Gross Rent Received" hint="Total rent before WHT deduction">
                <AmountInput name="rent_gross" control={controlIncome} disabled={isReadOnly} />
              </FieldRow>
              {liveRentRelief > 0 && (
                <div className="py-1">
                  <ReliefPill
                    label="Rent Relief (25% — auto calculated)"
                    value={`Rs. ${Math.round(liveRentRelief).toLocaleString('en-LK')}`}
                  />
                </div>
              )}
              <FieldRow label="WHT Deducted" hint="Withholding tax deducted by tenant">
                <AmountInput name="rent_wht" control={controlIncome} disabled={isReadOnly} />
              </FieldRow>
              <div className="pt-2">
                <FileUpload label="Rent Agreement / WHT Deduction Certificates" documentType="rent_agreement" section="income" {...fp} />
              </div>
            </SubSection>

            <Divider />

            {/* Interest Income */}
            <SubSection icon={Landmark} title="Interest Income">
              <FieldRow label="Total Interest Received" hint="Bank interest, fixed deposits, etc.">
                <AmountInput name="interest_amount" control={controlIncome} disabled={isReadOnly} />
              </FieldRow>
              <FieldRow label="WHT Deducted" hint="WHT deducted by the bank / institution">
                <AmountInput name="interest_wht" control={controlIncome} disabled={isReadOnly} />
              </FieldRow>
              <div className="pt-2">
                <FileUpload label="WHT Certificates" documentType="bank_balance_confirmation" section="income" {...fp} />
              </div>
            </SubSection>

            <Divider />

            {/* Capital Gain — disposals entered/edited here, same records shown in the
                Assets step (section 10). Net gain is auto-calculated, taxed at flat 15%. */}
            <SubSection icon={TrendingUp} title="Capital Gain">
              <DisposalEntries submissionId={submissionId} isReadOnly={isReadOnly} />
            </SubSection>

            <Divider />

            {/* Dividend Income */}
            <SubSection icon={TrendingUp} title="Dividend Income">
              <FieldRow label="Taxable Dividends" hint="Dividends not subject to 15% WHT">
                <AmountInput name="dividend_amount" control={controlIncome} disabled={isReadOnly} />
              </FieldRow>
              <FieldRow
                label="Exempt Dividends (Gross)"
                hint="Gross dividends from resident companies subject to final WHT — tax exempt and excluded from assessable income"
              >
                <AmountInput
                  name="dividend_exempt_amount" control={controlIncome}
                  disabled={isReadOnly}
                  className="border-brand-success/40 focus:border-brand-success"
                />
              </FieldRow>
              <FieldRow
                label="Final WHT"
                hint="Actual WHT deducted on the exempt dividends above, per the dividend certificate"
              >
                <AmountInput
                  name="dividend_final_wht" control={controlIncome}
                  disabled={isReadOnly}
                  className="border-brand-success/40 focus:border-brand-success"
                />
              </FieldRow>
              <div className="pt-2">
                <FileUpload label="Dividend Certificates (Dividend Warrant)" documentType="dividend_certificate" section="income" {...fp} />
              </div>
            </SubSection>

            <Divider />

            {/* TB & Securities Income */}
            <SubSection icon={Receipt} title="T-Bills & Securities Income">
              <FieldRow label="Gross Amount" hint="Gross income from treasury bills, bonds and other securities">
                <AmountInput name="tb_gross" control={controlIncome} disabled={isReadOnly} />
              </FieldRow>
              <FieldRow label="WHT Deducted" hint="Withholding tax deducted at source">
                <AmountInput name="tb_wht" control={controlIncome} disabled={isReadOnly} />
              </FieldRow>
              <div className="pt-2">
                <FileUpload label="T-Bill / Securities Income Certificates" documentType="tb_securities_certificate" section="income" {...fp} />
              </div>
            </SubSection>

          </div>

          {!isReadOnly && (
            <div className="flex justify-end px-6 py-4 border-t border-brand-gray-border bg-brand-black/40">
              <button type="submit" disabled={saving} className="btn-primary">
                <Save size={14} /> {saving ? 'Saving…' : 'Save Passive Income'}
              </button>
            </div>
          )}
        </FormCard>


        {/* ══════════════════════════════════════════════════════════════
            CARD 3 — BUSINESS & OTHER INCOME
        ══════════════════════════════════════════════════════════════ */}
        <FormCard className="mt-5">
          <CardHeader icon={Store} title="Business & Other Income" subtitle="Sole proprietorship, partnership and any other income sources" />

          <div className="px-6 py-5 space-y-6">

            {/* Sole Proprietorship */}
            <SubSection icon={Store} title="Sole Proprietorship / Partnership">
              <SoleProprietorshipEntries submissionId={submissionId} isReadOnly={isReadOnly} onWHTChange={() => qc.invalidateQueries(['income-sole', submissionId])} />
              <div className="pt-3">
                <FileUpload label="Receipt & Payment Details / Finalised Partnership Accounts" documentType="partnership_accounts" section="income" {...fp} />
              </div>
            </SubSection>

            <Divider />

            {/* Other Income */}
            <SubSection icon={MoreHorizontal} title="Other Income">
              <FieldRow label="Description of Income" hint="Describe the nature of the income source">
                <input {...regIncome('other_description')} className="input-field" placeholder="e.g., Royalties, Commission, etc." disabled={isReadOnly} />
              </FieldRow>
              <FieldRow label="Amount">
                <AmountInput name="other_amount" control={controlIncome} disabled={isReadOnly} />
              </FieldRow>
              <div className="pt-2">
                <FileUpload label="Supporting Documents for Other Income" documentType="other_income_proof" section="income" {...fp} />
              </div>
            </SubSection>

          </div>

          {!isReadOnly && (
            <div className="flex justify-end px-6 py-4 border-t border-brand-gray-border bg-brand-black/40">
              <button type="submit" disabled={saving} className="btn-primary">
                <Save size={14} /> {saving ? 'Saving…' : 'Save Business & Other Income'}
              </button>
            </div>
          )}
        </FormCard>
      </form>


      {/* ══════════════════════════════════════════════════════════════
          CARD 4 — QUALIFYING PAYMENTS & RELIEFS
      ══════════════════════════════════════════════════════════════ */}
      <form onSubmit={handleQP(saveQP)}>
        <FormCard>
          <CardHeader icon={Receipt} title="Qualifying Payments & Reliefs" subtitle="Deductible donations, solar expenditure and statutory reliefs" />

          <div className="px-6 py-5 space-y-6">

            {/* Donations */}
            <SubSection icon={Receipt} title="Donations">
              <FieldRow label="Donation to Approved Charitable Institution">
                <AmountInput name="donation_charitable" control={controlQP} disabled={isReadOnly} />
              </FieldRow>
              <FieldRow label="Donation to Government of Sri Lanka">
                <AmountInput name="donation_government" control={controlQP} disabled={isReadOnly} />
              </FieldRow>
              <div className="pt-2">
                <FileUpload label="Donation Proof Documents" documentType="donation_proof" section="qualifying_payments" {...fp} />
              </div>
            </SubSection>

            <Divider />

            {/* Solar Panels */}
            <SubSection icon={TrendingUp} title="Solar Panels">
              <FieldRow label="Solar Panel Expenditure / Loan Repayment" hint="Maximum deductible: Rs. 600,000">
                <AmountInput name="solar_panels_expenditure" control={controlQP} disabled={isReadOnly} />
              </FieldRow>
              <div className="pt-2">
                <FileUpload label="Solar Panel Invoice & Grid Agreement" documentType="solar_invoice" section="qualifying_payments" {...fp} />
              </div>
            </SubSection>

            <Divider />

            {/* Auto Reliefs */}
            <SubSection icon={Info} title="Statutory Reliefs (Auto Calculated)">
              <div className="space-y-2 pt-1">
                <ReliefPill label="Personal Relief (Fixed)" value="Rs. 1,800,000" />
                <ReliefPill
                  label="Rent Relief (25% of Gross Rent — auto)"
                  value={liveRentRelief > 0
                    ? `Rs. ${Math.round(liveRentRelief).toLocaleString('en-LK')}`
                    : 'Enter Gross Rent above'}
                />
              </div>
            </SubSection>

          </div>

          {!isReadOnly && (
            <div className="flex justify-end px-6 py-4 border-t border-brand-gray-border bg-brand-black/40">
              <button type="submit" disabled={saving} className="btn-primary">
                <Save size={14} /> {saving ? 'Saving…' : 'Save Qualifying Payments'}
              </button>
            </div>
          )}
        </FormCard>
      </form>


      {/* ══════════════════════════════════════════════════════════════
          CARD 5 — TAX CREDITS
      ══════════════════════════════════════════════════════════════ */}
      <form onSubmit={handleTC(saveTC)}>
        <FormCard>
          <CardHeader icon={CreditCard} title="Tax Credits" subtitle="Tax already paid — deducted from your final tax liability" />

          <div className="px-6 py-5 space-y-6">

            {/* Self Assessment */}
            <SubSection icon={Receipt} title="Self Assessment Tax Payments">
              <SelfAssessmentInstallments {...fp} isReadOnly={isReadOnly} />
            </SubSection>

            <Divider />

            {/* Tax Deducted at Source */}
            <SubSection icon={CreditCard} title="Tax Deducted at Source">
              <FieldRow label="APIT on Salary" hint="As per T10 certificate from employer">
                <AmountInput name="apit_on_salary" control={controlTC} disabled={isReadOnly} />
              </FieldRow>
              <FieldRow label="WHT on Rent / Interest / Business" hint="Auto-calculated from WHT amounts entered above">
                <div className="space-y-2">
                  <AmountInput name="wht_rent_interest_service" control={controlTC} disabled />
                  {liveWHTTotal > 0 && (
                    <ReliefPill
                      label="WHT (Rent + Interest + Business — auto)"
                      value={`Rs. ${Math.round(liveWHTTotal).toLocaleString('en-LK')}`}
                    />
                  )}
                  {liveWHTTotal === 0 && (
                    <p className="text-xs text-brand-gray">Enter WHT amounts in the income sections above</p>
                  )}
                </div>
              </FieldRow>
              <FieldRow label="WHT Brought Forward" hint="Unused WHT credit carried forward from last Y/A">
                <AmountInput name="wht_brought_forward" control={controlTC} disabled={isReadOnly} />
              </FieldRow>
              <FieldRow label="Partnership Tax Credit" hint="Tax credit passed through from partnership">
                <AmountInput name="partnership_tax_credit" control={controlTC} disabled={isReadOnly} />
              </FieldRow>
              <FieldRow label="Tax Refund Claim" hint="60% of last Y/A's unused refund entitlement, carried forward from last Y/A">
                <AmountInput name="refund_brought_forward" control={controlTC} disabled={isReadOnly} />
              </FieldRow>
            </SubSection>

          </div>

          {!isReadOnly && (
            <div className="flex justify-end px-6 py-4 border-t border-brand-gray-border bg-brand-black/40">
              <button type="submit" disabled={saving} className="btn-primary">
                <Save size={14} /> {saving ? 'Saving…' : 'Save Tax Credits'}
              </button>
            </div>
          )}
        </FormCard>
      </form>


      {/* ── Step navigation ── */}
      <div className="flex justify-end pt-2">
        <button type="button" onClick={onNext} className="btn-primary">
          Next: Assets <ChevronRight size={15} />
        </button>
      </div>

    </div>
  )
}


/* ─── Local Employment multi-entry sub-component (unlimited employers) ─── */
function LocalEmploymentEntries({ submissionId, isReadOnly }) {
  const qc = useQueryClient()
  const { data: entries = [], refetch } = useQuery({
    queryKey: ['income-local-employments', submissionId],
    queryFn:  () => api.get(`/tax/submissions/${submissionId}/income/local-employment/`).then(r => r.data),
  })

  const [modal, setModal] = useState(null) // null | { mode: 'add' } | { mode: 'edit', entry }
  const [form, setForm] = useState({ employer_name: '', amount: '' })
  const [saving, setSaving] = useState(false)

  function openAdd() {
    setForm({ employer_name: '', amount: '' })
    setModal({ mode: 'add' })
  }

  function openEdit(entry) {
    setForm({ employer_name: entry.employer_name || '', amount: entry.amount || '' })
    setModal({ mode: 'edit', entry })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        employer_name: form.employer_name,
        amount: parseFloat(form.amount) || 0,
      }
      if (modal.mode === 'add') {
        await api.post(`/tax/submissions/${submissionId}/income/local-employment/`, payload)
      } else {
        await api.patch(`/tax/income/local-employment/${modal.entry.id}/`, payload)
      }
      await refetch()
      qc.invalidateQueries(['income-local-employments', submissionId])
      setModal(null)
      toast.success(modal.mode === 'add' ? 'Employer income added' : 'Employer income updated')
    } catch { toast.error('Failed to save') }
    setSaving(false)
  }

  async function handleDelete(entry) {
    try {
      await api.delete(`/tax/income/local-employment/${entry.id}/`)
      await refetch()
      qc.invalidateQueries(['income-local-employments', submissionId])
      toast.success('Removed')
    } catch { toast.error('Failed to delete') }
  }

  const fmt = v => Math.round(parseFloat(v || 0)).toLocaleString('en-LK')

  return (
    <div className="space-y-3">
      {entries.length > 0 && (
        <div className="border border-brand-gray-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-brand-black">
              <tr>
                <th className="text-left px-3 py-2 text-xs text-brand-gray font-medium">Employer Name</th>
                <th className="text-right px-3 py-2 text-xs text-brand-gray font-medium">Income (Rs.)</th>
                {!isReadOnly && <th className="w-16" />}
              </tr>
            </thead>
            <tbody>
              {entries.map((e, idx) => (
                <tr key={e.id} className={idx % 2 === 0 ? 'bg-brand-black/20' : ''}>
                  <td className="px-3 py-2 text-white">{e.employer_name || '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-white">{fmt(e.amount)}</td>
                  {!isReadOnly && (
                    <td className="px-2 py-2">
                      <div className="flex gap-1 justify-end">
                        <button type="button" onClick={() => openEdit(e)} className="p-1 rounded hover:bg-brand-gray/10 text-brand-gray hover:text-white transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button type="button" onClick={() => handleDelete(e)} className="p-1 rounded hover:bg-brand-red/10 text-brand-gray hover:text-brand-red transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {entries.length > 1 && (
              <tfoot className="border-t border-brand-gray-border bg-brand-black">
                <tr>
                  <td className="px-3 py-2 text-xs text-brand-gray font-semibold">Total</td>
                  <td className="px-3 py-2 text-right font-mono text-brand-yellow text-xs font-semibold">
                    {fmt(entries.reduce((s, e) => s + parseFloat(e.amount || 0), 0))}
                  </td>
                  {!isReadOnly && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {!isReadOnly && (
        <button type="button" onClick={openAdd} className="flex items-center gap-1.5 text-sm text-brand-yellow hover:text-brand-yellow/80 transition-colors font-medium">
          <Plus size={14} /> Add Employer {entries.length > 0 && `(${entries.length})`}
        </button>
      )}

      {entries.length === 0 && isReadOnly && (
        <p className="text-sm text-brand-gray">No employment income entered.</p>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-brand-black-light border border-brand-gray-border rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">{modal.mode === 'add' ? 'Add Employer Income' : 'Edit Employer Income'}</h3>
              <button type="button" onClick={() => setModal(null)} className="text-brand-gray hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-brand-gray mb-1 block font-medium">Employer Name</label>
                <input
                  className="input-field"
                  placeholder="Company / Employer name"
                  value={form.employer_name}
                  onChange={e => setForm(f => ({ ...f, employer_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-brand-gray mb-1 block font-medium">Employment Income (Rs.)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray text-sm font-mono">Rs.</span>
                  <input
                    type="number"
                    className="input-field pl-10 text-right font-mono"
                    placeholder=""
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  />
                </div>
                <p className="text-xs text-brand-gray mt-1">Total gross salary for the year, from this employer</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setModal(null)} className="btn-secondary text-sm">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving} className="btn-primary text-sm">
                <Check size={14} /> {saving ? 'Saving…' : modal.mode === 'add' ? 'Add' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


/* ─── Disposal of Assets (Capital Gain) multi-entry sub-component ───
   Same records as Assets step, section 10 "Disposal of Assets including Shares
   During the Year" — editable from either place, single source of truth. */
const DISPOSAL_CATEGORIES = [
  { value: 'land_building', label: 'Land / Building' },
  { value: 'motor_vehicle', label: 'Motor Vehicle' },
  { value: 'shares',        label: 'Shares / Securities' },
  { value: 'other',         label: 'Other' },
]
const DISPOSAL_CATEGORY_LABELS = Object.fromEntries(DISPOSAL_CATEGORIES.map(c => [c.value, c.label]))
const DISPOSAL_DEFAULTS = { description: '', category: 'other', date_of_disposal: '', sales_proceed: '', date_acquired: '', cost: '' }

function DisposalEntries({ submissionId, isReadOnly }) {
  const qc = useQueryClient()
  const { data: entries = [], refetch } = useQuery({
    queryKey: ['assets-disposals', submissionId],
    queryFn:  () => api.get(`/tax/submissions/${submissionId}/assets/disposals/`).then(r => r.data),
  })

  const [modal, setModal] = useState(null) // null | { mode: 'add' } | { mode: 'edit', entry }
  const [form, setForm] = useState(DISPOSAL_DEFAULTS)
  const [saving, setSaving] = useState(false)

  function openAdd() {
    setForm(DISPOSAL_DEFAULTS)
    setModal({ mode: 'add' })
  }

  function openEdit(entry) {
    setForm({
      description: entry.description || '',
      category: entry.category || 'other',
      date_of_disposal: entry.date_of_disposal || '',
      sales_proceed: entry.sales_proceed || '',
      date_acquired: entry.date_acquired || '',
      cost: entry.cost || '',
    })
    setModal({ mode: 'edit', entry })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        description: form.description,
        category: form.category,
        date_of_disposal: form.date_of_disposal || null,
        sales_proceed: parseFloat(form.sales_proceed) || 0,
        date_acquired: form.date_acquired || null,
        cost: parseFloat(form.cost) || 0,
      }
      if (modal.mode === 'add') {
        await api.post(`/tax/submissions/${submissionId}/assets/disposals/`, payload)
      } else {
        await api.patch(`/tax/assets/disposals/${modal.entry.id}/`, payload)
      }
      await refetch()
      qc.invalidateQueries(['assets-disposals', submissionId])
      qc.invalidateQueries(['disposals', submissionId]) // keep Assets step's own query in sync
      setModal(null)
      toast.success(modal.mode === 'add' ? 'Disposal added' : 'Disposal updated')
    } catch { toast.error('Failed to save') }
    setSaving(false)
  }

  async function handleDelete(entry) {
    try {
      await api.delete(`/tax/assets/disposals/${entry.id}/`)
      await refetch()
      qc.invalidateQueries(['assets-disposals', submissionId])
      qc.invalidateQueries(['disposals', submissionId])
      toast.success('Removed')
    } catch { toast.error('Failed to delete') }
  }

  const fmt = v => Math.round(parseFloat(v || 0)).toLocaleString('en-LK')
  // Net gain across all disposals, floored once at the end (mirrors
  // calculate_capital_gain_tax in tax_calculator.py) — not per-row flooring.
  const netGain = Math.max(0, entries.reduce(
    (s, e) => s + parseFloat(e.sales_proceed || 0) - parseFloat(e.cost || 0), 0
  ))

  return (
    <div className="space-y-3">
      {entries.length > 0 && (
        <div className="border border-brand-gray-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-black">
              <tr>
                <th className="text-left px-3 py-2 text-xs text-brand-gray font-medium">Description</th>
                <th className="text-left px-3 py-2 text-xs text-brand-gray font-medium">Category</th>
                <th className="text-left px-3 py-2 text-xs text-brand-gray font-medium">Date of Disposal</th>
                <th className="text-right px-3 py-2 text-xs text-brand-gray font-medium">Sales Proceed (Rs.)</th>
                <th className="text-left px-3 py-2 text-xs text-brand-gray font-medium">Date Acquired</th>
                <th className="text-right px-3 py-2 text-xs text-brand-gray font-medium">Cost (Rs.)</th>
                {!isReadOnly && <th className="w-16" />}
              </tr>
            </thead>
            <tbody>
              {entries.map((e, idx) => (
                <tr key={e.id} className={idx % 2 === 0 ? 'bg-brand-black/20' : ''}>
                  <td className="px-3 py-2 text-white whitespace-nowrap">{e.description || '—'}</td>
                  <td className="px-3 py-2 text-brand-gray whitespace-nowrap">{DISPOSAL_CATEGORY_LABELS[e.category] || e.category}</td>
                  <td className="px-3 py-2 text-brand-gray whitespace-nowrap">{e.date_of_disposal || '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-white">{fmt(e.sales_proceed)}</td>
                  <td className="px-3 py-2 text-brand-gray whitespace-nowrap">{e.date_acquired || '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-white">{fmt(e.cost)}</td>
                  {!isReadOnly && (
                    <td className="px-2 py-2">
                      <div className="flex gap-1 justify-end">
                        <button type="button" onClick={() => openEdit(e)} className="p-1 rounded hover:bg-brand-gray/10 text-brand-gray hover:text-white transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button type="button" onClick={() => handleDelete(e)} className="p-1 rounded hover:bg-brand-red/10 text-brand-gray hover:text-brand-red transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isReadOnly && (
        <button type="button" onClick={openAdd} className="flex items-center gap-1.5 text-sm text-brand-yellow hover:text-brand-yellow/80 transition-colors font-medium">
          <Plus size={14} /> Add Disposal {entries.length > 0 && `(${entries.length})`}
        </button>
      )}

      {entries.length === 0 && isReadOnly && (
        <p className="text-sm text-brand-gray">No disposals entered.</p>
      )}

      <div className="py-1">
        <ReliefPill
          label="Capital Gain (net — auto calculated, taxed separately at flat 15%)"
          value={`Rs. ${Math.round(netGain).toLocaleString('en-LK')}`}
        />
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-brand-black-light border border-brand-gray-border rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">{modal.mode === 'add' ? 'Add Disposal' : 'Edit Disposal'}</h3>
              <button type="button" onClick={() => setModal(null)} className="text-brand-gray hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-brand-gray mb-1 block font-medium">Description</label>
                <input
                  className="input-field"
                  placeholder="e.g. Sale of vehicle, shares, property..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-brand-gray mb-1 block font-medium">Category</label>
                <select
                  className="input-field"
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                >
                  {DISPOSAL_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-brand-gray mb-1 block font-medium">Date of Disposal</label>
                  <input
                    type="date" className="input-field"
                    value={form.date_of_disposal}
                    onChange={e => setForm(f => ({ ...f, date_of_disposal: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-brand-gray mb-1 block font-medium">Date Acquired</label>
                  <input
                    type="date" className="input-field"
                    value={form.date_acquired}
                    onChange={e => setForm(f => ({ ...f, date_acquired: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-brand-gray mb-1 block font-medium">Sales Proceed (Rs.)</label>
                  <input
                    type="number" className="input-field text-right font-mono"
                    value={form.sales_proceed}
                    onChange={e => setForm(f => ({ ...f, sales_proceed: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-brand-gray mb-1 block font-medium">Cost (Rs.)</label>
                  <input
                    type="number" className="input-field text-right font-mono"
                    value={form.cost}
                    onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setModal(null)} className="btn-secondary text-sm">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving} className="btn-primary text-sm">
                <Check size={14} /> {saving ? 'Saving…' : modal.mode === 'add' ? 'Add' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


/* ─── Sole Proprietorship multi-entry sub-component ─── */
function SoleProprietorshipEntries({ submissionId, isReadOnly, onWHTChange }) {
  const qc = useQueryClient()
  const { data: entries = [], refetch } = useQuery({
    queryKey: ['income-sole', submissionId],
    queryFn:  () => api.get(`/tax/submissions/${submissionId}/income/sole-proprietorship/`).then(r => r.data),
  })

  const [modal, setModal] = useState(null) // null | { mode: 'add' } | { mode: 'edit', entry }
  const [form, setForm] = useState({ business_name: '', amount: '', wht_deducted: '' })
  const [saving, setSaving] = useState(false)

  function openAdd() {
    setForm({ business_name: '', amount: '', wht_deducted: '' })
    setModal({ mode: 'add' })
  }

  function openEdit(entry) {
    setForm({ business_name: entry.business_name || '', amount: entry.amount || '', wht_deducted: entry.wht_deducted || '' })
    setModal({ mode: 'edit', entry })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        business_name: form.business_name,
        amount: parseFloat(form.amount) || 0,
        wht_deducted: parseFloat(form.wht_deducted) || 0,
      }
      if (modal.mode === 'add') {
        await api.post(`/tax/submissions/${submissionId}/income/sole-proprietorship/`, payload)
      } else {
        await api.patch(`/tax/income/sole-proprietorship/${modal.entry.id}/`, payload)
      }
      await refetch()
      qc.invalidateQueries(['income-sole', submissionId])
      onWHTChange?.()
      setModal(null)
      toast.success(modal.mode === 'add' ? 'Business income added' : 'Business income updated')
    } catch { toast.error('Failed to save') }
    setSaving(false)
  }

  async function handleDelete(entry) {
    try {
      await api.delete(`/tax/income/sole-proprietorship/${entry.id}/`)
      await refetch()
      qc.invalidateQueries(['income-sole', submissionId])
      onWHTChange?.()
      toast.success('Removed')
    } catch { toast.error('Failed to delete') }
  }

  const fmt = v => Math.round(parseFloat(v || 0)).toLocaleString('en-LK')

  return (
    <div className="space-y-3">
      {entries.length > 0 && (
        <div className="border border-brand-gray-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-brand-black">
              <tr>
                <th className="text-left px-3 py-2 text-xs text-brand-gray font-medium">Business Name</th>
                <th className="text-right px-3 py-2 text-xs text-brand-gray font-medium">Income (Rs.)</th>
                <th className="text-right px-3 py-2 text-xs text-brand-gray font-medium">WHT (Rs.)</th>
                {!isReadOnly && <th className="w-16" />}
              </tr>
            </thead>
            <tbody>
              {entries.map((e, idx) => (
                <tr key={e.id} className={idx % 2 === 0 ? 'bg-brand-black/20' : ''}>
                  <td className="px-3 py-2 text-white">{e.business_name || '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-white">{fmt(e.amount)}</td>
                  <td className="px-3 py-2 text-right font-mono text-brand-yellow">{fmt(e.wht_deducted)}</td>
                  {!isReadOnly && (
                    <td className="px-2 py-2">
                      <div className="flex gap-1 justify-end">
                        <button type="button" onClick={() => openEdit(e)} className="p-1 rounded hover:bg-brand-gray/10 text-brand-gray hover:text-white transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button type="button" onClick={() => handleDelete(e)} className="p-1 rounded hover:bg-brand-red/10 text-brand-gray hover:text-brand-red transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {entries.length > 1 && (
              <tfoot className="border-t border-brand-gray-border bg-brand-black">
                <tr>
                  <td className="px-3 py-2 text-xs text-brand-gray font-semibold">Total</td>
                  <td className="px-3 py-2 text-right font-mono text-brand-yellow text-xs font-semibold">
                    {fmt(entries.reduce((s, e) => s + parseFloat(e.amount || 0), 0))}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-brand-yellow text-xs font-semibold">
                    {fmt(entries.reduce((s, e) => s + parseFloat(e.wht_deducted || 0), 0))}
                  </td>
                  {!isReadOnly && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {!isReadOnly && (
        <button type="button" onClick={openAdd} className="flex items-center gap-1.5 text-sm text-brand-yellow hover:text-brand-yellow/80 transition-colors font-medium">
          <Plus size={14} /> Add Business / Partnership
        </button>
      )}

      {entries.length === 0 && isReadOnly && (
        <p className="text-sm text-brand-gray">No business income entered.</p>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-brand-black-light border border-brand-gray-border rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">{modal.mode === 'add' ? 'Add Business Income' : 'Edit Business Income'}</h3>
              <button type="button" onClick={() => setModal(null)} className="text-brand-gray hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-brand-gray mb-1 block font-medium">Business / Partnership Name</label>
                <input
                  className="input-field"
                  placeholder="e.g., ABC Consultancy"
                  value={form.business_name}
                  onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-brand-gray mb-1 block font-medium">Net Business Income (Rs.)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray text-sm font-mono">Rs.</span>
                  <input
                    type="number"
                    className="input-field pl-10 text-right font-mono"
                    placeholder=""
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-brand-gray mb-1 block font-medium">WHT Deducted on Business Income (Rs.)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray text-sm font-mono">Rs.</span>
                  <input
                    type="number"
                    className="input-field pl-10 text-right font-mono"
                    placeholder=""
                    value={form.wht_deducted}
                    onChange={e => setForm(f => ({ ...f, wht_deducted: e.target.value }))}
                  />
                </div>
                <p className="text-xs text-brand-gray mt-1">Will be automatically added to your tax credits</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setModal(null)} className="btn-secondary text-sm">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving} className="btn-primary text-sm">
                <Check size={14} /> {saving ? 'Saving…' : modal.mode === 'add' ? 'Add' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


/* ─── Self Assessment Installments sub-component ─── */
function SelfAssessmentInstallments({ submissionId, documents, onUpload, onDelete, isReadOnly }) {
  const { data: installments = [], refetch } = useQuery({
    queryKey: ['self-assessment', submissionId],
    queryFn:  () => api.get(`/tax/submissions/${submissionId}/self-assessment/`).then(r => r.data),
  })

  async function saveInstallment(num, amount) {
    try {
      const existing = installments.find(i => i.installment_number === num)
      if (existing) {
        await api.patch(`/tax/self-assessment/${existing.id}/`, { amount })
      } else {
        await api.post(`/tax/submissions/${submissionId}/self-assessment/`, { installment_number: num, amount })
      }
      refetch()
    } catch { toast.error('Failed to save installment') }
  }

  const INSTALLMENTS = [
    { num: 1, label: '1st Installment' },
    { num: 2, label: '2nd Installment' },
    { num: 3, label: '3rd Installment' },
    { num: 4, label: '4th Installment' },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {INSTALLMENTS.map(({ num, label }) => {
          const inst = installments.find(i => i.installment_number === num)
          return (
            <div key={num}>
              <label className="text-xs text-brand-gray mb-1.5 block font-medium">{label}</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-gray text-xs font-mono select-none">Rs.</span>
                <NumberInput
                  value={inst?.amount && parseFloat(inst.amount) !== 0 ? inst.amount : ''}
                  onBlur={e => !isReadOnly && saveInstallment(num, e.target.value || 0)}
                  placeholder=""
                  disabled={isReadOnly}
                  className="input-field pl-9 text-right font-mono text-sm"
                />
              </div>
            </div>
          )
        })}
      </div>
      <FileUpload
        label="Pay-in Slips / Online Payment Receipts"
        documentType="self_assessment_receipt"
        section="tax_credits"
        submissionId={submissionId}
        documents={documents}
        onUpload={onUpload}
        onDelete={onDelete}
      />
    </div>
  )
}
