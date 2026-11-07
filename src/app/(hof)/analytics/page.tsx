import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getUmsatzAuswertung, getYtdRevenue } from '@/server/queries/analytics'
import { getKennzahlen, getServicegebuehrenZeitraum } from '@/server/queries/auswertung'
import { getTeilenWirkung } from '@/server/queries/teilen-wirkung'
import { ladeHofpreisEinstellung } from '@/server/queries/plattform-einstellung'
import { testzahlungenHinweisFuerHof } from '@/server/queries/testzahlungen'
import { auswertungSummen, gebuehrenKarteText, grenzeStand, teilenKarte, teilenZeitraumAus } from '@/lib/auswertung'
import { umsatzfenster, zeitraumImSatz, type Periode, type Periodenfenster } from '@/lib/umsatz'
import { monatsschluesselInWien } from '@/lib/servicegebuehr'
import { PROCESSING_REVENUE_LIMIT, limitProgress } from '@/lib/revenue-limit'
import { formatEuro } from '@/lib/format'
import { REGION_HREF } from '@/lib/bauern-navigation'
import { auswertungHref, leseAuswertungZeitraum } from '@/schemas/auswertung'
import { Textlink } from '@/components/ui/textlink'
import { WerkzeugKopf } from '@/components/ui/werkzeug-kopf'
import { LadeInhalt, LadeRahmen } from '@/components/ui/lade-punkt'
import { AUSWERTUNG_RAHMEN, AuswertungFehler } from '@/components/auswertung/auswertung-zustaende'
import { gebuehrTitel, wocheAusgeschrieben } from '@/components/auswertung/gebuehr-titel'
import {
  EinsichtZeile,
  GrenzeKarte,
  KanaeleKarte,
  KennzahlenReihe,
  GebuehrenKarte,
  TeilenWirkungKarte,
  TopProdukteKarte,
  UmsatzKarte,
  ZeitraumWahl,
} from '@/components/auswertung/auswertung-teile'
import { HofUnterzeile } from '@/components/mein-hof/hof-unterzeile'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = { title: `Auswertung — ${MARKE}` }

export const dynamic = 'force-dynamic'

