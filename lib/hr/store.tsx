'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ActivityItem, Employee, HrState, LetterRecord, SystemKey } from './types'
import { SEED_STATE } from './data'

/**
 * Client-side store for the HR Command Center prototype. State lives in
 * localStorage so the demo survives reloads without needing a backend;
 * the seed data loads on first visit and "Reset demo data" restores it.
 */

const STORAGE_KEY = 'dis-hr-command-center-v1'

export function newId(prefix: string): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${rand}`
}

type HrStore = {
  state: HrState
  ready: boolean
  addEmployee: (emp: Employee) => void
  updateEmployee: (id: string, patch: Partial<Employee>) => void
  setSync: (id: string, system: SystemKey, done: boolean) => void
  addLetters: (records: LetterRecord[], activityText: string) => void
  recordPayrollBalanced: (activityText: string) => void
  setPayCodeMapping: (unanetCode: string, paycorCode: string) => void
  setEmployeeRefMapping: (ref: string, paycorId: string) => void
  logActivity: (module: ActivityItem['module'], text: string) => void
  resetDemo: () => void
}

const HrContext = createContext<HrStore | null>(null)

function loadStored(): HrState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as HrState
    // Sanity check the shape so a stale/older payload can't crash the UI.
    if (!Array.isArray(parsed.employees) || !Array.isArray(parsed.contracts)) return null
    return parsed
  } catch {
    return null
  }
}

export function HrProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<HrState>(SEED_STATE)
  const [ready, setReady] = useState(false)
  const skipNextSave = useRef(false)

  useEffect(() => {
    // One-time localStorage hydration. Must happen post-mount (not in the
    // useState initializer) so the server-rendered HTML matches the first
    // client render — the seed — before swapping in the stored state.
    const stored = loadStored()
    if (stored) {
      skipNextSave.current = true
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(stored)
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    if (skipNextSave.current) { skipNextSave.current = false; return }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Storage full/unavailable — the demo keeps working in memory.
    }
  }, [state, ready])

  const logActivity = useCallback((module: ActivityItem['module'], text: string) => {
    setState(s => ({
      ...s,
      activity: [{ id: newId('act'), at: new Date().toISOString(), module, text }, ...s.activity].slice(0, 40),
    }))
  }, [])

  const addEmployee = useCallback((emp: Employee) => {
    setState(s => ({
      ...s,
      employees: [emp, ...s.employees],
      activity: [
        { id: newId('act'), at: new Date().toISOString(), module: 'new-hires' as const, text: `${emp.firstName} ${emp.lastName} added — ready to enter in Paycor and Employee Navigator.` },
        ...s.activity,
      ].slice(0, 40),
    }))
  }, [])

  const updateEmployee = useCallback((id: string, patch: Partial<Employee>) => {
    setState(s => ({ ...s, employees: s.employees.map(e => (e.id === id ? { ...e, ...patch } : e)) }))
  }, [])

  const setSync = useCallback((id: string, system: SystemKey, done: boolean) => {
    setState(s => {
      const employees = s.employees.map(e => {
        if (e.id !== id) return e
        return { ...e, sync: { ...e.sync, [system]: { done, at: done ? new Date().toISOString() : undefined } } }
      })
      const before = s.employees.find(e => e.id === id)
      const after = employees.find(e => e.id === id)
      const wasComplete = !!before && before.sync.paycor.done && before.sync.employeeNavigator.done
      const isComplete = !!after && after.sync.paycor.done && after.sync.employeeNavigator.done
      const delta = isComplete && !wasComplete ? 1 : !isComplete && wasComplete ? -1 : 0
      const activity = delta === 1 && after
        ? [{ id: newId('act'), at: new Date().toISOString(), module: 'new-hires' as const, text: `${after.firstName} ${after.lastName} is fully entered in both systems. ✔` }, ...s.activity].slice(0, 40)
        : s.activity
      return {
        ...s, employees, activity,
        stats: { ...s.stats, hiresSynced: Math.max(0, s.stats.hiresSynced + delta) },
      }
    })
  }, [])

  const addLetters = useCallback((records: LetterRecord[], activityText: string) => {
    setState(s => ({
      ...s,
      letters: [...records, ...s.letters].slice(0, 100),
      activity: [{ id: newId('act'), at: new Date().toISOString(), module: 'letters' as const, text: activityText }, ...s.activity].slice(0, 40),
      stats: { ...s.stats, lettersGenerated: s.stats.lettersGenerated + records.length },
    }))
  }, [])

  const recordPayrollBalanced = useCallback((activityText: string) => {
    setState(s => ({
      ...s,
      activity: [{ id: newId('act'), at: new Date().toISOString(), module: 'payroll' as const, text: activityText }, ...s.activity].slice(0, 40),
      stats: { ...s.stats, payrollRunsBalanced: s.stats.payrollRunsBalanced + 1 },
    }))
  }, [])

  const setPayCodeMapping = useCallback((unanetCode: string, paycorCode: string) => {
    setState(s => ({ ...s, payCodeMap: { ...s.payCodeMap, [unanetCode]: paycorCode } }))
  }, [])

  const setEmployeeRefMapping = useCallback((ref: string, paycorId: string) => {
    setState(s => ({ ...s, employeeRefMap: { ...s.employeeRefMap, [ref]: paycorId } }))
  }, [])

  const resetDemo = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    skipNextSave.current = false
    setState(SEED_STATE)
  }, [])

  return (
    <HrContext.Provider value={{
      state, ready, addEmployee, updateEmployee, setSync, addLetters,
      recordPayrollBalanced, setPayCodeMapping, setEmployeeRefMapping, logActivity, resetDemo,
    }}>
      {children}
    </HrContext.Provider>
  )
}

export function useHr(): HrStore {
  const ctx = useContext(HrContext)
  if (!ctx) throw new Error('useHr must be used inside <HrProvider>')
  return ctx
}
