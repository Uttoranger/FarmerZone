import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { ladeHeute } from '@/server/queries/admin-heute'
import { STRIPE_MARKE, TESTBETRIEB, UMGEBUNG } from '@/lib/umgebung-server'
import { ablaufZeilen, istMailWarnArt } from '@/lib/betrieb'
import {
  HEUTE_TEXT,
  alteHoefeAdresse,
  aufgabenZahl,
  fristText,
  kommtEintraege,
  lageKacheln,
  protokollZeilen,
  routineSchluessel,
  sammleAufgaben,
  zahlText,
} from '@/lib/admin-aufgaben'
import { dienstZeilen, NOCH_NICHT_EINGERICHTET } from '@/app/admin/betrieb/dienste'
import { Karte, Klappkarte } from '@/app/admin/betrieb/betrieb-teile'
import { ADMIN_RAHMEN, AdminFehler } from '@/components/admin/admin-teile'
import { Seitenkopf } from '@/components/admin/seitenkopf'
import { HeuteBrauchtDich, type BrauchtDichEintrag } from '@/components/admin/heute-braucht-dich'
import { HeuteLage } from '@/components/admin/heute-lage'
import { HeuteKommt, HeuteLaeuft, HeuteProtokoll } from '@/components/admin/heute-karten'
import { HeuteRoutine } from '@/components/admin/heute-routine'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = { title: `Admin — ${MARKE}` }
export const dynamic = 'force-dynamic'

/*
 * /admin — Heute (Register N32, Nr. 185; Mockups admin-heute 1440,
 * mobil-admin-heute 390): Lage-Kacheln, „Braucht dich“ aus allen Quellen
 * (src/lib/admin-aufgaben.ts), „Läuft von selbst“, „Kommt“, Montags-Routine
 * und „Zuletzt im Protokoll“. Die Höfe stehen seit Nr. 185 unter
 * /admin/hoefe; eine alte Adresse mit Parametern (/admin?reiter=…) leitet
 * dauerhaft (308) dorthin.
 *
 * Reihenfolge: Im Dokument steht „Braucht dich“ zuerst (am Handy oben, für
 * Tastatur und Screenreader zuerst); ab 1024 px zieht die Lage darüber.
 * Die Kacheln enthalten nichts zum Anklicken, die Tab-Folge bleibt also
 * gleich. „Bestellungen anhalten …“ kommt mit Nr. 189 (Notbremse).
 */
