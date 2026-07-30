import { toCsv } from './csv'
import type { Contract, Employee } from './types'

/**
 * Import-file builders for New Hire Sync: one CSV shaped for Paycor's new
 * employee import, one shaped for an Employee Navigator census upload — both
 * generated from the single record HR entered once.
 */

const rate = (e: Employee) => (e.payType === 'Hourly' ? e.payRate.toFixed(2) : String(e.payRate))

export function paycorImportCsv(employees: Employee[], contracts: Contract[]): string {
  const byId = new Map(contracts.map(c => [c.id, c]))
  const rows: (string | number)[][] = [[
    'Employee Number', 'First Name', 'Last Name', 'SSN Last 4', 'Birth Date', 'Address 1', 'City', 'State', 'Zip',
    'Phone', 'Email', 'Hire Date', 'Job Title', 'Department', 'Work Location', 'Employment Type', 'FLSA Status',
    'Pay Type', 'Pay Rate', 'Manager', 'Shift', 'Contract Code',
  ]]
  for (const e of employees) {
    const c = byId.get(e.contractId)
    rows.push([
      e.paycorId, e.firstName, e.lastName, `xxx-xx-${e.ssnLast4}`, e.dob, e.address1, e.city, e.state, e.zip,
      e.phone, e.email, e.startDate, e.position, e.department, e.location, e.employmentType, e.flsa,
      e.payType, rate(e), e.manager, e.shift, c?.code ?? '',
    ])
  }
  return toCsv(rows)
}

export function employeeNavigatorCensusCsv(employees: Employee[], contracts: Contract[]): string {
  const byId = new Map(contracts.map(c => [c.id, c]))
  const rows: (string | number)[][] = [[
    'Last Name', 'First Name', 'Birth Date', 'Address 1', 'City', 'State', 'Zip', 'Personal Email', 'Phone',
    'Hire Date', 'Employment Type', 'Hours Per Week', 'Benefits Class', 'Payroll ID', 'Division', 'Work Location',
  ]]
  for (const e of employees) {
    const c = byId.get(e.contractId)
    rows.push([
      e.lastName, e.firstName, e.dob, e.address1, e.city, e.state, e.zip, e.email, e.phone,
      e.startDate, e.employmentType, e.employmentType === 'Full-time' ? 40 : 24, e.benefitsClass,
      e.paycorId, c?.name ?? '', e.location,
    ])
  }
  return toCsv(rows)
}

/** Field list in the order Paycor's new-employee screens ask for them. */
export function paycorFieldList(e: Employee, c?: Contract): { label: string; value: string }[] {
  return [
    { label: 'Employee number', value: e.paycorId },
    { label: 'First name', value: e.firstName },
    { label: 'Last name', value: e.lastName },
    { label: 'SSN (last 4)', value: `xxx-xx-${e.ssnLast4}` },
    { label: 'Birth date', value: e.dob },
    { label: 'Address', value: e.address1 },
    { label: 'City / State / ZIP', value: `${e.city}, ${e.state} ${e.zip}` },
    { label: 'Phone', value: e.phone },
    { label: 'Email', value: e.email },
    { label: 'Hire date', value: e.startDate },
    { label: 'Job title', value: e.position },
    { label: 'Department', value: e.department },
    { label: 'Work location', value: e.location },
    { label: 'Employment type', value: e.employmentType },
    { label: 'FLSA status', value: e.flsa },
    { label: 'Pay type', value: e.payType },
    { label: 'Pay rate', value: e.payType === 'Hourly' ? `$${e.payRate.toFixed(2)} / hour` : `$${e.payRate.toLocaleString('en-US')} / year` },
    { label: 'Manager', value: e.manager },
    { label: 'Shift', value: e.shift },
    { label: 'Contract code', value: c?.code ?? '' },
  ]
}

/** Field list in the order an Employee Navigator census entry asks for them. */
export function enFieldList(e: Employee, c?: Contract): { label: string; value: string }[] {
  return [
    { label: 'Last name', value: e.lastName },
    { label: 'First name', value: e.firstName },
    { label: 'Birth date', value: e.dob },
    { label: 'Home address', value: e.address1 },
    { label: 'City / State / ZIP', value: `${e.city}, ${e.state} ${e.zip}` },
    { label: 'Personal email', value: e.email },
    { label: 'Phone', value: e.phone },
    { label: 'Hire date', value: e.startDate },
    { label: 'Employment type', value: e.employmentType },
    { label: 'Hours per week', value: e.employmentType === 'Full-time' ? '40' : '24' },
    { label: 'Benefits class', value: e.benefitsClass },
    { label: 'Payroll ID (Paycor)', value: e.paycorId },
    { label: 'Division', value: c?.name ?? '' },
    { label: 'Work location', value: e.location },
  ]
}
