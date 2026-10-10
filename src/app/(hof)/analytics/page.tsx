import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getUmsatzAuswertung, getYtdRevenue } from '@/server/queries/analytics'
import { getKennzahlen, getServicegebuehrenMonat } from '@/server/queries/auswertung'
import { getTeilenWirkung } from '@/server/queries/teilen-wirkung'
import { grenzeStand, servicegebuehrenSaetze, teilenKarte, teilenZeitraumAus, umsatzKartenTitel } from '@/lib/auswertung'
import { umsatzfenster, type Periode, type Periodenfenster } from '@/lib/umsatz'
import { PROCESSING_REVENUE_LIMIT, limitProgress } from '@/lib/revenue-limit'
import { formatEuro } from '@/lib/format'
import { REGION_HREF } from '@/lib/bauern-navigation'
import { auswertungHref, leseAuswertungZeitraum } from '@/schemas/auswertung'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { AUSWERTUNG_RAHMEN, AuswertungFehler } from '@/components/auswertung/auswertung-zustaende'
import {
  EinsichtZeile,
  GrenzeKarte,
  KanaeleKarte,
  KennzahlenReihe,
  ServicegebuehrenKarte,
  TeilenWirkungKarte,
  TopProdukteKarte,
  UmsatzKarte,
  ZeitraumWahl,
} from '@/components/auswertung/auswertung-teile'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Auswertung — FarmerZone' }

export const dynamic = 'force-dynamic'

/*
 * Auswertung in der HofShell (Nachtlauf Nr. 22c, Gate 8; Mockup
 * web-h5-auswertung-abrechnung-teilen-wirkung): Kennzahlen, Teilen-Wirkung
 * und Umsatz für den gewählten Zeitraum (Woche · Monat · Jahr in der
 * Adresse), daneben die Servicegebühren DIESES Monats — bis zum SEPA-Start
 * ohne Lastschrift (Register B1, K1). Darunter wie bisher Kanäle,
 * Top-Produkte und die Jahresgrenze. Alles nur für den eigenen Hof (farmId
 * aus der Sitzung), nur lesend.
 */
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string | string[]; zurueck?: string | string[] }>
}): Promise<React.JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/onboarding')

  const { periode, zurueck } = leseAuswertungZeitraum(await searchParams)
  const jetzt = new Date()
  const pf = umsatzfenster(periode, jetzt, zurueck)

  const kopf = (
    <header>
      <h1 className="font-heading text-2xl font-semibold text-foreground md:text-[26px]">Auswertung</h1>
      <p className="text-[13px] leading-normal text-muted-foreground">
        Deine Zahlen – den Markt rundherum findest du unter{' '}
        <Link href={REGION_HREF} className={cn('font-semibold text-brand-text underline-offset-4 hover:underline', FOKUS_RAHMEN)}>
          Region
        </Link>
      </p>
    </header>
  )

  let daten: Awaited<ReturnType<typeof ladeAuswertung>> | null = null
  try {
    daten = await ladeAuswertung(farm.id, periode, zurueck, pf, jetzt)
  } catch (err) {
    // Nur Bereich und Hof — keine Personendaten.
    Sentry.captureException(err, { tags: { bereich: 'auswertung', seite: 'uebersicht' }, extra: { farmId: farm.id } })
  }

  const grenzeText = formatEuro(PROCESSING_REVENUE_LIMIT, 0)
  // Das Wiener Kalenderjahr, wie die Grenzwert-Summe (getYtdRevenue).
  const jahr = new Intl.DateTimeFormat('de-AT', { timeZone: 'Europe/Vienna', year: 'numeric' }).format(jetzt)

  const inhalt = !daten ? (
    <AuswertungFehler nochmal={auswertungHref(periode, zurueck)} />
  ) : (
    <>
      <ZeitraumWahl periode={periode} zurueck={zurueck} zeitraum={daten.umsatz.zeitraum} />
      <KennzahlenReihe k={daten.kennzahlen} zeitraum={daten.umsatz.zeitraum} />
      <TeilenWirkungKarte karte={teilenKarte(daten.wirkung)} zeitraum={daten.umsatz.zeitraum} />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <UmsatzKarte
          titel={umsatzKartenTitel(periode)}
          zeitraum={daten.umsatz.zeitraum}
          summeCent={daten.umsatz.summeCent}
          vergleich={daten.umsatz.vergleich}
          laufend={daten.umsatz.laufend}
          balken={daten.umsatz.balken}
          vergleichLabel={daten.umsatz.vergleichLabel}
        />
        <ServicegebuehrenKarte monat={daten.gebuehren} saetze={servicegebuehrenSaetze(jetzt)} />
      </div>
      {daten.umsatz.einsicht && <EinsichtZeile text={daten.umsatz.einsicht} />}
      {(daten.umsatz.kanaele.length > 0 || daten.umsatz.topProdukte.length > 0) && (
        <div className="grid items-start gap-4 md:grid-cols-2">
          {daten.umsatz.kanaele.length > 0 && <KanaeleKarte kanaele={daten.umsatz.kanaele} />}
          {daten.umsatz.topProdukte.length > 0 && <TopProdukteKarte produkte={daten.umsatz.topProdukte} />}
        </div>
      )}
      <GrenzeKarte
        jahr={jahr}
        grenzeText={grenzeText}
        jahresUmsatz={daten.ytdRevenue}
        grenze={PROCESSING_REVENUE_LIMIT}
        prozent={daten.grenze.pct}
        spielraum={daten.grenze.remaining}
        stand={grenzeStand(daten.grenze.pct, grenzeText)}
      />
    </>
  )

  return (
    <div className={AUSWERTUNG_RAHMEN}>
      <div className="flex flex-col gap-4 md:gap-[18px]">
        {kopf}
        {inhalt}
      </div>
    </div>
  )
}

/** Alles für die Seite in einem Zug — nur Abfragen, keine Darstellung (Fehler fängt die Seite). */
async function ladeAuswertung(farmId: string, periode: Periode, zurueck: number, pf: Periodenfenster, jetzt: Date) {
  const [umsatz, ytdRevenue, kennzahlen, wirkung, gebuehren] = await Promise.all([
    getUmsatzAuswertung(farmId, periode, zurueck, jetzt),
    getYtdRevenue(farmId, jetzt),
    getKennzahlen(farmId, pf),
    getTeilenWirkung(farmId, teilenZeitraumAus(pf)),
    getServicegebuehrenMonat(farmId, jetzt),
  ])
  return { umsatz, ytdRevenue, kennzahlen, wirkung, gebuehren, grenze: limitProgress(ytdRevenue) }
}
