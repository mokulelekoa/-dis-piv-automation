'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Banknote, FileSignature, LayoutDashboard, RefreshCw, ShieldCheck, UserPlus } from 'lucide-react'
import { useHr } from '@/lib/hr/store'

const NAV = [
  { href: '/hr', label: 'Dashboard', sub: 'Today at a glance', icon: LayoutDashboard },
  { href: '/hr/new-hires', label: 'New Hire Sync', sub: 'Paycor + Employee Navigator', icon: UserPlus },
  { href: '/hr/letters', label: 'Letter Studio', sub: 'Offers & increases', icon: FileSignature },
  { href: '/hr/payroll', label: 'Payroll Bridge', sub: 'Unanet → Paycor', icon: Banknote },
  // The existing candidate paperwork app (PIV packets) — same suite, own front door.
  { href: '/admin', label: 'Candidate Packets', sub: 'VA PIV paperwork app', icon: ShieldCheck },
]

/**
 * The HR Command Center shell: dark navy sidebar on desktop, compact top nav
 * on mobile. Deliberately its own space — HR tools, not the candidate portal.
 */
export default function HrShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { resetDemo } = useHr()

  const isActive = (href: string) => (href === '/hr' ? pathname === '/hr' : pathname.startsWith(href))

  return (
    <div className="flex min-h-screen w-full bg-blue-50">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-dis-navy lg:flex">
        <Link href="/hr" className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/dis-logo.png" alt="DIS Consulting" className="h-7 w-auto" />
        </Link>
        <div className="px-5 pb-2 pt-5 text-[10px] font-black uppercase tracking-[0.2em] text-white/35">
          HR Command Center
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(item => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                  active ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className={`rounded-lg p-1.5 ${active ? 'bg-accent-500 text-white' : 'bg-white/10 text-white/70 group-hover:text-white'}`}>
                  <Icon size={15} />
                </span>
                <span>
                  <span className="block text-sm font-bold leading-tight">{item.label}</span>
                  <span className={`block text-[10px] leading-tight ${active ? 'text-white/60' : 'text-white/35'}`}>{item.sub}</span>
                </span>
              </Link>
            )
          })}
        </nav>
        <div className="space-y-3 border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={resetDemo}
            className="flex items-center gap-2 text-[11px] font-semibold text-white/40 transition-colors hover:text-white/80"
          >
            <RefreshCw size={12} /> Reset demo data
          </button>
          <div className="text-[10px] leading-relaxed text-white/30">
            Prototype — sample data only.<br />No live system connections yet.
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b-2 border-accent-500 bg-dis-navy lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/hr" className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/dis-logo.png" alt="DIS Consulting" className="h-6 w-auto" />
              <span className="text-xs font-bold tracking-wide text-white/80">HR Command Center</span>
            </Link>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2.5">
            {NAV.map(item => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold ${
                    active ? 'bg-accent-500 text-white' : 'bg-white/10 text-white/70'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
