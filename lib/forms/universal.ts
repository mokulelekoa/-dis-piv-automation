/**
 * Universal "Smart Fill" engine: take ANY uploaded blank form — a fillable
 * AcroForm PDF, a flat (non-fillable) PDF, or a clear phone photo — detect its
 * blanks, and suggest values from the candidate's saved profile so one saved
 * record fills every new application.
 *
 * Three modes, picked automatically from the upload:
 *   - acroform      — the PDF has real form fields: enumerate them with pdf-lib
 *                     and fill them natively (crispest result, works offline via
 *                     name heuristics; AI mapping improves label matching).
 *   - overlay-pdf   — flat PDF: render pages, ask vision AI for each blank's
 *                     label + position, then draw the values onto the pages.
 *   - overlay-image — photo of a paper form: same vision pass, then the photo is
 *                     embedded as a PDF page and values are drawn on top.
 *
 * Design rule carried over from the ID parser: suggest only what the profile
 * actually proves. Human-only questions (criminal history, signatures, dates
 * signed, references, employment essays) are surfaced as blanks for the person
 * to answer — never fabricated.
 */

import {
  PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown,
  StandardFonts, rgb,
} from 'pdf-lib'
import { chatCompletionWithFallback } from '../ai/openai-fallback'
import { renderPdfPagesAsPng } from '../ai/render-pdf'
import type { CandidateProfile, WorkHistory } from '../profile'

export type FillMode = 'acroform' | 'overlay-pdf' | 'overlay-image'

export type DetectedFieldKind = 'text' | 'checkbox' | 'radio' | 'dropdown' | 'overlay-text' | 'overlay-check'

export interface DetectedField {
  /** AcroForm field name, or a synthetic `ovl_<n>` id for overlay blanks. */
  id: string
  /** Human-readable label shown in the review UI. */
  label: string
  kind: DetectedFieldKind
  /** Export values for radio groups / dropdown options. */
  options?: string[]
  maxLength?: number
  /** Overlay modes only: 0-based page and top-left-origin % coordinates of where the value is written. */
  page?: number
  xPct?: number
  yPct?: number
  /** Suggested value. Text kinds: the string. checkbox/overlay-check: 'Yes' to tick. */
  suggested: string
  /** Where the suggestion came from — 'none' means the person must answer it. */
  source: 'profile' | 'ai' | 'none'
}

export interface FormDetection {
  mode: FillMode
  fields: DetectedField[]
  pageCount: number
  /** True when AI vision/mapping contributed (false = pure field-name heuristics). */
  aiUsed: boolean
  warnings: string[]
}

const MAX_DETECT_PAGES = 5

// ---------------------------------------------------------------------------
// Profile → prompt/heuristic values
// ---------------------------------------------------------------------------

