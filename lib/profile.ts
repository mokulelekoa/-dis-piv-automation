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

/** Last four of the SSN — used for the file-naming convention. */
export function lastFour(ssn: string): string {
  const digits = ssn.replace(/\D/g, '')
  return digits.length >= 4 ? digits.slice(-4) : ''
}
