'use client'

import { useState } from 'react'
import { UserPlus, ShieldPlus, Loader2, MailCheck, X } from 'lucide-react'

type Kind = 'candidate' | 'teammate'
type AccessLevel = 'coordinator' | 'admin'

interface InviteResult {
  emailed: boolean
  email: string
  role: string
  applicantId?: string
}

/**
 * Admin-side invite minting. Candidates and teammates can only join via a code.
 * Only full admins may invite teammates (`canInviteTeammates`); coordinators see
 * the candidate invite only.
 */
export default function InvitePanel({
  roles, canInviteTeammates,
}: {
  roles: [string, string][]; canInviteTeammates: boolean
}) {
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
  // Teammate field — defaults to the least-privilege tier.
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('coordinator')

  function reset() {
    setKind(null)
    setError(null)
    setResult(null)
    setFirstName('')
    setLastName('')
    setEmail('')
    setRole(roles[0]?.[0] ?? '')
    setStation('')
    setAccessLevel('coordinator')
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
          kind === 'teammate'
            ? { kind, email, accessLevel }
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

  // Result card — shown after the invite email goes out.
  if (result) {
    return (
      <div className="rounded-2xl border border-dis-teal/30 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <MailCheck size={20} className="mt-0.5 flex-shrink-0 text-dis-teal" />
            <div>
              <h3 className="text-sm font-black text-dis-navy">
                Invitation emailed to {result.email}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {result.role === 'candidate'
                  ? 'They’ll get a link to set a password, then drop into their onboarding packet.'
                  : 'They’ll get a link to set a password and join as a teammate.'}
              </p>
            </div>
          </div>
          <button onClick={reset} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <button
          onClick={reset}
          className="mt-4 rounded-xl bg-accent-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-accent-600"
        >
          Invite someone else
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
        {canInviteTeammates && (
          <button
            onClick={() => setKind('teammate')}
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-dis-navy transition hover:bg-slate-50"
          >
            <ShieldPlus size={16} /> Invite teammate
          </button>
        )}
      </div>
    )
  }

  // Form state.
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-dis-navy">
          {kind === 'candidate' ? 'Invite a candidate' : 'Invite a teammate'}
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

        {kind === 'teammate' && (
          <Field label="Access level">
            <select
              value={accessLevel}
              onChange={e => setAccessLevel(e.target.value as AccessLevel)}
              className={inputCls}
            >
              <option value="coordinator">Coordinator — manage candidates (no delete, no inviting teammates)</option>
              <option value="admin">Administrator — full access</option>
            </select>
          </Field>
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
