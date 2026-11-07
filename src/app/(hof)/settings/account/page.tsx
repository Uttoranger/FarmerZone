import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { verlangeHofDerSitzung, zurHofAnmeldung } from '@/server/hofbereich'
import { getFarmArchiveState } from '@/server/queries/farm'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getOpenOrdersCount } from '@/server/queries/orders'
import { ladeAngemeldeteGeraete } from '@/server/geraete'
import { AngemeldeteGeraete } from '@/components/konto/angemeldete-geraete'
import { supportMailto } from '@/lib/support'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { WerkzeugKopf } from '@/components/ui/werkzeug-kopf'
import { HofUnterzeile } from '@/components/mein-hof/hof-unterzeile'
import { HELLER_KNOPF } from '@/components/hof-einstellungen/knopf'
import { EINSTELLUNG_KONTO } from '@/lib/bauern-navigation'
import { UNTERSEITE_RAHMEN } from '@/components/hof-einstellungen/einstellungen-laden'
import { KONTO_TEXT } from '@/lib/hof-einstellungen'
import { PasswordForm } from './password-form'
import { ArchiveFarmCard } from './archive-farm-card'
import { DarstellungKarte } from './darstellung-karte'
import { MARKE } from '@/lib/marke'
import { SITZUNG_DAUER_SATZ } from '@/lib/sitzung-dauer'
import { prisma } from '@/lib/prisma'
import { passkeyAnzeigeName } from '@/lib/hof-passkey'
import { PasskeyKarte, type HofPasskeyZeile } from './passkey-karte'

export const metadata: Metadata = { title: `${EINSTELLUNG_KONTO.label} — ${MARKE}` }

/** Der Satz unter dem Kopf, wörtlich nach Board s2-/w2-konto-hof. */
const KONTO_SATZ = 'Anmeldung, Passwort, Geräte, Darstellung und dein Hof.'

/** Links im Fließtext: grüner Text (Hof-Links wie im Editor), nie oranger Text. */
const TEXTLINK = 'font-medium text-brand-text underline underline-offset-2 break-words'

/*
 * Konto und Sicherheit in der HofShell (Nachtlauf Nr. 22d). Gleiches
 * Verhalten: Passwort ändern über Better Auth (meldet andere Geräte ab),
 * E-Mail ändern und Konto löschen nur über die vorausgefüllte Support-Mail,
 * Hof stilllegen/reaktivieren über die bestehenden Actions mit Sperre bei
 * offenen Bestellungen. Neu sind nur Kopf, Rahmen und Farben (Tokens).
 * Seit Nr. 114 (E7, Ergänzung) nach dem Passwort die angemeldeten Geräte.
 * Seit Nr. 179 (E7, Ergänzung 25.10.2026) oben die Karte „Anmelden mit
 * Fingerabdruck oder Gesicht" (Passkey für Höfe; ein Admin mit Hof sieht nur
 * den Weg in den Admin-Bereich, N20).
 */
