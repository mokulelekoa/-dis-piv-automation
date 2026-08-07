import { Color } from 'three'

/** Metres travelled from the surface to the end of the page. */
export const MAX_DEPTH = 186

/**
 * The hero already starts under water — floating exactly at the boundary puts the
 * camera in the plane of the surface, where it reads as a flat horizon instead of
 * a ceiling. A few metres down is where Snell's window actually opens up.
 */
export const START_DEPTH = 13

/**
 * The colour of the water at a given point in the dive. These are eyeballed from
 * how water actually filters light: red is gone by ~5m, orange by ~15m, yellow by
 * ~30m, and below ~60m everything is blue-black. The page follows that curve.
 */
const STOPS: Array<{ at: number; color: string; density: number }> = [
  { at: 0.0, color: '#2ea8b4', density: 0.0085 },
  { at: 0.18, color: '#177f96', density: 0.0125 },
  { at: 0.4, color: '#0b5570', density: 0.018 },
  { at: 0.62, color: '#06304a', density: 0.024 },
  { at: 0.82, color: '#031a2c', density: 0.03 },
  { at: 1.0, color: '#01070d', density: 0.036 },
]

const cache = STOPS.map((s) => new Color(s.color))

const tmpA = new Color()
const tmpB = new Color()

/** Writes the water colour at dive position `t` (0→1) into `out`. */
export function waterColorAt(t: number, out: Color): Color {
  const p = Math.min(1, Math.max(0, t))
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i]
    const b = STOPS[i + 1]
    if (p >= a.at && p <= b.at) {
      const k = (p - a.at) / (b.at - a.at)
      tmpA.copy(cache[i])
      tmpB.copy(cache[i + 1])
      return out.copy(tmpA).lerp(tmpB, k)
    }
  }
  return out.copy(cache[cache.length - 1])
}

/** Exponential fog density at dive position `t`. */
export function fogDensityAt(t: number): number {
  const p = Math.min(1, Math.max(0, t))
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i]
    const b = STOPS[i + 1]
    if (p >= a.at && p <= b.at) {
      const k = (p - a.at) / (b.at - a.at)
      return a.density + (b.density - a.density) * k
    }
  }
  return STOPS[STOPS.length - 1].density
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export const damp = (current: number, target: number, lambda: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt))

/** Descent easing — slow off the surface, steady through the middle. */
export const diveEase = (p: number) => p * p * (3 - 2 * p) * 0.35 + p * 0.65
