import { useEffect } from 'react'
import gsap from 'gsap'
import { prefersReducedMotion } from './env'

/**
 * Reveals anything marked `[data-reveal]` as it enters the viewport.
 *
 * Deliberately IntersectionObserver rather than ScrollTrigger: Lenis owns the
 * scroll position, and an observer reads the real layout instead of needing to be
 * kept in sync with a virtualised scroller.
 */
export function useReveal() {
  useEffect(() => {
    if (prefersReducedMotion()) return

    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (!els.length) return

    const io = new IntersectionObserver(
      (entries) => {
        // Stagger within a batch so a grid of cards cascades rather than popping.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

        visible.forEach((entry, i) => {
          const el = entry.target as HTMLElement
          io.unobserve(el)
          gsap.to(el, {
            opacity: 1,
            y: 0,
            duration: 1.1,
            delay: i * 0.07 + Number(el.dataset.revealDelay ?? 0),
            ease: 'expo.out',
          })
        })
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    )

    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

/** Hero intro: runs once, on load, independent of scroll. */
export function useIntro(ready: boolean) {
  useEffect(() => {
    if (!ready) return
    if (prefersReducedMotion()) {
      gsap.set('[data-intro]', { opacity: 1, y: 0 })
      return
    }
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
    tl.fromTo(
      '[data-intro-line]',
      { yPercent: 118, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: 1.6, stagger: 0.12 },
      0.15,
    ).fromTo(
      '[data-intro]',
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 1.2, stagger: 0.09 },
      0.6,
    )
    return () => {
      tl.kill()
    }
  }, [ready])
}
