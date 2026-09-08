import { Suspense, lazy } from 'react'
import { useSmoothScroll } from './lib/useSmoothScroll'
import { COMPACT_QUERY, useMediaQuery, useReducedMotion } from './lib/motion'
import { IndexRail } from './components/IndexRail'
import { Hero } from './components/Hero'
import { MacroDetails } from './components/MacroDetails'
import { Specifications } from './components/Specifications'
import { Colophon } from './components/Colophon'
import {
  exploded,
  explodedClaims,
  plug,
  plugAnnotations,
  section,
  turntable,
  turntableAnnotations,
  ui,
  type SequenceSpec,
} from './content/product'

/**
 * The two scrub acts carry GSAP, ScrollTrigger and the frame engine. None of
 * that is needed to paint the hero, so it arrives in a chunk of its own.
 */
const FrameSequenceCanvas = lazy(() =>
  import('./components/FrameSequenceCanvas').then((m) => ({ default: m.FrameSequenceCanvas })),
)

/**
 * Holds the act's place while its chunk loads.
 *
 * It reserves the pinned section *and* its scroll length, so the page is its
 * final height from the first paint. Reserving only one viewport meant the
 * document grew by nearly six thousand pixels the moment the acts mounted,
 * which shifts everything under a reader who has already started scrolling.
 */
function ActPlaceholder({ spec }: { spec: SequenceSpec }) {
  const compact = useMediaQuery(COMPACT_QUERY)
  const reduced = useReducedMotion()
  const scroll = compact ? spec.scrollLength.mobile : spec.scrollLength.desktop
  // '+=300%' is 300% of the viewport, on top of the pinned viewport itself.
  // Under reduced motion nothing pins, so there is no scroll length to hold.
  const reserved = reduced ? 100 : 100 + (Number(/([0-9.]+)%/.exec(scroll)?.[1]) || 0)

  return (
    <section
      className="flex w-full flex-col bg-panel px-6 py-6 lg:pl-[calc(var(--spacing-rail)+1.5rem)]"
      style={{ height: `${reserved}vh` }}
      aria-hidden="true"
    >
      <header className="max-w-[34ch]">
        <p className="text-2xl leading-none font-semibold">{spec.heading}</p>
      </header>
    </section>
  )
}

export function App() {
  useSmoothScroll()

  return (
    <>
      <a className="skip-link legend" href="#main">
        {ui.skipToContent}
      </a>
      <IndexRail />
      <main id="main">
        <Hero />
        <Suspense fallback={<ActPlaceholder spec={turntable} />}>
          <FrameSequenceCanvas
            spec={turntable}
            annotations={turntableAnnotations}
            clause={section('turntable').clause}
          />
        </Suspense>
        <Suspense fallback={<ActPlaceholder spec={exploded} />}>
          <FrameSequenceCanvas
            spec={exploded}
            annotations={explodedClaims}
            clause={section('exploded').clause}
          />
        </Suspense>
        <Suspense fallback={<ActPlaceholder spec={plug} />}>
          <FrameSequenceCanvas
            spec={plug}
            annotations={plugAnnotations}
            clause={section('plug').clause}
          />
        </Suspense>
        <MacroDetails />
        <Specifications />
      </main>
      <Colophon />
    </>
  )
}
