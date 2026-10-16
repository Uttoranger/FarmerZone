import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmSettings, getMeinHofKopf, getOwnerFarm } from '@/server/queries/farm'
import { getAppearanceData } from '@/server/queries/appearance'
import { getStatusPostsForFarm, zaehleWhatsAppAbonnentinnen } from '@/server/queries/status-posts'
import { zaehleBeitraege } from '@/server/queries/mein-hof-zahl'
import { hofseiteFortschritt, hofseiteStand } from '@/lib/hofseite-fortschritt'
import { beitraegeUebersicht } from '@/lib/mein-hof-beitraege'
import { meinHofReiterAus } from '@/lib/bauern-navigation'
import { MEIN_HOF_REITER_PARAMETER } from '@/schemas/mein-hof-reiter'
import { HofseiteEditor } from '@/components/farmer/hofseite-editor'
import { MeinHofSeitenkopf } from '@/components/mein-hof/seitenkopf'
import { BeitraegeReiter } from '@/components/mein-hof/beitraege-reiter'
import { AbschnitteListe } from '@/components/mein-hof/abschnitte-liste'
import type { AbschnittHof } from '@/components/mein-hof/abschnitt-inhalt'
import { MeinHofAnsicht } from '@/components/mein-hof/mein-hof-ansicht'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = {
  title: `Mein Hof — ${MARKE}`,
}

export const dynamic = 'force-dynamic'

/*
 * „Mein Hof" in der HofShell (Gate 5, Nachtlauf Nr. 16; Mockups
 * web-h1-mein-hof-vorschau-handy, web-h1-mein-hof-vorschau-web,
 * web-h1-vorschau-vergroessert, mobil-h1-mein-hof). Reiter Hofseite |
 * Beiträge in der Adresse (?reiter=beitraege, E12).
 *
 * Reiter „Hofseite" — zwei Fassungen, per CSS gewechselt (der Server kennt
 * die Fensterbreite nicht, ein Wechsel im Browser flackerte beim Laden):
 * unter lg seit Nr. 50 (Register N4) die Liste „Bearbeiten" mit Blatt von
 * unten (abschnitte-liste.tsx) — die alte Hofseite mit Stiften ist dort
 * entfallen; ab lg die Liste mit Fortschritt und die Vorschau Handy/Web mit
 * „Vergrößern" (hofseite-editor.tsx). Beide nehmen dieselben Bausteine
 * (abschnitt-inhalt.tsx). Die Vorschau ist immer die echte Hofseite
 * (?vorschau=1), nie ein Nachbau.
 *
 * Reiter „Beiträge" — seit Nr. 22e mit allem, was /status konnte
 * (Deaktivieren, Löschen, Als Vorlage, WhatsApp fortsetzen); /status leitet
 * hierher um, geschrieben wird weiter unter /status/new.
 *
 * Seit Nr. 49 (Register N3/N4) steht unter lg auf beiden Reitern ganz oben
 * unter dem Kopf der Umschalter „Bearbeiten · So sieht’s die Kundin"
 * (MeinHofAnsicht, ?ansicht=kundin); „Bearbeiten" ist der Inhalt darunter.
 * Unter md trägt der Kopf zusätzlich den Reiter „Produkte".
 */
export default async function FarmPageOwnerRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<React.JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getOwnerFarm(session.user.id)
  if (!farm) redirect('/onboarding')

  const reiter = meinHofReiterAus((await searchParams)[MEIN_HOF_REITER_PARAMETER])

  if (reiter === 'beitraege') {
    const [kopf, beitraege, whatsappAbonnentinnen] = await Promise.all([
      getMeinHofKopf(session.user.id),
      getStatusPostsForFarm(farm.id),
      zaehleWhatsAppAbonnentinnen(farm.id),
    ])
    // Der Zeitpunkt für „vor …" einmal hier auf dem Server (CODING_STANDARDS §2),
    // ebenso die heutigen WhatsApp-Abonnentinnen für „WhatsApp · n von m" (W1).
    const uebersicht = beitraegeUebersicht(beitraege, new Date().toISOString(), whatsappAbonnentinnen)
    return (
      <MeinHofAnsicht
        reiter="beitraege"
        slug={farm.slug}
        kopf={
          <div className="mx-auto max-w-3xl px-4 pt-5 md:px-8 md:pt-7 lg:max-w-none">
            <MeinHofSeitenkopf hof={kopf} aktiv="beitraege" beitraegeZahl={uebersicht.anzahl} />
          </div>
        }
      >
        <div className="mx-auto max-w-3xl px-4 pt-5 pb-12 md:px-8 lg:max-w-none lg:pt-0">
          <h1 className="sr-only">Beiträge</h1>
          <BeitraegeReiter uebersicht={uebersicht} />
        </div>
      </MeinHofAnsicht>
    )
  }

  const [kopf, beitraegeZahl, einstellungen, auftritt] = await Promise.all([
    getMeinHofKopf(session.user.id),
    zaehleBeitraege(farm.id),
    getFarmSettings(session.user.id),
    getAppearanceData(session.user.id),
  ])
  if (!einstellungen || !auftritt) redirect('/onboarding')

  const fortschritt = hofseiteFortschritt(hofseiteStand(farm, einstellungen))
  // Nur, was die Bausteine brauchen — kein Date und kein Decimal über die Grenze (CODING_STANDARDS §2).
  const hof: AbschnittHof = {
    slug: farm.slug,
    name: farm.name,
    adresse: kopf?.adresse.anzeige ?? '',
    logoUrl: farm.logoUrl,
    bannerType: farm.bannerType,
    bannerUrl: farm.bannerUrl,
    bannerValue: farm.bannerValue,
    bannerFocusY: farm.bannerFocusY,
    bannerAusschnitt: farm.bannerAusschnitt,
    isPaused: farm.isPaused,
    pauseMessage: farm.pauseMessage,
  }

  return (
    <>
      <MeinHofAnsicht
        reiter="hofseite"
        slug={farm.slug}
        kopf={
          <div className="mx-auto max-w-3xl px-4 pt-5 md:px-8 md:pt-7 lg:max-w-none">
            <MeinHofSeitenkopf hof={kopf} aktiv="hofseite" beitraegeZahl={beitraegeZahl} />
          </div>
        }
      >
        {/* Unter lg, „Bearbeiten": die Liste der Abschnitte, bearbeitet im
            Blatt von unten. Sichtbar ist der Hofname im Kopf; die H1 hört nur
            der Screenreader. */}
        <div className="lg:hidden">
          <div className="mx-auto max-w-3xl px-4 pt-5 pb-12 md:px-8">
            <h1 className="sr-only">Hofseite bearbeiten</h1>
            <AbschnitteListe fortschritt={fortschritt} hof={hof} einstellungen={einstellungen} auftritt={auftritt} />
          </div>
        </div>
      </MeinHofAnsicht>

      {/* Ab lg: Liste links, Vorschau rechts. */}
      <div className="hidden px-8 pb-12 lg:block">
        {/* Sichtbar ist der Hofname im Kopf; die H1 hört nur der Screenreader. */}
        <h1 className="sr-only">Hofseite bearbeiten</h1>
        <HofseiteEditor fortschritt={fortschritt} hof={hof} einstellungen={einstellungen} auftritt={auftritt} />
      </div>
    </>
  )
}
