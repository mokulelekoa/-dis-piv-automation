/**
 * Applicant store backed by Supabase: one `applicants` row per candidate (the
 * full record lives in a jsonb `data` column), plus Storage buckets for the
 * uploaded form PDFs and profile photos. Server-only.
 *
 * Seeded on first read (idempotent, fixed UUIDs) so the dashboard is populated.
 */

import { randomUUID } from 'crypto'
import { supabase, FORMS_BUCKET, PHOTOS_BUCKET, ATTACHMENTS_BUCKET } from './supabase'
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
  | 'REVIEWED'
  | 'SUBMITTED'
  | 'REJECTED'
  | 'ACCEPTED'

export interface FormState {
  specId: string
  uploaded: boolean
  fileName?: string
  mime?: string
  /** True once the actual uploaded bytes are persisted to disk (seed rows aren't). */
  stored?: boolean
  completeness: number          // 0-100
  missing: string[]
  issues: string[]
  analyzedAt?: string
}

/**
 * A general document attached to a candidate outside the required form set
 * (e.g. a scanned ID, offer letter, or correspondence). Uploaded by staff and
 * stored in ATTACHMENTS_BUCKET under `${applicantId}/${id}`; the bytes are keyed
 * by `id` so the original `fileName` can carry spaces/duplicates safely.
 */
export interface Attachment {
  id: string
  fileName: string
  mime: string
  size: number
  uploadedAt: string
  /** Email of the staff member who uploaded it, for a light audit trail. */
  uploadedBy?: string
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
  /** General documents outside the required form set (admin-curated). */
  attachments?: Attachment[]
  /** Identity an ID proves (Phase 1). Persisted so the portal can re-fill forms. */
  profile?: CandidateProfile
  /** Human-only declarations (OF-306 background, break-in-service, etc.). */
  answers?: PacketAnswers
  /** Onboarding-throughput axis: VA pipeline stage, blockers, next action. */
  onboarding?: OnboardingTracker
  /** Candidate-uploaded profile photo, stored under .data/uploads/. */
  photo?: { fileName: string; mime: string; uploadedAt: string }
  /**
   * Set when a coordinator archives the candidate: the record and all uploads are
   * kept, but the linked auth account is banned (sign-in revoked). Restorable —
   * unarchiving lifts the ban. Distinct from deletion, which is irreversible.
   */
  archived?: { at: string }
  createdAt: string
  updatedAt: string
}

const TABLE = 'applicants'

// Applicant IDs are UUIDs. Guard before querying so a malformed path segment
// returns a clean 404 instead of a Postgres "invalid input syntax for uuid" 500.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Storage object key for an applicant's uploaded form PDF (specId-keyed so a re-upload overwrites). */
function formKey(applicantId: string, specId: string): string {
  return `${applicantId}/${specId}.pdf`
}

/** Storage object key for an applicant's profile photo. */
function photoKey(applicantId: string, fileName: string): string {
  return `${applicantId}/${fileName}`
}

/** Storage object key for a general attachment (id-keyed so names can collide safely). */
function attachmentKey(applicantId: string, attachmentId: string): string {
  return `${applicantId}/${attachmentId}`
}

// The attachments bucket isn't part of the original provisioning script, so make
// sure it exists before first use (idempotent; the create is a no-op once made).
let attachmentsBucketChecked = false
async function ensureAttachmentsBucket(): Promise<void> {
  if (attachmentsBucketChecked) return
  const { error } = await supabase().storage.createBucket(ATTACHMENTS_BUCKET, { public: false })
  if (error && !/exist/i.test(error.message)) {
    throw new Error(`attachments bucket create failed: ${error.message}`)
  }
  attachmentsBucketChecked = true
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

  return rows.map((r, i) => {
    const forms = emptyForms(r.role)
    r.fill?.(forms)
    return {
      id: SEED_IDS[i],
      firstName: r.firstName, lastName: r.lastName, email: r.email,
      role: r.role, station: '766', status: r.status, forms,
      onboarding: r.tracker,
      createdAt: now, updatedAt: now,
    }
  })
}

