import { create } from 'zustand'

/**
 * Scroll progress is written every frame, so it deliberately lives *outside*
 * React state — the 3D scene reads it from a mutable ref inside useFrame and
 * nothing re-renders. Only genuinely discrete things (active work slide, ready
 * state) go through zustand.
 */
export const scrollState = {
  /** 0 → 1 across the whole document. */
  progress: 0,
  /** Raw pixels, for parallax that needs absolute distance. */
  y: 0,
  /** Instantaneous scroll velocity, normalised-ish. Drives particle streaking. */
  velocity: 0,
}

/** Pointer in NDC (-1 → 1), smoothed in the render loop. */
export const pointerState = { x: 0, y: 0, tx: 0, ty: 0 }

type UI = {
  ready: boolean
  progress: number
  activeWork: number
  section: string
  setReady: (v: boolean) => void
  setProgress: (v: number) => void
  setActiveWork: (i: number) => void
  setSection: (s: string) => void
}

export const useUI = create<UI>((set) => ({
  ready: false,
  progress: 0,
  activeWork: 0,
  section: 'hero',
  setReady: (ready) => set({ ready }),
  setProgress: (progress) => set({ progress }),
  setActiveWork: (activeWork) => set({ activeWork }),
  setSection: (section) => set({ section }),
}))
