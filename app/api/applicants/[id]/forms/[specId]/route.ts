import { NextRequest } from 'next/server'
import { promises as fs } from 'fs'
import { getApplicant, formPath } from '@/lib/store'

/**
 * GET /api/applicants/[id]/forms/[specId] — streams the stored, uploaded form
 * PDF inline so it opens in the browser. 404 if the form hasn't been uploaded
 * (or, like seed rows, has metadata but no bytes on disk).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; specId: string }> },
) {
  const { id, specId } = await params
  const applicant = await getApplicant(id)
  const form = applicant?.forms.find(f => f.specId === specId)
  if (!form?.stored) return new Response(null, { status: 404 })

  try {
    const bytes = await fs.readFile(formPath(id, specId))
    // Use the original upload name for the download/inline title (sanitized to ASCII).
    const name = (form.fileName ?? `${specId}.pdf`).replace(/[^\x20-\x7E]/g, '_')
    return new Response(new Blob([bytes as BlobPart], { type: 'application/pdf' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${name}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return new Response(null, { status: 404 })
  }
}

export const runtime = 'nodejs'
