/**
 * Extract candidate PII from a government-issued ID document image/PDF using
 * vision (gpt-5-mini -> gpt-4o-mini fallback). This is the CMOP-specific
 * counterpart to Menehune's credential document-parser: instead of pulling
 * license/cert fields, it pulls the personal-identity fields that populate the
 * shared candidate profile feeding OF-306, the BI form, Self-Certification, and
 * VetPro.
 *
 * Design rule (the product thesis): extract everything an ID can prove. NEVER
 * fabricate the "human-only" answers (criminal/military/firing/delinquency
 * questions, break-in-service, other names used) — those are collected from the
 * candidate directly, not inferred from a document.
 */

import { chatCompletionWithFallback } from './openai-fallback'
import { renderPdfPagesAsPng } from './render-pdf'

export type IdDocumentType =
  | 'US_PASSPORT'
  | 'US_PASSPORT_CARD'
  | 'FOREIGN_PASSPORT'
  | 'DRIVERS_LICENSE'
  | 'STATE_ID'
  | 'PERMANENT_RESIDENT_CARD'
  | 'EMPLOYMENT_AUTHORIZATION'
  | 'MILITARY_ID'
  | 'US_VISA'
  | 'SOCIAL_SECURITY_CARD'
  | 'BIRTH_CERTIFICATE'
  | 'CERTIFICATE_OF_NATURALIZATION'
  | 'OTHER'

/** Whether the document satisfies the packet's "primary" identity-source list. */
export const PRIMARY_ID_TYPES: ReadonlySet<IdDocumentType> = new Set<IdDocumentType>([
  'US_PASSPORT', 'US_PASSPORT_CARD', 'FOREIGN_PASSPORT', 'DRIVERS_LICENSE',
  'STATE_ID', 'PERMANENT_RESIDENT_CARD', 'EMPLOYMENT_AUTHORIZATION',
  'MILITARY_ID', 'US_VISA',
])

export interface ExtractedIdData {
  documentType: IdDocumentType | null
  documentName: string | null      // human label, e.g. "California Driver's License"
  // Identity
  firstName: string | null
  middleName: string | null
  lastName: string | null
  suffix: string | null
  dateOfBirth: string | null        // YYYY-MM-DD
  sex: string | null                // "M" | "F" | "X" | null
  // Birth / citizenship
  placeOfBirthCity: string | null
  placeOfBirthState: string | null
  placeOfBirthCountry: string | null
  citizenshipCountry: string | null // best inference from the doc (e.g. passport country)
  // Address (driver's license / state ID)
  addressLine: string | null
  addressCity: string | null
  addressState: string | null
  addressZip: string | null
  // Document metadata
  documentNumber: string | null
  issuingAuthority: string | null   // "U.S. Department of State", "California DMV", etc.
  issuingState: string | null       // two-letter, when applicable
  issueDate: string | null          // YYYY-MM-DD
  expirationDate: string | null     // YYYY-MM-DD
  // Sensitive — only present on a Social Security card
  ssn: string | null
  // Bookkeeping
  isPrimaryId: boolean
  confidence: number
  method: 'vision' | 'none'
}

const EMPTY: Omit<ExtractedIdData, 'confidence' | 'method' | 'isPrimaryId'> = {
  documentType: null, documentName: null,
  firstName: null, middleName: null, lastName: null, suffix: null,
  dateOfBirth: null, sex: null,
  placeOfBirthCity: null, placeOfBirthState: null, placeOfBirthCountry: null,
  citizenshipCountry: null,
  addressLine: null, addressCity: null, addressState: null, addressZip: null,
  documentNumber: null, issuingAuthority: null, issuingState: null,
  issueDate: null, expirationDate: null, ssn: null,
}

