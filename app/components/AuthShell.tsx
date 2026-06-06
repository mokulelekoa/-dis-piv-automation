/**
 * Split-screen auth layout: DIS navy brand panel on the left, form card on the
 * right. Used by both the admin and applicant login pages.
 */
export default function AuthShell({
  heading, blurb, children,
}: {
  heading: string; blurb: string; children: React.ReactNode
}) {
  return (
    <main className="flex min-h-screen flex-col md:flex-row">
      {/* Brand panel */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-dis-navy px-8 py-10 md:w-2/5 md:px-12 md:py-14">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-dis-orange/15" />
        <div className="absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-dis-teal/15" />
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/dis-logo.png" alt="DIS Consulting" className="h-10 w-auto" />
        </div>
        <div className="relative mt-10">
          <h1 className="text-3xl font-black leading-tight text-white">{heading}</h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">{blurb}</p>
        </div>
        <p className="relative mt-10 text-xs font-semibold uppercase tracking-widest text-dis-orange">
          Where passion meets purpose
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-blue-50 px-6 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </main>
  )
}