function mmddyyyy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[2]}/${m[3]}/${m[1]}` : iso
}

function fullName(p: CandidateProfile): string {
  const middle = p.hasNoMiddleName ? 'NMN' : p.middleName
  return [p.firstName, middle, p.lastName, p.suffix].filter(Boolean).join(' ').trim()
}

/**
 * The flat key/value view of the profile used both for the AI prompt and the
 * offline heuristics. Only include what's actually filled in.
 */
function profileFacts(p: CandidateProfile): Record<string, string> {
  const facts: Record<string, string> = {
    'full legal name': fullName(p),
    'first name': p.firstName,
    'middle name': p.hasNoMiddleName ? 'NMN' : p.middleName,
    'last name': p.lastName,
    'suffix': p.suffix,
    'date of birth': p.dateOfBirth ? mmddyyyy(p.dateOfBirth) : '',
    'social security number': p.ssn,
    'sex': p.sex,
    'place of birth': [p.placeOfBirthCity, p.placeOfBirthState, p.placeOfBirthCountry].filter(Boolean).join(', '),
    'city of birth': p.placeOfBirthCity,
    'state of birth': p.placeOfBirthState,
    'country of birth': p.placeOfBirthCountry,
    'country of citizenship': p.citizenshipCountry,
    'email address': p.email,
    'phone number': p.phone,
    'street address': p.addressLine,
    'address city': p.addressCity,
    'address state': p.addressState,
    'address zip': p.addressZip,
    'full address': [p.addressLine, p.addressCity, p.addressState, p.addressZip].filter(Boolean).join(', '),
  }
  for (const k of Object.keys(facts)) if (!facts[k]) delete facts[k]
  return facts
}

/**
 * The richer fact set given to the AI: identity facts plus the reusable job
 * history and references — the data that stays the same across the thousands
 * of application layouts out there. Entries are numbered (most recent first)
 * so the model can map "Employer 2", "Reference 1 phone", etc.
 */
function aiFacts(p: CandidateProfile, wh: WorkHistory | undefined): Record<string, unknown> {
  const facts: Record<string, unknown> = { ...profileFacts(p) }
  if (wh?.jobs.length) {
    facts['employment history (most recent first)'] = wh.jobs.map((j, i) => ({
      order: i + 1,
      employer: j.employer, title: j.title,
      from: j.startDate, to: j.endDate || 'Present',
      city: j.city, state: j.state,
      supervisor: j.supervisor, phone: j.phone,
      duties: j.duties, reasonForLeaving: j.reasonForLeaving,
      mayContact: j.mayContact ? 'Yes' : 'No',
    }))
  }
  if (wh?.references.length) {
    facts['references'] = wh.references.map((r, i) => ({
      order: i + 1,
      name: r.name, relationship: r.relationship, company: r.company,
      phone: r.phone, email: r.email,
    }))
  }
  return facts
}

/**
 * Offline field-name matcher so AcroForm fills work even without an API key.
 * Order matters — more specific patterns first.
 */
const HEURISTICS: Array<{ re: RegExp; fact: string }> = [
  { re: /first\s*name|given\s*name/i, fact: 'first name' },
  { re: /middle\s*(name|initial)/i, fact: 'middle name' },
  { re: /last\s*name|surname|family\s*name/i, fact: 'last name' },
  { re: /suffix/i, fact: 'suffix' },
  { re: /full\s*name|legal\s*name|print(ed)?\s*name|applicant\s*name|^name$|^name\b/i, fact: 'full legal name' },
  { re: /date\s*of\s*birth|birth\s*date|\bdob\b/i, fact: 'date of birth' },
  { re: /social\s*sec|ssn|ss#/i, fact: 'social security number' },
  { re: /place\s*of\s*birth|birth\s*place/i, fact: 'place of birth' },
  { re: /city\s*of\s*birth|birth\s*city/i, fact: 'city of birth' },
  { re: /state\s*of\s*birth|birth\s*state/i, fact: 'state of birth' },
  { re: /country\s*of\s*birth|birth\s*country/i, fact: 'country of birth' },
  { re: /citizen/i, fact: 'country of citizenship' },
  { re: /e-?mail/i, fact: 'email address' },
  { re: /phone|telephone|mobile|cell/i, fact: 'phone number' },
  { re: /(street|mailing|home)?\s*address(\s*line)?\s*1?$|^address\b/i, fact: 'street address' },
  { re: /city/i, fact: 'address city' },
  { re: /state/i, fact: 'address state' },
  { re: /zip|postal/i, fact: 'address zip' },
  { re: /\bsex\b|gender/i, fact: 'sex' },
]

/** Fields we must never auto-suggest, even when a name matches. */
const NEVER_FILL = /signature|sign\s*here|date\s*signed|witness|notary/i

function heuristicSuggest(fieldName: string, facts: Record<string, string>): string {
  if (NEVER_FILL.test(fieldName)) return ''
  for (const h of HEURISTICS) {
    if (h.re.test(fieldName)) return facts[h.fact] ?? ''
  }
  return ''
}

// ---------------------------------------------------------------------------
// AI helpers
// ---------------------------------------------------------------------------

function parseJson<T>(content: string): T | null {
  const jsonStr = content.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
  try { return JSON.parse(jsonStr) as T } catch { return null }
}

const SHARED_RULES = `Suggestion rules — follow strictly:
- Suggest a value ONLY when the person's saved facts clearly answer the field. Otherwise use "" (empty string).
- Employment/reference sections: match numbered form slots to the numbered saved entries in order (entry 1 = most recent job / first reference). If the form has more slots than saved entries, leave the extras "".
- NEVER invent facts that aren't saved: criminal/legal history, yes/no declarations, essays, salary expectations, availability, or extra jobs/references.
- NEVER fill signature fields, "date signed" fields, or anything requiring a wet signature — leave them "".
- Dates in MM/DD/YYYY unless the form's label demands another format.
- Return raw JSON only — no markdown, no commentary.`

/**
 * AcroForm mapping: given the real field inventory (+ page renders for label
 * context), ask the model which saved fact answers each field.
 * Returns { fieldName: value } for the fields it can answer.
 */
async function aiMapAcroformFields(
  apiKey: string,
  fields: Array<{ id: string; kind: string; options?: string[] }>,
  facts: Record<string, unknown>,
  pageImages: string[],
): Promise<Record<string, string> | null> {
  const prompt = `You are helping fill out a form PDF. Below is the PDF's real form-field inventory (names, types, and the allowed options for radio/dropdown fields), plus rendered page images for visual context, plus the person's saved facts.

