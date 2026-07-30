'use client'

import Link from 'next/link'
import {
  ArrowRight, Banknote, Building2, Clock3, FileSignature, ShieldCheck, Sparkles, UserPlus,
} from 'lucide-react'
import { useHr } from '@/lib/hr/store'
import { MINUTES_SAVED } from '@/lib/hr/data'
import { PACKETS_HREF } from '@/lib/hr/links'
import { Card, ContractChip, StatTile, timeAgoShort } from './ui'

const MODULE_META = {
  'new-hires': { icon: UserPlus, tint: 'text-blue-400', bg: 'bg-blue-50' },
  letters: { icon: FileSignature, tint: 'text-accent-600', bg: 'bg-accent-50' },
  payroll: { icon: Banknote, tint: 'text-emerald-600', bg: 'bg-emerald-50' },
} as const

export default function HrDashboard() {
  const { state } = useHr()
  const pendingHires = state.employees.filter(e => !e.sync.paycor.done || !e.sync.employeeNavigator.done)

  const minutesSaved =
    state.stats.hiresSynced * MINUTES_SAVED.perHireSynced +
    state.stats.lettersGenerated * MINUTES_SAVED.perLetter +
    state.stats.payrollRunsBalanced * MINUTES_SAVED.perPayrollRun
  const hoursSaved = (minutesSaved / 60).toFixed(1)

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <div className="text-xs font-bold uppercase tracking-widest text-slate-400">{today}</div>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">
          The mundane stuff, <span className="text-accent-500">automated.</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
          One entry for both HR systems, letters in seconds instead of mail merge, and payroll hours
          that arrive in Paycor already clean — across every contract you run.
        </p>
      </header>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile accent icon={<Clock3 size={18} />} label="Time given back" value={`${hoursSaved} h`}
          sub="vs. doing it all by hand" />
        <StatTile icon={<UserPlus size={18} />} label="Hires awaiting entry" value={String(pendingHires.length)}
          sub={pendingHires[0] ? `Next: ${pendingHires[0].firstName} ${pendingHires[0].lastName}` : 'All caught up'} />
        <StatTile icon={<FileSignature size={18} />} label="Letters generated" value={String(state.stats.lettersGenerated)}
          sub="offers + increases" />
        <StatTile icon={<Banknote size={18} />} label="Payrolls balanced" value={String(state.stats.payrollRunsBalanced)}
          sub="Unanet → Paycor, no hand fixes" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Module cards */}
        <div className="space-y-4 lg:col-span-2">
          <ModuleCard
            href="/hr/new-hires"
            icon={<UserPlus size={20} />}
            iconCls="bg-blue-600 text-white"
            title="New Hire Sync"
            pain="Typing every new employee into Paycor AND Employee Navigator, field by field."
            fix="Enter each hire once. Get a system-ordered entry panel for both, plus ready-to-import files."
            status={pendingHires.length > 0
              ? `${pendingHires.length} hire${pendingHires.length > 1 ? 's' : ''} ready to push to systems`
              : 'Roster fully synced'}
            statusTone={pendingHires.length > 0 ? 'amber' : 'green'}
          />
          <ModuleCard
            href="/hr/letters"
            icon={<FileSignature size={20} />}
            iconCls="bg-accent-500 text-white"
            title="Letter Studio"
            pain="Weekly offer letters and clunky mail-merge salary increase letters."
            fix="Pick a template, fill a short form (or paste rows from Excel), and download polished letters."
            status={`${state.letters.length} letter${state.letters.length === 1 ? '' : 's'} in history`}
            statusTone="blue"
          />
          <ModuleCard
            href="/hr/payroll"
            icon={<Banknote size={20} />}
            iconCls="bg-emerald-600 text-white"
            title="Payroll Bridge"
            pain="Correcting Unanet exports by hand, then correcting them again after the Paycor import."
            fix="Drop in the export — duplicates, unsplit OT, and bad codes get flagged with one-click fixes, then export a clean Paycor file."
            status="Sample export loaded — try a run"
            statusTone="blue"
          />
          <ModuleCard
            href={PACKETS_HREF}
            icon={<ShieldCheck size={20} />}
            iconCls="bg-dis-navy text-white"
            title="Candidate Packets"
            pain="VA rejects PIV packets over a single wrong field, stalling every CMOP hire."
            fix="The candidate paperwork app you already have — guided packets, auto-filled VA forms, and a review queue. New VA hires flow straight into it."
            status="Live app — opens the onboarding command center"
            statusTone="green"
          />
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              <Building2 size={13} /> Active contracts
            </div>
            <div className="space-y-3">
              {state.contracts.map(c => {
                const count = state.employees.filter(e => e.contractId === c.id).length
                return (
                  <div key={c.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <ContractChip contract={c} />
                      <div className="mt-0.5 pl-1 text-[11px] text-slate-400">{c.code} · {c.location}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-black text-slate-800">{count}</div>
                      <div className="text-[10px] text-slate-400">staff</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              <Sparkles size={13} /> Recent activity
            </div>
            <ol className="space-y-3">
              {state.activity.slice(0, 8).map(a => {
                const meta = MODULE_META[a.module]
                const Icon = meta.icon
                return (
                  <li key={a.id} className="flex gap-2.5">
                    <span className={`mt-0.5 h-fit rounded-md p-1 ${meta.bg} ${meta.tint}`}><Icon size={12} /></span>
                    <div className="min-w-0">
                      <div className="text-xs leading-snug text-slate-600">{a.text}</div>
                      <div className="text-[10px] text-slate-400">{timeAgoShort(a.at)}</div>
                    </div>
                  </li>
                )
              })}
              {state.activity.length === 0 && (
                <li className="text-xs text-slate-400">Nothing yet — actions you take will show up here.</li>
              )}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  )
}

const STATUS_TONES = {
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  blue: 'bg-blue-50 text-blue-500 border-blue-100',
} as const

function ModuleCard({ href, icon, iconCls, title, pain, fix, status, statusTone }: {
  href: string; icon: React.ReactNode; iconCls: string; title: string
  pain: string; fix: string; status: string; statusTone: keyof typeof STATUS_TONES
}) {
  return (
    <Link href={href} className="group block">
      <Card className="p-5 transition-all group-hover:-translate-y-0.5 group-hover:border-blue-300 group-hover:shadow-lg">
        <div className="flex items-start gap-4">
          <span className={`rounded-xl p-3 shadow-sm ${iconCls}`}>{icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-black tracking-tight text-slate-900">{title}</h2>
              <ArrowRight size={18} className="shrink-0 text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-accent-500" />
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              <span className="font-bold text-slate-500">The pain:</span> {pain}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              <span className="font-bold text-emerald-600">The fix:</span> {fix}
            </p>
            <div className={`mt-3 inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${STATUS_TONES[statusTone]}`}>
              {status}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  )
}
