import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, NormalBlending } from 'three'
import {
  bubbleFragment,
  bubbleVertex,
  planktonFragment,
  planktonVertex,
} from './shaders/particles'
import { useShaderMaterial } from './useShaderMaterial'
import { scrollState } from '../lib/store'

/** Points scattered through a cylinder around the dive axis. */
function makeField(count: number, radius: number, range: number, minR = 1.5) {
  const positions = new Float32Array(count * 3)
  const scales = new Float32Array(count)
  const seeds = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    // sqrt keeps the disc evenly filled instead of clumping at the axis.
    const r = minR + Math.sqrt(Math.random()) * (radius - minR)
    const a = Math.random() * Math.PI * 2
    positions[i * 3 + 0] = Math.cos(a) * r
    positions[i * 3 + 1] = (Math.random() - 0.5) * range
    positions[i * 3 + 2] = Math.sin(a) * r
    scales[i] = 0.25 + Math.random() * Math.random() * 1.75
    seeds[i] = Math.random()
  }
  return { positions, scales, seeds }
}

function useFieldGeometry(count: number, radius: number, range: number) {
  const geometry = useMemo(() => {
    const { positions, scales, seeds } = makeField(count, radius, range)
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    g.setAttribute('aScale', new BufferAttribute(scales, 1))
    g.setAttribute('aSeed', new BufferAttribute(seeds, 1))
    g.computeBoundingSphere()
    return g
  }, [count, radius, range])

  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

const PLANKTON_RANGE = 90
const BUBBLE_RANGE = 60

export function Plankton({ count }: { count: number }) {
  const { camera, viewport } = useThree()
  const geometry = useFieldGeometry(count, 42, PLANKTON_RANGE)

  const material = useShaderMaterial({
    vertexShader: planktonVertex,
    fragmentShader: planktonFragment,
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uCamY: { value: 0 },
      uRange: { value: PLANKTON_RANGE },
      uSize: { value: 1.7 },
      uPixelRatio: { value: 1 },
      uVelocity: { value: 0 },
      uNear: { value: new Color('#d7f4ee') },
      uDeep: { value: new Color('#7fb6c4') },
      uDive: { value: 0 },
      uOpacity: { value: 0.85 },
    },
  })

  useFrame((_, delta) => {
    const u = material.uniforms
    u.uTime.value += delta
    u.uCamY.value = camera.position.y
    u.uDive.value = scrollState.progress
    u.uPixelRatio.value = viewport.dpr
    // Ease the velocity so a flick of the wheel does not snap the streaks on.
    u.uVelocity.value += (scrollState.velocity - u.uVelocity.value) * 0.12
  })

  return (
    // The field is re-centred on the camera in the shader, so its CPU-side bounds
    // are meaningless — culling it would blink the whole thing out.
    <points geometry={geometry} frustumCulled={false}>
      <primitive object={material} attach="material" />
    </points>
  )
}

export function Bubbles({ count }: { count: number }) {
  const { camera, viewport } = useThree()
  const geometry = useFieldGeometry(count, 26, BUBBLE_RANGE)
  const time = useRef(0)

  const material = useShaderMaterial({
    vertexShader: bubbleVertex,
    fragmentShader: bubbleFragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uCamY: { value: 0 },
      uRange: { value: BUBBLE_RANGE },
      uSize: { value: 3.6 },
      uPixelRatio: { value: 1 },
      uColor: { value: new Color('#ddfbf4') },
      uOpacity: { value: 0.5 },
    },
  })

  useFrame((_, delta) => {
    time.current += delta
    const u = material.uniforms
    u.uTime.value = time.current
    u.uCamY.value = camera.position.y
    u.uPixelRatio.value = viewport.dpr
    // Bubbles thin out with depth — there is less down there to outgas.
    u.uOpacity.value = 0.5 * (1 - scrollState.progress * 0.6)
  })

  return (
    <points geometry={geometry} frustumCulled={false}>
      <primitive object={material} attach="material" />
    </points>
  )
}
