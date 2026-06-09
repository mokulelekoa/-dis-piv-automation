import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getApplicant } from '@/lib/store'
import { ROLE_LABELS } from '@/lib/forms/specs'
import PacketWizard from '@/app/components/PacketWizard'
import BrandHeader from '@/app/components/BrandHeader'
import UserBadge from '@/app/components/UserBadge'
import { requireApplicantAccess } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function QuestionnairePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireApplicantAccess(id)
  const applicant = await getApplicant(id)
  if (!applicant) notFound()

  return (
    <main className="min-h-screen bg-blue-50">
      <BrandHeader subtitle="Your CMOP Packet"
        right={<UserBadge email={user.email ?? null} role="candidate" name={`${applicant.firstName} ${applicant.lastName}`} />} />
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Link href={`/applicant/${id}`} className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700">
          <ArrowLeft size={14} /> Back to your packet
        </Link>
        <header className="mb-8">
          <h1 className="text-2xl font-black text-slate-900">Complete your {ROLE_LABELS[applicant.role]} forms</h1>
          <p className="mt-1 text-sm text-slate-500">
            {applicant.firstName}, this is your {ROLE_LABELS[applicant.role]} VA onboarding packet. The steps
            below walk you through it.
          </p>
        </header>

        <PacketWizard
          applicantId={id}
          role={applicant.role}
          initialProfile={applicant.profile ?? null}
          initialAnswers={applicant.answers ?? null}
          initialForms={applicant.forms}
          firstName={applicant.firstName}
        />
      </div>
    </main>
  )
}
