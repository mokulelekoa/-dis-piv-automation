import { NextRequest } from 'next/server'
import { saveAnswers } from '@/lib/store'
import { validateAnswers, type PacketAnswers } from '@/lib/forms/questions'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const answers = (await request.json()) as PacketAnswers
    const applicant = await saveAnswers(id, answers)
    if (!applicant) return Response.json({ error: 'Applicant not found' }, { status: 404 })
    return Response.json({ applicant, problems: validateAnswers(answers) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to save answers'
    return Response.json({ error: msg }, { status: 500 })
  }
}

export const runtime = 'nodejs'
