import { parseDelimited } from './csv'
import type { Employee, PayrollIssue, UnanetRow } from './types'

/**
 * The Unanet→Paycor payroll engine. Parses a Unanet timesheet export,
 * detects the defects HR currently fixes by hand line-by-line, applies
 * one-click fixes, and emits a clean Paycor-ready import.
 */

export type ParsedExport = { rows: UnanetRow[]; errors: string[] }

const HEADER_ALIASES: Record<keyof Omit<UnanetRow, 'line' | 'hours'> | 'hours', string[]> = {
  employeeRef: ['person', 'username', 'user', 'employee id', 'person id', 'employee'],
  name: ['name', 'person name', 'employee name'],
  date: ['date', 'work date', 'timesheet date'],
  project: ['project', 'project code', 'task', 'charge code'],
  payCode: ['pay code', 'paycode', 'code', 'pay type', 'labor category'],
  hours: ['hours', 'quantity', 'qty', 'time'],
}

export function parseUnanetExport(text: string): ParsedExport {
  const grid = parseDelimited(text)
  if (grid.length < 2) return { rows: [], errors: ['No data rows found — paste or upload the full export including its header row.'] }

  const header = grid[0].map(h => h.trim().toLowerCase())
  const col: Partial<Record<keyof typeof HEADER_ALIASES, number>> = {}
  for (const key of Object.keys(HEADER_ALIASES) as (keyof typeof HEADER_ALIASES)[]) {
    col[key] = header.findIndex(h => HEADER_ALIASES[key].includes(h))
  }
  const missing = (Object.keys(col) as (keyof typeof HEADER_ALIASES)[]).filter(k => col[k] === -1)
  if (missing.length > 0) {
    return { rows: [], errors: [`Couldn't find column(s): ${missing.join(', ')}. Expected headers like Person, Name, Date, Project, Pay Code, Hours.`] }
  }

  const rows: UnanetRow[] = []
  const errors: string[] = []
  grid.slice(1).forEach((cells, i) => {
    const line = i + 2 // 1-based, accounting for the header row
    const hours = Number(String(cells[col.hours!] ?? '').replace(/,/g, ''))
    if (!isFinite(hours)) { errors.push(`Line ${line}: hours "${cells[col.hours!]}" is not a number — line skipped.`); return }
    rows.push({
      line,
      employeeRef: (cells[col.employeeRef!] ?? '').trim(),
      name: (cells[col.name!] ?? '').trim(),
      date: (cells[col.date!] ?? '').trim(),
      project: (cells[col.project!] ?? '').trim(),
      payCode: (cells[col.payCode!] ?? '').trim(),
      hours,
    })
  })
  return { rows, errors }
}

function dateValue(mdY: string): number {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(mdY.trim())
  if (!m) return 0
  return new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2])).getTime()
}

/** Key identifying the Mon–Sun work week a date falls in (for OT grouping). */
function weekKey(mdY: string): string {
  const t = dateValue(mdY)
  if (t === 0) return mdY
  const d = new Date(t)
  const day = d.getDay() // 0 = Sunday
  const monday = new Date(t - ((day + 6) % 7) * 86400000)
  return monday.toISOString().slice(0, 10)
}

const dupKey = (r: UnanetRow) => [r.employeeRef, r.date, r.project, r.payCode, r.hours].join('|')

export function sumHours(rows: UnanetRow[]): number {
  return Math.round(rows.reduce((t, r) => t + r.hours, 0) * 100) / 100
}

