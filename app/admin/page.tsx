import Link from 'next/link'
import { listApplicants, packetCompleteness, totalMissingCount } from '@/lib/store'
import { ROLE_LABELS } from '@/lib/forms/specs'
import { STATUS_LABELS, STATUS_PILL, formHealth, HEALTH_DOT } from '@/app/components/status'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function AdminDashboard() {
  const applicants = await listApplicants()

  const counts = {
    review: applicants.filter(a => a.status === 'READY_FOR_REVIEW').length,
    progress: applicants.filter(a => a.status === 'IN_PROGRESS' || a.status === 'DRAFT').length,
    blocked: applicants.filter(a => a.status === 'REJECTED').length,
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <header className="mb-6">
          <h1 className="text-2xl font-black text-slate-900">PIV Packet Tracker</h1>
          <p className="mt-1 text-sm text-slate-500">
            CMOP onboarding packets across all candidates. Each row scans the uploaded VA forms and
            reports exactly what&rsquo;s missing before it reaches VA review.
          </p>
        </header>

        <div className="mb-6 grid grid-cols-3 gap-3">
          <Stat label="Ready for review" value={counts.review} tone="blue" />
          <Stat label="Still collecting" value={counts.progress} tone="amber" />
          <Stat label="Needs fixes" value={counts.blocked} tone="red" />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              <tr>
                <th className="px-4 py-3">Candidate</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Forms</th>
                <th className="px-4 py-3">Complete</th>
                <th className="px-4 py-3">Open items</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {applicants.map(a => {
                const pct = packetCompleteness(a)
                const open = totalMissingCount(a)
                return (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/applicants/${a.id}`} className="font-semibold text-slate-900 hover:text-blue-700">
                        {a.lastName}, {a.firstName}
                      </Link>
                      <div className="text-[11px] text-slate-400">Station {a.station}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{ROLE_LABELS[a.role]}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {a.forms.map(f => (
                          <span key={f.specId} className={`h-2.5 w-2.5 rounded-full ${HEALTH_DOT[formHealth(f)]}`}
                            title={`${f.specId}: ${formHealth(f)}`} />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
                          <div className={`h-full ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-500">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {open === 0
                        ? <span className="text-xs font-semibold text-green-600">None</span>
                        : <span className="text-xs font-semibold text-amber-600">{open}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_PILL[a.status]}`}>
                        {STATUS_LABELS[a.status]}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {applicants.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">No candidates yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'blue' | 'amber' | 'red' }) {
  const ring = tone === 'blue' ? 'text-blue-700' : tone === 'amber' ? 'text-amber-600' : 'text-red-600'
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className={`text-2xl font-black ${ring}`}>{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</div>
    </div>
  )
}
