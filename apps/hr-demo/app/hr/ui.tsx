'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, X } from 'lucide-react'
import type { Contract } from '@/lib/hr/types'

/** Small shared UI primitives for the HR Command Center pages. */

export function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(11,36,60,0.06)] ${className}`}>
      {children}
    </div>
  )
}

export function StatTile({ icon, label, value, sub, accent = false }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent?: boolean
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
          <div className={`mt-1.5 text-3xl font-black tracking-tight ${accent ? 'text-accent-600' : 'text-slate-900'}`}>{value}</div>
          {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
        </div>
        <div className={`rounded-xl p-2.5 ${accent ? 'bg-accent-50 text-accent-600' : 'bg-blue-50 text-blue-400'}`}>{icon}</div>
      </div>
    </Card>
  )
}

export function ContractChip({ contract, small = false }: { contract?: Contract; small?: boolean }) {
  if (!contract) return null
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white font-semibold text-slate-600 ${small ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'}`}>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: contract.color }} />
      {contract.name}
    </span>
  )
}

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(t)
  }, [copied])
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setCopied(true) } catch { /* clipboard unavailable */ }
      }}
      className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors ${
        copied
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:text-blue-500'
      }`}
      title="Copy to clipboard"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : (label ?? 'Copy')}
    </button>
  )
}

/** A labeled value with a one-click copy — the unit of "keying into another system". */
export function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 hover:bg-slate-50">
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
        <div className="truncate text-sm font-medium text-slate-800">{value || '—'}</div>
      </div>
      <CopyButton text={value} />
    </div>
  )
}

const BTN_BASE = 'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40'
export const btnPrimary = `${BTN_BASE} bg-accent-500 px-4 py-2.5 text-white shadow-sm hover:bg-accent-600 active:scale-[0.98]`
export const btnSecondary = `${BTN_BASE} border border-slate-200 bg-white px-4 py-2.5 text-slate-700 hover:border-blue-300 hover:text-blue-500`
export const btnGhost = `${BTN_BASE} px-3 py-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700`
export const btnNavy = `${BTN_BASE} bg-blue-600 px-4 py-2.5 text-white shadow-sm hover:bg-blue-500 active:scale-[0.98]`

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20'

/** Right-side slide-over panel used for wizards and detail views. */
export function SlideOver({ open, onClose, title, wide = false, children }: {
  open: boolean; onClose: () => void; title: React.ReactNode; wide?: boolean; children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-blue-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="text-base font-black text-slate-900">{title}</div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close panel">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export function timeAgoShort(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 90) return 'just now'
  const m = s / 60
  if (m < 60) return `${Math.round(m)}m ago`
  const h = m / 60
  if (h < 36) return `${Math.round(h)}h ago`
  return `${Math.round(h / 24)}d ago`
}

export function formatRate(payType: 'Hourly' | 'Salary', rate: number): string {
  return payType === 'Hourly'
    ? `$${rate.toFixed(2)}/hr`
    : `$${rate.toLocaleString('en-US', { maximumFractionDigits: 0 })}/yr`
}
