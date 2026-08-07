import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MAX_DEPTH, START_DEPTH, clamp, damp, diveEase } from '../lib/depth'
import { pointerState, scrollState } from '../lib/store'

/**
 * The camera is a diver, not a dolly.
 *
 * Depth comes straight from scroll, but everything else — the pitch from
 * "looking up at the light" to "looking into the dark", the parallax lean, the
 * low-frequency handheld drift — is layered on so the descent never feels like a
 * value being interpolated.
 */
export function Rig({ reducedMotion }: { reducedMotion: boolean }) {
  const { camera } = useThree()
  const state = useRef({ y: -START_DEPTH, pitch: 0.42, roll: 0, x: 0, z: 12 })

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const p = scrollState.progress
    const dive = diveEase(p)
    const s = state.current

    // --- depth -----------------------------------------------------------------
    s.y = damp(s.y, -(START_DEPTH + (MAX_DEPTH - START_DEPTH) * dive), 6, dt)

    // --- pointer parallax ------------------------------------------------------
    pointerState.x = damp(pointerState.x, pointerState.tx, 3.2, dt)
    pointerState.y = damp(pointerState.y, pointerState.ty, 3.2, dt)

    // --- pitch: up into the light, then down into the dark ----------------------
    // Starts at +0.42rad (Snell's window overhead), levels off through the middle
    // of the page, tips slightly downward for the deep sections.
    const targetPitch = 0.42 - clamp(p / 0.26, 0, 1) * 0.5 - clamp((p - 0.75) / 0.25, 0, 1) * 0.1
    s.pitch = damp(s.pitch, targetPitch - pointerState.y * 0.06, 3, dt)

    const t = performance.now() * 0.001

    if (reducedMotion) {
      camera.position.set(0, s.y, s.z)
      camera.rotation.set(s.pitch, 0, 0)
      return
    }

    // --- handheld ---------------------------------------------------------------
    // Two incommensurate frequencies per axis so the drift never visibly loops.
    const driftX = Math.sin(t * 0.21) * 0.55 + Math.sin(t * 0.53 + 1.7) * 0.22
    const driftY = Math.sin(t * 0.17 + 2.1) * 0.4 + Math.sin(t * 0.47) * 0.15
    const driftZ = Math.sin(t * 0.13 + 0.6) * 0.5

    // Faster scrolling pushes the diver forward — you lead into a descent.
    const surge = clamp(scrollState.velocity * 0.02, -1.6, 1.6)

    s.x = damp(s.x, pointerState.x * 1.5 + driftX, 2.4, dt)
    s.z = damp(s.z, 12 + driftZ - surge, 2.4, dt)
    s.roll = damp(s.roll, Math.sin(t * 0.19 + 0.9) * 0.022 - pointerState.x * 0.03, 2, dt)

    camera.position.set(s.x, s.y + driftY, s.z)
    camera.rotation.set(s.pitch, pointerState.x * 0.07, s.roll)
  })

  return null
}
