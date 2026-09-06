import { forwardRef } from 'react'

/**
 * Scroll position inside a pinned act, drawn as a metering scale rather than a
 * progress bar (DESIGN.md §6). The tick spacing follows the compressed law of a
 * real dB scale, and the only accent colour on the page marks the overload zone.
 */
const TICKS = [-60, -40, -30, -20, -10, -6, -3, 0, 6] as const
/** The full scale collides with itself under about 480px. */
const TICKS_COMPACT = [-60, -20, -6, 0, 6] as const
const MIN_DB = -60
const MAX_DB = 6

/** Compressed towards the quiet end, as a panel scale is. */
function tickPosition(db: number): number {
  const linear = (db - MIN_DB) / (MAX_DB - MIN_DB)
  return Math.pow(linear, 1.9)
}

const ZERO_POSITION = tickPosition(0)

type Props = { label: string; compact?: boolean }

export const ScrubScale = forwardRef<HTMLDivElement, Props>(function ScrubScale(
  { label, compact = false },
  ref,
) {
  const ticks = compact ? TICKS_COMPACT : TICKS
  return (
    <div className="w-full select-none" aria-hidden="true">
      <div className="relative h-8">
        {/* Overload zone: 0 dB to +6 dB, marked by weight rather than colour. */}
        <div
          className="absolute top-0 h-[3px] bg-ink"
          style={{ left: `${ZERO_POSITION * 100}%`, right: 0 }}
        />
        <div className="absolute top-0 right-0 left-0 h-px bg-ink" />
        {ticks.map((db) => (
          <div
            key={db}
            className="absolute top-0"
            style={{ left: `${tickPosition(db) * 100}%` }}
          >
            <div className={`w-px bg-ink ${db % 20 === 0 || db === 6 ? 'h-2.5' : 'h-1.5'}`} />
            <div className="readout mt-1 -translate-x-1/2 text-ink-2">
              {db > 0 ? `+${db}` : db}
            </div>
          </div>
        ))}
        {/* The needle. Moved from the GSAP ticker, never from React state —
            so it carries no style or text in JSX that a re-render could
            overwrite. */}
        <div ref={ref} className="absolute top-0 h-4 w-px bg-ink will-change-transform">
          <div className="absolute -top-1 -left-[3px] h-[7px] w-[7px] bg-ink" />
        </div>
      </div>
      <div className="legend mt-2 text-ink-2">{label}</div>
    </div>
  )
})
