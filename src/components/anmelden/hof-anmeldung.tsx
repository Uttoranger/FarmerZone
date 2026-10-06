'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FlaskConical, Loader2 } from 'lucide-react'
import { signIn } from '@/lib/auth-client'
import { zielNachHofAnmeldung } from '@/lib/anmeldecode'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { PasswordInput } from '@/components/ui/password-input'
import { FEHLER_TEXT, FELD, FELD_LABEL, KNOPF_ORANGE, TEXTKNOPF } from '@/components/anmelden/stil'

const IS_DEV = process.env.NODE_ENV === 'development'

const DEV_ACCOUNTS = [
  { label: 'Bauer Franz (Hof Müller)', email: 'bauer@example.com', password: 'test1234' },
]

/*
 * Die Hof-Anmeldung mit E-Mail und Passwort (rechte Karte im Mockup
 * web-k0-anmelden-kunde-code-hof-passwort). Verhalten unverändert aus dem
 * bisherigen login-client.tsx übernommen: signIn.email, derselbe Fehlertext,
 * Rückkehr nur nach /teilen (zielNachHofAnmeldung), der Schnellzugang nur in
 * der Entwicklungsumgebung. Neu ist nur die Gestalt.
 */
export function HofAnmeldung(): React.JSX.Element {
  const router = useRouter()
  const emailId = useId()
  const passwortId = useId()
  const fehlerId = useId()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fehler, setFehler] = useState('')
  const [laedt, setLaedt] = useState(false)

  function weiter(): void {
    router.push(zielNachHofAnmeldung(new URLSearchParams(window.location.search).get('von')))
    router.refresh()
  }

  async function quickLogin(devEmail: string, devPassword: string): Promise<void> {
    setLaedt(true)
    setFehler('')
    const { error } = await signIn.email({ email: devEmail, password: devPassword })
    if (error) {
      setFehler('Dev-Login fehlgeschlagen: ' + (error.message ?? 'Unbekannter Fehler'))
      setLaedt(false)
      return
    }
    weiter()
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setLaedt(true)
    setFehler('')

    const { error } = await signIn.email({ email, password })

    if (error) {
      setFehler('E-Mail oder Passwort falsch. Bitte nochmals versuchen.')
      setLaedt(false)
      return
    }
    weiter()
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={emailId} className={FELD_LABEL}>
            E-Mail
          </label>
          <input
            id={emailId}
            type="email"
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

        <div className="flex flex-col gap-1.5">
          <label htmlFor={passwortId} className={FELD_LABEL}>
            Passwort
          </label>
          <PasswordInput
            id={passwortId}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            aria-invalid={fehler ? true : undefined}
            aria-describedby={fehler ? fehlerId : undefined}
            className={cn(FELD, 'pr-10')}
          />
        </div>

        {fehler && (
          <p id={fehlerId} role="alert" aria-live="polite" className={FEHLER_TEXT}>
            {fehler}
          </p>
        )}

        <button type="submit" disabled={laedt} className={KNOPF_ORANGE}>
          {laedt ? (
            <>
              <Loader2 className="size-4 animate-spin" strokeWidth={1.7} aria-hidden="true" />
              Anmelden …
            </>
          ) : (
            'Anmelden'
          )}
        </button>
      </form>

      <div className="flex flex-wrap justify-between gap-x-2">
        <Link href="/forgot-password" className={TEXTKNOPF}>
          Passwort vergessen?
        </Link>
        <Link href="/register" className={TEXTKNOPF}>
          Noch kein Hof? Registrieren
        </Link>
      </div>

      {IS_DEV && (
        <div className="mt-2 rounded-2xl border border-dashed border-border p-4">
          <div className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <FlaskConical className="size-3.5 shrink-0" strokeWidth={1.7} aria-hidden="true" />
            <span>Test-Konten · nur in der Entwicklungsumgebung sichtbar</span>
          </div>
          <div className="flex flex-col gap-2">
            {DEV_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => quickLogin(acc.email, acc.password)}
                disabled={laedt}
                className={cn(
                  'w-full rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted disabled:opacity-50',
                  FOKUS_RAHMEN
                )}
              >
                <span className="text-sm font-medium text-foreground">{acc.label}</span>
                <span className="mt-0.5 block font-mono text-xs text-muted-foreground">{acc.email}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
