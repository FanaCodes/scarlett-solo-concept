import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { FrameSequence, type ImageBox } from '../lib/FrameSequence'
import { ui, type Annotation, type SequenceSpec } from '../content/product'
import { AnnotationLayer } from './AnnotationLayer'
import { ScrubScale } from './ScrubScale'
import { FrameStill } from './FrameStill'
import { getManifest } from '../lib/useManifest'
import { useMediaQuery, useReducedMotion } from '../lib/motion'
import { whenHeroReady } from '../lib/heroReady'

gsap.registerPlugin(ScrollTrigger)

/** Room reserved beside (desktop) or below (compact) the frame for annotations. */
const COLUMN_RESERVE = 344
const STRIP_RESERVE = 176
const COMPACT_QUERY = '(max-width: 1023px)'
/** Start decoding a sequence when the act is this far ahead of the viewport. */
const PRELOAD_START = 'top bottom+=150%'



type Props = {
  spec: SequenceSpec
  annotations: Annotation[]
  clause: string
}

type Status = 'loading' | 'ready' | 'failed'

export function FrameSequenceCanvas({ spec, annotations, clause }: Props) {
  const reduced = useReducedMotion()
  const compact = useMediaQuery(COMPACT_QUERY)

  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const readoutRef = useRef<HTMLSpanElement | null>(null)
  const setReadout = useCallback((node: HTMLSpanElement | null) => {
    readoutRef.current = node
    if (node && !node.textContent) node.textContent = ui.frameReadoutPlaceholder
  }, [])
  const needleRef = useRef<HTMLDivElement>(null)
  const scaleTrackRef = useRef<HTMLDivElement>(null)

  const [status, setStatus] = useState<Status>('loading')
  const [progress, setProgress] = useState(0)
  const [activeIds, setActiveIds] = useState<readonly string[]>([])
  const [imageBox, setImageBox] = useState<ImageBox>({ x: 0, y: 0, width: 0, height: 0 })
  const [stage, setStage] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (reduced) return
    const section = sectionRef.current
    const canvas = canvasRef.current
    const stageEl = stageRef.current
    if (!section || !canvas || !stageEl) return

    let sequence: FrameSequence | null = null
    let trigger: ScrollTrigger | null = null
    let tween: gsap.core.Tween | null = null
    let tick: (() => void) | null = null
    let observer: ResizeObserver | null = null
    let preload: ScrollTrigger | null = null
    let cancelled = false
    let lastPercent = -1
    let lastIndex = -1
    let activeKey = ''
    let scaleWidth = 0

    const releasePin = () => {
      // Failure path: the section stops being a scrub act and the page scrolls
      // through it like any other block.
      tween?.kill()
      trigger?.kill(true)
      trigger = null
      tween = null
    }

    FrameSequence.create(spec.manifestUrl, canvas, {
      onProgress: (value) => {
        const percent = Math.round(value * 100)
        if (percent === lastPercent) return
        lastPercent = percent
        setProgress(value)
      },
      onReady: () => {
        if (!cancelled) setStatus('ready')
      },
      onFail: () => {
        if (cancelled) return
        setStatus('failed')
        releasePin()
      },
    })
      .then((seq) => {
        if (cancelled) {
          seq.destroy()
          return
        }
        sequence = seq

        const syncLayout = () => {
          seq.resize()
          setImageBox({ ...seq.getImageBox() })
          setStage({ width: stageEl.clientWidth, height: stageEl.clientHeight })
          scaleWidth = scaleTrackRef.current?.clientWidth ?? 0
        }
        syncLayout()

        observer = new ResizeObserver(syncLayout)
        observer.observe(stageEl)

        // Decoding starts only once the hero still has painted and the act is
        // within striking distance of the viewport, so the largest paint on the
        // page never queues behind a few megabytes of frames.
        preload = ScrollTrigger.create({
          trigger: section,
          start: PRELOAD_START,
          once: true,
          onEnter: () => {
            void whenHeroReady().then(() => seq.load())
          },
        })

        const proxy = { frame: 0 }
        tween = gsap.to(proxy, {
          frame: seq.manifest.frameCount - 1,
          ease: 'none',
          snap: 'frame',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: compact ? spec.scrollLength.mobile : spec.scrollLength.desktop,
            pin: true,
            scrub: 0.5,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
          onUpdate: () => {
            // Gating: the act is pinned from the start so the page height never
            // jumps, but it does not scrub until every frame is decoded.
            if (!seq.ready) return
            seq.requestFrame(proxy.frame)
          },
        })
        trigger = tween.scrollTrigger ?? null

        // Every paint happens here, inside the GSAP ticker — never in a scroll
        // handler, and never more than once per frame index.
        tick = () => {
          seq.flush()
          // The scale only exists once loading finishes, so its width is
          // picked up on the first tick after that swap.
          if (!scaleWidth) scaleWidth = scaleTrackRef.current?.clientWidth ?? 0
          if (needleRef.current && trigger) {
            needleRef.current.style.transform = `translateX(${trigger.progress * scaleWidth}px)`
          }
          const index = seq.currentIndex
          if (index === lastIndex) return
          lastIndex = index
          if (readoutRef.current) readoutRef.current.textContent = String(index).padStart(4, '0')
          const next = annotations
            .filter((a) => index >= a.enterFrame && index <= a.exitFrame)
            .map((a) => a.id)
          const key = next.join('|')
          if (key !== activeKey) {
            activeKey = key
            setActiveIds(next)
          }
        }
        gsap.ticker.add(tick)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error(`[FrameSequenceCanvas:${spec.name}] falling back to a static frame —`, error)
        setStatus('failed')
        releasePin()
      })

    return () => {
      cancelled = true
      if (tick) gsap.ticker.remove(tick)
      observer?.disconnect()
      preload?.kill()
      releasePin()
      sequence?.destroy()
    }
  }, [reduced, compact, spec, annotations])

  if (reduced) {
    return <StaticSequence spec={spec} annotations={annotations} clause={clause} keyFrames={spec.keyFrames} />
  }
  if (status === 'failed') {
    return (
      <StaticSequence
        spec={spec}
        annotations={annotations}
        clause={clause}
        keyFrames={spec.keyFrames.slice(0, 1)}
      />
    )
  }

  const canvasInset = compact
    ? { left: 0, top: 0, right: 0, bottom: STRIP_RESERVE }
    : { left: 0, top: 0, right: COLUMN_RESERVE, bottom: 0 }

  return (
    <section
      ref={sectionRef}
      id={spec.name}
      className="relative h-screen w-full overflow-hidden bg-panel"
      aria-labelledby={`${spec.name}-heading`}
    >
      <div className="absolute inset-0 flex flex-col px-6 py-6 lg:pl-[calc(var(--spacing-rail)+1.5rem)]">
        <header className="relative z-10 max-w-[34ch]">
          <div className="flex items-baseline gap-3">
            <span className="legend text-ink-2 lg:hidden">{clause}</span>
            <h2 id={`${spec.name}-heading`} className="text-2xl leading-none font-semibold">
              {spec.heading}
            </h2>
          </div>
          <p className="measure mt-2 text-[0.8125rem] leading-[1.5] text-ink-2">{spec.intro}</p>
        </header>

        <div ref={stageRef} className="relative mt-6 min-h-0 flex-1">
          {/* The canvas is a replaced element, so it cannot be stretched by
              left/right offsets alone — the wrapper carries the reserve. */}
          <div className="absolute" style={canvasInset}>
            <canvas ref={canvasRef} aria-hidden="true" className="block h-full w-full" />
          </div>
          <AnnotationLayer
            annotations={annotations}
            activeIds={activeIds}
            imageBox={imageBox}
            stage={stage}
            compact={compact}
          />
        </div>

        <footer className="mt-4 shrink-0">
          {status === 'ready' ? (
            <div className="flex items-end gap-6">
              <div ref={scaleTrackRef} className="min-w-0 flex-1">
                <ScrubScale ref={needleRef} label={spec.scaleLabel} />
              </div>
              <p className="readout shrink-0 text-ink-2">
                {/* Written from the ticker, so it deliberately has no children
                    in JSX: React must not reset it on a re-render. */}
                <span ref={setReadout} className="text-ink" />
                {' / '}
                <FrameTotal spec={spec} />
              </p>
            </div>
          ) : (
            <LoadingRule progress={progress} />
          )}
        </footer>
      </div>
    </section>
  )
}

