import { cn } from '@/lib/utils'
import type { KennzahlDaten, KennzahlTon } from '@/lib/admin-seiten'
import { KARTE, LEISE } from '@/components/hof-bestellungen/stil'

const ZAHL_FARBE: Record<KennzahlTon, string> = {
  tun: 'text-zustand-tun',
  laeuft: 'text-zustand-laeuft',
  neutral: 'text-foreground',
}

/** Tailwind sieht nur ganze Klassennamen: die Spalten ab 1024 px, je nach Zahl der Kacheln. */
const SPALTEN: Record<3 | 4 | 5, string> = { 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' }

/**
 * Die Kennzahlen einer Admin-Seite (Register N15, Nr. 94): 3 bis 5 Kacheln mit
 * Titel, Zahl in Fraunces und einer leisen Zeile. Der Ton der Zahl kommt aus
 * den Bedeutungs-Tokens (Register G5: tun, läuft) und steht nur an der Kachel,
 * bei der etwas wartet — die Fachregel der Seite liefert die Bedeutung
 * (`KennzahlTon`), nie eine Klasse. Am Handy stehen die Kacheln zu dritt;
 * eine Kachel mit `amHandy: false` fällt dort weg, ein Kurztitel ersetzt den
 * Titel, und die leise Zeile steht dort nur, wo die Kachel es will.
 *
 * Eine Beschreibungsliste: Titel (dt), Zahl und Satz (dd) — der Screenreader
 * liest „Warten, 2, auf Freischaltung“.
 */
export function Kennzahlen({
  beschriftung,
  eintraege,
  className,
}: {
  /** Wofür die Zahlen stehen, für Screenreader: „Höfe in Zahlen“. */
  beschriftung: string
  eintraege: readonly KennzahlDaten[]
  className?: string
}): React.JSX.Element {
  const spalten = SPALTEN[Math.min(5, Math.max(3, eintraege.length)) as 3 | 4 | 5]
  return (
    <section aria-label={beschriftung} className={className}>
      <dl className={cn('grid grid-cols-3 gap-2 md:gap-3', spalten)}>
        {eintraege.map((k) => (
          <div key={k.id} className={cn(KARTE, 'min-w-0 px-2.5 py-2.5 md:px-4 md:py-3.5', k.amHandy === false && 'hidden md:block')}>
            <dt className="text-[10.5px] leading-tight font-semibold tracking-[0.05em] break-words text-muted-foreground uppercase md:text-[11px] md:tracking-[0.1em]">
              {k.titelKurz ? (
                <>
                  <span className="md:hidden">{k.titelKurz}</span>
                  <span className="hidden md:inline">{k.titel}</span>
                </>
              ) : (
                k.titel
              )}
            </dt>
            <dd className={cn('mt-1 font-heading text-[20px] leading-tight font-semibold tracking-tight whitespace-nowrap tabular-nums md:mt-1.5 md:text-[28px] md:tracking-normal', ZAHL_FARBE[k.ton ?? 'neutral'])}>
              {k.wert}
            </dd>
            {k.satz && <dd className={cn('mt-0.5 text-[12px] leading-snug', LEISE, !k.satzAmHandy && 'hidden md:block')}>{k.satz}</dd>}
          </div>
        ))}
      </dl>
    </section>
  )
}
