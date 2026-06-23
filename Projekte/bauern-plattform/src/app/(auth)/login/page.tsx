'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fehler, setFehler] = useState('')
  const [laedt, setLaedt] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLaedt(true)
    setFehler('')

    const { error } = await signIn.email({ email, password })

    if (error) {
      setFehler('E-Mail oder Passwort falsch. Bitte nochmals versuchen.')
      setLaedt(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: 'linear-gradient(160deg, #F4EFE6 0%, #E8F0E8 55%, #FAFAF7 100%)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-5 shadow-[0_4px_16px_oklch(0.38_0.089_150_/_0.3)]">
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
            Willkommen zurück
          </h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            Anmeldung für Hofbetreiber
          </p>
        </div>

        {/* Form card */}
        <div
          className="bg-card rounded-3xl p-6"
          style={{ boxShadow: '0 8px 24px oklch(0.18 0.03 150 / 0.08), 0 2px 6px oklch(0.18 0.03 150 / 0.04)' }}
        >
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

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                Passwort
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="h-11 text-base"
              />
            </div>

            {fehler && (
              <p className="text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-xl px-3 py-2.5 leading-relaxed">
                {fehler}
              </p>
            )}

            <Button
              type="submit"
              disabled={laedt}
              className="h-11 text-sm font-semibold bg-primary text-primary-foreground rounded-xl w-full mt-1"
            >
              {laedt ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Anmelden…
                </>
              ) : (
                'Anmelden'
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Nur für registrierte Hofbetreiber
        </p>
      </div>
    </main>
  )
}
