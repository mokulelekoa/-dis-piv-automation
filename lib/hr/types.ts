/**
 * Shared types for the HR Command Center (/hr) — the internal toolkit that
 * kills the three time sinks: dual entry into Paycor + Employee Navigator,
 * hand-written offer/increase letters, and Unanet→Paycor payroll cleanup.
 *
 * HR runs several government staffing contracts at once (CMOP is one of
 * many), each with its own contract code, positions, and pay rates — so
 * contracts are first-class and everything hangs off them.
 */

export type SystemKey = 'paycor' | 'employeeNavigator'

export const SYSTEM_LABELS: Record<SystemKey, string> = {
  paycor: 'Paycor',
  employeeNavigator: 'Employee Navigator',
}

export type Contract = {
  id: string
  /** Contract / task-order number, e.g. 36C7702600004. */
  code: string
  name: string
  client: string
  location: string
  /** Positions hired on this contract, with the default rate for offers. */
  positions: { title: string; payType: 'Hourly' | 'Salary'; defaultRate: number; flsa: 'Non-exempt' | 'Exempt' }[]
  /** Unanet project codes that bill to this contract. */
  unanetProjects: string[]
  /** Accent color used for contract chips in the UI. */
  color: string
}

export type Employee = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  address1: string
  city: string
  state: string
  zip: string
  dob: string // MM/DD/YYYY
  ssnLast4: string
  contractId: string
  position: string
  department: string
  location: string
  employmentType: 'Full-time' | 'Part-time' | 'PRN'
  flsa: 'Non-exempt' | 'Exempt'
  payType: 'Hourly' | 'Salary'
  /** Hourly rate when payType is Hourly, annual salary when Salary. */
  payRate: number
  startDate: string // MM/DD/YYYY
  manager: string
  shift: string
  benefitsClass: string
  paycorId: string
  /** Per-system entry status: has this person been keyed into each system yet? */
  sync: Record<SystemKey, { done: boolean; at?: string }>
  createdAt: string
}

export type LetterKind = 'offer' | 'increase'

export type LetterRecord = {
  id: string
  kind: LetterKind
  recipientName: string
  position: string
  contractName: string
  createdAt: string
}

export type ActivityItem = {
  id: string
  at: string // ISO timestamp
  module: 'new-hires' | 'letters' | 'payroll'
  text: string
}

/** One line of a Unanet timesheet export, as parsed from CSV. */
export type UnanetRow = {
  /** 1-based line number in the source file, for traceability. */
  line: number
  employeeRef: string // Unanet person id / username as exported
  name: string
  date: string // MM/DD/YYYY
  project: string
  payCode: string // Unanet pay code (e.g. "Regular Time")
  hours: number
}

export type PayrollIssueKind =
  | 'duplicate'
  | 'unknownEmployee'
  | 'unmappedCode'
  | 'otNotSplit'
  | 'negativeHours'

export type PayrollIssue = {
  id: string
  kind: PayrollIssueKind
  /** Source line numbers involved in the issue. */
  lines: number[]
  summary: string
  detail: string
}

export type HrState = {
  contracts: Contract[]
  employees: Employee[]
  letters: LetterRecord[]
  activity: ActivityItem[]
  /** Editable Unanet pay code → Paycor earn code mapping. */
  payCodeMap: Record<string, string>
  /** Unanet employeeRef → Paycor employee number overrides learned from fixes. */
  employeeRefMap: Record<string, string>
  /** Lifetime counters that power the "time given back" stats. */
  stats: {
    hiresSynced: number
    lettersGenerated: number
    payrollRunsBalanced: number
  }
}
