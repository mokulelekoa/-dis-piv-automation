import { Suspense, useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Vignette,
} from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { ACESFilmicToneMapping, Color, Vector2 } from 'three'
import { QUALITY_SETTINGS, type Quality } from '../lib/env'
import { Atmosphere } from './Atmosphere'
import { Gallery } from './Gallery'
import { Bubbles, Plankton } from './Particles'
import { Rays } from './Rays'
import { Rig } from './Rig'
import { Surface } from './Surface'
import { useUI } from '../lib/store'

/**
 * One canvas for the whole page. Every section scrolls over the same continuous
 * body of water — the alternative (a canvas per section) would mean re-entering
 * the ocean five times, which is the exact thing the concept is trying not to do.
 */
export function Scene({
  quality,
  reducedMotion,
}: {
  quality: Quality
  reducedMotion: boolean
}) {
  const settings = QUALITY_SETTINGS[quality]
  // Shared, mutated in place by <Atmosphere> and read by every material that
  // needs to agree with the fog. One object, no per-frame allocation.
  const waterColor = useMemo(() => new Color('#2ea8b4'), [])
  const setReady = useUI((s) => s.setReady)

  const caOffset = useMemo(() => new Vector2(0.0006, 0.0009), [])

  // A full-screen shader scene in a background tab is pure battery burn, and
  // nothing here needs to keep time while nobody is looking.
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])

  return (
    <div className="canvas-layer" aria-hidden="true">
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        dpr={settings.dpr}
        gl={{
          antialias: quality === 'high',
          powerPreference: 'high-performance',
          alpha: false,
          stencil: false,
          depth: true,
        }}
        camera={{ fov: 46, near: 0.1, far: 420, position: [0, 0, 12] }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping
          // Under 1.0 deliberately: the page is type over water, and the type
          // has to win. ACES rolls the surface highlights off rather than clipping.
          gl.toneMappingExposure = 0.86
          // One frame is enough to know the context is live and the shaders compiled.
          requestAnimationFrame(() => setReady(true))
        }}
      >
        <Suspense fallback={null}>
          <Atmosphere onColor={(c) => waterColor.copy(c)} />
          <Rig reducedMotion={reducedMotion} />

          <Surface segments={quality === 'low' ? 96 : 192} waterColor={waterColor} />
          <Rays count={settings.rays} />
          <Plankton count={settings.plankton} />
          <Bubbles count={settings.bubbles} />
          <Gallery waterColor={waterColor} />

          {settings.post && (
            <EffectComposer multisampling={0} enableNormalPass={false}>
              {/* Bloom only on the genuinely bright things — the Snell window, the
                  shafts, bioluminescence. A low threshold here turns the whole
                  frame to milk. */}
              <Bloom
                intensity={0.5}
                luminanceThreshold={0.78}
                luminanceSmoothing={0.28}
                mipmapBlur
                radius={0.7}
              />
              <ChromaticAberration
                blendFunction={BlendFunction.NORMAL}
                offset={caOffset}
                radialModulation
                modulationOffset={0.24}
              />
              <Noise premultiply blendFunction={BlendFunction.OVERLAY} opacity={0.28} />
              <Vignette eskil={false} offset={0.18} darkness={0.82} />
            </EffectComposer>
          )}
        </Suspense>
      </Canvas>
    </div>
  )
}
