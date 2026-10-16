import Link from 'next/link'
import { Wallet } from 'lucide-react'
import { FINANZEN_JAHR_TEXT, KOSTEN_RHYTHMUS_KURZ, monatOhneJahr, type JahrRechnung } from '@/lib/finanzen'
import { centsAlsEuro, formatEuro } from '@/lib/format'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { KARTE, KICKER, KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'

/**
 * „Kosten im Jahr" (Register N15, Ergänzung Nr. 100; Mockup admin-finanzen-jahr):
 * Posten · Rhythmus · Betrag · Monate im Jahr · Im Jahr · Anteil, dazu die Summe.
 * Nur lesen — eintragen und bearbeiten geht in der Monatsansicht (`kostenHref`).
 * Die Beträge sind die der Monate, zusammengelegt (`rechneJahr`); ein
 * Jahresposten ist wie im Monat auf zwölf Monate umgelegt, darum steht bei ihm
 * die Zahl der Monate, bei einem einmaligen Posten sein Monat.
 */
export function KostenJahr({ rechnung, kostenHref }: { rechnung: JahrRechnung; kostenHref: string }): React.JSX.Element {
  const { jahr, posten } = rechnung
  const text = FINANZEN_JAHR_TEXT
  const euro = (cents: number) => formatEuro(centsAlsEuro(cents))

  if (posten.length === 0) {
    return (
      <EmptyState
        symbol={Wallet}
        titel={text.keineKostenTitel(jahr)}
        satz={text.keineKostenSatz}
        ausweg={
          <Link href={kostenHref} className={KNOPF_RAHMEN}>
            {text.keineKostenLink}
          </Link>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 id="kosten-jahr-titel" className={KICKER}>
        {text.kostenImJahr}
      </h2>
      {/* Am Handy scrollt die Tabelle in ihrem Kasten; ohne Link darin braucht der Kasten selbst einen Tastaturzugang. */}
      <div role="region" aria-labelledby="kosten-jahr-titel" tabIndex={0} className={cn(KARTE, 'overflow-x-auto', FOKUS_RAHMEN)}>
        <table aria-labelledby="kosten-jahr-titel" className="w-full min-w-[680px] text-[14px]">
          <thead>
            <tr className="text-left text-[12px] font-semibold text-muted-foreground">
              <th scope="col" className="px-4 py-3 font-semibold">
                Kostenposten
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Rhythmus
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Betrag
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Monate im Jahr
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                {`Im Jahr ${jahr}`}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">
                Anteil
              </th>
            </tr>
          </thead>
          <tbody>
            {posten.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <th scope="row" className="max-w-[16rem] px-4 py-3 text-left font-semibold text-foreground">
                  <span className="block truncate" title={p.name}>
                    {p.name}
                  </span>
                </th>
                <td className="px-3 py-3 text-muted-foreground">{KOSTEN_RHYTHMUS_KURZ[p.rhythmus]}</td>
                <td className="px-3 py-3 text-right text-foreground tabular-nums">{euro(p.betragCents)}</td>
                <td className="px-3 py-3 text-right text-foreground tabular-nums">
                  {p.einmaligImMonat !== null ? monatOhneJahr(p.einmaligImMonat) : p.monate}
                </td>
                <td className="px-3 py-3 text-right font-semibold text-foreground tabular-nums">{euro(p.imJahrCents)}</td>
                <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                  {p.anteilProzent === null ? '–' : `${p.anteilProzent} %`}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border">
              <th scope="row" className="px-4 py-3 text-left font-semibold text-foreground">
                {text.summe(jahr)}
              </th>
              <td colSpan={3} />
              <td className="px-3 py-3 text-right font-semibold text-foreground tabular-nums">{euro(rechnung.kostenCents)}</td>
              <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">100 %</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

