import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * Lenis <-> ScrollTrigger wiring.
 *
 * Lenis drives the scroll position, GSAP drives the clock. ScrollTrigger is
 * updated from Lenis rather than from a native scroll listener, and lag
 * smoothing is off so a dropped frame never desynchronises the scrub from the
 * scroll position.
 *
 * This module is loaded dynamically: GSAP, ScrollTrigger and Lenis are the
 * three largest dependencies on the page and none of them is needed to paint
 * the hero.
 */
export function startSmoothScroll(): () => void {
  if (import.meta.env.DEV) {
    // Dev-only handles for inspecting scrub state from the console.
    Object.assign(window, { gsap, ScrollTrigger })
  }

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
}
