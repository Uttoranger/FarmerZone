'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Loader2, MailCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NEUIGKEITEN_TEXT } from '@/lib/abo-bestaetigung'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { ETIKETT, KNOPF_BREIT_RAHMEN } from '@/components/bestaetigung/bestaetigung-stil'
import { meldeNeuigkeitenAn } from '@/server/actions/neuigkeiten'

/**
 * „Neuigkeiten vom Hof per E-Mail" auf der Bestätigungsseite (Register N2,
 * Nachtlauf Nr. 46) — vorher ein Haken in der Kasse. Ein Outline-Knopf: Die
 * Hauptaktion der Seite bleibt „Bestellung ansehen".
 *
 * Mitgeschickt werden nur Bestell-Kennung und Signatur, die ohnehin in der
 * Adresse der Seite stehen. Welche Adresse angemeldet wird, entscheidet der
 * Server aus der Bestellung (meldeNeuigkeitenAn); `email` ist hier nur
 * Anzeige. Der Dank verrät nicht, ob die Adresse schon angemeldet war.
 */
export function NeuigkeitenKarte({
  orderId,
  sig,
  hofName,
  email,
}: {
  orderId: string
  sig: string
  hofName: string
  /**
   * Die Adresse der Bestellung — nur angezeigt, nie zurückgeschickt. Fehlt,
   * sobald die Bestellung abgeschlossen ist (Register S17 Punkt 3, Nr. 153).
   */
  email?: string
}): React.JSX.Element {
  const [laeuft, starte] = useTransition()
  const [stand, setStand] = useState<{ art: 'offen' } | { art: 'danke' } | { art: 'fehler'; text: string }>({ art: 'offen' })

  function anmelden() {
    // Doppelklick-Schutz ohne `disabled` (siehe Knopf).
    if (laeuft) return
    starte(async () => {
      try {
        const antwort = await meldeNeuigkeitenAn({ orderId, sig })
        setStand('ok' in antwort ? { art: 'danke' } : { art: 'fehler', text: antwort.error })
      } catch {
        // Netz weg oder Serverfehler: ein Satz mit Ausweg, die Bestellung bleibt unberührt.
        setStand({ art: 'fehler', text: NEUIGKEITEN_TEXT.fehler })
      }
    })
  }

  return (
    // Board s1-/w1-bestaetigung: die kleine Überschrift, ein Satz, der Knopf mit Rand über die volle Breite. Die
    // Texte der Einwilligung (Satz, Bestätigung, Datenschutz) bleiben wörtlich aus NEUIGKEITEN_TEXT.
    <section aria-labelledby="neuigkeiten-titel" className="flex min-w-0 flex-col gap-2 rounded-2xl border border-border bg-card px-4 py-4 md:px-[18px]">
      <h2 id="neuigkeiten-titel" className={ETIKETT}>
        {NEUIGKEITEN_TEXT.titel}
      </h2>
      <p className="text-[14px] leading-normal break-words text-muted-foreground">
        {NEUIGKEITEN_TEXT.satz[0]} <strong className="font-semibold text-foreground">{hofName}</strong> {NEUIGKEITEN_TEXT.satz[1]}
      </p>

      {/* Dauerhaft im Baum: Eine Live-Region, die erst mit ihrem Text entsteht, sprechen manche Vorleseprogramme nicht. */}
      <p role="status" className={stand.art === 'offen' ? 'sr-only' : 'flex items-start gap-2 text-[13.5px] leading-normal font-medium break-words'}>
        {stand.art === 'danke' && (
          <>
            <MailCheck className="mt-0.5 size-4 shrink-0 text-status-fertig" strokeWidth={1.7} aria-hidden="true" />
            <span>{NEUIGKEITEN_TEXT.danke}</span>
          </>
        )}
        {stand.art === 'fehler' && <span className="text-destructive">{stand.text}</span>}
      </p>

      {stand.art !== 'danke' && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={anmelden}
            aria-busy={laeuft}
            // Nicht `disabled` während der Anfrage: Ein deaktivierter Knopf gibt den Fokus an den Seitenanfang ab.
            className={cn(KNOPF_BREIT_RAHMEN, 'mt-1 aria-busy:opacity-60')}
          >
            {laeuft && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {laeuft ? NEUIGKEITEN_TEXT.laeuft : NEUIGKEITEN_TEXT.knopf}
          </button>
          {/* E-Mail-Adressen sind bis 254 Zeichen lang und haben keine Leerzeichen. */}
          <p className="text-[12.5px] leading-normal [overflow-wrap:anywhere] text-muted-foreground">
            {NEUIGKEITEN_TEXT.bestaetigen[0]} {email ?? 'die Adresse deiner Bestellung'} {NEUIGKEITEN_TEXT.bestaetigen[1]}
          </p>
        </div>
      )}

      <p className="text-[12px] leading-normal text-muted-foreground">
        {NEUIGKEITEN_TEXT.datenschutz}{' '}
        <Link href="/datenschutz" className={cn('rounded-sm text-status-fertig underline underline-offset-2', FOKUS_RAHMEN)}>
          {NEUIGKEITEN_TEXT.datenschutzLink}
        </Link>
        .
      </p>
    </section>
  )
}
