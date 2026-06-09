/**
 * The "human-only" packet questionnaire — the answers a candidate must give
 * that NO document can prove and that we therefore NEVER infer. These populate
 * the OF-306 background section, the BI citizenship/marital fields, and the
 * Self-Certification break-in-service choice.
 *
 * The model is intentionally split from CandidateProfile (lib/profile.ts):
 * profile = identity an ID proves; answers = declarations only the person knows.
 * lib/forms/fill.ts maps both onto the real AcroForm fields.
 */

export type YesNo = 'Yes' | 'No'
export type CitizenshipStatus = 'US' | 'PR' | 'FN'
export type BreakInService = 'none' | 'lt36' | '36to60' | 'gt60'

export interface MilitaryService {
  branch: string
  from: string       // MM/DD/YYYY
  to: string         // MM/DD/YYYY
  discharge: string  // type of discharge
}

export interface PacketAnswers {
  // Citizenship (BI form + OF-306 "Are you a U.S. Citizen?")
  citizenshipStatus: CitizenshipStatus | ''
  livedInUS3Years: YesNo | ''         // only relevant when status is PR/FN
  maritalStatus: string                // BI dropdown; human-only (not on an ID)

  // Other names used (maiden, aliases) — OF-306
  otherNamesUsed: string[]             // up to 2 render slots

  // Selective Service + military — OF-306
  registeredSelectiveService: YesNo | 'NA' | ''
  servedMilitary: YesNo | ''
  militaryService: MilitaryService[]   // up to 3 rows

  // OF-306 background "Yes/No" declarations (Q9–Q13)
  convicted7yr: YesNo | ''
  courtMartialed7yr: YesNo | ''
  underCharges: YesNo | ''
  firedOrQuit: YesNo | ''
  delinquentFederalDebt: YesNo | ''
  backgroundExplanation: string        // continuation block if any of Q9–Q13 is Yes

  // OF-306 federal-employment history (Q14–Q16)
  relativesInAgency: YesNo | ''
  receivesFederalRetirement: YesNo | ''
  leftLastFederalJob: string           // "When did you leave your last Federal job"
  waivedLifeInsurance: YesNo | 'Do Not Know' | ''
  canceledWaivers: YesNo | 'Do Not Know' | ''

  // Self-Certification of Continuous Service
  breakInService: BreakInService | ''
  dateLeftFederalEmployment: string    // required when breakInService !== 'none'
}

export function emptyAnswers(): PacketAnswers {
  return {
    citizenshipStatus: '',
    livedInUS3Years: '',
    maritalStatus: '',
    otherNamesUsed: [],
    registeredSelectiveService: '',
    servedMilitary: '',
    militaryService: [],
    convicted7yr: '',
    courtMartialed7yr: '',
    underCharges: '',
    firedOrQuit: '',
    delinquentFederalDebt: '',
    backgroundExplanation: '',
    relativesInAgency: '',
    receivesFederalRetirement: '',
    leftLastFederalJob: '',
    waivedLifeInsurance: '',
    canceledWaivers: '',
    breakInService: '',
    dateLeftFederalEmployment: '',
  }
}

export const MARITAL_OPTIONS = [
  'Never Married', 'Married', 'Divorced', 'Legally Separated', 'Widowed',
  'Annulled', 'Interlocutory Decree',
] as const

/** Active-duty branches of the U.S. Armed Forces (OF-306 Q8 military service). */
export const MILITARY_BRANCH_OPTIONS = [
  'Army', 'Navy', 'Air Force', 'Marine Corps', 'Coast Guard', 'Space Force',
] as const

// Verbatim from the VA "Self Certification of Continuous Service" form.
export const BREAK_IN_SERVICE_OPTIONS: { value: BreakInService; label: string }[] = [
  { value: 'none', label: 'I have NOT had a break in service.' },
  { value: 'lt36', label: 'My break in service is less than 36 months.' },
  { value: '36to60', label: 'My break in service is greater than 36 months, but less than 60 months.' },
  { value: 'gt60', label: 'My break in service is greater than 60 months; or I have never had federal employment as defined above.' },
]

/** The five OF-306 declarations that, if any is "Yes", require a written explanation. */
const EXPLAINABLE: (keyof PacketAnswers)[] = [
  'convicted7yr', 'courtMartialed7yr', 'underCharges', 'firedOrQuit', 'delinquentFederalDebt',
]

export function needsBackgroundExplanation(a: PacketAnswers): boolean {
  return EXPLAINABLE.some(k => a[k] === 'Yes')
}

/** Validate required answers; returns a list of human-readable problems (empty = ready). */
export function validateAnswers(a: PacketAnswers): string[] {
  const out: string[] = []
  const reqYesNo: [keyof PacketAnswers, string][] = [
    ['registeredSelectiveService', 'Selective Service registration'],
    ['servedMilitary', 'Military service'],
    ['convicted7yr', 'Conviction/probation/parole question'],
    ['courtMartialed7yr', 'Court-martial question'],
    ['underCharges', 'Currently-under-charges question'],
    ['firedOrQuit', 'Fired/debarred/quit question'],
    ['delinquentFederalDebt', 'Federal-debt delinquency question'],
    ['relativesInAgency', 'Relatives-in-agency question'],
    ['receivesFederalRetirement', 'Federal retirement/pension question'],
  ]
  for (const [k, label] of reqYesNo) {
    if (!a[k]) out.push(`${label} is unanswered.`)
  }
  if (!a.citizenshipStatus) out.push('Citizenship status is required.')
  if ((a.citizenshipStatus === 'PR' || a.citizenshipStatus === 'FN') && !a.livedInUS3Years) {
    out.push('Lived-in-US-3-consecutive-years question is required for permanent residents / foreign nationals.')
  }
  if (a.servedMilitary === 'Yes' && a.militaryService.length === 0) {
    out.push('Add at least one branch of military service (or change the military-service answer to No).')
  }
  if (needsBackgroundExplanation(a) && !a.backgroundExplanation.trim()) {
    out.push('You answered "Yes" to a background question — a written explanation is required.')
  }
  if (!a.breakInService) out.push('Break-in-service selection is required (Self-Certification).')
  if (a.breakInService && a.breakInService !== 'none' && !a.dateLeftFederalEmployment.trim()) {
    out.push('Date you left federal employment is required for your break-in-service selection.')
  }
  return out
}
