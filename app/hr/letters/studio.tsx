'use client'

import { useMemo, useState } from 'react'
import {
  ClipboardCopy, ClipboardPaste, Download, FileSignature, FileText, Printer, TrendingUp, Wand2,
} from 'lucide-react'
import { useHr, newId } from '@/lib/hr/store'
import type { Employee, LetterKind, LetterRecord } from '@/lib/hr/types'
import { downloadFile, parseDelimited } from '@/lib/hr/csv'
import {
  buildLetter, fieldsFor, letterToText, letterToWordHtml, lettersToWordHtml, type LetterDoc,
} from '@/lib/hr/letters'
import { btnPrimary, btnSecondary, Card, Field, inputCls, timeAgoShort } from '../ui'

const EXAMPLE_BATCH = `Name\tPosition\tContract\tCurrent\tNew\tEffective\tReason
Jordan Kim\tPharmacy Technician\tVA CMOP — Tucson\t21.50\t22.75\t09/01/2026\tAnnual review
Marisol Ruiz\tShipper/Packer\tVA CMOP — Tucson\t17.25\t18.10\t09/01/2026\tAnnual review
Tessa Nguyen\tRecords Technician\tVBA Records Management\t18.40\t19.30\t09/01/2026\tMerit increase`

export default function LetterStudio({ initialKind, prefillEmployeeId }: {
  initialKind: LetterKind
  prefillEmployeeId?: string
}) {
  const { state, ready, addLetters } = useHr()
  const [kind, setKind] = useState<LetterKind>(initialKind)
  const [mode, setMode] = useState<'single' | 'batch'>('single')
  const [data, setData] = useState<Record<string, string>>({ payUnit: 'per hour', signerTitle: 'HR Manager, DIS Consulting' })
  const [batchText, setBatchText] = useState('')
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null)

  // Prefill from a roster record when arriving via /hr/letters?kind=…&emp=… —
  // render-phase state adjustment (may fire after the store hydrates).
  if (ready && prefillEmployeeId && prefilledFor !== prefillEmployeeId) {
    const emp = state.employees.find(e => e.id === prefillEmployeeId)
    if (emp) {
      setPrefilledFor(prefillEmployeeId)
      setData(d => ({ ...d, ...prefillFromEmployee(emp, kind, state.contracts.find(c => c.id === emp.contractId)?.name ?? '') }))
    }
  }

  const fields = fieldsFor(kind)
  const set = (key: string, value: string) => setData(d => ({ ...d, [key]: value }))
  const doc = useMemo(() => buildLetter(kind, data), [kind, data])

  // Batch rows → letter docs
  const batch = useMemo(() => parseBatch(batchText, kind, data), [batchText, kind, data])
  const docsToPrint: LetterDoc[] = mode === 'batch' ? batch.docs : [doc]

  const recordHistory = (docs: LetterDoc[]) => {
    const records: LetterRecord[] = docs.map(d => ({
      id: newId('ltr'),
      kind,
      recipientName: d.recipientName,
      position: data.position ?? '',
      contractName: data.contractName ?? '',
      createdAt: new Date().toISOString(),
    }))
    const what = kind === 'offer' ? 'offer letter' : 'salary increase letter'
    addLetters(records, docs.length === 1
      ? `${capitalize(what)} generated for ${docs[0].recipientName}.`
      : `${docs.length} ${what}s generated in one batch.`)
  }

  const printDocs = (docs: LetterDoc[]) => {
    recordHistory(docs)
    // Give React a beat to render the print area before opening the dialog.
    setTimeout(() => window.print(), 60)
  }

  const downloadWord = (docs: LetterDoc[]) => {
    recordHistory(docs)
    const html = docs.length === 1 ? letterToWordHtml(docs[0], true) : lettersToWordHtml(docs, true)
    const name = docs.length === 1
      ? `${kind === 'offer' ? 'Offer' : 'Increase'} - ${docs[0].recipientName}.doc`
      : `${kind === 'offer' ? 'Offer letters' : 'Increase letters'} (${docs.length}).doc`
    downloadFile(name, html, 'application/msword')
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Letter Studio</h1>
        <p className="mt-1 max-w-xl text-sm text-slate-500">
          Offer letters and salary increase letters in seconds — fill the short form, or paste a
          whole spreadsheet and generate the batch at once. No more mail merge.
        </p>
      </header>

      {/* Template + mode pickers */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <TemplateTab active={kind === 'offer'} onClick={() => setKind('offer')}
            icon={<FileSignature size={15} />} label="Offer letter" />
          <TemplateTab active={kind === 'increase'} onClick={() => setKind('increase')}
            icon={<TrendingUp size={15} />} label="Salary increase" />
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-white p-1">
          <ModeTab active={mode === 'single'} onClick={() => setMode('single')} label="Single" />
          <ModeTab active={mode === 'batch'} onClick={() => setMode('batch')} label="Batch from spreadsheet" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: inputs */}
        <div className="space-y-4 lg:col-span-2">
          {mode === 'single' ? (
            <Card className="p-5">
              <PrefillPicker employees={state.employees} kind={kind} onPick={(emp) => {
                const cName = state.contracts.find(c => c.id === emp.contractId)?.name ?? ''
                setData(d => ({ ...d, ...prefillFromEmployee(emp, kind, cName) }))
              }} />
              <div className="mt-4 grid grid-cols-2 gap-3">
                {fields.map(f => (
                  <div key={f.key} className={f.type === 'multiline' || f.key.endsWith('Name') || f.key === 'worksite' || f.key === 'shift' ? 'col-span-2' : ''}>
                    <Field label={f.label}>
                      {f.type === 'select' ? (
                        <select className={inputCls} value={data[f.key] ?? f.options?.[0] ?? ''} onChange={e => set(f.key, e.target.value)}>
                          {f.options?.map(o => <option key={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input className={inputCls} value={data[f.key] ?? ''} placeholder={f.placeholder}
                          onChange={e => set(f.key, e.target.value)} />
                      )}
                    </Field>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card className="p-5">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-black text-slate-900">Paste rows from Excel</div>
                <button type="button" className="inline-flex items-center gap-1 text-xs font-bold text-blue-500 hover:text-blue-600"
                  onClick={() => setBatchText(EXAMPLE_BATCH)}>
                  <ClipboardPaste size={13} /> Load example
                </button>
              </div>
              <p className="mb-3 text-xs leading-relaxed text-slate-400">
                Copy the columns straight from your spreadsheet — header row included. Recognized headers:{' '}
                {fields.filter(f => f.aliases?.length).map(f => f.label.toLowerCase()).slice(0, 6).join(', ')}…
                Anything missing falls back to the single-form values (signer, pay basis, etc.).
              </p>
              <textarea
                className={`${inputCls} min-h-44 font-mono text-xs`}
                value={batchText}
                onChange={e => setBatchText(e.target.value)}
                placeholder={'Name\tCurrent\tNew\tEffective\n…'}
              />
              {batchText.trim() !== '' && (
                <div className={`mt-3 rounded-xl border p-3 text-xs font-bold ${batch.docs.length > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                  {batch.docs.length > 0
                    ? `${batch.docs.length} letter${batch.docs.length > 1 ? 's' : ''} ready — ${batch.docs.map(d => d.recipientName.split(' ')[0]).slice(0, 5).join(', ')}${batch.docs.length > 5 ? '…' : ''}`
                    : batch.problem ?? 'No usable rows yet.'}
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Field label="Signer name">
                  <input className={inputCls} value={data.signerName ?? ''} onChange={e => set('signerName', e.target.value)} placeholder="Jordan Ellis" />
                </Field>
                <Field label="Signer title">
                  <input className={inputCls} value={data.signerTitle ?? ''} onChange={e => set('signerTitle', e.target.value)} />
                </Field>
              </div>
            </Card>
          )}

          {/* Actions */}
          <Card className="flex flex-wrap gap-2 p-4">
            <button type="button" className={btnPrimary} disabled={docsToPrint.length === 0}
              onClick={() => printDocs(docsToPrint)}>
              <Printer size={15} /> Print / Save PDF{mode === 'batch' && batch.docs.length > 1 ? ` (${batch.docs.length})` : ''}
            </button>
            <button type="button" className={btnSecondary} disabled={docsToPrint.length === 0}
              onClick={() => downloadWord(docsToPrint)}>
              <Download size={15} /> Word (.doc)
            </button>
            {mode === 'single' && (
              <button type="button" className={btnSecondary}
                onClick={async () => {
                  try { await navigator.clipboard.writeText(letterToText(doc)) } catch { /* unavailable */ }
                }}>
                <ClipboardCopy size={15} /> Copy text
              </button>
            )}
          </Card>

          {/* History */}
          {state.letters.length > 0 && (
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                <FileText size={13} /> Recent letters
              </div>
              <ul className="space-y-2">
                {state.letters.slice(0, 6).map(l => (
                  <li key={l.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate">
                      <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-black ${l.kind === 'offer' ? 'bg-accent-50 text-accent-600' : 'bg-blue-50 text-blue-500'}`}>
                        {l.kind === 'offer' ? 'OFFER' : 'INCREASE'}
                      </span>
                      <span className="font-bold text-slate-700">{l.recipientName}</span>
                      {l.position && <span className="text-slate-400"> · {l.position}</span>}
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-400">{timeAgoShort(l.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* Right: live preview */}
        <div className="lg:col-span-3">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
            <Wand2 size={13} /> Live preview {mode === 'batch' && batch.docs.length > 1 && `— first of ${batch.docs.length}`}
          </div>
          <LetterPaper doc={mode === 'batch' && batch.docs.length > 0 ? batch.docs[0] : doc} />
        </div>
      </div>

      {/* Print-only area: exactly the letters being generated, one per page. */}
      <div className="letter-print-area hidden print:block">
        {docsToPrint.map((d, i) => (
          <div key={i} className="letter-print-page"><LetterPaper doc={d} bare /></div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function TemplateTab({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string
}) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all ${
        active ? 'border-accent-500 bg-accent-50 text-accent-700 shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
      }`}>
      {icon} {label}
    </button>
  )
}

function ModeTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
        active ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-800'
      }`}>
      {label}
    </button>
  )
}

function PrefillPicker({ employees, kind, onPick }: {
  employees: Employee[]; kind: LetterKind; onPick: (e: Employee) => void
}) {
  return (
    <Field label={kind === 'offer' ? 'Prefill from a roster record (optional)' : 'Prefill from an employee (optional)'}>
      <select className={inputCls} value="" onChange={e => {
        const emp = employees.find(x => x.id === e.target.value)
        if (emp) onPick(emp)
      }}>
        <option value="">Choose an employee…</option>
        {employees.map(e => <option key={e.id} value={e.id}>{e.lastName}, {e.firstName} — {e.position}</option>)}
      </select>
    </Field>
  )
}

/** The on-screen letter: real letterhead look, updates as you type. */
function LetterPaper({ doc, bare = false }: { doc: LetterDoc; bare?: boolean }) {
  return (
    <div className={bare ? 'bg-white p-10 text-[13px] leading-relaxed text-slate-800' : 'sticky top-6 rounded-2xl border border-slate-200 bg-white p-8 text-[13px] leading-relaxed text-slate-800 shadow-lg sm:p-10'}>
      <div className="mb-8 border-b-2 border-accent-500 pb-3">
        <div className="text-lg font-black tracking-tight text-blue-600">DIS Consulting</div>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Human Resources</div>
      </div>
      <p>{doc.date}</p>
      <p className="mt-4 font-semibold">{doc.recipientName}</p>
      <p className="mt-4 font-bold">RE: {doc.subject}</p>
      {doc.paragraphs.map((p, i) => <p key={i} className="mt-4">{p}</p>)}
      <p className="mt-6">Sincerely,</p>
      <div className="mt-10">
        <p className="font-semibold">{doc.closing.signerName || '________________'}</p>
        <p className="text-slate-500">{doc.closing.signerTitle}</p>
      </div>
      <div className="mt-10 border-t border-slate-100 pt-6 text-slate-600">
        <p>Accepted and agreed:</p>
        <p className="mt-6">Signature: ____________________________&nbsp;&nbsp;&nbsp;&nbsp;Date: ______________</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function prefillFromEmployee(emp: Employee, kind: LetterKind, contractName: string): Record<string, string> {
  const payUnit = emp.payType === 'Hourly' ? 'per hour' : 'per year'
  if (kind === 'offer') {
    return {
      candidateName: `${emp.firstName} ${emp.lastName}`,
      position: emp.position,
      payRate: String(emp.payRate),
      payUnit,
      startDate: emp.startDate,
      shift: emp.shift,
      employmentType: emp.employmentType,
      worksite: emp.location,
      contractName,
      responseBy: shiftDate(emp.startDate, -7),
    }
  }
  return {
    employeeName: `${emp.firstName} ${emp.lastName}`,
    position: emp.position,
    contractName,
    currentRate: String(emp.payRate),
    payUnit,
    reason: 'Merit increase',
  }
}

function shiftDate(mdY: string, days: number): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(mdY.trim())
  if (!m) return ''
  const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]))
  d.setDate(d.getDate() + days)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()}`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Parse pasted spreadsheet rows into letter docs, using header aliases. */
function parseBatch(text: string, kind: LetterKind, defaults: Record<string, string>): {
  docs: LetterDoc[]; problem?: string
} {
  if (text.trim() === '') return { docs: [] }
  const grid = parseDelimited(text)
  if (grid.length < 2) return { docs: [], problem: 'Need a header row plus at least one data row.' }

  const fields = fieldsFor(kind)
  const header = grid[0].map(h => h.trim().toLowerCase())
  const colFor = new Map<number, string>()
  header.forEach((h, i) => {
    const field = fields.find(f => f.label.toLowerCase() === h || f.key.toLowerCase() === h || f.aliases?.includes(h))
    if (field) colFor.set(i, field.key)
  })
  if (colFor.size === 0) return { docs: [], problem: 'No recognizable columns — include headers like Name, Current, New, Effective.' }

  const nameKey = kind === 'offer' ? 'candidateName' : 'employeeName'
  const docs: LetterDoc[] = []
  for (const row of grid.slice(1)) {
    const data: Record<string, string> = { ...defaults }
    colFor.forEach((key, i) => { if ((row[i] ?? '').trim() !== '') data[key] = row[i].trim() })
    if ((data[nameKey] ?? '').trim() === '') continue
    docs.push(buildLetter(kind, data))
  }
  return docs.length > 0 ? { docs } : { docs: [], problem: 'Rows parsed, but none had a name value.' }
}
