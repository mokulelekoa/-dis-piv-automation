'use client'

import { useState } from 'react'
import { Mail, Loader2, MailCheck } from 'lucide-react'
import AuthShell from '@/app/components/AuthShell'
import { createBrowserSupabase } from '@/lib/supabase/browser'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError('Enter your email and we’ll send a reset link.')
      return
    }
    setSubmitting(true)
    try {
      const supabase = createBrowserSupabase()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      })
      if (resetError) {
        setError('Something went wrong. Please try again.')
        return
      }
      // Always show success — don't reveal whether an account exists.
      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <AuthShell
        heading="Reset your password"
        blurb="We’ll email you a secure link to choose a new password."
      >
        <div className="flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-dis-teal/10">
            <MailCheck size={22} className="text-dis-teal" />
          </span>
          <h2 className="mt-4 text-xl font-black text-dis-navy">Check your email</h2>
          <p className="mt-2 text-sm text-slate-500">
            If an account exists for <span className="font-semibold text-slate-700">{email.trim().toLowerCase()}</span>,
            a password reset link is on its way. The link expires shortly, so use it soon.
          </p>
          <a
            href="/login"
            className="mt-6 inline-block rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-accent-600"
          >
            Back to sign in
          </a>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      heading="Reset your password"
      blurb="We’ll email you a secure link to choose a new password."
    >
      <h2 className="text-xl font-black text-dis-navy">Forgot your password?</h2>
      <p className="mt-1 text-sm text-slate-500">Enter your email and we’ll send a reset link.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Labeled label="Email" icon={<Mail size={15} className="text-slate-400" />}>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="username"
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </Labeled>

        {error && <p className="text-xs font-medium text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-accent-600 disabled:opacity-60"
        >
          {submitting && <Loader2 size={15} className="animate-spin" />}
          Send reset link
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-400">
        Remembered it?{' '}
        <a href="/login" className="font-semibold text-dis-teal hover:underline">Back to sign in</a>
      </p>
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
