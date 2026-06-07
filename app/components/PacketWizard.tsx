'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, CheckCircle2, AlertTriangle, ArrowLeft, ArrowRight, Download,
  PenLine, FileText, ShieldCheck,
} from 'lucide-react'
import { type CandidateProfile, emptyProfile } from '@/lib/profile'
import {
  type PacketAnswers, emptyAnswers, MARITAL_OPTIONS,
  BREAK_IN_SERVICE_OPTIONS, needsBackgroundExplanation,
} from '@/lib/forms/questions'
import { requiredFormsForRole, getSpec, ROLE_LABELS, type PacketRole } from '@/lib/forms/specs'
import type { FormState } from '@/lib/store'
import PhotoUpload from './PhotoUpload'
import FormUpload from './FormUpload'
import {
  Section, Grid, Text, Area, Check, SelectField, YesNoRow, Options, MilitaryRows,
} from './fields'

/**
 * The candidate-facing packet wizard. Walks the applicant through every field the
 * VA packet needs — grouped to mirror each real form — then fills the ACTUAL VA
 * AcroForm PDFs on the backend for the candidate to review, print, wet-sign, and
 * upload. (These three forms require a wet ink signature, so the flow ends in
 * print → sign → upload; digital signatures are not VA-acceptable here.)
 */
