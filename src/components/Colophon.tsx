import { colophon, product } from '../content/product'

export function Colophon() {
  return (
    <footer
      id="colophon"
      className="border-t border-ink bg-paper px-6 py-14 lg:pl-[calc(var(--spacing-rail)+1.5rem)]"
      aria-labelledby="colophon-heading"
    >
      <h2 id="colophon-heading" className="text-base leading-none font-semibold">
        Colophon
      </h2>
      <p className="measure mt-3 text-[0.9375rem] leading-[1.55] text-ink-2">{colophon.intro}</p>

      <dl className="mt-8 grid max-w-3xl gap-x-10 gap-y-3 sm:grid-cols-2">
        {colophon.credits.map((credit) => (
          <div key={credit.role} className="flex items-baseline gap-4 border-t border-rule pt-2">
            <dt className="legend w-24 shrink-0 text-ink-2">{credit.role}</dt>
            <dd className="m-0 text-[0.875rem] leading-tight">{credit.value}</dd>
          </div>
        ))}
      </dl>

      <p className="measure mt-8 text-[0.8125rem] leading-[1.5] text-ink-2">{colophon.note}</p>
      <p className="legend mt-6 text-ink-2">
        {product.panelLegend} <span className="readout ml-3">{product.serial}</span>
      </p>
    </footer>
  )
}