export default async function AccountPage(): Promise<React.JSX.Element> {
  const { userId, farmId } = await verlangeHofDerSitzung()
  // Login-Adresse und Kennung dieser Sitzung (Geräte) braucht nur diese Seite —
  // die Wache gibt bewusst nur userId und farmId heraus.
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return zurHofAnmeldung()

  const jetzt = new Date()
  // Offene Bestellungen mit derselben Zählung wie der Server beim Stilllegen (getOpenOrdersCount in
  // archiveFarm): Solange welche da sind, steht der Hinweis statt des Knopfs (Liste Lauf 32, konto-hof).
  const [farm, geraete, konto, hof, offeneBestellungen] = await Promise.all([
    getFarmArchiveState(userId),
    ladeAngemeldeteGeraete(userId, session.session.id, jetzt),
    prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true, passkeys: { select: { id: true, name: true, createdAt: true }, orderBy: { createdAt: 'asc' } } },
    }),
    // Der Hofname der Unterzeile — dieselbe Abfrage, die das Layout stellt.
    getFarmForUser(userId),
    getOpenOrdersCount(farmId),
  ])
  const fuerAdmin = konto?.isAdmin === true
  // Ein Admin verwaltet seine Passkeys im Admin-Bereich — hier keine Liste.
  const passkeys: HofPasskeyZeile[] = fuerAdmin
    ? []
    : (konto?.passkeys ?? []).map((p) => ({ id: p.id, name: p.name ?? '', anzeige: passkeyAnzeigeName(p.name, p.createdAt) }))

  // Vorausgefüllte Support-Anfragen: Anliegen, Hof-Slug und Login-Adresse
  // stehen im Textkörper, damit nichts nachgefragt werden muss.
  const emailChangeMailto = supportMailto({
    subject: 'E-Mail-Adresse ändern',
    anliegen: `Hallo, ich möchte die E-Mail-Adresse meines ${MARKE}-Kontos ändern.`,
    farmSlug: farm?.slug,
    loginEmail: session.user.email,
  })
  const accountDeleteMailto = supportMailto({
    subject: 'Konto löschen',
    anliegen: `Hallo, ich möchte mein ${MARKE}-Konto löschen lassen.`,
    farmSlug: farm?.slug,
    loginEmail: session.user.email,
  })

  return (
    <div className={UNTERSEITE_RAHMEN}>
      {/* Werkzeug-Kopf (G1) mit der Hof-Unterzeile; der Satz steht darunter (Board s2-/w2-konto-hof). */}
      <WerkzeugKopf titel={EINSTELLUNG_KONTO.label} unterzeile={hof ? <HofUnterzeile hofName={hof.name} jetzt={jetzt} /> : undefined} />
      <p className="mb-5 text-[15px] leading-relaxed text-muted-foreground md:mb-6 md:text-base">{KONTO_SATZ}</p>

      <div data-app-palette="neu" className="space-y-4">
        <PasskeyKarte passkeys={passkeys} fuerAdmin={fuerAdmin} />

        {/* Ohne Symbole vor den Überschriften und ohne Unterzeile (Liste Lauf 32, konto-hof). */}
        <Card>
          <CardHeader>
            <CardTitle>{KONTO_TEXT.anmeldeAdresseTitel}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Die Adresse in eigener Zeile, fett (Board s2-konto-hof Bild 1). */}
            <div className="text-sm">
              <p className="text-muted-foreground">{KONTO_TEXT.anmeldeAdresse}</p>
              <p className="font-bold break-all text-foreground">{session.user.email}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              {KONTO_TEXT.anmeldeAdresseAendern}{' '}
              <a href={emailChangeMailto} className={TEXTLINK}>
                schreib dem {MARKE}-Support
              </a>
              {KONTO_TEXT.anmeldeAdresseNach}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{KONTO_TEXT.passwortTitel}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <PasswordForm />
            <p className="text-sm text-muted-foreground">
              Passwort vergessen? Melde dich ab und nutze &bdquo;Passwort vergessen&ldquo; auf der Anmeldeseite – dann bekommst du
              einen Link per E-Mail.
            </p>
          </CardContent>
        </Card>

        {/* Höchstdauer der Sitzung in einem Satz (S18, Nr. 178). */}
        <AngemeldeteGeraete zeilen={geraete} satz={SITZUNG_DAUER_SATZ} />

        <DarstellungKarte />

        {farm && <ArchiveFarmCard farmSlug={farm.slug} isArchived={farm.archivedAt !== null} offeneBestellungen={offeneBestellungen} />}

        {/* Konto löschen wörtlich nach Board, Knopf „Support schreiben“ statt Textlink (Liste Lauf 32, konto-hof). */}
        <Card>
          <CardHeader>
            <CardTitle>{KONTO_TEXT.loeschenTitel}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{KONTO_TEXT.loeschenSatz}</p>
            <a href={accountDeleteMailto} className={HELLER_KNOPF}>
              {KONTO_TEXT.loeschenKnopf}
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
