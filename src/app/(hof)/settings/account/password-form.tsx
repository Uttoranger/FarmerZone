'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { validatePassword } from '@/lib/password-rules'
import { changePasswordSchema } from '@/schemas/change-password'
import Link from 'next/link'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Check, Loader2 } from 'lucide-react'
import { useNachSpeichern } from '@/components/hof-einstellungen/use-nach-speichern'
import { HELLER_KNOPF } from '@/components/hof-einstellungen/knopf'
import { FeldFehlerSatz, feldFehlerAttribute } from '@/components/shared/formular-meldungen'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'
import { FELD } from '@/components/hof-bestellungen/stil'

/** Der Satz am Feld „Aktuelles Passwort“, wörtlich nach Board s2-konto-hof Bild 3. */
export const AKTUELLES_PASSWORT_FALSCH = 'Das aktuelle Passwort ist nicht korrekt.'

/*
 * Passwort ändern (Konto und Sicherheit). Seit Nr. 250 (Liste Lauf 32, konto-hof „Passwort falsch“): Ein
 * falsches aktuelles Passwort leert die Felder nicht mehr — der Satz steht am Feld, darunter „Passwort
 * vergessen?“, die neuen Passwörter bleiben stehen (die Regelliste zeigt weiter ihre Haken). Der Knopf ist
 * hell mit Rand über die volle Breite und immer bedienbar; geprüft wird beim Absenden (G6).
 */

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [fehler, setFehler] = useState('')
  // Der Satz am Feld „Aktuelles Passwort“ (falsch oder leer) — getrennt vom Satz über dem Knopf.
  const [aktuellFehler, setAktuellFehler] = useState('')
  const [laedt, setLaedt] = useState(false)
  // Nach dem Speichern zurück zur Übersicht (Register N1, Nr. 44).
  const nachSpeichern = useNachSpeichern()

  const { valid: pwValid, checks } = validatePassword(password)
  const pwHasError = passwordTouched && !pwValid
  const confirmHasError =
    password.length > 0 && passwordConfirm.length > 0 && password !== passwordConfirm
  const canSubmit = !laedt && currentPassword.length > 0 && pwValid && password === passwordConfirm

  function leerePasswortfelder() {
    setCurrentPassword('')
    setPassword('')
    setPasswordConfirm('')
    setPasswordTouched(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (laedt) return
    if (!canSubmit) {
      // Beim Absenden zeigen, was fehlt — statt eines gesperrten Knopfs (G6).
      setPasswordTouched(true)
      // Fehlt das aktuelle Passwort, steht die Meldung des Schemas am Feld — eine Quelle (schemas/change-password.ts).
      const fehltAktuell = changePasswordSchema
        .safeParse({ currentPassword, password, passwordConfirm })
        .error?.issues.find((i) => i.path[0] === 'currentPassword')
      setAktuellFehler(fehltAktuell?.message ?? '')
      return
    }
    setFehler('')
    setAktuellFehler('')

    const parsed = changePasswordSchema.safeParse({ currentPassword, password, passwordConfirm })
    if (!parsed.success) {
      setFehler(parsed.error.issues[0].message)
      return
    }

    setLaedt(true)
    try {
      // revokeOtherSessions: diese Sitzung bleibt eingeloggt, alle anderen
      // Geräte werden abgemeldet
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword: password,
        revokeOtherSessions: true,
      })

      if (error) {
        if (error.status === 429) {
          setFehler('Zu viele Versuche — bitte kurz warten.')
        } else if (!error.status) {
          setFehler('Verbindung fehlgeschlagen — bitte erneut versuchen.')
        } else {
          // Falsches aktuelles Passwort: Satz am Feld, kein Ausloggen; die Eingaben bleiben (Board Bild 3).
          setAktuellFehler(AKTUELLES_PASSWORT_FALSCH)
        }
        return
      }

      leerePasswortfelder()
      // Dass die anderen Geräte abgemeldet sind, bleibt als Zusatz unter „Gespeichert" stehen.
      nachSpeichern('Passwort geändert', 'Andere Geräte wurden abgemeldet.')
    } catch {
      setFehler('Verbindung fehlgeschlagen — bitte erneut versuchen.')
    } finally {
      setLaedt(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="currentPassword" className="text-[15px] font-semibold text-foreground">
          Aktuelles Passwort
        </Label>
        <PasswordInput
          id="currentPassword"
          value={currentPassword}
          onChange={(e) => {
            setCurrentPassword(e.target.value)
            if (aktuellFehler) setAktuellFehler('')
          }}
          autoComplete="current-password"
          required
          {...feldFehlerAttribute('currentPassword', Boolean(aktuellFehler))}
          feld={FELD}
          className={cn(aktuellFehler && 'border-status-offen')}
        />
        <FeldFehlerSatz feldId="currentPassword" text={aktuellFehler} />
        {aktuellFehler === AKTUELLES_PASSWORT_FALSCH && (
          <Link
            href="/forgot-password"
            className={cn('-my-1 inline-flex min-h-11 w-fit items-center text-sm font-semibold text-brand-text underline underline-offset-2', FOKUS_RAHMEN)}
          >
            Passwort vergessen?
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="newPassword" className="text-[15px] font-semibold text-foreground">
          Neues Passwort
        </Label>
        <PasswordInput
          id="newPassword"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          aria-invalid={pwHasError || undefined}
          aria-describedby="account-password-checklist"
          feld={FELD}
          onBlur={() => setPasswordTouched(true)}
        />

        <ul
          id="account-password-checklist"
          aria-label="Passwort-Anforderungen"
          aria-live="polite"
          className="flex flex-col gap-1 mt-0.5"
        >
          {checks.map((check) => (
            <li
              key={check.id}
              className={[
                'flex items-center gap-1.5 text-xs transition-colors duration-150',
                check.passed ? 'text-status-fertig' : 'text-muted-foreground',
              ].join(' ')}
            >
              {check.passed ? (
                <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
              ) : (
                <span className="h-3 w-3 shrink-0 flex items-center justify-center" aria-hidden="true">
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40 block" />
                </span>
              )}
              {check.label}
            </li>
          ))}
        </ul>

        {pwHasError && (
          <p role="alert" aria-live="polite" className="mt-0.5 text-[14px] font-semibold text-status-offen">
            Bitte alle Passwort-Anforderungen erfüllen.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="newPasswordConfirm" className="text-[15px] font-semibold text-foreground">
          Neues Passwort wiederholen
        </Label>
        <PasswordInput
          id="newPasswordConfirm"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          autoComplete="new-password"
          required
          aria-invalid={confirmHasError || undefined}
          aria-describedby={confirmHasError ? 'account-confirm-error' : undefined}
          feld={FELD}
        />
        {confirmHasError && (
          <p
            id="account-confirm-error"
            role="alert"
            aria-live="polite"
            className="text-[14px] font-semibold text-status-offen"
          >
            Passwörter stimmen nicht überein.
          </p>
        )}
      </div>

      {fehler && (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-[12px] border border-zustand-tun/30 bg-zustand-tun-grund px-3 py-2.5 text-[14px] leading-relaxed font-semibold text-zustand-tun"
        >
          {fehler}
        </p>
      )}

      <button type="submit" aria-busy={laedt || undefined} className={HELLER_KNOPF}>
        {laedt ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Speichere…
          </>
        ) : (
          'Passwort ändern'
        )}
      </button>
    </form>
  )
}