/*
 * Auswertung in der HofShell (Nachtlauf Nr. 22c, Gate 8; Mockup
 * web-h5-auswertung-abrechnung-teilen-wirkung): Kennzahlen, Teilen-Wirkung
 * und Umsatz für den gewählten Zeitraum (Woche · Monat · Jahr in der
 * Adresse), daneben die Gebühren DIESES Monats — bis zum SEPA-Start
 * ohne Lastschrift (Register B1, K1); ihr Wort je Stichtag „Hofpreis-Modell ab“
 * (V62, V63; Nr. 225). Darunter wie bisher Kanäle,
 * Top-Produkte und die Jahresgrenze. Alles nur für den eigenen Hof (farmId
 * aus der Sitzung), nur lesend.
 */
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string | string[]; zurueck?: string | string[] }>
}): Promise<React.JSX.Element> {
  const { userId } = await verlangeHofDerSitzung()

  const farm = await getFarmForUser(userId)
  if (!farm) redirect('/onboarding')

  const { periode, zurueck } = leseAuswertungZeitraum(await searchParams)
  const jetzt = new Date()
  const pf = umsatzfenster(periode, jetzt, zurueck)

  let daten: Awaited<ReturnType<typeof ladeAuswertung>> | null = null
  try {
    daten = await ladeAuswertung(farm.id, periode, zurueck, pf, jetzt)
  } catch (err) {
    // Nur Bereich und Hof — keine Personendaten.
    Sentry.captureException(err, { tags: { bereich: 'auswertung', seite: 'uebersicht' }, extra: { farmId: farm.id } })
  }

  const kopf = (
    <header>
      {/* Werkzeug-Kopf (G1): am Handy die feste Leiste, im Web Titel und Hofname. */}
      <WerkzeugKopf titel="Auswertung" unterzeile={<HofUnterzeile hofName={farm.name} jetzt={jetzt} />} />
      {/* Der Einleitungssatz als eigener Absatz unter der Hofzeile (Board w2-auswertung); Leerzeichen und Punkt außerhalb des Links. */}
      <p className="text-[13px] leading-normal text-muted-foreground md:text-sm">
        Deine Zahlen – den Markt rundherum findest du unter{' '}
        <Textlink href={REGION_HREF} form="im-satz">
          Region
        </Textlink>
        .
      </p>
      {/* Leise, nur wenn der Stichtag Bestellungen dieser Seite betrifft (Register Z4). */}
      {daten?.testzahlungenHinweis && (
        <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">{daten.testzahlungenHinweis}</p>
      )}
    </header>
  )

  const grenzeText = formatEuro(PROCESSING_REVENUE_LIMIT, 0)
  // Das Wiener Kalenderjahr, wie die Grenzwert-Summe (getYtdRevenue).
  const jahr = new Intl.DateTimeFormat('de-AT', { timeZone: 'Europe/Vienna', year: 'numeric' }).format(jetzt)

  // Woche mit ausgeschriebenem Monat („2.–8. November“, Liste Lauf 32 auswertung); Monat und Jahr wie bisher.
  const zeitraum = daten ? (periode === 'woche' ? wocheAusgeschrieben(pf) : daten.umsatz.zeitraum) : ''
  const satzZeitraum = periode === 'woche' ? zeitraum : zeitraumImSatz(pf)
  const umsatzKarte = daten && (
    <UmsatzKarte
      zeitraum={zeitraum}
      summeCent={daten.umsatz.summeCent}
      vergleich={daten.umsatz.vergleich}
      laufend={daten.umsatz.laufend}
      balken={daten.umsatz.balken}
      vergleichLabel={daten.umsatz.vergleichLabel}
    />
  )
  const teilenKarteEl = daten && <TeilenWirkungKarte karte={teilenKarte(daten.wirkung)} zeitraum={zeitraum} />

  const inhalt = !daten ? (
    <AuswertungFehler nochmal={auswertungHref(periode, zurueck)} />
  ) : (
    <>
      <ZeitraumWahl periode={periode} zurueck={zurueck} zeitraum={zeitraum} />
      <KennzahlenReihe k={daten.kennzahlen} zeitraum={zeitraum} satzZeitraum={satzZeitraum} />
      {/* Woche: das Diagramm direkt unter den Kennzahlen (Board s2-auswertung Bild 3); sonst erst die Links-Karte. */}
      {periode === 'woche' ? (
        <>
          {umsatzKarte}
          {teilenKarteEl}
        </>
      ) : (
        <>
          {teilenKarteEl}
          {umsatzKarte}
        </>
      )}
      {daten.umsatz.einsicht && <EinsichtZeile text={daten.umsatz.einsicht} />}
      {(daten.umsatz.kanaele.length > 0 || daten.umsatz.topProdukte.length > 0) && (
        <div className="grid items-start gap-4 md:grid-cols-2">
          {daten.umsatz.kanaele.length > 0 && <KanaeleKarte kanaele={daten.umsatz.kanaele} />}
          {daten.umsatz.topProdukte.length > 0 && <TopProdukteKarte produkte={daten.umsatz.topProdukte} />}
        </div>
      )}
      {/* Reihenfolge nach Board: Diagramm → Hinweis → Wo kam das Geld her → Was lief am besten → Gebühr + Grenze. */}
      <GebuehrenKarte
        titel={gebuehrTitel(pf, daten.hofpreis)}
        gebuehr={daten.gebuehren}
        text={gebuehrenKarteText(monatsschluesselInWien(pf.aktuell.von), daten.hofpreis, jetzt)}
      />
      <GrenzeKarte
        jahr={jahr}
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
      {/* Zeitraum und Pfeile sind Links in der Adresse: Die alte Auswertung bleibt stehen, bis die neue da ist (Ladepunkt statt Skelett, Nr. 121). */}
      <LadeRahmen>
        <div className="flex flex-col gap-4 md:gap-[18px]">
          {kopf}
          <LadeInhalt className="flex flex-col gap-4 md:gap-[18px]">{inhalt}</LadeInhalt>
        </div>
      </LadeRahmen>
    </div>
  )
}

/**
 * Alles für die Seite in einem Zug — nur Abfragen, keine Darstellung (Fehler
 * fängt die Seite). Den Stichtag der Live-Schaltung (Register Z4) bringen die
 * Abfragen selbst mit (src/lib/umgebung-server.ts).
 */
async function ladeAuswertung(farmId: string, periode: Periode, zurueck: number, pf: Periodenfenster, jetzt: Date) {
  const [umsatz, ytdRevenue, kennzahlen, wirkung, gebuehren, testzahlungenHinweis, hofpreis] = await Promise.all([
    getUmsatzAuswertung(farmId, periode, zurueck, jetzt),
    getYtdRevenue(farmId, jetzt),
    getKennzahlen(farmId, pf),
    getTeilenWirkung(farmId, teilenZeitraumAus(pf)),
    // Die Gebühr des GEWÄHLTEN Zeitraums (Nr. 251) — Anzeige, dieselbe Regel wie die Abrechnung.
    getServicegebuehrenZeitraum(farmId, pf.aktuell),
    testzahlungenHinweisFuerHof(farmId, auswertungSummen(pf, jetzt)),
    // Der Stichtag für das Wort der Gebühr; scheitert das Lesen, gilt die Vorgabe (ladeHofpreisEinstellung meldet selbst).
    ladeHofpreisEinstellung(),
  ])
  return { umsatz, ytdRevenue, kennzahlen, wirkung, gebuehren, grenze: limitProgress(ytdRevenue), testzahlungenHinweis, hofpreis }
}

