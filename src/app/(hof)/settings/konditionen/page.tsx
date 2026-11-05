import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import type { KonditionenHof } from '@/lib/hof-einstellungen'
import { ladeKonditionenHof } from '@/server/queries/einstellungen'
import { ladeAbzeichenSchalter } from '@/server/queries/farm'
import { AbzeichenSchalter } from './abzeichen-schalter'
import { KonditionenAnsicht } from '@/components/hof-einstellungen/konditionen-ansicht'
import { EinstellungenFehler } from '@/components/hof-einstellungen/einstellungen-fehler'
import { EINSTELLUNGEN_RAHMEN } from '@/components/hof-einstellungen/einstellungen-laden'
import { MARKE } from '@/lib/marke'
import { Barzahlung, type BarzahlungAnzeige } from '@/components/hof-einstellungen/barzahlung'
import { ladeBarzahlung } from '@/server/queries/plattformgebuehr'
import { ladeHofpreisEinstellung } from '@/server/queries/plattform-einstellung'
import { hofpreisModellAb, preisAnzeigeFuer, type PreisAnzeige } from '@/lib/plattformgebuehr'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = { title: `Konditionen — ${MARKE}` }

export const dynamic = 'force-dynamic'

/*
 * „Deine Konditionen" in der HofShell (Gate 8, Nachtlauf Nr. 22d, Register K1
 * und B1) — Mockup web-h1-einstellungen-konditionen. Texte aus
 * src/lib/konditionen.ts, das Rechenbeispiel mit den gespeicherten Sätzen
 * dieses Hofs. Die Admin-Freischaltung (Gründungsplatz) bleibt unberührt.
 * Darunter „Barzahlung“ und „Monatsabrechnungen“ (Register N38, Nr. 198):
 * Mandat, Einzug ab, Satz — fehlt das, steht die Seite trotzdem.
 */
export default async function KonditionenEinstellungenPage(): Promise<React.JSX.Element> {
  const { userId, farmId } = await verlangeHofDerSitzung()

  const jetzt = new Date()
  let hof: KonditionenHof | null = null
  let abzeichen: { zeigen: boolean } | null = null
  let preis: PreisAnzeige = null
  let stichtag = hofpreisModellAb(null)
  let gefunden = true
  try {
    const [geladen, schalter, einstellung, satz] = await Promise.all([
      ladeKonditionenHof(userId),
      ladeAbzeichenSchalter(userId),
      ladeHofpreisEinstellung(),
      // Nur der Satz der Plattformgebühr (N38) — er wählt Wort und Rechnung des Beispiels.
      prisma.farm.findUnique({ where: { id: farmId }, select: { plattformgebuehrProzent: true } }),
    ])
    hof = geladen
    abzeichen = schalter
    stichtag = hofpreisModellAb(einstellung)
    preis = preisAnzeigeFuer({ plattformgebuehrProzent: satz?.plattformgebuehrProzent ?? null }, einstellung, jetzt)
    gefunden = hof !== null
  } catch (err) {
    Sentry.captureException(err, { tags: { bereich: 'einstellungen', seite: 'konditionen' } })
  }
  if (!gefunden) redirect('/onboarding')

  // Barzahlung und Monatsabrechnungen (Nr. 198): ein eigener Teil — scheitert er, bleibt der Rest der Seite.
  let barzahlung: BarzahlungAnzeige | null = null
  try {
    barzahlung = await ladeBarzahlung(farmId, jetzt)
  } catch (err) {
    Sentry.captureException(err, { tags: { bereich: 'einstellungen', seite: 'konditionen', teil: 'barzahlung' } })
  }

  return (
    <div className={EINSTELLUNGEN_RAHMEN}>
      {hof ? (
        <KonditionenAnsicht
          hof={hof}
          jetzt={jetzt}
          preis={preis}
          stichtag={stichtag}
          // Nur für Gründungshöfe (Register K2, Nr. 116): der Schalter im Block „Dein Stand“.
          abzeichen={abzeichen ? <AbzeichenSchalter anfangsAn={abzeichen.zeigen} /> : null}
        />
      ) : (
        <EinstellungenFehler titel="Deine Konditionen" href="/settings/konditionen" />
      )}
      {hof && barzahlung && (
        <div className="mt-6 flex flex-col gap-6">
          <Barzahlung daten={barzahlung} />
        </div>
      )}
    </div>
  )
}
