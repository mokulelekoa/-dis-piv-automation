/**
 * Onboarding-throughput model — the SECOND status axis.
 *
 * Packet readiness (lib/store PacketStatus) answers "is the paperwork complete
 * and correct?". This module answers a different question: "where is this person
 * in VA's onboarding pipeline, what's blocking them, and how long have they been
 * stuck?". The two are intentionally separate — a packet can be 100% complete
 * while the candidate is blocked on a Real ID appointment, and vice versa.
 *
 * The stage milestones mirror DIS's operating spreadsheet (CMOP_Process.xlsx):
 * Offer Accepted -> Original Package Sent -> Fingerprinting -> Training ->
 * PIV Pickup -> Start Date. The model below normalizes that stage-based,
 * free-text tracker into structured data the dashboard can group and filter.
 */

import type { PacketRole } from './forms/specs'

// ---- stage milestones (workbook columns, in pipeline order) ----

export type StageKey =
  | 'offer_accepted'
  | 'package_sent'
  | 'fingerprinting'
  | 'training'
  | 'piv_pickup'
  | 'started'

export const STAGE_ORDER: StageKey[] = [
  'offer_accepted', 'package_sent', 'fingerprinting', 'training', 'piv_pickup', 'started',
]

export const STAGE_LABELS: Record<StageKey, string> = {
  offer_accepted: 'Offer accepted',
  package_sent: 'Package sent',
  fingerprinting: 'Fingerprinting',
  training: 'Training',
  piv_pickup: 'PIV pickup',
  started: 'Start date',
}

/** Status of a single milestone. "in_progress" covers sent/submitted/scheduled. */
export type StageStatus =
  | 'not_started'
  | 'in_progress'
  | 'complete'
  | 'blocked'
  | 'no_show'
  | 'needs_update'

export const STAGE_STATUS_LABELS: Record<StageStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  complete: 'Complete',
  blocked: 'Blocked',
  no_show: 'No-show',
  needs_update: 'Needs update',
}

export interface StageState {
  key: StageKey
  status: StageStatus
  /** ISO date (YYYY-MM-DD) the milestone was reached or scheduled, if known. */
  date?: string
  note?: string
}

// ---- blockers (parsed from notes / status cells) ----

export type BlockerTag =
  | 'real_id'
  | 'no_show'
  | 'awaiting_training'
  | 'background_adjudication'
  | 'refingerprinting'
  | 'missing_packet'
  | 'role_shift_change'

export const BLOCKER_LABELS: Record<BlockerTag, string> = {
  real_id: 'Real ID wait',
  no_show: 'No-show',
  awaiting_training: 'Awaiting training',
  background_adjudication: 'Background adjudication',
  refingerprinting: 'Re-fingerprinting',
  missing_packet: 'Missing packet',
  role_shift_change: 'Role/shift change',
}

// ---- normalized position (messy free text -> role/cert/shift) ----

export type Shift = 'day' | 'night' | 'morning' | 'unknown'

export interface NormalizedPosition {
  role: PacketRole | 'UNKNOWN'
  /** Only meaningful for pharmacy technicians. undefined = unknown. */
  certified?: boolean
  shift: Shift
  /** Original free-text position, preserved for audit. */
  raw: string
}

// ---- the tracker carried on each applicant ----

export interface OnboardingTracker {
  stages: StageState[]
  blockers: BlockerTag[]
  position: NormalizedPosition
  nextAction?: string
  nextActionOwner?: string
  /** ISO date the next action is due. */
  nextActionDue?: string
  /** Raw workbook row values, preserved verbatim for audit. */
  raw?: Record<string, string>
}

export function emptyTracker(position: NormalizedPosition): OnboardingTracker {
  return {
    stages: STAGE_ORDER.map(key => ({ key, status: 'not_started' as StageStatus })),
    blockers: [],
    position,
  }
}

export function stageState(t: OnboardingTracker, key: StageKey): StageState {
  return t.stages.find(s => s.key === key) ?? { key, status: 'not_started' }
}

// ---- auto-derived vs. manual stages ----

/**
 * The two milestones the app observes directly, so they're derived live from
 * platform signals instead of being hand-set by a coordinator:
 *   - offer_accepted: complete once the candidate has signed in (invite accepted).
 *   - package_sent:   complete once the admin releases the packet (REVIEWED+).
 * Everything after that is a physical, real-world event the app can't see, so a
 * coordinator records those by hand (MANUAL_STAGES).
 */
export const AUTO_STAGES: StageKey[] = ['offer_accepted', 'package_sent']
export const MANUAL_STAGES: StageKey[] = STAGE_ORDER.filter(k => !AUTO_STAGES.includes(k))

export interface AutoSignals {
  /** Candidate has signed in at least once (invite accepted). */
  signedIn: boolean
  /** lastSignInAt — used as the offer_accepted date when known. */
  signedInAt?: string
  /** Packet released to the candidate (PacketStatus REVIEWED / SUBMITTED / ACCEPTED). */
  packetReleased: boolean
}

/**
 * Overlay the two event-derived stages onto a stored tracker. Pure, and the
 * source of truth for the auto stages is the live signal — any stored value for
 * offer_accepted/package_sent is intentionally ignored so the pipeline can't
 * drift from auth/packet state. Manual stages pass through untouched.
 */
