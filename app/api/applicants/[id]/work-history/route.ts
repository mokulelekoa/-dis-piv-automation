import { NextRequest } from 'next/server'
import { getApplicant, saveWorkHistory } from '@/lib/store'
import { canAccessApplicant } from '@/lib/auth'
import type { EmploymentEntry, ReferenceEntry, WorkHistory } from '@/lib/profile'
import { emptyEmployment, emptyReference, emptyWorkHistory } from '@/lib/profile'

export const runtime = 'nodejs'

const MAX_ENTRIES = 20

function s(v: unknown, max = 500): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

/** Coerce untrusted JSON into a well-formed WorkHistory, dropping empty rows. */
function sanitize(raw: unknown): WorkHistory {
  const wh = emptyWorkHistory()
  if (typeof raw !== 'object' || raw === null) return wh
  const { jobs, references } = raw as { jobs?: unknown; references?: unknown }

  if (Array.isArray(jobs)) {
    for (const j of jobs.slice(0, MAX_ENTRIES)) {
      if (typeof j !== 'object' || j === null) continue
      const o = j as Record<string, unknown>
      const entry: EmploymentEntry = {
        ...emptyEmployment(),
        employer: s(o.employer), title: s(o.title),
        startDate: s(o.startDate, 20), endDate: s(o.endDate, 20),
        city: s(o.city), state: s(o.state, 30),
        supervisor: s(o.supervisor), phone: s(o.phone, 40),
        duties: s(o.duties, 2000), reasonForLeaving: s(o.reasonForLeaving, 500),
        mayContact: o.mayContact !== false,
      }
      if (entry.employer || entry.title) wh.jobs.push(entry)
    }
  }
  if (Array.isArray(references)) {
    for (const r of references.slice(0, MAX_ENTRIES)) {
      if (typeof r !== 'object' || r === null) continue
      const o = r as Record<string, unknown>
      const entry: ReferenceEntry = {
        ...emptyReference(),
        name: s(o.name), relationship: s(o.relationship),
        company: s(o.company), phone: s(o.phone, 40), email: s(o.email),
      }
      if (entry.name) wh.references.push(entry)
    }
  }
  return wh
}

/** GET /api/applicants/[id]/work-history — the saved reusable jobs + references. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!(await canAccessApplicant(id))) {
    return Response.json({ error: 'Not authorized.' }, { status: 403 })
  }
  const applicant = await getApplicant(id)
  if (!applicant) return Response.json({ error: 'Applicant not found' }, { status: 404 })
  return Response.json({ workHistory: applicant.workHistory ?? emptyWorkHistory() })
}

/** PUT /api/applicants/[id]/work-history — replace the saved jobs + references. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!(await canAccessApplicant(id))) {
    return Response.json({ error: 'Not authorized.' }, { status: 403 })
  }
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const workHistory = sanitize(raw)
  const applicant = await saveWorkHistory(id, workHistory)
  if (!applicant) return Response.json({ error: 'Applicant not found' }, { status: 404 })
  return Response.json({ workHistory })
}
