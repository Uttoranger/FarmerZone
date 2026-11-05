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
import { HOF_FUER_GEBUEHR_LAGE, ladeGebuehrLage, lesePlattformEinstellung } from '@/server/queries/plattform-einstellung'
import { hofpreisEinstellungAus } from '@/lib/plattform-einstellung'
import { hofpreisModellAb, type GebuehrLage } from '@/lib/plattformgebuehr'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = { title: `Konditionen — ${MARKE}` }

export const dynamic = 'force-dynamic'

/**
 * Gebührenlage und Stichtag — frisch gelesen wie „Barzahlung“ darunter
 * (ladeBarzahlung), damit Wort und Rechnung am Stichtag zusammen wechseln.
 * Ein eigener Teil: Scheitert er, steht die Seite ohne Rechenbeispiel und ohne
 * die Sätze, die vom Stichtag abhängen (null) — nie als Fassung „bisher“.
 */
async function ladeGebuehrTeil(farmId: string, jetzt: Date): Promise<{ lage: GebuehrLage; stichtag: Date } | null> {
  try {
    const [zeile, spalten] = await Promise.all([
      lesePlattformEinstellung(),
      prisma.farm.findUnique({ where: { id: farmId }, select: HOF_FUER_GEBUEHR_LAGE }),
    ])
    // Ohne Hof leitet die Seite selbst nach /onboarding (gefunden) — hier nur kein Teil.
    return spalten ? { lage: await ladeGebuehrLage(spalten, jetzt), stichtag: hofpreisModellAb(hofpreisEinstellungAus(zeile)) } : null
  } catch (err) {
    Sentry.captureException(err, { tags: { bereich: 'einstellungen', seite: 'konditionen', teil: 'gebuehr' } })
    return null
  }
}

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
  // Läuft neben dem Hof — fängt seinen Fehler selbst.
  const gebuehrTeil = ladeGebuehrTeil(farmId, jetzt)
  let hof: KonditionenHof | null = null
  let abzeichen: { zeigen: boolean } | null = null
  let gefunden = true
  try {
    const [geladen, schalter] = await Promise.all([ladeKonditionenHof(userId), ladeAbzeichenSchalter(userId)])
    hof = geladen
    abzeichen = schalter
    gefunden = hof !== null
  } catch (err) {
    Sentry.captureException(err, { tags: { bereich: 'einstellungen', seite: 'konditionen' } })
  }
  const gebuehr = await gebuehrTeil
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
          gebuehr={gebuehr}
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
