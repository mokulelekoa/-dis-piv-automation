'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Loader2, CheckCircle2, AlertTriangle, FileText, ExternalLink } from 'lucide-react'
import type { FormState } from '@/lib/store'

const MAX_SIZE = 15 * 1024 * 1024 // 15MB

type State = 'idle' | 'scanning' | 'error'

/**
 * Per-form upload widget. Drag-and-drop (or click to browse) a filled PDF, which
 * is posted to the applicant's scan endpoint — the AcroForm is read for missing
 * fields and the bytes are stored. On success it refreshes the server component
 * so the new FormState (and a clickable view link) render.
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
  const [dragOver, setDragOver] = useState(false)

  const upload = useCallback(async (file: File) => {
    setError(null)
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      setError('Upload the filled PDF (the original VA form, not a photo).')
      setState('error')
      return
    }
    if (file.size > MAX_SIZE) { setError(`${file.name} exceeds 15 MB`); setState('error'); return }

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

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) upload(f)
  }, [upload])

  const scanning = state === 'scanning'
  const viewHref = `/api/applicants/${applicantId}/forms/${specId}`

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }}
      />

      {/* Drag-and-drop / click zone */}
      <div
        onClick={() => !scanning && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); if (!scanning) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !scanning) inputRef.current?.click() }}
        className={`flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs font-semibold transition
          ${scanning ? 'cursor-wait border-slate-200 text-slate-400'
            : dragOver ? 'border-accent-500 bg-accent-50 text-accent-700'
            : 'border-slate-300 bg-white text-slate-700 hover:border-accent-400 hover:bg-accent-50'}`}
      >
        {scanning
          ? <><Loader2 size={14} className="animate-spin" /> Scanning&hellip;</>
          : <><Upload size={14} />
              {form.uploaded ? 'Drop a new PDF or click to re-upload' : `Drop the filled ${label} here, or click to browse`}
            </>}
      </div>

      {/* Uploaded file row — clickable view link when the bytes are stored */}
      {form.uploaded && form.fileName && !scanning && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
          {form.stored ? (
            <a
              href={viewHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-dis-teal hover:underline"
            >
              <FileText size={12} /> {form.fileName} <ExternalLink size={10} />
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-slate-400">
              <FileText size={12} /> {form.fileName}
            </span>
          )}
          {form.completeness === 100 && form.issues.length === 0
            ? <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 size={11} /> complete</span>
            : <span className="text-amber-600">{form.completeness}% &mdash; needs attention</span>}
        </div>
      )}

      {state === 'error' && error && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-red-600">
          <AlertTriangle size={11} /> {error}
        </p>
      )}
    </div>
  )
}