/** Detect everything wrong with the current set of rows. */
export function analyzeRows(
  rows: UnanetRow[],
  refMap: Record<string, string>,
  payCodeMap: Record<string, string>,
): PayrollIssue[] {
  const issues: PayrollIssue[] = []

  // Exact duplicate lines (same person/date/project/code/hours, positive hours).
  const seen = new Map<string, UnanetRow>()
  const dupGroups = new Map<string, UnanetRow[]>()
  for (const r of rows) {
    if (r.hours <= 0) continue
    const key = dupKey(r)
    const first = seen.get(key)
    if (first) {
      if (!dupGroups.has(key)) dupGroups.set(key, [first])
      dupGroups.get(key)!.push(r)
    } else seen.set(key, r)
  }
  for (const [, group] of dupGroups) {
    const r = group[0]
    issues.push({
      id: `duplicate|${dupKey(r)}`,
      kind: 'duplicate',
      lines: group.map(g => g.line),
      summary: `${r.name}: ${r.date} entered ${group.length}× (${r.hours.toFixed(2)} h each on ${r.project})`,
      detail: `Lines ${group.map(g => g.line).join(', ')} are identical. Keeping the first and dropping ${group.length - 1} duplicate${group.length > 2 ? 's' : ''} removes ${(r.hours * (group.length - 1)).toFixed(2)} extra hours.`,
    })
  }

  // Employee refs payroll doesn't recognize.
  const unknownRefs = new Map<string, UnanetRow[]>()
  for (const r of rows) {
    if (!refMap[r.employeeRef]) {
      if (!unknownRefs.has(r.employeeRef)) unknownRefs.set(r.employeeRef, [])
      unknownRefs.get(r.employeeRef)!.push(r)
    }
  }
  for (const [ref, group] of unknownRefs) {
    issues.push({
      id: `unknownEmployee|${ref}`,
      kind: 'unknownEmployee',
      lines: group.map(g => g.line),
      summary: `Unanet user "${ref}" (${group[0].name}) isn't linked to a Paycor employee`,
      detail: `${group.length} line${group.length > 1 ? 's' : ''} totaling ${sumHours(group).toFixed(2)} h can't import until "${ref}" is matched to a Paycor employee number. Once matched, the link is remembered for every future run.`,
    })
  }

  // Pay codes with no Paycor earn code mapping.
  const unmapped = new Map<string, UnanetRow[]>()
  for (const r of rows) {
    if (!payCodeMap[r.payCode]) {
      if (!unmapped.has(r.payCode)) unmapped.set(r.payCode, [])
      unmapped.get(r.payCode)!.push(r)
    }
  }
  for (const [code, group] of unmapped) {
    issues.push({
      id: `unmappedCode|${code}`,
      kind: 'unmappedCode',
      lines: group.map(g => g.line),
      summary: `Unanet pay code "${code}" has no Paycor earn code`,
      detail: `${group.length} line${group.length > 1 ? 's' : ''} (${sumHours(group).toFixed(2)} h) use "${code}". Pick the Paycor earn code it should import as — the mapping is saved for every future run.`,
    })
  }

  // Weeks where >40 regular hours were exported without an overtime split.
  const regByEmpWeek = new Map<string, UnanetRow[]>()
  for (const r of rows) {
    if (payCodeMap[r.payCode] !== 'REG' || r.hours <= 0) continue
    const key = `${r.employeeRef}|${weekKey(r.date)}`
    if (!regByEmpWeek.has(key)) regByEmpWeek.set(key, [])
    regByEmpWeek.get(key)!.push(r)
  }
  for (const [key, group] of regByEmpWeek) {
    const total = sumHours(group)
    if (total > 40) {
      issues.push({
        id: `otNotSplit|${key}`,
        kind: 'otNotSplit',
        lines: group.map(g => g.line),
        summary: `${group[0].name}: ${total.toFixed(2)} regular hours in one week — overtime never split`,
        detail: `Unanet exported all ${total.toFixed(2)} h as regular time. Paycor needs 40.00 h REG + ${(total - 40).toFixed(2)} h OT or the week pays wrong.`,
      })
    }
  }

  // Negative adjustment lines that would corrupt the import.
  const negatives = rows.filter(r => r.hours < 0)
  if (negatives.length > 0) {
    issues.push({
      id: 'negativeHours',
      kind: 'negativeHours',
      lines: negatives.map(n => n.line),
      summary: `${negatives.length} negative adjustment line${negatives.length > 1 ? 's' : ''} in the export`,
      detail: `${negatives.map(n => `${n.name} ${n.date} (${n.hours.toFixed(2)} h)`).join('; ')}. Paycor imports reject negative hours — these lines are excluded and flagged for correction in Unanet.`,
    })
  }

  return issues
}

