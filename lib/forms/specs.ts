/**
 * Packet form specifications — the real AcroForm field names (from
 * form-field-inventory.json) plus the validation rules from PROJECT.md.
 *
 * A field a candidate must complete is declared here so the scanner
 * (lib/forms/analyze.ts) can read an uploaded, filled PDF and report exactly
 * what's missing or incomplete. Prefilled contract fields and on-form labels are
 * intentionally NOT listed — they aren't the candidate's job to complete.
 */

export type PacketRole = 'PHARMACIST' | 'PHARMACY_TECHNICIAN' | 'SHIPPER_PACKER'

/**
 * A predicate evaluated against the uploaded form's actual field values. Every
 * sub-condition provided must hold: `anyChecked` = at least one of these
 * checkbox/radio fields is checked; `dropdownEquals` = the named dropdown's
 * selection equals `value`.
 */
export interface FieldCondition {
  anyChecked?: string[]
  dropdownEquals?: { field: string; value: string }
}

export interface OneOfGroup {
  /** Human label for the decision, e.g. "Citizenship status". */
  label: string
  /** AcroForm checkbox field names — exactly one must be checked. */
  fields: string[]
  /** Only required when this condition holds (e.g. the 3-year question, only for PR/FN). */
  conditionalOn?: FieldCondition
}

export interface RequiredText {
  field: string
  label: string
  /** Only required when this condition holds. */
  conditionalOn?: FieldCondition
}

export interface FormSpec {
  id: string
  label: string
  /** File in form-field-inventory.json this form's fields come from. */
  templateFile: string
  requiredText: RequiredText[]
  oneOf: OneOfGroup[]
  /** When true, every required radio group in the PDF must have a selection (OF-306). */
  allRadiosAnswered: boolean
  /** Radio groups that are optional on the form — never counted as missing. */
  optionalRadios?: string[]
  /** Radio groups required only when another radio equals a value (e.g. Selective Service only for males). */
  conditionalRadios?: { field: string; when: { field: string; value: string } }[]
  /** Wet-ink signature required (digital not accepted for these). */
  signatureRequired: boolean
  note?: string
}

const BI_FIELDS_BASE = (id: string, label: string, templateFile: string): FormSpec => ({
  id,
  label,
  templateFile,
  requiredText: [
    { field: 'Last Name', label: 'Last name' },
    { field: 'First Name', label: 'First name' },
    { field: 'Middle Name', label: 'Middle name (use "NMN" if none)' },
    // The BI form has two side-by-side SSN boxes: a 9-cell comb named "Social
    // Security Number" (maxLength 9, digits only) and a misspelled free-text box
    // "Social Secuirty Number". fill.ts populates both; we check the free-text
    // box here since it carries the human-readable, dashed SSN.
    { field: 'Social Secuirty Number', label: 'Social Security Number' },
    { field: 'Date of Birth', label: 'Date of birth' },
    { field: 'City of Birth', label: 'City of birth' },
    {
      field: 'State of Birth', label: 'State of birth',
      // Only U.S.-born candidates have a state of birth.
      conditionalOn: { dropdownEquals: { field: 'Country of Birth', value: 'United States of America' } },
    },
    { field: 'Country of Birth', label: 'Country of birth' },
    { field: 'Country of Citizenship', label: 'Country of citizenship' },
    { field: 'Email Address', label: 'Email address' },
  ],
  oneOf: [
    // Citizenship is declared by the required "Country of Citizenship" dropdown
    // above. The D-C (Dual Citizenship) / PR (Permanent Resident) / FN (Foreign
    // National) checkboxes are optional special-case flags — a plain U.S.
    // citizen checks NONE — so they are deliberately NOT an "exactly one" group.
    // Only PR/FN candidates answer the 3-consecutive-years-in-US question.
    { label: '3-consecutive-years-in-US question (Yes/No)', fields: ['YES', 'No'],
      conditionalOn: { anyChecked: ['PR', 'FN'] } },
  ],
  allRadiosAnswered: false,
  signatureRequired: true,
  note: 'Foreign-born / PR / FN selections trigger the 3-consecutive-years-in-US review.',
})

