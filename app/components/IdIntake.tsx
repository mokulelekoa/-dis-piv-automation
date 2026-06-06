'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload, FileText, Loader2, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { ExtractedIdData } from '@/lib/ai/id-parser'
import { type CandidateProfile, emptyProfile, lastFour } from '@/lib/profile'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif'

type ScanState = 'idle' | 'scanning' | 'done' | 'failed'

/** Which profile keys were populated by the last scan (for the "auto-filled" badge). */
type AutoFilled = Partial<Record<keyof CandidateProfile, boolean>>

function mergeExtracted(profile: CandidateProfile, d: ExtractedIdData): { next: CandidateProfile; filled: AutoFilled } {
  const next = { ...profile }
  const filled: AutoFilled = {}
  const set = (k: keyof CandidateProfile, v: string | null | undefined) => {
    if (v && !next[k]) { (next[k] as string) = v; filled[k] = true }
  }
  set('firstName', d.firstName)
  set('middleName', d.middleName)
  set('lastName', d.lastName)
  set('suffix', d.suffix)
  set('dateOfBirth', d.dateOfBirth)
  set('sex', d.sex)
  set('placeOfBirthCity', d.placeOfBirthCity)
  set('placeOfBirthState', d.placeOfBirthState)
  set('placeOfBirthCountry', d.placeOfBirthCountry)
  set('citizenshipCountry', d.citizenshipCountry)
  set('addressLine', d.addressLine)
  set('addressCity', d.addressCity)
  set('addressState', d.addressState)
  set('addressZip', d.addressZip)
  if (d.ssn && !next.ssn) { next.ssn = d.ssn; filled.ssn = true }
  // If the ID printed no middle name and the profile has none, tentatively flag NMN.
  if (!next.middleName && d.documentType && d.firstName && d.lastName) {
    next.hasNoMiddleName = next.hasNoMiddleName || !d.middleName
  }
  return { next, filled }
}

const DOC_LABELS: Record<string, string> = {
  US_PASSPORT: 'U.S. Passport', US_PASSPORT_CARD: 'U.S. Passport Card',
  FOREIGN_PASSPORT: 'Foreign Passport', DRIVERS_LICENSE: "Driver's License",
  STATE_ID: 'State ID Card', PERMANENT_RESIDENT_CARD: 'Permanent Resident Card',
  EMPLOYMENT_AUTHORIZATION: 'Employment Authorization', MILITARY_ID: 'Military ID',
  US_VISA: 'U.S. Visa', SOCIAL_SECURITY_CARD: 'Social Security Card',
  BIRTH_CERTIFICATE: 'Birth Certificate', CERTIFICATE_OF_NATURALIZATION: 'Certificate of Naturalization',
  OTHER: 'Other Document',
}

