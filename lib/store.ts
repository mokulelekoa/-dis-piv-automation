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
import type { CandidateProfile } from './profile'
import type { PacketAnswers } from './forms/questions'
import {
  type OnboardingTracker, type StageKey, type StageStatus,
  STAGE_ORDER, emptyTracker, normalizePosition,
} from './onboarding'

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
  /** Identity an ID proves (Phase 1). Persisted so the portal can re-fill forms. */
  profile?: CandidateProfile
  /** Human-only declarations (OF-306 background, break-in-service, etc.). */
  answers?: PacketAnswers
  /** Onboarding-throughput axis: VA pipeline stage, blockers, next action. */
  onboarding?: OnboardingTracker
  /** Candidate-uploaded profile photo, stored under .data/uploads/. */
  photo?: { fileName: string; mime: string; uploadedAt: string }
  createdAt: string
  updatedAt: string
}

const DATA_DIR = path.join(process.cwd(), '.data')
const DATA_FILE = path.join(DATA_DIR, 'applicants.json')
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')

/** Absolute path where an applicant's profile photo is stored on disk. */
export function photoPath(applicantId: string, fileName: string): string {
  return path.join(UPLOADS_DIR, `${applicantId}-${fileName}`)
}

function emptyForms(role: PacketRole): FormState[] {
  return requiredFormsForRole(role).map(specId => ({
    specId, uploaded: false, completeness: 0, missing: [], issues: [],
  }))
}

/**
 * Demo seed. CMOP-shaped (mirrors the CMOP_Process.xlsx stage columns) but uses
 * entirely INVENTED candidates — never the real workbook's names/emails/phones.
 * The set is built to exercise every operational queue and blocker so the
 * dashboard tells the CMOP story end-to-end.
 */
