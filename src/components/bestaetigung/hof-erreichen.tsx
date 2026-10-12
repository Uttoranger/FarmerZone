import { Mail, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { KARTE, KNOPF_RAHMEN } from '@/components/bestaetigung/bestaetigung-teile'

/*
 * „Hof erreichen" — EINE Karte für Bestätigungsseite und Bestellseite (Nr. 60,
 * Mockups web-k4-bestellung-hof-erreichen und mobil-k4-bestellung-hof-erreichen).
 * Telefon und E-Mail des Hofs gibt es erst nach dem Kauf: Beide Seiten lesen
 * sie erst, nachdem die Signatur geprüft ist (S1) — nie über die Bestellnummer.
 *
 * Abweichung vom Mockup: „Anrufen" als Rahmen-Knopf statt grün. Beide Seiten
 * haben schon ihre eine grüne Hauptaktion („Bestellung ansehen" bzw. „Termin
 * in den Kalender"). Die E-Mail-Zeile steht wie im Mockup erst ab 768 px; am
 * Handy führt der Knopf „E-Mail" zu ihr.
 *
 * Ohne Nummer bzw. Adresse (die Hof-E-Mail ist im Onboarding freiwillig)
 * entfallen Zeile und Knopf; ohne beides die ganze Karte.
 */
export function HofErreichen({ telefon, email }: { telefon: string; email: string }): React.JSX.Element | null {
  if (!telefon && !email) return null
  return (
    <section aria-labelledby="hof-erreichen-titel" className={cn(KARTE, 'flex flex-col gap-2.5')}>
      <h2 id="hof-erreichen-titel" className="text-[15px] font-semibold">
        Hof erreichen
      </h2>
      <p className="text-[14px] leading-normal text-muted-foreground">
        Kommst du später oder kannst du nicht kommen? Sag dem Hof kurz Bescheid.
      </p>
      {telefon && (
        <p className="flex items-center gap-2.5 text-[15px] text-foreground">
          <Phone className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
          <span className="min-w-0 break-words">{telefon}</span>
        </p>
      )}
      {email && (
        <p className="hidden items-center gap-2.5 text-[15px] text-foreground md:flex">
          <Mail className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
          {/* E-Mail-Adressen sind bis 254 Zeichen lang und haben keine Leerzeichen. */}
          <span className="min-w-0 [overflow-wrap:anywhere]">{email}</span>
        </p>
      )}
      <div className="flex gap-2">
        {telefon && (
          <a href={`tel:${telefon}`} className={cn(KNOPF_RAHMEN, 'flex-1')}>
            <Phone className="size-4" strokeWidth={1.7} aria-hidden="true" />
            Anrufen
          </a>
        )}
        {email && (
          <a href={`mailto:${email}`} className={cn(KNOPF_RAHMEN, 'flex-1')}>
            <Mail className="size-4" strokeWidth={1.7} aria-hidden="true" />
            E-Mail
          </a>
        )}
      </div>
    </section>
  )
}
