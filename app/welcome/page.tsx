'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, Activity, UserPlus, FileCheck2,
  ScanLine, MessageSquareText, Download, Sparkles,
  ArrowRight, ArrowLeft, Check, Loader2,
} from 'lucide-react'
import { createBrowserSupabase } from '@/lib/supabase/browser'

/**
 * First-login brief. The proxy redirects any authenticated user whose
 * `user_metadata.briefSeenAt` is unset here before they reach /admin or
 * /applicant. Finishing stamps briefSeenAt so it never shows again. Content is
 * role-aware: candidates get a "how your onboarding works" tour, admins get a
 * "command center" tour.
 */

type Step = { icon: React.ReactNode; title: string; body: string }

const ICON = 26

const CANDIDATE_STEPS: Step[] = [
  {
    icon: <Sparkles size={ICON} />,
    title: 'Welcome to your CMOP onboarding',
    body: 'We make your VA onboarding paperwork simple. Instead of filling out long government forms by hand, we do the heavy lifting for you — you just review and sign.',
  },
  {
    icon: <ScanLine size={ICON} />,
    title: 'Start by uploading your ID',
    body: 'Upload a photo of your government ID. We automatically read your name, date of birth, and address and fill them into every form for you.',
  },
  {
    icon: <MessageSquareText size={ICON} />,
    title: 'Answer a few quick questions',
    body: 'A few answers only you know — like prior names or service history. We ask these in plain language, one at a time. Never guess; just answer what applies.',
  },
  {
    icon: <Download size={ICON} />,
    title: 'Review, sign, and upload',
    body: 'Download your completed forms, print and sign where marked, then upload them back. Your progress bar always shows exactly what is left to do.',
  },
]

const ADMIN_STEPS: Step[] = [
  {
    icon: <LayoutDashboard size={ICON} />,
    title: 'Welcome to the CMOP command center',
    body: 'This is your hub for moving candidates through VA onboarding — from offer accepted to PIV pickup — without juggling a spreadsheet.',
  },
  {
    icon: <Activity size={ICON} />,
    title: 'See every candidate at a glance',
    body: 'The dashboard shows your onboarding pipeline: who is in each stage, what is blocking them, and which packets are aging and need attention.',
  },
  {
    icon: <UserPlus size={ICON} />,
    title: 'Invite and track candidates',
    body: 'Invite a candidate or teammate by email, follow each candidate through the stages, and open anyone to see their packet and details.',
  },
  {
    icon: <FileCheck2 size={ICON} />,
    title: 'Review and deliver packets',
    body: 'When a packet is complete, mark it reviewed, then download or email the finished PDF to the VA — all from one place.',
  },
]

export default function Welcome() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [steps, setSteps] = useState<Step[]>([])
  const [dest, setDest] = useState('/')
  const [i, setI] = useState(0)
  const [finishing, setFinishing] = useState(false)

  useEffect(() => {
    let active = true
    void (async () => {
      const supabase = createBrowserSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!active) return
      if (!user) {
        router.replace('/login')
        return
      }
      const role = user.app_metadata?.role
      const applicantId = user.app_metadata?.applicant_id
      const admin = role === 'admin'
      const destination = admin
        ? '/admin'
        : role === 'candidate' && typeof applicantId === 'string'
          ? `/applicant/${applicantId}`
          : '/'
      // Already completed the brief → skip straight to their home.
      if (user.user_metadata?.briefSeenAt) {
        router.replace(destination)
        return
      }
      setIsAdmin(admin)
      setSteps(admin ? ADMIN_STEPS : CANDIDATE_STEPS)
      setDest(destination)
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [router])

  async function finish() {
    setFinishing(true)
    try {
      const supabase = createBrowserSupabase()
      // Guard the network write so a stalled call can never freeze the button.
      await Promise.race([
        supabase.auth.updateUser({ data: { briefSeenAt: new Date().toISOString() } }),
        new Promise(resolve => setTimeout(resolve, 5000)),
      ])
    } catch {
      // Best effort — still leave the brief so the user isn't trapped here.
    }
    // Hard navigation (not router.replace+refresh): forces the server to re-read
    // the refreshed session cookie so the proxy re-evaluates cleanly, with no
    // client soft-nav race that can leave the button spinning.
    window.location.assign(dest)
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-blue-50">
        <Loader2 className="animate-spin text-dis-teal" />
      </main>
    )
  }

  const step = steps[i]
  const last = i === steps.length - 1

  return (
    <main className="flex min-h-screen flex-col bg-blue-50">
      <header className="flex items-center justify-between bg-dis-navy px-6 py-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/dis-logo.png" alt="DIS Consulting" className="h-8 w-auto" />
        <span className="text-xs font-semibold uppercase tracking-widest text-dis-orange">
          {isAdmin ? 'Coordinator setup' : 'First-time setup'}
        </span>
      </header>

      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-2">
            {steps.map((_, n) => (
              <span
                key={n}
                className={`h-1.5 flex-1 rounded-full transition-colors ${n <= i ? 'bg-accent-500' : 'bg-slate-200'}`}
              />
            ))}
          </div>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Step {i + 1} of {steps.length}
          </p>

          <div className="mt-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-dis-teal/10 text-dis-teal">
            {step.icon}
          </div>

          <h1 className="mt-5 text-2xl font-black leading-tight text-dis-navy">{step.title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{step.body}</p>

          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setI(n => Math.max(0, n - 1))}
              disabled={i === 0}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition hover:text-dis-navy disabled:invisible"
            >
              <ArrowLeft size={15} /> Back
            </button>

            {last ? (
              <button
                type="button"
                onClick={finish}
                disabled={finishing}
                className="flex items-center gap-2 rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-accent-600 disabled:opacity-60"
              >
                {finishing ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                {isAdmin ? 'Go to the console' : 'Start my onboarding'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setI(n => Math.min(steps.length - 1, n + 1))}
                className="flex items-center gap-2 rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-accent-600"
              >
                Next <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
