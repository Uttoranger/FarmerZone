import { formatiereTelefon, telefonLink } from '@/lib/telefon-anzeige'
import { cn } from '@/lib/utils'
import { textlinkKlassen } from '@/components/ui/textlink'
import { ETIKETT, KARTE } from '@/components/bestaetigung/bestaetigung-teile'

/*
 * „Hof erreichen" — EINE Karte für Bestätigungsseite und Bestellseite (Nr. 60; seit Nr. 227 nach den Boards
 * s1-/w1-bestaetigung und s1-/w1-bestellung-link): die kleine Überschrift „HOF ERREICHEN“, darunter zwei
 * grüne Textlinks mit 44 px Trefferfläche (V16) — „<Nummer> anrufen“ (`tel:`) und die Adresse (`mailto:`).
 * Kein eigener Knopf: Beide Seiten haben ihre eine grüne Hauptaktion schon.
 * Telefon und E-Mail des Hofs gibt es erst nach dem Kauf: Beide Seiten lesen sie erst, nachdem die
 * Signatur geprüft ist (S1) — nie über die Bestellnummer.
 *
 * Ohne Nummer bzw. Adresse (die Hof-E-Mail ist im Onboarding freiwillig) entfällt die Zeile; ohne beides
 * die ganze Karte. Die Nummer steht einheitlich da (N8); lässt sie sich nicht lesen (keine Ziffer, zwei
 * Nummern), bleibt die Eingabe sichtbar, aber ohne Link.
 */
export function HofErreichen({ telefon, email }: { telefon: string; email: string }): React.JSX.Element | null {
  if (!telefon && !email) return null
  const anrufen = telefonLink(telefon)
  return (
    <section aria-labelledby="hof-erreichen-titel" className={cn(KARTE, 'flex min-w-0 flex-col gap-1')}>
      <h2 id="hof-erreichen-titel" className={ETIKETT}>
        Hof erreichen
      </h2>
      {telefon &&
        (anrufen ? (
          <a href={anrufen} className={cn(textlinkKlassen(), 'self-start underline')}>
            <span>{formatiereTelefon(telefon)}</span>&nbsp;anrufen
          </a>
        ) : (
          <p className="flex min-h-11 items-center text-[15px] break-words">{formatiereTelefon(telefon)}</p>
        ))}
      {email && (
        // E-Mail-Adressen sind bis 254 Zeichen lang und haben keine Leerzeichen.
        <a href={`mailto:${email}`} className={cn(textlinkKlassen(), 'min-w-0 self-start underline [overflow-wrap:anywhere]')}>
          {email}
        </a>
      )}
    </section>
  )
}
