'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Lock, Mail, KeyRound, Loader2, MailCheck } from 'lucide-react'
import AuthShell from '@/app/components/AuthShell'

export default function Signup() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  )
}

function SignupForm() {
  const params = useSearchParams()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [code, setCode] = useState(params.get('code') ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password || !code.trim()) {
      setError('Email, password, and your access code are all required.')
      return
    }
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
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, code: code.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'Could not create your account. Check your access code and try again.')
        return
      }
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
        heading="Your CMOP onboarding, simplified"
        blurb="Upload your ID and answer a few guided questions — we complete every VA form for you. Then just review, print, sign, and upload."
      >
        <div className="flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-dis-teal/10">
            <MailCheck size={22} className="text-dis-teal" />
          </span>
          <h2 className="mt-4 text-xl font-black text-dis-navy">Check your email</h2>
          <p className="mt-2 text-sm text-slate-500">
            We sent a confirmation link to <span className="font-semibold text-slate-700">{email.trim().toLowerCase()}</span>.
            Click it to activate your account, then sign in.
          </p>
          <a
            href="/login"
            className="mt-6 inline-block rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-accent-600"
          >
            Go to sign in
          </a>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      heading="Your CMOP onboarding, simplified"
      blurb="Upload your ID and answer a few guided questions — we complete every VA form for you. Then just review, print, sign, and upload."
    >
      <h2 className="text-xl font-black text-dis-navy">Create your account</h2>
      <p className="mt-1 text-sm text-slate-500">Use the access code from your invitation email.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Labeled label="Access code" icon={<KeyRound size={15} className="text-slate-400" />}>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="CMOP-XXXX-XXXX-XXXX-XXXX"
            autoComplete="off"
            className="w-full bg-transparent text-sm tracking-wide text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </Labeled>
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
        <Labeled label="Password" icon={<Lock size={15} className="text-slate-400" />}>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </Labeled>
        <Labeled label="Confirm password" icon={<Lock size={15} className="text-slate-400" />}>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Re-enter your password"
            autoComplete="new-password"
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
          Create account
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-400">
        Already have an account?{' '}
        <a href="/login" className="font-semibold text-dis-teal hover:underline">Sign in</a>
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
