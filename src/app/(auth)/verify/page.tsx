import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { CircleCheck, MailCheck } from 'lucide-react'
import { auth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { BESTAETIGUNG_GUELTIG_SEKUNDEN } from '@/lib/email-bestaetigung'
import { bestaetigungsTokenSchema } from '@/schemas/email-bestaetigung'
import { ladeBestaetigungsStand, restWartezeitBestaetigung } from '@/server/email-bestaetigung'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { KundeFokusShell } from '@/components/shells/kunde-shell'
import { BestaetigenKarte } from '@/components/email-bestaetigung/bestaetigen-karte'
import { ErneutSendenKnopf } from '@/components/email-bestaetigung/erneut-senden'

export const metadata: Metadata = {
  title: 'E-Mail bestätigen — FarmerZone',
  // Der Link trägt einen gültigen Token (next.config.ts setzt dazu no-referrer).
  robots: { index: false, follow: false },
}

// Liest Sitzung und Stand bei jedem Aufruf — nie zwischenspeichern.
export const dynamic = 'force-dynamic'

const KNOPF_ORANGE = cn(
  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-primary-foreground/30 bg-primary px-[18px] text-[14px] font-semibold text-primary-foreground transition-opacity duration-[250ms] hover:opacity-90',
  FOKUS_RAHMEN
)
const TITEL = 'font-heading text-[22px] leading-tight font-semibold md:text-2xl'
const SATZ = 'mt-1 text-[14px] leading-normal text-muted-foreground'

function Kopf({ erledigt, titel, children }: { erledigt?: boolean; titel: string; children: React.ReactNode }): React.JSX.Element {
  const Symbol = erledigt ? CircleCheck : MailCheck
  return (
    <div className="flex items-start gap-3">
      <Symbol
        className={cn('mt-1 size-6 shrink-0', erledigt ? 'text-status-fertig' : 'text-status-offen')}
        strokeWidth={1.7}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <h2 id="verify-titel" className={TITEL}>
          {titel}
        </h2>
        <div className={SATZ}>{children}</div>
      </div>
    </div>
  )
}

/**
 * „Bestätige deine E-Mail" (S3, Nachtlauf Nr. 17b). Kein Mockup — gebaut nach
 * DESIGN_SYSTEM.md in der Fokus-Shell wie /register (Bericht 17b,
 * Mockup-Abweichungen). Fünf Fälle:
 *  - mit Token (Link aus der Mail): Knopf „E-Mail bestätigen" (POST) —
 *    auch ohne Anmeldung, der Token beweist das Postfach;
 *  - angemeldet, Bestätigung offen: Adresse und „E-Mail erneut senden";
 *  - angemeldet, bestätigt: weiter zum Einrichten;
 *  - angemeldet, Konto vor dem Stichtag: nichts zu tun;
 *  - abgemeldet ohne Token: Weg zur Anmeldung (danach zurück hierher).
 * Der Stand kommt frisch aus der Datenbank (Cookie-Cache, ARCHITECTURE §5).
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<React.JSX.Element> {
  const { token: roh } = await searchParams
  const token = bestaetigungsTokenSchema.safeParse(roh)
  const sitzung = await auth.api.getSession({ headers: await headers() })
  const stand = sitzung?.user ? await ladeBestaetigungsStand(sitzung.user.id) : null
  const rolle = (sitzung?.user as { role?: string } | undefined)?.role
  // Nur wenn die Bestätigung aussteht: wie lange „Erneut senden" noch wartet.
  const warteSekunden = stand?.offen && sitzung?.user ? await restWartezeitBestaetigung(sitzung.user.id) : 0
  const weiter = rolle === 'FARMER' ? { href: '/onboarding', label: 'Weiter zum Einrichten' } : { href: '/', label: 'Zur Startseite' }

  let inhalt: React.ReactNode
  if (token.success) {
    inhalt = <BestaetigenKarte token={token.data} angemeldet={stand !== null} />
  } else if (!stand) {
    inhalt = (
      <section aria-labelledby="verify-titel" className="flex flex-col gap-4">
        <Kopf titel="Bestätige deine E-Mail">
          <p>Öffne den Link aus unserer E-Mail und tippe dort auf „E-Mail bestätigen“.</p>
          <p className="mt-2">Du findest die E-Mail nicht mehr? Melde dich an, dann schicken wir dir den Link noch einmal.</p>
        </Kopf>
        <Link href="/login?von=/verify" className={KNOPF_ORANGE}>
          Anmelden
        </Link>
      </section>
    )
  } else if (stand.emailVerified) {
    inhalt = (
      <section aria-labelledby="verify-titel" className="flex flex-col gap-4">
        <Kopf erledigt titel="Deine E-Mail ist bestätigt">
          <p className="break-words">{stand.email}</p>
        </Kopf>
        <Link href={weiter.href} className={KNOPF_ORANGE}>
          {weiter.label}
        </Link>
      </section>
    )
  } else if (!stand.pflichtig) {
    inhalt = (
      <section aria-labelledby="verify-titel" className="flex flex-col gap-4">
        <Kopf erledigt titel="Hier ist nichts zu tun">
          <p>Dein Konto gab es schon, bevor wir die Bestätigung eingeführt haben. Du kannst alles wie gewohnt nutzen.</p>
        </Kopf>
        <Link href={weiter.href} className={KNOPF_ORANGE}>
          {weiter.label}
        </Link>
      </section>
    )
  } else {
    inhalt = (
      <section aria-labelledby="verify-titel" className="flex flex-col gap-4">
        <Kopf titel="Bestätige deine E-Mail">
          <p>
            Wir haben dir einen Link an <strong className="font-semibold break-all text-foreground">{stand.email}</strong> geschickt.
            Öffne ihn und tippe dort auf „E-Mail bestätigen“.
          </p>
          <p className="mt-2">
            Einrichten kannst du deinen Hof schon jetzt. Fotos hochladen und die Freischaltung gehen, sobald die Adresse bestätigt ist.
          </p>
        </Kopf>
        <ErneutSendenKnopf warteSekunden={warteSekunden} variante="orange" />
        <p className="text-[13px] leading-normal text-muted-foreground">
          Keine E-Mail da? Schau im Spam-Ordner nach. Der Link gilt {BESTAETIGUNG_GUELTIG_SEKUNDEN / 3600} Stunden – danach schick dir einfach einen neuen.
        </p>
      </section>
    )
  }

  return (
    <KundeFokusShell
      titel="E-Mail bestätigen"
      zurueck={stand ? { href: weiter.href, label: weiter.label } : { href: '/', label: 'Zur Startseite' }}
    >
      <div className="mx-auto w-full max-w-[520px] px-4 pt-6 pb-12 md:pt-10">
        <div className="rounded-2xl border border-border bg-card p-5 md:p-6">{inhalt}</div>
      </div>
    </KundeFokusShell>
  )
}
