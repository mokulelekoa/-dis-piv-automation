import { CheckCircle2, Circle, Clock, AlertTriangle, UserX, RefreshCw } from 'lucide-react'
import {
  type OnboardingTracker, type StageStatus,
  STAGE_ORDER, STAGE_LABELS, STAGE_STATUS_LABELS, BLOCKER_LABELS,
  stageState, daysSince,
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

/** Coordinator-facing onboarding stage timeline (the throughput axis). */
export default function OnboardingTimeline({ tracker }: { tracker: OnboardingTracker }) {
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
          const age = daysSince(s.date)
          const last = i === STAGE_ORDER.length - 1
          return (
            <li key={key} className="relative flex gap-3 pb-5">
              {!last && <span className="absolute left-[10px] top-6 h-full w-px bg-slate-200" aria-hidden />}
              <Icon size={21} className={`relative z-10 flex-shrink-0 ${STATUS_TONE[s.status]} bg-white`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-semibold ${s.status === 'not_started' ? 'text-slate-400' : 'text-slate-800'}`}>
                    {STAGE_LABELS[key]}
                  </span>
                  <span className={`text-[11px] font-semibold ${STATUS_TONE[s.status]}`}>
                    {STAGE_STATUS_LABELS[s.status]}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                  {s.date && <span>{s.date}</span>}
                  {age !== null && age >= 0 && <span>· {age}d ago</span>}
                </div>
                {s.note && <p className="mt-1 text-xs text-slate-500">{s.note}</p>}
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
