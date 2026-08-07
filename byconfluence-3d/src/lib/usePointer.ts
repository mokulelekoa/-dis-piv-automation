import { useEffect } from 'react'
import { pointerState } from './store'

/** Tracks the pointer in NDC. Smoothing happens in the render loop, not here. */
export function usePointer() {
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointerState.tx = (e.clientX / window.innerWidth) * 2 - 1
      pointerState.ty = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    const onLeave = () => {
      pointerState.tx = 0
      pointerState.ty = 0
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerleave', onLeave)
    }
  }, [])
}
