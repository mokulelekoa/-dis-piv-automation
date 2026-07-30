'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, CircleDashed, Download, FileSignature,
  ShieldCheck, UserPlus,
} from 'lucide-react'
import { useHr, newId } from '@/lib/hr/store'
import { SYSTEM_LABELS, type Contract, type Employee, type SystemKey } from '@/lib/hr/types'
import { downloadFile } from '@/lib/hr/csv'
import { PACKETS_HREF } from '@/lib/hr/links'
import {
  employeeNavigatorCensusCsv, enFieldList, paycorFieldList, paycorImportCsv,
} from '@/lib/hr/exports'
import {
  btnGhost, btnNavy, btnPrimary, btnSecondary, Card, ContractChip, CopyButton, CopyField,
  Field, formatRate, inputCls, SlideOver,
} from '../ui'

export default function NewHiresPage() {
  const { state } = useHr()
  const [contractFilter, setContractFilter] = useState<string>('all')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const contractsById = useMemo(() => new Map(state.contracts.map(c => [c.id, c])), [state.contracts])
  const employees = state.employees.filter(e => contractFilter === 'all' || e.contractId === contractFilter)
  const pendingPaycor = state.employees.filter(e => !e.sync.paycor.done)
  const pendingEn = state.employees.filter(e => !e.sync.employeeNavigator.done)
  const detail = detailId ? state.employees.find(e => e.id === detailId) ?? null : null

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">New Hire Sync</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Enter every hire <span className="font-bold text-slate-700">once</span>. Push the same record to
            Paycor and Employee Navigator with guided entry panels or import files — no more double typing.
          </p>
        </div>
        <button type="button" className={btnPrimary} onClick={() => setAdding(true)}>
          <UserPlus size={16} /> Add new hire
        </button>
      </header>

      {/* Bulk export strip */}
      <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="text-sm text-slate-600">
          <span className="font-black text-slate-900">{pendingPaycor.length}</span> waiting on Paycor ·{' '}
          <span className="font-black text-slate-900">{pendingEn.length}</span> waiting on Employee Navigator
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={btnSecondary}
            disabled={pendingPaycor.length === 0}
            onClick={() => downloadFile('paycor-new-hires.csv', paycorImportCsv(pendingPaycor, state.contracts))}
          >
            <Download size={15} /> Paycor import ({pendingPaycor.length})
          </button>
          <button
            type="button"
            className={btnSecondary}
            disabled={pendingEn.length === 0}
            onClick={() => downloadFile('employee-navigator-census.csv', employeeNavigatorCensusCsv(pendingEn, state.contracts))}
          >
            <Download size={15} /> EN census ({pendingEn.length})
          </button>
        </div>
      </Card>

      {/* Contract filter */}
      <div className="mb-4 flex flex-wrap gap-2">
        <FilterChip active={contractFilter === 'all'} onClick={() => setContractFilter('all')} label="All contracts" />
        {state.contracts.map(c => (
          <FilterChip key={c.id} active={contractFilter === c.id} onClick={() => setContractFilter(c.id)}
            label={c.name} dotColor={c.color} />
        ))}
      </div>

      {/* Roster */}
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-widest text-slate-400">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Contract</th>
              <th className="px-4 py-3">Start</th>
              <th className="px-4 py-3">Rate</th>
              <th className="px-4 py-3">Paycor</th>
              <th className="px-4 py-3">Employee Navigator</th>
              <th className="px-4 py-3 text-right">Entry kit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map(e => {
              const c = contractsById.get(e.contractId)
              return (
                <tr key={e.id} className="cursor-pointer transition-colors hover:bg-blue-50/60" onClick={() => setDetailId(e.id)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Initials employee={e} color={c?.color} />
                      <div>
                        <div className="font-bold text-slate-900">{e.lastName}, {e.firstName}</div>
                        <div className="text-[11px] text-slate-400">{e.position}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><ContractChip contract={c} small /></td>
                  <td className="px-4 py-3 text-slate-600">{e.startDate}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{formatRate(e.payType, e.payRate)}</td>
                  <td className="px-4 py-3"><SyncChip done={e.sync.paycor.done} /></td>
                  <td className="px-4 py-3"><SyncChip done={e.sync.employeeNavigator.done} /></td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-500">
                      Open <ArrowRight size={13} />
                    </span>
                  </td>
                </tr>
              )
            })}
            {employees.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">No employees on this contract yet.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      {detail && (
        <EmployeeDetail employee={detail} contract={contractsById.get(detail.contractId)} onClose={() => setDetailId(null)} />
      )}
      {adding && <AddHireWizard onClose={() => setAdding(false)} onCreated={id => { setAdding(false); setDetailId(id) }} />}
    </div>
  )
}

