import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmSettings, getMeinHofKopf, getOwnerFarm } from '@/server/queries/farm'
import { getAppearanceData } from '@/server/queries/appearance'
import { getActiveStatusPost, getPastStatusCount, getStatusPostsForFarm } from '@/server/queries/status-posts'
import { zaehleBeitraege } from '@/server/queries/mein-hof-zahl'
import { hofseiteFortschritt, hofseiteStand } from '@/lib/hofseite-fortschritt'
import { beitraegeUebersicht } from '@/lib/mein-hof-beitraege'
import { meinHofReiterAus } from '@/lib/bauern-navigation'
import { MEIN_HOF_REITER_PARAMETER } from '@/schemas/mein-hof-reiter'
import { FarmPageClient } from '@/components/farmer/farm-page-client'
import { HofseiteEditor } from '@/components/farmer/hofseite-editor'
import { MeinHofSeitenkopf } from '@/components/mein-hof/seitenkopf'
import { BeitraegeReiter } from '@/components/mein-hof/beitraege-reiter'
import { ChecklisteKompakt } from '@/components/mein-hof/checkliste-kompakt'

export const metadata: Metadata = {
  title: 'Mein Hof — FarmerZone',
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
 * unter lg die Checkliste und die Hofseite mit Stiften (farm-page-client.tsx,
 * funktional unverändert); ab lg die Liste mit Fortschritt und die Vorschau
 * Handy/Web mit „Vergrößern" (hofseite-editor.tsx). Die Vorschau ist immer
 * die echte Hofseite (?vorschau=1), nie ein Nachbau.
 *
 * Reiter „Beiträge" — die Übersicht; bearbeitet wird auf den bestehenden
 * Seiten unter /status (E12: /status bleibt als Route).
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
    const [kopf, beitraege] = await Promise.all([getMeinHofKopf(session.user.id), getStatusPostsForFarm(farm.id)])
    // Der Zeitpunkt für „vor …" einmal hier auf dem Server (CODING_STANDARDS §2).
    const uebersicht = beitraegeUebersicht(beitraege, new Date().toISOString())
    return (
      <div className="mx-auto max-w-3xl px-4 pt-5 pb-12 md:px-8 md:pt-7 lg:max-w-none">
        <MeinHofSeitenkopf hof={kopf} aktiv="beitraege" beitraegeZahl={uebersicht.anzahl} />
        <h1 className="sr-only">Beiträge</h1>
        <BeitraegeReiter uebersicht={uebersicht} />
      </div>
    )
  }

  const [activeStatus, pastStatusCount, kopf, beitraegeZahl, einstellungen, auftritt] = await Promise.all([
    getActiveStatusPost(farm.id),
    getPastStatusCount(farm.id),
    getMeinHofKopf(session.user.id),
    zaehleBeitraege(farm.id),
    getFarmSettings(session.user.id),
    getAppearanceData(session.user.id),
  ])
  if (!einstellungen || !auftritt) redirect('/onboarding')

  const fortschritt = hofseiteFortschritt(hofseiteStand(farm, einstellungen))

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 pt-5 md:px-8 md:pt-7 lg:max-w-none">
        <MeinHofSeitenkopf hof={kopf} aktiv="hofseite" beitraegeZahl={beitraegeZahl} />
      </div>

      {/* Unter lg: Checkliste, darunter die Hofseite mit Stiften. Die
          Überschrift trägt dort die Hofseite selbst (der Hofname). */}
      <div className="lg:hidden">
        <div className="mx-auto max-w-3xl px-4 pb-5 md:px-8">
          <ChecklisteKompakt fortschritt={fortschritt} />
        </div>
        <FarmPageClient farm={farm} activeStatus={activeStatus} pastStatusCount={pastStatusCount} />
      </div>

      {/* Ab lg: Liste links, Vorschau rechts. Nur, was der Editor braucht —
          kein Date und kein Decimal über die Grenze (CODING_STANDARDS §2). */}
      <div className="hidden px-8 pb-12 lg:block">
        {/* Sichtbar ist der Hofname im Kopf; die H1 hört nur der Screenreader. */}
        <h1 className="sr-only">Hofseite bearbeiten</h1>
        <HofseiteEditor
          fortschritt={fortschritt}
          hof={{
            slug: farm.slug,
            name: farm.name,
            adresse: kopf?.adresse.anzeige ?? '',
            logoUrl: farm.logoUrl,
            bannerType: farm.bannerType,
            bannerUrl: farm.bannerUrl,
            bannerValue: farm.bannerValue,
            bannerFocusY: farm.bannerFocusY,
            isPaused: farm.isPaused,
            pauseMessage: farm.pauseMessage,
          }}
          einstellungen={einstellungen}
          auftritt={auftritt}
        />
      </div>
    </>
  )
}
