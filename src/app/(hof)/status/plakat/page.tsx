import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getPlakatDaten } from '@/server/queries/teilen-bild'
import { WerkzeugKopf } from '@/components/ui/werkzeug-kopf'
import { FesteAktionsleiste, AKTIONSLEISTE_KNOPF } from '@/components/ui/feste-aktionsleiste'
import { BeitraegeBrotkrumen } from '../beitraege-brotkrumen'
import { QrPlakat } from '@/components/teilen/qr-plakat'
import { PlakatVorschau } from '@/components/teilen/plakat-vorschau'
import { DruckenKnopf } from '@/components/teilen/drucken-knopf'
import { EmptyState } from '@/components/ui/empty-state'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'
import { UNTERSEITE_RAHMEN } from '@/components/hof-einstellungen/einstellungen-laden'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = { title: `QR-Plakat — ${MARKE}` }

export const dynamic = 'force-dynamic'

/** „Drucken“ im Web neben der h1: orange, 48 px, 14 px rund, fett, ohne Symbol (Board w2-whatsapp-plakat Bild 3). */
const KNOPF_DRUCKEN = cn(
  'inline-flex min-h-12 items-center justify-center rounded-[14px] bg-primary px-[22px] text-[16px] font-bold text-primary-foreground transition-colors duration-[250ms] hover:bg-primary/90',
  FOKUS_RAHMEN
)

/*
 * QR-Plakat zum Drucken (Gate 7 Aufgabe 3, Nachtlauf Nr. 21; Mockup
 * web-h4-qr-plakat-zum-drucken) — in der HofShell, die beim Drucken
 * Seitenleiste, Unterleiste und Balken ausblendet (print:hidden). Auf dem
 * Papier steht nur das Blatt: A4 ohne Rand (@page), der Kopf dieser Seite
 * ist print:hidden.
 *
 * Nur für einen öffentlichen Hof: Ein Plakat mit Code auf eine Seite, die
 * niemand sehen kann, wäre ein Aushang ins Leere. Der Code trägt die feste
 * Adresse der Hofseite mit ?k=qr — das gedruckte Blatt bleibt gültig.
 */
export default async function PlakatPage(): Promise<React.JSX.Element> {
  const { userId } = await verlangeHofDerSitzung()

  const farm = await getFarmForUser(userId)
  if (!farm) redirect('/onboarding')

  const daten = await getPlakatDaten(farm.id)

  return (
    // Spalte wie die Einstellungs-Unterseiten: 672 px Inhalt im Web (Abnahme Lauf 32 Bild 4 „815 statt 670 px“).
    <div className={cn(UNTERSEITE_RAHMEN, 'print:m-0 print:max-w-none print:p-0')}>
      {/* A4 ohne Druckrand: Das Blatt bringt seinen eigenen Rand mit. */}
      <style>{'@page { size: A4; margin: 0; }'}</style>
      {/* Werkzeug-Kopf (G1, Nr. 250): Elternseite „Beiträge“ (N1), Unterzeile „Mein Hof › Beiträge“; im Web
          „Drucken“ bündig rechts neben der h1 (Liste Lauf 32, whatsapp-plakat), am Handy in der festen Leiste
          unten (G2). Direkt im Rahmen: Die Leiste am Handy klebt nur, solange ihr Elternelement reicht. Gedruckt
          wird nichts davon (print:hidden im Baustein). */}
      <WerkzeugKopf
        titel="QR-Plakat"
        unterzeile={<BeitraegeBrotkrumen hofName={farm.name} />}
        aktion={daten ? <div className="hidden md:block"><DruckenKnopf className={KNOPF_DRUCKEN} /></div> : undefined}
      />
      {/* Ohne Plakat keine Einleitung, nur der Leerzustand (Board Bild 4, Liste Lauf 32 „Einleitung weg“). */}
      {daten && (
        <p className="mb-5 text-[15px] leading-relaxed text-muted-foreground md:text-base print:hidden">
          Zum Aushängen im Hofladen, am Hoftor oder beim Bäcker. Der Code führt direkt zu deiner Hofseite.
        </p>
      )}

      {daten ? (
        <>
          <PlakatVorschau>
            <QrPlakat daten={daten} />
          </PlakatVorschau>
          <FesteAktionsleiste className="md:hidden">
            <DruckenKnopf className={AKTIONSLEISTE_KNOPF} />
          </FesteAktionsleiste>
        </>
      ) : (
        <EmptyState
          titel="Das Plakat gibt es, sobald dein Hof online ist"
          satz="Solange Kundinnen deine Hofseite nicht sehen können, würde der Code ins Leere führen."
          ausweg={
            // Board s2/w2-whatsapp-plakat Bild 4: der Ausweg sagt, was zu tun ist — in Mein Hof wird die Hofseite eingerichtet.
            <Link href="/farm-page" className={AKTIONSLEISTE_KNOPF}>
              Hofseite einrichten
            </Link>
          }
        />
      )}
    </div>
  )
}
