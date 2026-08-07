import { useEffect } from 'react'
import Lenis from 'lenis'
import { scrollState, useUI } from './store'
import { prefersReducedMotion } from './env'
import { bindSectionMeasurement, measure } from './sections'

/**
 * Lenis drives the page, and is the single source of truth for scroll progress.
 * Everything else (camera depth, fog colour, gauge readout) is a pure function of
 * `scrollState.progress`, so the DOM and the WebGL layer can never disagree.
 */
export function useSmoothScroll() {
  const setProgress = useUI((s) => s.setProgress)

  useEffect(() => {
    const reduced = prefersReducedMotion()
    if (reduced) document.documentElement.classList.add('no-motion')

    const lenis = new Lenis({
      duration: reduced ? 0 : 1.1,
      smoothWheel: !reduced,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.4,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    })

    let last = 0
    let uiThrottle = 0

    lenis.on('scroll', ({ scroll, limit }: { scroll: number; limit: number }) => {
      const p = limit > 0 ? Math.min(1, Math.max(0, scroll / limit)) : 0
      scrollState.progress = p
      scrollState.y = scroll
      scrollState.velocity = scroll - last
      last = scroll

      measure()

      // React only hears about it ~15×/s — the gauge does not need 120fps.
      const now = performance.now()
      if (now - uiThrottle > 66) {
        uiThrottle = now
        setProgress(p)
      }
    })

    const unbindSections = bindSectionMeasurement()

    let raf = 0
    const loop = (time: number) => {
      lenis.raf(time)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    // Anchor links go through Lenis so the eased scroll is not fought by the browser.
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement)?.closest?.('a[href^="#"]')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href === '#') return
      const target = document.querySelector(href)
      if (!target) return
      e.preventDefault()
      lenis.scrollTo(target as HTMLElement, { offset: 0, duration: reduced ? 0 : 1.6 })
    }
    document.addEventListener('click', onClick)

    return () => {
      document.removeEventListener('click', onClick)
      unbindSections()
      cancelAnimationFrame(raf)
      lenis.destroy()
    }
  }, [setProgress])
}