FORM FIELDS (JSON):
${JSON.stringify(fields)}

PERSON'S SAVED FACTS (JSON):
${JSON.stringify(facts)}

Return ONLY a JSON object mapping field name -> suggested value, including ONLY fields you can confidently answer from the saved facts.
- text fields: the string value.
- checkbox fields: "Yes" to tick it (omit the field to leave it unticked).
- radio/dropdown fields: EXACTLY one of the listed options, verbatim.

${SHARED_RULES}`

  const content = await chatCompletionWithFallback({
    apiKey, prompt,
    images: pageImages.map(b => ({ base64: b, mimeType: 'image/png' })),
    maxTokens: 2500,
    logTag: 'smart-fill-map',
  })
  if (!content) return null
  const raw = parseJson<Record<string, unknown>>(content)
  if (!raw) return null
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string' && v.trim() !== '') out[k] = v.trim()
  }
  return out
}

interface AiOverlayField {
  label?: unknown
  kind?: unknown
  page?: unknown
  xPct?: unknown
  yPct?: unknown
  suggested?: unknown
}

/**
 * Vision blank-detection for flat PDFs and photos: find each labeled blank and
 * where a value should be written (top-left-origin percentages).
 */
async function aiDetectOverlayFields(
  apiKey: string,
  pageImages: Array<{ base64: string; mimeType: string }>,
  facts: Record<string, unknown>,
): Promise<DetectedField[] | null> {
  const prompt = `You are analyzing image(s) of a blank paper/scanned form (${pageImages.length} page(s), in order). Locate every blank the applicant is expected to fill: labeled lines, empty boxes, and checkboxes.

For each blank return an object:
{
  "label": "the field's printed label, e.g. 'Last Name'",
  "kind": "text" or "check",
  "page": 0-based page index the blank is on,
  "xPct": horizontal position (0-100, from LEFT edge) where writing should START — on the blank line/box, just AFTER the printed label,
  "yPct": vertical position (0-100, from TOP edge) of the blank line/box's baseline,
  "suggested": "value from the saved facts below, or \\"\\" if the facts don't answer it"
}

PERSON'S SAVED FACTS (JSON):
${JSON.stringify(facts)}

Positioning rules:
- xPct/yPct must point at the EMPTY SPACE where a pen would write, never at the printed label itself.
- For a checkbox, point at the box's center and use kind "check"; suggested "Yes" only when the facts clearly select it.
- List fields in reading order. Include EVERY blank, even ones you cannot suggest a value for.

${SHARED_RULES}

