import Link from 'next/link'

/**
 * DIS Consulting navy brand bar with the white logo. Sits at the top of every
 * page. `right` slots in page-specific actions (e.g. an admin/sign-out link).
 */
export default function BrandHeader({
  subtitle, href = '/', right,
}: {
  subtitle?: string; href?: string; right?: React.ReactNode
}) {
  return (
    <header className="border-b-4 border-dis-orange bg-dis-navy">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5">
        <Link href={href} className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/dis-logo.png" alt="DIS Consulting" className="h-8 w-auto" />
          {subtitle && (
            <span className="hidden border-l border-white/25 pl-3 text-sm font-semibold tracking-wide text-white/80 sm:inline">
              {subtitle}
            </span>
          )}
        </Link>
        {right && <div className="flex items-center gap-3 text-sm">{right}</div>}
      </div>
    </header>
  )
}
