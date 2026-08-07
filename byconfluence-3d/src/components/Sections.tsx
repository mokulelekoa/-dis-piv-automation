import { useEffect, useRef } from 'react'
import {
  capabilities,
  contact,
  footer,
  hero,
  manifesto,
  process,
  sectors,
  work,
} from '../data/site'
import { galleryState, registerSection, registerStage } from '../lib/sections'
import { useUI } from '../lib/store'

export function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero__center">
        <p className="eyebrow" data-intro>
          {hero.eyebrow}
        </p>

        <h1 className="hero__title">
          {/* Each line masks its own reveal, so the type rises out of the water. */}
          <span style={{ overflow: 'hidden', display: 'block' }}>
            <span style={{ display: 'block' }} data-intro-line>
              {hero.titleTop}
            </span>
          </span>
          <span style={{ overflow: 'hidden', display: 'block' }} className="indent">
            <em style={{ display: 'block' }} data-intro-line>
              {hero.titleBottom}
            </em>
          </span>
        </h1>

        <p className="lede" data-intro>
          {hero.lede}
        </p>
      </div>

      <div className="hero__foot" data-intro>
        <div className="hero__meta">
          {hero.meta.map((m) => (
            <div key={m.k}>
              <span className="k">{m.k}</span>
              <span className="v">{m.v}</span>
            </div>
          ))}
        </div>
        <p className="cue">
          <i className="cue__line" aria-hidden="true" />
          {hero.cue}
        </p>
      </div>
    </section>
  )
}

