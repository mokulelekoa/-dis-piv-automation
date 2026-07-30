import type { Contract, Employee, HrState } from './types'

/**
 * Seed data for the HR Command Center prototype. Every person here is
 * fictional — the point is to demo the workflows with realistic shapes:
 * several concurrent contracts, each with its own code, positions and rates.
 */

export const SEED_CONTRACTS: Contract[] = [
  {
    id: 'cmop-766',
    code: '36C7702600004',
    name: 'VA CMOP — Tucson',
    client: 'Veterans Health Administration',
    location: 'Tucson, AZ',
    positions: [
      { title: 'Pharmacy Technician', payType: 'Hourly', defaultRate: 21.5, flsa: 'Non-exempt' },
      { title: 'Shipper/Packer', payType: 'Hourly', defaultRate: 17.25, flsa: 'Non-exempt' },
      { title: 'Pharmacist', payType: 'Hourly', defaultRate: 62.0, flsa: 'Non-exempt' },
    ],
    unanetProjects: ['CMOP-766-OPS', 'CMOP-766-PHARM'],
    color: '#2d6d8e',
  },
  {
    id: 'dha-medlog',
    code: 'HT001125F0042',
    name: 'DHA Medical Logistics',
    client: 'Defense Health Agency',
    location: 'San Antonio, TX',
    positions: [
      { title: 'Supply Technician', payType: 'Hourly', defaultRate: 19.75, flsa: 'Non-exempt' },
      { title: 'Warehouse Lead', payType: 'Hourly', defaultRate: 23.1, flsa: 'Non-exempt' },
      { title: 'Logistics Analyst', payType: 'Salary', defaultRate: 68000, flsa: 'Exempt' },
    ],
    unanetProjects: ['DHA-MEDLOG-OPS'],
    color: '#0b243c',
  },
  {
    id: 'vba-records',
    code: '36C10E23D0087',
    name: 'VBA Records Management',
    client: 'Veterans Benefits Administration',
    location: 'St. Louis, MO',
    positions: [
      { title: 'Records Technician', payType: 'Hourly', defaultRate: 18.4, flsa: 'Non-exempt' },
      { title: 'QA Specialist', payType: 'Hourly', defaultRate: 24.0, flsa: 'Non-exempt' },
    ],
    unanetProjects: ['VBA-RECORDS'],
    color: '#b5560f',
  },
]

const base = {
  employmentType: 'Full-time' as const,
  benefitsClass: 'FT Standard (1st of month after 30 days)',
}