export function applyAutoStages(t: OnboardingTracker, sig: AutoSignals): OnboardingTracker {
  const overlay: Partial<Record<StageKey, StageState>> = {
    offer_accepted: {
      key: 'offer_accepted',
      status: sig.signedIn ? 'complete' : 'not_started',
      ...(sig.signedIn && sig.signedInAt ? { date: sig.signedInAt.slice(0, 10) } : {}),
    },
    package_sent: {
      key: 'package_sent',
      status: sig.packetReleased ? 'complete' : 'not_started',
    },
  }
  return { ...t, stages: STAGE_ORDER.map(key => overlay[key] ?? stageState(t, key)) }
}

/**
 * The candidate's current pipeline position: the first stage that isn't
 * complete. If every stage is complete they've started; if any stage is
 * blocked/no-show that surfaces as the current stage so it can't be missed.
 */
export function currentStage(t: OnboardingTracker): StageKey {
  const stuck = STAGE_ORDER.find(k => {
    const s = stageState(t, k).status
    return s === 'blocked' || s === 'no_show'
  })
  if (stuck) return stuck
  const open = STAGE_ORDER.find(k => stageState(t, k).status !== 'complete')
  return open ?? 'started'
}

export function isBlocked(t: OnboardingTracker): boolean {
  return t.blockers.length > 0 || t.stages.some(s => s.status === 'blocked' || s.status === 'no_show')
}

/** True once every milestone through PIV pickup is complete (ready to start). */
export function isReadyForStart(t: OnboardingTracker): boolean {
  const through = STAGE_ORDER.slice(0, STAGE_ORDER.indexOf('started'))
  return !isBlocked(t) && through.every(k => stageState(t, k).status === 'complete')
}

// ---- operational queues for the dashboard ----

export type Queue =
  | 'needs_package'
  | 'fingerprinting_pending'
  | 'training_pending'
  | 'piv_pending'
  | 'ready_for_start'
  | 'blocked'
  | 'no_show'

export const QUEUE_LABELS: Record<Queue, string> = {
  needs_package: 'Needs package sent',
  fingerprinting_pending: 'Fingerprinting pending',
  training_pending: 'Training pending',
  piv_pending: 'PIV pickup pending',
  ready_for_start: 'Ready for start',
  blocked: 'Blocked',
  no_show: 'No-show / rework',
}

export const QUEUE_ORDER: Queue[] = [
  'blocked', 'no_show', 'needs_package', 'fingerprinting_pending',
  'training_pending', 'piv_pending', 'ready_for_start',
]

/** Which operational queues a candidate currently falls into (can be several). */
export function queuesFor(t: OnboardingTracker): Queue[] {
  const out: Queue[] = []
  const done = (k: StageKey) => stageState(t, k).status === 'complete'
  const noShow = t.stages.some(s => s.status === 'no_show')

  if (isBlocked(t) && !noShow) out.push('blocked')
  if (noShow) out.push('no_show')

  if (done('offer_accepted') && !done('package_sent')) out.push('needs_package')
  if (done('package_sent') && !done('fingerprinting')) out.push('fingerprinting_pending')
  if (done('fingerprinting') && !done('training')) out.push('training_pending')
  if (done('training') && !done('piv_pickup')) out.push('piv_pending')
  if (isReadyForStart(t) && !done('started')) out.push('ready_for_start')

  return out
}

// ---- aging ----

/** Whole days between an ISO date (YYYY-MM-DD or full ISO) and now. */
export function daysSince(iso: string | undefined, now: Date = new Date()): number | null {
  if (!iso) return null
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return null
  return Math.floor((now.getTime() - then.getTime()) / 86_400_000)
}

/** Days the candidate has sat at their current stage (uses that stage's date). */
export function ageAtCurrentStage(t: OnboardingTracker, now?: Date): number | null {
  const cur = currentStage(t)
  return daysSince(stageState(t, cur).date, now)
}

// ---- normalizers (raw workbook -> structured) ----

export function normalizePosition(raw: string): NormalizedPosition {
  const v = (raw ?? '').toLowerCase()
  let role: NormalizedPosition['role'] = 'UNKNOWN'
  let certified: boolean | undefined

  if (v.includes('pharmacist')) {
    role = 'PHARMACIST'
  } else if (v.includes('tech') || v.includes('technician')) {
    role = 'PHARMACY_TECHNICIAN'
    if (v.includes('non-cert') || v.includes('noncert') || v.includes('non cert')) certified = false
    else if (v.includes('cert')) certified = true
  } else if (v.includes('shipper') || v.includes('packer')) {
    role = 'SHIPPER_PACKER'
  }

  let shift: Shift = 'unknown'
  if (v.includes('night') || v.includes('pm') || v.includes('swing')) shift = 'night'
  else if (v.includes('morning')) shift = 'morning'
  else if (v.includes('day') || v.includes('am')) shift = 'day'

  return { role, certified, shift, raw: raw ?? '' }
}

/** Heuristically tag blockers from a free-text note / status cell. */
export function parseBlockersFromNote(note: string): BlockerTag[] {
  const v = (note ?? '').toLowerCase()
  const tags = new Set<BlockerTag>()
  if (/real\s*id/.test(v)) tags.add('real_id')
  if (/no[\s-]?show|noshow/.test(v)) tags.add('no_show')
  if (/training/.test(v) && /(wait|capacity|full|pending|schedul)/.test(v)) tags.add('awaiting_training')
  if (/adjudicat|background/.test(v)) tags.add('background_adjudication')
  if (/re[\s-]?finger|refinger/.test(v)) tags.add('refingerprinting')
  if (/(missing|resend|no)\s+(packet|package)/.test(v)) tags.add('missing_packet')
  if (/(role|shift)\s+chang/.test(v)) tags.add('role_shift_change')
  return [...tags]
}
