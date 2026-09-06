import { heroStillSizes, product, turntable } from '../content/product'
import { FrameStill } from './FrameStill'

/**
 * The product at rest. One orchestrated entrance on load and then nothing
 * moves again: the hairlines draw, the type resolves, the still arrives.
 * No slide-up anywhere — panels do not slide (DESIGN.md §5).
 *
 * The entrance is CSS keyframes rather than a GSAP timeline, so the largest
 * paint on the page does not wait for the animation library to download. The
 * whole thing sits inside a prefers-reduced-motion guard in index.css.
 */
export function Hero() {
  return (
    <section
      id="hero"
      className="relative flex min-h-screen flex-col bg-panel px-6 py-6 lg:pl-[calc(var(--spacing-rail)+1.5rem)]"
      aria-labelledby="hero-heading"
    >
      <div
        className="legend flex items-baseline justify-between text-ink-2"
        data-hero="fade"
        style={{ animationDelay: '150ms' }}
      >
        <span>{product.maker}</span>
        <span className="legend">{product.stamp}</span>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center py-8">
        {/* The still is deliberately not animated. Fading in the largest
            element on the page can leave it with no LCP candidate at all,
            because Chrome will not nominate an element that is transparent
            when it first paints — and the unit reads better simply being
            there while the datasheet furniture draws in around it. */}
        <div className="w-full max-w-5xl">
          <FrameStill
            manifestUrl={turntable.manifestUrl}
            frame={0}
            priority
            sizes={heroStillSizes}
            alt={product.heroAlt}
            className="mx-auto block h-auto max-h-[56vh] w-auto max-w-full"
          />
        </div>
      </div>

      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <h1
            id="hero-heading"
            className="text-[clamp(2.75rem,8vw,5.5rem)] leading-[0.92] font-semibold tracking-[-0.025em]"
            data-hero="fade"
            style={{ animationDelay: '230ms' }}
          >
            {product.name}
          </h1>
          <div className="mt-5 h-px origin-left bg-ink" data-hero="rule" />
          <p
            className="measure mt-4 text-[0.9375rem] leading-[1.55] text-pretty text-ink-2"
            data-hero="fade"
            style={{ animationDelay: '310ms' }}
          >
            {product.positioning}
          </p>
        </div>

        <div className="lg:pb-1 lg:text-right">
          <div
            className="mb-2 h-px origin-left bg-rule lg:origin-right"
            data-hero="rule"
            style={{ animationDelay: '60ms' }}
          />
          <p className="legend text-ink" data-hero="fade" style={{ animationDelay: '390ms' }}>
            {product.panelLegend}
          </p>
          <p className="legend mt-2 text-ink-2" data-hero="fade" style={{ animationDelay: '470ms' }}>
            {product.scrollAffordance}
          </p>
        </div>
      </div>
    </section>
  )
}
