import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { product, turntable } from '../content/product'
import { FrameStill } from './FrameStill'
import { useReducedMotion } from '../lib/motion'

/**
 * The product at rest. One orchestrated entrance on load and then nothing
 * moves again: the hairlines draw, the type resolves, the still arrives.
 * No slide-up anywhere — panels do not slide (DESIGN.md §5).
 */
export function Hero() {
  const rootRef = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const root = rootRef.current
    if (!root) return

    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({ defaults: { ease: 'power2.out' } })
      timeline
        .fromTo('[data-hero="rule"]', { scaleX: 0 }, { scaleX: 1, duration: 0.7, stagger: 0.06 })
        .fromTo('[data-hero="fade"]', { opacity: 0 }, { opacity: 1, duration: 0.5, stagger: 0.08 }, 0.15)
        .fromTo('[data-hero="still"]', { opacity: 0 }, { opacity: 1, duration: 0.9 }, 0.1)
    }, root)

    return () => ctx.revert()
  }, [reduced])

  return (
    <section
      ref={rootRef}
      id="hero"
      className="relative flex min-h-screen flex-col bg-panel px-6 py-6 lg:pl-[calc(var(--spacing-rail)+1.5rem)]"
      aria-labelledby="hero-heading"
    >
      <div className="legend flex items-baseline justify-between text-ink-2" data-hero="fade">
        <span>{product.maker}</span>
        <span className="readout">{product.serial}</span>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center py-8">
        <div className="w-full max-w-4xl" data-hero="still">
          <FrameStill
            manifestUrl={turntable.manifestUrl}
            frame={0}
            priority
            sizes="(min-width: 1024px) 56rem, 92vw"
            alt={`The ${product.name} desktop audio interface, seen from the front.`}
            className="mx-auto block h-auto max-h-[52vh] w-auto max-w-full"
          />
        </div>
      </div>

      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <h1
            id="hero-heading"
            className="text-[clamp(2.75rem,8vw,5.5rem)] leading-[0.92] font-semibold tracking-[-0.025em]"
            data-hero="fade"
          >
            {product.name}
          </h1>
          <div className="mt-5 h-px origin-left bg-ink" data-hero="rule" />
          <p
            className="measure mt-4 text-[0.9375rem] leading-[1.55] text-ink-2"
            data-hero="fade"
          >
            {product.positioning}
          </p>
        </div>

        <div className="lg:pb-1 lg:text-right">
          <div className="mb-2 h-px origin-left bg-rule lg:origin-right" data-hero="rule" />
          <p className="legend text-ink" data-hero="fade">
            {product.panelLegend}
          </p>
          <p className="legend mt-2 text-ink-2" data-hero="fade">
            {product.scrollAffordance}
          </p>
        </div>
      </div>
    </section>
  )
}
