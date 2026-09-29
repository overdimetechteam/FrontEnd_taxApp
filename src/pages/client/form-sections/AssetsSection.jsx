import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../../services/api'
import { ChevronRight, ChevronLeft, Plus, Trash2, Pencil, X, Save, LayoutList } from 'lucide-react'
import toast from 'react-hot-toast'
import NumberInput from '../../../components/common/NumberInput'

const fmtAmt = v => {
  const n = Math.round(parseFloat(v || 0))
  return isNaN(n) ? '0' : n.toLocaleString('en-LK')
}
const numOrDash = v => { const n = parseFloat(v || 0); return (!isNaN(n) && n !== 0) ? fmtAmt(n) : '—' }
const normVal = v => typeof v === 'object' ? v : (v == null || v === '' || (!isNaN(parseFloat(v)) && parseFloat(v) === 0)) ? '' : v

// Returns the cost if the date falls within [yearStart, yearEnd], else 0.
// Normalises to first 10 chars (YYYY-MM-DD) so datetime strings from the API
// ('2025-06-15T00:00:00') compare correctly against plain date strings.
function boughtDuringYear(row, costKey, yearStart, yearEnd) {
  const raw = row.date_of_acquisition
  if (!raw || !yearStart || !yearEnd) return 0
  const d  = String(raw).trim().slice(0, 10)
  const ys = String(yearStart).trim().slice(0, 10)
  const ye = String(yearEnd).trim().slice(0, 10)
  return (d >= ys && d <= ye) ? parseFloat(row[costKey] || 0) : 0
}

