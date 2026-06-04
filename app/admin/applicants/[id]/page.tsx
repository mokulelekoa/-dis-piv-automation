import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Mail, Hash } from 'lucide-react'
import { getApplicant, packetCompleteness, totalMissingCount } from '@/lib/store'
import { ROLE_LABELS } from '@/lib/forms/specs'
import { STATUS_LABELS, STATUS_PILL } from '@/app/components/status'
import PacketForms from '@/app/components/PacketForms'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function ApplicantDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const applicant = await getApplicant(id)
  if (!applicant) notFound()

  const pct = packetCompleteness(applicant)
  const open = totalMissingCount(applicant)

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link href="/admin" className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-700">
          <ArrowLeft size={14} /> All candidates
        </Link>

        <header className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-black text-slate-900">{applicant.firstName} {applicant.lastName}</h1>
              <p className="mt-0.5 text-sm text-slate-500">{ROLE_LABELS[applicant.role]}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                {applicant.email && <span className="inline-flex items-center gap-1"><Mail size={11} /> {applicant.email}</span>}
                <span className="inline-flex items-center gap-1"><Hash size={11} /> Station {applicant.station}</span>
              </div>
            </div>
            <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_PILL[applicant.status]}`}>
              {STATUS_LABELS[applicant.status]}
            </span>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <div className="flex-1">
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div className={`h-full ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="text-sm font-bold text-slate-700">{pct}% complete</div>
            <div className="text-xs font-semibold text-amber-600">{open === 0 ? 'No open items' : `${open} open`}</div>
          </div>
        </header>

        <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-400">Required forms</h2>
        <PacketForms applicant={applicant} />
      </div>
    </main>
  )
}