function seed(): Applicant[] {
  const now = new Date().toISOString()
  // ISO date N days ago, for aging metrics.
  const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)

  const stages = (
    spec: Partial<Record<StageKey, { status: StageStatus; date?: string; note?: string }>>,
  ) => STAGE_ORDER.map(key => ({ key, ...(spec[key] ?? { status: 'not_started' as StageStatus }) }))

  interface Row {
    firstName: string; lastName: string; email: string; role: PacketRole; position: string
    status: PacketStatus; tracker: OnboardingTracker; fill?: (forms: FormState[]) => void
    last4?: string
  }

  const rows: Row[] = [
    {
      firstName: 'Alex', lastName: 'Rivera', email: 'alex.rivera@example.com',
      role: 'PHARMACY_TECHNICIAN', position: 'Certified Pharmacy Technician - Day',
      status: 'IN_PROGRESS', last4: '4021',
      tracker: {
        position: normalizePosition('Certified Pharmacy Technician - Day'),
        blockers: [],
        nextAction: 'Send original package', nextActionOwner: 'Coordinator', nextActionDue: ago(-2),
        stages: stages({ offer_accepted: { status: 'complete', date: ago(9) } }),
      },
      fill: forms => { forms[0] = { ...forms[0], uploaded: true, fileName: '766_Rivera4021_306.pdf', completeness: 67, missing: ['5 unanswered Yes/No question(s)'], issues: [], analyzedAt: now } },
    },
    {
      firstName: 'Priya', lastName: 'Anand', email: 'priya.anand@example.com',
      role: 'PHARMACIST', position: 'Pharmacist',
      status: 'READY_FOR_REVIEW', last4: '7782',
      tracker: {
        position: normalizePosition('Pharmacist'),
        blockers: [],
        nextAction: 'Schedule fingerprinting', nextActionOwner: 'Candidate',
        stages: stages({
          offer_accepted: { status: 'complete', date: ago(14) },
          package_sent: { status: 'complete', date: ago(6) },
        }),
      },
      fill: forms => forms.forEach((f, i) => { forms[i] = { ...f, uploaded: true, fileName: `766_Anand7782_${['306', 'REQ', 'SC'][i]}.pdf`, completeness: 100, missing: [], issues: [], analyzedAt: now } }),
    },
    {
      firstName: 'Marcus', lastName: 'Bell', email: 'marcus.bell@example.com',
      role: 'SHIPPER_PACKER', position: 'Shipper/Packer Night',
      status: 'IN_PROGRESS', last4: '3310',
      tracker: {
        position: normalizePosition('Shipper/Packer Night'),
        blockers: ['real_id'],
        nextAction: 'Candidate obtaining Real ID for fingerprinting', nextActionOwner: 'Candidate',
        stages: stages({
          offer_accepted: { status: 'complete', date: ago(20) },
          package_sent: { status: 'complete', date: ago(12) },
          fingerprinting: { status: 'blocked', date: ago(12), note: 'Waiting on Real ID appointment' },
        }),
      },
    },
    {
      firstName: 'Dana', lastName: 'Cho', email: 'dana.cho@example.com',
      role: 'PHARMACY_TECHNICIAN', position: 'Non-Certified Pharmacy Tech - Night',
      status: 'IN_PROGRESS', last4: '5566',
      tracker: {
        position: normalizePosition('Non-Certified Pharmacy Tech - Night'),
        blockers: ['no_show'],
        nextAction: 'Re-schedule fingerprinting (no-show)', nextActionOwner: 'Coordinator',
        stages: stages({
          offer_accepted: { status: 'complete', date: ago(18) },
          package_sent: { status: 'complete', date: ago(10) },
          fingerprinting: { status: 'no_show', date: ago(4), note: 'No-show at appointment' },
        }),
      },
    },
    {
      firstName: 'Sofia', lastName: 'Mendez', email: 'sofia.mendez@example.com',
      role: 'PHARMACY_TECHNICIAN', position: 'Certified Pharmacy Technician',
      status: 'SUBMITTED', last4: '8890',
      tracker: {
        position: normalizePosition('Certified Pharmacy Technician'),
        blockers: ['awaiting_training'],
        nextAction: 'Awaiting next training cohort (capacity)', nextActionOwner: 'AIS',
        stages: stages({
          offer_accepted: { status: 'complete', date: ago(25) },
          package_sent: { status: 'complete', date: ago(17) },
          fingerprinting: { status: 'complete', date: ago(9) },
          training: { status: 'in_progress', date: ago(2), note: 'Training class full — waitlisted' },
        }),
      },
      fill: forms => forms.forEach((f, i) => { forms[i] = { ...f, uploaded: true, fileName: `766_Mendez8890_${['306', 'REQ', 'SC'][i]}.pdf`, completeness: 100, missing: [], issues: [], analyzedAt: now } }),
    },
    {
      firstName: 'Jordan', lastName: 'Okeke', email: 'jordan.okeke@example.com',
      role: 'PHARMACIST', position: 'Pharmacist - Day',
      status: 'SUBMITTED', last4: '1204',
      tracker: {
        position: normalizePosition('Pharmacist - Day'),
        blockers: ['background_adjudication'],
        nextAction: 'Background adjudication in progress at VA', nextActionOwner: 'VA',
        stages: stages({
          offer_accepted: { status: 'complete', date: ago(30) },
          package_sent: { status: 'complete', date: ago(22) },
          fingerprinting: { status: 'complete', date: ago(15) },
          training: { status: 'complete', date: ago(8) },
          piv_pickup: { status: 'in_progress', date: ago(3), note: 'Pending background adjudication' },
        }),
      },
      fill: forms => forms.forEach((f, i) => { forms[i] = { ...f, uploaded: true, fileName: `766_Okeke1204_${['306', 'REQ', 'SC'][i]}.pdf`, completeness: 100, missing: [], issues: [], analyzedAt: now } }),
    },
    {
      firstName: 'Lena', lastName: 'Park', email: 'lena.park@example.com',
      role: 'SHIPPER_PACKER', position: 'Shipper/Packer - Day',
      status: 'READY_FOR_REVIEW', last4: '6677',
      tracker: {
        position: normalizePosition('Shipper/Packer - Day'),
        blockers: [],
        nextAction: 'Confirm start date', nextActionOwner: 'Coordinator',
        stages: stages({
          offer_accepted: { status: 'complete', date: ago(28) },
          package_sent: { status: 'complete', date: ago(20) },
          fingerprinting: { status: 'complete', date: ago(13) },
          training: { status: 'complete', date: ago(6) },
          piv_pickup: { status: 'complete', date: ago(2) },
        }),
      },
      fill: forms => forms.forEach((f, i) => { forms[i] = { ...f, uploaded: true, fileName: `766_Park6677_${['306', 'REQ', 'SC'][i]}.pdf`, completeness: 100, missing: [], issues: [], analyzedAt: now } }),
    },
    {
      firstName: 'Tobias', lastName: 'Frey', email: 'tobias.frey@example.com',
      role: 'PHARMACY_TECHNICIAN', position: 'Pharmacy Technician',
      status: 'ACCEPTED', last4: '9001',
      tracker: {
        position: normalizePosition('Pharmacy Technician'),
        blockers: [],
        stages: stages({
          offer_accepted: { status: 'complete', date: ago(45) },
          package_sent: { status: 'complete', date: ago(38) },
          fingerprinting: { status: 'complete', date: ago(31) },
          training: { status: 'complete', date: ago(20) },
          piv_pickup: { status: 'complete', date: ago(10) },
          started: { status: 'complete', date: ago(3) },
        }),
      },
      fill: forms => forms.forEach((f, i) => { forms[i] = { ...f, uploaded: true, fileName: `766_Frey9001_${['306', 'REQ', 'SC'][i]}.pdf`, completeness: 100, missing: [], issues: [], analyzedAt: now } }),
    },
    {
      firstName: 'Grace', lastName: 'Iverson', email: 'grace.iverson@example.com',
      role: 'PHARMACY_TECHNICIAN', position: 'Pharm Tech (cert) — shift TBD',
      status: 'DRAFT', last4: '',
      tracker: {
        position: normalizePosition('Pharm Tech (cert) — shift TBD'),
        blockers: ['role_shift_change'],
        nextAction: 'Confirm shift assignment before package', nextActionOwner: 'Coordinator',
        stages: stages({
          offer_accepted: { status: 'complete', date: ago(3) },
          package_sent: { status: 'needs_update', note: 'Shift change requested — hold package' },
        }),
      },
    },
    {
      firstName: 'Hassan', lastName: 'Reyes', email: 'hassan.reyes@example.com',
      role: 'PHARMACIST', position: 'Pharmacist',
      status: 'IN_PROGRESS', last4: '2345',
      tracker: {
        position: normalizePosition('Pharmacist'),
        blockers: ['refingerprinting'],
        nextAction: 'Re-fingerprinting required (rejected prints)', nextActionOwner: 'Candidate',
        stages: stages({
          offer_accepted: { status: 'complete', date: ago(22) },
          package_sent: { status: 'complete', date: ago(14) },
          fingerprinting: { status: 'blocked', date: ago(7), note: 'Prints rejected — refingerprint' },
        }),
      },
      fill: forms => { forms[1] = { ...forms[1], uploaded: true, fileName: '766_Reyes2345_REQ.pdf', completeness: 100, missing: [], issues: [], analyzedAt: now } },
    },
  ]

  return rows.map(r => {
    const forms = emptyForms(r.role)
    r.fill?.(forms)
    return {
      id: randomUUID(),
      firstName: r.firstName, lastName: r.lastName, email: r.email,
      role: r.role, station: '766', status: r.status, forms,
      onboarding: r.tracker,
      createdAt: now, updatedAt: now,
    }
  })
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
    onboarding: emptyTracker(normalizePosition(ROLE_POSITION_HINT[input.role])),
    createdAt: now,
    updatedAt: now,
  }
  all.push(applicant)
  await save(all)
  return applicant
}

