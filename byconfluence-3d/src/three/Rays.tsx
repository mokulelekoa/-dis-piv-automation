import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, Color, DoubleSide, Mesh } from 'three'
import { raysFragment, raysVertex } from './shaders/rays'
import { useShaderMaterial } from './useShaderMaterial'
import { scrollState } from '../lib/store'

/**
 * Light shafts falling from the surface. One open cone, additively blended, with
 * the shaft pattern generated around its circumference — so the shafts hold
 * together as a single volume of light rather than a stack of transparent cards.
 */
export function Rays({ count }: { count: number }) {
  const mesh = useRef<Mesh>(null)

  const material = useShaderMaterial({
    vertexShader: raysVertex,
    fragmentShader: raysFragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0.9 },
      uCount: { value: count },
      uColor: { value: new Color('#cdf6ec') },
      uDeepColor: { value: new Color('#1e8fa0') },
      uDive: { value: 0 },
    },
  })

  useFrame((_, delta) => {
    material.uniforms.uTime.value += delta
    material.uniforms.uDive.value = scrollState.progress
    // The cone hangs from the surface and very slowly turns, so shafts sweep past
    // the camera as it descends instead of sitting in fixed positions.
    if (mesh.current) mesh.current.rotation.y += delta * 0.012
  })

  return (
    // Height is 170, so y = -85 puts the cone's mouth exactly at the surface.
    <mesh ref={mesh} position={[6, -85, -14]} frustumCulled={false}>
      {/* radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded */}
      <cylinderGeometry args={[9, 86, 170, 96, 1, true]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}
