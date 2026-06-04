/**
 * Scan an uploaded, filled packet PDF and report what's missing/incomplete.
 *
 * Reads the AcroForm field values directly with pdf-lib (no guessing — these are
 * the actual values the candidate entered) and evaluates them against the form's
 * spec: required text filled, "exactly one" checkbox groups, every Yes/No radio
 * answered (OF-306), and a wet-signature reminder.
 */

import { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown } from 'pdf-lib'
import { getSpec, type FormSpec } from './specs'

export type ItemStatus = 'ok' | 'missing' | 'review'

export interface AnalysisItem {
  label: string
  status: ItemStatus
  detail?: string
}

export interface AnalysisResult {
  specId: string
  /** 0-100 over hard-required checks (excludes 'review' reminders). */
  completeness: number
  requiredTotal: number
  requiredOk: number
  /** Labels of required items still missing. */
  missing: string[]
  /** Human-readable issues (conditional rules, unanswered questions, etc.). */
  issues: string[]
  items: AnalysisItem[]
  hasFillableForm: boolean
}

type FieldValue =
  | { type: 'text'; value: string }
  | { type: 'checkbox'; checked: boolean }
  | { type: 'radio'; selected: string | undefined }
  | { type: 'dropdown'; selected: string[] }
  | { type: 'other' }

function readFields(doc: PDFDocument): { map: Map<string, FieldValue>; radioGroups: string[] } {
  const form = doc.getForm()
  const fields = form.getFields()
  const map = new Map<string, FieldValue>()
  const radioGroups: string[] = []

  for (const field of fields) {
    const name = field.getName()
    if (field instanceof PDFTextField) {
      map.set(name, { type: 'text', value: (field.getText() ?? '').trim() })
    } else if (field instanceof PDFCheckBox) {
      map.set(name, { type: 'checkbox', checked: field.isChecked() })
    } else if (field instanceof PDFRadioGroup) {
      map.set(name, { type: 'radio', selected: field.getSelected() })
      radioGroups.push(name)
    } else if (field instanceof PDFDropdown) {
      map.set(name, { type: 'dropdown', selected: field.getSelected() })
    } else {
      map.set(name, { type: 'other' })
    }
  }
  return { map, radioGroups }
}

function isFilled(v: FieldValue | undefined): boolean {
  if (!v) return false
  switch (v.type) {
    case 'text': return v.value !== ''
    case 'checkbox': return v.checked
    case 'radio': return v.selected !== undefined
    case 'dropdown': return v.selected.length > 0 && v.selected.some(s => s.trim() !== '')
    default: return false
  }
}

function checkedCount(map: Map<string, FieldValue>, fields: string[]): number {
  let n = 0
  for (const f of fields) {
    const v = map.get(f)
    if (v?.type === 'checkbox' && v.checked) n++
    else if (v?.type === 'radio' && v.selected !== undefined) n++
  }
  return n
}

function anyChecked(map: Map<string, FieldValue>, fields: string[]): boolean {
  return checkedCount(map, fields) > 0
}

export async function analyzePdf(specId: string, pdfBytes: Uint8Array): Promise<AnalysisResult> {
  const spec = getSpec(specId)
  if (!spec) throw new Error(`Unknown form spec: ${specId}`)

  let doc: PDFDocument
  try {
    doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
  } catch {
    throw new Error('Could not open the PDF — it may be corrupt or password-protected.')
  }

  let map: Map<string, FieldValue>
  let radioGroups: string[]
  try {
    const read = readFields(doc)
    map = read.map
    radioGroups = read.radioGroups
  } catch {
    map = new Map()
    radioGroups = []
  }

  const hasFillableForm = map.size > 0
  const items: AnalysisItem[] = []
  const missing: string[] = []
  const issues: string[] = []
  let requiredTotal = 0
  let requiredOk = 0

  if (!hasFillableForm) {
    return {
      specId, completeness: 0, requiredTotal: 0, requiredOk: 0,
      missing: [], hasFillableForm: false,
      issues: ['No fillable form fields found — this looks like a flattened scan or image. Upload the digitally-filled PDF so fields can be checked.'],
      items: [],
    }
  }

  // Required text (respecting conditionals)
  for (const rt of spec.requiredText) {
    const conditionallyRequired = rt.conditionalOn ? anyChecked(map, rt.conditionalOn.anyChecked) : true
    if (!conditionallyRequired) continue
    requiredTotal++
    const filled = isFilled(map.get(rt.field))
    if (filled) {
      requiredOk++
      items.push({ label: rt.label, status: 'ok' })
    } else {
      missing.push(rt.label)
      items.push({ label: rt.label, status: 'missing', detail: 'Required field is blank.' })
    }
  }

  // Exactly-one checkbox groups
  for (const grp of spec.oneOf) {
    requiredTotal++
    const n = checkedCount(map, grp.fields)
    if (n === 1) {
      requiredOk++
      items.push({ label: grp.label, status: 'ok' })
    } else if (n === 0) {
      missing.push(grp.label)
      items.push({ label: grp.label, status: 'missing', detail: 'No option selected — exactly one is required.' })
    } else {
      issues.push(`${grp.label}: ${n} options selected, but exactly one is allowed.`)
      items.push({ label: grp.label, status: 'missing', detail: `${n} options selected — only one allowed.` })
    }
  }

  // Every radio (Yes/No question) answered — OF-306
  if (spec.allRadiosAnswered && radioGroups.length > 0) {
    const unanswered = radioGroups.filter(name => {
      const v = map.get(name)
      return !(v?.type === 'radio' && v.selected !== undefined)
    })
    requiredTotal++
    if (unanswered.length === 0) {
      requiredOk++
      items.push({ label: `All ${radioGroups.length} Yes/No questions answered`, status: 'ok' })
    } else {
      missing.push(`${unanswered.length} unanswered Yes/No question(s)`)
      items.push({
        label: `Yes/No questions (${radioGroups.length - unanswered.length}/${radioGroups.length} answered)`,
        status: 'missing',
        detail: `Unanswered: ${unanswered.slice(0, 8).join(', ')}${unanswered.length > 8 ? '…' : ''}`,
      })
    }
  }

  // Wet-signature reminder — can't be auto-verified from an AcroForm.
  if (spec.signatureRequired) {
    items.push({
      label: 'Wet signature in black ink',
      status: 'review',
      detail: 'Print, sign in black ink, and scan. Digital signatures are not accepted for this form.',
    })
  }

  const completeness = requiredTotal === 0 ? 100 : Math.round((requiredOk / requiredTotal) * 100)
  return { specId, completeness, requiredTotal, requiredOk, missing, issues, items, hasFillableForm }
}