export default function IdIntake() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [profile, setProfile] = useState<CandidateProfile>(emptyProfile())
  const [autoFilled, setAutoFilled] = useState<AutoFilled>({})
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
      if (!json.scanned || !json.data) {
        setScanState('failed')
        return
      }
      const d = json.data as ExtractedIdData
      setLastDoc(d)
      setDocList(prev => [...prev, d])
      setProfile(prev => {
        const { next, filled } = mergeExtracted(prev, d)
        setAutoFilled(af => ({ ...af, ...filled }))
        return next
      })
      setScanState('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed')
      setScanState('failed')
    }
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) scan(f)
  }, [scan])

  function update<K extends keyof CandidateProfile>(k: K, v: CandidateProfile[K]) {
    setProfile(p => ({ ...p, [k]: v }))
    if (typeof v === 'string') setAutoFilled(af => ({ ...af, [k]: false }))
  }

  const ssnDetected = !!profile.ssn
  const l4 = lastFour(profile.ssn)

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">CMOP PIV Packet — Candidate Intake</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload a photo of your ID and we&rsquo;ll fill in everything it can prove. You only answer the
          questions an ID can&rsquo;t — those come after this step.
        </p>
      </header>

      {/* Drop zone */}
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
            {scanState === 'scanning' ? 'Reading your document…' : 'Drag & drop an ID, or click to browse'}
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

      {/* Status banners */}
      {scanState === 'done' && lastDoc && (
        <div className="mt-3 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0 text-green-600" />
          <div className="text-sm text-green-900">
            <span className="font-semibold">
              Read {DOC_LABELS[lastDoc.documentType ?? 'OTHER'] ?? 'document'}.
            </span>{' '}
            {lastDoc.isPrimaryId
              ? 'Counts as a primary form of ID.'
              : 'Counts as a secondary form of ID — make sure you also upload a primary ID.'}{' '}
            Review the fields below before continuing.
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

      {/* Uploaded docs summary */}
      {docList.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
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

      {/* Profile form */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-400">Candidate information</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First name" k="firstName" profile={profile} autoFilled={autoFilled} update={update} className="sm:col-span-1" />
          <Field label="Middle name" k="middleName" profile={profile} autoFilled={autoFilled} update={update}
            disabled={profile.hasNoMiddleName}
            note={
              <label className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                <input type="checkbox" checked={profile.hasNoMiddleName}
                  onChange={e => update('hasNoMiddleName', e.target.checked)} />
                No middle name (renders as &ldquo;NMN&rdquo; / &ldquo;No Middle Name&rdquo; per form)
              </label>
            } />
          <Field label="Last name" k="lastName" profile={profile} autoFilled={autoFilled} update={update} />
          <Field label="Suffix" k="suffix" profile={profile} autoFilled={autoFilled} update={update} placeholder="Jr, Sr, III…" />

          <Field label="Date of birth" k="dateOfBirth" type="date" profile={profile} autoFilled={autoFilled} update={update} />
          <Field label="Sex" k="sex" profile={profile} autoFilled={autoFilled} update={update} placeholder="M / F / X" />

          {/* SSN — sensitive */}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Social Security Number
              {autoFilled.ssn && <AutoBadge />}
            </label>
            <input
              value={profile.ssn}
              onChange={e => update('ssn', e.target.value)}
              placeholder="Only auto-filled from a Social Security card"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
            />
            {ssnDetected && (
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-700">
                <ShieldCheck size={12} /> Sensitive. Used only to generate the file-naming last-four
                {l4 && <> (<span className="font-mono font-semibold">{l4}</span>)</>}; stored encrypted.
              </p>
            )}
          </div>

          <Field label="Place of birth — city" k="placeOfBirthCity" profile={profile} autoFilled={autoFilled} update={update} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="State" k="placeOfBirthState" profile={profile} autoFilled={autoFilled} update={update} placeholder="TX" />
            <Field label="Country" k="placeOfBirthCountry" profile={profile} autoFilled={autoFilled} update={update} placeholder="USA" />
          </div>

          <Field label="Citizenship country" k="citizenshipCountry" profile={profile} autoFilled={autoFilled} update={update} />
          <Field label="Phone" k="phone" profile={profile} autoFilled={autoFilled} update={update} placeholder="(000) 000-0000" />

          <Field label="Email" k="email" type="email" profile={profile} autoFilled={autoFilled} update={update} className="sm:col-span-2" />

          <Field label="Address" k="addressLine" profile={profile} autoFilled={autoFilled} update={update} className="sm:col-span-2" />
          <Field label="City" k="addressCity" profile={profile} autoFilled={autoFilled} update={update} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="State" k="addressState" profile={profile} autoFilled={autoFilled} update={update} placeholder="TX" />
            <Field label="ZIP" k="addressZip" profile={profile} autoFilled={autoFilled} update={update} />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-500">
            Next: the questions only you can answer (OF-306 background questions, prior federal service).
            Those are never guessed from a document.
          </p>
          <button
            type="button"
            className="flex-shrink-0 rounded-xl bg-accent-500 px-5 py-2 text-sm font-bold text-white hover:bg-accent-600"
            onClick={() => alert('Phase 3: human-only questionnaire + PDF fill comes next.')}
          >
            Continue
          </button>
        </div>
      </section>
    </div>
  )
}

function AutoBadge() {
  return (
    <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-green-700">
      from ID
    </span>
  )
}

function Field<K extends keyof CandidateProfile>({
  label, k, profile, autoFilled, update, type = 'text', placeholder, disabled, className, note,
}: {
  label: string
  k: K
  profile: CandidateProfile
  autoFilled: AutoFilled
  update: <T extends keyof CandidateProfile>(k: T, v: CandidateProfile[T]) => void
  type?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  note?: React.ReactNode
}) {
  const value = profile[k]
  return (
    <div className={className}>
      <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-400">
        {label}
        {autoFilled[k] && <AutoBadge />}
      </label>
      <input
        type={type}
        value={typeof value === 'string' ? value : ''}
        disabled={disabled}
        placeholder={placeholder}
        onChange={e => update(k, e.target.value as CandidateProfile[K])}
        className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30
          ${autoFilled[k] ? 'border-green-300 bg-green-50/40' : 'border-slate-200 bg-white'}
          ${disabled ? 'cursor-not-allowed bg-slate-100 text-slate-400' : ''}`}
      />
      {note}
    </div>
  )
}
