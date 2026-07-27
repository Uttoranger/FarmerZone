'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { validatePassword } from '@/lib/password-rules'
import { changePasswordSchema } from '@/schemas/change-password'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Check, Loader2 } from 'lucide-react'

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [fehler, setFehler] = useState('')
  const [laedt, setLaedt] = useState(false)

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
    if (!canSubmit) return
    setFehler('')

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
          // Falsches aktuelles Passwort: Meldung am Formular, kein Ausloggen
          setFehler('Das aktuelle Passwort ist nicht korrekt.')
          leerePasswortfelder()
        }
        return
      }

      toast.success('Passwort geändert — andere Geräte wurden abgemeldet.')
      leerePasswortfelder()
    } catch {
      setFehler('Verbindung fehlgeschlagen — bitte erneut versuchen.')
    } finally {
      setLaedt(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="currentPassword" className="text-sm font-medium text-foreground">
          Aktuelles Passwort
        </Label>
        <PasswordInput
          id="currentPassword"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="h-11 text-base"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="newPassword" className="text-sm font-medium text-foreground">
          Neues Passwort
        </Label>
        <PasswordInput
          id="newPassword"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mindestens 8 Zeichen"
          autoComplete="new-password"
          required
          aria-invalid={pwHasError || undefined}
          aria-describedby="account-password-checklist"
          className="h-11 text-base"
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
                check.passed ? 'text-emerald-600' : 'text-muted-foreground',
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
          <p role="alert" aria-live="polite" className="text-xs text-destructive mt-0.5">
            Bitte alle Passwort-Anforderungen erfüllen.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="newPasswordConfirm" className="text-sm font-medium text-foreground">
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
          className="h-11 text-base"
        />
        {confirmHasError && (
          <p
            id="account-confirm-error"
            role="alert"
            aria-live="polite"
            className="text-xs text-destructive"
          >
            Passwörter stimmen nicht überein.
          </p>
        )}
      </div>

      {fehler && (
        <p
          role="alert"
          aria-live="polite"
          className="text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-xl px-3 py-2.5 leading-relaxed"
        >
          {fehler}
        </p>
      )}

      <Button
        type="submit"
        disabled={!canSubmit}
        className="h-11 text-sm font-semibold rounded-xl w-full sm:w-auto sm:self-start sm:px-6"
      >
        {laedt ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Speichere…
          </>
        ) : (
          'Passwort ändern'
        )}
      </Button>
    </form>
  )
}
