import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { Mail, Shield, Trash2 } from 'lucide-react'
import { auth } from '@/lib/auth'
import { getFarmArchiveState } from '@/server/queries/farm'
import { supportMailto } from '@/lib/support'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { UnterseitenKopf } from '@/components/hofbereich/unterseiten-kopf'
import { EINSTELLUNG_KONTO } from '@/lib/bauern-navigation'
import { UNTERSEITE_RAHMEN } from '@/components/hof-einstellungen/einstellungen-laden'
import { PasswordForm } from './password-form'
import { ArchiveFarmCard } from './archive-farm-card'
import { DarstellungKarte } from './darstellung-karte'

export const metadata: Metadata = { title: `${EINSTELLUNG_KONTO.label} — FarmerZone` }

/** Links im Fließtext: grüner Text (Hof-Links wie im Editor), nie oranger Text. */
const TEXTLINK = 'font-medium text-brand-text underline underline-offset-2 break-words'

/*
 * Konto und Sicherheit in der HofShell (Nachtlauf Nr. 22d). Gleiches
 * Verhalten: Passwort ändern über Better Auth (meldet andere Geräte ab),
 * E-Mail ändern und Konto löschen nur über die vorausgefüllte Support-Mail,
 * Hof stilllegen/reaktivieren über die bestehenden Actions mit Sperre bei
 * offenen Bestellungen. Neu sind nur Kopf, Rahmen und Farben (Tokens).
 */
export default async function AccountPage(): Promise<React.JSX.Element> {
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
    <div className={UNTERSEITE_RAHMEN}>
      <UnterseitenKopf titel={EINSTELLUNG_KONTO.label} satz="Anmeldung, Passwort, Darstellung und dein Hof." />

      <div data-app-palette="neu" className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
              <CardTitle>E-Mail-Adresse</CardTitle>
            </div>
            <CardDescription>
              Deine aktuelle Login-E-Mail: <strong className="break-all text-foreground">{session.user.email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Um deine E-Mail-Adresse zu ändern,{' '}
              <a href={emailChangeMailto} className={TEXTLINK}>
                schreib dem FarmerZone-Support
              </a>
              . Die Nachricht ist bereits vorausgefüllt.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
              <CardTitle>Passwort</CardTitle>
            </div>
            <CardDescription>Passwort für dein FarmerZone-Konto</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PasswordForm />
            <p className="border-t border-border pt-4 text-sm text-muted-foreground">
              Passwort vergessen? Melde dich ab und nutze &bdquo;Passwort vergessen&ldquo; auf der Anmeldeseite — dann bekommst du
              einen Link per E-Mail.
            </p>
          </CardContent>
        </Card>

        <DarstellungKarte />

        {farm && <ArchiveFarmCard farmSlug={farm.slug} isArchived={farm.archivedAt !== null} />}

        <Hinweiskarte ton="orange" symbol={Trash2} titel="Konto löschen">
          <p>
            Wenn du dein Konto löschen möchtest,{' '}
            <a href={accountDeleteMailto} className="font-semibold underline underline-offset-2 break-words">
              schreib dem FarmerZone-Support
            </a>{' '}
            — die Nachricht ist bereits vorausgefüllt. Die Löschung wird innerhalb weniger Werktage bearbeitet.
            Beachte: Bestelldaten müssen aus steuerrechtlichen Gründen 7 Jahre aufbewahrt werden.
          </p>
          <p className="mt-2">
            Du willst nur deinen Hofladen schließen, dein Konto aber behalten? Dann nutze oben &bdquo;Hof
            stilllegen&ldquo; — dabei bleiben alle Daten erhalten.
          </p>
        </Hinweiskarte>
      </div>
    </div>
  )
}
