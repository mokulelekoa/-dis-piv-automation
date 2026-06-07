import { NextRequest } from 'next/server'
import { saveProfile } from '@/lib/store'
import type { CandidateProfile } from '@/lib/profile'
import { canAccessApplicant } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    if (!(await canAccessApplicant(id))) {
      return Response.json({ error: 'Not authorized.' }, { status: 403 })
    }
    const profile = (await request.json()) as CandidateProfile
    const applicant = await saveProfile(id, profile)
    if (!applicant) return Response.json({ error: 'Applicant not found' }, { status: 404 })
    return Response.json({ applicant })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to save profile'
    return Response.json({ error: msg }, { status: 500 })
  }
}

export const runtime = 'nodejs'
