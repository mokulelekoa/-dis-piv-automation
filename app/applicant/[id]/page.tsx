import { notFound } from 'next/navigation'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { getApplicant, packetCompleteness, totalMissingCount } from '@/lib/store'
import { ROLE_LABELS } from '@/lib/forms/specs'
import PacketForms from '@/app/components/PacketForms'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function ApplicantSelfReview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const applicant = await getApplicant(id)
  if (!applicant) notFound()

  const pct = packetCompleteness(applicant)
  const open = totalMissingCount(applicant)
  const ready = open === 0 && pct === 100

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <header className="mb-6">
          <h1 className="text-2xl font-black text-slate-900">Your CMOP packet</h1>
          <p className="mt-1 text-sm text-slate-500">
            {applicant.firstName}, here&rsquo;s where your {ROLE_LABELS[applicant.role]} onboarding paperwork stands.
            Upload each filled VA form and we&rsquo;ll tell you exactly what&rsquo;s still missing before it goes to VA.
          </p>
        </header>

        <div className={`mb-6 flex items-center gap-3 rounded-2xl border p-4 ${ready ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
          {ready
            ? <CheckCircle2 size={22} className="flex-shrink-0 text-green-600" />
            : <AlertTriangle size={22} className="flex-shrink-0 text-amber-500" />}
          <div className="flex-1">
            <div className={`text-sm font-bold ${ready ? 'text-green-900' : 'text-amber-900'}`}>
              {ready ? 'Everything looks complete.' : `${open} item${open === 1 ? '' : 's'} still need your attention.`}
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/70">
              <div className={`h-full ${ready ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className={`text-lg font-black ${ready ? 'text-green-700' : 'text-amber-700'}`}>{pct}%</div>
        </div>

        <PacketForms applicant={applicant} />

        <p className="mt-6 text-center text-xs text-slate-400">
          Forms requiring a wet signature must be printed, signed in black ink, and re-scanned — digital
          signatures are rejected by VA.
        </p>
      </div>
    </main>
  )
}
