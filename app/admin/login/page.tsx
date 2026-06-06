'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Mail, Loader2 } from 'lucide-react'
import AuthShell from '@/app/components/AuthShell'

export default function AdminLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setSubmitting(true)
    // Prototype: no auth backend yet — accept any credentials and enter the console.
    router.push('/admin')
  }

  return (
    <AuthShell
      heading="Onboarding Command Center"
      blurb="Coordinator access to every candidate's VA onboarding stage, blockers, and packet readiness — in one place."
    >
      <h2 className="text-xl font-black text-dis-navy">Coordinator sign in</h2>
      <p className="mt-1 text-sm text-slate-500">Use your DIS Consulting credentials.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Labeled label="Work email" icon={<Mail size={15} className="text-slate-400" />}>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@disconsulting.com"
            autoComplete="username"
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </Labeled>
        <Labeled label="Password" icon={<Lock size={15} className="text-slate-400" />}>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
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
          Sign in
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-400">
        Candidate?{' '}
        <a href="/login" className="font-semibold text-dis-teal hover:underline">Go to the candidate portal</a>
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