export default async function AdminHeutePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<React.JSX.Element> {
  const userId = await verlangeAdminSeite()

  const alt = alteHoefeAdresse(await searchParams)
  if (alt) permanentRedirect(alt)

  const jetzt = new Date()
  const mitBetrieb = UMGEBUNG.vercelProduktion
  let roh: Awaited<ReturnType<typeof ladeHeute>> | null = null
  try {
    roh = await ladeHeute(jetzt, { mitBetrieb })
  } catch (err) {
    // Nur der Bereich — keine Hofnamen, keine Adressen.
    Sentry.captureException(err, { tags: { bereich: 'admin', seite: 'heute' } })
  }

  if (!roh) {
    return (
      <div className={ADMIN_RAHMEN}>
        <AdminFehler titel={HEUTE_TEXT.titel} satz={HEUTE_TEXT.fehler} nochmal="/admin" />
      </div>
    )
  }

  const aufgaben = sammleAufgaben(roh.stand, jetzt)
  const zahl = zahlText(aufgabenZahl(aufgaben))
  const eintraege: BrauchtDichEintrag[] = aufgaben.map((a) => ({
    schluessel: `${a.quelle}-${a.bezug.kennung}`,
    bereich: a.bereich,
    titel: a.titel,
    frist: fristText(a, jetzt),
    ueberfaellig: a.frist.ueberfaellig,
    bezug: a.bezug.text,
    satz: a.satz,
    wasTun: a.wasTun,
    ziel: a.ziel,
  }))

  const ablaeufe = ablaufZeilen(roh.laeufe, jetzt)
  const crons = ablaeufe.filter((z) => z.name !== 'von-aussen')
  const vonAussen = roh.laeufe.get('von-aussen') ?? null
  // Dieselben Dienste wie Admin › Betrieb (Nr. 184); gezählt wird, was die App selbst prüft — Sentry und GitHub nicht.
  const dienste = dienstZeilen(
    {
      stripe: STRIPE_MARKE,
      testbetrieb: TESTBETRIEB,
      mailWarnungOffen: roh.stand.warnungen.some((w) => w.stufe > 0 && istMailWarnArt(w.art)),
      datenbank: null,
      antwortMs: roh.antwortMs,
      ablaeufe: { puenktlich: crons.filter((z) => z.stand === 'puenktlich').length, von: crons.length, ausgefallen: crons.some((z) => z.stand === 'ueberfaellig' || z.stand === 'fehler') },
      vonAussen: { stand: ablaeufe.find((z) => z.name === 'von-aussen')?.stand ?? 'nochKeinLauf', gestartetAm: vonAussen?.gestartetAm ?? null },
    },
    jetzt
  ).filter((d) => d.art !== 'erledigt')
  const kacheln = lageKacheln(
    {
      bestellungen: roh.bestellungen,
      woche: roh.woche,
      dienste: { laufen: dienste.filter((d) => d.art === 'laeuft').length, von: dienste.length, ansehen: dienste.filter((d) => d.art === 'tun').map((d) => d.dienst), testbetrieb: TESTBETRIEB },
      hoefe: roh.hoefe,
      geldAbgleichOk: roh.laeufe.get('geld-abgleich')?.ok === true,
    },
    aufgaben
  )
  const kommt = kommtEintraege({ naechsteFassung: roh.naechsteFassung, gruendungAktionBisTag: roh.gruendung.aktionBisTag, gruendungFest: roh.gruendung.fest }, jetzt)
  const protokoll = protokollZeilen(roh.protokoll, userId, jetzt)
  const schluessel = routineSchluessel(jetzt)
  const puenktlich = `${ablaeufe.filter((z) => z.stand === 'puenktlich').length} von ${ablaeufe.length} pünktlich`

  const laeuft = <HeuteLaeuft zeilen={ablaeufe} nichtEingerichtet={NOCH_NICHT_EINGERICHTET} />
  const kommtInhalt = <HeuteKommt eintraege={kommt} />
  const protokollInhalt = <HeuteProtokoll zeilen={protokoll} />

  return (
    <div className={`${ADMIN_RAHMEN} flex flex-col gap-4 md:gap-5`}>
      <Seitenkopf titel={HEUTE_TEXT.titel} satz={HEUTE_TEXT.satz} rechts={<span className="text-[13px] text-muted-foreground">{HEUTE_TEXT.stand(jetzt)}</span>} />

      <div className="flex flex-col gap-4 md:gap-5">
        <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
          <div className="flex min-w-0 flex-col gap-4 md:gap-5">
            <HeuteBrauchtDich eintraege={eintraege} zahl={zahl} />
            <Karte titel={HEUTE_TEXT.routine} zusatz={HEUTE_TEXT.routineZusatz} className="hidden lg:flex">
              <HeuteRoutine schluessel={schluessel} kopf />
            </Karte>
          </div>
          <div className="hidden min-w-0 flex-col gap-4 md:gap-5 lg:flex">
            <Karte titel={HEUTE_TEXT.laeuft} zusatz={puenktlich}>
              {laeuft}
            </Karte>
            <Karte titel={HEUTE_TEXT.kommt} zusatz={HEUTE_TEXT.kommtZusatz}>
              {kommtInhalt}
            </Karte>
            <Karte titel={HEUTE_TEXT.protokoll} zusatz={HEUTE_TEXT.protokollZusatz}>
              {protokollInhalt}
            </Karte>
          </div>
        </div>
        <HeuteLage kacheln={kacheln} className="lg:order-first" />
        <div className="flex flex-col gap-3 lg:hidden">
          <Klappkarte titel={HEUTE_TEXT.laeuft} zeile={puenktlich}>
            {laeuft}
          </Klappkarte>
          <Klappkarte titel={HEUTE_TEXT.kommt} zeile={kommt[0] ? `${kommt[0].titel} · ${kommt[0].wann}` : HEUTE_TEXT.kommtLeer}>
            {kommtInhalt}
          </Klappkarte>
          <Klappkarte titel={HEUTE_TEXT.routine} zeile={HEUTE_TEXT.routineZusatz}>
            <HeuteRoutine schluessel={schluessel} kopf />
          </Klappkarte>
          <Klappkarte titel={HEUTE_TEXT.protokoll} zeile={protokoll[0] ? `${protokoll[0].text} · ${protokoll[0].wann}` : HEUTE_TEXT.protokollLeer}>
            {protokollInhalt}
          </Klappkarte>
        </div>
      </div>
    </div>
  )
}
