'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, ArchiveRestore, Loader2, X } from 'lucide-react'

/**
 * Admin-only archive / restore for a candidate. Archiving keeps the record and
 * every uploaded form and photo, but revokes the candidate's sign-in — a
 * reversible alternative to deletion. Restoring lifts the sign-in ban. Both go
 * through an explicit confirmation so neither happens on a stray click.
 */
export default function ArchiveCandidateButton({
  applicantId,
  name,
  archived,
}: {
  applicantId: string
  name: string
  archived: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const action = archived ? 'unarchive' : 'archive'
  const verb = archived ? 'Restore' : 'Archive'

  async function onConfirm() {
    setError(null)
    setWorking(true)
    try {
      const res = await fetch(`/api/applicants/${applicantId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? `Could not ${verb.toLowerCase()} this candidate.`)
        return
      }
      setOpen(false)
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <>
      <button
        onClick={() => { setError(null); setOpen(true) }}
        className="rounded-lg p-1.5 text-slate-500 transition hover:bg-amber-50 hover:text-amber-700"
        title={`${verb} ${name}`}
        aria-label={`${verb} ${name}`}
      >
        {archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => !working && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-50">
                  {archived
                    ? <ArchiveRestore size={20} className="text-amber-700" />
                    : <Archive size={20} className="text-amber-700" />}
                </span>
                <div>
                  <h3 className="text-base font-black text-dis-navy">{verb} {name}?</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {archived
                      ? 'This restores the candidate to your active pipeline and re-enables their sign-in. Their record and uploads were never removed.'
                      : 'This keeps their record and all uploaded forms and photos, but revokes their sign-in. You can restore them at any time.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => !working && setOpen(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Cancel"
              >
                <X size={18} />
              </button>
            </div>

            {error && <p className="mt-3 text-xs font-medium text-red-600">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                disabled={working}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-dis-navy transition hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={working}
                className="flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-700 disabled:opacity-60"
              >
                {working && <Loader2 size={15} className="animate-spin" />}
                {verb}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