Return ONLY a JSON array of these objects.`

  const content = await chatCompletionWithFallback({
    apiKey, prompt, images: pageImages, maxTokens: 4000, logTag: 'smart-fill-detect',
  })
  if (!content) return null
  const raw = parseJson<AiOverlayField[]>(content)
  if (!Array.isArray(raw)) return null

  const fields: DetectedField[] = []
  raw.forEach((f, i) => {
    const label = typeof f.label === 'string' ? f.label.trim() : ''
    const page = typeof f.page === 'number' ? Math.max(0, Math.floor(f.page)) : 0
    const xPct = typeof f.xPct === 'number' ? Math.min(100, Math.max(0, f.xPct)) : null
    const yPct = typeof f.yPct === 'number' ? Math.min(100, Math.max(0, f.yPct)) : null
    if (!label || xPct === null || yPct === null) return
    const isCheck = f.kind === 'check'
    const suggested = typeof f.suggested === 'string' ? f.suggested.trim() : ''
    fields.push({
      id: `ovl_${i}`,
      label,
      kind: isCheck ? 'overlay-check' : 'overlay-text',
      page, xPct, yPct,
      suggested: NEVER_FILL.test(label) ? '' : suggested,
      source: suggested ? 'ai' : 'none',
    })
  })
  return fields
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

function readAcroformInventory(doc: PDFDocument): Array<{ id: string; kind: DetectedFieldKind; options?: string[]; maxLength?: number }> {
  let fields
  try { fields = doc.getForm().getFields() } catch { return [] }
  const out: Array<{ id: string; kind: DetectedFieldKind; options?: string[]; maxLength?: number }> = []
  for (const field of fields) {
    const id = field.getName()
    if (field instanceof PDFTextField) {
      const maxLength = field.getMaxLength()
      out.push({ id, kind: 'text', ...(maxLength ? { maxLength } : {}) })
    } else if (field instanceof PDFCheckBox) {
      out.push({ id, kind: 'checkbox' })
    } else if (field instanceof PDFRadioGroup) {
      out.push({ id, kind: 'radio', options: field.getOptions() })
    } else if (field instanceof PDFDropdown) {
      out.push({ id, kind: 'dropdown', options: field.getOptions() })
    }
  }
  return out
}

/** Turn a raw AcroForm field name into a friendlier review label. */
function labelize(name: string): string {
  return name
    .replace(/[_.]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Analyze an uploaded blank form and propose values from the saved profile.
 * Never persists anything — the caller reviews/edits, then generates.
 */
export async function detectFormFields(
  fileBuffer: Buffer,
  mimeType: string,
  profile: CandidateProfile,
  workHistory?: WorkHistory,
): Promise<FormDetection> {
  const apiKey = process.env.OPENAI_API_KEY
  const facts = profileFacts(profile)
  const fullFacts = aiFacts(profile, workHistory)
  const warnings: string[] = []
  if (Object.keys(fullFacts).length === 0) {
    warnings.push('Your saved profile is empty — complete your profile first so blanks can be suggested automatically.')
  } else if (!workHistory?.jobs.length && !workHistory?.references.length) {
    warnings.push('No job history or references saved yet — those sections will come back blank until you add them.')
  }

  // ---- Photo / image upload → vision overlay ----
  if (mimeType.startsWith('image/')) {
    if (!apiKey) {
      throw new Error('Reading a photographed form needs AI assist, which is not configured (missing OPENAI_API_KEY). Upload a fillable PDF instead.')
    }
    const fields = await aiDetectOverlayFields(apiKey, [{ base64: fileBuffer.toString('base64'), mimeType }], fullFacts)
    if (!fields || fields.length === 0) {
      throw new Error('Could not find any fillable blanks in that photo. Retake it straight-on, well-lit, with the whole page in frame.')
    }
    return { mode: 'overlay-image', fields, pageCount: 1, aiUsed: true, warnings }
  }

  if (mimeType !== 'application/pdf') {
    throw new Error('Unsupported file type — upload a PDF, or a JPG/PNG photo of the form.')
  }

  let doc: PDFDocument
  try {
    doc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true })
  } catch {
    throw new Error('Could not open that PDF — it may be corrupt or password-protected.')
  }
  const pageCount = doc.getPageCount()
  const inventory = readAcroformInventory(doc)

  // ---- Fillable PDF → native AcroForm fill ----
  if (inventory.length > 0) {
    let aiMap: Record<string, string> | null = null
    if (apiKey) {
      const pages = await renderPdfPagesAsPng(fileBuffer, Math.min(pageCount, MAX_DETECT_PAGES))
      aiMap = await aiMapAcroformFields(apiKey, inventory, fullFacts, pages)
    }
    if (!apiKey) warnings.push('AI assist is not configured — suggestions below come from field-name matching only.')

    const fields: DetectedField[] = inventory.map(f => {
      // A suggestion for a radio/dropdown must be one of its real options.
      const rawHeuristic = heuristicSuggest(f.id, facts)
      const heuristic = !f.options || f.options.includes(rawHeuristic) ? rawHeuristic : ''
      const ai = aiMap?.[f.id] ?? ''
      const aiValid = ai && (!f.options || f.options.includes(ai))
      const suggested = (aiValid ? ai : '') || heuristic
      return {
        id: f.id,
        label: labelize(f.id),
        kind: f.kind,
        ...(f.options ? { options: f.options } : {}),
        ...(f.maxLength ? { maxLength: f.maxLength } : {}),
        suggested,
        source: aiValid ? 'ai' : heuristic ? 'profile' : 'none',
      }
    })
    return { mode: 'acroform', fields, pageCount, aiUsed: !!aiMap, warnings }
  }

  // ---- Flat PDF → vision overlay ----
  if (!apiKey) {
    throw new Error('This PDF has no fillable fields, and reading a flat scan needs AI assist, which is not configured (missing OPENAI_API_KEY).')
  }
  if (pageCount > MAX_DETECT_PAGES) {
    warnings.push(`Only the first ${MAX_DETECT_PAGES} of ${pageCount} pages were analyzed.`)
  }
  const pages = await renderPdfPagesAsPng(fileBuffer, MAX_DETECT_PAGES)
  if (pages.length === 0) throw new Error('Could not render that PDF for analysis.')
  const fields = await aiDetectOverlayFields(apiKey, pages.map(b => ({ base64: b, mimeType: 'image/png' })), fullFacts)
  if (!fields || fields.length === 0) {
    throw new Error('Could not find any fillable blanks in that document.')
  }
  return { mode: 'overlay-pdf', fields, pageCount, aiUsed: true, warnings }
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export interface GenerateInput {
  mode: FillMode
  /** Confirmed values keyed by DetectedField.id (empty/absent = leave blank). */
  values: Record<string, string>
  /** Overlay modes: the reviewed field geometry (id, kind, page, xPct, yPct). */
  fields?: Array<Pick<DetectedField, 'id' | 'kind' | 'page' | 'xPct' | 'yPct'>>
}

function fillAcroform(doc: PDFDocument, values: Record<string, string>): void {
  const form = doc.getForm()
  for (const [name, value] of Object.entries(values)) {
    if (!value) continue
    let field
    try { field = form.getField(name) } catch { continue }
    try {
      if (field instanceof PDFTextField) {
        const max = field.getMaxLength()
        field.setText(max ? value.slice(0, max) : value)
      } else if (field instanceof PDFCheckBox) {
        if (/^(yes|true|on|x|1)$/i.test(value)) field.check()
      } else if (field instanceof PDFRadioGroup) {
        if (field.getOptions().includes(value)) field.select(value)
      } else if (field instanceof PDFDropdown) {
        const match = field.getOptions().find(o => o.trim().toLowerCase() === value.trim().toLowerCase())
        if (match) field.select(match)
      }
    } catch { /* leave an unfillable field as-is rather than failing the doc */ }
  }
}

async function overlayValues(
  doc: PDFDocument,
  fields: NonNullable<GenerateInput['fields']>,
  values: Record<string, string>,
): Promise<void> {
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const ink = rgb(0.05, 0.1, 0.45) // pen-blue so overlaid answers are visibly distinct from print
  const pages = doc.getPages()
  for (const f of fields) {
    const value = values[f.id]
    if (!value) continue
    const page = pages[Math.min(f.page ?? 0, pages.length - 1)]
    if (!page || f.xPct === undefined || f.yPct === undefined) continue
    const { width, height } = page.getSize()
    const size = Math.max(9, Math.min(12, height * 0.016))
    const text = f.kind === 'overlay-check' ? 'X' : value
    const x = (f.xPct / 100) * width
    // Vision coords are top-left origin; PDF is bottom-left. Sit the baseline just above the blank line.
    const y = height - (f.yPct / 100) * height + size * 0.15
    page.drawText(text, {
      x, y, size, font, color: ink,
      maxWidth: Math.max(40, width - x - 12),
      lineHeight: size * 1.15,
    })
  }
}

/**
 * Produce the filled PDF from the original upload + the user-confirmed values.
 * A photo upload comes back as a PDF with the photo as the page and the answers
 * drawn on top.
 */
export async function generateFilledPdf(
  fileBuffer: Buffer,
  mimeType: string,
  input: GenerateInput,
): Promise<Uint8Array> {
  if (input.mode === 'overlay-image') {
    if (!mimeType.startsWith('image/')) throw new Error('Expected an image upload for photo fill.')
    const doc = await PDFDocument.create()
    const image = mimeType === 'image/png'
      ? await doc.embedPng(fileBuffer)
      : await doc.embedJpg(fileBuffer) // JPG covers phone-camera output
    const page = doc.addPage([image.width, image.height])
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
    await overlayValues(doc, input.fields ?? [], input.values)
    return doc.save()
  }

  if (mimeType !== 'application/pdf') throw new Error('Expected a PDF upload.')
  const doc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true })
  if (input.mode === 'acroform') {
    fillAcroform(doc, input.values)
  } else {
    await overlayValues(doc, input.fields ?? [], input.values)
  }
  return doc.save()
}
