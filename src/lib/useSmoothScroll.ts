import { useEffect } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { prefersReducedMotion } from './motion'

gsap.registerPlugin(ScrollTrigger)

/**
 * Lenis <-> ScrollTrigger wiring.
 *
 * Lenis drives the scroll position, GSAP drives the clock. ScrollTrigger is
 * updated from Lenis rather than from a native scroll listener, and lag
 * smoothing is off so a dropped frame never desynchronises the scrub from the
 * scroll position.
 *
 * Under prefers-reduced-motion the whole thing is skipped: native scrolling,
 * no pinning (see FrameSequenceCanvas), no scrub.
 */
export function useSmoothScroll(): void {
  useEffect(() => {
    if (import.meta.env.DEV) {
      // Dev-only handles for inspecting scrub state from the console.
      Object.assign(window, { gsap, ScrollTrigger })
    }
    if (prefersReducedMotion()) return

    const lenis = new Lenis({
      duration: 1.05,
      // Slightly weighted ease-out; keeps scrub predictable without feeling loose.
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      touchMultiplier: 1.5,
    })

    const onScroll = () => ScrollTrigger.update()
    lenis.on('scroll', onScroll)

    const raf = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    return () => {
      lenis.off('scroll', onScroll)
      gsap.ticker.remove(raf)
      gsap.ticker.lagSmoothing(500, 33)
      lenis.destroy()
    }
  }, [])
}
