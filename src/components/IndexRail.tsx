import { useEffect, useState } from 'react'
import { product, sections, ui } from '../content/product'

/**
 * The datasheet margin: clause numbers down the left edge, the current one in
 * full ink. It is the only persistent chrome on the page. Below 1024px it
 * becomes a single hairline of scroll progress at the top of the viewport.
 */
export function IndexRail() {
  const [activeId, setActiveId] = useState<string>(sections[0].id)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) setActiveId(visible.target.id)
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.5] },
    )
    for (const section of sections) {
      const el = document.getElementById(section.id)
      if (el) observer.observe(el)
    }

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <>
      <div
        className="fixed top-0 right-0 left-0 z-40 h-px bg-rule/60 lg:hidden"
        aria-hidden="true"
      >
        <div
          className="h-px origin-left bg-ink"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      <nav
        aria-label={ui.railLabel}
        className="fixed top-0 bottom-0 left-0 z-40 hidden w-rail flex-col justify-between border-r border-rule px-4 py-6 lg:flex"
      >
        <ol className="m-0 list-none space-y-3 p-0">
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={activeId === section.id ? 'true' : undefined}
                className={`readout relative block ${
                  activeId === section.id ? 'text-ink' : 'text-ink-2'
                }`}
              >
                {activeId === section.id ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-1/2 -left-3 h-1.5 w-1.5 -translate-y-1/2 bg-signal"
                  />
                ) : null}
                <span aria-hidden="true">{section.clause}</span>
                <span className="sr-only">{section.title}</span>
              </a>
            </li>
          ))}
        </ol>
        <div className="legend text-ink-2" aria-hidden="true">
          {product.type}
        </div>
      </nav>
    </>
  )
}
