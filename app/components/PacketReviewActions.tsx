'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, CheckCircle2, Loader2, Mail } from 'lucide-react'
import type { PacketStatus } from '@/lib/store'

/** Trigger a download or mailto: from a synthetic anchor without unloading the page. */
function clickAway(href: string, download?: string) {
  const a = document.createElement('a')
  a.href = href
  if (download) a.download = download
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/**
 * Per-candidate packet gate for the admin. A complete packet sits at
 * READY_FOR_REVIEW with a "Mark reviewed" button; clicking it flips the status
 * to REVIEWED (server-enforced), after which the merged-packet download appears.
 * Completion never auto-unlocks the download — a human must sign off first.
 */
export default function PacketReviewActions({
  applicantId, status, downloadable, candidate, size = 'sm',
}: {
  applicantId: string
  status: PacketStatus
  /** packetDownloadable(applicant): every form uploaded, stored, 100%, issue-free. */
  downloadable: boolean
  /** Used to label the emailed packet's filename, subject, and body. */
  candidate: { firstName: string; lastName: string; station: string }
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

  // Hand the merged packet to the admin's default mail app (Outlook). mailto: can't
  // carry an attachment and the packet route is auth-gated, so we download the PDF
  // first and the draft tells the admin to attach that just-saved file.
  function emailPacket() {
    const file = `${candidate.station}_${candidate.lastName}_packet.pdf`.replace(/[^\x20-\x7E]/g, '_')
    clickAway(`/api/applicants/${applicantId}/package`, file)

    const subject = `CMOP onboarding packet — ${candidate.lastName}, ${candidate.firstName}`
    const body =
      `The completed CMOP onboarding credential packet for ${candidate.firstName} ${candidate.lastName} (Station ${candidate.station}) is attached.\r\n\r\n` +
      `Note: the packet file "${file}" was just downloaded to this computer — please attach it to this message before sending.`
    clickAway(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
  }

  if (released && downloadable) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <a
          href={`/api/applicants/${applicantId}/package`}
          className={`inline-flex items-center gap-1.5 rounded-lg bg-accent-500 ${pad} font-bold text-white transition hover:bg-accent-600`}
        >
          <Download size={icon} /> Download packet
        </a>
        <button
          type="button"
          onClick={emailPacket}
          title="Email packet (opens Outlook)"
          aria-label="Email packet"
          className={`inline-flex items-center gap-1.5 rounded-lg border border-accent-300 bg-white ${pad} font-bold text-accent-700 transition hover:bg-accent-50`}
        >
          <Mail size={icon} />{size === 'lg' ? ' Email packet' : ''}
        </button>
      </div>
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
