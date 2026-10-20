'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { Loader2, MailCheck } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { PASSWORT_LINK_DAUER_TEXT } from '@/lib/anmeldecode'
import { cn } from '@/lib/utils'
import { FEHLER_TEXT, FELD, FELD_LABEL, HINWEIS_TEXT, KNOPF_ORANGE, TEXTKNOPF } from '@/components/anmelden/stil'

/**
 * „Passwort vergessen?" — das Formular (seit Nr. 54 in der Fokus-Shell, die
 * Seite rendert sie). Verhalten unverändert aus der bisherigen Seite:
 * `requestPasswordReset` mit Rückkehr auf /reset-password, und Erfolg wie
 * „Konto gibt es nicht" bekommen dieselbe neutrale Antwort — keine
 * Konto-Enumeration über diese Seite. Neu ist nur die Gestalt: die Formen
 * der Hof-Anmeldung (components/anmelden/stil.ts), der Hauptknopf orange
 * (Hof-Aktion: Passwörter haben nur Höfe, Kundinnen melden sich mit Code an).
 */
export function PasswortVergessenFormular(): React.JSX.Element {
  const emailId = useId()
  const fehlerId = useId()
  const [email, setEmail] = useState('')
  const [fehler, setFehler] = useState('')
  const [laedt, setLaedt] = useState(false)
  const [gesendet, setGesendet] = useState(false)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setFehler('')
    setLaedt(true)

    try {
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: '/reset-password',
      })
      if (error?.status === 429) {
        setFehler('Zu viele Versuche — bitte kurz warten.')
        return
      }
      if (error && !error.status) {
        setFehler('Verbindung fehlgeschlagen — bitte erneut versuchen.')
        return
      }
      // Erfolg UND „Konto existiert nicht"-artige Antworten bekommen dieselbe
      // neutrale Meldung — keine Konto-Enumeration über diese Seite
      setGesendet(true)
    } catch {
      setFehler('Verbindung fehlgeschlagen — bitte erneut versuchen.')
    } finally {
      setLaedt(false)
    }
  }

  if (gesendet) {
    return (
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <MailCheck className="size-8 text-status-fertig" strokeWidth={1.7} aria-hidden="true" />
        <p role="status" aria-live="polite" className="text-[14.5px] leading-normal text-foreground">
          Falls ein Konto mit dieser E-Mail existiert, haben wir dir einen Link geschickt.
        </p>
        <p className={HINWEIS_TEXT}>{`Der Link ist ${PASSWORT_LINK_DAUER_TEXT} gültig. Schau auch im Spam-Ordner nach.`}</p>
        <Link href="/login" className={TEXTKNOPF}>
          Zurück zur Anmeldung
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-heading text-[22px] leading-tight font-semibold text-foreground md:text-2xl">Passwort vergessen?</h2>
        <p className="mt-1 text-[14px] leading-normal text-muted-foreground">Wir schicken dir einen Link zum Zurücksetzen.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={emailId} className={FELD_LABEL}>
            E-Mail-Adresse
          </label>
          <input
            id={emailId}
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@hof.at"
            autoComplete="email"
            required
            aria-invalid={fehler ? true : undefined}
            aria-describedby={fehler ? fehlerId : undefined}
            className={FELD}
          />
        </div>

        {fehler && (
          <p id={fehlerId} role="alert" aria-live="polite" className={FEHLER_TEXT}>
            {fehler}
          </p>
        )}

        <button type="submit" disabled={laedt} aria-busy={laedt || undefined} className={KNOPF_ORANGE}>
          {laedt ? (
            <>
              <Loader2 className="size-4 animate-spin" strokeWidth={1.7} aria-hidden="true" />
              Sende Link …
            </>
          ) : (
            'Link anfordern'
          )}
        </button>
      </form>

      <Link href="/login" className={cn(TEXTKNOPF, 'self-center')}>
        Zurück zur Anmeldung
      </Link>
    </div>
  )
}
