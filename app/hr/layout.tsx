import type { Metadata } from 'next'
import { HrProvider } from '@/lib/hr/store'
import HrShell from './shell'

export const metadata: Metadata = {
  title: 'HR Command Center — DIS Consulting',
  description: 'New hire sync, offer & increase letters, and Unanet→Paycor payroll cleanup in one place.',
}

export default function HrLayout({ children }: { children: React.ReactNode }) {
  return (
    <HrProvider>
      <HrShell>{children}</HrShell>
    </HrProvider>
  )
}