const EXTRACTION_PROMPT = `You are an identity-document analyzer for a federal contractor onboarding system. Read the government-issued ID in the image(s) and extract the personal identity fields below.

Return ONLY valid JSON with these keys (use null for anything not clearly present — never guess):
{
  "documentType": "one of: US_PASSPORT, US_PASSPORT_CARD, FOREIGN_PASSPORT, DRIVERS_LICENSE, STATE_ID, PERMANENT_RESIDENT_CARD, EMPLOYMENT_AUTHORIZATION, MILITARY_ID, US_VISA, SOCIAL_SECURITY_CARD, BIRTH_CERTIFICATE, CERTIFICATE_OF_NATURALIZATION, OTHER",
  "documentName": "human label, e.g. 'California Driver's License', 'U.S. Passport', 'Social Security Card'",
  "firstName": "given/first name",
  "middleName": "middle name if printed; null if none shown",
  "lastName": "family/surname",
  "suffix": "Jr, Sr, II, III, etc. if printed; else null",
  "dateOfBirth": "YYYY-MM-DD",
  "sex": "M, F, or X as printed; else null",
  "placeOfBirthCity": "city of birth if printed (passports/birth certificates)",
  "placeOfBirthState": "US state of birth if printed (two-letter when possible)",
  "placeOfBirthCountry": "country of birth if printed",
  "citizenshipCountry": "the issuing/nationality country — for a U.S. passport this is 'United States'",
  "addressLine": "street address (driver's license / state ID)",
  "addressCity": "address city",
  "addressState": "address state two-letter",
  "addressZip": "address ZIP",
  "documentNumber": "the document/ID/passport/license number",
  "issuingAuthority": "issuing agency, e.g. 'U.S. Department of State', 'California DMV', 'U.S. Citizenship and Immigration Services'",
  "issuingState": "two-letter state for state-issued IDs; null for federal docs",
  "issueDate": "YYYY-MM-DD",
  "expirationDate": "YYYY-MM-DD",
  "ssn": "ONLY if this is a Social Security card: the 9-digit number as printed (with dashes). For every other document type return null — do NOT read an SSN off any other document."
}

Document rules:
- US_PASSPORT: data page shows 'PASSPORT', 'United States of America', a photo, and a 9-char alphanumeric number. issuingAuthority='U.S. Department of State', citizenshipCountry='United States'. Passports DO print place of birth — capture it.
- FOREIGN_PASSPORT: documentName='[Country] Passport', citizenshipCountry=that country.
- DRIVERS_LICENSE / STATE_ID: capture the full mailing address and the issuing state. documentNumber=the DL/ID number (often the largest number). issuingAuthority='[State] DMV' (or the actual agency shown).
- PERMANENT_RESIDENT_CARD (green card): documentNumber=the USCIS/A-number, issuingAuthority='U.S. Citizenship and Immigration Services'. This person is a permanent resident, NOT a U.S. citizen — set citizenshipCountry to their country of citizenship if shown, else null.
- SOCIAL_SECURITY_CARD: ssn=the printed number; firstName/lastName from the card; everything else null.
- BIRTH_CERTIFICATE / CERTIFICATE_OF_NATURALIZATION: capture name, DOB, and place of birth.

Name rules:
- Split the printed full name into first / middle / last / suffix. If clearly no middle name is printed, return null for middleName (the app will represent it correctly per-form).
- Use the legal name exactly as printed; do not reorder or expand initials.

Date rules — apply to EVERY date:
- Convert any printed date to YYYY-MM-DD using the exact day shown. Example: '15 JAN 2026' or '01/15/2026' -> '2026-01-15'.
- If only month/year is printed, return null (don't guess a day).

Return raw JSON only — no markdown, no commentary.`

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

function parseResponse(content: string): ExtractedIdData | null {
  const jsonStr = content.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(jsonStr)
  } catch {
    return null
  }

  const documentType = (str(raw.documentType) as IdDocumentType | null) ?? null
  const data: ExtractedIdData = {
    ...EMPTY,
    documentType,
    documentName: str(raw.documentName),
    firstName: str(raw.firstName),
    middleName: str(raw.middleName),
    lastName: str(raw.lastName),
    suffix: str(raw.suffix),
    dateOfBirth: str(raw.dateOfBirth),
    sex: str(raw.sex)?.toUpperCase() ?? null,
    placeOfBirthCity: str(raw.placeOfBirthCity),
    placeOfBirthState: str(raw.placeOfBirthState)?.toUpperCase() ?? null,
    placeOfBirthCountry: str(raw.placeOfBirthCountry),
    citizenshipCountry: str(raw.citizenshipCountry),
    addressLine: str(raw.addressLine),
    addressCity: str(raw.addressCity),
    addressState: str(raw.addressState)?.toUpperCase() ?? null,
    addressZip: str(raw.addressZip),
    documentNumber: str(raw.documentNumber),
    issuingAuthority: str(raw.issuingAuthority),
    issuingState: str(raw.issuingState)?.toUpperCase() ?? null,
    issueDate: str(raw.issueDate),
    expirationDate: str(raw.expirationDate),
    ssn: documentType === 'SOCIAL_SECURITY_CARD' ? str(raw.ssn) : null,
    isPrimaryId: documentType ? PRIMARY_ID_TYPES.has(documentType) : false,
    confidence: 0,
    method: 'vision',
  }

  const tracked: (keyof ExtractedIdData)[] = [
    'documentType', 'firstName', 'lastName', 'dateOfBirth', 'documentNumber', 'expirationDate',
  ]
  const filled = tracked.filter(k => !!data[k]).length
  data.confidence = Math.max(filled / tracked.length, 0.5)
  return data
}

/**
 * Extract PII from an uploaded ID. Accepts a PDF (rendered to pages) or an
 * image. Returns null when no API key is configured or extraction yields nothing
 * — callers should degrade to manual entry.
 */
export async function extractIdData(fileBuffer: Buffer, mimeType: string): Promise<ExtractedIdData | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  let images: { base64: string; mimeType: string }[] = []
  if (mimeType.startsWith('image/')) {
    images = [{ base64: fileBuffer.toString('base64'), mimeType }]
  } else if (mimeType === 'application/pdf') {
    const pages = await renderPdfPagesAsPng(fileBuffer, 3)
    images = pages.map(b => ({ base64: b, mimeType: 'image/png' }))
  }
  if (images.length === 0) return null

  const prompt = EXTRACTION_PROMPT + (images.length > 1
    ? `\n\nNOTE: ${images.length} pages/sides were provided — combine information across all of them (e.g. a license front + back, or a passport cover + data page).`
    : '')

  const content = await chatCompletionWithFallback({
    apiKey,
    prompt,
    images,
    maxTokens: 600,
    logTag: 'id-parser',
  })
  if (!content) return null

  const parsed = parseResponse(content)
  if (!parsed) return null
  const anyField = Object.entries(parsed).some(([k, v]) =>
    !['confidence', 'method', 'isPrimaryId'].includes(k) && !!v)
  return anyField ? parsed : null
}
