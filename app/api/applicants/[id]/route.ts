import { getApplicant } from '@/lib/store'
import { canAccessApplicant } from '@/lib/auth'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!(await canAccessApplicant(id))) {
    return Response.json({ error: 'Not authorized.' }, { status: 403 })
  }
  const applicant = await getApplicant(id)
  if (!applicant) {
    return Response.json({ error: 'Applicant not found' }, { status: 404 })
  }
  return Response.json({ applicant })
}

export const runtime = 'nodejs'