export const SEED_EMPLOYEES: Employee[] = [
  {
    id: 'emp-jkim',
    firstName: 'Jordan', lastName: 'Kim',
    email: 'jordan.kim.demo@example.com', phone: '(520) 555-0134',
    address1: '4418 E Calle Verde', city: 'Tucson', state: 'AZ', zip: '85712',
    dob: '03/14/1996', ssnLast4: '4821',
    contractId: 'cmop-766', position: 'Pharmacy Technician', department: 'Pharmacy Ops',
    location: 'Tucson, AZ', flsa: 'Non-exempt', payType: 'Hourly', payRate: 21.5,
    startDate: '02/09/2026', manager: 'D. Whitfield', shift: 'Day (6:00a–2:30p)',
    paycorId: '10241', ...base,
    sync: { paycor: { done: true, at: '2026-02-02T16:20:00Z' }, employeeNavigator: { done: true, at: '2026-02-02T16:41:00Z' } },
    createdAt: '2026-02-02T15:00:00Z',
  },
  {
    id: 'emp-mruiz',
    firstName: 'Marisol', lastName: 'Ruiz',
    email: 'marisol.ruiz.demo@example.com', phone: '(520) 555-0177',
    address1: '902 W Roger Rd', city: 'Tucson', state: 'AZ', zip: '85705',
    dob: '11/02/1993', ssnLast4: '7710',
    contractId: 'cmop-766', position: 'Shipper/Packer', department: 'Warehouse',
    location: 'Tucson, AZ', flsa: 'Non-exempt', payType: 'Hourly', payRate: 17.25,
    startDate: '03/23/2026', manager: 'D. Whitfield', shift: 'Swing (2:00p–10:30p)',
    paycorId: '10242', ...base,
    sync: { paycor: { done: true, at: '2026-03-16T18:02:00Z' }, employeeNavigator: { done: true, at: '2026-03-16T18:15:00Z' } },
    createdAt: '2026-03-16T17:00:00Z',
  },
  {
    id: 'emp-ralvarez',
    firstName: 'Robert', lastName: 'Alvarez',
    email: 'robert.alvarez.demo@example.com', phone: '(210) 555-0119',
    address1: '77 Blanco Creek Dr', city: 'San Antonio', state: 'TX', zip: '78216',
    dob: '07/28/1989', ssnLast4: '3306',
    contractId: 'dha-medlog', position: 'Supply Technician', department: 'Med Logistics',
    location: 'San Antonio, TX', flsa: 'Non-exempt', payType: 'Hourly', payRate: 19.75,
    startDate: '01/12/2026', manager: 'K. Osei', shift: 'Day (7:00a–3:30p)',
    paycorId: '10305', ...base,
    sync: { paycor: { done: true, at: '2026-01-05T15:30:00Z' }, employeeNavigator: { done: true, at: '2026-01-05T15:52:00Z' } },
    createdAt: '2026-01-05T15:00:00Z',
  },
  {
    id: 'emp-afontaine',
    firstName: 'Alicia', lastName: 'Fontaine',
    email: 'alicia.fontaine.demo@example.com', phone: '(210) 555-0163',
    address1: '1520 Mission Trace', city: 'San Antonio', state: 'TX', zip: '78230',
    dob: '05/19/1991', ssnLast4: '9954',
    contractId: 'dha-medlog', position: 'Logistics Analyst', department: 'Med Logistics',
    location: 'San Antonio, TX', flsa: 'Exempt', payType: 'Salary', payRate: 68000,
    startDate: '04/06/2026', manager: 'K. Osei', shift: 'Day (8:00a–4:30p)',
    paycorId: '10318', ...base,
    sync: { paycor: { done: true, at: '2026-03-30T14:12:00Z' }, employeeNavigator: { done: true, at: '2026-03-30T14:30:00Z' } },
    createdAt: '2026-03-30T14:00:00Z',
  },
  {
    id: 'emp-tnguyen',
    firstName: 'Tessa', lastName: 'Nguyen',
    email: 'tessa.nguyen.demo@example.com', phone: '(314) 555-0142',
    address1: '218 Laclede Station Rd', city: 'St. Louis', state: 'MO', zip: '63119',
    dob: '09/09/1998', ssnLast4: '2288',
    contractId: 'vba-records', position: 'Records Technician', department: 'Records',
    location: 'St. Louis, MO', flsa: 'Non-exempt', payType: 'Hourly', payRate: 18.4,
    startDate: '05/18/2026', manager: 'R. Calloway', shift: 'Day (7:30a–4:00p)',
    paycorId: '10412', ...base,
    sync: { paycor: { done: true, at: '2026-05-11T16:44:00Z' }, employeeNavigator: { done: true, at: '2026-05-11T17:01:00Z' } },
    createdAt: '2026-05-11T16:00:00Z',
  },
  {
    id: 'emp-dokafor',
    firstName: 'Daniel', lastName: 'Okafor',
    email: 'daniel.okafor.demo@example.com', phone: '(314) 555-0186',
    address1: '4033 Juniata St', city: 'St. Louis', state: 'MO', zip: '63116',
    dob: '12/01/1990', ssnLast4: '6147',
    contractId: 'vba-records', position: 'QA Specialist', department: 'Records',
    location: 'St. Louis, MO', flsa: 'Non-exempt', payType: 'Hourly', payRate: 24.0,
    startDate: '06/01/2026', manager: 'R. Calloway', shift: 'Day (7:30a–4:00p)',
    paycorId: '10413', ...base,
    sync: { paycor: { done: true, at: '2026-05-26T13:22:00Z' }, employeeNavigator: { done: false } },
    createdAt: '2026-05-26T13:00:00Z',
  },
  {
    id: 'emp-pshah',
    firstName: 'Priya', lastName: 'Shah',
    email: 'priya.shah.demo@example.com', phone: '(520) 555-0121',
    address1: '3610 N Campbell Ave', city: 'Tucson', state: 'AZ', zip: '85719',
    dob: '02/22/2000', ssnLast4: '5090',
    contractId: 'cmop-766', position: 'Pharmacy Technician', department: 'Pharmacy Ops',
    location: 'Tucson, AZ', flsa: 'Non-exempt', payType: 'Hourly', payRate: 21.5,
    startDate: '08/10/2026', manager: 'D. Whitfield', shift: 'Day (6:00a–2:30p)',
    paycorId: '10250', ...base,
    sync: { paycor: { done: false }, employeeNavigator: { done: false } },
    createdAt: '2026-07-27T19:05:00Z',
  },
]

