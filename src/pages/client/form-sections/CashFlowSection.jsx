import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../../services/api'
import { ArrowRight, ArrowLeft, TrendingUp, TrendingDown, Landmark, Plus, Trash2, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import NumberInput from '../../../components/common/NumberInput'

const D = (v) => parseFloat(v || 0)
const fmt = (v) => Math.round(D(v)).toLocaleString('en-LK')

// Fields whose values are auto-populated from Assets / Liabilities records.
// They show an "auto" badge and refresh when source records change, but remain editable.
// Note: receipt_bank_loan ("Bank Loan Received") is intentionally NOT in this set —
// it still shows the auto-suggested value as a starting point (via the standard
// saved-value-wins fallback below), but a saved edit is no longer overwritten by the
// live suggestion on every reload.
const LINKED_SCALARS = new Set([
  'payment_purchase_land_building',
  'payment_purchase_motor_vehicle',
  'payment_purchase_other_assets',
  'payment_investment_shares',
  'receipt_debtor_received',
  'payment_loans_given_others',
  'payment_repayment_bank_loan',
  'receipt_sale_land_building',
  'receipt_sale_motor_vehicle',
  'receipt_sale_other_assets',
  'receipt_sale_shares',
])

/* ── Numeric input row ── */
function AmountRow({ label, fieldKey, value, onChange, readOnly, isLinked }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-brand-gray-border/40 gap-3">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-sm text-brand-gray">{label}</span>
        {isLinked && (
          <span className="text-[10px] bg-brand-yellow/10 text-brand-yellow border border-brand-yellow/20 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide shrink-0">auto</span>
        )}
      </div>
      {readOnly ? (
        <span className="text-sm font-mono text-white w-36 text-right">{fmt(value)}</span>
      ) : (
        <NumberInput
          value={value || ''}
          onChange={e => onChange(fieldKey, e.target.value)}
          className="input-field w-36 text-right text-sm py-1.5 px-2"
        />
      )}
    </div>
  )
}

/* ── Section heading ── */
function SectionHead({ icon: Icon, title, color = 'text-brand-yellow' }) {
  return (
    <div className={clsx('flex items-center gap-2 pt-4 pb-2 border-b-2 border-brand-gray-border mb-1', color)}>
      <Icon size={16} className={color} />
      <span className="text-sm font-bold uppercase tracking-wider">{title}</span>
    </div>
  )
}

