import type { Metadata } from 'next'
import * as Sentry from '@sentry/nextjs'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { prisma } from '@/lib/prisma'
import { lesePlattformEinstellung } from '@/server/queries/plattform-einstellung'
import { ladeHoefeFuerGruendung } from '@/server/queries/admin'
import { STRIPE_MARKE } from '@/lib/umgebung-server'
import { bildeGruendungBis, gruendungsplaetze, seitenZahlen, zaehleAusgenommene } from '@/lib/gruendungshof'
import { EINSTELLUNGEN_TEXT, gruendungZeileKurz, protokollZeile, ADMIN_EINSTELLUNGEN_HREF } from '@/lib/plattform-einstellung'
import { einstellungenGruppeSchema } from '@/schemas/plattform-einstellung'
import { cn } from '@/lib/utils'
import { ADMIN_RAHMEN, AdminFehler, SEITEN_TITEL } from '@/components/admin/admin-teile'
import { EinstellungenGruppen, type EinstellungenDaten } from '@/components/admin/einstellungen-gruppen'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = { title: `Einstellungen — Admin — ${MARKE}` }
// Zeigt den gespeicherten Stand und rechnet „frei" mit den Höfen von jetzt — nie aus einem Cache.
export const dynamic = 'force-dynamic'

async function ladeDaten(gewaehlt: EinstellungenDaten['gewaehlt'], jetzt: Date): Promise<EinstellungenDaten> {
  const [einstellung, hoefe] = await Promise.all([lesePlattformEinstellung(), ladeHoefeFuerGruendung()])
  // Wer zuletzt gespeichert hat — nur der Name, für die Protokollzeile (N15).
  const person = einstellung.geaendertVonUserId
    ? await prisma.user.findUnique({ where: { id: einstellung.geaendertVonUserId }, select: { name: true } })
    : null
  const imRennen = gruendungsplaetze(hoefe).size
  const gespeichert = { plaetze: einstellung.gruendungPlaetze, bisTag: einstellung.gruendungBisTag, anzeige: einstellung.gruendungAnzeige }
  const zahlen = seitenZahlen({ plaetze: gespeichert.plaetze, bis: bildeGruendungBis(gespeichert.bisTag), anzeige: gespeichert.anzeige }, imRennen, jetzt)
  return {
    gewaehlt,
    gruendung: {
      gespeichert,
      imRennen,
      ausgenommen: zaehleAusgenommene(hoefe),
      jetzt: jetzt.toISOString(),
      protokoll: protokollZeile(einstellung, person?.name ?? null),
    },
    gruendungZeile: gruendungZeileKurz(zahlen.gesamt, zahlen.frei, zahlen.bisTag),
    stripeMarke: STRIPE_MARKE,
  }
}

/**
 * /admin/einstellungen — was die Plattform als Ganzes betrifft (Register N15
 * und K2-Ergänzung, Nr. 93; Mockups admin-einstellungen und
 * admin-mobil-einstellungen). Bearbeitbar ist in diesem Lauf nur die Gruppe
 * Gründungshöfe; Betrieb und Plattform stehen nur zum Nachsehen da.
 */
export default async function AdminEinstellungenPage({
  searchParams,
}: {
  searchParams: Promise<{ gruppe?: string | string[] }>
}): Promise<React.JSX.Element> {
  await verlangeAdminSeite()

  const gewaehlt = einstellungenGruppeSchema.parse((await searchParams).gruppe)
  const jetzt = new Date()

  let daten: EinstellungenDaten | null = null
  try {
    daten = await ladeDaten(gewaehlt, jetzt)
  } catch (err) {
    Sentry.captureException(err, { tags: { bereich: 'admin', seite: 'einstellungen' } })
  }

  if (!daten) {
    return (
      <div className={ADMIN_RAHMEN}>
        <AdminFehler titel={EINSTELLUNGEN_TEXT.titel} satz={EINSTELLUNGEN_TEXT.ladefehler} nochmal={ADMIN_EINSTELLUNGEN_HREF} />
      </div>
    )
  }

  return (
    <div className={cn(ADMIN_RAHMEN, 'flex flex-col gap-4 lg:gap-[18px]')}>
      <header className="min-w-0">
        <h1 className={SEITEN_TITEL}>{EINSTELLUNGEN_TEXT.titel}</h1>
        <p className="mt-1 hidden text-[13.5px] leading-snug text-muted-foreground lg:block">{EINSTELLUNGEN_TEXT.satz}</p>
        <p className="mt-1 text-[13px] leading-snug text-muted-foreground lg:hidden">{EINSTELLUNGEN_TEXT.satzKurz}</p>
      </header>
      <EinstellungenGruppen daten={daten} />
    </div>
  )
}
