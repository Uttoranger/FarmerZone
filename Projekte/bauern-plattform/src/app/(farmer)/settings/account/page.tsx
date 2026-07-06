import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronLeft, Mail, Shield } from 'lucide-react'
import { auth } from '@/lib/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Konto — FarmerZone' }

export default async function AccountPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ChevronLeft className="size-4" />
        Einstellungen
      </Link>

      <h1 className="text-xl font-semibold text-foreground mb-1">Konto</h1>
      <p className="text-sm text-muted-foreground mb-6">Konto-Informationen und Sicherheit.</p>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-primary" />
              <CardTitle>E-Mail-Adresse</CardTitle>
            </div>
            <CardDescription>
              Deine aktuelle Login-E-Mail: <strong>{session.user.email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Um deine E-Mail-Adresse zu ändern, wende dich bitte an den FarmerZone-Support.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-primary" />
              <CardTitle>Passwort</CardTitle>
            </div>
            <CardDescription>Passwort für dein FarmerZone-Konto</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Passwortänderung: Melde dich ab und nutze die Funktion „Passwort vergessen" auf der
              Login-Seite, oder wende dich an den FarmerZone-Support.
            </p>
          </CardContent>
        </Card>

        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700 mb-1">Konto löschen</p>
          <p className="text-xs text-red-600">
            Wenn du dein Konto löschen möchtest, wende dich bitte an den FarmerZone-Support.
            Beachte: Bestelldaten müssen aus steuerrechtlichen Gründen 7 Jahre aufbewahrt werden.
          </p>
        </div>
      </div>
    </div>
  )
}

