'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload, FileText, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { ExtractedIdData } from '@/lib/ai/id-parser'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif'

type ScanState = 'idle' | 'scanning' | 'done' | 'failed'

const DOC_LABELS: Record<string, string> = {
  US_PASSPORT: 'U.S. Passport', US_PASSPORT_CARD: 'U.S. Passport Card',
  FOREIGN_PASSPORT: 'Foreign Passport', DRIVERS_LICENSE: "Driver's License",
  STATE_ID: 'State ID Card', PERMANENT_RESIDENT_CARD: 'Permanent Resident Card',
  EMPLOYMENT_AUTHORIZATION: 'Employment Authorization', MILITARY_ID: 'Military ID',
  US_VISA: 'U.S. Visa', SOCIAL_SECURITY_CARD: 'Social Security Card',
  BIRTH_CERTIFICATE: 'Birth Certificate', CERTIFICATE_OF_NATURALIZATION: 'Certificate of Naturalization',
  OTHER: 'Other Document',
}

/**
 * Drag-and-drop ID scanner. Accepts a primary/secondary identity document, posts
 * it to /api/scan-id, and hands the extracted fields back via onExtract so the
 * caller can pre-fill its form. Purely a capture widget — it holds no profile
 * state; the parent owns the merge.
 */
export default function IdScanDropzone({ onExtract }: { onExtract: (d: ExtractedIdData) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [lastDoc, setLastDoc] = useState<ExtractedIdData | null>(null)
  const [docList, setDocList] = useState<ExtractedIdData[]>([])
  const [error, setError] = useState<string | null>(null)

  const scan = useCallback(async (file: File) => {
    setError(null)
    if (!/\.(pdf|jpe?g|png|webp|heic|heif)$/i.test(file.name) && !file.type) {
      setError(`Unsupported file: ${file.name}`); return
    }
    if (file.size > MAX_SIZE) { setError(`${file.name} exceeds 10 MB`); return }

    setScanState('scanning')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/scan-id', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Scan failed')
      if (!json.scanned || !json.data) { setScanState('failed'); return }
      const d = json.data as ExtractedIdData
      setLastDoc(d)
      setDocList(prev => [...prev, d])
      onExtract(d)
      setScanState('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed')
      setScanState('failed')
    }
  }, [onExtract])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) scan(f)
  }, [scan])

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed px-5 py-5 transition
          ${dragOver ? 'border-blue-600 bg-blue-50' : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50'}`}
      >
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-700">
          {scanState === 'scanning' ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            {scanState === 'scanning' ? 'Reading your document…' : 'Drag & drop your ID, or click to browse'}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Passport, driver&rsquo;s license, state ID, green card, Social Security card · PDF/JPG/PNG up to 10 MB
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) scan(f); e.target.value = '' }}
        />
      </div>

      {scanState === 'done' && lastDoc && (
        <div className="mt-3 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0 text-green-600" />
          <div className="text-sm text-green-900">
            <span className="font-semibold">Read {DOC_LABELS[lastDoc.documentType ?? 'OTHER'] ?? 'document'}.</span>{' '}
            {lastDoc.isPrimaryId
              ? 'Counts as a primary form of ID.'
              : 'Counts as a secondary form of ID — make sure you also upload a primary ID.'}{' '}
            We&rsquo;ve filled in what it can prove below — review each field before continuing.
          </div>
        </div>
      )}
      {scanState === 'failed' && (
        <div className="mt-3 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-amber-600" />
          <div className="text-sm text-amber-900">
            Couldn&rsquo;t auto-read that document{error ? ` (${error})` : ''}. You can still type the fields below
            by hand, or try a clearer, straight-on scan.
          </div>
        </div>
      )}
      {error && scanState !== 'failed' && (
        <p className="mt-3 text-sm font-medium text-red-600">{error}</p>
      )}

      {docList.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {docList.map((d, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              <FileText size={12} />
              {DOC_LABELS[d.documentType ?? 'OTHER'] ?? 'Document'}
              <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] ${d.isPrimaryId ? 'bg-blue-600 text-white' : 'bg-slate-400 text-white'}`}>
                {d.isPrimaryId ? 'PRIMARY' : 'SECONDARY'}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