/** Paycor earn codes offered when mapping Unanet pay codes. */
export const PAYCOR_EARN_CODES = [
  { code: 'REG', label: 'Regular' },
  { code: 'OT', label: 'Overtime (1.5x)' },
  { code: 'HOL', label: 'Holiday' },
  { code: 'PTO', label: 'Paid Time Off' },
  { code: 'SIC', label: 'Sick' },
  { code: 'BRV', label: 'Bereavement' },
  { code: 'TRN', label: 'Training' },
  { code: 'BON', label: 'Bonus' },
]

export const SEED_PAY_CODE_MAP: Record<string, string> = {
  'Regular Time': 'REG',
  'Overtime': 'OT',
  'Holiday': 'HOL',
  'PTO': 'PTO',
  'Bereavement': 'BRV',
  // "Training" intentionally unmapped — the sample export surfaces it as an issue.
}

/**
 * A realistic Unanet timesheet export for the 07/20–07/26/2026 week, with the
 * exact defects HR fixes by hand today: a duplicated line (Kim 07/22), 44 REG
 * hours that were never split into OT (Ruiz), an employee ref that doesn't
 * match payroll ("balvarez" — Robert Alvarez's Unanet username), an unmapped
 * "Training" pay code (Okafor), and a stray negative adjustment (Nguyen).
 * Raw export total: 210.00 h. Unanet's own hours report says 206.00 h.
 */