export default function PacketWizard({
  applicantId, role, initialProfile, initialAnswers, initialForms, firstName, lastName, hasPhoto,
}: {
  applicantId: string
  role: PacketRole
  initialProfile: CandidateProfile | null
  initialAnswers: PacketAnswers | null
  initialForms: FormState[]
  firstName: string
  lastName: string
  hasPhoto: boolean
}) {
  const router = useRouter()
  const [profile, setProfile] = useState<CandidateProfile>(initialProfile ?? emptyProfile())
  const [answers, setAnswers] = useState<PacketAnswers>(initialAnswers ?? emptyAnswers())
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  function p<K extends keyof CandidateProfile>(k: K, v: CandidateProfile[K]) {
    setProfile(prev => ({ ...prev, [k]: v }))
  }
  function a<K extends keyof PacketAnswers>(k: K, v: PacketAnswers[K]) {
    setAnswers(prev => ({ ...prev, [k]: v }))
  }

  const requiredForms = requiredFormsForRole(role)
  const isPRorFN = answers.citizenshipStatus === 'PR' || answers.citizenshipStatus === 'FN'
  const showExplanation = needsBackgroundExplanation(answers)

  // ---- step definitions (each tagged with the VA form it feeds) ----
  const steps = useMemo<WizardStep[]>(() => [
    {
      key: 'welcome',
      title: 'Before you begin',
      forms: ['OF-306', 'BI Request', 'Self-Certification'],
      validate: () => [],
      render: () => (
        <Section title="What happens here" hint="A few minutes of guided questions — no PDF wrangling.">
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              {firstName}, we&rsquo;ll walk you through every question on your {ROLE_LABELS[role]} VA
              packet, one section at a time. Most identity details are pulled from your ID — you only
              confirm them and answer the declarations no document can prove.
            </p>
            <p>
              When you finish, we generate your <span className="font-semibold text-slate-800">actual
              VA forms, already filled in</span>. You review each one, print it, sign in black ink,
              and upload the scan back. That&rsquo;s it.
            </p>
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <PenLine size={15} className="mt-0.5 flex-shrink-0" />
              <span>
                These VA forms require a <span className="font-semibold">wet ink signature</span> —
                digital signatures are rejected. You&rsquo;ll print, sign, and re-upload at the end.
              </span>
            </div>
            <p className="text-xs text-slate-500">Have your Social Security Number and place-of-birth details handy.</p>
          </div>
        </Section>
      ),
    },
    {
      key: 'identity',
      title: 'Your identity',
      forms: ['OF-306', 'BI Request', 'Self-Certification'],
      validate: () => {
        const out: string[] = []
        const req: [keyof CandidateProfile, string][] = [
          ['firstName', 'First name'], ['lastName', 'Last name'],
          ['dateOfBirth', 'Date of birth'], ['sex', 'Sex'], ['ssn', 'Social Security Number'],
          ['placeOfBirthCity', 'City of birth'], ['placeOfBirthState', 'State of birth'],
          ['placeOfBirthCountry', 'Country of birth'], ['citizenshipCountry', 'Country of citizenship'],
          ['email', 'Email'],
        ]
        for (const [k, label] of req) if (!String(profile[k] ?? '').trim()) out.push(`${label} is required.`)
        if (!profile.middleName.trim() && !profile.hasNoMiddleName) {
          out.push('Enter a middle name or check "No middle name".')
        }
        return out
      },
      render: () => (
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
      ),
    },
    {
      key: 'citizenship',
      title: 'Citizenship & other names',
      forms: ['OF-306', 'BI Request'],
      validate: () => {
        const out: string[] = []
        if (!answers.citizenshipStatus) out.push('Citizenship status is required.')
        if (isPRorFN && !answers.livedInUS3Years) out.push('Lived-in-US-3-consecutive-years question is required.')
        if (!answers.maritalStatus) out.push('Marital status is required.')
        return out
      },
      render: () => (
        <>
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
          <div className="mt-8">
            <Section title="Other names used" hint="Maiden name, prior legal names, or aliases. Leave blank if none.">
              <Grid>
                <Text label="Other name 1" value={answers.otherNamesUsed[0] ?? ''}
                  onChange={v => a('otherNamesUsed', [v, answers.otherNamesUsed[1] ?? ''])} />
                <Text label="Other name 2" value={answers.otherNamesUsed[1] ?? ''}
                  onChange={v => a('otherNamesUsed', [answers.otherNamesUsed[0] ?? '', v])} />
              </Grid>
            </Section>
          </div>
        </>
      ),
    },
    {
      key: 'service',
      title: 'Selective Service & military',
      forms: ['OF-306'],
      validate: () => {
        const out: string[] = []
        if (!answers.registeredSelectiveService) out.push('Selective Service registration is required.')
        if (!answers.servedMilitary) out.push('Military service question is required.')
        if (answers.servedMilitary === 'Yes' && answers.militaryService.length === 0) {
          out.push('Add at least one branch of military service (or change the answer to No).')
        }
        return out
      },
      render: () => (
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
      ),
    },
    {
      key: 'background',
      title: 'Background declarations',
      forms: ['OF-306'],
      validate: () => {
        const out: string[] = []
        const req: [keyof PacketAnswers, string][] = [
          ['convicted7yr', 'Conviction/probation/parole question'],
          ['courtMartialed7yr', 'Court-martial question'],
          ['underCharges', 'Currently-under-charges question'],
          ['firedOrQuit', 'Fired/debarred/quit question'],
          ['delinquentFederalDebt', 'Federal-debt delinquency question'],
        ]
        for (const [k, label] of req) if (!answers[k]) out.push(`${label} is unanswered.`)
        if (needsBackgroundExplanation(answers) && !answers.backgroundExplanation.trim()) {
          out.push('You answered "Yes" to a background question — a written explanation is required.')
        }
        return out
      },
      render: () => (
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
      ),
    },
    {
      key: 'fedemployment',
      title: 'Federal employment history',
      forms: ['OF-306'],
      validate: () => {
        const out: string[] = []
        if (!answers.relativesInAgency) out.push('Relatives-in-agency question is required.')
        if (!answers.receivesFederalRetirement) out.push('Federal retirement/pension question is required.')
        return out
      },
      render: () => (
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
      ),
    },
    {
      key: 'continuous',
      title: 'Continuous service',
      forms: ['Self-Certification'],
      validate: () => {
        const out: string[] = []
        if (!answers.breakInService) out.push('Break-in-service selection is required.')
        if (answers.breakInService && answers.breakInService !== 'none' && !answers.dateLeftFederalEmployment.trim()) {
          out.push('Date you left federal employment is required for your break-in-service selection.')
        }
        return out
      },
      render: () => (
        <Section title="Continuous service self-certification" hint="Tell us about any break in your federal service.">
          <Options label="Select the statement that applies to you:" value={answers.breakInService}
            options={BREAK_IN_SERVICE_OPTIONS.map(o => ({ v: o.value, l: o.label }))}
            onChange={v => a('breakInService', v as PacketAnswers['breakInService'])} stacked />
          {answers.breakInService && answers.breakInService !== 'none' && (
            <Text label="Date you left Federal employment" value={answers.dateLeftFederalEmployment} onChange={v => a('dateLeftFederalEmployment', v)} placeholder="MM/DD/YYYY" />
          )}
        </Section>
      ),
    },
    {
      key: 'review',
      title: 'Review, sign & upload',
      forms: ['OF-306', 'BI Request', 'Self-Certification'],
      validate: () => [],
      render: () => (
        <ReviewStep applicantId={applicantId} requiredForms={requiredForms} initialForms={initialForms} />
      ),
    },
  ], [profile, answers, isPRorFN, showExplanation, applicantId, firstName, lastName, hasPhoto, role, requiredForms, initialForms])

  const current = steps[step]
  const stepProblems = current.validate()
  const isReview = current.key === 'review'
  const lastInputStep = steps.length - 2 // step before review

  async function persist(): Promise<boolean> {
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
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function next() {
    if (stepProblems.length > 0) { setShowErrors(true); return }
    const ok = await persist()
    if (!ok) return
    setShowErrors(false)
    // Refresh server data when entering review so generated PDFs use saved values.
    if (step === lastInputStep) router.refresh()
    setStep(s => Math.min(s + 1, steps.length - 1))
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function back() {
    setShowErrors(false)
    setStep(s => Math.max(s - 1, 0))
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const pct = Math.round((step / (steps.length - 1)) * 100)

  return (
    <div>
      {/* Progress */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>Step {step + 1} of {steps.length} · {current.title}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {current.forms.map(f => (
            <span key={f} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
              <FileText size={9} /> {f}
            </span>
          ))}
        </div>
      </div>

      {/* Step body */}
      <div className="min-h-[280px]">{current.render()}</div>

      {/* Validation surface */}
      {showErrors && stepProblems.length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
            <AlertTriangle size={13} /> Please finish this step:
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {stepProblems.map((pr, i) => <li key={i} className="text-[11px] text-amber-700">• {pr}</li>)}
          </ul>
        </div>
      )}
      {error && <p className="mt-3 text-xs font-medium text-red-600">{error}</p>}

      {/* Nav */}
      <div className="sticky bottom-0 -mx-4 mt-8 flex items-center justify-between gap-4 border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
        <button onClick={back} disabled={step === 0}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 disabled:opacity-40">
          <ArrowLeft size={15} /> Back
        </button>

        {isReview ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600">
            <ShieldCheck size={14} /> Forms generated — review, sign &amp; upload below
          </span>
        ) : (
          <button onClick={next} disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60">
            {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
              : step === lastInputStep ? <>Generate my forms <ArrowRight size={15} /></>
              : <>Continue <ArrowRight size={15} /></>}
          </button>
        )}
      </div>
    </div>
  )
}

interface WizardStep {
  key: string
  title: string
  forms: string[]
  validate: () => string[]
  render: () => React.ReactNode
}

/* ---------- review step ---------- */

function ReviewStep({ applicantId, requiredForms, initialForms }: {
  applicantId: string; requiredForms: string[]; initialForms: FormState[]
}) {
  return (
    <div className="space-y-6">
      <Section title="Your filled VA forms"
        hint="Each form below is the real VA document, filled in from your answers. Review it, download and print, sign in black ink where indicated, then upload the signed scan back.">
        <div className="space-y-6">
          {requiredForms.map(specId => {
            const spec = getSpec(specId)
            const form = initialForms.find(f => f.specId === specId)
              ?? { specId, uploaded: false, completeness: 0, missing: [], issues: [] }
            const inlineUrl = `/api/applicants/${applicantId}/generate?specId=${specId}&disposition=inline`
            const downloadUrl = `/api/applicants/${applicantId}/generate?specId=${specId}`
            return (
              <div key={specId} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-slate-900">{spec?.label ?? specId}</h3>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                      <PenLine size={11} /> Original VA form, pre-filled · wet signature required
                    </p>
                  </div>
                  <a href={downloadUrl}
                    className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-blue-400 hover:bg-blue-50">
                    <Download size={13} /> Download to print
                  </a>
                </div>

                <iframe
                  src={inlineUrl}
                  title={`${spec?.label ?? specId} preview`}
                  className="h-80 w-full rounded-lg border border-slate-200 bg-slate-50"
                />

                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    Upload your signed copy
                  </p>
                  <FormUpload applicantId={applicantId} specId={specId} form={form} label={spec?.label ?? specId} />
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
        <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0" />
        <span>
          Once every form is uploaded and shows 100%, your packet is ready for coordinator review.
          You can return to this page anytime to re-download or re-upload.
        </span>
      </div>
    </div>
  )
}
