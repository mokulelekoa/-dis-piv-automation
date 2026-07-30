/**
 * The shared candidate profile. Every packet form (OF-306, role BI request,
 * Self-Certification, VetPro) is filled from ONE instance of this so data never
 * diverges across documents. Fields here are the union of what an ID can prove
 * (auto-filled) plus identity fields a candidate may need to confirm/add.
 *
 * The "human-only" packet questions (OF-306 criminal/military/firing/
 * delinquency answers, break-in-service, other names used) are NOT part of this
 * profile — they live in a separate questionnaire and are never inferred from a
 * document.
 */
export interface CandidateProfile {
  firstName: string
  middleName: string
  lastName: string
  suffix: string
  hasNoMiddleName: boolean   // drives "NMN" / "No Middle Name" rendering per form
  dateOfBirth: string        // YYYY-MM-DD
  sex: string
  ssn: string                // full SSN (sensitive; stored encrypted in later phases)
  placeOfBirthCity: string
  placeOfBirthState: string
  placeOfBirthCountry: string
  citizenshipCountry: string
  email: string
  phone: string
  addressLine: string
  addressCity: string
  addressState: string
  addressZip: string
}

export function emptyProfile(): CandidateProfile {
  return {
    firstName: '', middleName: '', lastName: '', suffix: '',
    hasNoMiddleName: false,
    dateOfBirth: '', sex: '', ssn: '',
    placeOfBirthCity: '', placeOfBirthState: '', placeOfBirthCountry: '',
    citizenshipCountry: '', email: '', phone: '',
    addressLine: '', addressCity: '', addressState: '', addressZip: '',
  }
}

/**
 * The reusable career record powering Smart Fill. Job applications vary
 * endlessly in layout, but the data they ask for barely changes: where you
 * worked, when, for whom, and who can vouch for you. Saved once, reused on
 * every uploaded form.
 */
export interface EmploymentEntry {
  employer: string
  title: string
  startDate: string          // YYYY-MM or MM/YYYY as entered
  endDate: string            // empty = present
  city: string
  state: string
  supervisor: string
  phone: string
  duties: string
  reasonForLeaving: string
  mayContact: boolean
}

export interface ReferenceEntry {
  name: string
  relationship: string       // e.g. "Former supervisor"
  company: string
  phone: string
  email: string
}

export interface WorkHistory {
  jobs: EmploymentEntry[]
  references: ReferenceEntry[]
}

export function emptyWorkHistory(): WorkHistory {
  return { jobs: [], references: [] }
}

export function emptyEmployment(): EmploymentEntry {
  return {
    employer: '', title: '', startDate: '', endDate: '', city: '', state: '',
    supervisor: '', phone: '', duties: '', reasonForLeaving: '', mayContact: true,
  }
}

export function emptyReference(): ReferenceEntry {
  return { name: '', relationship: '', company: '', phone: '', email: '' }
}

/** Last four of the SSN — used for the file-naming convention. */
export function lastFour(ssn: string): string {
  const digits = ssn.replace(/\D/g, '')
  return digits.length >= 4 ? digits.slice(-4) : ''
}

/** True when a free-text country reads as the United States. Only U.S.-born candidates have a state of birth. */
export function isUSCountry(input: string): boolean {
  const v = input.trim().toLowerCase()
  return ['us', 'usa', 'u.s.', 'u.s.a.', 'united states', 'united states of america', 'america'].includes(v)
}
