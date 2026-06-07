'use client'

import { useState } from 'react'
import { UserPlus, ShieldPlus, Loader2, Copy, Check, X } from 'lucide-react'

type Kind = 'candidate' | 'admin'

interface InviteResult {
  code: string
  email: string
  role: string
  expiresAt: string
  signupUrl: string
  applicantId?: string
}

/** Admin-side invite minting. Candidates and teammates can only join via a code. */
export default function InvitePanel({ roles }: { roles: [string, string][] }) {
  const [kind, setKind] = useState<Kind | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<InviteResult | null>(null)

  // Candidate fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState(roles[0]?.[0] ?? '')
  const [station, setStation] = useState('')

  function reset() {
    setKind(null)
    setError(null)
    setResult(null)
    setFirstName('')
    setLastName('')
    setEmail('')
    setRole(roles[0]?.[0] ?? '')
    setStation('')
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError('Enter an email address.')
      return
    }
    if (kind === 'candidate' && (!firstName.trim() || !lastName.trim())) {
      setError('First and last name are required.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          kind === 'admin'
            ? { kind, email }
            : { kind, email, firstName, lastName, role, station },
        ),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'Could not create the invite.')
        return
      }
      setResult(json as InviteResult)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Result card — shown after a successful mint.
  if (result) {
    return (
      <div className="rounded-2xl border border-dis-teal/30 bg-white p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-black text-dis-navy">
              Invite ready for {result.email}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Share this link or code. It&rsquo;s single-use and expires{' '}
              {new Date(result.expiresAt).toLocaleDateString()}.
            </p>
          </div>
          <button onClick={reset} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <CopyRow label="Signup link" value={result.signupUrl} />
        <CopyRow label="Access code" value={result.code} mono />

        <button
          onClick={reset}
          className="mt-4 rounded-xl bg-accent-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-accent-600"
        >
          Create another invite
        </button>
      </div>
    )
  }

  // Trigger buttons — collapsed state.
  if (!kind) {
    return (
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setKind('candidate')}
          className="flex items-center gap-2 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-accent-600"
        >
          <UserPlus size={16} /> Invite candidate
        </button>
        <button
          onClick={() => setKind('admin')}
          className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-dis-navy transition hover:bg-slate-50"
        >
          <ShieldPlus size={16} /> Invite teammate
        </button>
      </div>
    )
  }

  // Form state.
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-dis-navy">
          {kind === 'candidate' ? 'Invite a candidate' : 'Invite a teammate (admin)'}
        </h3>
        <button onClick={reset} className="text-slate-400 hover:text-slate-600" aria-label="Cancel">
          <X size={18} />
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        {kind === 'candidate' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              <input value={firstName} onChange={e => setFirstName(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Last name">
              <input value={lastName} onChange={e => setLastName(e.target.value)} className={inputCls} />
            </Field>
          </div>
        )}

        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="name@example.com"
            className={inputCls}
          />
        </Field>

        {kind === 'candidate' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role">
              <select value={role} onChange={e => setRole(e.target.value)} className={inputCls}>
                {roles.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="Station (optional)">
              <input value={station} onChange={e => setStation(e.target.value)} placeholder="766" className={inputCls} />
            </Field>
          </div>
        )}

        {error && <p className="text-xs font-medium text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="flex items-center justify-center gap-2 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-accent-600 disabled:opacity-60"
        >
          {submitting && <Loader2 size={15} className="animate-spin" />}
          Generate invite
        </button>
      </form>
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-dis-teal focus:outline-none focus:ring-2 focus:ring-dis-teal/25'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
      {children}
    </label>
  )
}

function CopyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable — the value is selectable in the field */
    }
  }
  return (
    <div className="mt-3">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={value}
          onFocus={e => e.currentTarget.select()}
          className={`w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 focus:outline-none ${mono ? 'font-mono tracking-wide' : ''}`}
        />
        <button
          onClick={copy}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
        >
          {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
