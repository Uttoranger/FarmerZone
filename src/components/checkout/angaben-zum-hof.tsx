import { ChevronDown } from 'lucide-react'
import type { PublicFarm } from '@/server/queries/farm'
import { ANGABEN_ZUM_HOF_TITEL } from '@/lib/stripe-konto'
import { formatiereTelefon } from '@/lib/telefon-anzeige'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { HINWEIS } from './kasse-teile'

/*
 * „Angaben zum Hof (dein Vertragspartner)" in der Kasse — EINE Komponente für
 * beide Breiten (Nr. 60, Mockups web-k3-kasse-angaben-zum-hof und
 * mobil-k3-kasse-angaben-zum-hof). Die Kundin kauft direkt beim Hof; Name,
 * Anschrift, Telefon und E-Mail des Verkäufers stehen deshalb vor dem
 * Kaufknopf (§ 4 Abs. 1 Z 2 und 3 FAGG), online wie bar. Wo genau, legt
 * `KassenAbschluss` (checkout-form.tsx) fest. Die Daten kommen aus dem
 * PublicFarm der Kasse, keine eigene Abfrage.
 *
 * `<details open>`: aufgeklappt, sobald die Kasse steht. Zuklappen darf die
 * Kundin; im Quelltext und für den Screenreader bleibt alles da.
 */

export type AngabenHof = Pick<PublicFarm, 'name' | 'ownerName' | 'address' | 'postalCode' | 'city' | 'phone' | 'email'>

/** „Feldweg 1, 4910 Ried" — die Anschrift des Hofs, zugleich die Abholadresse der Kasse. */
export function hofAdresse(farm: Pick<PublicFarm, 'address' | 'postalCode' | 'city'>): string {
  return [farm.address, [farm.postalCode, farm.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}

export function AngabenZumHof({ hof }: { hof: AngabenHof }): React.JSX.Element {
  // Was der Hof nicht angegeben hat (die Hof-E-Mail ist im Onboarding
  // freiwillig), steht nicht als leere Zeile da. Die Nummer steht einheitlich da (N8), wie auch
  // immer der Hof sie eingetragen hat.
  const zeilen = [
    { titel: 'Verkäufer', wert: [hof.name, hof.ownerName].filter(Boolean).join(', ') },
    { titel: 'Anschrift', wert: hofAdresse(hof) },
    { titel: 'Telefon', wert: formatiereTelefon(hof.phone) },
    { titel: 'E-Mail', wert: hof.email },
  ].filter((zeile) => zeile.wert !== '')
  return (
    <details open className="group rounded-2xl border border-border bg-card px-4 pt-1 pb-3.5 md:px-[18px]">
      <summary
        className={cn(
          // list-none + Marker weg: Der Pfeil rechts ersetzt das Dreieck des Browsers.
          'flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-md text-[14.5px] font-semibold text-foreground [&::-webkit-details-marker]:hidden',
          FOKUS_RAHMEN
        )}
      >
        {`${ANGABEN_ZUM_HOF_TITEL} (dein Vertragspartner)`}
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
          strokeWidth={1.7}
          aria-hidden="true"
        />
      </summary>
      <dl className="flex flex-col gap-2">
        {zeilen.map((zeile) => (
          <div key={zeile.titel} className="flex gap-2.5 text-[13.5px] leading-[1.4]">
            <dt className="w-[78px] shrink-0 text-muted-foreground">{zeile.titel}</dt>
            {/* Lange Namen und E-Mail-Adressen ohne Leerzeichen brechen um, statt die Karte zu sprengen. */}
            <dd className="min-w-0 text-foreground [overflow-wrap:anywhere]">{zeile.wert}</dd>
          </div>
        ))}
      </dl>
      <p className={cn(HINWEIS, 'mt-2')}>Du kaufst direkt beim Hof. FarmerZone vermittelt die Bestellung.</p>
    </details>
  )
}
