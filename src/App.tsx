import { Suspense, lazy } from 'react'
import { useSmoothScroll } from './lib/useSmoothScroll'
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

/** Holds the act's place at full height while its chunk loads, so nothing shifts. */
function ActPlaceholder({ spec }: { spec: SequenceSpec }) {
  return (
    <section
      className="flex h-screen w-full flex-col bg-panel px-6 py-6 lg:pl-[calc(var(--spacing-rail)+1.5rem)]"
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