/** Seed text so a freshly created applicant's tracker carries a normalized role. */
const ROLE_POSITION_HINT: Record<PacketRole, string> = {
  PHARMACIST: 'Pharmacist',
  PHARMACY_TECHNICIAN: 'Pharmacy Technician',
  SHIPPER_PACKER: 'Shipper/Packer',
}

/** Persist a candidate profile photo: writes bytes to disk + metadata on the applicant. */
export async function savePhoto(
  applicantId: string, fileName: string, mime: string, bytes: Uint8Array,
): Promise<Applicant | null> {
  const all = await load()
  const applicant = all.find(a => a.id === applicantId)
  if (!applicant) return null

  await fs.mkdir(UPLOADS_DIR, { recursive: true })
  // Remove a prior photo if its filename differs, so we don't orphan files.
  if (applicant.photo && applicant.photo.fileName !== fileName) {
    await fs.rm(photoPath(applicantId, applicant.photo.fileName), { force: true })
  }
  await fs.writeFile(photoPath(applicantId, fileName), bytes)

  applicant.photo = { fileName, mime, uploadedAt: new Date().toISOString() }
  applicant.updatedAt = new Date().toISOString()
  await save(all)
  return applicant
}

/** Save the onboarding tracker (stage axis) onto an applicant. */
export async function saveOnboarding(applicantId: string, onboarding: OnboardingTracker): Promise<Applicant | null> {
  const all = await load()
  const applicant = all.find(a => a.id === applicantId)
  if (!applicant) return null
  applicant.onboarding = onboarding
  applicant.updatedAt = new Date().toISOString()
  await save(all)
  return applicant
}

/** Save the candidate profile (ID-derived identity) onto an applicant. */
export async function saveProfile(applicantId: string, profile: CandidateProfile): Promise<Applicant | null> {
  const all = await load()
  const applicant = all.find(a => a.id === applicantId)
  if (!applicant) return null
  applicant.profile = profile
  applicant.updatedAt = new Date().toISOString()
  await save(all)
  return applicant
}

/** Save the human-only questionnaire answers onto an applicant. */
export async function saveAnswers(applicantId: string, answers: PacketAnswers): Promise<Applicant | null> {
  const all = await load()
  const applicant = all.find(a => a.id === applicantId)
  if (!applicant) return null
  applicant.answers = answers
  applicant.updatedAt = new Date().toISOString()
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