export const FORM_SPECS: FormSpec[] = [
  {
    id: 'of306',
    label: 'OF-306 — Declaration for Federal Employment',
    templateFile: 'OF 306 August 2023.pdf',
    requiredText: [
      { field: 'Full Name', label: 'Full name' },
      { field: 'Social Security Number', label: 'Social Security Number' },
      { field: 'PLACE OF BIRTH Include city and state or country', label: 'Place of birth' },
      { field: 'Country of Citizenship', label: 'Country of citizenship' },
      { field: 'DATE OF BIRTH MM  DD  YYYY', label: 'Date of birth' },
      { field: 'Date', label: 'Signature date' },
    ],
    oneOf: [],
    allRadiosAnswered: true,
    optionalRadios: [
      'Did you waive Basic Life Insurance or any type of optional life insurance', // 18b — FEGLI, optional
      'If yes to 18b did you later cancel the waivers',                            // 18c — only relevant if 18b = Yes
    ],
    conditionalRadios: [
      // Selective Service registration applies only to those required to register
      // (the form's "Male" declaration is Yes); it's N/A for everyone else.
      { field: 'Have you registered with Selective Service', when: { field: 'Male', value: 'Yes' } },
    ],
    signatureRequired: true,
    note: 'Every required Yes/No must be answered (incl. Q8, commonly missed). Selective Service is required only when the "Male" declaration is Yes; life-insurance waiver items 18b/18c are optional. Wet signature in black ink required — digital not accepted.',
  },
  BI_FIELDS_BASE('bi_pharmacist', 'BI Request — Pharmacist', 'BI For- Pharmacist.pdf'),
  BI_FIELDS_BASE('bi_pharmtech', 'BI Request — Pharmacy Technician', 'BI Form- PharmacyTechnician.pdf'),
  BI_FIELDS_BASE('bi_shipper', 'BI Request — Shipper/Packer', 'BI Form-Shipper Packer (1).pdf'),
  {
    id: 'selfcert',
    label: 'Self-Certification of Continuous Service',
    templateFile: 'Self Certification of Continuous Service_20250212.pdf',
    requiredText: [
      { field: 'Print Name', label: 'Printed name' },
      { field: 'Social Security Number', label: 'Social Security Number' },
      { field: 'Date of Form Completion_af_date', label: 'Date of form completion' },
      {
        field: 'Date Left Federal Employment 1_af_date',
        label: 'Date left federal employment',
        conditionalOn: {
          anyChecked: [
            'My break in service was less than 36 months',
            'My break in service is greater than 36 months, but less than 60 months',
            'My break in service is greater than 60 months or I have never worked',
          ],
        },
      },
    ],
    oneOf: [
      {
        label: 'Break-in-service option (exactly one)',
        fields: [
          'I have NOT had a break in service',
          'My break in service was less than 36 months',
          'My break in service is greater than 36 months, but less than 60 months',
          'My break in service is greater than 60 months or I have never worked',
        ],
      },
    ],
    allRadiosAnswered: false,
    signatureRequired: true,
    note: 'Exactly one break-in-service option. Wet signature in black ink required — digital not accepted.',
  },
]

export function getSpec(id: string): FormSpec | undefined {
  return FORM_SPECS.find(s => s.id === id)
}

/** Forms required for a candidate packet, by role. (VetPro handled separately — it's a .doc with no AcroForm.) */
export function requiredFormsForRole(role: PacketRole): string[] {
  const bi =
    role === 'PHARMACIST' ? 'bi_pharmacist' :
    role === 'PHARMACY_TECHNICIAN' ? 'bi_pharmtech' : 'bi_shipper'
  return ['of306', bi, 'selfcert']
}

export const ROLE_LABELS: Record<PacketRole, string> = {
  PHARMACIST: 'Pharmacist',
  PHARMACY_TECHNICIAN: 'Pharmacy Technician',
  SHIPPER_PACKER: 'Shipper/Packer',
}
