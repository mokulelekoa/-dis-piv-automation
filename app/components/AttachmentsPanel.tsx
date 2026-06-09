'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Loader2, FileText, ExternalLink, Trash2, AlertTriangle, X } from 'lucide-react'
import type { Attachment } from '@/lib/store'

const MAX_SIZE = 25 * 1024 * 1024 // 25 MB

/**
 * Admin-side general document area for a candidate: upload arbitrary files
 * (scanned ID, offer letter, correspondence) outside the required form set,
 * view them, and — for full admins only — delete them. Server-rendered list is
 * passed in; mutations refresh the route.
 */
export default function AttachmentsPanel({
  applicantId, attachments, canDelete,
}: {
  applicantId: string
  attachments: Attachment[]
  canDelete: boolean
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const upload = useCallback(async (file: File) => {
    setError(null)
    if (file.size === 0) { setError('That file is empty.'); return }
    if (file.size > MAX_SIZE) { setError(`${file.name} exceeds 25 MB.`); return }

    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/applicants/${applicantId}/attachments`, { method: 'POST', body: fd })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Upload failed.')
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }, [applicantId, router])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) upload(f)
  }, [upload])

  async function remove(attId: string) {
    setError(null)
    setDeletingId(attId)
    try {
      const res = await fetch(`/api/applicants/${applicantId}/attachments/${attId}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Could not delete the file.')
      }
      setConfirmId(null)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the file.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Documents</h2>
      <p className="mt-1 text-xs text-slate-500">
        Files outside the required forms &mdash; a scanned ID, offer letter, or correspondence.
      </p>

      {attachments.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100">
          {attachments.map(att => (
            <li key={att.id} className="flex items-center gap-3 py-2.5">
              <FileText size={16} className="flex-shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <a
                  href={`/api/applicants/${applicantId}/attachments/${att.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 truncate text-sm font-semibold text-dis-teal hover:underline"
                >
                  <span className="truncate">{att.fileName}</span>
                  <ExternalLink size={11} className="flex-shrink-0" />
                </a>
                <div className="text-[11px] text-slate-400">
                  {formatSize(att.size)} &middot; {formatDate(att.uploadedAt)}
                  {att.uploadedBy && <> &middot; {att.uploadedBy}</>}
                </div>
              </div>
              {canDelete && (
                confirmId === att.id ? (
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <button
                      onClick={() => remove(att.id)}
                      disabled={deletingId === att.id}
                      className="flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
                    >
                      {deletingId === att.id && <Loader2 size={12} className="animate-spin" />}
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      disabled={deletingId === att.id}
                      className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
                      aria-label="Cancel"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setError(null); setConfirmId(att.id) }}
                    className="flex-shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                    title={`Delete ${att.fileName}`}
                    aria-label={`Delete ${att.fileName}`}
                  >
                    <Trash2 size={16} />
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }}
      />
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); if (!uploading) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !uploading) inputRef.current?.click() }}
        className={`mt-4 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-xs font-semibold transition
          ${uploading ? 'cursor-wait border-slate-200 text-slate-400'
            : dragOver ? 'border-accent-500 bg-accent-50 text-accent-700'
            : 'border-slate-300 bg-white text-slate-700 hover:border-accent-400 hover:bg-accent-50'}`}
      >
        {uploading
          ? <><Loader2 size={14} className="animate-spin" /> Uploading&hellip;</>
          : <><Upload size={14} /> Drop a file here, or click to browse (max 25 MB)</>}
      </div>

      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-red-600">
          <AlertTriangle size={11} /> {error}
        </p>
      )}
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
