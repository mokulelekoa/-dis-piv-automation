import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { getApplicant } from '@/lib/store'
import BrandHeader from '@/app/components/BrandHeader'
import UserBadge from '@/app/components/UserBadge'
import SmartFormFiller from '@/app/components/SmartFormFiller'
import { requireApplicantAccess } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Smart Fill: upload ANY blank form — a fillable PDF, a flat scan, or a clear
 * phone photo — and it's filled from the candidate's saved profile, with AI
 * assist locating the blanks when the document isn't natively fillable.
 */
export default async function SmartFillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireApplicantAccess(id)
  const applicant = await getApplicant(id)
  if (!applicant) notFound()

  return (
    <main className="min-h-screen bg-blue-50">
      <BrandHeader subtitle="Smart Fill"
        right={<UserBadge email={user.email ?? null} role="candidate" name={`${applicant.firstName} ${applicant.lastName}`} />} />
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Link href={`/applicant/${id}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 transition hover:text-slate-800">
          <ArrowLeft size={16} /> Back to your packet
        </Link>

        <header className="mb-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Sparkles size={20} />
            </div>
            <h1 className="text-2xl font-black text-slate-900">Fill any form automatically</h1>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Got a new application or paperwork that isn&rsquo;t part of your standard packet? Upload the blank
            form — from your computer, or as a clear photo from your phone — and we&rsquo;ll fill it from the
            information you already saved. You review every field before anything is written.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Layouts change; your facts don&rsquo;t. Keep your{' '}
            <Link href={`/applicant/${id}/history`} className="font-bold text-blue-600 hover:underline">
              job history &amp; references
            </Link>{' '}
            saved so employment and reference sections fill themselves too.
          </p>
        </header>

        <SmartFormFiller applicantId={id} hasProfile={!!applicant.profile} />
      </div>
    </main>
  )
}
