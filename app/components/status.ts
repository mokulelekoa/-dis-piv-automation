import type { PacketStatus, FormState } from '@/lib/store'

export const STATUS_LABELS: Record<PacketStatus, string> = {
  DRAFT: 'Draft',
  IN_PROGRESS: 'In progress',
  READY_FOR_REVIEW: 'Ready for review',
  SUBMITTED: 'Submitted',
  REJECTED: 'Needs fixes',
  ACCEPTED: 'Accepted',
}

/** Tailwind classes for a status pill (bg + text + border). */
export const STATUS_PILL: Record<PacketStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  READY_FOR_REVIEW: 'bg-blue-50 text-blue-700 border-blue-200',
  SUBMITTED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  ACCEPTED: 'bg-green-50 text-green-700 border-green-200',
}

export type FormHealth = 'empty' | 'incomplete' | 'complete'

export function formHealth(f: FormState): FormHealth {
  if (!f.uploaded) return 'empty'
  if (f.completeness === 100 && f.issues.length === 0) return 'complete'
  return 'incomplete'
}

export const HEALTH_DOT: Record<FormHealth, string> = {
  empty: 'bg-slate-300',
  incomplete: 'bg-amber-500',
  complete: 'bg-green-500',
}
