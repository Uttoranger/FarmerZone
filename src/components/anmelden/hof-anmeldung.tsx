'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FlaskConical, KeyRound, Loader2 } from 'lucide-react'
import { signIn } from '@/lib/auth-client'
import { anmeldeFehlerVon, passwortZuVieleText, zielNachHofAnmeldung } from '@/lib/anmeldecode'
import { ADMIN_ANMELDEN_TEXT, ADMIN_PFAD } from '@/lib/admin-anmeldung'
import { HOF_PASSKEY_ANMELDEN, hofPasskeyFehlerText } from '@/lib/hof-passkey'
import { NETZ_SATZ, istNetzFehler } from '@/lib/netz'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { PasswordInput } from '@/components/ui/password-input'
import { FEHLER_TEXT, FELD, FELD_LABEL, KNOPF_ORANGE, TEXTKNOPF } from '@/components/anmelden/stil'

const IS_DEV = process.env.NODE_ENV === 'development'

/** „Mit Passkey anmelden" neben dem Passwort: Umriss, damit „Anmelden" die eine Hauptaktion bleibt. */
const KNOPF_PASSKEY = cn(
  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-[18px] text-sm font-semibold text-foreground transition-colors duration-[250ms] hover:bg-muted disabled:opacity-60',
  FOKUS_RAHMEN
)

const DEV_ACCOUNTS = [
  { label: 'Bauer Franz (Hof Müller)', email: 'bauer@example.com', password: 'test1234' },
]

/*
 * Die Hof-Anmeldung mit E-Mail und Passwort (rechte Karte im Mockup
 * web-k0-anmelden-kunde-code-hof-passwort). Verhalten unverändert aus dem
 * bisherigen login-client.tsx übernommen: signIn.email, derselbe Fehlertext,
 * Rückkehr nur geprüft über zielNachHofAnmeldung (/teilen, /verify, seit Nr. 156
 * Pfade des Hofbereichs aus ?von=), der Schnellzugang nur in
 * der Entwicklungsumgebung. Neu ist nur die Gestalt. Die optionale Prop `ziel`
 * (Nr. 157, /verify seit Nr. 164) legt das Ziel nach der Anmeldung fest; ohne sie gilt `?von=`.
 * Seit Nr. 179 (E7, Ergänzung) darunter „Mit Passkey anmelden" für Höfe mit
 * Passkey — ohne E-Mail-Feld, den Rest fragt der Browser; das Passwort bleibt.
 */
export function HofAnmeldung({ ziel }: { ziel?: '/onboarding' | '/verify' } = {}): React.JSX.Element {
  const router = useRouter()
  const emailId = useId()
  const passwortId = useId()
  const fehlerId = useId()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fehler, setFehler] = useState('')
  const [laedt, setLaedt] = useState(false)
  const [passkeyLaeuft, setPasskeyLaeuft] = useState(false)
  // Eigener Satz unter dem Passkey-Knopf: E-Mail und Passwort sind dabei nicht falsch.
  const [passkeyFehler, setPasskeyFehler] = useState('')

  function weiter(): void {
    // `ziel` ist fest im Code gesetzt (Karte nach dem Bestätigen), nie aus der Adresse.
    router.push(ziel ?? zielNachHofAnmeldung(new URLSearchParams(window.location.search).get('von')))
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

  async function mitPasskey(): Promise<void> {
    setPasskeyLaeuft(true)
    setFehler('')
    setPasskeyFehler('')
    try {
      // Der Passkey-Client erst beim Klick: @simplewebauthn/browser gehört nicht in die Anmeldeseite jeder Kundin.
      const { passkeySignIn } = await import('@/lib/auth-client-passkey')
      const { error } = await passkeySignIn.passkey()
      if (error) {
        setPasskeyFehler(hofPasskeyFehlerText(error))
        return
      }
      weiter()
    } catch (err) {
      setPasskeyFehler(istNetzFehler(err) ? NETZ_SATZ : hofPasskeyFehlerText(null))
    } finally {
      setPasskeyLaeuft(false)
    }
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setLaedt(true)
    setFehler('')

    const { error } = await signIn.email({ email, password })

    if (error) {
      // Zu viele falsche Passwörter (E7, Ergänzung; Nr. 112): der Satz mit
      // der Uhrzeit des Pausenendes und dem Ausweg „Passwort vergessen".
      setFehler(passwortZuVieleText(anmeldeFehlerVon(error)) ?? 'E-Mail oder Passwort falsch. Bitte nochmals versuchen.')
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
            feld={FELD}
          />
        </div>

        {fehler && (
          <p id={fehlerId} role="alert" aria-live="polite" className={FEHLER_TEXT}>
            {fehler}
          </p>
        )}

        <button type="submit" disabled={laedt || passkeyLaeuft} className={KNOPF_ORANGE}>
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

      <div className="flex items-center gap-3 text-[12.5px] text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        {HOF_PASSKEY_ANMELDEN.oder}
        <span className="h-px flex-1 bg-border" />
      </div>
      <button type="button" onClick={() => void mitPasskey()} disabled={laedt || passkeyLaeuft} aria-busy={passkeyLaeuft || undefined} className={KNOPF_PASSKEY}>
        {passkeyLaeuft ? (
          <Loader2 className="size-4 animate-spin" strokeWidth={1.7} aria-hidden="true" />
        ) : (
          <KeyRound className="size-4" strokeWidth={1.7} aria-hidden="true" />
        )}
        {passkeyLaeuft ? HOF_PASSKEY_ANMELDEN.laeuft : HOF_PASSKEY_ANMELDEN.knopf}
      </button>
      {passkeyFehler && (
        <p role="alert" aria-live="polite" className={FEHLER_TEXT}>
          {passkeyFehler}
        </p>
      )}

      <div className="flex flex-wrap justify-between gap-x-2">
        <Link href="/forgot-password" className={TEXTKNOPF}>
          Passwort vergessen?
        </Link>
        <Link href="/register" className={TEXTKNOPF}>
          Noch kein Hof? Registrieren
        </Link>
      </div>
      {/* Der kleine Weg für Admin-Konten (Register N20, Nr. 115) — sonst ist /login/admin nirgends verlinkt. */}
      <Link href={ADMIN_PFAD.anmelden} className={cn(TEXTKNOPF, 'self-start text-[13px] font-medium text-muted-foreground')}>
        {ADMIN_ANMELDEN_TEXT.linkAufLogin}
      </Link>

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