/** Frame count comes from the manifest, so the readout denominator does too. */
function FrameTotal({ spec }: { spec: SequenceSpec }) {
  const [total, setTotal] = useState<number | null>(null)
  useEffect(() => {
    let cancelled = false
    getManifest(spec.manifestUrl)
      .then((m) => {
        if (!cancelled) setTotal(m.frameCount - 1)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [spec.manifestUrl])
  return <>{total === null ? '' : String(total).padStart(4, '0')}</>
}

/** Determinate, and a rule rather than a spinner (DESIGN.md §5). */
function LoadingRule({ progress }: { progress: number }) {
  return (
    <div>
      <div className="h-px w-full bg-rule">
        <div
          className="h-px origin-left bg-ink"
          style={{ transform: `scaleX(${Math.max(progress, 0.01)})` }}
        />
      </div>
      <div className="legend mt-2 flex justify-between text-ink-2">
        <span>{ui.loadingSequence}</span>
        <span className="readout">{String(Math.round(progress * 100)).padStart(3, '0')}%</span>
      </div>
    </div>
  )
}

/**
 * The reduced-motion and failure path: no pin, no scrub. Key frames stacked as
 * ordinary images in document flow with every annotation permanently visible.
 */
function StaticSequence({
  spec,
  annotations,
  clause,
  keyFrames,
}: {
  spec: SequenceSpec
  annotations: Annotation[]
  clause: string
  keyFrames: number[]
}) {
  return (
    <section
      id={spec.name}
      className="bg-panel px-6 py-16 lg:pl-[calc(var(--spacing-rail)+1.5rem)]"
      aria-labelledby={`${spec.name}-heading`}
    >
      <header className="max-w-[34ch]">
        <div className="flex items-baseline gap-3">
          <span className="legend text-ink-2 lg:hidden">{clause}</span>
          <h2 id={`${spec.name}-heading`} className="text-2xl leading-none font-semibold">
            {spec.heading}
          </h2>
        </div>
        <p className="measure mt-2 text-[0.8125rem] leading-[1.5] text-ink-2">{spec.intro}</p>
      </header>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {keyFrames.map((frame, index) => (
          <FrameStill
            key={frame}
            manifestUrl={spec.manifestUrl}
            frame={frame}
            alt={ui.keyFrameAlt(spec.heading, index + 1, keyFrames.length)}
            sizes="(min-width: 640px) 45vw, 92vw"
            className="w-full"
          />
        ))}
      </div>

      <ol className="mt-10 grid list-none gap-x-10 gap-y-7 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {annotations.map((a, i) => (
          <li key={a.id} className="border-t border-ink pt-2">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-[0.95rem] leading-tight font-semibold">{a.title}</h3>
              <span className="readout text-ink-2">{String(i + 1).padStart(2, '0')}</span>
            </div>
            <p className="mt-1.5 max-w-[42ch] text-[0.8125rem] leading-[1.5] text-ink-2">{a.body}</p>
            {a.readout ? (
              <p className="readout mt-2 border-t border-rule pt-1.5">{a.readout}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  )
}
