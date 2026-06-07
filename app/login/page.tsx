'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Loader2, ArrowRight } from 'lucide-react'
import AuthShell from '@/app/components/AuthShell'

export default function ApplicantLogin() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const id = code.trim()
    if (!id) {
      setError('Enter the access code from your invitation email.')
      return
    }
    setChecking(true)
    try {
      const res = await fetch(`/api/applicants/${encodeURIComponent(id)}`)
      if (!res.ok) {
        setError('That access code didn’t match a packet. Check your invitation email.')
        return
      }
      router.push(`/applicant/${encodeURIComponent(id)}`)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <AuthShell
      heading="Your CMOP onboarding, simplified"
      blurb="Upload your ID once and we fill every VA form we can. You only answer what a document can't prove — then print, sign, and upload."
    >
      <h2 className="text-xl font-black text-dis-navy">Candidate sign in</h2>
      <p className="mt-1 text-sm text-slate-500">
        Enter the access code from your onboarding invitation.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-400">Access code</span>
          <span className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 focus-within:border-dis-teal focus-within:ring-2 focus-within:ring-dis-teal/25">
            <KeyRound size={15} className="text-slate-400" />
            <input
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="e.g. 6a2067a5-0e6b-…"
              className="w-full bg-transparent font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
          </span>
        </label>

        {error && <p className="text-xs font-medium text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={checking}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-accent-600 disabled:opacity-60"
        >
          {checking ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
          Open my packet
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-3 text-center">
        <p className="text-xs text-slate-500">Starting fresh from an invitation?</p>
        <a href="/start" className="mt-1 inline-block text-sm font-bold text-dis-teal hover:underline">
          Begin a new packet &rarr;
        </a>
      </div>

      <p className="mt-4 text-center text-xs text-slate-400">
        Administrator?{' '}
        <a href="/admin/login" className="font-semibold text-dis-navy hover:underline">
          Sign in to the console
        </a>
      </p>
    </AuthShell>
  )
}
