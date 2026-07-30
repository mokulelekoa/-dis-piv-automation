import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Briefcase } from 'lucide-react'
import { getApplicant } from '@/lib/store'
import { emptyWorkHistory } from '@/lib/profile'
import BrandHeader from '@/app/components/BrandHeader'
import UserBadge from '@/app/components/UserBadge'
import WorkHistoryEditor from '@/app/components/WorkHistoryEditor'
import { requireApplicantAccess } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * The reusable career record: thousands of application layouts, one saved set
 * of jobs + references. Entered once here, mapped onto any uploaded form by
 * Smart Fill.
 */
export default async function WorkHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireApplicantAccess(id)
  const applicant = await getApplicant(id)
  if (!applicant) notFound()

  return (
    <main className="min-h-screen bg-blue-50">
      <BrandHeader subtitle="Job History & References"
        right={<UserBadge email={user.email ?? null} role="candidate" name={`${applicant.firstName} ${applicant.lastName}`} />} />
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Link href={`/applicant/${id}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 transition hover:text-slate-800">
          <ArrowLeft size={16} /> Back to your packet
        </Link>

        <header className="mb-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Briefcase size={20} />
            </div>
            <h1 className="text-2xl font-black text-slate-900">Job history &amp; references</h1>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Every application asks for the same things — where you worked, when, and who can vouch for you.
            Save it once here and <Link href={`/applicant/${id}/fill`} className="font-bold text-blue-600 hover:underline">Smart Fill</Link> will
            place it into whatever form you upload, no matter the layout.
          </p>
        </header>

        <WorkHistoryEditor applicantId={id} initial={applicant.workHistory ?? emptyWorkHistory()} />
      </div>
    </main>
  )
}
