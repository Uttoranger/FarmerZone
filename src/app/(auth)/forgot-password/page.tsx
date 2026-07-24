'use client'

import { useState } from 'react'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, MailCheck } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [fehler, setFehler] = useState('')
  const [laedt, setLaedt] = useState(false)
  const [gesendet, setGesendet] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
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
            Passwort vergessen?
          </h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            Wir schicken dir einen Link zum Zurücksetzen
          </p>
        </div>

        {/* Form card */}
        <div
          className="bg-card rounded-3xl p-6"
          style={{ boxShadow: '0 8px 24px oklch(0.18 0.03 150 / 0.08), 0 2px 6px oklch(0.18 0.03 150 / 0.04)' }}
        >
          {gesendet ? (
            <div className="flex flex-col items-center text-center gap-3 py-2">
              <MailCheck className="size-8 text-primary" aria-hidden="true" />
              <p role="status" aria-live="polite" className="text-sm text-foreground leading-relaxed">
                Falls ein Konto mit dieser E-Mail existiert, haben wir dir einen Link geschickt.
              </p>
              <p className="text-xs text-muted-foreground">
                Der Link ist 1 Stunde gültig. Schau auch im Spam-Ordner nach.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-foreground">
                  E-Mail-Adresse
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="bauer@hof-mueller.at"
                  autoComplete="email"
                  required
                  className="h-11 text-base"
                />
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
                disabled={laedt}
                className="h-11 text-sm font-semibold bg-accent text-accent-foreground hover:bg-accent-hover rounded-xl w-full mt-1"
              >
                {laedt ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sende Link…
                  </>
                ) : (
                  'Link anfordern'
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
