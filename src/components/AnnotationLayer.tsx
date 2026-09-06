import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { Annotation } from '../content/product'
import type { ImageBox } from '../lib/FrameSequence'
import type { SequenceAnchors } from '../lib/anchors'

type Props = {
  annotations: Annotation[]
  activeIds: readonly string[]
  /** The drawn image box in CSS pixels, from the same contain math the canvas uses. */
  imageBox: ImageBox
  stage: { width: number; height: number }
  /** Below this the labels sit in a strip under the canvas rather than beside it. */
  compact: boolean
  /** Per-frame positions of the model's named parts, when the sequence has them. */
  anchors: SequenceAnchors | null
  /** Current frame index, written by the canvas from the GSAP ticker. */
  frameRef: { current: number }
}

const COLUMN_WIDTH = 316
const COLUMN_GAP = 28
const STRIP_OFFSET = 172

type Leader = { path: SVGPathElement | null; dot: SVGCircleElement | null; ring: SVGCircleElement | null }

/**
 * Annotations are real DOM text over the canvas, never drawn into it: they stay
 * selectable, translatable and available to a screen reader. Every annotation
 * is mounted at all times so the content is complete for assistive technology
 * and so enter and exit is a plain opacity transition in both directions.
 *
 * The label sits in a fixed slot, but the leader line tracks its component
 * through the sequence: the anchor is looked up per frame from the render's
 * anchors file and rewritten from the GSAP ticker, never from React state.
 */
export function AnnotationLayer({
  annotations,
  activeIds,
  imageBox,
  stage,
  compact,
  anchors,
  frameRef,
}: Props) {
  const active = new Set(activeIds)
  const leaders = useRef(new Map<string, Leader>())

  /** Normalised anchor for one annotation on one frame. */
  const anchorAt = (annotation: Annotation, frame: number): [number, number] => {
    const track = annotation.part ? anchors?.nodes[annotation.part] : undefined
    const point = track?.p[Math.max(0, Math.min(track.p.length - 1, frame))]
    return point ?? [annotation.anchor.x, annotation.anchor.y]
  }

  const toPixels = ([x, y]: [number, number]) => ({
    x: imageBox.x + x * imageBox.width,
    y: imageBox.y + y * imageBox.height,
  })

  /**
   * Label slots are derived from the anchor at the middle of the annotation's
   * range, so a label never chases its own leader line across the screen.
   */
  const slotFor = (annotation: Annotation) => {
    const middle = Math.round((annotation.enterFrame + annotation.exitFrame) / 2)
    const anchor = toPixels(anchorAt(annotation, middle))
    if (compact) {
      return { labelX: 0, labelY: Math.max(0, stage.height - STRIP_OFFSET), labelWidth: stage.width }
    }
    return {
      labelX: stage.width - COLUMN_WIDTH,
      labelY: Math.min(Math.max(anchor.y - 52, 24), Math.max(24, stage.height - 220)),
      labelWidth: COLUMN_WIDTH,
    }
  }

  /**
   * Orthogonal elbow, the way a callout is drawn on an assembly diagram: out
   * from the anchor, then a single corner into the label.
   */
  const leaderPath = (anchor: { x: number; y: number }, labelX: number, labelY: number) => {
    if (compact) return `M ${anchor.x} ${anchor.y} L ${anchor.x} ${labelY - 14}`
    const elbowX = Math.max(anchor.x + 40, labelX - COLUMN_GAP)
    const endY = labelY + 12
    return `M ${anchor.x} ${anchor.y} L ${elbowX} ${anchor.y} L ${elbowX} ${endY} L ${labelX - 12} ${endY}`
  }

  useEffect(() => {
    if (!anchors) return
    let lastFrame = -1
    const tick = () => {
      const frame = frameRef.current
      if (frame === lastFrame) return
      lastFrame = frame
      for (const annotation of annotations) {
        if (!annotation.part) continue
        const leader = leaders.current.get(annotation.id)
        if (!leader?.path) continue
        const anchor = toPixels(anchorAt(annotation, frame))
        const { labelX, labelY } = slotFor(annotation)
        leader.path.setAttribute('d', leaderPath(anchor, labelX, labelY))
        leader.dot?.setAttribute('cx', String(anchor.x))
        leader.dot?.setAttribute('cy', String(anchor.y))
        leader.ring?.setAttribute('cx', String(anchor.x))
        leader.ring?.setAttribute('cy', String(anchor.y))
      }
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
    // Re-registered on resize, which is when the pixel maths changes.
  }, [anchors, annotations, imageBox, stage, compact, frameRef])

  const leaderFor = (id: string): Leader => {
    let entry = leaders.current.get(id)
    if (!entry) {
      entry = { path: null, dot: null, ring: null }
      leaders.current.set(id, entry)
    }
    return entry
  }
  const setPath = (id: string) => (node: SVGPathElement | null) => {
    leaderFor(id).path = node
  }
  const setDot = (id: string) => (node: SVGCircleElement | null) => {
    leaderFor(id).dot = node
  }
  const setRing = (id: string) => (node: SVGCircleElement | null) => {
    leaderFor(id).ring = node
  }

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        width={stage.width}
        height={stage.height}
        aria-hidden="true"
        focusable="false"
      >
        {annotations.map((a) => {
          const { labelX, labelY } = slotFor(a)
          const anchor = toPixels(anchorAt(a, frameRef.current))
          return (
            <g
              key={a.id}
              style={{ opacity: active.has(a.id) ? 1 : 0, transition: 'opacity 180ms linear' }}
            >
              <path
                ref={setPath(a.id)}
                d={leaderPath(anchor, labelX, labelY)}
                fill="none"
                stroke="var(--color-ink)"
                strokeWidth="1"
              />
              <circle
                ref={setRing(a.id)}
                cx={anchor.x}
                cy={anchor.y}
                r="9"
                fill="none"
                stroke="var(--color-ink)"
                strokeWidth="1"
              />
              <circle
                ref={setDot(a.id)}
                cx={anchor.x}
                cy={anchor.y}
                r="3"
                fill="var(--color-ink)"
              />
            </g>
          )
        })}
      </svg>

      <ol className="absolute inset-0 m-0 list-none p-0">
        {annotations.map((a, i) => {
          const { labelX, labelY, labelWidth } = slotFor(a)
          const isActive = active.has(a.id)
          return (
            <li
              key={a.id}
              className="pointer-events-auto absolute"
              style={{
                left: labelX,
                top: labelY,
                width: labelWidth,
                opacity: isActive ? 1 : 0,
                transition: 'opacity 180ms linear',
                pointerEvents: isActive ? 'auto' : 'none',
              }}
            >
              <div className="border-t border-ink pt-2">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[0.95rem] leading-tight font-semibold text-balance">
                    {a.title}
                  </h3>
                  <span className="readout text-ink-2">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <p className="mt-1.5 max-w-[42ch] text-[0.8125rem] leading-[1.5] text-pretty text-ink-2">
                  {a.body}
                </p>
                {a.readout ? (
                  <p className="readout mt-2 border-t border-rule pt-1.5 text-ink">{a.readout}</p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
