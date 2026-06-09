'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, CheckCircle2, AlertTriangle, ArrowLeft, ArrowRight, Download,
  PenLine, FileText, ShieldCheck,
} from 'lucide-react'
import { type CandidateProfile, emptyProfile, isUSCountry } from '@/lib/profile'
import {
  type PacketAnswers, emptyAnswers, MARITAL_OPTIONS,
  BREAK_IN_SERVICE_OPTIONS, needsBackgroundExplanation,
} from '@/lib/forms/questions'
import { requiredFormsForRole, getSpec, ROLE_LABELS, type PacketRole } from '@/lib/forms/specs'
import { US_STATE_OPTIONS } from '@/lib/geo'
import type { FormState } from '@/lib/store'
import type { ExtractedIdData } from '@/lib/ai/id-parser'
import IdScanDropzone from './IdScanDropzone'
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
  applicantId, role, initialProfile, initialAnswers, initialForms, firstName,
}: {
  applicantId: string
  role: PacketRole
  initialProfile: CandidateProfile | null
  initialAnswers: PacketAnswers | null
  initialForms: FormState[]
  firstName: string
}) {
  const router = useRouter()
  const [profile, setProfile] = useState<CandidateProfile>(initialProfile ?? emptyProfile())
  const [answers, setAnswers] = useState<PacketAnswers>(initialAnswers ?? emptyAnswers())
  const [autoFilled, setAutoFilled] = useState<AutoFilled>({})
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  function p<K extends keyof CandidateProfile>(k: K, v: CandidateProfile[K]) {
    setProfile(prev => ({ ...prev, [k]: v }))
    // A hand-edit overrides the ID — drop the "from ID" badge for that field.
    setAutoFilled(af => (af[k] ? { ...af, [k]: false } : af))
  }
  function a<K extends keyof PacketAnswers>(k: K, v: PacketAnswers[K]) {
    setAnswers(prev => ({ ...prev, [k]: v }))
  }

  // Merge the fields a scanned ID can prove into the profile, without clobbering
  // anything the candidate already typed, and flag what we filled for the badge.
  function applyExtractedId(d: ExtractedIdData) {
    setProfile(prev => {
      const next = { ...prev }
      const filled: AutoFilled = {}
      const set = (k: keyof CandidateProfile, v: string | null | undefined) => {
        if (v && !String(next[k] ?? '').trim()) { (next[k] as string) = v; filled[k] = true }
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
      if (d.ssn && !next.ssn.trim()) { next.ssn = d.ssn; filled.ssn = true }
      // ID printed no middle name and none typed yet → tentatively flag NMN.
      if (!next.middleName.trim() && d.firstName && d.lastName) {
        next.hasNoMiddleName = next.hasNoMiddleName || !d.middleName
      }
      setAutoFilled(af => ({ ...af, ...filled }))
      return next
    })
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
          ['placeOfBirthCity', 'City of birth'],
          ['placeOfBirthCountry', 'Country of birth'], ['citizenshipCountry', 'Country of citizenship'],
          ['email', 'Email'],
        ]
        for (const [k, label] of req) if (!String(profile[k] ?? '').trim()) out.push(`${label} is required.`)
        // State of birth only applies to U.S.-born candidates (matches form spec).
        if (isUSCountry(profile.placeOfBirthCountry) && !profile.placeOfBirthState.trim()) {
          out.push('State of birth is required for U.S.-born candidates.')
        }
        if (!profile.middleName.trim() && !profile.hasNoMiddleName) {
          out.push('Enter a middle name or check "No middle name".')
        }
        return out
      },
      render: () => (
        <Section title="Your identity" hint="Drop in an ID and we'll fill what it can prove. Confirm everything is correct — these feed every form.">
          <div className="mb-6">
            <IdScanDropzone onExtract={applyExtractedId} />
          </div>
          <Grid>
            <Text label="First name" value={profile.firstName} onChange={v => p('firstName', v)} highlight={autoFilled.firstName} required showError={showErrors} />
            <Text label="Middle name" value={profile.middleName} onChange={v => p('middleName', v)} disabled={profile.hasNoMiddleName} highlight={autoFilled.middleName}
              required={!profile.hasNoMiddleName} showError={showErrors}
              note={<Check label='No middle name (renders as "NMN")' checked={profile.hasNoMiddleName} onChange={v => p('hasNoMiddleName', v)} />} />
            <Text label="Last name" value={profile.lastName} onChange={v => p('lastName', v)} highlight={autoFilled.lastName} required showError={showErrors} />
            <Text label="Suffix" value={profile.suffix} onChange={v => p('suffix', v)} placeholder="Jr, Sr, II…" highlight={autoFilled.suffix} />
            <Text label="Date of birth" type="date" value={profile.dateOfBirth} onChange={v => p('dateOfBirth', v)} highlight={autoFilled.dateOfBirth} required showError={showErrors} />
            <Text label="Sex" value={profile.sex} onChange={v => p('sex', v)} placeholder="M / F" highlight={autoFilled.sex} required showError={showErrors} />
            <Text label="Social Security Number" value={profile.ssn} onChange={v => p('ssn', v)} className="sm:col-span-2" highlight={autoFilled.ssn} required showError={showErrors} />
            <PlaceOfBirthFields profile={profile} set={p} autoFilled={autoFilled} showError={showErrors} />
            <Text label="Country of citizenship" value={profile.citizenshipCountry} onChange={v => p('citizenshipCountry', v)} highlight={autoFilled.citizenshipCountry} required showError={showErrors} />
            <Text label="Email" type="email" value={profile.email} onChange={v => p('email', v)} required showError={showErrors} />
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
          <Section title="Citizenship Status" hint="Only you can confirm this — it's never inferred from a document.">
            <Options label="3b. Are you a U.S. Citizen?" value={answers.citizenshipStatus}
              options={[{ v: 'US', l: 'U.S. Citizen' }, { v: 'PR', l: 'Permanent Resident' }, { v: 'FN', l: 'Foreign National' }]}
              onChange={v => a('citizenshipStatus', v as PacketAnswers['citizenshipStatus'])} />
            {isPRorFN && (
              <YesNoRow label="Have you lived in the U.S. for the last 3 consecutive years?"
                value={answers.livedInUS3Years} onChange={v => a('livedInUS3Years', v)} />
            )}
            <SelectField label="Marital Status" value={answers.maritalStatus}
              options={[...MARITAL_OPTIONS]} onChange={v => a('maritalStatus', v)} />
          </Section>
          <div className="mt-8">
            <Section title="Other Names Ever Used" hint="For example, maiden name, nickname, etc. Leave blank if none.">
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
        <>
          <Section title="Selective Service Registration" hint="If you are a male born after December 31, 1959, and are at least 18 years of age, civil service employment law (5 U.S.C. 3328) requires that you must register with the Selective Service System, unless you meet certain exemptions.">
            <Options label="7b. Have you registered with the Selective Service System?" value={answers.registeredSelectiveService}
              options={[{ v: 'Yes', l: 'Yes' }, { v: 'No', l: 'No' }, { v: 'NA', l: 'Not applicable' }]}
              onChange={v => a('registeredSelectiveService', v as PacketAnswers['registeredSelectiveService'])} />
          </Section>

          <div className="mt-8">
            <Section title="Military Service">
              <div>
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold">8.</span> Have you ever served in the United States military?{' '}
                    <span className="text-slate-500">(If &ldquo;YES&rdquo;, provide information below)</span>
                  </p>
                  <div className="flex flex-shrink-0 gap-1.5">
                    {(['Yes', 'No'] as const).map(opt => (
                      <button key={opt} type="button" onClick={() => a('servedMilitary', opt)}
                        className={`rounded-lg border px-3 py-1 text-xs font-semibold uppercase transition
                          ${answers.servedMilitary === opt ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-blue-400'}`}>
                        {opt === 'Yes' ? 'Yes' : 'No'}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  If your only active duty was training in the Reserves or National Guard, answer &ldquo;NO.&rdquo;
                  If you answered &ldquo;YES,&rdquo; list the branch, dates, and type of discharge for all active duty.
                </p>
              </div>

              {answers.servedMilitary === 'Yes' && (
                <MilitaryRows value={answers.militaryService} onChange={v => a('militaryService', v)} />
              )}
            </Section>
          </div>
        </>
      ),
    },
    {
      key: 'background',
      title: 'Background Information',
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
        <Section title="Background Information" hint="For all questions, provide all additional requested information under item 16 or on attached sheets. The circumstances of each event you list will be considered. However, in most cases you can still be considered for Federal jobs.">
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
            For questions 9, 10, and 11, your answers should include convictions resulting from a plea of nolo
            contendere (no contest), but omit (1) traffic fines of $300 or less, (2) any violation of law committed
            before your 16th birthday, (3) any violation of law committed before your 18th birthday if finally
            decided in juvenile court or under a Youth Offender law, (4) any conviction set aside under the Federal
            Youth Corrections Act or similar state law, and (5) any conviction for which the record was expunged
            under Federal or state law.
          </p>
          <YesNoRow block value={answers.convicted7yr} onChange={v => a('convicted7yr', v)}
            label={<><strong>9.</strong> During the last 7 years, have you been convicted, been imprisoned, been on probation, or been on parole? (Includes felonies, firearms or explosives violations, misdemeanors, and all other offenses.) If &ldquo;YES,&rdquo; use item 16 to provide the date, explanation of the violation, place of occurrence, and the name and address of the police department or court involved.</>} />
          <YesNoRow block value={answers.courtMartialed7yr} onChange={v => a('courtMartialed7yr', v)}
            label={<><strong>10.</strong> Have you been convicted by a military court-martial in the past 7 years? (If no military service, answer &ldquo;NO.&rdquo;) If &ldquo;YES,&rdquo; use item 16 to provide the date, explanation of the violation, place of occurrence, and the name and address of the military authority or court involved.</>} />
          <YesNoRow block value={answers.underCharges} onChange={v => a('underCharges', v)}
            label={<><strong>11.</strong> Are you currently under charges for any violation of law? If &ldquo;YES,&rdquo; use item 16 to provide the date, explanation of the charges, place of occurrence, and the name and address of the police department or court involved.</>} />
          <YesNoRow block value={answers.firedOrQuit} onChange={v => a('firedOrQuit', v)}
            label={<><strong>12.</strong> During the last 5 years, have you been fired from any job for any reason, did you quit after being told that you would be fired, did you leave any job by mutual agreement because of specific problems, or were you debarred from Federal employment by the Office of Personnel Management or any other Federal agency? If &ldquo;YES,&rdquo; use item 16 to provide the date, an explanation of the problem, reason for leaving, and the employer&rsquo;s name and address.</>} />
          <YesNoRow block value={answers.delinquentFederalDebt} onChange={v => a('delinquentFederalDebt', v)}
            label={<><strong>13.</strong> Are you delinquent on any Federal debt? (Includes delinquencies arising from Federal taxes, loans, overpayment of benefits, and other debts to the U.S. Government, plus defaults of Federally guaranteed or insured loans such as student and home mortgage loans.) If &ldquo;YES,&rdquo; use item 16 to provide the type, length, and amount of the delinquency or default, and steps that you are taking to correct the error or repay the debt.</>} />
          {showExplanation && (
            <Area label="16. Provide details requested in items 7 through 15 and 18c in the space below or on attached sheets." value={answers.backgroundExplanation} onChange={v => a('backgroundExplanation', v)} />
          )}
        </Section>
      ),
    },
    {
      key: 'fedemployment',
      title: 'Additional Questions',
      forms: ['OF-306'],
      validate: () => {
        const out: string[] = []
        if (!answers.relativesInAgency) out.push('Relatives-in-agency question is required.')
        if (!answers.receivesFederalRetirement) out.push('Federal retirement/pension question is required.')
        return out
      },
      render: () => (
        <Section title="Additional Questions">
          <YesNoRow block value={answers.relativesInAgency} onChange={v => a('relativesInAgency', v)}
            label={<><strong>14.</strong> Do any of your relatives work for the agency or government organization to which you are submitting this form? (Include: father, mother, husband, wife, son, daughter, brother, sister, uncle, aunt, first cousin, nephew, niece, father-in-law, mother-in-law, son-in-law, daughter-in-law, brother-in-law, sister-in-law, stepfather, stepmother, stepson, stepdaughter, stepbrother, stepsister, half-brother, and half-sister.) If &ldquo;YES,&rdquo; use item 16 to provide the relative&rsquo;s name, relationship, and the department, agency, or branch of the Armed Forces for which your relative works.</>} />
          <YesNoRow block value={answers.receivesFederalRetirement} onChange={v => a('receivesFederalRetirement', v)}
            label={<><strong>15.</strong> Do you receive, or have you ever applied for, retirement pay, pension, or other retired pay based on military, Federal civilian, or District of Columbia Government service?</>} />
          <p className="pt-2 text-xs text-slate-500">
            <strong>18.</strong> Appointee (Only respond if you have been employed by the Federal Government before): Your
            elections of life insurance during previous Federal employment may affect your eligibility for life
            insurance during your new appointment. These questions are asked to help your personnel office make a
            correct determination.
          </p>
          <Text label="18a. When did you leave your last Federal job?" value={answers.leftLastFederalJob} onChange={v => a('leftLastFederalJob', v)} placeholder="MM / DD / YYYY" />
          <Options label="18b. When you worked for the Federal Government the last time, did you waive Basic Life Insurance or any type of optional life insurance?" value={answers.waivedLifeInsurance}
            options={[{ v: 'Yes', l: 'Yes' }, { v: 'No', l: 'No' }, { v: 'Do Not Know', l: 'Do Not Know' }]}
            onChange={v => a('waivedLifeInsurance', v as PacketAnswers['waivedLifeInsurance'])} />
          {answers.waivedLifeInsurance === 'Yes' && (
            <Options label={'18c. If you answered "YES" to item 18b, did you later cancel the waiver(s)? If your answer to item 18c is "NO," use item 16 to identify the type(s) of insurance for which waivers were not canceled.'} value={answers.canceledWaivers}
              options={[{ v: 'Yes', l: 'Yes' }, { v: 'No', l: 'No' }, { v: 'Do Not Know', l: 'Do Not Know' }]}
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
        <Section title="Self Certification of Continuous Service"
          hint="I hereby certify my break in service from my last federal employment is indicated by the block checked below.">
          <Options label="(Select One)" value={answers.breakInService}
            options={BREAK_IN_SERVICE_OPTIONS.map(o => ({ v: o.value, l: o.label }))}
            onChange={v => a('breakInService', v as PacketAnswers['breakInService'])} stacked />
          {answers.breakInService && answers.breakInService !== 'none' && (
            <Text label="Date I left federal employment was" value={answers.dateLeftFederalEmployment} onChange={v => a('dateLeftFederalEmployment', v)} placeholder="MM / DD / YYYY" />
          )}
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
            Federal employment is defined as any branch of the United States military (Active, Guard or Reserve),
            federal government civilian employee (any federal government agency), or a contractor working for the
            federal government.
          </p>
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
  ], [profile, answers, autoFilled, isPRorFN, showExplanation, applicantId, firstName, role, requiredForms, initialForms, showErrors])

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

/** Which profile keys the last ID scan populated (drives the "from ID" badge). */
type AutoFilled = Partial<Record<keyof CandidateProfile, boolean>>

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

/* ---------- place of birth (smart ZIP autofill) ---------- */

/**
 * City/State/Country of birth with a US ZIP shortcut: typing a 5-digit ZIP fills
 * City of birth and selects the State of birth dropdown (2-letter code, matching
 * the VA AcroForm). State of birth is shown only for U.S. births — foreign-born
 * candidates have no state, so it's hidden and cleared (mirrors the form spec).
 */
function PlaceOfBirthFields({ profile, set, autoFilled, showError }: {
  profile: CandidateProfile
  set: <K extends keyof CandidateProfile>(k: K, v: CandidateProfile[K]) => void
  autoFilled: AutoFilled
  showError: boolean
}) {
  const [zip, setZip] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  async function onZip(raw: string) {
    const z = raw.replace(/\D/g, '').slice(0, 5)
    setZip(z)
    if (z.length < 5) { setStatus('idle'); setMsg(''); return }
    setStatus('loading'); setMsg('Looking up ZIP…')
    try {
      const res = await fetch(`/api/zip?zip=${z}`)
      const data = await res.json()
      if (!res.ok) { setStatus('error'); setMsg(data.error ?? 'No US city found for that ZIP.'); return }
      set('placeOfBirthCity', data.city)
      set('placeOfBirthState', data.state)
      set('placeOfBirthCountry', 'United States of America')
      setStatus('ok'); setMsg(`Filled ${data.city}, ${data.state}`)
    } catch {
      setStatus('error'); setMsg('ZIP lookup unavailable — enter city and state below.')
    }
  }

  const country = profile.placeOfBirthCountry
  const showState = country.trim() === '' || isUSCountry(country)

  return (
    <div className="space-y-4 sm:col-span-2">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Birth ZIP (US) — optional
          </label>
          <input inputMode="numeric" maxLength={5} value={zip} placeholder="e.g. 96813"
            onChange={e => onZip(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30" />
          <p className={`mt-1 text-[11px] ${status === 'error' ? 'text-amber-600' : status === 'ok' ? 'text-emerald-600' : 'text-slate-500'}`}>
            {msg || 'Type a US ZIP to auto-fill city and state.'}
          </p>
        </div>
        <Text label="City of birth" value={profile.placeOfBirthCity} onChange={v => set('placeOfBirthCity', v)} highlight={autoFilled.placeOfBirthCity} required showError={showError} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Text label="Country of birth" value={country} placeholder="USA" highlight={autoFilled.placeOfBirthCountry} required showError={showError}
          onChange={v => { set('placeOfBirthCountry', v); if (v.trim() && !isUSCountry(v)) set('placeOfBirthState', '') }} />
        {showState && (
          <SelectField label="State of birth" value={profile.placeOfBirthState}
            options={US_STATE_OPTIONS} onChange={v => set('placeOfBirthState', v)} placeholder="Select state…" required showError={showError} />
        )}
      </div>
    </div>
  )
}
