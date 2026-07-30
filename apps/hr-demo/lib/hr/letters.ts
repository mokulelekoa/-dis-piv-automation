import type { LetterKind } from './types'

/**
 * Letter templates for Letter Studio. Each template declares its form fields
 * and renders a finished business letter from them, so HR fills a handful of
 * inputs (or pastes rows from Excel in batch mode) instead of hand-editing a
 * Word doc per person. Templates are contract-aware: picking a contract
 * pre-fills position, rate, and site.
 */

export type LetterField = {
  key: string
  label: string
  type: 'text' | 'date' | 'money' | 'select' | 'multiline'
  options?: string[]
  placeholder?: string
  /** Column aliases accepted when matching pasted batch headers. */
  aliases?: string[]
}

export type LetterDoc = {
  date: string
  recipientName: string
  recipientLine2?: string
  subject: string
  paragraphs: string[]
  closing: { signerName: string; signerTitle: string }
}

export const OFFER_FIELDS: LetterField[] = [
  { key: 'candidateName', label: 'Candidate name', type: 'text', placeholder: 'Priya Shah', aliases: ['name', 'candidate', 'employee name'] },
  { key: 'position', label: 'Position', type: 'text', placeholder: 'Pharmacy Technician', aliases: ['title', 'role'] },
  { key: 'payRate', label: 'Pay rate', type: 'money', placeholder: '21.50', aliases: ['rate', 'pay', 'hourly rate', 'salary'] },
  { key: 'payUnit', label: 'Pay basis', type: 'select', options: ['per hour', 'per year'], aliases: ['pay basis', 'basis', 'unit'] },
  { key: 'startDate', label: 'Anticipated start date', type: 'date', placeholder: '08/10/2026', aliases: ['start', 'start date'] },
  { key: 'shift', label: 'Shift / schedule', type: 'text', placeholder: 'Day (6:00a–2:30p), Mon–Fri', aliases: ['schedule'] },
  { key: 'employmentType', label: 'Employment type', type: 'select', options: ['Full-time', 'Part-time', 'PRN'], aliases: ['type', 'ft/pt'] },
  { key: 'worksite', label: 'Worksite', type: 'text', placeholder: 'VA CMOP — Tucson, AZ', aliases: ['site', 'location'] },
  { key: 'contractName', label: 'Contract', type: 'text', placeholder: 'VA CMOP — Tucson', aliases: ['contract'] },
  { key: 'responseBy', label: 'Respond by', type: 'date', placeholder: '08/03/2026', aliases: ['respond by', 'deadline'] },
  { key: 'signerName', label: 'Signer name', type: 'text', placeholder: 'Jordan Ellis' },
  { key: 'signerTitle', label: 'Signer title', type: 'text', placeholder: 'HR Manager, DIS Consulting' },
]

export const INCREASE_FIELDS: LetterField[] = [
  { key: 'employeeName', label: 'Employee name', type: 'text', placeholder: 'Robert Alvarez', aliases: ['name', 'employee', 'employee name'] },
  { key: 'position', label: 'Current position', type: 'text', placeholder: 'Supply Technician', aliases: ['title', 'role'] },
  { key: 'contractName', label: 'Contract', type: 'text', placeholder: 'DHA Medical Logistics', aliases: ['contract'] },
  { key: 'currentRate', label: 'Current rate', type: 'money', placeholder: '19.75', aliases: ['current', 'old rate', 'current pay'] },
  { key: 'newRate', label: 'New rate', type: 'money', placeholder: '21.25', aliases: ['new', 'new pay'] },
  { key: 'payUnit', label: 'Pay basis', type: 'select', options: ['per hour', 'per year'], aliases: ['pay basis', 'basis', 'unit'] },
  { key: 'effectiveDate', label: 'Effective date', type: 'date', placeholder: '08/16/2026', aliases: ['effective', 'date'] },
  { key: 'reason', label: 'Reason', type: 'select', options: ['Annual review', 'Merit increase', 'Promotion', 'Market adjustment', 'Contract rate adjustment'], aliases: ['type'] },
  { key: 'newTitle', label: 'New title (promotions only)', type: 'text', placeholder: 'Warehouse Lead', aliases: ['promotion title'] },
  { key: 'signerName', label: 'Signer name', type: 'text', placeholder: 'Jordan Ellis' },
  { key: 'signerTitle', label: 'Signer title', type: 'text', placeholder: 'HR Manager, DIS Consulting' },
]

export function fieldsFor(kind: LetterKind): LetterField[] {
  return kind === 'offer' ? OFFER_FIELDS : INCREASE_FIELDS
}

export function formatMoney(raw: string, unit: string): string {
  const n = Number(String(raw).replace(/[$,\s]/g, ''))
  if (!isFinite(n) || n <= 0) return raw
  const amount = n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
  return `${amount} ${unit || 'per hour'}`
}

