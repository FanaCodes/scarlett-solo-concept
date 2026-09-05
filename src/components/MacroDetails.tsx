import { macroDetails, sections, turntable, exploded } from '../content/product'
import { FrameStill } from './FrameStill'

const manifestFor: Record<string, string> = {
  [turntable.name]: turntable.manifestUrl,
  [exploded.name]: exploded.manifestUrl,
}

/**
 * The rest between the two pinned acts and the specifications. Nothing here
 * scrubs and nothing animates in: alternating stills against the panel ground,
 * copy against the paper ground, hard cut between them.
 */
export function MacroDetails() {
  return (
    <section id="details" className="bg-paper lg:pl-rail" aria-labelledby="details-heading">
      <div className="px-6 pt-16 pb-10">
        <h2 id="details-heading" className="text-2xl leading-none font-semibold">
          Detail
        </h2>
        <p className="measure mt-2 text-[0.8125rem] leading-[1.5] text-ink-2">
          Four things that are easier to show than to claim.
        </p>
      </div>

      <ol className="m-0 list-none p-0">
        {macroDetails.map((detail, index) => (
          <li
            key={detail.id}
            className="grid items-stretch border-t border-rule lg:grid-cols-2"
          >
            <div
              className={`flex items-center justify-center bg-panel px-6 py-10 ${
                index % 2 === 1 ? 'lg:order-2' : ''
              }`}
            >
              <FrameStill
                manifestUrl={manifestFor[detail.still.sequence] ?? turntable.manifestUrl}
                frame={detail.still.frame}
                alt={detail.alt}
                sizes="(min-width: 1024px) 46vw, 92vw"
                className="mx-auto block h-auto max-h-[46vh] w-auto max-w-full"
              />
            </div>

            <div
              className={`flex flex-col justify-center px-6 py-10 lg:px-12 ${
                index % 2 === 1 ? 'lg:order-1' : ''
              }`}
            >
              <h3 className="max-w-[18ch] text-xl leading-tight font-semibold">{detail.title}</h3>
              <p className="measure mt-3 text-[0.9375rem] leading-[1.55] text-ink-2">
                {detail.body}
              </p>
              <dl className="mt-6 flex max-w-sm items-baseline justify-between border-t border-ink pt-2">
                <dt className="legend text-ink-2">{detail.figure.label}</dt>
                <dd className="readout m-0 text-ink">{detail.figure.value}</dd>
              </dl>
            </div>
          </li>
        ))}
      </ol>
      <div className="legend border-t border-rule px-6 py-3 text-ink-2">
        {sections[3].clause} {sections[3].title}
      </div>
    </section>
  )
}