export function Manifesto() {
  return (
    <section className="manifesto" id="manifesto" aria-labelledby="manifesto-h">
      <p className="eyebrow" data-reveal>
        {manifesto.eyebrow}
      </p>
      <h2 className="manifesto__body" id="manifesto-h" data-reveal>
        {manifesto.body.map((chunk, i) => (
          <span key={i} className={chunk.dim ? 'dim' : undefined}>
            {chunk.text}
          </span>
        ))}
      </h2>
      <div className="manifesto__cols">
        {manifesto.columns.map((c) => (
          <div key={c.k} data-reveal>
            <p className="eyebrow" style={{ marginBottom: '0.9rem' }}>
              {c.k}
            </p>
            <p>{c.p}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * The gallery itself is drawn in WebGL, but everything that has to be *readable*
 * — title, credits, controls — stays in the DOM. Screen readers, keyboard users
 * and anyone with the canvas disabled get the full list of work either way.
 */
export function Work() {
  const ref = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const active = useUI((s) => s.activeWork)
  const item = work[active] ?? work[0]

  useEffect(() => {
    registerSection('work', ref.current)
    registerStage(stageRef.current)
    return () => {
      registerSection('work', null)
      registerStage(null)
    }
  }, [])

  // Drag-to-spin. Lives on a transparent DOM layer because the canvas is
  // pointer-events: none — the 3D is scenery, the controls are real elements.
  const drag = useRef({ active: false, startX: 0, startOffset: 0 })

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = { active: true, startX: e.clientX, startOffset: galleryState.offset }
    galleryState.dragging = true
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return
    const dx = e.clientX - drag.current.startX
    galleryState.offset = drag.current.startOffset - dx / 180
  }
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return
    drag.current.active = false
    galleryState.dragging = false
    // Snap to the nearest frame on release.
    galleryState.offset = Math.round(galleryState.offset)
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const step = (dir: number) => {
    galleryState.offset += dir
  }

  return (
    <section className="work" id="work" ref={ref} aria-labelledby="work-h">
      <div className="work__head">
        <div>
          <p className="eyebrow" data-reveal>
            Selected work
          </p>
          <h2 className="work__title" id="work-h" data-reveal>
            Six times we
            <br />
            got in the water
          </h2>
        </div>
        <p className="lede" data-reveal style={{ maxWidth: '28ch' }}>
          Drag the reel, or use the arrow keys. Scrolling moves it too.
        </p>
      </div>

      <div
        className="work__stage"
        ref={stageRef}
        role="group"
        aria-label="Work reel — drag or use arrow keys to browse"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            step(1)
            e.preventDefault()
          }
          if (e.key === 'ArrowLeft') {
            step(-1)
            e.preventDefault()
          }
        }}
        style={{ cursor: 'grab', touchAction: 'pan-y' }}
      />

      <div className="work__caption">
        {/* aria-live so the caption is announced as the reel turns. */}
        <div aria-live="polite">
          <p className="eyebrow">{item.index}</p>
          <h3>{item.title}</h3>
          <p className="meta">
            <span>{item.client}</span>
            <span>{item.year}</span>
            <span>{item.environment}</span>
            <span>{item.role}</span>
          </p>
          <p style={{ maxWidth: '52ch', marginTop: '0.6rem', color: 'var(--ink-soft)' }}>
            {item.blurb}
          </p>
        </div>

        <div className="work__nav" role="tablist" aria-label="Choose a project">
          {work.map((w, i) => (
            <button
              key={w.title}
              type="button"
              role="tab"
              className="work__dot"
              aria-selected={i === active}
              aria-label={`${w.index} — ${w.title}`}
              onClick={() => {
                // Move to the nearest rotation that lands on i, so a click never
                // spins the ring the long way round.
                const current = galleryState.offset
                const turns = Math.round((current - i) / work.length)
                galleryState.offset = i + turns * work.length
              }}
              onPointerEnter={() => (galleryState.hover = i)}
              onPointerLeave={() => (galleryState.hover = -1)}
            >
              {w.index}
            </button>
          ))}
        </div>
      </div>

      {/* The reel, as plain text, for anyone not seeing the canvas. */}
      <h2 className="sr-only">All selected work</h2>
      <ul className="sr-only">
        {work.map((w) => (
          <li key={w.title}>
            {w.title} — {w.client}, {w.year}. {w.environment}. {w.role}. {w.blurb}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function Capabilities() {
  return (
    <section className="caps" id="capabilities" aria-labelledby="caps-h">
      <p className="eyebrow" data-reveal>
        {capabilities.eyebrow}
      </p>
      <h2 className="work__title" id="caps-h" data-reveal>
        {capabilities.title}
      </h2>
      <div className="caps__list">
        {capabilities.items.map((c) => (
          <article className="cap" key={c.no} data-reveal>
            <span className="cap__no">{c.no}</span>
            <h3 className="cap__name">{c.name}</h3>
            <div className="cap__col">
              <p className="cap__body">{c.body}</p>
              <div className="cap__tags">
                {c.tags.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function Process() {
  return (
    <section className="process" id="process" aria-labelledby="process-h">
      <p className="eyebrow" data-reveal>
        {process.eyebrow}
      </p>
      <h2 className="work__title" id="process-h" data-reveal>
        {process.title}
      </h2>
      <div className="process__grid">
        {process.steps.map((s) => (
          <div className="step" key={s.no} data-reveal>
            <span className="step__no">{s.no}</span>
            <h3>{s.name}</h3>
            <p>{s.p}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function Sectors() {
  return (
    <section className="sectors" aria-labelledby="sectors-h">
      <p className="eyebrow" data-reveal>
        {sectors.eyebrow}
      </p>
      <h2 className="sr-only" id="sectors-h">
        Who we work with
      </h2>
      <div className="sectors__marquee">
        {sectors.rows.map((r) => (
          <p className="sectors__row" key={r} data-reveal>
            {r}
          </p>
        ))}
      </div>
    </section>
  )
}

export function Contact() {
  return (
    <section className="contact" id="contact" aria-labelledby="contact-h">
      <p className="eyebrow" data-reveal>
        {contact.eyebrow}
      </p>
      <h2 className="contact__big" id="contact-h" data-reveal>
        {contact.big}
      </h2>
      <p data-reveal>
        <a className="contact__mail" href={`mailto:${contact.email}`}>
          {contact.email}
        </a>
      </p>
      <div className="contact__grid">
        {contact.grid.map((g) => (
          <div key={g.k} data-reveal>
            <span className="k">{g.k}</span>
            <span style={{ whiteSpace: 'pre-line' }}>{g.v}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <span>{footer.left}</span>
      <span>{footer.middle}</span>
      <span>{footer.right}</span>
    </footer>
  )
}
