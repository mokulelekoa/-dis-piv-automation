import Link from 'next/link'
import { listApplicants, packetCompleteness, totalMissingCount, packetDownloadable, type Applicant } from '@/lib/store'
import { ROLE_LABELS } from '@/lib/forms/specs'
import { STATUS_LABELS, STATUS_PILL, formHealth, HEALTH_DOT, isPacketReleased } from '@/app/components/status'
import Avatar from '@/app/components/Avatar'
import BrandHeader from '@/app/components/BrandHeader'
import InvitePanel from '@/app/components/InvitePanel'
import UserBadge from '@/app/components/UserBadge'
import PacketReviewActions from '@/app/components/PacketReviewActions'
import DeleteCandidateButton from '@/app/components/DeleteCandidateButton'
import ResetPasswordButton from '@/app/components/ResetPasswordButton'
import ArchiveCandidateButton from '@/app/components/ArchiveCandidateButton'
import { requireAdmin } from '@/lib/auth'
import { loginActivityByApplicant, timeAgo, type LoginActivity } from '@/lib/activity'
import {
  type Queue, QUEUE_LABELS, QUEUE_ORDER, BLOCKER_LABELS, STAGE_LABELS,
  emptyTracker, normalizePosition, queuesFor, currentStage, ageAtCurrentStage, applyAutoStages,
} from '@/lib/onboarding'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function trackerOf(a: Applicant) {
  return a.onboarding ?? emptyTracker(normalizePosition(ROLE_LABELS[a.role]))
}

/** Storage tracker overlaid with the two auto-derived stages (sign-in, packet release). */
function effectiveTracker(a: Applicant, act?: LoginActivity) {
  return applyAutoStages(trackerOf(a), {
    signedIn: !!act?.lastSignInAt,
    signedInAt: act?.lastSignInAt ?? undefined,
    packetReleased: isPacketReleased(a.status),
  })
}

