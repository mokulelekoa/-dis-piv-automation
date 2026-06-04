import { NextRequest } from 'next/server'
import { listApplicants, createApplicant } from '@/lib/store'
import { ROLE_LABELS, type PacketRole } from '@/lib/forms/specs'

export async function GET() {
  const applicants = await listApplicants()
  return Response.json({ applicants })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { firstName, lastName, email, role, station } = body ?? {}
    if (!firstName || !lastName || !role) {
      return Response.json({ error: 'firstName, lastName, and role are required' }, { status: 400 })
    }
    if (!(role in ROLE_LABELS)) {
      return Response.json({ error: `Invalid role: ${role}` }, { status: 400 })
    }
    const applicant = await createApplicant({
      firstName, lastName, email: email ?? '', role: role as PacketRole, station,
    })
    return Response.json({ applicant }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create applicant'
    return Response.json({ error: msg }, { status: 500 })
  }
}

export const runtime = 'nodejs'
