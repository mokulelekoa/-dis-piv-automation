'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, CheckCircle2, Loader2 } from 'lucide-react'
import type { PacketStatus } from '@/lib/store'

/**
 * Per-candidate packet gate for the admin. A complete packet sits at
 * READY_FOR_REVIEW with a "Mark reviewed" button; clicking it flips the status
 * to REVIEWED (server-enforced), after which the merged-packet download appears.
 * Completion never auto-unlocks the download — a human must sign off first.
 */
export default function PacketReviewActions({
  applicantId, status, downloadable, size = 'sm',
}: {
  applicantId: string
  status: PacketStatus
  /** packetDownloadable(applicant): every form uploaded, stored, 100%, issue-free. */
  downloadable: boolean
  size?: 'sm' | 'lg'
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const released = status === 'REVIEWED' || status === 'SUBMITTED' || status === 'ACCEPTED'
  const reviewable = status === 'READY_FOR_REVIEW' && downloadable

  const pad = size === 'lg' ? 'px-4 py-2 text-sm' : 'px-2.5 py-1.5 text-xs'
  const icon = size === 'lg' ? 16 : 14

  async function review() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/applicants/${applicantId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'review' }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? 'Could not mark reviewed.')
        return
      }
      router.refresh()
    } catch {
      setError('Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  if (released && downloadable) {
    return (
      <a
        href={`/api/applicants/${applicantId}/package`}
        className={`inline-flex items-center gap-1.5 rounded-lg bg-accent-500 ${pad} font-bold text-white transition hover:bg-accent-600`}
      >
        <Download size={icon} /> Download packet
      </a>
    )
  }

  if (reviewable) {
    return (
      <div>
        <button
          onClick={review}
          disabled={busy}
          className={`inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-teal-50 ${pad} font-bold text-teal-700 transition hover:bg-teal-100 disabled:opacity-60`}
        >
          {busy ? <Loader2 size={icon} className="animate-spin" /> : <CheckCircle2 size={icon} />}
          Mark reviewed
        </button>
        {error && <p className="mt-1 text-[11px] font-medium text-red-600">{error}</p>}
      </div>
    )
  }

  return <span className="text-xs text-slate-300">&mdash;</span>
}
