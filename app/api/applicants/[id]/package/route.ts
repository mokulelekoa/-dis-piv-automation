import { NextRequest } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import { getApplicant, getFormBytes, packetReleasable, specLabel } from '@/lib/store'
import { canAccessApplicant } from '@/lib/auth'

/**
 * GET /api/applicants/[id]/package — merges every stored form PDF into one
 * combined credential packet to download. 409 unless the packet is complete AND
 * an admin has marked it reviewed (see packetReleasable) — completion alone does
 * not unlock the download.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!(await canAccessApplicant(id))) {
    return new Response(null, { status: 403 })
  }
  const applicant = await getApplicant(id)
  if (!applicant) return new Response(null, { status: 404 })
  if (!packetReleasable(applicant)) {
    return Response.json({ error: 'Packet is not reviewed and released yet' }, { status: 409 })
  }

  try {
    const merged = await PDFDocument.create()
    for (const form of applicant.forms) {
      const bytes = await getFormBytes(id, form.specId)
      if (!bytes) continue
      const src = await PDFDocument.load(bytes)
      const pages = await merged.copyPages(src, src.getPageIndices())
      pages.forEach(p => merged.addPage(p))
    }
    merged.setTitle(`${applicant.lastName}, ${applicant.firstName} — onboarding packet`)
    merged.setSubject(applicant.forms.map(f => specLabel(f.specId)).join(', '))

    const out = await merged.save()
    const safeName = `${applicant.station}_${applicant.lastName}_packet.pdf`.replace(/[^\x20-\x7E]/g, '_')
    return new Response(new Blob([out as BlobPart], { type: 'application/pdf' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to build packet'
    return Response.json({ error: msg }, { status: 500 })
  }
}

export const runtime = 'nodejs'
