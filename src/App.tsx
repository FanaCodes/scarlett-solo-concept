import { useSmoothScroll } from './lib/useSmoothScroll'

export function App() {
  useSmoothScroll()

  return (
    <>
      <a className="skip-link legend" href="#main">
        Skip to content
      </a>
      <main id="main">
        <section className="flex min-h-screen items-center bg-panel px-6">
          <p className="legend">Harbour Two — shell</p>
        </section>
        <section className="flex min-h-screen items-center bg-paper px-6">
          <p className="legend">Document ground</p>
        </section>
      </main>
    </>
  )
}
