import { useSmoothScroll } from './lib/useSmoothScroll'
import { IndexRail } from './components/IndexRail'
import { Hero } from './components/Hero'
import { FrameSequenceCanvas } from './components/FrameSequenceCanvas'
import { MacroDetails } from './components/MacroDetails'
import { Specifications } from './components/Specifications'
import { Colophon } from './components/Colophon'
import { exploded, explodedClaims, section, turntable, turntableAnnotations, ui } from './content/product'

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
        <FrameSequenceCanvas
          spec={turntable}
          annotations={turntableAnnotations}
          clause={section('turntable').clause}
        />
        <FrameSequenceCanvas
          spec={exploded}
          annotations={explodedClaims}
          clause={section('exploded').clause}
        />
        <MacroDetails />
        <Specifications />
      </main>
      <Colophon />
    </>
  )
}