export default async function AdminDashboard() {
  const admin = await requireAdmin()
  const allApplicants = await listApplicants()
  const activity = await loginActivityByApplicant()

  // Archived candidates stay in the database but are kept out of the active
  // pipeline (table, queues) and surfaced in their own restorable section.
  const applicants = allApplicants.filter(a => !a.archived)
  const archived = allApplicants.filter(a => a.archived)

  // Operational queue counts (a candidate can appear in several). Active only.
  const queueCounts = {} as Record<Queue, number>
  for (const q of QUEUE_ORDER) queueCounts[q] = 0
  for (const a of applicants) for (const q of queuesFor(effectiveTracker(a, activity.get(a.id)))) queueCounts[q]++

  return (
    <main className="min-h-screen bg-blue-50">
      <BrandHeader subtitle="Onboarding Command Center" href="/admin"
        right={<UserBadge email={admin.email ?? null} role="admin" />} />
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-6">
          <h1 className="text-2xl font-black text-slate-900">CMOP Onboarding Command Center</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every candidate&rsquo;s VA onboarding stage, blockers, and packet readiness in one view.
            Work the queues top to bottom &mdash; blocked and no-show candidates first.
          </p>
        </header>

        {/* Invite candidates and teammates — the only way new accounts are created. */}
        <div className="mb-6">
          <InvitePanel roles={Object.entries(ROLE_LABELS)} />
        </div>

        {/* Operational queues */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {QUEUE_ORDER.map(q => (
            <QueueCard key={q} queue={q} value={queueCounts[q]} />
          ))}
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              <tr>
                <th className="px-4 py-3">Candidate</th>
                <th className="px-4 py-3">Role / shift</th>
                <th className="px-4 py-3">Onboarding stage</th>
                <th className="px-4 py-3">Blockers</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3">Packet</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Credential packet</th>
                <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {applicants.map(a => {
                const act = activity.get(a.id)
                const t = effectiveTracker(a, act)
                const pct = packetCompleteness(a)
                const open = totalMissingCount(a)
                const stage = currentStage(t)
                const age = ageAtCurrentStage(t)
                const stale = age !== null && age >= 7
                return (
                  <tr key={a.id} className="group relative cursor-pointer hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar firstName={a.firstName} lastName={a.lastName} size={36}
                          photoUrl={a.photo ? `/api/applicants/${a.id}/photo` : undefined} />
                        <div>
                          <Link href={`/admin/applicants/${a.id}`} className="font-semibold text-slate-900 after:absolute after:inset-0 after:content-[''] hover:text-blue-700">
                            {a.lastName}, {a.firstName}
                          </Link>
                          <div className="text-[11px] text-slate-400">Station {a.station}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {ROLE_LABELS[a.role]}
                      {t.position.shift !== 'unknown' && (
                        <span className="ml-1 text-[11px] text-slate-400">· {t.position.shift}</span>
                      )}
                      {t.position.certified !== undefined && (
                        <div className="text-[11px] text-slate-400">{t.position.certified ? 'Certified' : 'Non-certified'}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {STAGE_LABELS[stage]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {t.blockers.length === 0
                        ? <span className="text-xs text-slate-300">&mdash;</span>
                        : (
                          <div className="flex flex-wrap gap-1">
                            {t.blockers.map(b => (
                              <span key={b} className="inline-block rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                                {BLOCKER_LABELS[b]}
                              </span>
                            ))}
                          </div>
                        )}
                    </td>
                    <td className="px-4 py-3">
                      {age === null
                        ? <span className="text-xs text-slate-300">&mdash;</span>
                        : <span className={`text-xs font-semibold ${stale ? 'text-red-600' : 'text-slate-500'}`}>{age}d</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {a.forms.map(f => (
                          <span key={f.specId} className={`h-2.5 w-2.5 rounded-full ${HEALTH_DOT[formHealth(f)]}`}
                            title={`${f.specId}: ${formHealth(f)}`} />
                        ))}
                        <span className="ml-1 text-[11px] font-semibold text-slate-500">{pct}%</span>
                        {open > 0 && <span className="text-[11px] font-semibold text-amber-600">· {open} open</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {act?.lastSignInAt
                        ? <span className="text-xs font-semibold text-slate-600">{timeAgo(act.lastSignInAt)}</span>
                        : act
                          ? <span className="text-[11px] font-semibold text-amber-600">Invited &middot; never</span>
                          : <span className="text-xs text-slate-300">&mdash;</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_PILL[a.status]}`}>
                        {STATUS_LABELS[a.status]}
                      </span>
                    </td>
                    <td className="relative z-10 px-4 py-3">
                      <PacketReviewActions applicantId={a.id} status={a.status} downloadable={packetDownloadable(a)}
                        candidate={{ firstName: a.firstName, lastName: a.lastName, station: a.station }} />
                    </td>
                    <td className="relative z-10 px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <ResetPasswordButton applicantId={a.id} name={`${a.firstName} ${a.lastName}`} email={a.email} hasAccount={!!act} />
                        <ArchiveCandidateButton applicantId={a.id} name={`${a.firstName} ${a.lastName}`} archived={false} />
                        <DeleteCandidateButton applicantId={a.id} name={`${a.firstName} ${a.lastName}`} />
                      </div>
                    </td>
                  </tr>
                )
              })}
              {applicants.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-slate-400">No candidates yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {archived.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Archived &middot; {archived.length}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Records kept on file with sign-in revoked. Restore to return a candidate to the active pipeline.
            </p>
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <ul className="divide-y divide-slate-100">
                {archived.map(a => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar firstName={a.firstName} lastName={a.lastName} size={32}
                      photoUrl={a.photo ? `/api/applicants/${a.id}/photo` : undefined} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/admin/applicants/${a.id}`} className="font-semibold text-slate-700 hover:text-blue-700">
                        {a.lastName}, {a.firstName}
                      </Link>
                      <div className="text-[11px] text-slate-400">
                        {ROLE_LABELS[a.role]} &middot; Station {a.station}
                        {a.archived && <> &middot; archived {timeAgo(a.archived.at)}</>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <ArchiveCandidateButton applicantId={a.id} name={`${a.firstName} ${a.lastName}`} archived={true} />
                      <DeleteCandidateButton applicantId={a.id} name={`${a.firstName} ${a.lastName}`} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

function QueueCard({ queue, value }: { queue: Queue; value: number }) {
  const tone =
    queue === 'blocked' || queue === 'no_show' ? 'text-red-600' :
    queue === 'ready_for_start' ? 'text-green-600' : 'text-amber-600'
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
      <div className={`text-2xl font-black ${value === 0 ? 'text-slate-300' : tone}`}>{value}</div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-400">
        {QUEUE_LABELS[queue]}
      </div>
    </div>
  )
}
