import { useFrame } from '@react-three/fiber'
import { Color, DoubleSide, Vector3 } from 'three'
import { surfaceFragment, surfaceVertex } from './shaders/surface'
import { useShaderMaterial } from './useShaderMaterial'
import { scrollState } from '../lib/store'

/** The underside of the ocean, with Snell's window. */
export function Surface({ segments, waterColor }: { segments: number; waterColor: Color }) {
  const material = useShaderMaterial({
    vertexShader: surfaceVertex,
    fragmentShader: surfaceFragment,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uDive: { value: 0 },
      uWaveHeight: { value: 1.15 },
      uWaveScale: { value: 1.6 },
      uSkyLow: { value: new Color('#4ea9ad') },
      uSkyHigh: { value: new Color('#cfeae4') },
      uWaterTint: { value: new Color('#1b7f95') },
      uFogColor: { value: new Color('#2ea8b4') },
      uSunDir: { value: new Vector3(0.22, 1, -0.35).normalize() },
      uOpacity: { value: 1 },
    },
  })

  useFrame((_, delta) => {
    const u = material.uniforms
    u.uTime.value += delta
    u.uDive.value = scrollState.progress
    u.uFogColor.value.copy(waterColor)
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} frustumCulled={false}>
      <planeGeometry args={[900, 900, segments, segments]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}
