'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, AlertTriangle, Plus, Trash2, Download, PenLine } from 'lucide-react'
import { type CandidateProfile, emptyProfile } from '@/lib/profile'
import {
  type PacketAnswers, type YesNo, emptyAnswers, MARITAL_OPTIONS,
  BREAK_IN_SERVICE_OPTIONS, validateAnswers, needsBackgroundExplanation,
} from '@/lib/forms/questions'
import { requiredFormsForRole, getSpec, type PacketRole } from '@/lib/forms/specs'
import PhotoUpload from './PhotoUpload'

export default function Questionnaire({
  applicantId, role, initialProfile, initialAnswers, firstName, lastName, hasPhoto,
}: {
  applicantId: string
  role: PacketRole
  initialProfile: CandidateProfile | null
  initialAnswers: PacketAnswers | null
  firstName: string
  lastName: string
  hasPhoto: boolean
}) {
  const router = useRouter()
  const [profile, setProfile] = useState<CandidateProfile>(initialProfile ?? emptyProfile())
  const [answers, setAnswers] = useState<PacketAnswers>(initialAnswers ?? emptyAnswers())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const problems = useMemo(() => validateAnswers(answers), [answers])
  const showExplanation = needsBackgroundExplanation(answers)
  const isPRorFN = answers.citizenshipStatus === 'PR' || answers.citizenshipStatus === 'FN'

  function p<K extends keyof CandidateProfile>(k: K, v: CandidateProfile[K]) {
    setProfile(prev => ({ ...prev, [k]: v })); setSaved(false)
  }
  function a<K extends keyof PacketAnswers>(k: K, v: PacketAnswers[K]) {
    setAnswers(prev => ({ ...prev, [k]: v })); setSaved(false)
  }

  async function save() {
    setSaving(true); setError(null)
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/applicants/${applicantId}/profile`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile),
        }),
        fetch(`/api/applicants/${applicantId}/answers`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(answers),
        }),
      ])
      if (!r1.ok || !r2.ok) throw new Error('Save failed')
      setSaved(true)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const requiredForms = requiredFormsForRole(role)

  return (
    <div className="space-y-8">
      {/* Identity */}
      <Section title="Your identity" hint="Pulled from your ID where possible. Confirm everything is correct — these feed every form.">
        <div className="mb-6">
          <PhotoUpload applicantId={applicantId} firstName={firstName} lastName={lastName} hasPhoto={hasPhoto} />
        </div>
        <Grid>
          <Text label="First name" value={profile.firstName} onChange={v => p('firstName', v)} />
          <Text label="Middle name" value={profile.middleName} onChange={v => p('middleName', v)} disabled={profile.hasNoMiddleName}
            note={<Check label='No middle name (renders as "NMN")' checked={profile.hasNoMiddleName} onChange={v => p('hasNoMiddleName', v)} />} />
          <Text label="Last name" value={profile.lastName} onChange={v => p('lastName', v)} />
          <Text label="Suffix" value={profile.suffix} onChange={v => p('suffix', v)} placeholder="Jr, Sr, II…" />
          <Text label="Date of birth" type="date" value={profile.dateOfBirth} onChange={v => p('dateOfBirth', v)} />
          <Text label="Sex" value={profile.sex} onChange={v => p('sex', v)} placeholder="M / F" />
          <Text label="Social Security Number" value={profile.ssn} onChange={v => p('ssn', v)} className="sm:col-span-2" />
          <Text label="City of birth" value={profile.placeOfBirthCity} onChange={v => p('placeOfBirthCity', v)} />
          <div className="grid grid-cols-2 gap-4">
            <Text label="State of birth" value={profile.placeOfBirthState} onChange={v => p('placeOfBirthState', v)} placeholder="HI" />
            <Text label="Country of birth" value={profile.placeOfBirthCountry} onChange={v => p('placeOfBirthCountry', v)} placeholder="USA" />
          </div>
          <Text label="Country of citizenship" value={profile.citizenshipCountry} onChange={v => p('citizenshipCountry', v)} />
          <Text label="Email" type="email" value={profile.email} onChange={v => p('email', v)} />
        </Grid>
      </Section>

      {/* Citizenship status */}
      <Section title="Citizenship status" hint="Only you can confirm this — it's never inferred from a document.">
        <Options label="I am a…" value={answers.citizenshipStatus}
          options={[{ v: 'US', l: 'U.S. Citizen' }, { v: 'PR', l: 'Permanent Resident' }, { v: 'FN', l: 'Foreign National' }]}
          onChange={v => a('citizenshipStatus', v as PacketAnswers['citizenshipStatus'])} />
        {isPRorFN && (
          <YesNoRow label="Have you lived in the U.S. for the last 3 consecutive years?"
            value={answers.livedInUS3Years} onChange={v => a('livedInUS3Years', v)} />
        )}
        <SelectField label="Marital status" value={answers.maritalStatus}
          options={[...MARITAL_OPTIONS]} onChange={v => a('maritalStatus', v)} />
      </Section>

      {/* Other names */}
      <Section title="Other names used" hint="Maiden name, prior legal names, or aliases. Leave blank if none.">
        <Grid>
          <Text label="Other name 1" value={answers.otherNamesUsed[0] ?? ''}
            onChange={v => a('otherNamesUsed', [v, answers.otherNamesUsed[1] ?? ''].filter((_, i) => i === 0 || (answers.otherNamesUsed[1] ?? '')) as string[])} />
          <Text label="Other name 2" value={answers.otherNamesUsed[1] ?? ''}
            onChange={v => a('otherNamesUsed', [answers.otherNamesUsed[0] ?? '', v])} />
        </Grid>
      </Section>

      {/* Selective Service & military */}
      <Section title="Selective Service & military">
        <Options label="Have you registered with the Selective Service System?" value={answers.registeredSelectiveService}
          options={[{ v: 'Yes', l: 'Yes' }, { v: 'No', l: 'No' }, { v: 'NA', l: 'Not applicable' }]}
          onChange={v => a('registeredSelectiveService', v as PacketAnswers['registeredSelectiveService'])} />
        <YesNoRow label="Have you ever served in the U.S. military?"
          value={answers.servedMilitary} onChange={v => a('servedMilitary', v)} />
        {answers.servedMilitary === 'Yes' && (
          <MilitaryRows value={answers.militaryService} onChange={v => a('militaryService', v)} />
        )}
      </Section>

      {/* Background declarations */}
      <Section title="Background declarations" hint="Federal law requires honest answers. A 'Yes' is not automatically disqualifying — but must be explained.">
        <YesNoRow label="In the last 7 years, have you been convicted, imprisoned, on probation, or on parole?" value={answers.convicted7yr} onChange={v => a('convicted7yr', v)} />
        <YesNoRow label="Have you been court-martialed in the last 7 years?" value={answers.courtMartialed7yr} onChange={v => a('courtMartialed7yr', v)} />
        <YesNoRow label="Are you currently under charges for any violation of law?" value={answers.underCharges} onChange={v => a('underCharges', v)} />
        <YesNoRow label="Have you been fired, debarred, or quit after being told you would be fired?" value={answers.firedOrQuit} onChange={v => a('firedOrQuit', v)} />
        <YesNoRow label="Are you delinquent on any Federal debt?" value={answers.delinquentFederalDebt} onChange={v => a('delinquentFederalDebt', v)} />
        {showExplanation && (
          <Area label="Explanation (required for any 'Yes' above)" value={answers.backgroundExplanation} onChange={v => a('backgroundExplanation', v)} />
        )}
      </Section>

      {/* Federal employment */}
      <Section title="Federal employment history">
        <YesNoRow label="Do any of your relatives work for the agency you're applying to?" value={answers.relativesInAgency} onChange={v => a('relativesInAgency', v)} />
        <YesNoRow label="Do you receive (or have you applied for) military/Federal/D.C. retirement or pension?" value={answers.receivesFederalRetirement} onChange={v => a('receivesFederalRetirement', v)} />
        <Text label="When did you leave your last Federal job? (leave blank if never)" value={answers.leftLastFederalJob} onChange={v => a('leftLastFederalJob', v)} placeholder="MM/DD/YYYY" />
        <Options label="Did you waive Basic or optional life insurance?" value={answers.waivedLifeInsurance}
          options={[{ v: 'Yes', l: 'Yes' }, { v: 'No', l: 'No' }, { v: 'Do Not Know', l: "Don't know" }]}
          onChange={v => a('waivedLifeInsurance', v as PacketAnswers['waivedLifeInsurance'])} />
        {answers.waivedLifeInsurance === 'Yes' && (
          <Options label="Did you later cancel the waivers?" value={answers.canceledWaivers}
            options={[{ v: 'Yes', l: 'Yes' }, { v: 'No', l: 'No' }, { v: 'Do Not Know', l: "Don't know" }]}
            onChange={v => a('canceledWaivers', v as PacketAnswers['canceledWaivers'])} />
        )}
      </Section>

      {/* Self-certification */}
      <Section title="Continuous service self-certification">
        <Options label="Select the statement that applies to you:" value={answers.breakInService}
          options={BREAK_IN_SERVICE_OPTIONS.map(o => ({ v: o.value, l: o.label }))}
          onChange={v => a('breakInService', v as PacketAnswers['breakInService'])} stacked />
        {answers.breakInService && answers.breakInService !== 'none' && (
          <Text label="Date you left Federal employment" value={answers.dateLeftFederalEmployment} onChange={v => a('dateLeftFederalEmployment', v)} placeholder="MM/DD/YYYY" />
        )}
      </Section>

      {/* Save */}
      <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs">
            {problems.length === 0
              ? <span className="inline-flex items-center gap-1.5 font-semibold text-green-600"><CheckCircle2 size={14} /> All required questions answered</span>
              : <span className="inline-flex items-center gap-1.5 font-semibold text-amber-600"><AlertTriangle size={14} /> {problems.length} question{problems.length === 1 ? '' : 's'} still need answers</span>}
          </div>
          <button onClick={save} disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : saved ? <><CheckCircle2 size={15} /> Saved</> : 'Save answers'}
          </button>
        </div>
        {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
        {problems.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {problems.map((pr, i) => <li key={i} className="text-[11px] text-amber-700">• {pr}</li>)}
          </ul>
        )}
      </div>

      {/* Generate */}
      <Section title="Your filled forms" hint="Download each completed VA form, print it, sign in black ink, then upload the scan back. Signature and date are intentionally left blank.">
        <div className="space-y-2">
          {requiredForms.map(specId => (
            <div key={specId} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">{getSpec(specId)?.label ?? specId}</div>
                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400"><PenLine size={11} /> Original VA form, pre-filled · wet signature required</div>
              </div>
              <a href={`/api/applicants/${applicantId}/generate?specId=${specId}`}
                className="inline-flex flex-shrink-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-400 hover:bg-blue-50">
                <Download size={14} /> Download
              </a>
            </div>
          ))}
        </div>
        {!saved && (
          <p className="mt-2 text-[11px] text-amber-600">Tip: save your answers first so the latest data is in the downloaded forms.</p>
        )}
      </Section>
    </div>
  )
}

/* ---------- small presentational pieces ---------- */

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">{title}</h2>
      {hint && <p className="mt-1 mb-3 text-xs text-slate-500">{hint}</p>}
      {!hint && <div className="mb-3" />}
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
}

function Text({ label, value, onChange, type = 'text', placeholder, disabled, className, note }: {
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

function Area({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30" />
    </div>
  )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-slate-500">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /> {label}
    </label>
  )
}

function SelectField({ label, value, options, onChange }: {
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

function YesNoRow({ label, value, onChange }: { label: string; value: YesNo | '' | 'NA' | 'Do Not Know'; onChange: (v: YesNo) => void }) {
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

function Options({ label, value, options, onChange, stacked }: {
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

function MilitaryRows({ value, onChange }: { value: import('@/lib/forms/questions').MilitaryService[]; onChange: (v: import('@/lib/forms/questions').MilitaryService[]) => void }) {
  const rows = value
  function update(i: number, patch: Partial<(typeof rows)[number]>) {
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
