import { LogOut } from 'lucide-react'
import type { AppRole } from '@/lib/auth'

/**
 * Who's-logged-in chip for the navy BrandHeader: initials, identity, role, and a
 * sign-out button. Server component — sign-out is a plain form POST to
 * /auth/signout, so no client JS is needed. Styled for white-on-navy.
 */
function badgeInitials(name: string | undefined, email: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    const i = (parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')
    if (i) return i.toUpperCase()
  }
  const local = (email ?? '').split('@')[0]
  return (local.slice(0, 2) || '?').toUpperCase()
}

export default function UserBadge({
  email, role, name,
}: {
  email: string | null; role: AppRole; name?: string
}) {
  const label = name || email || 'Account'
  const roleLabel = role === 'admin' ? 'Administrator' : 'Candidate'

  return (
    <div className="flex items-center gap-2.5">
      <div className="hidden text-right leading-tight sm:block">
        <div className="max-w-[14rem] truncate text-sm font-semibold text-white">{label}</div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-white/60">{roleLabel}</div>
      </div>
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white ring-1 ring-white/25"
        title={email ?? undefined}
      >
        {badgeInitials(name, email)}
      </div>
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          title="Sign out"
          className="flex items-center gap-1.5 rounded-lg border border-white/25 px-2.5 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </form>
    </div>
  )
}
