import { getApplicant, saveOnboarding } from '@/lib/store'
import { isStaffRequest } from '@/lib/auth'
import {
  MANUAL_STAGES, STAGE_ORDER, STAGE_STATUS_LABELS, emptyTracker, normalizePosition,
  type StageKey, type StageStatus, type StageState, type OnboardingTracker,
} from '@/lib/onboarding'
import { ROLE_LABELS } from '@/lib/forms/specs'

/**
 * PUT /api/applicants/[id]/onboarding — coordinator records one manual pipeline
 * milestone (fingerprinting / training / PIV pickup / start date). Staff-only:
 * candidates never set their own onboarding stages. The two auto-derived stages
 * (offer_accepted, package_sent) are computed live from sign-in + packet status
 * and are rejected here so they can't be hand-overridden into a drifting state.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!(await isStaffRequest())) {
    return Response.json({ error: 'Not authorized.' }, { status: 403 })
  }

  let body: { key?: string; status?: string; date?: string | null; note?: string | null }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const key = body.key as StageKey
  if (!MANUAL_STAGES.includes(key)) {
    return Response.json({ error: 'That stage is set automatically and cannot be edited.' }, { status: 400 })
  }
  const status = body.status as StageStatus
  if (!Object.prototype.hasOwnProperty.call(STAGE_STATUS_LABELS, status)) {
    return Response.json({ error: 'Unknown stage status.' }, { status: 400 })
  }
  // Optional milestone date — a plain calendar day (the model treats it as ISO).
  const date = typeof body.date === 'string' && body.date.trim() ? body.date.trim() : undefined
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: 'Date must be in YYYY-MM-DD form.' }, { status: 400 })
  }
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 280) : undefined

  const applicant = await getApplicant(id)
  if (!applicant) return Response.json({ error: 'Applicant not found' }, { status: 404 })

  const base: OnboardingTracker =
    applicant.onboarding ?? emptyTracker(normalizePosition(ROLE_LABELS[applicant.role]))
  const next: StageState = { key, status, ...(date ? { date } : {}), ...(note ? { note } : {}) }
  const tracker: OnboardingTracker = {
    ...base,
    stages: STAGE_ORDER.map(k =>
      k === key ? next : (base.stages.find(s => s.key === k) ?? { key: k, status: 'not_started' as StageStatus }),
    ),
  }

  const updated = await saveOnboarding(id, tracker)
  if (!updated) return Response.json({ error: 'Applicant not found' }, { status: 404 })
  return Response.json({ applicant: updated })
}

export const runtime = 'nodejs'
