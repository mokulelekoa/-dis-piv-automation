/**
 * Per-section scroll progress, measured from real layout.
 *
 * The 3D scene needs to know how far *through the work section* the reader is,
 * independent of total document height — otherwise every copy edit re-times the
 * gallery. Rects are re-read on scroll and resize only, never per frame.
 */
const registry = new Map<string, HTMLElement>()

export const sectionProgress: Record<string, number> = Object.create(null)

export function registerSection(id: string, el: HTMLElement | null) {
  if (!el) {
    registry.delete(id)
    return
  }
  registry.set(id, el)
  measure()
}

/**
 * Where the work reel's DOM box currently sits on screen.
 *
 * The 3D reel is anchored to this rather than to the middle of the viewport:
 * the canvas is fixed while the caption scrolls, so a viewport-centred ring
 * eventually slides over its own credits. Anchoring to the box means the frames
 * scroll with the section that owns them.
 */
export const stageAnchor = {
  /** Vertical centre of the stage in NDC (+1 top of viewport, -1 bottom). */
  y: 0,
  /** Fraction of the stage box currently inside the viewport, 0 → 1. */
  visible: 0,
}

let stageEl: HTMLElement | null = null

export function registerStage(el: HTMLElement | null) {
  stageEl = el
  if (el) measure()
}

/** 0 as the section's top reaches the bottom of the viewport, 1 as its bottom leaves the top. */
export function measure() {
  const vh = window.innerHeight || 1
  registry.forEach((el, id) => {
    const r = el.getBoundingClientRect()
    const total = r.height + vh
    const travelled = vh - r.top
    sectionProgress[id] = Math.min(1, Math.max(0, travelled / total))
  })

  if (stageEl) {
    const r = stageEl.getBoundingClientRect()
    const centre = r.top + r.height / 2
    stageAnchor.y = 1 - (2 * centre) / vh
    const overlap = Math.min(r.bottom, vh) - Math.max(r.top, 0)
    stageAnchor.visible = Math.min(1, Math.max(0, overlap / Math.max(r.height, 1)))
  }
}

let bound = false
export function bindSectionMeasurement() {
  if (bound) return () => {}
  bound = true
  const onResize = () => measure()
  window.addEventListener('resize', onResize)
  measure()
  return () => {
    window.removeEventListener('resize', onResize)
    bound = false
  }
}

/** Gallery interaction state — mutated by DOM handlers, read in the render loop. */
export const galleryState = {
  /** Additional rotation in "items", from drag / arrows / dots. */
  offset: 0,
  /** Live drag delta, folded into `offset` on release. */
  dragging: false,
  hover: -1,
}
