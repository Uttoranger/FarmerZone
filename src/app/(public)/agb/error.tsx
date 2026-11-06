'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { FEHLER_HAUPT, FEHLER_UMRISS, FehlerseiteAufbau } from '@/components/shared/fehler-ansicht'
import { FEHLER_KNOPF_TON, NOCHMAL_VERSUCHEN, fehlerKicker } from '@/lib/fehlerseite'
import { AGB_FASSUNGEN, agbFassungPfad } from '@/lib/rechtstexte/agb-fassung'
import { AGB_SEITE_TEXT } from '@/lib/rechtstexte/agb-einbindung'

/**
 * Fehlerseite von /agb (N45, A005 4a): Lässt sich der Stichtag nicht laden,
 * steht nie eine Fassung da, deren Geltung niemand geprüft hat — sondern der
 * Satz „Die AGB lassen sich gerade nicht laden.“ mit den Wegen zu beiden
 * Fassungen (/agb/1.0, /agb/0.9) und „Nochmal versuchen“. Der Aufbau ist der
 * gemeinsame der Fehlerseiten (FehlerseiteAufbau, Nr. 231), in der KundeShell
 * wie die 500 (src/app/error.tsx). Gemeldet wird von hier — eine React-
 * Fehlergrenze erreicht Sentry sonst nicht von selbst.
 */
export default function AgbFehler({ error, reset }: { error: Error & { digest?: string }; reset: () => void }): React.JSX.Element {
  useEffect(() => {
    Sentry.captureException(error, { tags: { bereich: 'agb-seite' } })
  }, [error])

  return (
    <KundeShellMitSitzung>
      <div data-design="neu" className="flex min-h-[70dvh] items-center justify-center bg-background px-6 py-12 text-foreground">
        <FehlerseiteAufbau zeichen="warnung" kicker={fehlerKicker(error.digest)} titel={AGB_SEITE_TEXT.fehlerTitel} text={AGB_SEITE_TEXT.fehlerText}>
          <button type="button" onClick={reset} className={FEHLER_HAUPT[FEHLER_KNOPF_TON.kunde]}>
            {NOCHMAL_VERSUCHEN}
          </button>
          {/* Neueste zuerst; ein gewöhnliches <a>: Der Vollaufbau verlässt den zerbrochenen Baum (wie FehlerAnsicht). */}
          {[...AGB_FASSUNGEN].reverse().map((kennung) => (
            <a key={kennung} href={agbFassungPfad(kennung)} className={FEHLER_UMRISS}>
              {AGB_SEITE_TEXT.fassung(kennung)}
            </a>
          ))}
        </FehlerseiteAufbau>
      </div>
    </KundeShellMitSitzung>
  )
}