/* ── Bank account list (opening/closing favourable or overdraft) ── */
function BankList({ label, entries, onChange, readOnly }) {
  function addRow() {
    onChange([...entries, { bank_name: '', account_no: '', amount: '' }])
  }
  function removeRow(i) {
    onChange(entries.filter((_, idx) => idx !== i))
  }
  function updateRow(i, key, val) {
    const next = entries.map((r, idx) => idx === i ? { ...r, [key]: val } : r)
    onChange(next)
  }

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-brand-gray font-medium">{label}</span>
        {!readOnly && (
          <button type="button" onClick={addRow} className="text-xs text-brand-yellow hover:opacity-80 flex items-center gap-1">
            <Plus size={11} /> Add Bank
          </button>
        )}
      </div>
      {entries.length === 0 && (
        <p className="text-xs text-brand-gray italic py-1">No entries</p>
      )}
      {entries.map((row, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 mb-1.5 items-center">
          <input
            className="input-field col-span-5 text-sm py-1.5 px-2"
            placeholder="Bank Name"
            value={row.bank_name}
            readOnly={readOnly}
            onChange={e => updateRow(i, 'bank_name', e.target.value)}
          />
          <input
            className="input-field col-span-4 text-sm py-1.5 px-2"
            placeholder="Acc. No."
            value={row.account_no}
            readOnly={readOnly}
            onChange={e => updateRow(i, 'account_no', e.target.value)}
          />
          <NumberInput
            className="input-field col-span-2 text-sm py-1.5 px-2 text-right"
            value={row.amount}
            readOnly={readOnly}
            onChange={e => updateRow(i, 'amount', e.target.value)}
          />
          {!readOnly && (
            <button type="button" onClick={() => removeRow(i)} className="col-span-1 text-brand-red hover:opacity-80 flex justify-center">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

/* ── Other items (dynamic description+amount rows) ── */
function OtherItemsList({ label, entries, onChange, readOnly }) {
  function addRow() {
    onChange([...entries, { description: '', amount: '' }])
  }
  function removeRow(i) {
    onChange(entries.filter((_, idx) => idx !== i))
  }
  function updateRow(i, key, val) {
    onChange(entries.map((r, idx) => idx === i ? { ...r, [key]: val } : r))
  }

  return (
    <div className="mb-1 mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-brand-yellow font-semibold uppercase tracking-wide">{label}</span>
        {!readOnly && (
          <button type="button" onClick={addRow} className="text-xs text-brand-yellow hover:opacity-80 flex items-center gap-1">
            <Plus size={11} /> Add
          </button>
        )}
      </div>
      {entries.length === 0 && !readOnly && (
        <p className="text-xs text-brand-gray italic py-1">No other {label.toLowerCase()} — click Add to include</p>
      )}
      {entries.map((row, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 mb-1.5 items-center py-1 border-b border-brand-gray-border/30">
          <input
            className="input-field col-span-7 text-sm py-1.5 px-2"
            placeholder="Description"
            value={row.description}
            readOnly={readOnly}
            onChange={e => updateRow(i, 'description', e.target.value)}
          />
          <NumberInput
            className="input-field col-span-4 text-sm py-1.5 px-2 text-right"
            value={row.amount}
            readOnly={readOnly}
            onChange={e => updateRow(i, 'amount', e.target.value)}
          />
          {!readOnly && (
            <button type="button" onClick={() => removeRow(i)} className="col-span-1 text-brand-red hover:opacity-80 flex justify-center">
              <Trash2 size={13} />
            </button>
          )}
          {readOnly && <div className="col-span-1" />}
        </div>
      ))}
      {entries.length > 0 && (
        <div className="flex justify-between py-1 text-xs text-brand-gray">
          <span>{entries.length} item{entries.length !== 1 ? 's' : ''}</span>
          <span className="font-mono font-semibold text-white">
            Rs. {Math.round(entries.reduce((s, r) => s + parseFloat(r.amount || 0), 0)).toLocaleString('en-LK')}
          </span>
        </div>
      )}
    </div>
  )
}


/* ── Subtotal row ── */
function SubtotalRow({ label, value, highlight }) {
  return (
    <div className={clsx(
      'flex items-center justify-between py-2 px-3 rounded-lg mt-2 mb-1',
      highlight ? 'bg-brand-yellow/10 border border-brand-yellow/30' : 'bg-brand-black-soft border border-brand-gray-border'
    )}>
      <span className={clsx('text-sm font-semibold', highlight ? 'text-brand-yellow' : 'text-white')}>{label}</span>
      <span className={clsx('font-mono text-sm font-bold', highlight ? 'text-brand-yellow' : 'text-white')}>
        Rs. {fmt(value)}
      </span>
    </div>
  )
}

/* ── Main component ── */
export default function CashFlowSection({ submissionId, isReadOnly, onNext, onPrev, showStepNav = true }) {
  const qc = useQueryClient()

  const { data: saved } = useQuery({
    queryKey: ['cash-flow', submissionId],
    queryFn: () => api.get(`/tax/submissions/${submissionId}/cash-flow/`).then(r => r.data),
  })

  const { data: suggested } = useQuery({
    queryKey: ['cashflow-suggested', submissionId],
    queryFn: () => api.get(`/tax/submissions/${submissionId}/cashflow/suggested/`).then(r => r.data),
    staleTime: 0,
  })

  const DEFAULTS = {
    opening_cash_in_hand: '',
    opening_favourable_banks: [],
    opening_overdraft_banks: [],
    receipt_employment_income: '',
    receipt_interest_savings: '',
    receipt_rent_income: '',
    receipt_tb_securities: '',
    receipt_sale_shares: '',
    receipt_dividend_income: '',
    receipt_drawings_sole_partner: '',
    receipt_bank_loan: '',
    receipt_other_loans: '',
    receipt_debtor_received: '',
    receipt_sale_land_building: '',
    receipt_sale_motor_vehicle: '',
    receipt_sale_other_assets: '',
    receipt_other_items: [],
    payment_purchase_land_building: '',
    payment_purchase_motor_vehicle: '',
    payment_purchase_other_assets: '',
    payment_repayment_bank_loan: '',
    payment_lease_rentals: '',
    payment_jewellery_gems: '',
    payment_other_loans: '',
    payment_wht: '',
    payment_income_tax: '',
    payment_apit: '',
    payment_investment_shares: '',
    payment_loans_given_others: '',
    payment_other_items: [],
    closing_cash_in_hand: '',
    closing_favourable_banks: [],
    closing_overdraft_banks: [],
    living_expenses_year: '',
  }

  const [form, setForm] = useState(DEFAULTS)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (suggested === undefined) return
    const nv = (k, sv, sg) => {
      if (Array.isArray(DEFAULTS[k])) {
        const savedArr = Array.isArray(sv) ? sv : []
        const sugArr   = Array.isArray(sg) ? sg : []
        return savedArr.length > 0 ? savedArr : sugArr
      }
      // Fields sourced from Assets / Liabilities always follow the live computed value.
      // A computed 0 is a real, meaningful value (e.g. nothing bought this year) and
      // must still display — only null/blank/NaN means "no value".
      if (LINKED_SCALARS.has(k)) {
        const sugOk = sg != null && sg !== '' && !isNaN(parseFloat(sg))
        return sugOk ? String(sg) : ''
      }
      const savedOk = sv != null && sv !== '' && !isNaN(parseFloat(sv))
      const sugOk   = sg != null && sg !== '' && !isNaN(parseFloat(sg))
      if (savedOk) return String(sv)
      if (sugOk)   return String(sg)
      return ''
    }
    const savedData = (saved && saved.id) ? saved : {}
    const sugData   = suggested || {}
    setForm({ ...DEFAULTS, ...Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, nv(k, savedData[k], sugData[k])])) })
  }, [saved, suggested])

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  /* ── Computed totals ── */
  const openingBankFav  = form.opening_favourable_banks.reduce((s, r) => s + D(r.amount), 0)
  const openingBankOD   = form.opening_overdraft_banks.reduce((s, r) => s + D(r.amount), 0)
  const openingTotal    = D(form.opening_cash_in_hand) + openingBankFav - openingBankOD

  const otherReceiptsTotal = (form.receipt_other_items || []).reduce((s, r) => s + D(r.amount), 0)
  const otherPaymentsTotal = (form.payment_other_items  || []).reduce((s, r) => s + D(r.amount), 0)

  const totalReceipts =
    D(form.receipt_employment_income) +
    D(form.receipt_interest_savings) + D(form.receipt_rent_income) +
    D(form.receipt_tb_securities) + D(form.receipt_sale_shares) +
    D(form.receipt_dividend_income) + D(form.receipt_drawings_sole_partner) +
    D(form.receipt_bank_loan) + D(form.receipt_other_loans) +
    D(form.receipt_debtor_received) +
    D(form.receipt_sale_land_building) + D(form.receipt_sale_motor_vehicle) +
    D(form.receipt_sale_other_assets) + otherReceiptsTotal

  const totalCashAvailable = openingTotal + totalReceipts

  const totalPayments =
    D(form.payment_purchase_land_building) + D(form.payment_purchase_motor_vehicle) +
    D(form.payment_purchase_other_assets) + D(form.payment_repayment_bank_loan) +
    D(form.payment_lease_rentals) + D(form.payment_jewellery_gems) +
    D(form.payment_other_loans) + D(form.payment_wht) +
    D(form.payment_income_tax) + D(form.payment_apit) +
    D(form.payment_investment_shares) + D(form.payment_loans_given_others) +
    otherPaymentsTotal

  const netCashAvailable = totalCashAvailable - totalPayments

  const closingBankFav = form.closing_favourable_banks.reduce((s, r) => s + D(r.amount), 0)
  const closingBankOD  = form.closing_overdraft_banks.reduce((s, r) => s + D(r.amount), 0)
  const closingTotal   = D(form.closing_cash_in_hand) + closingBankFav - closingBankOD

  // Living expenses = Net Cash Flow − Cash in Hand − Bank Balance + Bank Overdraft
  const livingExpensesYear = netCashAvailable - closingTotal
  const livingPerMonth = livingExpensesYear / 12

  function buildPayload() {
    const payload = { ...form, living_expenses_year: String(Math.round(livingExpensesYear)) }
    Object.keys(payload).forEach(k => {
      if (!Array.isArray(payload[k]) && (payload[k] === '' || payload[k] == null)) {
        payload[k] = 0
      }
    })
    return payload
  }

  async function handleSave() {
    setSaving(true)
    try {
      await api.post(`/tax/submissions/${submissionId}/cash-flow/`, buildPayload())
      qc.invalidateQueries(['cash-flow', submissionId])
      toast.success('Cash flow statement saved')
    } catch {
      toast.error('Failed to save')
    }
    setSaving(false)
  }

  async function handleSaveAndNext() {
    await handleSave()
    onNext()
  }

  const ro = isReadOnly

  return (
    <div className="space-y-2">

      {/* ── Opening Balances ── */}
      <div className="card">
        <SectionHead icon={Landmark} title="Opening Balances — as at 1st April" />

        <AmountRow label="Cash in Hand" fieldKey="opening_cash_in_hand" value={form.opening_cash_in_hand} onChange={set} readOnly={ro} />

        <div className="mt-3">
          <BankList
            label="Cash at Bank — Favourable Balances"
            entries={form.opening_favourable_banks}
            onChange={v => set('opening_favourable_banks', v)}
            readOnly={ro}
          />
          <BankList
            label="(–) Cash at Bank — Overdraft"
            entries={form.opening_overdraft_banks}
            onChange={v => set('opening_overdraft_banks', v)}
            readOnly={ro}
          />
        </div>

        <SubtotalRow label="Opening Cash Balance" value={openingTotal} />
      </div>

      {/* ── Receipts ── */}
      <div className="card">
        <SectionHead icon={TrendingUp} title="Receipts During the Year" color="text-brand-success" />

        {[
          ['receipt_employment_income',     'Employment Income',                           false],
          ['receipt_interest_savings',      'Interest Income on Savings Accounts',         false],
          ['receipt_rent_income',           'Rent Income',                                 false],
          ['receipt_tb_securities',         'Income on Sale of T/B and Securities',        false],
          ['receipt_sale_shares',           'Sale of Shares',                              true],
          ['receipt_dividend_income',       'Dividend Income',                             false],
          ['receipt_drawings_sole_partner', 'Drawings from Sole / Partnership Businesses', false],
          ['receipt_bank_loan',             'Bank Loan Received',                          true],
          ['receipt_other_loans',           'Other Loans Received',                        false],
          ['receipt_debtor_received',       'Debtor Received',                             true],
          ['receipt_sale_land_building',    'Sale of Land or Building',                    true],
          ['receipt_sale_motor_vehicle',    'Sale of Motor Vehicle',                       true],
          ['receipt_sale_other_assets',     'Sale of Other Assets',                        true],
        ].map(([key, label, isLinked]) => (
          <AmountRow key={key} label={label} fieldKey={key} value={form[key]} onChange={set} readOnly={ro} isLinked={isLinked} />
        ))}

        {/* Other receipts — dynamic list */}
        <OtherItemsList
          label="Other Receipts"
          entries={form.receipt_other_items || []}
          onChange={v => set('receipt_other_items', v)}
          readOnly={ro}
        />

        <SubtotalRow label="Total Receipts" value={totalReceipts} />
        <SubtotalRow label="Total Cash Available" value={totalCashAvailable} highlight />
      </div>

      {/* ── Payments ── */}
      <div className="card">
        <SectionHead icon={TrendingDown} title="Payments During the Year" color="text-brand-red" />

        {[
          ['payment_purchase_land_building',  'Purchase of Land or Building',          true],
          ['payment_purchase_motor_vehicle',  'Purchase of Motor Vehicle',             true],
          ['payment_purchase_other_assets',   'Purchase of Other Assets',              true],
          ['payment_repayment_bank_loan',     'Repayment of Bank Loan',                true],
          ['payment_lease_rentals',           'Payment of Lease Rentals',              false],
          ['payment_jewellery_gems',          'Purchase of Jewellery / Gems / Silver', false],
          ['payment_other_loans',             'Payment of Other Loans',                false],
          ['payment_wht',                     'WHT',                                   false],
          ['payment_income_tax',              'Income Tax Payments',                   false],
          ['payment_apit',                    'APIT',                                  false],
          ['payment_investment_shares',       'Investment on Shares',                  true],
          ['payment_loans_given_others',      'Loans Given to Others',                 true],
        ].map(([key, label, isLinked]) => (
          <AmountRow key={key} label={label} fieldKey={key} value={form[key]} onChange={set} readOnly={ro} isLinked={isLinked} />
        ))}

        {/* Other payments — dynamic list */}
        <OtherItemsList
          label="Other Payments"
          entries={form.payment_other_items || []}
          onChange={v => set('payment_other_items', v)}
          readOnly={ro}
        />

        <SubtotalRow label="Total Payments" value={totalPayments} />
        <SubtotalRow label="Net Cash Available — as at 31st March" value={netCashAvailable} highlight />
      </div>

      {/* ── Closing Balances ── */}
      <div className="card">
        <SectionHead icon={Landmark} title="Closing Balances — as at 31st March" />

        <AmountRow label="Cash in Hand" fieldKey="closing_cash_in_hand" value={form.closing_cash_in_hand} onChange={set} readOnly={ro} />

        <div className="mt-3">
          <BankList
            label="Cash at Banks — Favourable Balances"
            entries={form.closing_favourable_banks}
            onChange={v => set('closing_favourable_banks', v)}
            readOnly={ro}
          />
          <BankList
            label="(–) Cash at Banks — Overdraft"
            entries={form.closing_overdraft_banks}
            onChange={v => set('closing_overdraft_banks', v)}
            readOnly={ro}
          />
        </div>

        <SubtotalRow label="Closing Cash Balance" value={closingTotal} highlight />

        {/* Reconciliation hint */}
        {Math.abs(netCashAvailable - closingTotal) > 1 && (closingTotal > 0 || netCashAvailable > 0) && (
          <p className="text-xs text-brand-red mt-2">
            Note: Net cash available (Rs. {fmt(netCashAvailable)}) does not match closing balance (Rs. {fmt(closingTotal)}). Please review your entries.
          </p>
        )}
      </div>

      {/* ── Living Expenses ── */}
      <div className="card">
        <SectionHead icon={TrendingDown} title="Living Expenses" color="text-brand-gray" />

        <div className="flex items-center justify-between py-2 border-b border-brand-gray-border/40 gap-3">
          <span className="text-sm text-brand-gray flex-1">Living Expenses for the Year (Rs.)</span>
          <span className="text-sm font-mono text-white w-36 text-right">{fmt(livingExpensesYear)}</span>
        </div>

        {livingExpensesYear > 0 && (
          <div className="flex items-center justify-between py-2 border-b border-brand-gray-border/40">
            <span className="text-sm text-brand-gray">Living Expenses per Month (÷ 12)</span>
            <span className="text-sm font-mono text-brand-yellow font-semibold">Rs. {fmt(livingPerMonth)}</span>
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      {showStepNav ? (
        <div className="flex justify-between items-center pt-2">
          <button type="button" onClick={onPrev} className="btn-secondary">
            <ArrowLeft size={15} /> Back
          </button>
          <div className="flex gap-3">
            {!ro && (
              <button type="button" onClick={handleSave} disabled={saving} className="btn-secondary">
                <Save size={14} /> {saving ? 'Saving…' : 'Save'}
              </button>
            )}
            <button type="button" onClick={ro ? onNext : handleSaveAndNext} disabled={saving} className="btn-primary">
              Next: Declarant Details <ArrowRight size={15} />
            </button>
          </div>
        </div>
      ) : (
        !ro && (
          <div className="flex justify-end pt-2">
            <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
              <Save size={14} /> {saving ? 'Saving…' : 'Save Cash Flow'}
            </button>
          </div>
        )
      )}
    </div>
  )
}
