/** Feature/quality detection, resolved once at boot. */

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const hasWebGL = (): boolean => {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return Boolean(
      canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl'),
    )
  } catch {
    return false
  }
}

export type Quality = 'high' | 'medium' | 'low'

/**
 * Coarse tiering. Mobile GPUs choke on the particle counts and the postprocessing
 * stack, so they get fewer of both rather than a lower resolution of the same thing.
 */
export const detectQuality = (): Quality => {
  if (typeof window === 'undefined') return 'medium'
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const narrow = window.innerWidth < 820
  const cores = navigator.hardwareConcurrency ?? 4
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8

  if (coarse || narrow || cores <= 4 || mem <= 4) return 'low'
  if (cores <= 8) return 'medium'
  return 'high'
}

export const QUALITY_SETTINGS = {
  high: { plankton: 6000, bubbles: 320, dpr: [1, 2] as [number, number], rays: 22, post: true },
  medium: { plankton: 3200, bubbles: 180, dpr: [1, 1.6] as [number, number], rays: 16, post: true },
  low: { plankton: 1400, bubbles: 90, dpr: [1, 1.35] as [number, number], rays: 10, post: false },
} as const
