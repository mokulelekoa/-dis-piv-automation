'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Loader2 } from 'lucide-react'

/**
 * Candidate profile-photo uploader. Shows the current photo (or initials),
 * uploads on file select, and refreshes so the new image appears everywhere.
 */
export default function PhotoUpload({
  applicantId, firstName, lastName, hasPhoto,
}: {
  applicantId: string; firstName: string; lastName: string; hasPhoto: boolean
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Cache-busting key so the <img> reloads after a new upload.
  const [version, setVersion] = useState(() => (hasPhoto ? Date.now() : 0))

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?'
  const showImg = version > 0

  async function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setError(null)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch(`/api/applicants/${applicantId}/photo`, { method: 'POST', body })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Upload failed')
      }
      setVersion(Date.now())
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/applicants/${applicantId}/photo?v=${version}`}
            alt={`${firstName} ${lastName}`}
            className="h-20 w-20 rounded-full object-cover ring-2 ring-slate-200"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-200 text-xl font-bold text-slate-500 ring-2 ring-slate-200">
            {initials}
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
            <Loader2 size={20} className="animate-spin text-white" />
          </div>
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-400 hover:bg-blue-50 disabled:opacity-60"
        >
          <Camera size={15} /> {showImg ? 'Change photo' : 'Upload photo'}
        </button>
        <p className="mt-1 text-[11px] text-slate-400">JPEG, PNG, or WebP · up to 5 MB</p>
        {error && <p className="mt-1 text-[11px] font-medium text-red-600">{error}</p>}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onSelect}
          className="hidden"
        />
      </div>
    </div>
  )
}
