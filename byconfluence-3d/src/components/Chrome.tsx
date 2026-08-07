import { useEffect, useRef, useState } from 'react'
import { nav } from '../data/site'
import { MAX_DEPTH } from '../lib/depth'
import { useUI } from '../lib/store'

export function Nav() {
  const [current, setCurrent] = useState<string>('')

  // Highlights whichever section owns the middle of the viewport.
  useEffect(() => {
    const targets = nav
      .map((n) => document.querySelector(n.href))
      .filter((el): el is Element => Boolean(el))

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setCurrent(`#${e.target.id}`)
        })
      },
      { rootMargin: '-45% 0px -45% 0px' },
    )
    targets.forEach((t) => io.observe(t))
    return () => io.disconnect()
  }, [])

  return (
    <header className="nav">
      <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
        <a className="nav__mark" href="#top" aria-label="By Confluence, back to top">
          By Confluence <span>Hawai‘i</span>
        </a>
        <ConceptBadge />
      </div>
      <nav className="nav__links" aria-label="Primary">
        {nav.map((n) => (
          <a key={n.href} href={n.href} aria-current={current === n.href ? 'true' : undefined}>
            {n.label}
          </a>
        ))}
      </nav>
    </header>
  )
}

/**
 * Depth gauge. Reads as instrumentation rather than a progress bar — which is the
 * point: the page is a dive, so the scrollbar should be a depth gauge.
 */
export function DepthGauge() {
  const progress = useUI((s) => s.progress)
  const metres = Math.round(progress * MAX_DEPTH)

  return (
    <div className="gauge" aria-hidden="true">
      <div className="gauge__rail">
        <div className="gauge__fill" style={{ transform: `scaleY(${progress})` }} />
        <div className="gauge__ticks">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <span className="gauge__tick" key={t} style={{ top: `${t * 100}%` }} />
          ))}
        </div>
      </div>
      <span className="gauge__read">{metres} m</span>
    </div>
  )
}

function ConceptBadge() {
  return (
    <span className="concept-badge" title="Unofficial redesign concept — not the studio's live site">
      Concept
    </span>
  )
}

export function Loader() {
  const ready = useUI((s) => s.ready)
  const [pct, setPct] = useState(0)
  const [gone, setGone] = useState(false)

  // A real load bar here would fill in 80ms and read as a flicker, so the ramp is
  // paced to the shader warm-up and holds at 92% until WebGL says it is live.
  //
  // The clock lives in a ref: keeping it in the effect's closure while the effect
  // depends on `pct` restarts `start` on every tick, and the bar wedges.
  const startedAt = useRef(0)
  const value = useRef(0)

  useEffect(() => {
    if (!startedAt.current) startedAt.current = performance.now()
    let raf = 0
    const tick = () => {
      const elapsed = performance.now() - startedAt.current
      const ceiling = ready ? 100 : 92
      value.current = Math.min(ceiling, Math.max(value.current, (elapsed / 1300) * 100))
      setPct(value.current)
      if (value.current < 100) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ready])

  // Safety net: if the context never reports ready (driver hiccup, blocked
  // shader compile), the page must still be usable rather than sat behind a veil.
  useEffect(() => {
    const id = setTimeout(() => setGone(true), 6000)
    return () => clearTimeout(id)
  }, [])

  const done = ready && pct >= 100

  useEffect(() => {
    if (!done) return
    const id = setTimeout(() => setGone(true), 900)
    return () => clearTimeout(id)
  }, [done])

  if (gone) return null

  return (
    <div className="loader" data-done={done} role="status" aria-live="polite">
      <span className="loader__mark">By Confluence</span>
      <div className="loader__bar">
        <i style={{ width: `${pct}%` }} />
      </div>
      <span className="loader__pct">{Math.round(pct)}% · entering the water</span>
    </div>
  )
}
