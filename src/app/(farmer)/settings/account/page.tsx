import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronLeft, Mail, Shield } from 'lucide-react'
import { auth } from '@/lib/auth'
import { getFarmArchiveState } from '@/server/queries/farm'
import { supportMailto } from '@/lib/support'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PasswordForm } from './password-form'
import { ArchiveFarmCard } from './archive-farm-card'

export const metadata: Metadata = { title: 'Konto — FarmerZone' }

export default async function AccountPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmArchiveState(session.user.id)

  // Vorausgefüllte Support-Anfragen: Anliegen, Hof-Slug und Login-Adresse
  // stehen im Textkörper, damit nichts nachgefragt werden muss.
  const emailChangeMailto = supportMailto({
    subject: 'E-Mail-Adresse ändern',
    anliegen: 'Hallo, ich möchte die E-Mail-Adresse meines FarmerZone-Kontos ändern.',
    farmSlug: farm?.slug,
    loginEmail: session.user.email,
  })
  const accountDeleteMailto = supportMailto({
    subject: 'Konto löschen',
    anliegen: 'Hallo, ich möchte mein FarmerZone-Konto löschen lassen.',
    farmSlug: farm?.slug,
    loginEmail: session.user.email,
  })

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
              Um deine E-Mail-Adresse zu ändern,{' '}
              <a
                href={emailChangeMailto}
                className="text-primary underline underline-offset-2 break-words"
              >
                schreib dem FarmerZone-Support
              </a>
              . Die Nachricht ist bereits vorausgefüllt.
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
          <CardContent className="space-y-4">
            <PasswordForm />
            <p className="text-sm text-muted-foreground border-t border-border/50 pt-4">
              Passwort vergessen? Melde dich ab und nutze die Funktion „Passwort vergessen" auf der
              Login-Seite — dann bekommst du einen Link per E-Mail.
            </p>
          </CardContent>
        </Card>

        {farm && <ArchiveFarmCard farmSlug={farm.slug} isArchived={farm.archivedAt !== null} />}

        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700 mb-1">Konto löschen</p>
          <p className="text-xs text-red-600">
            Wenn du dein Konto löschen möchtest,{' '}
            <a
              href={accountDeleteMailto}
              className="font-medium underline underline-offset-2 break-words"
            >
              schreib dem FarmerZone-Support
            </a>
            {' '}— die Nachricht ist bereits vorausgefüllt.
            Die Löschung wird innerhalb weniger Werktage bearbeitet.
            Beachte: Bestelldaten müssen aus steuerrechtlichen Gründen 7 Jahre aufbewahrt werden.
          </p>
          <p className="text-xs text-red-600 mt-2">
            Du willst nur deinen Hofladen schließen, dein Konto aber behalten? Dann nutze oben
            &bdquo;Hof stilllegen&ldquo; — dabei bleiben alle Daten erhalten.
          </p>
        </div>
      </div>
    </div>
  )
}

