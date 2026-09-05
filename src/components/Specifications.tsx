import { specGroups, specsNote } from '../content/product'

/**
 * A real table, grouped by signal path. Values are tabular lining figures and
 * right-aligned; the unit sits in its own left-aligned column so every figure
 * lines up on its decimal and every unit lines up on its first letter.
 */
export function Specifications() {
  return (
    <section
      id="specifications"
      className="bg-paper px-6 pt-16 pb-20 lg:pl-[calc(var(--spacing-rail)+1.5rem)]"
      aria-labelledby="specifications-heading"
    >
      <h2 id="specifications-heading" className="text-2xl leading-none font-semibold">
        Specifications
      </h2>
      <p className="measure mt-2 text-[0.8125rem] leading-[1.5] text-pretty text-ink-2">{specsNote}</p>

      <div className="mt-10 grid gap-x-16 gap-y-12 lg:grid-cols-2">
        {specGroups.map((group) => (
          <table
            key={group.id}
            className="w-full border-collapse text-left"
          >
            <caption className="legend border-b border-ink pb-2 text-left text-ink">
              {group.title}
            </caption>
            <colgroup>
              <col />
              <col className="w-24" />
              <col className="w-20" />
            </colgroup>
            <thead className="sr-only">
              <tr>
                <th scope="col">Parameter</th>
                <th scope="col">Value</th>
                <th scope="col">Unit</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row) => (
                <tr key={row.label} className="border-b border-rule/50 align-baseline">
                  <th scope="row" className="py-2.5 pr-4 text-[0.9375rem] font-normal">
                    {row.label}
                    {row.note ? (
                      <span className="block text-[0.75rem] leading-tight text-ink-2">
                        {row.note}
                      </span>
                    ) : null}
                  </th>
                  <td className="py-2.5 pr-2 text-right text-[0.9375rem] whitespace-nowrap">
                    {row.value}
                  </td>
                  <td className="py-2.5 text-left text-[0.8125rem] text-ink-2">{row.unit ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </section>
  )
}