const CATEGORIES = [
  {
    key: 'immovable', label: '1.  Immovable Properties as at 31st March 2026',
    endpoint: 'immovable', queryKey: 'immovable',
    defaults: { situation_of_property: '', date_of_acquisition: '', cost: '', market_value: '' },
    fields: [
      { key: 'situation_of_property', label: 'Situation of Property', type: 'text' },
      { key: 'date_of_acquisition', label: 'Date of Acquisition', type: 'date' },
      { key: 'cost', label: 'Cost (Rs.)', type: 'number' },
      { key: 'market_value', label: 'Market Value (Rs.)', type: 'number' },
    ],
    columns: [
      { key: 'situation_of_property', label: 'Situation of Property' },
      { key: 'date_of_acquisition',   label: 'Date of Acquisition' },
      { key: 'cost',                  label: 'Cost (Rs.)',              numeric: true },
      { key: '_bought_during_year',   label: 'Bought During the Year',  numeric: true, derived: (row, ys, ye) => boughtDuringYear(row, 'cost', ys, ye) },
      { key: 'market_value',          label: 'Market Value (Rs.)',      numeric: true },
    ],
    totalCols: ['cost', '_bought_during_year', 'market_value'],
  },
  {
    key: 'vehicles', label: '2.  Motor Vehicles as at 31st March 2026',
    endpoint: 'vehicles', queryKey: 'vehicles',
    defaults: { description: '', registration_no: '', date_of_acquisition: '', cost_market_value: '' },
    fields: [
      { key: 'description',       label: 'Description',              type: 'text' },
      { key: 'registration_no',   label: 'Registration No.',         type: 'text' },
      { key: 'date_of_acquisition', label: 'Date of Acquisition',   type: 'date' },
      { key: 'cost_market_value', label: 'Cost / Market Value (Rs.)', type: 'number' },
    ],
    columns: [
      { key: 'description',         label: 'Description' },
      { key: 'registration_no',     label: 'Registration No.' },
      { key: 'date_of_acquisition', label: 'Date of Acquisition' },
      { key: '_bought_during_year', label: 'Bought During the Year',   numeric: true, derived: (row, ys, ye) => boughtDuringYear(row, 'cost_market_value', ys, ye) },
      { key: 'cost_market_value',   label: 'Cost / M. Value (Rs.)',    numeric: true },
    ],
    totalCols: ['_bought_during_year', 'cost_market_value'],
  },
  {
    key: 'bank-balances', label: '3.  Bank Balances including Term Deposits as at 31.03.2026',
    endpoint: 'bank-balances', queryKey: 'bankBalances',
    defaults: { bank_name: '', account_no: '', amount_invested: '', interest: '', balance: '' },
    fields: [
      { key: 'bank_name',       label: 'Bank / Institution',       type: 'text' },
      { key: 'account_no',      label: 'Account No.',              type: 'text' },
      { key: 'amount_invested', label: 'Amount Invested (Rs.)',    type: 'number' },
      { key: 'interest',        label: 'Interest (Rs.)',           type: 'number' },
      { key: 'balance',         label: 'Balance (Rs.)',            type: 'number' },
    ],
    columns: [
      { key: 'bank_name',       label: 'Name of Bank / Financial Institution' },
      { key: 'account_no',      label: 'Account No.' },
      { key: 'amount_invested', label: 'Amount Invested (Rs.)',  numeric: true },
      { key: 'interest',        label: 'Interest (Rs.)',         numeric: true },
      { key: 'balance',         label: 'Balance (Rs.)',          numeric: true },
    ],
    totalCols: ['amount_invested', 'interest', 'balance'],
  },
  {
    key: 'shares', label: '4.  Shares / Stocks / Securities as at 31.03.2026',
    endpoint: 'shares', queryKey: 'shares',
    defaults: { description: '', no_of_shares: '', date_of_acquisition: '', cost_market_value: '', net_dividend_income: '' },
    fields: [
      { key: 'description',        label: 'Description',                    type: 'text' },
      { key: 'no_of_shares',       label: 'No. of Shares',                  type: 'number' },
      { key: 'date_of_acquisition', label: 'Date Acquired',                 type: 'date' },
      { key: 'cost_market_value',  label: 'Cost of Acquisition / Market Value (Rs.)', type: 'number' },
      { key: 'net_dividend_income', label: 'Net Dividend Income (Rs.)',     type: 'number' },
    ],
    columns: [
      { key: 'description',         label: 'Description' },
      { key: 'no_of_shares',        label: 'No. of Shares / Stocks',               numeric: true },
      { key: 'date_of_acquisition', label: 'Date of Acquisition' },
      { key: 'cost_market_value',   label: 'Cost of Acquisition / Market Value (Rs.)', numeric: true },
      { key: 'net_dividend_income', label: 'Net Dividend Income (Rs.)',            numeric: true },
    ],
    totalCols: ['cost_market_value', 'net_dividend_income'],
  },
  {
    key: 'cash', label: '5.  Cash in Hand as at 31.03.2026',
    endpoint: 'cash', queryKey: 'cash', isSingle: true,
    defaults: { amount: '' },
    fields: [{ key: 'amount', label: 'Amount (Rs.)', type: 'number' }],
  },
  {
    key: 'gold', label: '7.  Gold, Silver, Gems, Jewellery etc. as at 31.03.2026',
    endpoint: 'gold', queryKey: 'gold', isSingle: true,
    defaults: { description: '', value: '' },
    fields: [
      { key: 'description', label: 'Description of Items',    type: 'text' },
      { key: 'value',       label: 'Estimated Value (Rs.)',   type: 'number' },
    ],
  },
  {
    key: 'business', label: '8.  Properties Held as a Part of Business',
    endpoint: 'business', queryKey: 'business',
    defaults: { name_of_business: '', current_account_balance: '', capital_account_balance: '' },
    fields: [
      { key: 'name_of_business',        label: 'Name of Business',              type: 'text' },
      { key: 'current_account_balance', label: 'Current Account Balance (Rs.)', type: 'number' },
      { key: 'capital_account_balance', label: 'Capital Account Balance (Rs.)', type: 'number' },
    ],
    columns: [
      { key: 'name_of_business',        label: 'Name of Business' },
      { key: 'current_account_balance', label: 'Current Account (Rs.)',         numeric: true },
      { key: 'capital_account_balance', label: 'Capital Account Balance (Rs.)', numeric: true },
    ],
    totalCols: ['current_account_balance', 'capital_account_balance'],
  },
  {
    key: 'other', label: '9.  Any Other Assets Acquired or Gifts Received During the Year',
    endpoint: 'other', queryKey: 'otherAssets',
    defaults: { description: '', acquisition_type: 'purchase', date_of_acquisition: '', cost_value: '' },
    fields: [
      { key: 'description', label: 'Description', type: 'text' },
      {
        key: 'acquisition_type', label: 'Acquisition Type', type: 'select',
        options: [
          { value: 'purchase', label: 'Purchase' },
          { value: 'gift',     label: 'Gift' },
          { value: 'exchange', label: 'Exchange' },
        ],
      },
      { key: 'date_of_acquisition', label: 'Date of Acquisition', type: 'date' },
      { key: 'cost_value',          label: 'Cost / Value (Rs.)',  type: 'number' },
    ],
    columns: [
      { key: 'description',         label: 'Description of Asset' },
      { key: 'acquisition_type',    label: 'Gift / Exchange / Purchase',
        render: v => ({ purchase: 'Purchase', gift: 'Gift', exchange: 'Exchange' }[v] || v) },
      { key: 'date_of_acquisition', label: 'Date of Acquisition / Receipt' },
      { key: 'cost_value',          label: 'Cost / Value (Rs.)', numeric: true },
    ],
    totalCols: ['cost_value'],
  },
  {
    key: 'disposals', label: '10.  Disposal of Assets including Shares During the Year',
    endpoint: 'disposals', queryKey: 'disposals',
    // Entries added here are reporting-only (not taxed) and never appear in the
    // Income section's "Capital Gain" table — see is_capital_gain on the model.
    defaults: { description: '', category: 'other', date_of_disposal: '', sales_proceed: '', date_acquired: '', cost: '', is_capital_gain: false },
    fields: [
      { key: 'description', label: 'Description', type: 'text' },
      {
        key: 'category', label: 'Category', type: 'select',
        options: [
          { value: 'land_building',  label: 'Land / Building' },
          { value: 'motor_vehicle',  label: 'Motor Vehicle' },
          { value: 'shares',         label: 'Shares / Securities' },
          { value: 'other',          label: 'Other' },
        ],
      },
      { key: 'date_of_disposal', label: 'Date of Disposal', type: 'date' },
      { key: 'sales_proceed',    label: 'Sales Proceed (Rs.)', type: 'number' },
      { key: 'date_acquired',    label: 'Date Acquired',       type: 'date' },
      { key: 'cost',             label: 'Cost (Rs.)',          type: 'number' },
    ],
    columns: [
      { key: 'description',      label: 'Description' },
      { key: 'date_of_disposal', label: 'Date of Disposal' },
      { key: 'sales_proceed',    label: 'Sales Proceed (Rs.)', numeric: true },
      { key: 'date_acquired',    label: 'Date Acquired' },
      { key: 'cost',             label: 'Cost (Rs.)',          numeric: true },
    ],
    totalCols: ['sales_proceed', 'cost'],
  },
]

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.key, c]))

