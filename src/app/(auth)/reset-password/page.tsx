'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { validatePassword } from '@/lib/password-rules'
import { resetPasswordSchema } from '@/schemas/reset-password'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Check, Loader2 } from 'lucide-react'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const errorParam = searchParams.get('error')
  // Better Auth leitet bei ungültigem/abgelaufenem Link mit ?error=… hierher
  const linkUngueltig = !token || !!errorParam

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [fehler, setFehler] = useState('')
  const [laedt, setLaedt] = useState(false)
  // Token war beim Absenden ungültig/abgelaufen → wie ein kaputter Link behandeln
  const [tokenVerbraucht, setTokenVerbraucht] = useState(false)

  const { valid: pwValid, checks } = validatePassword(password)
  const pwHasError = passwordTouched && !pwValid
  const confirmHasError =
    password.length > 0 && passwordConfirm.length > 0 && password !== passwordConfirm
  const canSubmit = !laedt && pwValid && password === passwordConfirm

  async function handleSubmit(e: React.FormEvent) {
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

  const zeigeLinkFehler = linkUngueltig || tokenVerbraucht

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: 'linear-gradient(160deg, #F4EFE6 0%, #E8F0E8 55%, #FAFAF7 100%)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-5 shadow-[0_4px_16px_oklch(0.30_0.082_155_/_0.30)]">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path
                d="M16 28 C16 28 6 22 6 13 C6 8 10.5 4 16 4 C21.5 4 26 8 26 13 C26 22 16 28 16 28Z"
                fill="white"
                opacity="0.9"
              />
              <path
                d="M16 28 L16 18"
                stroke="oklch(0.68 0.071 148)"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
              <path
                d="M16 21 C13.5 19.5 10 19 8.5 16"
                stroke="oklch(0.68 0.071 148)"
                strokeWidth="1.25"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            Neues Passwort wählen
          </h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            Für dein FarmerZone-Konto
          </p>
        </div>

        {/* Form card */}
        <div
          className="bg-card rounded-3xl p-6"
          style={{ boxShadow: '0 8px 24px oklch(0.18 0.03 150 / 0.08), 0 2px 6px oklch(0.18 0.03 150 / 0.04)' }}
        >
          {zeigeLinkFehler ? (
            <div className="flex flex-col gap-4">
              <p
                role="alert"
                aria-live="polite"
                className="text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-xl px-3 py-2.5 leading-relaxed"
              >
                Dieser Link ist ungültig oder abgelaufen. Bitte fordere einen neuen Link an.
              </p>
              <Link
                href="/forgot-password"
                className="text-center text-sm text-primary font-medium hover:underline underline-offset-2"
              >
                Neuen Link anfordern
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Password with live checklist */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Neues Passwort
                </Label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mindestens 8 Zeichen"
                  autoComplete="new-password"
                  required
                  aria-invalid={pwHasError || undefined}
                  aria-describedby="password-checklist"
                  className="h-11 text-base"
                  onBlur={() => setPasswordTouched(true)}
                />

                <ul
                  id="password-checklist"
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

              {/* Confirm password */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="passwordConfirm" className="text-sm font-medium text-foreground">
                  Passwort wiederholen
                </Label>
                <PasswordInput
                  id="passwordConfirm"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                  aria-invalid={confirmHasError || undefined}
                  aria-describedby={confirmHasError ? 'confirm-error' : undefined}
                  className="h-11 text-base"
                />
                {confirmHasError && (
                  <p
                    id="confirm-error"
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
                className="h-11 text-sm font-semibold bg-accent text-accent-foreground hover:bg-accent-hover rounded-xl w-full mt-1"
              >
                {laedt ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Speichere…
                  </>
                ) : (
                  'Passwort speichern'
                )}
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Zurück zur{' '}
          <Link href="/login" className="text-primary font-medium hover:underline underline-offset-2">
            Anmeldung
          </Link>
        </p>
      </div>
    </main>
  )
}

export default function ResetPasswordPage() {
  // useSearchParams verlangt beim Prerendern eine Suspense-Grenze
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}