// Stable IDs so the seed upserts idempotently and links stay valid across deploys.
const SEED_IDS = [
  'a1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000003',
  'a1000000-0000-4000-8000-000000000004',
  'a1000000-0000-4000-8000-000000000005',
  'a1000000-0000-4000-8000-000000000006',
  'a1000000-0000-4000-8000-000000000007',
  'a1000000-0000-4000-8000-000000000008',
  'a1000000-0000-4000-8000-000000000009',
  'a1000000-0000-4000-8000-00000000000a',
]

interface Row {
  id: string
  email: string | null
  status: string
  data: Applicant
  created_at: string
  updated_at: string
}

function toRow(a: Applicant): Row {
  return { id: a.id, email: a.email, status: a.status, data: a, created_at: a.createdAt, updated_at: a.updatedAt }
}

/** Insert the demo seed once if the table is empty. Idempotent via fixed UUIDs. */
let seedChecked = false
async function ensureSeeded(): Promise<void> {
  if (seedChecked) return
  const { count, error } = await supabase().from(TABLE).select('id', { count: 'exact', head: true })
  if (error) throw new Error(`store seed-check failed: ${error.message}`)
  if ((count ?? 0) === 0) {
    const rows = seed().map(toRow)
    const { error: insErr } = await supabase().from(TABLE).upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
    if (insErr) throw new Error(`store seed failed: ${insErr.message}`)
  }
  seedChecked = true
}

async function writeRow(a: Applicant): Promise<void> {
  const { error } = await supabase().from(TABLE).upsert(toRow(a), { onConflict: 'id' })
  if (error) throw new Error(`store write failed: ${error.message}`)
}

/** Load an applicant, mutate it, bump updatedAt, and persist. */
async function patch(id: string, mutate: (a: Applicant) => void): Promise<Applicant | null> {
  const applicant = await getApplicant(id)
  if (!applicant) return null
  mutate(applicant)
  applicant.updatedAt = new Date().toISOString()
  await writeRow(applicant)
  return applicant
}

export async function listApplicants(): Promise<Applicant[]> {
  await ensureSeeded()
  const { data, error } = await supabase().from(TABLE).select('data').order('updated_at', { ascending: false })
  if (error) throw new Error(`store list failed: ${error.message}`)
  return (data ?? []).map(r => (r as { data: Applicant }).data)
}

export async function getApplicant(id: string): Promise<Applicant | null> {
  if (!UUID_RE.test(id)) return null
  await ensureSeeded()
  const { data, error } = await supabase().from(TABLE).select('data').eq('id', id).maybeSingle()
  if (error) throw new Error(`store get failed: ${error.message}`)
  return (data as { data: Applicant } | null)?.data ?? null
}

export async function createApplicant(input: {
  firstName: string; lastName: string; email: string; role: PacketRole; station?: string
}): Promise<Applicant> {
  await ensureSeeded()
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
  await writeRow(applicant)
  return applicant
}

/** Seed text so a freshly created applicant's tracker carries a normalized role. */
const ROLE_POSITION_HINT: Record<PacketRole, string> = {
  PHARMACIST: 'Pharmacist',
  PHARMACY_TECHNICIAN: 'Pharmacy Technician',
  SHIPPER_PACKER: 'Shipper/Packer',
}

/** Persist a candidate profile photo: uploads bytes to Storage + metadata on the applicant. */
export async function savePhoto(
  applicantId: string, fileName: string, mime: string, bytes: Uint8Array,
): Promise<Applicant | null> {
  const applicant = await getApplicant(applicantId)
  if (!applicant) return null

  // Remove a prior photo if its key differs, so we don't orphan objects.
  if (applicant.photo && applicant.photo.fileName !== fileName) {
    await supabase().storage.from(PHOTOS_BUCKET).remove([photoKey(applicantId, applicant.photo.fileName)])
  }
  const { error } = await supabase().storage
    .from(PHOTOS_BUCKET)
    .upload(photoKey(applicantId, fileName), Buffer.from(bytes), { contentType: mime, upsert: true })
  if (error) throw new Error(`photo upload failed: ${error.message}`)

  return patch(applicantId, a => { a.photo = { fileName, mime, uploadedAt: new Date().toISOString() } })
}