function longDate(mdY: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(mdY.trim())
  if (!m) return mdY
  const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]))
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function todayLongDate(): string {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

const v = (data: Record<string, string>, key: string, fallback = '________') =>
  (data[key] ?? '').trim() || fallback

/** Render a complete letter from template + field values. */
export function buildLetter(kind: LetterKind, data: Record<string, string>): LetterDoc {
  if (kind === 'offer') {
    const name = v(data, 'candidateName', 'Candidate')
    const first = name.split(/\s+/)[0]
    const pay = formatMoney(v(data, 'payRate', ''), v(data, 'payUnit', 'per hour'))
    return {
      date: todayLongDate(),
      recipientName: name,
      subject: `Offer of Employment — ${v(data, 'position')}`,
      paragraphs: [
        `Dear ${first},`,
        `On behalf of DIS Consulting, I am pleased to offer you the position of ${v(data, 'position')} supporting the ${v(data, 'contractName')} contract at ${v(data, 'worksite')}. We were impressed with your background and believe you will be a strong addition to the team.`,
        `This is a ${v(data, 'employmentType', 'Full-time')} position compensated at ${pay}. Your anticipated start date is ${longDate(v(data, 'startDate'))}, working ${v(data, 'shift')}. You will be eligible for DIS Consulting's benefits program in accordance with plan documents and eligibility rules.`,
        `This offer is contingent upon successful completion of all client-required onboarding, including the background investigation and credentialing required for the ${v(data, 'contractName')} contract, employment eligibility verification (Form I-9 / E-Verify), and any client-specific clearances. Employment with DIS Consulting is at-will, and this letter is not a contract of employment for any specific term.`,
        `Please confirm your acceptance by signing below and returning this letter no later than ${longDate(v(data, 'responseBy'))}. If you have any questions in the meantime, don't hesitate to reach out — we're excited to welcome you aboard.`,
      ],
      closing: { signerName: v(data, 'signerName', ''), signerTitle: v(data, 'signerTitle', '') },
    }
  }

  const name = v(data, 'employeeName', 'Employee')
  const first = name.split(/\s+/)[0]
  const reason = v(data, 'reason', 'Merit increase')
  const isPromotion = reason === 'Promotion' && (data.newTitle ?? '').trim() !== ''
  const current = formatMoney(v(data, 'currentRate', ''), v(data, 'payUnit', 'per hour'))
  const next = formatMoney(v(data, 'newRate', ''), v(data, 'payUnit', 'per hour'))
  return {
    date: todayLongDate(),
    recipientName: name,
    subject: isPromotion
      ? `Promotion and Compensation Adjustment — Effective ${v(data, 'effectiveDate')}`
      : `Compensation Adjustment — Effective ${v(data, 'effectiveDate')}`,
    paragraphs: [
      `Dear ${first},`,
      isPromotion
        ? `In recognition of your performance and contributions to the ${v(data, 'contractName')} contract, we are pleased to promote you from ${v(data, 'position')} to ${v(data, 'newTitle')}, effective ${longDate(v(data, 'effectiveDate'))}.`
        : `In recognition of your performance and contributions as a ${v(data, 'position')} on the ${v(data, 'contractName')} contract, we are pleased to inform you of an adjustment to your compensation (${reason.toLowerCase()}).`,
      `Effective ${longDate(v(data, 'effectiveDate'))}, your rate of pay will increase from ${current} to ${next}. All other terms and conditions of your employment remain unchanged.`,
      `Thank you for the dedication and quality you bring to your work every day. We appreciate having you on the team and look forward to your continued success with DIS Consulting.`,
    ],
    closing: { signerName: v(data, 'signerName', ''), signerTitle: v(data, 'signerTitle', '') },
  }
}

/** Plain-text version (for clipboard). */
export function letterToText(doc: LetterDoc): string {
  return [
    doc.date, '', doc.recipientName, '', `RE: ${doc.subject}`, '',
    ...doc.paragraphs.flatMap(p => [p, '']),
    'Sincerely,', '', '', doc.closing.signerName, doc.closing.signerTitle, '',
    'Accepted and agreed:', '',
    'Signature: ____________________________    Date: ______________',
  ].join('\n')
}

/** One .doc containing many letters, page-broken — for batch runs. */
export function lettersToWordHtml(docs: LetterDoc[], includeSignatureBlock: boolean): string {
  const bodies = docs.map((d, i) => {
    const inner = letterToWordHtml(d, includeSignatureBlock)
    const body = inner.slice(inner.indexOf('<body>') + 6, inner.indexOf('</body>'))
    return i === 0 ? body : `<div style="page-break-before:always"></div>${body}`
  })
  return `<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>Letters</title>
<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.4;color:#1a1a1a;margin:1in;}</style></head><body>
${bodies.join('\n')}
</body></html>`
}

/**
 * Word-compatible HTML document. Saved with a .doc extension it opens
 * directly in Microsoft Word with fonts/margins intact — no add-ins needed.
 */
export function letterToWordHtml(doc: LetterDoc, includeSignatureBlock: boolean): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const p = (s: string, extra = '') => `<p style="margin:0 0 12pt 0;${extra}">${esc(s)}</p>`
  return `<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(doc.subject)}</title>
<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.4;color:#1a1a1a;margin:1in;}</style></head><body>
<p style="margin:0 0 2pt 0;font-size:14pt;font-weight:bold;color:#0b243c;">DIS Consulting</p>
<p style="margin:0 0 24pt 0;font-size:9pt;color:#5e626c;border-bottom:2pt solid #f18027;padding-bottom:6pt;">Human Resources</p>
${p(doc.date)}
${p(doc.recipientName)}
<p style="margin:0 0 12pt 0;"><b>RE: ${esc(doc.subject)}</b></p>
${doc.paragraphs.map(par => p(par)).join('\n')}
${p('Sincerely,')}
<br/><br/>
${p(doc.closing.signerName, 'margin-bottom:0;')}
${p(doc.closing.signerTitle, 'color:#5e626c;')}
${includeSignatureBlock ? `<br/><br/>${p('Accepted and agreed:')}<p style="margin-top:24pt;">Signature: ____________________________&nbsp;&nbsp;&nbsp;&nbsp;Date: ______________</p>` : ''}
</body></html>`
}
