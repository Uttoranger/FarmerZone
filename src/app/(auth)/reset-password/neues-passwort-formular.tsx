'use client'

import { useId, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Check, CircleAlert, Loader2 } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { validatePassword } from '@/lib/password-rules'
import { resetPasswordSchema } from '@/schemas/reset-password'
import { cn } from '@/lib/utils'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { PasswordInput } from '@/components/ui/password-input'
import { KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { FEHLER_TEXT, FELD, FELD_LABEL, KNOPF_ORANGE } from '@/components/anmelden/stil'

/**
 * „Neues Passwort wählen" — das Formular (seit Nr. 54 in der Fokus-Shell, die
 * Seite rendert sie). Verhalten unverändert aus der bisherigen Seite: Der
 * Token kommt aus der Adresse (?token=), Better Auth leitet bei ungültigem
 * oder abgelaufenem Link mit ?error=… hierher, geprüft wird er erst beim
 * Speichern (`authClient.resetPassword`). Der Token geht nirgends sonst hin —
 * kein Log, kein Link; die Seite trägt no-referrer und noindex (Header in
 * next.config.ts, Metadaten der Seite). Neu ist nur die Gestalt: die Formen
 * der Hof-Anmeldung, Haken grün, der Hauptknopf orange (Hof-Aktion).
 */
export function NeuesPasswortFormular(): React.JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const errorParam = searchParams.get('error')
  // Better Auth leitet bei ungültigem/abgelaufenem Link mit ?error=… hierher
  const linkUngueltig = !token || !!errorParam

  const passwortId = useId()
  const wiederholungId = useId()
  const listeId = useId()
  const wiederholungFehlerId = useId()

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [fehler, setFehler] = useState('')
  const [laedt, setLaedt] = useState(false)
  // Token war beim Absenden ungültig/abgelaufen → wie ein kaputter Link behandeln
  const [tokenVerbraucht, setTokenVerbraucht] = useState(false)

  const { valid: pwValid, checks } = validatePassword(password)
  const pwHasError = passwordTouched && !pwValid
  const confirmHasError = password.length > 0 && passwordConfirm.length > 0 && password !== passwordConfirm
  const canSubmit = !laedt && pwValid && password === passwordConfirm

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!canSubmit || !token) return
    setFehler('')

    const parsed = resetPasswordSchema.safeParse({ password, passwordConfirm })
    if (!parsed.success) {
      setFehler(parsed.error.issues[0].message)
      return
    }

    setLaedt(true)
    try {
      const { error } = await authClient.resetPassword({ newPassword: password, token })
      if (error) {
        setTokenVerbraucht(true)
        return
      }
      toast.success('Passwort geändert — du kannst dich jetzt anmelden.')
      router.push('/login')
    } catch {
      setFehler('Verbindung fehlgeschlagen — bitte erneut versuchen.')
    } finally {
      setLaedt(false)
    }
  }

  if (linkUngueltig || tokenVerbraucht) {
    return (
      <div role="alert">
        <Hinweiskarte
          ton="orange"
          symbol={CircleAlert}
          titel="Dieser Link ist ungültig oder abgelaufen."
          aktion={
            <Link href="/forgot-password" className={KNOPF_RAHMEN}>
              Neuen Link anfordern
            </Link>
          }
        >
          Bitte fordere einen neuen Link an.
        </Hinweiskarte>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={passwortId} className={FELD_LABEL}>
          Neues Passwort
        </label>
        <PasswordInput
          id={passwortId}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mindestens 8 Zeichen"
          autoComplete="new-password"
          required
          aria-invalid={pwHasError || undefined}
          aria-describedby={listeId}
          className={cn(FELD, 'pr-10')}
          onBlur={() => setPasswordTouched(true)}
        />

        <ul id={listeId} aria-label="Passwort-Anforderungen" aria-live="polite" className="mt-0.5 flex flex-col gap-1">
          {checks.map((check) => (
            <li
              key={check.id}
              className={cn(
                'flex items-center gap-1.5 text-[12.5px] transition-colors duration-150',
                check.passed ? 'text-status-fertig' : 'text-muted-foreground'
              )}
            >
              {check.passed ? (
                <Check className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
              ) : (
                <span className="flex size-3.5 shrink-0 items-center justify-center" aria-hidden="true">
                  <span className="block size-1.5 rounded-full bg-current opacity-60" />
                </span>
              )}
              {check.label}
            </li>
          ))}
        </ul>

        {pwHasError && (
          <p role="alert" aria-live="polite" className={cn(FEHLER_TEXT, 'mt-0.5')}>
            Bitte alle Passwort-Anforderungen erfüllen.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={wiederholungId} className={FELD_LABEL}>
          Passwort wiederholen
        </label>
        <PasswordInput
          id={wiederholungId}
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          autoComplete="new-password"
          required
          aria-invalid={confirmHasError || undefined}
          aria-describedby={confirmHasError ? wiederholungFehlerId : undefined}
          className={cn(FELD, 'pr-10')}
        />
        {confirmHasError && (
          <p id={wiederholungFehlerId} role="alert" aria-live="polite" className={FEHLER_TEXT}>
            Passwörter stimmen nicht überein.
          </p>
        )}
      </div>

      {fehler && (
        <p role="alert" aria-live="polite" className={FEHLER_TEXT}>
          {fehler}
        </p>
      )}

      <button type="submit" disabled={!canSubmit} aria-busy={laedt || undefined} className={cn(KNOPF_ORANGE, 'mt-1')}>
        {laedt ? (
          <>
            <Loader2 className="size-4 animate-spin" strokeWidth={1.7} aria-hidden="true" />
            Speichere …
          </>
        ) : (
          'Passwort speichern'
        )}
      </button>
    </form>
  )
}
