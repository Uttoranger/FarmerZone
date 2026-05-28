'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🌾</div>
          <h1 className="text-2xl font-medium text-slate-800">Bauernshop</h1>
          <p className="text-slate-500 text-sm mt-1">Anmeldung für Bauern</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Anmelden</CardTitle>
            <CardDescription>Mit deiner E-Mail-Adresse und deinem Passwort</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">E-Mail-Adresse</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="bauer@hof-mueller.at"
                  autoComplete="email"
                  required
                  className="h-12 text-base"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Passwort</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="h-12 text-base"
                />
              </div>

              {fehler && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {fehler}
                </p>
              )}

              <Button
                type="submit"
                disabled={laedt}
                className="h-12 text-base bg-green-700 hover:bg-green-800 w-full mt-1"
              >
                {laedt ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Anmelden...
                  </>
                ) : (
                  'Anmelden'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400 mt-6">
          Nur für registrierte Bauern
        </p>
      </div>
    </main>
  )
}