/** Save the onboarding tracker (stage axis) onto an applicant. */
export async function saveOnboarding(applicantId: string, onboarding: OnboardingTracker): Promise<Applicant | null> {
  return patch(applicantId, a => { a.onboarding = onboarding })
}

/** Save the candidate profile (ID-derived identity) onto an applicant. */
export async function saveProfile(applicantId: string, profile: CandidateProfile): Promise<Applicant | null> {
  return patch(applicantId, a => { a.profile = profile })
}

/** Save the human-only questionnaire answers onto an applicant. */
export async function saveAnswers(applicantId: string, answers: PacketAnswers): Promise<Applicant | null> {
  return patch(applicantId, a => { a.answers = answers })
}

/**
 * Persist a scan result onto an applicant's form, upload the PDF bytes to
 * Storage so it can be viewed/bundled later, and recompute packet status.
 */
export async function applyScan(
  applicantId: string, specId: string, fileName: string, bytes: Uint8Array, result: AnalysisResult,
): Promise<Applicant | null> {
  const applicant = await getApplicant(applicantId)
  if (!applicant) return null

  const { error } = await supabase().storage
    .from(FORMS_BUCKET)
    .upload(formKey(applicantId, specId), Buffer.from(bytes), { contentType: 'application/pdf', upsert: true })
  if (error) throw new Error(`form upload failed: ${error.message}`)

  return patch(applicantId, a => {
    const idx = a.forms.findIndex(f => f.specId === specId)
    const formState: FormState = {
      specId,
      uploaded: true,
      fileName,
      mime: 'application/pdf',
      stored: true,
      completeness: result.completeness,
      missing: result.missing,
      issues: result.issues,
      analyzedAt: new Date().toISOString(),
    }
    if (idx >= 0) a.forms[idx] = formState
    else a.forms.push(formState)
    a.status = derivePacketStatus(a)
  })
}

/** Download a stored form PDF's bytes from Storage, or null if absent. */
export async function getFormBytes(applicantId: string, specId: string): Promise<Uint8Array | null> {
  const { data, error } = await supabase().storage.from(FORMS_BUCKET).download(formKey(applicantId, specId))
  if (error || !data) return null
  return new Uint8Array(await data.arrayBuffer())
}

/** Download a stored profile photo's bytes from Storage, or null if absent. */
export async function getPhotoBytes(applicantId: string, fileName: string): Promise<Uint8Array | null> {
  const { data, error } = await supabase().storage.from(PHOTOS_BUCKET).download(photoKey(applicantId, fileName))
  if (error || !data) return null
  return new Uint8Array(await data.arrayBuffer())
}

/**
 * Attach a general document to a candidate: upload the bytes to
 * ATTACHMENTS_BUCKET and append its metadata to the applicant. Returns the
 * updated applicant + the new attachment record, or null if the id is unknown.
 */
export async function addAttachment(
  applicantId: string,
  fileName: string,
  mime: string,
  bytes: Uint8Array,
  uploadedBy?: string,
): Promise<{ applicant: Applicant; attachment: Attachment } | null> {
  const existing = await getApplicant(applicantId)
  if (!existing) return null

  await ensureAttachmentsBucket()
  const attachment: Attachment = {
    id: randomUUID(),
    fileName,
    mime,
    size: bytes.byteLength,
    uploadedAt: new Date().toISOString(),
    ...(uploadedBy ? { uploadedBy } : {}),
  }
  const { error } = await supabase().storage
    .from(ATTACHMENTS_BUCKET)
    .upload(attachmentKey(applicantId, attachment.id), Buffer.from(bytes), { contentType: mime, upsert: true })
  if (error) throw new Error(`attachment upload failed: ${error.message}`)

  const applicant = await patch(applicantId, a => {
    a.attachments = [...(a.attachments ?? []), attachment]
  })
  return applicant ? { applicant, attachment } : null
}

