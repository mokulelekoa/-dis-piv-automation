'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  Upload, Camera, Loader2, AlertTriangle, CheckCircle2, Sparkles,
  FileText, Download, RotateCcw, PencilLine,
} from 'lucide-react'
import type { DetectedField, FormDetection } from '@/lib/forms/universal'

const MAX_SIZE = 20 * 1024 * 1024 // 20 MB
const ACCEPT = '.pdf,.jpg,.jpeg,.png'

type Stage = 'idle' | 'analyzing' | 'review' | 'generating' | 'done'

const MODE_BLURB: Record<FormDetection['mode'], string> = {
  'acroform': 'This PDF has real fillable fields — your answers are typed straight into them.',
  'overlay-pdf': 'This PDF has no fillable fields, so AI located each blank and your answers will be written onto the page.',
  'overlay-image': 'AI read your photo and located each blank — your answers will be written onto it and returned as a PDF.',
}

/**
 * Smart Fill: upload ANY blank form (PDF, or a clear phone photo), review the
 * values suggested from the saved profile, edit anything, and download the
 * filled PDF. The original file stays in the browser between the analyze and
 * generate calls — nothing is stored until the filled copy is saved to record.
 */
export default function SmartFormFiller({ applicantId, hasProfile }: {
  applicantId: string
  hasProfile: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [detection, setDetection] = useState<FormDetection | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [savedToRecord, setSavedToRecord] = useState(false)

  const analyze = useCallback(async (f: File) => {
    setError(null)
    if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) {
      setError(`Unsupported file: ${f.name}. Upload a PDF, or a JPG/PNG photo.`); return
    }
    if (f.size > MAX_SIZE) { setError(`${f.name} exceeds 20 MB.`); return }

    setStage('analyzing')
    setFile(f)
    try {
      const fd = new FormData()
      fd.append('file', f)
      const res = await fetch(`/api/applicants/${applicantId}/autofill`, { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not analyze that form.')
      const d = json.detection as FormDetection
      setDetection(d)
      setValues(Object.fromEntries(d.fields.map(fl => [fl.id, fl.suggested])))
      setStage('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not analyze that form.')
      setStage('idle')
      setFile(null)
    }
  }, [applicantId])

  const generate = useCallback(async () => {
    if (!file || !detection) return
    setError(null)
    setStage('generating')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('payload', JSON.stringify({
        mode: detection.mode,
        values,
        fields: detection.fields.map(f => ({ id: f.id, kind: f.kind, page: f.page, xPct: f.xPct, yPct: f.yPct })),
      }))
      const res = await fetch(`/api/applicants/${applicantId}/autofill/generate`, { method: 'POST', body: fd })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error ?? 'Could not generate the filled form.')
      }
      setSavedToRecord(res.headers.get('X-Saved-To-Record') === '1')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name.replace(/\.(pdf|jpe?g|png)$/i, '') + '_filled.pdf'
      a.click()
      URL.revokeObjectURL(url)
      setStage('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate the filled form.')
      setStage('review')
    }
  }, [applicantId, file, detection, values])

  const reset = useCallback(() => {
    setStage('idle'); setError(null); setFile(null)
    setDetection(null); setValues({}); setSavedToRecord(false)
  }, [])

  const stats = useMemo(() => {
    if (!detection) return { filled: 0, blank: 0 }
    let filled = 0
    for (const f of detection.fields) if (values[f.id]) filled++
    return { filled, blank: detection.fields.length - filled }
  }, [detection, values])

  // ---- Stage: pick a file ----
  if (stage === 'idle' || stage === 'analyzing') {
    return (
      <div>
        {!hasProfile && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
            <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-amber-600" />
            <p className="text-sm text-amber-900">
              You haven&rsquo;t saved your profile yet, so nothing can be suggested automatically.
              Complete the walkthrough first — then every form you upload here fills itself.
            </p>
          </div>
        )}
        <div
          onClick={() => stage === 'idle' && fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault(); setDragOver(false)
            const f = e.dataTransfer.files?.[0]
            if (f && stage === 'idle') analyze(f)
          }}
          className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition
            ${dragOver ? 'border-blue-600 bg-blue-50' : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50'}`}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-700">
            {stage === 'analyzing' ? <Loader2 size={26} className="animate-spin" /> : <Upload size={26} />}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">
              {stage === 'analyzing' ? 'Reading your form…' : 'Drag & drop any blank form, or click to browse'}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Fillable PDFs are filled directly; flat scans and photos get AI assist · PDF/JPG/PNG up to 20 MB
            </p>
          </div>
          {stage === 'analyzing' && (
            <p className="text-xs font-medium text-blue-600">
              Detecting blanks and matching them to your saved info — this can take up to a minute for photos.
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={stage === 'analyzing'}
          onClick={() => cameraRef.current?.click()}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-blue-400 hover:bg-slate-50 disabled:opacity-50"
        >
          <Camera size={18} className="text-blue-600" />
          On your phone? Take a clear photo of the form
        </button>

        <input ref={fileRef} type="file" accept={ACCEPT} className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) analyze(f); e.target.value = '' }} />
        <input ref={cameraRef} type="file" accept="image/jpeg,image/png" capture="environment" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) analyze(f); e.target.value = '' }} />

        {error && (
          <div className="mt-3 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-red-500" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
      </div>
    )
  }

  // ---- Stage: done ----
  if (stage === 'done') {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
        <CheckCircle2 size={32} className="mx-auto text-green-600" />
        <h3 className="mt-3 text-base font-black text-green-900">Your filled form has downloaded.</h3>
        <p className="mt-1 text-sm text-green-800">
          {savedToRecord && 'A copy was also saved to your record. '}
          Review every field on the PDF before submitting it — and add a wet signature if the form requires one.
        </p>
        <button type="button" onClick={reset}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-green-700">
          <RotateCcw size={16} /> Fill another form
        </button>
      </div>
    )
  }

  // ---- Stage: review / generating ----
  if (!detection || !file) return null
  return (
    <div>
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <Sparkles size={18} className="mt-0.5 flex-shrink-0 text-blue-600" />
        <div className="text-sm text-blue-900">
          <span className="font-bold">Found {detection.fields.length} field{detection.fields.length === 1 ? '' : 's'} in {file.name}.</span>{' '}
          {MODE_BLURB[detection.mode]}{' '}
          <span className="font-semibold">{stats.filled} pre-filled from your saved info · {stats.blank} for you to answer or skip.</span>
        </div>
      </div>

      {detection.warnings.map((w, i) => (
        <div key={i} className="mb-3 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5">
          <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-amber-600" />
          <p className="text-xs text-amber-900">{w}</p>
        </div>
      ))}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <ul className="divide-y divide-slate-100">
          {detection.fields.map(f => (
            <FieldRow key={f.id} field={f} value={values[f.id] ?? ''}
              onChange={v => setValues(prev => ({ ...prev, [f.id]: v }))} />
          ))}
        </ul>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Blank fields are left empty on the document. Signature and &ldquo;date signed&rdquo; lines are never auto-filled.
      </p>

      {error && (
        <div className="mt-3 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-red-500" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button type="button" disabled={stage === 'generating'} onClick={generate}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-60">
          {stage === 'generating'
            ? <><Loader2 size={18} className="animate-spin" /> Building your filled PDF…</>
            : <><Download size={18} /> Generate filled PDF</>}
        </button>
        <button type="button" disabled={stage === 'generating'} onClick={reset}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
          <RotateCcw size={16} /> Start over
        </button>
      </div>
    </div>
  )
}

function FieldRow({ field, value, onChange }: {
  field: DetectedField
  value: string
  onChange: (v: string) => void
}) {
  const isCheck = field.kind === 'checkbox' || field.kind === 'overlay-check'
  const hasOptions = (field.options?.length ?? 0) > 0
  const suggestedBadge = field.source !== 'none' && field.suggested && value === field.suggested

  return (
    <li className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <FileText size={14} className="flex-shrink-0 text-slate-300" />
        <span className="truncate text-sm font-semibold text-slate-800" title={field.label}>{field.label}</span>
        {suggestedBadge && (
          <span className="flex-shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
            auto
          </span>
        )}
        {!value && (
          <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            blank
          </span>
        )}
      </div>
      <div className="sm:w-64">
        {isCheck ? (
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={/^(yes|true|on|x|1)$/i.test(value)}
              onChange={e => onChange(e.target.checked ? 'Yes' : '')}
              className="h-4 w-4 rounded border-slate-300 text-blue-600" />
            Check this box
          </label>
        ) : hasOptions ? (
          <select value={value} onChange={e => onChange(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none">
            <option value="">— leave blank —</option>
            {field.options!.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <div className="relative">
            <input type="text" value={value} maxLength={field.maxLength}
              onChange={e => onChange(e.target.value)}
              placeholder="Leave blank or type an answer"
              className="w-full rounded-lg border border-slate-300 py-1.5 pl-2.5 pr-8 text-sm text-slate-800 placeholder:text-slate-300 focus:border-blue-500 focus:outline-none" />
            <PencilLine size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300" />
          </div>
        )}
      </div>
    </li>
  )
}