export const SAMPLE_UNANET_CSV = `Person,Name,Date,Project,Pay Code,Hours
jkim,"Kim, Jordan",07/20/2026,CMOP-766-OPS,Regular Time,8.00
jkim,"Kim, Jordan",07/21/2026,CMOP-766-OPS,Regular Time,8.00
jkim,"Kim, Jordan",07/22/2026,CMOP-766-OPS,Regular Time,8.00
jkim,"Kim, Jordan",07/22/2026,CMOP-766-OPS,Regular Time,8.00
jkim,"Kim, Jordan",07/23/2026,CMOP-766-OPS,Regular Time,8.00
jkim,"Kim, Jordan",07/24/2026,CMOP-766-OPS,Regular Time,8.00
mruiz,"Ruiz, Marisol",07/20/2026,CMOP-766-OPS,Regular Time,9.00
mruiz,"Ruiz, Marisol",07/21/2026,CMOP-766-OPS,Regular Time,9.00
mruiz,"Ruiz, Marisol",07/22/2026,CMOP-766-OPS,Regular Time,9.00
mruiz,"Ruiz, Marisol",07/23/2026,CMOP-766-OPS,Regular Time,9.00
mruiz,"Ruiz, Marisol",07/24/2026,CMOP-766-OPS,Regular Time,8.00
balvarez,"Alvarez, Bob",07/20/2026,DHA-MEDLOG-OPS,Regular Time,8.00
balvarez,"Alvarez, Bob",07/21/2026,DHA-MEDLOG-OPS,Regular Time,8.00
balvarez,"Alvarez, Bob",07/22/2026,DHA-MEDLOG-OPS,Regular Time,8.00
balvarez,"Alvarez, Bob",07/23/2026,DHA-MEDLOG-OPS,Regular Time,8.00
balvarez,"Alvarez, Bob",07/24/2026,DHA-MEDLOG-OPS,Regular Time,8.00
tnguyen,"Nguyen, Tessa",07/20/2026,VBA-RECORDS,Regular Time,8.00
tnguyen,"Nguyen, Tessa",07/21/2026,VBA-RECORDS,Regular Time,8.00
tnguyen,"Nguyen, Tessa",07/22/2026,VBA-RECORDS,Regular Time,8.00
tnguyen,"Nguyen, Tessa",07/23/2026,VBA-RECORDS,Regular Time,8.00
tnguyen,"Nguyen, Tessa",07/23/2026,VBA-RECORDS,Regular Time,-4.00
tnguyen,"Nguyen, Tessa",07/24/2026,VBA-RECORDS,PTO,8.00
dokafor,"Okafor, Daniel",07/20/2026,VBA-RECORDS,Regular Time,8.00
dokafor,"Okafor, Daniel",07/21/2026,VBA-RECORDS,Regular Time,8.00
dokafor,"Okafor, Daniel",07/21/2026,VBA-RECORDS,Training,2.00
dokafor,"Okafor, Daniel",07/22/2026,VBA-RECORDS,Regular Time,8.00
dokafor,"Okafor, Daniel",07/23/2026,VBA-RECORDS,Regular Time,8.00
dokafor,"Okafor, Daniel",07/24/2026,VBA-RECORDS,Regular Time,8.00
`

/** What Unanet's own hours report shows for the same period (the trusted number). */
export const SAMPLE_REPORT_TOTAL = 206

export const SEED_STATE: HrState = {
  contracts: SEED_CONTRACTS,
  employees: SEED_EMPLOYEES,
  letters: [
    { id: 'ltr-1', kind: 'offer', recipientName: 'Priya Shah', position: 'Pharmacy Technician', contractName: 'VA CMOP — Tucson', createdAt: '2026-07-27T19:20:00Z' },
    { id: 'ltr-2', kind: 'increase', recipientName: 'Robert Alvarez', position: 'Supply Technician', contractName: 'DHA Medical Logistics', createdAt: '2026-07-21T15:10:00Z' },
  ],
  activity: [
    { id: 'act-3', at: '2026-07-27T19:20:00Z', module: 'letters', text: 'Offer letter generated for Priya Shah — Pharmacy Technician, VA CMOP.' },
    { id: 'act-2', at: '2026-07-27T19:05:00Z', module: 'new-hires', text: 'Priya Shah added — ready to enter in Paycor and Employee Navigator.' },
    { id: 'act-1', at: '2026-07-21T15:10:00Z', module: 'letters', text: 'Salary increase letter generated for Robert Alvarez.' },
  ],
  payCodeMap: SEED_PAY_CODE_MAP,
  employeeRefMap: {
    jkim: '10241', mruiz: '10242', ralvarez: '10305', tnguyen: '10412', dokafor: '10413',
  },
  stats: { hiresSynced: 6, lettersGenerated: 2, payrollRunsBalanced: 0 },
}

/** Minutes of manual work each automated action gives back (used for stats). */
export const MINUTES_SAVED = {
  perHireSynced: 25,
  perLetter: 15,
  perPayrollRun: 90,
}
