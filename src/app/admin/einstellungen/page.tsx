import type { Metadata } from 'next'
import * as Sentry from '@sentry/nextjs'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { prisma } from '@/lib/prisma'
import { gruendungZahlenAdmin, ladeGruendungStandAdmin, lesePlattformEinstellung } from '@/server/queries/plattform-einstellung'
import { EINSTELLUNGEN_TEXT, festgeschriebenZeile, gruendungZeileKurz, hofpreisEinstellungAus, hofpreisStichtagTag, protokollZeile, ADMIN_EINSTELLUNGEN_HREF } from '@/lib/plattform-einstellung'
import { hofpreisModellAb } from '@/lib/plattformgebuehr'
import { HofpreisStichtag } from './hofpreis-stichtag'
import { einstellungenGruppeSchema } from '@/schemas/plattform-einstellung'
import { cn } from '@/lib/utils'
import { ADMIN_RAHMEN, AdminFehler, SEITEN_TITEL } from '@/components/admin/admin-teile'
import { EinstellungenGruppen, type EinstellungenDaten } from '@/components/admin/einstellungen-gruppen'
import { MARKE } from '@/lib/marke'
import { redirect } from 'next/navigation'
import { ADMIN_BETRIEB_HREF } from '@/lib/betrieb'

export const metadata: Metadata = { title: `Einstellungen — Admin — ${MARKE}` }
// Zeigt den gespeicherten Stand und rechnet „frei" mit den Höfen von jetzt — nie aus einem Cache.
export const dynamic = 'force-dynamic'

/** Was die Karte „Hofpreis-Modell ab“ bekommt (N38, Nr. 197) — nur Text. */
type StichtagDaten = { tag: string; stichtagIso: string | null; erreicht: boolean; jetzt: string }

async function ladeDaten(gewaehlt: EinstellungenDaten['gewaehlt'], jetzt: Date): Promise<{ daten: EinstellungenDaten; stichtag: StichtagDaten }> {
  const einstellung = await lesePlattformEinstellung()
  const hofpreis = hofpreisEinstellungAus(einstellung)
  const stichtag: StichtagDaten = {
    tag: hofpreisStichtagTag(hofpreis),
    stichtagIso: einstellung.hofpreisModellAb,
    erreicht: hofpreisModellAb(hofpreis).getTime() <= jetzt.getTime(),
    jetzt: jetzt.toISOString(),
  }
  const stand = await ladeGruendungStandAdmin(einstellung)
  // Wer zuletzt gespeichert hat — nur der Name, für die Protokollzeile (N15).
  const person = einstellung.geaendertVonUserId
    ? await prisma.user.findUnique({ where: { id: einstellung.geaendertVonUserId }, select: { name: true } })
    : null
  const zahlen = gruendungZahlenAdmin(einstellung, stand.vergeben, jetzt)
  const daten: EinstellungenDaten = {
    gewaehlt,
    // Nr. 116: Felder der Aktion und die Liste fürs Festschreiben (ladeGruendungStandAdmin).
    gruendung: {
      gespeichert: {
        plaetze: einstellung.gruendungPlaetze,
        monate: einstellung.gruendungMonate,
        aktionBisTag: einstellung.gruendungAktionBisTag,
        anzeige: einstellung.gruendungAnzeige,
        bisTag: einstellung.gruendungBisTag,
        festAm: einstellung.gruendungFestAm,
      },
      ...stand,
      jetzt: jetzt.toISOString(),
      protokoll: protokollZeile(einstellung, person?.name ?? null),
      festgeschrieben: festgeschriebenZeile(einstellung),
    },
    gruendungZeile: gruendungZeileKurz(zahlen),
  }
  return { daten, stichtag }
}

/**
 * /admin/einstellungen — was die Plattform als Ganzes betrifft (Register N15
 * und K2-Ergänzung, Nr. 93; Mockups admin-einstellungen und
 * admin-mobil-einstellungen). Bearbeitbar ist in diesem Lauf nur die Gruppe
 * Gründungshöfe; Plattform steht nur zum Nachsehen da. Die Gruppe Betrieb
 * entfiel mit Nr. 103 (Register N15 geändert): Ein alter Link
 * `?gruppe=betrieb` führt nach Admin › Betrieb, wo der Stripe-Modus jetzt steht.
 */
export default async function AdminEinstellungenPage({
  searchParams,
}: {
  searchParams: Promise<{ gruppe?: string | string[] }>
}): Promise<React.JSX.Element> {
  await verlangeAdminSeite()

  const { gruppe } = await searchParams
  if (gruppe === 'betrieb') redirect(ADMIN_BETRIEB_HREF)
  const gewaehlt = einstellungenGruppeSchema.parse(gruppe)
  const jetzt = new Date()

  let geladen: Awaited<ReturnType<typeof ladeDaten>> | null = null
  try {
    geladen = await ladeDaten(gewaehlt, jetzt)
  } catch (err) {
    Sentry.captureException(err, { tags: { bereich: 'admin', seite: 'einstellungen' } })
  }

  if (!geladen) {
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
      <EinstellungenGruppen daten={geladen.daten} />
      <HofpreisStichtag daten={geladen.stichtag} />
    </div>
  )
}