/* ── Generic table for multi-row sections ── */
function CategoryTable({ cat, data, isReadOnly, onAdd, onEdit, onDelete, yearStart, yearEnd }) {
  const total = colKey => {
    const col = cat.columns.find(c => c.key === colKey)
    if (col?.derived) return data.reduce((s, r) => s + col.derived(r, yearStart, yearEnd), 0)
    return data.reduce((s, r) => s + parseFloat(r[colKey] || 0), 0)
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-brand-yellow uppercase tracking-wider">{cat.label}</h4>
        {!isReadOnly && (
          <button type="button" onClick={() => onAdd(cat.key)} className="btn-primary text-xs px-3 py-1.5">
            <Plus size={11} /> Add
          </button>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-brand-gray-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-brand-black">
              {cat.columns.map(col => (
                <th key={col.key} className={`table-header ${col.numeric ? 'text-right' : 'text-left'}`}>{col.label}</th>
              ))}
              {!isReadOnly && <th className="table-header w-16 text-center">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={cat.columns.length + (isReadOnly ? 0 : 1)}
                    className="table-cell text-center text-brand-gray py-3 text-xs italic">
                  No entries
                </td>
              </tr>
            ) : (
              data.map(row => (
                <tr key={row.id} className="table-row">
                  {cat.columns.map(col => {
                    let display
                    if (col.derived) {
                      display = <span className="font-mono text-white">{numOrDash(col.derived(row, yearStart, yearEnd))}</span>
                    } else if (col.numeric) {
                      display = <span className="font-mono text-white">{numOrDash(row[col.key])}</span>
                    } else {
                      display = <span className="text-brand-gray">{col.render ? col.render(row[col.key]) : (row[col.key] || '—')}</span>
                    }
                    return (
                      <td key={col.key} className={`table-cell ${col.numeric || col.derived ? 'text-right' : ''}`}>
                        {display}
                      </td>
                    )
                  })}
                  {!isReadOnly && (
                    <td className="table-cell text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => onEdit(row, cat.key)} className="text-brand-yellow hover:opacity-80"><Pencil size={12} /></button>
                        <button onClick={() => onDelete(row, cat)}   className="text-brand-red hover:opacity-80"><Trash2 size={12} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
            {cat.totalCols && data.length > 0 && (
              <tr className="border-t border-brand-gray-border bg-brand-black/40">
                {cat.columns.map((col, i) => (
                  <td key={col.key} className={`table-cell font-semibold ${col.numeric || col.derived ? 'text-right font-mono text-brand-yellow' : 'text-white'}`}>
                    {i === 0 ? 'Total' : (cat.totalCols.includes(col.key) ? fmtAmt(total(col.key)) : '')}
                  </td>
                ))}
                {!isReadOnly && <td className="table-cell" />}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Single-value section (Cash, Gold) ── */
function SingleSection({ cat, data, isReadOnly, onEdit }) {
  const amountField = cat.fields.find(f => f.type === 'number')
  const descField   = cat.fields.find(f => f.type === 'text')
  const amount = amountField ? parseFloat(data?.[amountField.key] || 0) : 0
  const desc   = descField ? data?.[descField.key] : null
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-brand-gray-border bg-brand-black-light">
        <div>
          <span className="text-xs font-semibold text-brand-yellow uppercase tracking-wider">{cat.label}</span>
          {desc && <p className="text-xs text-brand-gray mt-0.5">{desc}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-white">Rs.&nbsp;{amount > 0 ? fmtAmt(amount) : '—'}</span>
          {!isReadOnly && (
            <button onClick={onEdit} className="text-brand-yellow hover:opacity-80"><Pencil size={13} /></button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Loans Given — single aggregate record ── */
function LoansGivenSection({ data, isReadOnly, onEdit }) {
  const ob  = parseFloat(data?.opening_balance || 0)
  const giv = parseFloat(data?.given_during_year || 0)
  const rec = parseFloat(data?.cash_received_from_debtors || 0)
  const bal = ob + giv - rec

  const cols = [
    { label: 'Opening Balance',            val: ob },
    { label: 'Given During the Year',      val: giv },
    { label: 'Cash Received from Debtors', val: rec },
    { label: 'Balance as at 31.03.2026',   val: bal },
  ]

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-brand-yellow uppercase tracking-wider">
          6.  Loans Given &amp; Amount Receivable as at 31.03.2026
        </h4>
        {!isReadOnly && (
          <button type="button" onClick={onEdit} className="btn-primary text-xs px-3 py-1.5">
            <Pencil size={11} /> Edit
          </button>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-brand-gray-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-brand-black">
              {cols.map(c => (
                <th key={c.label} className="table-header text-right">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="table-row">
              {cols.map(c => (
                <td key={c.label} className="table-cell text-right font-mono text-white">
                  {c.val !== 0 ? fmtAmt(c.val) : '—'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function AssetsSection({ submissionId, submission, isReadOnly, onNext, onPrev }) {
  const qc = useQueryClient()

  const yearStart = submission?.assessment_year_start || ''
  const yearEnd   = submission?.assessment_year_end   || ''

  const { data: immovable = [] }    = useQuery({ queryKey: ['immovable',    submissionId], queryFn: () => api.get(`/tax/submissions/${submissionId}/assets/immovable/`).then(r => r.data) })
  const { data: vehicles = [] }     = useQuery({ queryKey: ['vehicles',     submissionId], queryFn: () => api.get(`/tax/submissions/${submissionId}/assets/vehicles/`).then(r => r.data) })
  const { data: bankBalances = [] } = useQuery({ queryKey: ['bankBalances', submissionId], queryFn: () => api.get(`/tax/submissions/${submissionId}/assets/bank-balances/`).then(r => r.data) })
  const { data: shares = [] }       = useQuery({ queryKey: ['shares',       submissionId], queryFn: () => api.get(`/tax/submissions/${submissionId}/assets/shares/`).then(r => r.data) })
  const { data: cashInHand }        = useQuery({ queryKey: ['cash',         submissionId], queryFn: () => api.get(`/tax/submissions/${submissionId}/assets/cash/`).then(r => r.data) })
  const { data: loansGiven }        = useQuery({ queryKey: ['loans',        submissionId], queryFn: () => api.get(`/tax/submissions/${submissionId}/assets/loans-given/`).then(r => r.data) })
  const { data: gold }              = useQuery({ queryKey: ['gold',         submissionId], queryFn: () => api.get(`/tax/submissions/${submissionId}/assets/gold/`).then(r => r.data) })
  const { data: business = [] }     = useQuery({ queryKey: ['business',     submissionId], queryFn: () => api.get(`/tax/submissions/${submissionId}/assets/business/`).then(r => r.data) })
  const { data: otherAssets = [] }  = useQuery({ queryKey: ['otherAssets',  submissionId], queryFn: () => api.get(`/tax/submissions/${submissionId}/assets/other/`).then(r => r.data) })
  const { data: disposals = [] }    = useQuery({ queryKey: ['disposals',    submissionId], queryFn: () => api.get(`/tax/submissions/${submissionId}/assets/disposals/`).then(r => r.data) })

  const dataMap = {
    'immovable': immovable, 'vehicles': vehicles, 'bank-balances': bankBalances,
    'shares': shares, 'cash': cashInHand, 'gold': gold,
    'business': business, 'other': otherAssets, 'disposals': disposals,
  }

  const [modalOpen,   setModalOpen]   = useState(false)
  const [modalCat,    setModalCat]    = useState('immovable')
  const [formVals,    setFormVals]    = useState({})
  const [editTarget,  setEditTarget]  = useState(null)
  const [saving,      setSaving]      = useState(false)

  function openAddModal(catKey) {
    setModalCat(catKey)
    setFormVals({ ...CAT_MAP[catKey].defaults })
    setEditTarget(null)
    setModalOpen(true)
  }

  function openEditModal(row, catKey) {
    setModalCat(catKey)
    setFormVals(Object.fromEntries(Object.entries(row).map(([k, v]) => [k, normVal(v)])))
    setEditTarget({ catKey, id: row.id, isSingle: false })
    setModalOpen(true)
  }

  function openSingleEditModal(catKey) {
    const existing = dataMap[catKey]
    setModalCat(catKey)
    if (existing?.id) {
      setFormVals(Object.fromEntries(Object.entries(existing).map(([k, v]) => [k, normVal(v)])))
    } else {
      setFormVals({ ...CAT_MAP[catKey].defaults })
    }
    setEditTarget({ catKey, id: existing?.id, isSingle: true })
    setModalOpen(true)
  }

  function openLoansEditModal() {
    const existing = loansGiven
    setModalCat('loans-given')
    if (existing?.id) {
      setFormVals(Object.fromEntries(Object.entries(existing).map(([k, v]) => [k, normVal(v)])))
    } else {
      setFormVals({ opening_balance: '', given_during_year: '', cash_received_from_debtors: '' })
    }
    setEditTarget({ catKey: 'loans-given', id: existing?.id, isSingle: true })
    setModalOpen(true)
  }

  function cleanPayload(cat, vals) {
    const payload = { ...vals }
    ;(cat?.fields || []).forEach(f => {
      if (f.type === 'date' && (payload[f.key] === '' || payload[f.key] == null)) {
        payload[f.key] = null
      } else if (f.type === 'number' && (payload[f.key] === '' || payload[f.key] == null)) {
        payload[f.key] = 0
      }
    })
    return payload
  }

  async function handleSave() {
    setSaving(true)
    try {
      const cat = CAT_MAP[modalCat]

      if (modalCat === 'loans-given') {
        const ob  = parseFloat(formVals.opening_balance || 0)
        const giv = parseFloat(formVals.given_during_year || 0)
        const rec = parseFloat(formVals.cash_received_from_debtors || 0)
        await api.post(`/tax/submissions/${submissionId}/assets/loans-given/`, {
          opening_balance: ob,
          given_during_year: giv,
          cash_received_from_debtors: rec,
          amount: ob + giv - rec,
        })
        qc.invalidateQueries(['loans', submissionId])
      } else if (cat.isSingle || editTarget?.isSingle) {
        await api.post(`/tax/submissions/${submissionId}/assets/${cat.endpoint}/`, cleanPayload(cat, formVals))
        qc.invalidateQueries([cat.queryKey, submissionId])
      } else if (editTarget) {
        await api.patch(`/tax/assets/${cat.endpoint}/${editTarget.id}/`, cleanPayload(cat, formVals))
        qc.invalidateQueries([cat.queryKey, submissionId])
      } else {
        await api.post(`/tax/submissions/${submissionId}/assets/${cat.endpoint}/`, cleanPayload(cat, formVals))
        qc.invalidateQueries([cat.queryKey, submissionId])
      }

      qc.invalidateQueries(['cashflow-suggested', submissionId])
      toast.success(editTarget && !editTarget.isSingle ? 'Updated' : 'Saved')
      setModalOpen(false)
    } catch (err) {
      const data = err?.response?.data
      const msg = data
        ? Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ')
        : 'Failed to save'
      toast.error(msg)
    }
    setSaving(false)
  }

  async function handleDelete(row, cat) {
    try {
      await api.delete(`/tax/assets/${cat.endpoint}/${row.id}/`)
      qc.invalidateQueries([cat.queryKey, submissionId])
      qc.invalidateQueries(['cashflow-suggested', submissionId])
      toast.success('Removed')
    } catch {
      toast.error('Failed to remove')
    }
  }

  const activeCat = CAT_MAP[modalCat]
  const loansModalFields = [
    { key: 'opening_balance',            label: 'Opening Balance (Rs.)',            type: 'number' },
    { key: 'given_during_year',          label: 'Given During the Year (Rs.)',      type: 'number' },
    { key: 'cash_received_from_debtors', label: 'Cash Received from Debtors (Rs.)', type: 'number' },
  ]

  return (
    <div className="space-y-6">
      <div className="form-section">
        <h3 className="section-header">
          <LayoutList size={18} className="text-brand-yellow" />
          Assets &amp; Liabilities as at 31st March 2026
        </h3>
        <p className="text-sm text-brand-gray mb-6">
          Record all properties, investments, bank accounts, vehicles, and other assets.
        </p>

        {/* Sections 1–5: Immovable, Vehicles, Bank, Shares, Cash */}
        {CATEGORIES.filter(c => ['immovable','vehicles','bank-balances','shares','cash'].includes(c.key)).map(cat =>
          cat.isSingle ? (
            <SingleSection key={cat.key} cat={cat} data={dataMap[cat.key]} isReadOnly={isReadOnly} onEdit={() => openSingleEditModal(cat.key)} />
          ) : (
            <CategoryTable key={cat.key} cat={cat} data={dataMap[cat.key] || []} isReadOnly={isReadOnly} onAdd={openAddModal} onEdit={openEditModal} onDelete={handleDelete} yearStart={yearStart} yearEnd={yearEnd} />
          )
        )}

        {/* Section 6: Loans Given (single aggregate record) */}
        <LoansGivenSection data={loansGiven} isReadOnly={isReadOnly} onEdit={openLoansEditModal} />

        {/* Sections 7–10: Gold, Business, Other Assets, Disposals */}
        {CATEGORIES.filter(c => ['gold','business','other','disposals'].includes(c.key)).map(cat =>
          cat.isSingle ? (
            <SingleSection key={cat.key} cat={cat} data={dataMap[cat.key]} isReadOnly={isReadOnly} onEdit={() => openSingleEditModal(cat.key)} />
          ) : (
            <CategoryTable key={cat.key} cat={cat} data={dataMap[cat.key] || []} isReadOnly={isReadOnly} onAdd={openAddModal} onEdit={openEditModal} onDelete={handleDelete} yearStart={yearStart} yearEnd={yearEnd} />
          )
        )}
      </div>

      <div className="flex justify-between">
        <button type="button" onClick={onPrev} className="btn-secondary">
          <ChevronLeft size={15} /> Previous
        </button>
        <button type="button" onClick={onNext} className="btn-primary">
          Next: Liabilities <ChevronRight size={15} />
        </button>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-brand-black-light border border-brand-gray-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-brand-gray-border sticky top-0 bg-brand-black-light z-10">
              <div>
                <h3 className="text-white font-semibold">
                  {editTarget && !editTarget.isSingle ? 'Edit Entry' : activeCat?.isSingle || modalCat === 'loans-given' ? 'Update' : 'Add Entry'}
                </h3>
                <p className="text-xs text-brand-gray mt-0.5">
                  {modalCat === 'loans-given' ? 'Loans Given & Amount Receivable' : activeCat?.label}
                </p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-brand-gray hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {(modalCat === 'loans-given' ? loansModalFields : activeCat?.fields || []).map(field => (
                <div key={field.key}>
                  <label className="block text-xs text-brand-gray mb-1.5 font-medium uppercase tracking-wider">
                    {field.label}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={formVals[field.key] ?? ''}
                      onChange={e => setFormVals(v => ({ ...v, [field.key]: e.target.value }))}
                      className="input-field w-full"
                    >
                      {field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : field.type === 'number' ? (
                    <NumberInput
                      value={formVals[field.key] ?? ''}
                      onChange={e => setFormVals(v => ({ ...v, [field.key]: e.target.value }))}
                      className="input-field w-full text-right font-mono"
                    />
                  ) : (
                    <input
                      type={field.type}
                      value={formVals[field.key] ?? ''}
                      onChange={e => setFormVals(v => ({ ...v, [field.key]: e.target.value }))}
                      className="input-field w-full"
                    />
                  )}
                </div>
              ))}
              {/* Preview computed closing balance for Loans Given */}
              {modalCat === 'loans-given' && (
                <div className="flex items-center justify-between px-3 py-2 bg-brand-black rounded-lg border border-brand-gray-border">
                  <span className="text-xs text-brand-gray">Balance as at 31.03.2026 (computed)</span>
                  <span className="text-sm font-mono text-brand-yellow font-semibold">
                    Rs. {fmtAmt(
                      parseFloat(formVals.opening_balance || 0) +
                      parseFloat(formVals.given_during_year || 0) -
                      parseFloat(formVals.cash_received_from_debtors || 0)
                    )}
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-brand-gray-border">
              <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                <Save size={14} /> {saving ? 'Saving…' : (editTarget && !editTarget.isSingle) ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
