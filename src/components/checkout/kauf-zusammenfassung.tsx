import { cn } from '@/lib/utils'
import { formatMenge } from '@/lib/format'
import { HINWEIS, KARTE, TEXTLINK, type KorbPosition } from './kasse-teile'

/*
 * Die Zusammenfassung unmittelbar über dem Kaufknopf (§ 8 Abs. 1 FAGG, Nr. 210):
 * Ware, Abholtermin und Vertragspartner — der Gesamtpreis steht im
 * Zahlungsschritt direkt darüber in derselben Übersicht, in der Bar-Kasse
 * als eigene Zeile hier. EIN Baustein für Zahlungsschritt, „Zahlung
 * fortsetzen“ und das Formular (bar und „Weiter zur Zahlung“).
 *
 * Nur Anzeige: Positionen, Termin und Betrag kommen fertig aus der Kasse,
 * hier wird nichts gerechnet.
 */

/** Bis zu so vielen Positionen stehen offen da; der Rest klappt auf. */
export const ZUSAMMENFASSUNG_SICHTBAR = 5

export const KAUF_ZUSAMMENFASSUNG_TEXT = {
  titel: 'Deine Bestellung',
  abholung: 'Abholung',
  vertragspartner: 'Dein Vertragspartner',
  gesamt: 'Gesamt',
  weitere: (anzahl: number) => `und ${anzahl} weitere`,
} as const

export type ZusammenfassungPosition = Pick<KorbPosition, 'productId' | 'name' | 'quantity' | 'unit' | 'unitSize'>

function PositionsZeile({ p }: { p: ZusammenfassungPosition }): React.JSX.Element {
  return (
    <li className="break-words">
      {/* Mittelpunkt statt „×“: Gebinde schreibt formatMenge schon mit „×“ („1 × 10 kg“). */}
      {p.name} <span className="text-muted-foreground">· {formatMenge(p.quantity, p.unit, p.unitSize)}</span>
    </li>
  )
}

export function KaufZusammenfassung({
  positionen,
  abholung,
  hofName,
  gesamt,
  karte = false,
}: {
  positionen: readonly ZusammenfassungPosition[]
  /** Der Abholtermin als Satzteil (`abholSatz` bzw. aus der Bestellung); ohne Wahl null. */
  abholung: string | null
  hofName: string
  /** Gesamtbetrag (fertig formatiert, derselbe Wert wie auf dem Knopf) und sein Zusatz — nur, wo die Übersicht nicht direkt darüber steht. */
  gesamt?: { betrag: string; zusatz?: string | null }
  /** Eigene Karte (Formular: zwischen „Angaben zum Hof“ und Knopf); sonst ein Abschnitt in der Übersicht. */
  karte?: boolean
}): React.JSX.Element {
  const sichtbar = positionen.slice(0, ZUSAMMENFASSUNG_SICHTBAR)
  const weitere = positionen.slice(ZUSAMMENFASSUNG_SICHTBAR)
  const t = KAUF_ZUSAMMENFASSUNG_TEXT
  return (
    <section
      aria-label={t.titel}
      data-kauf-zusammenfassung=""
      className={cn('flex flex-col gap-2 text-[13.5px] leading-snug', karte ? KARTE : 'border-t border-border pt-3')}
    >
      <h3 className="text-sm font-semibold text-foreground">{t.titel}</h3>
      <ul className="flex flex-col gap-1">
        {sichtbar.map((p) => (
          <PositionsZeile key={p.productId} p={p} />
        ))}
      </ul>
      {weitere.length > 0 && (
        // <details> klappt der Browser selbst auf — ohne Zustand, mit Tastatur und Screenreader.
        <details>
          <summary className={cn(TEXTLINK, '-my-2 -ml-1 cursor-pointer list-none [&::-webkit-details-marker]:hidden')}>
            {t.weitere(weitere.length)}
          </summary>
          <ul className="mt-1 flex flex-col gap-1">
            {weitere.map((p) => (
              <PositionsZeile key={p.productId} p={p} />
            ))}
          </ul>
        </details>
      )}
      <dl className="flex flex-col gap-1">
        {abholung && (
          <div className="flex flex-wrap gap-x-1.5">
            <dt className="text-muted-foreground">{t.abholung}:</dt>
            <dd className="font-semibold">{abholung}</dd>
          </div>
        )}
        <div className="flex flex-wrap gap-x-1.5">
          <dt className="text-muted-foreground">{t.vertragspartner}:</dt>
          <dd className="min-w-0 font-semibold break-words">{hofName}</dd>
        </div>
      </dl>
      {gesamt && (
        <div>
          <p className="flex items-baseline gap-2 text-[15px] font-semibold">
            <span>{t.gesamt}</span>
            <span className="ml-auto tabular-nums">{gesamt.betrag}</span>
          </p>
          {gesamt.zusatz && <p className={HINWEIS}>{gesamt.zusatz}</p>}
        </div>
      )}
    </section>
  )
}
