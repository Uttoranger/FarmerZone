'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Compass, Handbag, ReceiptText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { RUNDUNG } from '@/components/ui/rundung'
import { ChipGruppe, type ChipGruppeOption } from '@/components/ui/segment'
import { WARENKORB_ZAEHLER, bottomNavEintragKlassen, bottomNavSymbolKlassen, mittelknopfMitWortKlassen, mittelkreisKlassen } from '@/components/ui/bottom-nav'
import { Zaehler } from '@/components/ui/zaehler'
import { KundeFuss } from '@/components/shells/kunde-fuss'
import { WARENKORB_WORT } from '@/lib/kunden-navigation'

/**
 * Einhängepunkt der Nr. 247 (Lauf 32) in der Bausteine-Vorschau: Kopf der
 * Kunden-Shell (G9), Unterleiste der Kundschaft (G10), Seitenfuß und
 * Chip-Gruppe (G11). Nr. 247 ändert nur diese Datei, nie bausteine-vorschau.tsx.
 * Alle Zahlen und Namen sind Beispiele (TESTING_GUIDELINES §5).
 */

/** Ein Abschnitt in der Gestalt der übrigen Vorschau (Karte 12 px, Titel in der Überschriftenschrift). */
function Abschnitt247({ id, titel, satz, children }: { id: string; titel: string; satz: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-titel`} className={cn('flex min-w-0 flex-col gap-3 border border-border bg-card p-4 md:p-5', RUNDUNG.karte)}>
      <div>
        <h2 id={`${id}-titel`} className="font-heading text-lg font-semibold">
          {titel}
        </h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{satz}</p>
      </div>
      {children}
    </section>
  )
}

const VORSCHAU_LINK = cn('inline-flex min-h-11 items-center rounded-md text-[14px] font-semibold text-status-fertig underline underline-offset-4', FOKUS_RAHMEN)

/** Die drei Köpfe stehen in der Shell-Vorschau (eigene Seiten), weil der Kopf oben an der Seite klebt. */
const KOPF_VARIANTEN = [
  { href: '/intern/bausteine/shell/kunde', label: 'Abgemeldet: „Anmelden“' },
  { href: '/intern/bausteine/shell/kunde-angemeldet', label: 'Kundin angemeldet: „Mein Konto“' },
  { href: '/intern/bausteine/shell/kunde-hof', label: 'Hof angemeldet: „Mein Hof“' },
] as const

/**
 * Die Unterleiste als ruhiges Bild (nicht fest am Fensterrand, sonst lägen hier zwei Leisten übereinander):
 * dieselben Klassen wie in der KundeShell, nur ohne Links.
 */
function UnterleisteBild({ anzahl }: { anzahl: number }): React.JSX.Element {
  return (
    <div className={cn('group/leiste border border-border bg-card pt-6', RUNDUNG.karte)} data-ton="gruen">
      <div className="flex h-[68px] items-stretch">
        <span className={bottomNavEintragKlassen(false)}>
          <span className={bottomNavSymbolKlassen(false)}>
            <Compass className="size-[22px]" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span>Entdecken</span>
        </span>
        <span className="flex min-w-0 flex-1 items-start justify-center">
          <span className={mittelknopfMitWortKlassen()}>
            <span className={cn(mittelkreisKlassen('gruen'), 'relative')}>
              <Handbag className="size-6" strokeWidth={1.7} aria-hidden="true" />
              <Zaehler anzahl={anzahl} wofuer="Artikel im Warenkorb" ton="gruen" className={WARENKORB_ZAEHLER} />
            </span>
            <span>{WARENKORB_WORT}</span>
          </span>
        </span>
        <span className={bottomNavEintragKlassen(false)}>
          <span className={bottomNavSymbolKlassen(false)}>
            <ReceiptText className="size-[22px]" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span>Bestellungen</span>
        </span>
      </div>
    </div>
  )
}

const UMKREIS: readonly ChipGruppeOption[] = [
  { wert: '10', label: '10 km', zahl: 1 },
  { wert: '25', label: '25 km', zahl: 4 },
  { wert: '50', label: '50 km', zahl: 9 },
]
const BEREICH: readonly ChipGruppeOption[] = [
  { wert: 'hofladen', label: 'Hofladen' },
  { wert: 'futter', label: 'Futtermittel' },
]
const ZEITRAUM: readonly ChipGruppeOption[] = [
  { wert: 'woche', label: 'Woche' },
  { wert: 'monat', label: 'Monat' },
  { wert: 'jahr', label: 'Jahr' },
]
const DARSTELLUNG: readonly ChipGruppeOption[] = [
  { wert: 'hell', label: 'Hell' },
  { wert: 'dunkel', label: 'Dunkel' },
  { wert: 'system', label: 'System' },
]

export function Vorschau247(): React.JSX.Element {
  const [umkreis, setUmkreis] = useState('25')

  return (
    <>
      <Abschnitt247
        id="kunde-kopf"
        titel="Kopf der Kunden-Shell (G9)"
        satz="In jeder Sitzung vier Links, „Warenkorb · n“ (nur gefüllt), Sonne/Mond und rechts EINE Umriss-Pille; kein Suchfeld. Am Handy Marke und Pille, auf /login und /register nur die Marke; auf Hof- und Produktseite scrollt der Kopf am Handy weg (Produktseite seit Nr. 252)."
      >
        <ul className="flex flex-col gap-0.5">
          {KOPF_VARIANTEN.map((v) => (
            <li key={v.href}>
              <Link href={v.href} className={VORSCHAU_LINK}>
                {v.label}
              </Link>
            </li>
          ))}
        </ul>
      </Abschnitt247>

      <Abschnitt247
        id="kunde-unterleiste"
        titel="Unterleiste der Kundschaft (G10)"
        satz="„Warenkorb“ halbfett wie die Wörter daneben; der Zähler grün mit hellem Ring. Der Seitenfuß hält darüber Platz frei, samt Home-Indicator."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <UnterleisteBild anzahl={0} />
          <UnterleisteBild anzahl={3} />
        </div>
      </Abschnitt247>

      <Abschnitt247
        id="kunde-fuss"
        titel="Seitenfuß (G11)"
        satz="Fußlinks auch am Handy unterstrichen; im Browser ohne Marke, die Rechtslinks bündig rechts — „Vertrag widerrufen“ bricht bündig um."
      >
        <div className={cn('border border-border bg-background', RUNDUNG.karte)}>
          <KundeFuss />
        </div>
      </Abschnitt247>

      <Abschnitt247
        id="chip-gruppe"
        titel="Chip-Gruppe (G11)"
        satz="Statt des Segments für Umkreis, Hofladen/Futtermittel, Zeitraum und Darstellung: genau eine Wahl, gewählt gefüllt (hell dunkel, dunkel hell), die Zahl mit „ · “."
      >
        <div className="flex flex-col gap-3">
          <ChipGruppe beschriftung="Umkreis" optionen={UMKREIS} wert={umkreis} onWertChange={setUmkreis} />
          <ChipGruppe beschriftung="Bereich" optionen={BEREICH} />
          <ChipGruppe beschriftung="Zeitraum" optionen={ZEITRAUM} standardWert="monat" />
          <ChipGruppe beschriftung="Darstellung" optionen={DARSTELLUNG} />
        </div>
      </Abschnitt247>
    </>
  )
}
