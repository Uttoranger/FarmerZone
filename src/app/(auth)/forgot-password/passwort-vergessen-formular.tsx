'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { PASSWORT_LINK_DAUER_TEXT } from '@/lib/anmeldecode'
import { FEHLER_TEXT, FELD, FELD_LABEL, KNOPF_ORANGE, TEXTLINK } from '@/components/anmelden/stil'
import { ErfolgKasten } from '@/components/ui/erfolg-kasten'

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
        setFehler('Zu viele Versuche – bitte kurz warten.')
        return
      }
      if (error && !error.status) {
        setFehler('Verbindung fehlgeschlagen – bitte erneut versuchen.')
        return
      }
      // Erfolg UND „Konto existiert nicht"-artige Antworten bekommen dieselbe
      // neutrale Meldung — keine Konto-Enumeration über diese Seite
      setGesendet(true)
    } catch {
      setFehler('Verbindung fehlgeschlagen – bitte erneut versuchen.')
    } finally {
      setLaedt(false)
    }
  }

  if (gesendet) {
    return (
      // Grün getönter Kasten mit Haken, links bündig, ein Absatz (Board s2-/w2-passwort, Bild 2);
      // die Antwort bleibt für jede Adresse gleich.
      <ErfolgKasten titel="Schau in deine E-Mails">
        <p role="status" aria-live="polite">
          {`Falls ein Konto mit dieser E-Mail existiert, haben wir dir einen Link geschickt. Der Link ist ${PASSWORT_LINK_DAUER_TEXT} gültig. Schau auch im Spam-Ordner nach.`}
        </p>
        <Link href="/login" className={TEXTLINK}>
          Zurück zur Anmeldung
        </Link>
      </ErfolgKasten>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="font-heading text-[24px] leading-tight font-semibold text-foreground">Passwort vergessen?</h2>
        <p className="mt-1.5 text-[15px] leading-normal text-muted-foreground">Wir schicken dir einen Link zum Zurücksetzen.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={emailId} className={FELD_LABEL}>
            E-Mail
          </label>
          <input
            id={emailId}
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@beispiel.at"
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
    </div>
  )
}
