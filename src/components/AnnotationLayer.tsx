import type { Annotation } from '../content/product'
import type { ImageBox } from '../lib/FrameSequence'

type Props = {
  annotations: Annotation[]
  activeIds: readonly string[]
  /** The drawn image box in CSS pixels, from the same contain math the canvas uses. */
  imageBox: ImageBox
  stage: { width: number; height: number }
  /** Below this the labels sit in a strip under the canvas rather than beside it. */
  compact: boolean
}

const COLUMN_WIDTH = 316
const COLUMN_GAP = 28

/**
 * Annotations are real DOM text over the canvas, never drawn into it: they stay
 * selectable, translatable and available to a screen reader. Every annotation
 * is mounted at all times so the content is complete for assistive technology
 * and so enter/exit is a plain opacity transition in both directions.
 */
export function AnnotationLayer({ annotations, activeIds, imageBox, stage, compact }: Props) {
  const active = new Set(activeIds)

  const place = (a: Annotation) => {
    const anchorX = imageBox.x + a.anchor.x * imageBox.width
    const anchorY = imageBox.y + a.anchor.y * imageBox.height

    if (compact) {
      // Labels sit in a fixed strip below the frame; the leader drops to it.
      return { anchorX, anchorY, labelX: 0, labelY: stage.height - 172, labelWidth: stage.width }
    }
    const labelX = stage.width - COLUMN_WIDTH
    const labelY = Math.min(Math.max(anchorY - 52, 24), Math.max(24, stage.height - 220))
    return { anchorX, anchorY, labelX, labelY, labelWidth: COLUMN_WIDTH }
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
          const { anchorX, anchorY, labelX, labelY } = place(a)
          // Orthogonal elbow, the way a callout is drawn on an assembly
          // diagram: out from the anchor, then a single corner into the label.
          const elbowX = compact ? anchorX : Math.max(anchorX + 40, labelX - COLUMN_GAP)
          const endY = compact ? labelY - 14 : labelY + 12
          const d = compact
            ? `M ${anchorX} ${anchorY} L ${anchorX} ${endY}`
            : `M ${anchorX} ${anchorY} L ${elbowX} ${anchorY} L ${elbowX} ${endY} L ${labelX - 12} ${endY}`
          return (
            <g
              key={a.id}
              style={{ opacity: active.has(a.id) ? 1 : 0, transition: 'opacity 180ms linear' }}
            >
              <path d={d} fill="none" stroke="var(--color-ink)" strokeWidth="1" />
              <circle cx={anchorX} cy={anchorY} r="3.5" fill="var(--color-signal)" />
              <circle
                cx={anchorX}
                cy={anchorY}
                r="9"
                fill="none"
                stroke="var(--color-ink)"
                strokeWidth="1"
              />
            </g>
          )
        })}
      </svg>

      <ol className="absolute inset-0 m-0 list-none p-0">
        {annotations.map((a, i) => {
          const { labelX, labelY, labelWidth } = place(a)
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
                  <h3 className="text-[0.95rem] leading-tight font-semibold text-balance">{a.title}</h3>
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
