import { useSmoothScroll } from './lib/useSmoothScroll'
import { IndexRail } from './components/IndexRail'
import { Hero } from './components/Hero'
import { FrameSequenceCanvas } from './components/FrameSequenceCanvas'
import { MacroDetails } from './components/MacroDetails'
import { Specifications } from './components/Specifications'
import { Colophon } from './components/Colophon'
import {
  exploded,
  explodedClaims,
  sections,
  turntable,
  turntableAnnotations,
} from './content/product'

export function App() {
  useSmoothScroll()

  return (
    <>
      <a className="skip-link legend" href="#main">
        Skip to content
      </a>
      <IndexRail />
      <main id="main">
        <Hero />
        <FrameSequenceCanvas
          spec={turntable}
          annotations={turntableAnnotations}
          clause={sections[1].clause}
        />
        <FrameSequenceCanvas
          spec={exploded}
          annotations={explodedClaims}
          clause={sections[2].clause}
        />
        <MacroDetails />
        <Specifications />
      </main>
      <Colophon />
    </>
  )
}