/** Remove exact duplicate lines, keeping the first occurrence. */
export function fixDuplicates(rows: UnanetRow[]): UnanetRow[] {
  const seen = new Set<string>()
  return rows.filter(r => {
    if (r.hours <= 0) return true
    const key = dupKey(r)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Drop negative adjustment lines (they must be corrected in Unanet, not imported). */
export function fixNegatives(rows: UnanetRow[]): UnanetRow[] {
  return rows.filter(r => r.hours >= 0)
}

/** Split >40h REG weeks into 40h REG + the remainder as OT, latest days first. */
export function fixOvertime(rows: UnanetRow[], payCodeMap: Record<string, string>): UnanetRow[] {
  const groups = new Map<string, UnanetRow[]>()
  for (const r of rows) {
    if (payCodeMap[r.payCode] !== 'REG' || r.hours <= 0) continue
    const key = `${r.employeeRef}|${weekKey(r.date)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }

  const result = [...rows]
  const otName = otCodeName(payCodeMap)
  for (const [, group] of groups) {
    let excess = Math.round((sumHours(group) - 40) * 100) / 100
    if (excess <= 0) continue
    const ordered = [...group].sort((a, b) => dateValue(b.date) - dateValue(a.date))
    for (const row of ordered) {
      if (excess <= 0) break
      const take = Math.min(row.hours, excess)
      const idx = result.indexOf(row)
      const reduced = { ...row, hours: Math.round((row.hours - take) * 100) / 100 }
      const otRow: UnanetRow = { ...row, payCode: otName, hours: Math.round(take * 100) / 100 }
      if (reduced.hours > 0) result.splice(idx, 1, reduced, otRow)
      else result.splice(idx, 1, otRow)
      excess = Math.round((excess - take) * 100) / 100
    }
  }
  return result
}

/** The Unanet pay code that maps to OT (so split rows re-use the user's mapping). */
function otCodeName(payCodeMap: Record<string, string>): string {
  for (const [unanet, paycor] of Object.entries(payCodeMap)) if (paycor === 'OT') return unanet
  return 'Overtime'
}

export type PaycorLine = {
  paycorId: string
  employeeName: string
  earnCode: string
  hours: number
}

/** Aggregate clean rows into per-employee, per-earn-code Paycor import lines. */
export function toPaycorLines(
  rows: UnanetRow[],
  refMap: Record<string, string>,
  payCodeMap: Record<string, string>,
  employees: Employee[],
): PaycorLine[] {
  const byId = new Map(employees.map(e => [e.paycorId, e]))
  const agg = new Map<string, PaycorLine>()
  for (const r of rows) {
    const paycorId = refMap[r.employeeRef]
    const earnCode = payCodeMap[r.payCode]
    if (!paycorId || !earnCode || r.hours <= 0) continue
    const emp = byId.get(paycorId)
    const name = emp ? `${emp.lastName}, ${emp.firstName}` : r.name
    const key = `${paycorId}|${earnCode}`
    const existing = agg.get(key)
    if (existing) existing.hours = Math.round((existing.hours + r.hours) * 100) / 100
    else agg.set(key, { paycorId, employeeName: name, earnCode, hours: r.hours })
  }
  const order = ['REG', 'OT', 'HOL', 'PTO', 'SIC', 'BRV', 'TRN', 'BON']
  return [...agg.values()].sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName) || order.indexOf(a.earnCode) - order.indexOf(b.earnCode))
}

/** Pay period end = latest date present in the rows. */
export function payPeriodEnd(rows: UnanetRow[]): string {
  let best = ''
  let bestT = 0
  for (const r of rows) {
    const t = dateValue(r.date)
    if (t > bestT) { bestT = t; best = r.date }
  }
  return best
}
