'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Loader2, CheckCircle2, AlertTriangle, FileText } from 'lucide-react'
import type { FormState } from '@/lib/store'

const MAX_SIZE = 15 * 1024 * 1024 // 15MB

type State = 'idle' | 'scanning' | 'error'

/**
 * Per-form upload widget. Posts a filled PDF to the applicant's scan endpoint,
 * which reads the AcroForm and reports what's missing. On success it refreshes
 * the server component so the new FormState renders.
 */
export default function FormUpload({
  applicantId, specId, form, label,
}: {
  applicantId: string
  specId: string
  form: FormState
  label: string
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState<string | null>(null)

  const upload = useCallback(async (file: File) => {
    setError(null)
    if (!/\.pdf$/i.test(file.name)) {
      setError('Upload the filled PDF (the original VA form, not a photo).')
      return
    }
    if (file.size > MAX_SIZE) { setError(`${file.name} exceeds 15 MB`); return }

    setState('scanning')
    try {
      const fd = new FormData()
      fd.append('specId', specId)
      fd.append('file', file)
      const res = await fetch(`/api/applicants/${applicantId}/scan`, { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Scan failed')
      setState('idle')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed')
      setState('error')
    }
  }, [applicantId, specId, router])

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={state === 'scanning'}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-400 hover:bg-blue-50 disabled:cursor-wait disabled:opacity-60"
      >
        {state === 'scanning'
          ? <><Loader2 size={14} className="animate-spin" /> Scanning…</>
          : form.uploaded
            ? <><Upload size={14} /> Re-upload &amp; rescan</>
            : <><Upload size={14} /> Upload filled {label}</>}
      </button>

      {form.uploaded && form.fileName && state !== 'scanning' && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400">
          <FileText size={11} /> {form.fileName}
          {form.completeness === 100 && form.issues.length === 0
            ? <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 size={11} /> complete</span>
            : <span className="text-amber-600">{form.completeness}% — needs attention</span>}
        </p>
      )}

      {state === 'error' && error && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-red-600">
          <AlertTriangle size={11} /> {error}
        </p>
      )}
    </div>
  )
}
