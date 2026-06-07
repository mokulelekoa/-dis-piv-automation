import { NextRequest } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import { getApplicant, getFormBytes, packetDownloadable, specLabel } from '@/lib/store'

/**
 * GET /api/applicants/[id]/package — merges every stored form PDF into one
 * combined review packet for the admin to download. 409 unless the packet is
 * fully uploaded, 100%, and issue-free (see packetDownloadable).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const applicant = await getApplicant(id)
  if (!applicant) return new Response(null, { status: 404 })
  if (!packetDownloadable(applicant)) {
    return Response.json({ error: 'Packet is not complete' }, { status: 409 })
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
