import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, FogExp2 } from 'three'
import { fogDensityAt, waterColorAt } from '../lib/depth'
import { scrollState } from '../lib/store'

/**
 * Grades the water. Fog colour, fog density and the clear colour are all one
 * function of dive position, so the background and the fog can never drift out of
 * agreement — which is what would otherwise give away that the "water" is a
 * backdrop rather than a volume.
 */
export function Atmosphere({ onColor }: { onColor: (c: Color) => void }) {
  const { scene } = useThree()
  const fog = useMemo(() => new FogExp2('#2ea8b4', 0.0085), [])
  const bg = useMemo(() => new Color('#2ea8b4'), [])
  const scratch = useMemo(() => new Color(), [])

  useEffect(() => {
    scene.fog = fog
    scene.background = bg
    return () => {
      scene.fog = null
      scene.background = null
    }
  }, [scene, fog, bg])

  useFrame(() => {
    const p = scrollState.progress
    waterColorAt(p, scratch)
    fog.color.copy(scratch)
    fog.density = fogDensityAt(p)
    // The backdrop sits a touch darker than the fog so distant geometry still
    // separates from "nothing" instead of dissolving into a flat field.
    bg.copy(scratch).multiplyScalar(0.62)
    onColor(scratch)
  })

  return null
}
