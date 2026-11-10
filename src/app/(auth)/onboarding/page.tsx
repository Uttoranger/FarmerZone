import * as Sentry from '@sentry/nextjs'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { einrichtenStand, vorname } from '@/lib/einrichten'
import { ladeEinrichtenHof } from '@/server/queries/einrichten'
import { ladeBestaetigungsStand, restWartezeitBestaetigung } from '@/server/email-bestaetigung'
import { getOpenOrdersCount } from '@/server/queries/orders'
import { isAdminUser } from '@/server/queries/admin'
import { zaehleZuEntscheiden } from '@/server/queries/meldung'
import { ladeTarifZeile } from '@/server/hofbereich'
import { getFarmBannerState } from '@/server/queries/farm'
import { ladeHofpreisEinstellung, ladePlattformEinstellung } from '@/server/queries/plattform-einstellung'
import { gebuehrModellFuer, hofpreisModellAb } from '@/lib/plattformgebuehr'
import { HofShell } from '@/components/shells/hof-shell'
import { KundeFokusShell } from '@/components/shells/kunde-shell'
import { EinrichtenSeite } from '@/components/einrichten/einrichten-seite'
import { MARKE } from '@/lib/marke'
import { AGB_NEUESTE } from '@/lib/rechtstexte/agb-fassung'
import { agbKartenStichtag, brauchtAgbZustimmung, type AgbKartenStichtag } from '@/lib/agb-zustimmung'
import { hofpreisEinstellungAus } from '@/lib/plattform-einstellung'

export const metadata: Metadata = {
  title: `Hof einrichten — ${MARKE}`,
}

export const dynamic = 'force-dynamic'

/**
 * „Hof einrichten" (Gate 5, Nr. 15; Mockups web-h1-einrichten und
 * mobil-h1-einrichten): sechs Schritte, ihr Stand aus src/lib/einrichten.ts.
 *
 * Bisher führte die Seite einen Hof mit Hof nach /dashboard und war sonst ein
 * Assistent (Hofdaten, Produkte, Abholzeiten). Jetzt:
 *  - ohne Hof: Fokus-Shell (es gibt noch keinen Hof für die Seitenleiste),
 *    Schritt 2 trägt das Formular „Hof anlegen" (createFarm, unverändert);
 *  - mit Hof: HofShell wie im Mockup, die Schritte verlinken in die
 *    bestehenden Seiten (Mein Hof, Produkte, Zahlung). Produkte und
 *    Abholzeiten legt der Hof dort an, nicht mehr im Assistenten — dort gelten
 *    alle Regeln (Kategorie-Pflicht, Abholzeiten-Prüfung).
 *  - seit Lauf 30 (Nr. 228, Boards s2/w2-registrieren) mit Hof die h1 „Hof
 *    einrichten“ und der Warte-Balken je Stand der Schritte (N42 e) — die
 *    HofShell trägt hier keinen Balken aus dem Layout, die Seite setzt ihn.
 *
 * Nur Höfe: Andere Rollen schickt die Seite wie das Bauern-Layout zur
 * Anmeldung — sonst legte ein Kundenkonto hier einen Hof an, den es danach
 * nie erreicht.
 */
export default async function OnboardingPage(): Promise<React.JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')
  const rolle = (session.user as typeof session.user & { role?: string }).role
  if (rolle !== 'FARMER') redirect('/login')

  const jetzt = new Date()
  const [hof, bestaetigung, hofpreis] = await Promise.all([
    ladeEinrichtenHof(session.user.id),
    // S3 (Nr. 17b): frisch aus der Datenbank, nie session.user.emailVerified.
    ladeBestaetigungsStand(session.user.id),
    ladeHofpreisEinstellung(),
  ])
  const emailOffen = bestaetigung?.offen ?? false
  const person = { name: session.user.name ?? '', email: session.user.email ?? '' }
  const stand = einrichtenStand({ personName: person.name, email: person.email, hof, emailOffen })
  // Nr. 207 (§ 104 JN, P2B): Zustimmung zur aktuellen AGB-Fassung — erst mit Hof, nie ein Lockout.
  const fassung = AGB_NEUESTE
  // N45: Der Stichtag für die Karte kommt aus ladePlattformEinstellung (nie aus der stillen Vorgabe von ladeHofpreisEinstellung).
  const agb = hof && brauchtAgbZustimmung(hof, fassung) ? { fassung, geaendert: hof.agbFassung !== null, stichtag: await ladeAgbKartenStichtag(jetzt) } : null
  // Ohne Hof gibt es keinen Balken; stillgelegt zeigt Einrichten wie bisher keinen.
  const banner = hof && !hof.freigeschaltet ? await getFarmBannerState(session.user.id) : null
  const warten = banner && banner.archivedAt === null && banner.approvedAt === null ? { farmId: banner.id, farmName: banner.name, country: banner.country } : null
  const inhalt = (
    <EinrichtenSeite
      gebuehrModell={gebuehrModellFuer(hofpreis, jetzt)}
      kopf={hof ? { hofName: hof.name, warten } : null}
      stand={stand}
      vorname={vorname(person.name)}
      person={person}
      tarif={hof?.tarif ?? null}
      freigeschaltet={hof?.freigeschaltet ?? false}
      agb={agb}
      emailBestaetigung={
        bestaetigung?.offen
          ? { email: bestaetigung.email, warteSekunden: await restWartezeitBestaetigung(session.user.id) }
          : null
      }
    />
  )

  if (!hof) {
    return (
      <KundeFokusShell titel="Hof einrichten" zurueck={{ href: '/', label: 'Zur Startseite' }}>
        {inhalt}
      </KundeFokusShell>
    )
  }

  // Zahlen, Admin-Recht und Tarif-Zeile wie im Bauern-Layout — frisch aus der Datenbank.
  const [offeneBestellungen, isAdmin, tarifZeile] = await Promise.all([
    getOpenOrdersCount(hof.id),
    isAdminUser(session.user.id),
    ladeTarifZeile(hof.id, jetzt),
  ])
  const zuEntscheiden = isAdmin ? await zaehleZuEntscheiden() : 0
  return (
    <HofShell
      hofName={hof.name}
      hofSlug={hof.slug}
      personName={person.name}
      isAdmin={isAdmin}
      zahlen={{ bestellungen: offeneBestellungen, admin: zuEntscheiden }}
      tarifZeile={tarifZeile}
    >
      {inhalt}
    </HofShell>
  )
}

/** Der Stichtag für die Karte „AGB bestätigen“ (N45); bei einem Ladefehler der Satz ohne Datum, gemeldet mit festem Bereich. */
async function ladeAgbKartenStichtag(jetzt: Date): Promise<AgbKartenStichtag> {
  try {
    return agbKartenStichtag(hofpreisModellAb(hofpreisEinstellungAus(await ladePlattformEinstellung())), jetzt)
  } catch (err) {
    Sentry.captureException(err, { tags: { bereich: 'agb-karte-stichtag', seite: 'einrichten' } })
    return agbKartenStichtag(null, jetzt)
  }
}
