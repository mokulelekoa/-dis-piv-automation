import { getApplicant } from '@/lib/store'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const applicant = await getApplicant(id)
  if (!applicant) {
    return Response.json({ error: 'Applicant not found' }, { status: 404 })
  }
  return Response.json({ applicant })
}

export const runtime = 'nodejs'
