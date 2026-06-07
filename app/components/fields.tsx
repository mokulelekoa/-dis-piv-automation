'use client'

import { Plus, Trash2 } from 'lucide-react'
import type { YesNo, MilitaryService } from '@/lib/forms/questions'

/**
 * Shared presentational form primitives used by the packet wizard (and any other
 * candidate-facing form). Pure UI — no data logic.
 */

export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">{title}</h2>
      {hint && <p className="mt-1 mb-3 text-xs text-slate-500">{hint}</p>}
      {!hint && <div className="mb-3" />}
      <div className="space-y-4">{children}</div>
    </section>
  )
}

export function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
}

export function Text({ label, value, onChange, type = 'text', placeholder, disabled, className, note }: {
  label: string; value: string; onChange: (v: string) => void; type?: string
  placeholder?: string; disabled?: boolean; className?: string; note?: React.ReactNode
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</label>
      <input type={type} value={value} placeholder={placeholder} disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30
          ${disabled ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400' : 'border-slate-200 bg-white'}`} />
      {note}
    </div>
  )
}

export function Area({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30" />
    </div>
  )
}

export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-slate-500">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /> {label}
    </label>
  )
}

export function SelectField({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30">
        <option value="">Select…</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

export function YesNoRow({ label, value, onChange }: { label: string; value: YesNo | '' | 'NA' | 'Do Not Know'; onChange: (v: YesNo) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <p className="text-sm text-slate-700">{label}</p>
      <div className="flex flex-shrink-0 gap-1.5">
        {(['Yes', 'No'] as YesNo[]).map(opt => (
          <button key={opt} type="button" onClick={() => onChange(opt)}
            className={`rounded-lg border px-3 py-1 text-xs font-semibold transition
              ${value === opt ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-blue-400'}`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Options({ label, value, options, onChange, stacked }: {
  label: string; value: string; options: { v: string; l: string }[]; onChange: (v: string) => void; stacked?: boolean
}) {
  return (
    <div>
      <p className="mb-2 text-sm text-slate-700">{label}</p>
      <div className={stacked ? 'space-y-1.5' : 'flex flex-wrap gap-1.5'}>
        {options.map(o => (
          <button key={o.v} type="button" onClick={() => onChange(o.v)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${stacked ? 'block w-full text-left' : ''}
              ${value === o.v ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-blue-400'}`}>
            {o.l}
          </button>
        ))}
      </div>
    </div>
  )
}

export function MilitaryRows({ value, onChange }: { value: MilitaryService[]; onChange: (v: MilitaryService[]) => void }) {
  const rows = value
  function update(i: number, patch: Partial<MilitaryService>) {
    onChange(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <input placeholder="Branch" value={r.branch} onChange={e => update(i, { branch: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900" />
          <input placeholder="From MM/DD/YYYY" value={r.from} onChange={e => update(i, { from: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900" />
          <input placeholder="To MM/DD/YYYY" value={r.to} onChange={e => update(i, { to: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900" />
          <div className="flex gap-1">
            <input placeholder="Discharge type" value={r.discharge} onChange={e => update(i, { discharge: e.target.value })} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900" />
            <button type="button" onClick={() => onChange(rows.filter((_, idx) => idx !== i))} className="flex-shrink-0 rounded-lg border border-slate-300 px-2 text-slate-400 hover:border-red-400 hover:text-red-500"><Trash2 size={13} /></button>
          </div>
        </div>
      ))}
      {rows.length < 3 && (
        <button type="button" onClick={() => onChange([...rows, { branch: '', from: '', to: '', discharge: '' }])}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-blue-400">
          <Plus size={13} /> Add branch of service
        </button>
      )}
    </div>
  )
}
