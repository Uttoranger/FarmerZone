import type { Metadata } from 'next'
import * as Sentry from '@sentry/nextjs'
import { redirect } from 'next/navigation'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import { getFarmSettings, getMeinHofKopf, getOwnerFarm } from '@/server/queries/farm'
import { getAppearanceData } from '@/server/queries/appearance'
import { getStatusPostsForFarm, zaehleWhatsAppAbonnentinnen } from '@/server/queries/status-posts'
import { ladeMeinHofZustand } from '@/server/mein-hof-zustand'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'
import { ladeLaufendenBeitrag } from '@/server/queries/dashboard'
import { aktuellZeile } from '@/lib/mein-hof-ansicht'
import { hofseiteFortschritt, hofseiteStand } from '@/lib/hofseite-fortschritt'
import { beitraegeUebersicht } from '@/lib/mein-hof-beitraege'
import { meinHofReiterAus } from '@/lib/bauern-navigation'
import { MEIN_HOF_REITER_PARAMETER } from '@/schemas/mein-hof-reiter'
import { HofseiteEditor } from '@/components/farmer/hofseite-editor'
import { MeinHofSeitenkopf } from '@/components/mein-hof/seitenkopf'
import { MEIN_HOF_KOPF_HUELLE } from '@/components/mein-hof/mein-hof-kopf'
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
 *
 * Seit Nr. 143 (Register N3, Ergänzung 22.10.2026) ist der Kopf unter lg auf
 * beiden Reitern derselbe wie auf /products (mein-hof-kopf.tsx, gleiche Hülle):
 * Titelbild-Streifen, Zustandszeile aus ladeMeinHofZustand, Reiter. Vorher geben
 * verwaiste Bestellungen ihren Platz frei — sonst stünde ein Fenster als voll da,
 * das die Kasse annimmt.
 */
export default async function FarmPageOwnerRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<React.JSX.Element> {
  const { userId } = await verlangeHofDerSitzung()

  const farm = await getOwnerFarm(userId)
  if (!farm) redirect('/onboarding')

  const reiter = meinHofReiterAus((await searchParams)[MEIN_HOF_REITER_PARAMETER])
  // Frist gilt beim Lesen (src/lib/fristen.ts): erst freigeben, dann zählen (ladeMeinHofZustand).
  await gibVerwaisteFreiOhneRisiko(farm.id)
  const jetzt = new Date()

  if (reiter === 'beitraege') {
    const [kopf, zustand, beitraege, whatsappAbonnentinnen] = await Promise.all([
      getMeinHofKopf(userId),
      ladeMeinHofZustand(farm.id, jetzt),
      getStatusPostsForFarm(farm.id),
      zaehleWhatsAppAbonnentinnen(farm.id),
    ])
    // Der Zeitpunkt für „vor …" einmal hier auf dem Server (CODING_STANDARDS §2),
    // ebenso die heutigen WhatsApp-Abonnentinnen für „WhatsApp · n von m" (W1).
    const uebersicht = beitraegeUebersicht(beitraege, jetzt.toISOString(), whatsappAbonnentinnen)
    return (
      <MeinHofAnsicht
        reiter="beitraege"
        slug={farm.slug}
        kopf={
          <div className={MEIN_HOF_KOPF_HUELLE}>
            <MeinHofSeitenkopf hof={kopf} aktiv="beitraege" zustand={zustand} />
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

  const [kopf, zustand, einstellungen, auftritt, laufend] = await Promise.all([
    getMeinHofKopf(userId),
    ladeMeinHofZustand(farm.id, jetzt),
    getFarmSettings(userId),
    getAppearanceData(userId),
    // „Aktuell vom Hof“ als erste Zeile (Register E12, Nr. 129): nur der laufende Beitrag, nicht die
    // Abfragen für den Anstoß in Heute. Ein Ladefehler nimmt nur die Zeile weg, nie Mein Hof.
    ladeLaufendenBeitrag(farm.id, jetzt).catch((err: unknown) => {
      Sentry.captureException(err, { tags: { bereich: 'dein-beitrag', seite: 'mein-hof' }, extra: { farmId: farm.id } })
      return undefined
    }),
  ])
  if (!einstellungen || !auftritt) redirect('/onboarding')
  // Ohne Daten (Fehler) keine Zeile — „Kein Beitrag“ wäre dann falsch; null heißt: kein laufender Beitrag.
  const aktuell = laufend === undefined ? undefined : aktuellZeile(laufend, jetzt)

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
          <div className={MEIN_HOF_KOPF_HUELLE}>
            <MeinHofSeitenkopf hof={kopf} aktiv="hofseite" zustand={zustand} />
          </div>
        }
      >
        {/* Unter lg, „Bearbeiten": die Liste der Abschnitte, bearbeitet im
            Blatt von unten. Sichtbar ist der Hofname im Kopf; die H1 hört nur
            der Screenreader. */}
        <div className="lg:hidden">
          <div className="mx-auto max-w-3xl px-4 pt-5 pb-12 md:px-8">
            <h1 className="sr-only">Hofseite bearbeiten</h1>
            <AbschnitteListe fortschritt={fortschritt} hof={hof} einstellungen={einstellungen} auftritt={auftritt} aktuell={aktuell} />
          </div>
        </div>
      </MeinHofAnsicht>

      {/* Ab lg: Liste links, Vorschau rechts. */}
      <div className="hidden px-8 pb-12 lg:block">
        {/* Sichtbar ist der Hofname im Kopf; die H1 hört nur der Screenreader. */}
        <h1 className="sr-only">Hofseite bearbeiten</h1>
        <HofseiteEditor fortschritt={fortschritt} hof={hof} einstellungen={einstellungen} auftritt={auftritt} aktuell={aktuell} />
      </div>
    </>
  )
}
