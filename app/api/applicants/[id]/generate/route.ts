import { NextRequest } from 'next/server'
import { getApplicant } from '@/lib/store'
import { lastFour, emptyProfile } from '@/lib/profile'
import { emptyAnswers } from '@/lib/forms/questions'
import { requiredFormsForRole, getSpec } from '@/lib/forms/specs'
import { fillForm } from '@/lib/forms/fill'

/**
 * GET /api/applicants/[id]/generate?specId=of306
 *
 * Fills the ORIGINAL VA template for one required form from the applicant's
 * stored profile + answers and returns it as a downloadable PDF. Signature and
 * signature-date fields are intentionally left blank — the applicant prints,
 * wet-signs in black ink, dates, and uploads the scan back.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const applicant = await getApplicant(id)
  if (!applicant) return Response.json({ error: 'Applicant not found' }, { status: 404 })

  const specId = request.nextUrl.searchParams.get('specId')
  if (!specId) return Response.json({ error: 'specId query param is required' }, { status: 400 })

  const required = requiredFormsForRole(applicant.role)
  if (!required.includes(specId)) {
    return Response.json({ error: `${specId} is not part of this applicant's packet` }, { status: 400 })
  }

  const profile = applicant.profile ?? emptyProfile()
  const answers = applicant.answers ?? emptyAnswers()

  const bytes = await fillForm(specId, profile, answers)

  const suffix: Record<string, string> = {
    of306: '306', selfcert: 'SC',
    bi_pharmacist: 'REQ', bi_pharmtech: 'REQ', bi_shipper: 'REQ',
  }
  const last4 = lastFour(profile.ssn) || '0000'
  const lastName = (profile.lastName || applicant.lastName || 'Candidate').replace(/[^A-Za-z]/g, '')
  const fileName = `${applicant.station}_${lastName}${last4}_${suffix[specId] ?? specId}.pdf`

  return new Response(new Blob([bytes as BlobPart], { type: 'application/pdf' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
      'X-Form-Label': (getSpec(specId)?.label ?? specId).replace(/[^\x20-\x7E]/g, '-'),
    },
  })
}

export const runtime = 'nodejs'
