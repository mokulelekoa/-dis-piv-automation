'use client'

import { useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowRight, Check, CheckCircle2, CopyX, Download, FileUp, Link2, RotateCcw,
  Scale, SplitSquareHorizontal, Trash2, Upload, Wand2,
} from 'lucide-react'
import { useHr } from '@/lib/hr/store'
import type { PayrollIssue, UnanetRow } from '@/lib/hr/types'
import { downloadFile, toCsv } from '@/lib/hr/csv'
import { PAYCOR_EARN_CODES, SAMPLE_REPORT_TOTAL, SAMPLE_UNANET_CSV } from '@/lib/hr/data'
import {
  analyzeRows, fixDuplicates, fixNegatives, fixOvertime, parseUnanetExport, payPeriodEnd,
  sumHours, toPaycorLines,
} from '@/lib/hr/payroll'
import { btnPrimary, btnSecondary, Card, Field, inputCls } from '../ui'

export default function PayrollBridgePage() {
  const { state, setPayCodeMapping, setEmployeeRefMapping, recordPayrollBalanced } = useHr()
  const [rows, setRows] = useState<UnanetRow[] | null>(null)
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [reportTotal, setReportTotal] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [fixLog, setFixLog] = useState<string[]>([])
  const [confirmFixAll, setConfirmFixAll] = useState(false)
  const recordedRef = useRef(false)

  const issues = useMemo(
    () => (rows ? analyzeRows(rows, state.employeeRefMap, state.payCodeMap) : []),
    [rows, state.employeeRefMap, state.payCodeMap],
  )
  const exportTotal = rows ? sumHours(rows) : 0
  const reportNum = Number(reportTotal)
  const balanced = rows !== null && issues.length === 0 && isFinite(reportNum) && reportNum > 0 && Math.abs(exportTotal - reportNum) < 0.01
  const step = rows === null ? 0 : issues.length > 0 ? 1 : 2

  const loadText = (text: string) => {
    const parsed = parseUnanetExport(text)
    setParseErrors(parsed.errors)
    if (parsed.rows.length > 0) {
      setRows(parsed.rows)
      setFixLog([])
      setConfirmFixAll(false)
      recordedRef.current = false
    }
  }

  const applyFix = (label: string, fn: (r: UnanetRow[]) => UnanetRow[]) => {
    setRows(r => (r ? fn(r) : r))
    setFixLog(log => [...log, label])
  }

  const fixAllAutomatic = () => {
    setRows(r => (r ? fixOvertime(fixNegatives(fixDuplicates(r)), state.payCodeMap) : r))
    setFixLog(log => [...log, 'Removed duplicates', 'Excluded negative lines', 'Split overtime'])
    setConfirmFixAll(false)
  }

  /**
   * Exactly what "fix everything" would change, so the confirmation step can
   * spell it out rather than asking for blind agreement. Employee links and pay
   * code mappings are excluded on purpose — those need a human decision.
   */
  const autoFixPlan = (() => {
    const dupLines = issues
      .filter(i => i.kind === 'duplicate')
      .reduce((n, i) => n + i.lines.length - 1, 0)
    const negLines = issues.find(i => i.kind === 'negativeHours')?.lines.length ?? 0
    const otWeeks = issues.filter(i => i.kind === 'otNotSplit').length
    const manual = issues.filter(i => i.kind === 'unknownEmployee' || i.kind === 'unmappedCode').length
    return { dupLines, negLines, otWeeks, manual, total: dupLines + negLines + otWeeks }
  })()

  const paycorLines = rows && issues.length === 0 ? toPaycorLines(rows, state.employeeRefMap, state.payCodeMap, state.employees) : []

  const downloadPaycor = () => {
    if (!rows) return
    const end = payPeriodEnd(rows)
    const csv = toCsv([
      ['Employee Number', 'Employee Name', 'Earnings Code', 'Hours', 'Pay Period End'],
      ...paycorLines.map(l => [l.paycorId, l.employeeName, l.earnCode, l.hours.toFixed(2), end]),
    ])
    downloadFile(`paycor-import-${end.replace(/\//g, '-') || 'run'}.csv`, csv)
    if (!recordedRef.current) {
      recordedRef.current = true
      recordPayrollBalanced(`Payroll run exported to Paycor: ${paycorLines.length} lines, ${exportTotal.toFixed(2)} h${balanced ? ', balanced to the Unanet report' : ''}.`)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Payroll Bridge</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Drop in the Unanet export. Every problem you normally fix by hand gets flagged with a
          one-click fix — then download hours that import into Paycor cleanly the first time.
        </p>
      </header>

      {/* Stepper */}
      <ol className="mb-6 flex flex-wrap items-center gap-2">
        {['Import Unanet export', 'Review & fix', 'Export to Paycor'].map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
              i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'
            }`}>
              {i < step ? <Check size={14} /> : i + 1}
            </span>
            <span className={`text-sm font-bold ${i === step ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>
            {i < 2 && <ArrowRight size={14} className="text-slate-300" />}
          </li>
        ))}
        {rows && (
          <button type="button" onClick={() => { setRows(null); setPasteText(''); setFixLog([]); setParseErrors([]); setConfirmFixAll(false) }}
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-700">
            <RotateCcw size={13} /> Start over
          </button>
        )}
      </ol>

      {/* STEP 1: import */}
      {rows === null && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-6">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900"><Upload size={16} /> Bring in the export</div>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Paste the CSV straight from Unanet (or upload the file). Expected columns: Person, Name,
              Date, Project, Pay Code, Hours — extra columns are ignored.
            </p>
            <textarea
              className={`${inputCls} mt-3 min-h-40 font-mono text-xs`}
              placeholder={'Person,Name,Date,Project,Pay Code,Hours\njkim,"Kim, Jordan",07/20/2026,CMOP-766-OPS,Regular Time,8.00\n…'}
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={btnPrimary} disabled={pasteText.trim() === ''} onClick={() => loadText(pasteText)}>
                <FileUp size={15} /> Parse export
              </button>
              <label className={`${btnSecondary} cursor-pointer`}>
                <Upload size={15} /> Upload .csv
                <input type="file" accept=".csv,.txt,.tsv" className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    file.text().then(loadText)
                  }} />
              </label>
            </div>
            {parseErrors.length > 0 && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                {parseErrors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
          </Card>

          <Card className="flex flex-col justify-between border-dashed p-6">
            <div>
              <div className="flex items-center gap-2 text-sm font-black text-slate-900"><Wand2 size={16} /> Just exploring?</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Load a realistic sample export for the 07/20–07/26 week across three contracts. It contains
                the classics: a duplicated day, 44 regular hours that were never split into overtime, an
                employee ID payroll doesn&rsquo;t recognize, an unmapped pay code, and a stray negative line —
                and its total doesn&rsquo;t match Unanet&rsquo;s own report.
              </p>
            </div>
            <button type="button" className={`${btnSecondary} mt-4 self-start`}
              onClick={() => { setReportTotal(String(SAMPLE_REPORT_TOTAL)); loadText(SAMPLE_UNANET_CSV) }}>
              <Wand2 size={15} /> Load sample export
            </button>
          </Card>
        </div>
      )}

      {/* STEP 2+3 shared: reconciliation bar */}
      {rows !== null && (
        <>
          <Card className="mb-4 flex flex-wrap items-center gap-x-8 gap-y-3 p-4">
            <Metric label="Lines" value={String(rows.length)} />
            <Metric label="Export total" value={`${exportTotal.toFixed(2)} h`} />
            <div className="flex items-end gap-2">
              <Field label="Unanet report says">
                <input className={`${inputCls} w-28`} value={reportTotal} onChange={e => setReportTotal(e.target.value)} placeholder="e.g. 206" />
              </Field>
              {reportTotal.trim() !== '' && isFinite(reportNum) && (
                Math.abs(exportTotal - reportNum) < 0.01 ? (
                  <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">
                    <Scale size={12} /> Matches report
                  </span>
                ) : (
                  <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-black text-rose-600">
                    <Scale size={12} /> Off by {(exportTotal - reportNum).toFixed(2)} h
                  </span>
                )
              )}
            </div>
            <div className="ml-auto text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Issues open</div>
              <div className={`text-2xl font-black ${issues.length === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{issues.length}</div>
            </div>
          </Card>

          {issues.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Found in this export</h2>
                {!confirmFixAll && (
                  <button type="button" className={btnPrimary}
                    disabled={autoFixPlan.total === 0}
                    onClick={() => setConfirmFixAll(true)}>
                    <Wand2 size={15} /> Fix everything automatic
                  </button>
                )}
              </div>

              {/* Step two: say exactly what will change before changing it. */}
              {confirmFixAll && (
                <div className="mt-3 rounded-2xl border-2 border-accent-300 bg-accent-50 p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 shrink-0 rounded-lg bg-accent-500 p-1.5 text-white">
                      <AlertTriangle size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-black text-slate-900">
                        Apply {autoFixPlan.total} automatic change{autoFixPlan.total === 1 ? '' : 's'} to this export?
                      </div>
                      <ul className="mt-2 space-y-1 text-xs text-slate-700">
                        {autoFixPlan.dupLines > 0 && (
                          <li>
                            <span className="font-bold">Remove {autoFixPlan.dupLines} duplicate line{autoFixPlan.dupLines === 1 ? '' : 's'}</span>
                            {' '}&mdash; keeps the first of each repeated entry.
                          </li>
                        )}
                        {autoFixPlan.negLines > 0 && (
                          <li>
                            <span className="font-bold">Exclude {autoFixPlan.negLines} negative line{autoFixPlan.negLines === 1 ? '' : 's'}</span>
                            {' '}&mdash; these must be corrected in Unanet; they will not reach Paycor.
                          </li>
                        )}
                        {autoFixPlan.otWeeks > 0 && (
                          <li>
                            <span className="font-bold">Split overtime for {autoFixPlan.otWeeks} week{autoFixPlan.otWeeks === 1 ? '' : 's'}</span>
                            {' '}&mdash; 40 h stays regular, the remainder moves to OT.
                          </li>
                        )}
                      </ul>
                      <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
                        Nothing is written to Unanet or Paycor &mdash; this only changes the hours staged here.
                        {autoFixPlan.manual > 0 && (
                          <> {autoFixPlan.manual} issue{autoFixPlan.manual === 1 ? '' : 's'} need your decision and
                          {' '}will be left alone.</>
                        )}
                        {' '}To undo, use <span className="font-semibold">Start over</span> and re-import.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" className={btnPrimary} onClick={fixAllAutomatic}>
                          <Check size={15} /> Yes, apply {autoFixPlan.total} change{autoFixPlan.total === 1 ? '' : 's'}
                        </button>
                        <button type="button" className={btnSecondary} onClick={() => setConfirmFixAll(false)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Issue cards */}
          <div className="space-y-3">
            {issues.map(issue => (
              <IssueCard key={issue.id} issue={issue}>
                {issue.kind === 'duplicate' && (
                  <button type="button" className={btnSecondary} onClick={() => applyFix('Removed duplicate lines', fixDuplicates)}>
                    <CopyX size={15} /> Remove duplicates
                  </button>
                )}
                {issue.kind === 'negativeHours' && (
                  <button type="button" className={btnSecondary} onClick={() => applyFix('Excluded negative lines', fixNegatives)}>
                    <Trash2 size={15} /> Exclude from import
                  </button>
                )}
                {issue.kind === 'otNotSplit' && (
                  <button type="button" className={btnSecondary} onClick={() => applyFix('Split overtime', r => fixOvertime(r, state.payCodeMap))}>
                    <SplitSquareHorizontal size={15} /> Split into 40 REG + OT
                  </button>
                )}
                {issue.kind === 'unmappedCode' && (
                  <MapCodeAction issue={issue} onMap={setPayCodeMapping} />
                )}
                {issue.kind === 'unknownEmployee' && (
                  <LinkEmployeeAction issue={issue} onLink={setEmployeeRefMapping} />
                )}
              </IssueCard>
            ))}
          </div>

          {/* STEP 3: clean → export */}
          {issues.length === 0 && (
            <div className="space-y-4">
              <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-5 ${balanced ? 'border-emerald-200 bg-emerald-50' : 'border-blue-100 bg-blue-50'}`}>
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={28} className={balanced ? 'text-emerald-500' : 'text-blue-400'} />
                  <div>
                    <div className="text-base font-black text-slate-900">
                      {balanced ? 'Clean and balanced.' : 'All issues resolved.'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {balanced
                        ? `Export total ${exportTotal.toFixed(2)} h matches the Unanet report exactly. Ready for Paycor.`
                        : reportTotal.trim() === ''
                          ? 'Enter the total from Unanet’s hours report above to double-check the export against it.'
                          : `Export total is ${exportTotal.toFixed(2)} h vs the report’s ${reportTotal} h — worth a look before importing.`}
                    </div>
                    {fixLog.length > 0 && (
                      <div className="mt-1 text-[11px] text-slate-400">Applied: {[...new Set(fixLog)].join(' · ')}</div>
                    )}
                  </div>
                </div>
                <button type="button" className={btnPrimary} onClick={downloadPaycor}>
                  <Download size={15} /> Download Paycor import
                </button>
              </div>

              <Card className="overflow-x-auto">
                <div className="border-b border-slate-100 px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Paycor import preview — {paycorLines.length} lines, aggregated per employee & earn code
                </div>
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    <tr>
                      <th className="px-4 py-2.5">Employee #</th>
                      <th className="px-4 py-2.5">Employee</th>
                      <th className="px-4 py-2.5">Earn code</th>
                      <th className="px-4 py-2.5 text-right">Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paycorLines.map((l, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{l.paycorId}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-800">{l.employeeName}</td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded-md px-2 py-0.5 text-[11px] font-black ${l.earnCode === 'OT' ? 'bg-accent-50 text-accent-600' : 'bg-blue-50 text-blue-500'}`}>
                            {l.earnCode}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-700">{l.hours.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {/* Raw lines, with issue lines highlighted */}
          <details className="mt-6 group">
            <summary className="cursor-pointer text-xs font-bold text-slate-400 hover:text-slate-600">
              Show source lines ({rows.length})
            </summary>
            <Card className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Line</th><th className="px-3 py-2">Person</th><th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Date</th><th className="px-3 py-2">Project</th><th className="px-3 py-2">Pay code</th>
                    <th className="px-3 py-2 text-right">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r, i) => {
                    const flagged = issues.some(is => is.lines.includes(r.line))
                    return (
                      <tr key={`${r.line}-${i}`} className={flagged ? 'bg-rose-50/70' : undefined}>
                        <td className="px-3 py-1.5 font-mono text-slate-400">{r.line}</td>
                        <td className="px-3 py-1.5 font-mono">{r.employeeRef}</td>
                        <td className="px-3 py-1.5">{r.name}</td>
                        <td className="px-3 py-1.5">{r.date}</td>
                        <td className="px-3 py-1.5 font-mono">{r.project}</td>
                        <td className="px-3 py-1.5">{r.payCode}</td>
                        <td className={`px-3 py-1.5 text-right font-semibold ${r.hours < 0 ? 'text-rose-600' : ''}`}>{r.hours.toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
          </details>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-2xl font-black text-slate-900">{value}</div>
    </div>
  )
}

const ISSUE_META: Record<PayrollIssue['kind'], { label: string; cls: string }> = {
  duplicate: { label: 'Duplicate lines', cls: 'bg-rose-50 text-rose-600 border-rose-200' },
  unknownEmployee: { label: 'Unmatched employee', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  unmappedCode: { label: 'Unmapped pay code', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  otNotSplit: { label: 'Overtime not split', cls: 'bg-accent-50 text-accent-600 border-accent-200' },
  negativeHours: { label: 'Negative hours', cls: 'bg-rose-50 text-rose-600 border-rose-200' },
}

function IssueCard({ issue, children }: { issue: PayrollIssue; children: React.ReactNode }) {
  const meta = ISSUE_META[issue.kind]
  return (
    <Card className="flex flex-wrap items-center gap-4 p-4">
      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${meta.cls}`}>
        <AlertTriangle size={11} /> {meta.label}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-slate-900">{issue.summary}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-slate-500">{issue.detail}</div>
        <div className="mt-0.5 text-[10px] font-mono text-slate-300">lines {issue.lines.join(', ')}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </Card>
  )
}

/** Inline earn-code picker for an unmapped Unanet pay code. */
function MapCodeAction({ issue, onMap }: { issue: PayrollIssue; onMap: (unanet: string, paycor: string) => void }) {
  const code = issue.id.split('|')[1] ?? ''
  return (
    <select
      className={`${inputCls} w-52`}
      value=""
      onChange={e => { if (e.target.value) onMap(code, e.target.value) }}
    >
      <option value="">Import &ldquo;{code}&rdquo; as…</option>
      {PAYCOR_EARN_CODES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
    </select>
  )
}

/** Inline roster picker linking an unknown Unanet user to a Paycor employee. */
function LinkEmployeeAction({ issue, onLink }: { issue: PayrollIssue; onLink: (ref: string, paycorId: string) => void }) {
  const { state } = useHr()
  const ref = issue.id.split('|')[1] ?? ''
  // Suggest a roster match by last name (Unanet exports "Last, First").
  const exportedLast = (issue.summary.match(/\(([^,)]+)/)?.[1] ?? '').trim().toLowerCase()
  const suggestion = state.employees.find(e => e.lastName.toLowerCase() === exportedLast)
  return (
    <div className="flex flex-col items-end gap-1.5">
      {suggestion && (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-500"
          onClick={() => onLink(ref, suggestion.paycorId)}
        >
          <Link2 size={13} /> Link to {suggestion.firstName} {suggestion.lastName} (#{suggestion.paycorId})
        </button>
      )}
      <select className={`${inputCls} w-52`} value="" onChange={e => { if (e.target.value) onLink(ref, e.target.value) }}>
        <option value="">{suggestion ? 'Or pick someone else…' : 'Link to employee…'}</option>
        {state.employees.map(e => (
          <option key={e.id} value={e.paycorId}>{e.lastName}, {e.firstName} (#{e.paycorId})</option>
        ))}
      </select>
    </div>
  )
}
