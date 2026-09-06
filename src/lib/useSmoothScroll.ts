import { useEffect } from 'react'
import { prefersReducedMotion } from './motion'

/**
 * Starts the Lenis/ScrollTrigger wiring after mount, from a chunk of its own.
 * Under prefers-reduced-motion nothing is loaded at all: native scrolling, no
 * pinning (see FrameSequenceCanvas), no scrub.
 */
export function useSmoothScroll(): void {
  useEffect(() => {
    if (prefersReducedMotion()) return

    let cancelled = false
    let stop: (() => void) | undefined

    void import('./smoothScroll').then(({ startSmoothScroll }) => {
      if (cancelled) return
      stop = startSmoothScroll()
    })

    return () => {
      cancelled = true
      stop?.()
    }
  }, [])
}
