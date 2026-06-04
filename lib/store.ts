/**
 * Mock-first applicant store (file-backed JSON under .data/). No DB yet — this
 * is the staging layer that lets the dashboard work end-to-end; a real
 * Postgres/Supabase store drops in behind the same functions later.
 *
 * Server-only. Seeded on first read so the dashboard is populated immediately.
 */

import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { type PacketRole, requiredFormsForRole, getSpec } from './forms/specs'
import type { AnalysisResult } from './forms/analyze'

export type PacketStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'READY_FOR_REVIEW'
  | 'SUBMITTED'
  | 'REJECTED'
  | 'ACCEPTED'

export interface FormState {
  specId: string
  uploaded: boolean
  fileName?: string
  completeness: number          // 0-100
  missing: string[]
  issues: string[]
  analyzedAt?: string
}

export interface Applicant {
  id: string
  firstName: string
  lastName: string
  email: string
  role: PacketRole
  station: string
  status: PacketStatus
  forms: FormState[]
  createdAt: string
  updatedAt: string
}

const DATA_DIR = path.join(process.cwd(), '.data')
const DATA_FILE = path.join(DATA_DIR, 'applicants.json')

function emptyForms(role: PacketRole): FormState[] {
  return requiredFormsForRole(role).map(specId => ({
    specId, uploaded: false, completeness: 0, missing: [], issues: [],
  }))
}

function seed(): Applicant[] {
  const now = new Date().toISOString()
  const mk = (
    firstName: string, lastName: string, email: string, role: PacketRole,
    status: PacketStatus, fill: (forms: FormState[]) => void,
  ): Applicant => {
    const forms = emptyForms(role)
    fill(forms)
    return { id: randomUUID(), firstName, lastName, email, role, station: '766', status, forms, createdAt: now, updatedAt: now }
  }

  return [
    mk('Maria', 'Jones', 'maria.jones@example.com', 'PHARMACY_TECHNICIAN', 'REJECTED', forms => {
      forms[0] = { ...forms[0], uploaded: true, fileName: '766_Jones1234_306.pdf', completeness: 83, missing: ['2 unanswered Yes/No question(s)'], issues: [], analyzedAt: now }
      forms[1] = { ...forms[1], uploaded: true, fileName: '766_Jones1234_REQ.pdf', completeness: 100, missing: [], issues: [], analyzedAt: now }
      forms[2] = { ...forms[2], uploaded: true, fileName: '766_Jones1234_SC.pdf', completeness: 100, missing: [], issues: [], analyzedAt: now }
    }),
    mk('David', 'Okafor', 'david.okafor@example.com', 'PHARMACIST', 'IN_PROGRESS', forms => {
      forms[0] = { ...forms[0], uploaded: true, fileName: '766_Okafor5678_306.pdf', completeness: 67, missing: ['Place of birth', '5 unanswered Yes/No question(s)'], issues: [], analyzedAt: now }
      forms[1] = { ...forms[1], uploaded: true, fileName: '766_Okafor5678_REQ.pdf', completeness: 75, missing: ['Country of citizenship', 'Citizenship status (US Citizen / Permanent Resident / Foreign National)'], issues: ['Citizenship status: 0 options selected, but exactly one is required.'], analyzedAt: now }
    }),
    mk('Sasha', 'Petrov', 'sasha.petrov@example.com', 'SHIPPER_PACKER', 'READY_FOR_REVIEW', forms => {
      forms.forEach((f, i) => { forms[i] = { ...f, uploaded: true, fileName: `766_Petrov9012_${['306','REQ','SC'][i]}.pdf`, completeness: 100, missing: [], issues: [], analyzedAt: now } })
    }),
  ]
}

async function load(): Promise<Applicant[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8')
    return JSON.parse(raw) as Applicant[]
  } catch {
    const seeded = seed()
    await save(seeded)
    return seeded
  }
}

async function save(applicants: Applicant[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(DATA_FILE, JSON.stringify(applicants, null, 2), 'utf8')
}

export async function listApplicants(): Promise<Applicant[]> {
  const all = await load()
  return [...all].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getApplicant(id: string): Promise<Applicant | null> {
  const all = await load()
  return all.find(a => a.id === id) ?? null
}

export async function createApplicant(input: {
  firstName: string; lastName: string; email: string; role: PacketRole; station?: string
}): Promise<Applicant> {
  const all = await load()
  const now = new Date().toISOString()
  const applicant: Applicant = {
    id: randomUUID(),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim(),
    role: input.role,
    station: (input.station ?? '766').trim(),
    status: 'DRAFT',
    forms: emptyForms(input.role),
    createdAt: now,
    updatedAt: now,
  }
  all.push(applicant)
  await save(all)
  return applicant
}

/** Persist a scan result onto an applicant's form and recompute packet status. */
export async function applyScan(
  applicantId: string, specId: string, fileName: string, result: AnalysisResult,
): Promise<Applicant | null> {
  const all = await load()
  const applicant = all.find(a => a.id === applicantId)
  if (!applicant) return null

  const idx = applicant.forms.findIndex(f => f.specId === specId)
  const formState: FormState = {
    specId,
    uploaded: true,
    fileName,
    completeness: result.completeness,
    missing: result.missing,
    issues: result.issues,
    analyzedAt: new Date().toISOString(),
  }
  if (idx >= 0) applicant.forms[idx] = formState
  else applicant.forms.push(formState)

  applicant.status = derivePacketStatus(applicant)
  applicant.updatedAt = new Date().toISOString()
  await save(all)
  return applicant
}

function derivePacketStatus(a: Applicant): PacketStatus {
  // Don't override terminal review states set by a coordinator.
  if (a.status === 'SUBMITTED' || a.status === 'ACCEPTED') return a.status
  const anyUploaded = a.forms.some(f => f.uploaded)
  if (!anyUploaded) return 'DRAFT'
  const allComplete = a.forms.every(f => f.uploaded && f.completeness === 100 && f.issues.length === 0)
  return allComplete ? 'READY_FOR_REVIEW' : 'IN_PROGRESS'
}

/** Overall packet completeness % across required forms. */
export function packetCompleteness(a: Applicant): number {
  if (a.forms.length === 0) return 0
  const total = a.forms.reduce((sum, f) => sum + (f.uploaded ? f.completeness : 0), 0)
  return Math.round(total / a.forms.length)
}

export function totalMissingCount(a: Applicant): number {
  return a.forms.reduce((n, f) => n + f.missing.length + f.issues.length + (f.uploaded ? 0 : 1), 0)
}

export function specLabel(specId: string): string {
  return getSpec(specId)?.label ?? specId
}
