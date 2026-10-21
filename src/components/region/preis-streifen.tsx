import type { CSSProperties } from 'react'
import type { PreisStreifenDaten } from '@/lib/umfeld'
import { cn } from '@/lib/utils'

/*
 * Die Spanne als Streifen (Register N23, Board system-h5-region-eigene-teile
 * §2, Konzept Umfeld §4): ein Bild mit dem ganzen Satz als `aria-label`.
 * Am Computer 270 × 48 px, am Handy volle Breite (der Aufrufer gibt die
 * Breite vor). Darauf je Hof ein grauer Punkt (10 px), die Mitte als Strich
 * (2 × 16 px), „Deins" als grüner Punkt (16 px) mit dem Wort darüber,
 * Kleinst- und Höchstwert unter den Enden.
 *
 * Leitplanken (N23): Die Punkte tragen keinen Namen, keinen Titel, keinen
 * Tooltip und lassen sich nicht antippen — `role="img"` macht alles darin zu
 * einem Bild. Punkte und Strich haben in beiden Themes mindestens 3:1 zur
 * Fläche der Karte (WCAG 1.4.11): grau `muted-foreground`, Strich
 * `foreground`, „Deins" `status-fertig`; der Rand in der Kartenfarbe trennt
 * Punkte, die aufeinander liegen. Spur und Spanne sind Schmuck.
 *
 * Gezeichnet wird über die Spanne der Höfe hinaus, wenn „Deins" außerhalb
 * liegt — die Skala reicht dann bis zu deinem Wert (Board: „über der Spanne").
 * Kleinst- und Höchstwert stehen auch dann unter den Enden der SPANNE, nicht
 * unter den Enden der Spur: sonst läse man unter „Deins" den Höchst- bzw.
 * Kleinstwert der Höfe als deinen Preis. Liegen die Enden zu eng, steht ein
 * gemeinsames „von – bis" unter der Spanne.
 */

/** Innenrand der Spur: So weit stehen die äußeren Punkte von der Kante. */
const RAND_PX = 10

/** Die Lage eines Werts auf der Spur, als CSS-Länge — links bündig zum Mittelpunkt (verschoben per translate). */
function links(anteil: number): CSSProperties {
  return { left: `calc(${RAND_PX}px + ${anteil} * (100% - ${2 * RAND_PX}px))` }
}

/** Unter diesem Abstand (Anteil der Spur) passen zwei Beschriftungen nicht nebeneinander. */
const ENDEN_MIN_ABSTAND = 0.35

/** Eine Beschriftung unter ihrer Stelle: nahe am Rand bündig, sonst mittig — so ragt sie nicht aus dem Bild. */
function unterDerStelle(anteil: number): CSSProperties {
  const verschiebung = anteil < 0.15 ? '0%' : anteil > 0.85 ? '-100%' : '-50%'
  return { ...links(anteil), transform: `translateX(${verschiebung})` }
}

const ENDE_KLASSE = 'absolute top-[33px] text-[11px] leading-[14px] whitespace-nowrap text-muted-foreground tabular-nums'

export function PreisStreifen({ streifen, className }: { streifen: PreisStreifenDaten; className?: string }): React.JSX.Element {
  const { werte, kleinst, hoechst, mitte, deins } = streifen
  const von = deins === null ? kleinst : Math.min(kleinst, deins)
  const bis = deins === null ? hoechst : Math.max(hoechst, deins)
  // Ein Streifen gibt es nur mit verschiedenen Werten (src/lib/umfeld.ts) — bis > von.
  const anteil = (wert: number) => (wert - von) / (bis - von)
  const kleinstAnteil = anteil(kleinst)
  const hoechstAnteil = anteil(hoechst)

  return (
    <span role="img" aria-label={streifen.satz} className={cn('relative block h-12 shrink-0', className)}>
      {/* Spur über die ganze Breite und die Spanne der Höfe darauf. */}
      <span aria-hidden="true" className="absolute inset-x-2.5 top-[21px] h-1 rounded-full bg-border" />
      <span
        aria-hidden="true"
        className="absolute top-5 h-1.5 rounded-full bg-accent/45"
        style={{ ...links(anteil(kleinst)), width: `calc(${anteil(hoechst) - anteil(kleinst)} * (100% - ${2 * RAND_PX}px))` }}
      />
      <span
        data-punkt="mitte"
        className="absolute top-[15px] h-4 w-0.5 -translate-x-1/2 rounded-[1px] bg-foreground"
        style={links(anteil(mitte))}
      />
      {werte.map((wert, i) => (
        <span
          // Gleiche Werte liegen aufeinander — der Schlüssel ist die Stelle, kein Name.
          key={i}
          data-punkt="hof"
          className="absolute top-[18px] size-2.5 -translate-x-1/2 rounded-full border-2 border-card bg-muted-foreground"
          style={links(anteil(wert))}
        />
      ))}
      {deins !== null && (
        <>
          <span
            data-punkt="deins"
            className="absolute top-[15px] size-4 -translate-x-1/2 rounded-full border-[3px] border-card bg-status-fertig"
            style={links(anteil(deins))}
          />
          <span
            className="absolute top-0 w-10 -translate-x-1/2 text-center text-[10.5px] leading-[14px] font-bold text-status-fertig"
            style={links(anteil(deins))}
          >
            Deins
          </span>
        </>
      )}
      {hoechstAnteil - kleinstAnteil < ENDEN_MIN_ABSTAND ? (
        <span data-ende="spanne" className={ENDE_KLASSE} style={unterDerStelle((kleinstAnteil + hoechstAnteil) / 2)}>
          {streifen.kleinstText} – {streifen.hoechstText}
        </span>
      ) : (
        <>
          {/* Liegt „Deins" innerhalb, sind die Enden der Spanne die Enden der Spur. */}
          <span data-ende="kleinst" className={cn(ENDE_KLASSE, kleinstAnteil === 0 && 'left-0')} style={kleinstAnteil === 0 ? undefined : unterDerStelle(kleinstAnteil)}>
            {streifen.kleinstText}
          </span>
          <span data-ende="hoechst" className={cn(ENDE_KLASSE, hoechstAnteil === 1 && 'right-0')} style={hoechstAnteil === 1 ? undefined : unterDerStelle(hoechstAnteil)}>
            {streifen.hoechstText}
          </span>
        </>
      )}
    </span>
  )
}
