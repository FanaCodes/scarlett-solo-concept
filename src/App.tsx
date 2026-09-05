import { useSmoothScroll } from './lib/useSmoothScroll'
import { IndexRail } from './components/IndexRail'
import { Hero } from './components/Hero'
import { FrameSequenceCanvas } from './components/FrameSequenceCanvas'
import { turntable, turntableAnnotations, sections } from './content/product'

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
      </main>
    </>
  )
}
