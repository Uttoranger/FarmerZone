'use client'

import type { ReactNode } from 'react'
import { Compass, Handbag, ReceiptText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RUNDUNG } from '@/components/ui/rundung'
import { WARENKORB_SYMBOL, WARENKORB_ZAEHLER, bottomNavEintragKlassen, bottomNavSymbolKlassen, mittelknopfMitWortKlassen, mittelkreisKlassen } from '@/components/ui/bottom-nav'
import { Zaehler } from '@/components/ui/zaehler'
import { KundeFuss } from '@/components/shells/kunde-fuss'
import { SPALTE_JE_ROUTE, WARENKORB_WORT, type FussSpalte } from '@/lib/kunden-navigation'

/**
 * Einhängepunkt der Nr. 267 (Lauf 33) in der Bausteine-Vorschau: Seitenfuß in
 * der Spalte der Seite (G11) und das Taschen-Symbol der Unterleiste in
 * Board-Größe (G10). Nr. 267 ändert nur diese Datei und hängt sie mit einer
 * Import- und einer Einhäng-Zeile am Ende von bausteine-vorschau.tsx ein.
 * Alle Zahlen sind Beispiele (TESTING_GUIDELINES §5).
 */

function Abschnitt267({ id, titel, satz, children }: { id: string; titel: string; satz: string; children: ReactNode }) {
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

/** Die vier Spaltenarten mit der Breite ihres Inhalts — die Routen dazu kommen aus der Quelle (SPALTE_JE_ROUTE). */
const SPALTEN: readonly { spalte: FussSpalte; breite: string; dazu?: string }[] = [
  { spalte: 'schmal', breite: '520 px' },
  { spalte: 'mittel', breite: '896 px' },
  { spalte: 'seite', breite: '1000 px', dazu: 'jede Adresse außerhalb der Liste (Fehlerseiten)' },
  { spalte: 'breit', breite: '1200 px', dazu: 'Hof- und Produktseite' },
]

function routenDer(spalte: FussSpalte): string {
  return SPALTE_JE_ROUTE.filter(([, art]) => art === spalte)
    .map(([muster]) => muster)
    .join(', ')
}

/** Die Unterleiste der Kundschaft als ruhiges Bild (nicht fest am Fensterrand) — dieselben Klassen wie in der KundeShell. */
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
              <Handbag {...WARENKORB_SYMBOL} aria-hidden="true" />
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

export function Vorschau267(): React.JSX.Element {
  return (
    <>
      <Abschnitt267
        id="fuss-spalte"
        titel="Seitenfuß in der Spalte der Seite (G11)"
        satz="Im Browser so breit wie die Inhaltsspalte der Seite, ohne Marke; die Spalte kommt je Route aus EINER Quelle. Passt nicht alles in eine Zeile, stehen die Rechtslinks samt „Vertrag widerrufen“ linksbündig darunter. Am Handy über die volle Breite wie bisher."
      >
        <div className="flex flex-col gap-4">
          {SPALTEN.map(({ spalte, breite, dazu }) => (
            <figure key={spalte} className="flex flex-col gap-1.5">
              <figcaption className="text-[13px] text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {spalte} · {breite}
                </span>{' '}
                — {[routenDer(spalte), dazu].filter(Boolean).join(', ')}
              </figcaption>
              <div className={cn('border border-border bg-background', RUNDUNG.karte)}>
                <KundeFuss spalte={spalte} />
              </div>
            </figure>
          ))}
        </div>
      </Abschnitt267>

      <Abschnitt267
        id="warenkorb-symbol"
        titel="Warenkorb-Symbol in Board-Größe (G10)"
        satz="Die Tasche im grünen Kreis der Unterleiste und im Kopf der Fokus-Seiten 16 px groß wie im Board, nicht mehr 24 px. Hof- und Admin-Unterleiste bleiben unverändert."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <UnterleisteBild anzahl={0} />
          <UnterleisteBild anzahl={3} />
        </div>
      </Abschnitt267>
    </>
  )
}
