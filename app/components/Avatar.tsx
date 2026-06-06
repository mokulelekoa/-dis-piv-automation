function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || '?'
}

/**
 * Candidate avatar with an initials fallback. Pass `photoUrl` only when the
 * applicant actually has a stored photo (the GET endpoint 404s otherwise, which
 * would render a broken image).
 */
export default function Avatar({
  firstName, lastName, photoUrl, size = 40,
}: {
  firstName: string; lastName: string; photoUrl?: string; size?: number
}) {
  const px = `${size}px`
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={photoUrl}
        alt={`${firstName} ${lastName}`}
        width={size}
        height={size}
        className="flex-shrink-0 rounded-full object-cover"
        style={{ width: px, height: px }}
      />
    )
  }
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-500"
      style={{ width: px, height: px, fontSize: `${Math.round(size * 0.36)}px` }}
    >
      {initials(firstName, lastName)}
    </div>
  )
}
