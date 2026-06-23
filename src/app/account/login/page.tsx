'use client'

import { useState } from 'react'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle } from 'lucide-react'

export default function AccountLoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await authClient.signIn.magicLink({
      email: email.trim().toLowerCase(),
      callbackURL: '/account/profile',
    })

    setLoading(false)

    if (res.error) {
      setError('Fehler beim Senden des Links. Bitte überprüfe deine E-Mail-Adresse.')
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl mb-3">🌱</div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Mein Konto</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verwalte deine Benachrichtigungen von Höfen
          </p>
        </div>

        {sent ? (
          <div className="bg-card rounded-3xl p-8 shadow-[0_4px_16px_oklch(0.18_0.03_150_/_0.08)] text-center">
            <CheckCircle className="w-12 h-12 text-primary mx-auto mb-4" />
            <h2 className="font-heading text-lg font-semibold text-foreground mb-2">
              Login-Link gesendet!
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Wir haben einen Login-Link an <strong>{email}</strong> geschickt.
              <br />
              Bitte prüfe dein Postfach — der Link ist 15 Minuten gültig.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-4">
              Kein E-Mail erhalten?{' '}
              <button
                onClick={() => setSent(false)}
                className="text-primary underline underline-offset-2"
              >
                Erneut senden
              </button>
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-card rounded-3xl p-8 shadow-[0_4px_16px_oklch(0.18_0.03_150_/_0.08)]"
          >
            <div className="mb-5">
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
                Deine E-Mail-Adresse
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="maria@beispiel.at"
                required
                autoFocus
                className="w-full"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive mb-4">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full h-11"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Login-Link senden'
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-4 leading-relaxed">
              Wir senden dir einen einmaligen Link per E-Mail.
              Kein Passwort nötig.
            </p>
          </form>
        )}

        <div className="text-center mt-6">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Zurück zur Startseite
          </Link>
        </div>
      </div>
    </div>
  )
}
