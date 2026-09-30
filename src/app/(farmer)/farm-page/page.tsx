import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmSettings, getMeinHofKopf, getOwnerFarm } from '@/server/queries/farm'
import { getAppearanceData } from '@/server/queries/appearance'
import { getActiveStatusPost, getPastStatusCount } from '@/server/queries/status-posts'
import { zaehleBeitraege } from '@/server/queries/mein-hof-zahl'
import { hofseiteFortschritt, hofseiteStand } from '@/lib/hofseite-fortschritt'
import { FarmPageClient } from '@/components/farmer/farm-page-client'
import { HofseiteEditor } from '@/components/farmer/hofseite-editor'
import { MeinHofKopf } from '@/components/farmer/mein-hof-kopf'

export const dynamic = 'force-dynamic'

/*
 * Der Reiter „Hofseite" von Mein Hof. Zwei Fassungen, per CSS gewechselt:
 * Unter lg die Hofseite mit Stiften, unverändert. Ab lg die Liste mit
 * Fortschritt und die Vorschau (hofseite-editor.tsx). Beide stehen im
 * Dokument — der Server kennt die Fensterbreite nicht, und ein Wechsel im
 * Browser flackerte beim Laden.
 */
export default async function FarmPageOwnerRoute() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getOwnerFarm(session.user.id)
  if (!farm) redirect('/onboarding')

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
      {/* Der Kopf von „Mein Hof" — unter lg über der Hofseite, ab lg über der Liste. */}
      <div className="px-4 pt-6 max-w-2xl mx-auto lg:max-w-none lg:px-8">
        <MeinHofKopf hof={kopf} aktiv="hofseite" beitraegeZahl={beitraegeZahl} />
      </div>

      {/* Unter lg: die Hofseite mit Stiften, wie bisher. */}
      <div className="lg:hidden">
        <FarmPageClient farm={farm} activeStatus={activeStatus} pastStatusCount={pastStatusCount} />
      </div>

      {/* Ab lg: Liste links, Vorschau rechts. Nur, was der Editor braucht —
          kein Date und kein Decimal über die Grenze (CODING_STANDARDS §2). */}
      <div className="hidden px-8 pb-12 lg:block">
        {/* Die Überschrift der Seite ab lg — unter lg trägt sie die Hofseite selbst.
            Sichtbar ist der Hofname im Kopf; die H1 hört nur der Screenreader. */}
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
