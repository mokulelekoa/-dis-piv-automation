import { useMemo } from 'react'
import { Scene } from './three/Scene'
import { DepthGauge, Loader, Nav } from './components/Chrome'
import {
  Capabilities,
  Contact,
  Footer,
  Hero,
  Manifesto,
  Process,
  Sectors,
  Work,
} from './components/Sections'
import { detectQuality, hasWebGL, prefersReducedMotion } from './lib/env'
import { useSmoothScroll } from './lib/useSmoothScroll'
import { usePointer } from './lib/usePointer'
import { useIntro, useReveal } from './lib/useReveal'
import { useUI } from './lib/store'

export default function App() {
  // Resolved once — re-tiering mid-session would rebuild every buffer.
  const env = useMemo(
    () => ({
      webgl: hasWebGL(),
      quality: detectQuality(),
      reduced: prefersReducedMotion(),
    }),
    [],
  )

  useSmoothScroll()
  usePointer()
  useReveal()

  const ready = useUI((s) => s.ready)
  useIntro(ready || !env.webgl)

  return (
    <>
      <a className="skip-link" href="#manifesto">
        Skip to content
      </a>

      {env.webgl ? (
        <Scene quality={env.quality} reducedMotion={env.reduced} />
      ) : (
        // No WebGL: the page still reads, on a still of the same water.
        <div className="canvas-layer" aria-hidden="true" style={fallbackWater} />
      )}

      <div className="scrim" aria-hidden="true" />

      {env.webgl && <Loader />}

      <Nav />
      <DepthGauge />

      <main className="content" id="main">
        <Hero />
        <Manifesto />
        <Work />
        <Capabilities />
        <Process />
        <Sectors />
        <Contact />
        <Footer />
      </main>
    </>
  )
}

const fallbackWater: React.CSSProperties = {
  background:
    'radial-gradient(120% 60% at 50% -10%, #6fd3cd 0%, #1c8fa4 22%, #0a4c68 48%, #052335 72%, #01070d 100%)',
}
