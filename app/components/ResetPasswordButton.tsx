'use client'

import { useState } from 'react'
import { KeyRound, Loader2, MailCheck, X } from 'lucide-react'

/**
 * Admin-triggered password reset. We never set or see the user's password —
 * clicking emails them a secure link to set a new one (the existing recovery
 * flow). Disabled until the user actually has an account (an invited candidate
 * who has never been provisioned has nothing to reset).
 */
export default function ResetPasswordButton({
  applicantId,
  name,
  email,
  hasAccount,
}: {
  applicantId: string
  name: string
  email: string
  hasAccount: boolean
}) {
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onConfirm() {
    setError(null)
    setSending(true)
    try {
      const res = await fetch(`/api/applicants/${applicantId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'reset-password' }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? 'Could not send the reset link.')
        return
      }
      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSending(false)
    }
  }

  function close() {
    setOpen(false)
    setSent(false)
    setError(null)
  }

  return (
    <>
      <button
        onClick={() => { setError(null); setSent(false); setOpen(true) }}
        disabled={!hasAccount}
        className="rounded-lg p-1.5 text-slate-300 transition hover:bg-dis-teal/10 hover:text-dis-teal disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-300"
        title={hasAccount ? `Reset password for ${name}` : 'No account yet — send an invite first'}
        aria-label={`Reset password for ${name}`}
      >
        <KeyRound size={16} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => !sending && close()}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            {sent ? (
              <>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-dis-teal/10">
                    <MailCheck size={20} className="text-dis-teal" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-dis-navy">Reset link sent</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      We emailed <span className="font-semibold text-slate-700">{email}</span> a secure link to set a
                      new password. Their current password keeps working until they choose a new one.
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex justify-end">
                  <button
                    onClick={close}
                    className="rounded-xl bg-accent-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-accent-600"
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-dis-teal/10">
                      <KeyRound size={20} className="text-dis-teal" />
                    </span>
                    <div>
                      <h3 className="text-base font-black text-dis-navy">Reset password for {name}?</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        We&rsquo;ll email <span className="font-semibold text-slate-700">{email}</span> a secure link to
                        set a new password. You won&rsquo;t see or set the password yourself.
                      </p>
                    </div>
                  </div>
                  <button onClick={close} className="text-slate-400 hover:text-slate-600" aria-label="Cancel">
                    <X size={18} />
                  </button>
                </div>

                {error && <p className="mt-3 text-xs font-medium text-red-600">{error}</p>}

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    onClick={close}
                    disabled={sending}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-dis-navy transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onConfirm}
                    disabled={sending}
                    className="flex items-center justify-center gap-2 rounded-xl bg-accent-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-accent-600 disabled:opacity-60"
                  >
                    {sending && <Loader2 size={15} className="animate-spin" />}
                    Send reset link
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