/** Download a stored attachment's bytes from Storage, or null if absent. */
export async function getAttachmentBytes(applicantId: string, attachmentId: string): Promise<Uint8Array | null> {
  const { data, error } = await supabase().storage
    .from(ATTACHMENTS_BUCKET)
    .download(attachmentKey(applicantId, attachmentId))
  if (error || !data) return null
  return new Uint8Array(await data.arrayBuffer())
}

/**
 * Delete one attachment: remove its bytes from Storage and drop its metadata.
 * Returns the updated applicant, or null if the applicant doesn't exist. A
 * missing attachment id is a no-op (still returns the applicant).
 */
export async function deleteAttachment(applicantId: string, attachmentId: string): Promise<Applicant | null> {
  const existing = await getApplicant(applicantId)
  if (!existing) return null

  await supabase().storage.from(ATTACHMENTS_BUCKET).remove([attachmentKey(applicantId, attachmentId)])
  return patch(applicantId, a => {
    a.attachments = (a.attachments ?? []).filter(att => att.id !== attachmentId)
  })
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

/**
 * True when every required form is uploaded, 100% complete, issue-free, and has
 * its bytes on disk — i.e. the admin can download a merged review package.
 */
export function packetDownloadable(a: Applicant): boolean {
  return a.forms.length > 0
    && a.forms.every(f => f.uploaded && f.stored && f.completeness === 100 && f.issues.length === 0)
}

/** Statuses at or past an admin's sign-off — the only point a packet may be downloaded. */
const RELEASABLE_STATUSES: PacketStatus[] = ['REVIEWED', 'SUBMITTED', 'ACCEPTED']

/**
 * True only when the packet is complete AND an admin has marked it reviewed.
 * Completion alone is not enough — the merged credential packet is gated behind
 * an explicit human review.
 */
export function packetReleasable(a: Applicant): boolean {
  return packetDownloadable(a) && RELEASABLE_STATUSES.includes(a.status)
}

/**
 * Admin sign-off: move a complete, ready-for-review packet to REVIEWED, which
 * unlocks the merged-packet download. No-op (status unchanged) if the packet
 * isn't complete or isn't awaiting review, so the caller can detect ineligibility.
 */
export async function markReviewed(applicantId: string): Promise<Applicant | null> {
  return patch(applicantId, a => {
    if (packetDownloadable(a) && a.status === 'READY_FOR_REVIEW') {
      a.status = 'REVIEWED'
    }
  })
}

/**
 * Archive or restore a candidate. Archiving stamps `archived.at` (the record and
 * all uploads stay put); restoring clears it. Reversible counterpart to delete.
 * Auth-account banning is handled separately by the caller (see
 * setAuthUserBannedForApplicant) so a restore can lift the sign-in ban too.
 */
export async function setArchived(id: string, archived: boolean): Promise<Applicant | null> {
  return patch(id, a => {
    a.archived = archived ? { at: new Date().toISOString() } : undefined
  })
}

/**
 * Permanently delete a candidate: their uploaded form PDFs and profile photo in
 * Storage, then the applicants row. Returns true if a row was actually removed
 * (false if the id didn't exist). The linked auth account is removed separately
 * by the caller (see deleteAuthUserForApplicant) so the email frees up for re-invite.
 */
export async function deleteApplicant(id: string): Promise<boolean> {
  if (!UUID_RE.test(id)) return false
  const sb = supabase()

  // Clear Storage objects under the applicant's prefix in each bucket.
  for (const bucket of [FORMS_BUCKET, PHOTOS_BUCKET, ATTACHMENTS_BUCKET]) {
    const { data: files } = await sb.storage.from(bucket).list(id)
    if (files && files.length) {
      await sb.storage.from(bucket).remove(files.map(f => `${id}/${f.name}`))
    }
  }

  const { error, count } = await sb.from(TABLE).delete({ count: 'exact' }).eq('id', id)
  if (error) throw new Error(`store delete failed: ${error.message}`)
  return (count ?? 0) > 0
}

export function specLabel(specId: string): string {
  return getSpec(specId)?.label ?? specId
}
