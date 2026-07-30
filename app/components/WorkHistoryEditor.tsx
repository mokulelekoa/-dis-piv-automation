'use client'

import { useCallback, useState } from 'react'
import { Plus, Trash2, Loader2, CheckCircle2, AlertTriangle, Briefcase, Users } from 'lucide-react'
import type { WorkHistory } from '@/lib/profile'
import { emptyEmployment, emptyReference } from '@/lib/profile'

/**
 * Editor for the reusable career record: employment history + references.
 * Saved once, then Smart Fill maps it onto whatever application layout gets
 * uploaded. The parent server component provides the initial state; saves
 * replace the whole record (small data, simplest correct model).
 */
export default function WorkHistoryEditor({ applicantId, initial }: {
  applicantId: string
  initial: WorkHistory
}) {
  const [wh, setWh] = useState<WorkHistory>(initial)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const save = useCallback(async () => {
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/applicants/${applicantId}/work-history`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wh),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed')
      setWh(json.workHistory as WorkHistory)
      setSavedAt(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [applicantId, wh])

  const setJob = (i: number, patch: Partial<WorkHistory['jobs'][number]>) =>
    setWh(prev => ({ ...prev, jobs: prev.jobs.map((j, k) => k === i ? { ...j, ...patch } : j) }))
  const setRef = (i: number, patch: Partial<WorkHistory['references'][number]>) =>
    setWh(prev => ({ ...prev, references: prev.references.map((r, k) => k === i ? { ...r, ...patch } : r) }))

  const input = 'w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-300 focus:border-blue-500 focus:outline-none'
  const label = 'mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400'

  return (
    <div className="space-y-8">
      {/* Jobs */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Briefcase size={18} className="text-blue-600" />
          <h2 className="text-base font-black text-slate-900">Employment history</h2>
          <span className="text-xs text-slate-400">most recent first</span>
        </div>
        {wh.jobs.length === 0 && (
          <p className="mb-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-sm text-slate-400">
            No jobs saved yet — add your most recent job first.
          </p>
        )}
        <div className="space-y-4">
          {wh.jobs.map((j, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wide text-slate-400">Job {i + 1}</span>
                <button type="button" onClick={() => setWh(p => ({ ...p, jobs: p.jobs.filter((_, k) => k !== i) }))}
                  className="inline-flex items-center gap-1 text-xs font-bold text-red-400 transition hover:text-red-600">
                  <Trash2 size={13} /> Remove
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><span className={label}>Employer</span>
                  <input className={input} value={j.employer} onChange={e => setJob(i, { employer: e.target.value })} placeholder="Company name" /></div>
                <div><span className={label}>Job title</span>
                  <input className={input} value={j.title} onChange={e => setJob(i, { title: e.target.value })} placeholder="Pharmacy Technician" /></div>
                <div><span className={label}>From</span>
                  <input className={input} value={j.startDate} onChange={e => setJob(i, { startDate: e.target.value })} placeholder="06/2022" /></div>
                <div><span className={label}>To</span>
                  <input className={input} value={j.endDate} onChange={e => setJob(i, { endDate: e.target.value })} placeholder="Leave blank if current" /></div>
                <div><span className={label}>City</span>
                  <input className={input} value={j.city} onChange={e => setJob(i, { city: e.target.value })} /></div>
                <div><span className={label}>State</span>
                  <input className={input} value={j.state} onChange={e => setJob(i, { state: e.target.value })} /></div>
                <div><span className={label}>Supervisor</span>
                  <input className={input} value={j.supervisor} onChange={e => setJob(i, { supervisor: e.target.value })} /></div>
                <div><span className={label}>Company phone</span>
                  <input className={input} value={j.phone} onChange={e => setJob(i, { phone: e.target.value })} /></div>
                <div className="sm:col-span-2"><span className={label}>Duties / responsibilities</span>
                  <textarea className={`${input} min-h-16`} value={j.duties} onChange={e => setJob(i, { duties: e.target.value })} /></div>
                <div><span className={label}>Reason for leaving</span>
                  <input className={input} value={j.reasonForLeaving} onChange={e => setJob(i, { reasonForLeaving: e.target.value })} /></div>
                <label className="flex items-end gap-2 pb-1.5 text-sm text-slate-700">
                  <input type="checkbox" checked={j.mayContact} onChange={e => setJob(i, { mayContact: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                  Employers may contact
                </label>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setWh(p => ({ ...p, jobs: [...p.jobs, emptyEmployment()] }))}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-blue-400 hover:bg-slate-50">
          <Plus size={16} /> Add a job
        </button>
      </section>

      {/* References */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Users size={18} className="text-blue-600" />
          <h2 className="text-base font-black text-slate-900">References</h2>
        </div>
        {wh.references.length === 0 && (
          <p className="mb-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-sm text-slate-400">
            No references saved yet — most applications ask for two or three.
          </p>
        )}
        <div className="space-y-4">
          {wh.references.map((r, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wide text-slate-400">Reference {i + 1}</span>
                <button type="button" onClick={() => setWh(p => ({ ...p, references: p.references.filter((_, k) => k !== i) }))}
                  className="inline-flex items-center gap-1 text-xs font-bold text-red-400 transition hover:text-red-600">
                  <Trash2 size={13} /> Remove
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><span className={label}>Name</span>
                  <input className={input} value={r.name} onChange={e => setRef(i, { name: e.target.value })} /></div>
                <div><span className={label}>Relationship</span>
                  <input className={input} value={r.relationship} onChange={e => setRef(i, { relationship: e.target.value })} placeholder="Former supervisor" /></div>
                <div><span className={label}>Company</span>
                  <input className={input} value={r.company} onChange={e => setRef(i, { company: e.target.value })} /></div>
                <div><span className={label}>Phone</span>
                  <input className={input} value={r.phone} onChange={e => setRef(i, { phone: e.target.value })} /></div>
                <div className="sm:col-span-2"><span className={label}>Email</span>
                  <input className={input} value={r.email} onChange={e => setRef(i, { email: e.target.value })} /></div>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setWh(p => ({ ...p, references: [...p.references, emptyReference()] }))}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-blue-400 hover:bg-slate-50">
          <Plus size={16} /> Add a reference
        </button>
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-red-500" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="button" disabled={saving} onClick={save}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-60">
          {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save my info'}
        </button>
        {savedAt && !saving && (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-600">
            <CheckCircle2 size={16} /> Saved — Smart Fill will use it on every form.
          </span>
        )}
      </div>
    </div>
  )
}
