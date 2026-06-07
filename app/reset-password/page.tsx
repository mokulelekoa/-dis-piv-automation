'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Loader2, ShieldCheck } from 'lucide-react'
import AuthShell from '@/app/components/AuthShell'
import { createBrowserSupabase } from '@/lib/supabase/browser'

export default function ResetPassword() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // null = still checking, true/false = whether we have a valid recovery session.
  const [ready, setReady] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const supabase = createBrowserSupabase()
        const { data } = await supabase.auth.getUser()
        if (active) setReady(!!data.user)
      } catch {
        if (active) setReady(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Choose a password of at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Those passwords don’t match.')
      return
    }
    setSubmitting(true)
    try {
      const supabase = createBrowserSupabase()
      const { data, error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError('Couldn’t update your password. The link may have expired — request a new one.')
        return
      }
      // Now signed in with the new password — send them to the right home.
      const meta = data.user?.app_metadata ?? {}
      if (meta.role === 'admin') {
        router.push('/admin')
      } else if (meta.role === 'candidate' && typeof meta.applicant_id === 'string') {
        router.push(`/applicant/${meta.applicant_id}`)
      } else {
        router.push('/')
      }
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (ready === false) {
    return (
      <AuthShell heading="Choose a new password" blurb="Set a new password to get back into your account.">
        <h2 className="text-xl font-black text-dis-navy">This link has expired</h2>
        <p className="mt-2 text-sm text-slate-500">
          Password reset links are single-use and time-limited. Request a fresh one and try again.
        </p>
        <a
          href="/forgot-password"
          className="mt-6 inline-block rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-accent-600"
        >
          Request a new link
        </a>
      </AuthShell>
    )
  }

  return (
    <AuthShell heading="Choose a new password" blurb="Set a new password to get back into your account.">
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-dis-teal" />
        <h2 className="text-xl font-black text-dis-navy">Set a new password</h2>
      </div>
      <p className="mt-1 text-sm text-slate-500">Make it at least 8 characters.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Labeled label="New password" icon={<Lock size={15} className="text-slate-400" />}>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            disabled={ready === null}
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
          />
        </Labeled>
        <Labeled label="Confirm new password" icon={<Lock size={15} className="text-slate-400" />}>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Re-enter your password"
            autoComplete="new-password"
            disabled={ready === null}
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
          />
        </Labeled>

        {error && <p className="text-xs font-medium text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting || ready === null}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-accent-600 disabled:opacity-60"
        >
          {(submitting || ready === null) && <Loader2 size={15} className="animate-spin" />}
          Update password
        </button>
      </form>
    </AuthShell>
  )
}

function Labeled({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
      <span className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 focus-within:border-dis-teal focus-within:ring-2 focus-within:ring-dis-teal/25">
        {icon}
        {children}
      </span>
    </label>
  )
}
