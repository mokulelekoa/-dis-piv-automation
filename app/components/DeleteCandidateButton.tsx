'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2, AlertTriangle, X } from 'lucide-react'

/**
 * Admin-only candidate deletion with an explicit confirmation step. Deleting is
 * irreversible — it removes the applicant record, every uploaded form PDF and
 * photo, and the linked sign-in account — so we never delete on a single click.
 */
export default function DeleteCandidateButton({
  applicantId,
  name,
}: {
  applicantId: string
  name: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onConfirm() {
    setError(null)
    setDeleting(true)
    try {
      const res = await fetch(`/api/applicants/${applicantId}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? 'Could not delete this candidate.')
        return
      }
      setOpen(false)
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => { setError(null); setOpen(true) }}
        className="rounded-lg p-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
        title={`Delete ${name}`}
        aria-label={`Delete ${name}`}
      >
        <Trash2 size={16} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => !deleting && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50">
                  <AlertTriangle size={20} className="text-red-600" />
                </span>
                <div>
                  <h3 className="text-base font-black text-dis-navy">Delete {name}?</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    This permanently removes their candidate record, all uploaded VA forms and
                    photos, and their sign-in account. This cannot be undone.
                  </p>
                </div>
              </div>
              <button
                onClick={() => !deleting && setOpen(false)}
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
                disabled={deleting}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-dis-navy transition hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={deleting}
                className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {deleting && <Loader2 size={15} className="animate-spin" />}
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