function FilterChip({ active, onClick, label, dotColor }: {
  active: boolean; onClick: () => void; label: string; dotColor?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
        active ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-500 hover:border-blue-300'
      }`}
    >
      {dotColor && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dotColor }} />}
      {label}
    </button>
  )
}

function Initials({ employee, color }: { employee: Employee; color?: string }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
      style={{ backgroundColor: color ?? '#2d6d8e' }}
    >
      {employee.firstName[0]}{employee.lastName[0]}
    </span>
  )
}

function SyncChip({ done }: { done: boolean }) {
  return done ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
      <CheckCircle2 size={12} /> Entered
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
      <CircleDashed size={12} /> Waiting
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Employee detail: the "entry kit" for both systems                    */
/* ------------------------------------------------------------------ */

function EmployeeDetail({ employee: e, contract, onClose }: {
  employee: Employee; contract?: Contract; onClose: () => void
}) {
  const { state } = useHr()
  const isVa = (contract?.client ?? '').toLowerCase().includes('veterans health')

  return (
    <SlideOver open onClose={onClose} wide title={<span>{e.firstName} {e.lastName} <span className="ml-1 font-medium text-slate-400">· {e.position}</span></span>}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ContractChip contract={contract} />
        <span className="text-xs text-slate-400">Starts {e.startDate} · {formatRate(e.payType, e.payRate)} · {e.location}</span>
      </div>

      {/* Next steps for this hire */}
      <div className="mb-5 grid gap-2 sm:grid-cols-2">
        <Link href={`/hr/letters?kind=offer&emp=${e.id}`}
          className="group flex items-center gap-3 rounded-xl border border-accent-200 bg-accent-50 p-3 transition-colors hover:border-accent-400">
          <span className="rounded-lg bg-accent-500 p-2 text-white"><FileSignature size={15} /></span>
          <span>
            <span className="block text-sm font-bold text-slate-800">Generate offer letter</span>
            <span className="block text-[11px] text-slate-500">Letter Studio, pre-filled from this record</span>
          </span>
          <ArrowRight size={15} className="ml-auto text-accent-400 transition-transform group-hover:translate-x-0.5" />
        </Link>
        {isVa && (
          <Link href={PACKETS_HREF}
            className="group flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 transition-colors hover:border-blue-400">
            <span className="rounded-lg bg-dis-navy p-2 text-white"><ShieldCheck size={15} /></span>
            <span>
              <span className="block text-sm font-bold text-slate-800">Start security packet</span>
              <span className="block text-[11px] text-slate-500">VA PIV paperwork in the Candidate Packets app</span>
            </span>
            <ArrowRight size={15} className="ml-auto text-blue-400 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SystemPanel
          system="paycor"
          employee={e}
          fields={paycorFieldList(e, contract)}
          onDownload={() => downloadFile(`paycor-${e.lastName.toLowerCase()}-${e.firstName.toLowerCase()}.csv`, paycorImportCsv([e], state.contracts))}
          downloadLabel="Paycor import CSV"
        />
        <SystemPanel
          system="employeeNavigator"
          employee={e}
          fields={enFieldList(e, contract)}
          onDownload={() => downloadFile(`en-census-${e.lastName.toLowerCase()}-${e.firstName.toLowerCase()}.csv`, employeeNavigatorCensusCsv([e], state.contracts))}
          downloadLabel="EN census CSV"
        />
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
        Every field appears in the order the target system asks for it — copy down the list, or hand the
        CSV to the system&rsquo;s import. Marking a system &ldquo;entered&rdquo; keeps the roster honest about
        who still needs keying. A direct API sync is the end-state; this kills the re-typing today.
      </p>
    </SlideOver>
  )
}

function SystemPanel({ system, employee: e, fields, onDownload, downloadLabel }: {
  system: SystemKey
  employee: Employee
  fields: { label: string; value: string }[]
  onDownload: () => void
  downloadLabel: string
}) {
  const { setSync } = useHr()
  const status = e.sync[system]
  const allText = fields.map(f => `${f.label}: ${f.value}`).join('\n')

  return (
    <div className={`rounded-2xl border ${status.done ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <div className="text-sm font-black text-slate-900">{SYSTEM_LABELS[system]}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {status.done ? 'Entered ✓' : 'Needs entry'}
          </div>
        </div>
        <CopyButton text={allText} label="Copy all" />
      </div>
      <div className="max-h-64 overflow-y-auto p-2">
        {fields.map(f => <CopyField key={f.label} label={f.label} value={f.value} />)}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
        <button type="button" className={`${btnGhost} !px-2 text-xs`} onClick={onDownload}>
          <Download size={13} /> {downloadLabel}
        </button>
        <button
          type="button"
          onClick={() => setSync(e.id, system, !status.done)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
            status.done
              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              : 'bg-blue-600 text-white hover:bg-blue-500'
          }`}
        >
          {status.done ? <><Check size={13} /> Entered</> : 'Mark entered'}
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Add-hire wizard: one entry, both systems                            */
/* ------------------------------------------------------------------ */

const EMPTY_DRAFT = {
  firstName: '', lastName: '', email: '', phone: '', address1: '', city: '', state: '', zip: '',
  dob: '', ssnLast4: '', contractId: '', position: '', department: '', location: '',
  employmentType: 'Full-time', startDate: '', manager: '', shift: '', paycorId: '',
}

function AddHireWizard({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { state, addEmployee } = useHr()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<Record<string, string>>(EMPTY_DRAFT)

  const set = (key: string, value: string) => setDraft(d => ({ ...d, [key]: value }))
  const contract = state.contracts.find(c => c.id === draft.contractId)
  const positionMeta = contract?.positions.find(p => p.title === draft.position)

  const nextPaycorId = useMemo(() => {
    const max = Math.max(0, ...state.employees.map(e => Number(e.paycorId) || 0))
    return String(max + 1)
  }, [state.employees])

  const stepOneOk = draft.firstName.trim() !== '' && draft.lastName.trim() !== ''
  const stepTwoOk = !!contract && !!positionMeta && draft.startDate.trim() !== ''

  const create = () => {
    if (!contract || !positionMeta) return
    const id = newId('emp')
    const employee: Employee = {
      id,
      firstName: draft.firstName.trim(), lastName: draft.lastName.trim(),
      email: draft.email.trim(), phone: draft.phone.trim(),
      address1: draft.address1.trim(), city: draft.city.trim(), state: draft.state.trim(), zip: draft.zip.trim(),
      dob: draft.dob.trim(), ssnLast4: draft.ssnLast4.trim(),
      contractId: contract.id, position: positionMeta.title,
      department: draft.department.trim() || contract.name,
      location: draft.location.trim() || contract.location,
      employmentType: (draft.employmentType as Employee['employmentType']) || 'Full-time',
      flsa: positionMeta.flsa, payType: positionMeta.payType,
      payRate: Number(draft.payRate) > 0 ? Number(draft.payRate) : positionMeta.defaultRate,
      startDate: draft.startDate.trim(),
      manager: draft.manager.trim(), shift: draft.shift.trim(),
      benefitsClass: 'FT Standard (1st of month after 30 days)',
      paycorId: draft.paycorId.trim() || nextPaycorId,
      sync: { paycor: { done: false }, employeeNavigator: { done: false } },
      createdAt: new Date().toISOString(),
    }
    addEmployee(employee)
    onCreated(id)
  }

  const steps = ['Person', 'Job & pay', 'Review']

  return (
    <SlideOver open onClose={onClose} title="Add new hire — enter once">
      {/* Step indicator */}
      <ol className="mb-6 flex items-center gap-2">
        {steps.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${
              i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
            }`}>
              {i < step ? <Check size={12} /> : i + 1}
            </span>
            <span className={`text-xs font-bold ${i === step ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>
            {i < steps.length - 1 && <span className="h-px w-6 bg-slate-200" />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name"><input className={inputCls} value={draft.firstName} onChange={e => set('firstName', e.target.value)} placeholder="Priya" /></Field>
          <Field label="Last name"><input className={inputCls} value={draft.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Shah" /></Field>
          <div className="col-span-2"><Field label="Email"><input className={inputCls} type="email" value={draft.email} onChange={e => set('email', e.target.value)} placeholder="name@email.com" /></Field></div>
          <Field label="Phone"><input className={inputCls} value={draft.phone} onChange={e => set('phone', e.target.value)} placeholder="(520) 555-0100" /></Field>
          <Field label="Birth date"><input className={inputCls} value={draft.dob} onChange={e => set('dob', e.target.value)} placeholder="MM/DD/YYYY" /></Field>
          <div className="col-span-2"><Field label="Street address"><input className={inputCls} value={draft.address1} onChange={e => set('address1', e.target.value)} placeholder="123 Main St" /></Field></div>
          <Field label="City"><input className={inputCls} value={draft.city} onChange={e => set('city', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="State"><input className={inputCls} value={draft.state} onChange={e => set('state', e.target.value)} placeholder="AZ" /></Field>
            <Field label="ZIP"><input className={inputCls} value={draft.zip} onChange={e => set('zip', e.target.value)} /></Field>
          </div>
          <Field label="SSN — last 4 only" hint="Full SSN stays out of this tool on purpose.">
            <input className={inputCls} value={draft.ssnLast4} onChange={e => set('ssnLast4', e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="1234" />
          </Field>
        </div>
      )}

      {step === 1 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label="Contract" hint="Sets the position list, default rate, and worksite.">
              <select className={inputCls} value={draft.contractId} onChange={e => { set('contractId', e.target.value); set('position', '') }}>
                <option value="">Select a contract…</option>
                {state.contracts.map(c => <option key={c.id} value={c.id}>{c.name} · {c.code}</option>)}
              </select>
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Position">
              <select className={inputCls} value={draft.position} onChange={e => set('position', e.target.value)} disabled={!contract}>
                <option value="">{contract ? 'Select a position…' : 'Pick a contract first'}</option>
                {contract?.positions.map(p => (
                  <option key={p.title} value={p.title}>
                    {p.title} — {p.payType === 'Hourly' ? `$${p.defaultRate.toFixed(2)}/hr` : `$${p.defaultRate.toLocaleString()}/yr`}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={`Pay rate${positionMeta ? ` (default ${positionMeta.payType === 'Hourly' ? `$${positionMeta.defaultRate.toFixed(2)}/hr` : `$${positionMeta.defaultRate.toLocaleString()}/yr`})` : ''}`}>
            <input className={inputCls} value={draft.payRate ?? ''} onChange={e => set('payRate', e.target.value)} placeholder={positionMeta ? String(positionMeta.defaultRate) : '0.00'} />
          </Field>
          <Field label="Start date"><input className={inputCls} value={draft.startDate} onChange={e => set('startDate', e.target.value)} placeholder="MM/DD/YYYY" /></Field>
          <Field label="Employment type">
            <select className={inputCls} value={draft.employmentType} onChange={e => set('employmentType', e.target.value)}>
              <option>Full-time</option><option>Part-time</option><option>PRN</option>
            </select>
          </Field>
          <Field label="Shift / schedule"><input className={inputCls} value={draft.shift} onChange={e => set('shift', e.target.value)} placeholder="Day (6:00a–2:30p)" /></Field>
          <Field label="Manager"><input className={inputCls} value={draft.manager} onChange={e => set('manager', e.target.value)} placeholder="D. Whitfield" /></Field>
          <Field label="Worksite" hint={contract ? `Defaults to ${contract.location}` : undefined}>
            <input className={inputCls} value={draft.location} onChange={e => set('location', e.target.value)} placeholder={contract?.location ?? 'City, ST'} />
          </Field>
          <Field label="Paycor employee #" hint={`Next available: ${nextPaycorId}`}>
            <input className={inputCls} value={draft.paycorId} onChange={e => set('paycorId', e.target.value)} placeholder={nextPaycorId} />
          </Field>
        </div>
      )}

      {step === 2 && contract && positionMeta && (
        <div>
          <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700">
            <div className="text-base font-black text-slate-900">{draft.firstName} {draft.lastName}</div>
            <div className="mt-0.5">{positionMeta.title} · {contract.name}</div>
            <div className="mt-0.5 text-slate-500">
              Starts {draft.startDate} · {positionMeta.payType === 'Hourly'
                ? `$${(Number(draft.payRate) > 0 ? Number(draft.payRate) : positionMeta.defaultRate).toFixed(2)}/hr`
                : `$${(Number(draft.payRate) > 0 ? Number(draft.payRate) : positionMeta.defaultRate).toLocaleString()}/yr`} · {draft.employmentType}
            </div>
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            Creating this record unlocks the <span className="font-bold">entry kit</span> for both systems —
            ordered copy panels, import CSVs, and sync tracking — plus a pre-filled offer letter in Letter Studio.
          </p>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <button type="button" className={btnGhost} onClick={step === 0 ? onClose : () => setStep(s => s - 1)}>
          {step === 0 ? 'Cancel' : <><ArrowLeft size={15} /> Back</>}
        </button>
        {step < 2 ? (
          <button type="button" className={btnNavy} disabled={step === 0 ? !stepOneOk : !stepTwoOk} onClick={() => setStep(s => s + 1)}>
            Continue <ArrowRight size={15} />
          </button>
        ) : (
          <button type="button" className={btnPrimary} onClick={create}>
            <UserPlus size={15} /> Create hire record
          </button>
        )}
      </div>
    </SlideOver>
  )
}
