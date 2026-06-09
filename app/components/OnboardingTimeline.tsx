'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Circle, Clock, AlertTriangle, UserX, RefreshCw, Loader2 } from 'lucide-react'
import {
  type OnboardingTracker, type StageStatus, type StageState,
  STAGE_ORDER, STAGE_LABELS, STAGE_STATUS_LABELS, BLOCKER_LABELS,
  AUTO_STAGES, MANUAL_STAGES, stageState, daysSince,
} from '@/lib/onboarding'

const STATUS_ICON: Record<StageStatus, React.ComponentType<{ size?: number; className?: string }>> = {
  complete: CheckCircle2,
  in_progress: Clock,
  blocked: AlertTriangle,
  no_show: UserX,
  needs_update: RefreshCw,
  not_started: Circle,
}

const STATUS_TONE: Record<StageStatus, string> = {
  complete: 'text-green-600',
  in_progress: 'text-blue-600',
  blocked: 'text-red-600',
  no_show: 'text-red-600',
  needs_update: 'text-amber-600',
  not_started: 'text-slate-300',
}

// Statuses a coordinator can hand-set, in the order they read in the dropdown.
const EDITABLE_STATUSES: StageStatus[] = [
  'not_started', 'in_progress', 'complete', 'blocked', 'no_show', 'needs_update',
]

/** Coordinator-facing onboarding stage timeline (the throughput axis). */
export default function OnboardingTimeline({
  tracker, applicantId, editable = false,
}: {
  tracker: OnboardingTracker
  /** Required for editing; omit for a read-only timeline. */
  applicantId?: string
  /** Admins can hand-set the manual stages; everyone else sees it read-only. */
  editable?: boolean
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Onboarding pipeline</h2>
          {tracker.position.raw && (
            <p className="mt-1 text-xs text-slate-400">Position: {tracker.position.raw}</p>
          )}
        </div>
        {tracker.blockers.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1">
            {tracker.blockers.map(b => (
              <span key={b} className="inline-block rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                {BLOCKER_LABELS[b]}
              </span>
            ))}
          </div>
        )}
      </div>

      <ol className="space-y-0">
        {STAGE_ORDER.map((key, i) => {
          const s = stageState(tracker, key)
          const Icon = STATUS_ICON[s.status]
          const last = i === STAGE_ORDER.length - 1
          const canEdit = editable && !!applicantId && MANUAL_STAGES.includes(key)
          return (
            <li key={key} className="relative flex gap-3 pb-5">
              {!last && <span className="absolute left-[10px] top-6 h-full w-px bg-slate-200" aria-hidden />}
              <Icon size={21} className={`relative z-10 flex-shrink-0 ${STATUS_TONE[s.status]} bg-white`} />
              <div className="min-w-0 flex-1">
                {canEdit
                  ? <ManualStage applicantId={applicantId!} stage={s} />
                  : <ReadOnlyStage stage={s} />}
              </div>
            </li>
          )
        })}
      </ol>

      {(tracker.nextAction || tracker.nextActionOwner || tracker.nextActionDue) && (
        <div className="mt-1 rounded-xl border border-blue-200 bg-blue-50 p-3">
          <div className="text-[11px] font-bold uppercase tracking-widest text-blue-400">Next action</div>
          <div className="mt-0.5 text-sm font-semibold text-blue-900">{tracker.nextAction ?? '—'}</div>
          <div className="mt-0.5 flex gap-3 text-[11px] text-blue-700">
            {tracker.nextActionOwner && <span>Owner: {tracker.nextActionOwner}</span>}
            {tracker.nextActionDue && <span>Due: {tracker.nextActionDue}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

/** Static stage row — the auto-derived stages and any non-admin view. */
function ReadOnlyStage({ stage }: { stage: StageState }) {
  const age = daysSince(stage.date)
  const isAuto = AUTO_STAGES.includes(stage.key)
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm font-semibold ${stage.status === 'not_started' ? 'text-slate-400' : 'text-slate-800'}`}>
          {STAGE_LABELS[stage.key]}
        </span>
        <div className="flex items-center gap-1.5">
          {isAuto && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400" title="Set automatically from sign-in / packet status">
              Auto
            </span>
          )}
          <span className={`text-[11px] font-semibold ${STATUS_TONE[stage.status]}`}>
            {STAGE_STATUS_LABELS[stage.status]}
          </span>
        </div>
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
        {stage.date && <span>{stage.date}</span>}
        {age !== null && age >= 0 && <span>· {age}d ago</span>}
      </div>
      {stage.note && <p className="mt-1 text-xs text-slate-500">{stage.note}</p>}
    </>
  )
}

/** Editable manual stage — coordinator sets status, date, and an optional note. */
function ManualStage({ applicantId, stage }: { applicantId: string; stage: StageState }) {
  const router = useRouter()
  const [status, setStatus] = useState<StageStatus>(stage.status)
  const [date, setDate] = useState(stage.date ?? '')
  const [note, setNote] = useState(stage.note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(patch: { status?: StageStatus; date?: string; note?: string }) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/applicants/${applicantId}/onboarding`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          key: stage.key,
          status: patch.status ?? status,
          date: (patch.date ?? date) || null,
          note: (patch.note ?? note) || null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? 'Could not save.')
        return
      }
      router.refresh()
    } catch {
      setError('Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm font-semibold ${status === 'not_started' ? 'text-slate-400' : 'text-slate-800'}`}>
          {STAGE_LABELS[stage.key]}
        </span>
        <div className="flex items-center gap-1.5">
          {busy && <Loader2 size={13} className="animate-spin text-slate-400" />}
          <select
            aria-label={`${STAGE_LABELS[stage.key]} status`}
            value={status}
            disabled={busy}
            onChange={e => { const v = e.target.value as StageStatus; setStatus(v); save({ status: v }) }}
            className={`rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold ${STATUS_TONE[status]} disabled:opacity-60`}
          >
            {EDITABLE_STATUSES.map(st => (
              <option key={st} value={st} className="text-slate-700">{STAGE_STATUS_LABELS[st]}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <input
          type="date"
          aria-label={`${STAGE_LABELS[stage.key]} date`}
          value={date}
          disabled={busy}
          onChange={e => setDate(e.target.value)}
          onBlur={e => { if (e.target.value !== (stage.date ?? '')) save({ date: e.target.value }) }}
          className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600 disabled:opacity-60"
        />
        <input
          type="text"
          aria-label={`${STAGE_LABELS[stage.key]} note`}
          value={note}
          disabled={busy}
          placeholder="Add a note…"
          onChange={e => setNote(e.target.value)}
          onBlur={e => { if (e.target.value !== (stage.note ?? '')) save({ note: e.target.value }) }}
          className="min-w-0 flex-1 rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600 disabled:opacity-60"
        />
      </div>
      {error && <p className="mt-1 text-[11px] font-medium text-red-600">{error}</p>}
    </div>
  )
}
