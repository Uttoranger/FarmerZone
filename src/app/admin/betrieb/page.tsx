import type { Metadata } from 'next'
import * as Sentry from '@sentry/nextjs'
import { Clock, Download, Info } from 'lucide-react'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { ladeGroessteTabellen, ladeLaeufe, ladeMessungenFuerSeite, ladeWarnungen, letzteMessungAm } from '@/server/queries/betrieb'
import { zaehleProbleme } from '@/server/queries/mails'
import { alleArtenAus, alleMailsAus, betriebReiterAus, mailSucheAus, protokollFilterAus } from '@/schemas/betrieb-mails'
import { STRIPE_MARKE, TESTBETRIEB, UMGEBUNG } from '@/lib/umgebung-server'
import { env } from '@/lib/env'
import {
  ABLAEUFE,
  ADMIN_BETRIEB_HREF,
  BETRIEB_EXPORT_HREF,
  BETRIEB_TEXT,
  TARIFE_KURZ,
  ablaufZeilen,
  betriebKacheln,
  betriebVerlauf,
  gemessenText,
  istMailWarnArt,
  ohneVerwendungKarte,
  OHNE_VERWENDUNG_ANKER,
  speicherText,
  tabellenBleibt,
  tabellenName,
  verlaufBeschreibung,
  verlaufKurz,
  vercelAusgabenKarte,
  warnEintraege,
} from '@/lib/betrieb'
import { formatZahl } from '@/lib/format'
import { MARKE } from '@/lib/marke'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { ADMIN_HEUTE_HREF } from '@/lib/admin-aufgaben'
import { ADMIN_RAHMEN, AdminFehler } from '@/components/admin/admin-teile'
import { Seitenkopf } from '@/components/admin/seitenkopf'
import { JetztMessen } from './jetzt-messen'
import { DIENSTE_TEXT, dienstZeilen, versionZeilen } from './dienste'
import { ladeLetzteMigration, messeAntwort } from './version'
import { MailsAnsicht } from './mails-ansicht'
import { MailsAlle } from './mails-alle'
import { ProtokollAnsicht } from './protokoll-ansicht'
import Link from 'next/link'
import {
  AblaeufeListe,
  AlarmMatrixListe,
  AlarmMatrixTabelle,
  BetriebUnterreiter,
  DiensteInhalt,
  VersionInhalt,
  AblaeufeRegel,
  AblaeufeTabelle,
  BilderOhneVerwendung,
  DashboardInhalt,
  Kacheln,
  Karte,
  Klappkarte,
  TabellenInhalt,
  TarifeInhalt,
  VercelAusgabenInhalt,
  VerlaufDiagramm,
  VerlaufLegende,
  Warnkarte,
  type TabellenAnzeige,
} from './betrieb-teile'

export const metadata: Metadata = { title: `Betrieb — Admin — ${MARKE}` }
// Zeigt den Stand von jetzt (Messungen, Herzschlag, Warnungen) — nie aus einem Cache.
export const dynamic = 'force-dynamic'

/** Die größten Tabellen dürfen die Seite nicht aufhalten: Scheitert die Abfrage, steht dort ein Satz (Sentry: nur die Klasse). */
async function ladeTabellenSicher(): Promise<{ zeilen: TabellenAnzeige; bytes: number } | null> {
  try {
    const tabellen = await ladeGroessteTabellen()
    return {
      zeilen: tabellen.map((t) => ({
        name: tabellenName(t.name),
        modell: t.name,
        zeilen: t.zeilen === null ? '–' : formatZahl(t.zeilen),
        groesse: speicherText(t.bytes),
        bleibt: tabellenBleibt(t.name),
      })),
      bytes: tabellen.reduce((summe, t) => summe + t.bytes, 0),
    }
  } catch (err) {
    Sentry.captureException(err, { level: 'warning', tags: { bereich: 'admin', seite: 'betrieb', teil: 'tabellen' } })
    return null
  }
}

/** Die Zahl am Unterreiter E-Mails (Nr. 161) — scheitert sie, steht der Reiter ohne Zahl da. */
async function zaehleProblemeSicher(jetzt: Date): Promise<number | null> {
  try {
    return await zaehleProbleme(jetzt)
  } catch (err) {
    Sentry.captureException(err, { level: 'warning', tags: { bereich: 'admin', seite: 'betrieb', teil: 'mails-zahl' } })
    return null
  }
}

async function ladeDaten(jetzt: Date) {
  const [messungen, warnungen, laeufe, letzte, tabellen, mailsOffen, antwortMs] = await Promise.all([
    ladeMessungenFuerSeite(jetzt),
    ladeWarnungen(),
    ladeLaeufe(),
    letzteMessungAm(),
    ladeTabellenSicher(),
    zaehleProblemeSicher(jetzt),
    messeAntwort(),
  ])
  const produktion = UMGEBUNG.vercelProduktion
  const kacheln = betriebKacheln(messungen, jetzt)
  const zeilen = ablaufZeilen(laeufe, jetzt)
  const verlauf = betriebVerlauf(messungen, jetzt)
  // Bilder ohne Verwendung nur in der Produktion (Nr. 104) — die Messung zählt sie nur dort.
  const ohneVerwendung = produktion ? ohneVerwendungKarte(messungen, jetzt) : null
  const ohneVerwendungBytes = ohneVerwendung && ohneVerwendung.bytes > 0 ? ohneVerwendung.bytes : null
  const eintraege = warnEintraege(warnungen, kacheln, zeilen, messungen, jetzt, produktion, ohneVerwendungBytes)
  const puenktlich = zeilen.filter((z) => z.stand === 'puenktlich').length
  // Karten „Dienste“ und „Version“ (Nr. 184): der Uptime-Dienst hat seine eigene Zeile, „Abläufe“ zählt nur die Crons.
  const crons = zeilen.filter((z) => z.name !== 'von-aussen')
  const datenbank = kacheln.find((k) => k.id === 'datenbank')
  const vonAussen = laeufe.get('von-aussen') ?? null
  const dienste = dienstZeilen(
    {
      stripe: STRIPE_MARKE,
      testbetrieb: TESTBETRIEB,
      mailWarnungOffen: warnungen.some((w) => w.stufe > 0 && istMailWarnArt(w.art)),
      datenbank: datenbank?.wert ? `${datenbank.wert} ${datenbank.von}` : null,
      antwortMs,
      ablaeufe: { puenktlich: crons.filter((z) => z.stand === 'puenktlich').length, von: crons.length, ausgefallen: crons.some((z) => z.stand === 'ueberfaellig' || z.stand === 'fehler') },
      vonAussen: { stand: zeilen.find((z) => z.name === 'von-aussen')?.stand ?? 'nochKeinLauf', gestartetAm: vonAussen?.gestartetAm ?? null },
    },
    jetzt
  )
  const sonstGruen = kacheln.filter((k) => k.warnt).length <= eintraege.length && zeilen.every((z) => z.stand === 'puenktlich' || z.stand === 'nochKeinLauf')
  return {
    produktion,
    gemessen: gemessenText(letzte, jetzt),
    kacheln,
    zeilen,
    verlauf,
    eintraege,
    ohneVerwendung,
    davonOhneVerwendung: ohneVerwendung && ohneVerwendungBytes !== null ? BETRIEB_TEXT.davonOhneVerwendung(ohneVerwendung.summe) : null,
    warnungBilder: ohneVerwendungBytes !== null && eintraege.some((e) => e.art === 'bilder'),
    gruen: sonstGruen ? BETRIEB_TEXT.grueneZone(puenktlich, ABLAEUFE.length) : BETRIEB_TEXT.ablaeufePuenktlich(puenktlich, ABLAEUFE.length),
    puenktlich: BETRIEB_TEXT.ablaeufePuenktlich(puenktlich, ABLAEUFE.length),
    vercel: vercelAusgabenKarte(messungen, jetzt),
    tabellen: tabellen?.zeilen ?? null,
    tabellenZusammen: tabellen === null ? null : BETRIEB_TEXT.tabellenZusammen(speicherText(tabellen.bytes)),
    mailsOffen,
    dienste,
  }
}

/**
 * /admin/betrieb — was die Plattform im Hintergrund braucht (Register N18
 * neu, N15 geändert; Nachtlauf Nr. 103; Mockups admin-betrieb und
 * mobil-admin-betrieb): Bilder-Speicher, Datenbank, E-Mails und Bild-Vorgänge
 * gegen die Grenze des Tarifs, der Verlauf von 90 Tagen, Tarife, die Abläufe
 * mit ihrem letzten Lauf, die größten Tabellen und „Messungen als CSV“.
 *
 * Nur lesend bis auf „Jetzt messen“ (Action, src/server/actions/betrieb.ts).
 * Gerechnet wird nichts hier — Kacheln, Verlauf, Abläufe und Warnkarte
 * entscheiden die reinen Funktionen in src/lib/betrieb.ts. Außerhalb der
 * Produktion sagt ein Satz oben, dass Bilder gemeinsam gemessen werden und
 * Abläufe nur in der Produktion laufen. Die Karte „Bilder ohne Verwendung“
 * (nur Liste, nur in der Produktion) und die Spalte „Bleibt“ kamen mit
 * Nr. 104; die Karte steht ab 1024 px rechts unter „Nur im Dashboard“, am
 * Handy unter den Abläufen. Seit Nr. 113 (Vercel Pro) zeigen Bilder und
 * Bild-Vorgänge keine Prozente mehr, und die Karte „Vercel-Ausgaben“ steht
 * rechts nach „Tarife und Grenzen“, am Handy als Klappkarte danach.
 * Seit Nr. 161 zwei Unterreiter: „Überblick“ (diese Seite) und „E-Mails“
 * (`?reiter=mails`, MailsAnsicht in mails-ansicht.tsx). Seit Nr. 167 darin
 * „Alle Mails“ (`?reiter=mails&liste=alle`, MailsAlle in mails-alle.tsx).
 * Seit Nr. 184 im Überblick die Karten „Dienste“ (je mit Prüfweg),
 * „Version“ und „Alarm-Matrix“ (Board admin-betrieb-neu; dienste.ts).
 * Seit Nr. 193 (Register N32/N33) die Unterreiter Überblick · E-Mails ·
 * Protokoll (`?reiter=protokoll`, ProtokollAnsicht) · Version
 * (`?reiter=version`, die Karte „Version“ aus dem Überblick); die Warnkarte
 * im Überblick verweist auf Heute, wo jede Aufgabe mit Frist steht.
 */
export default async function AdminBetriebPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<React.JSX.Element> {
  const ich = await verlangeAdminSeite()

  const jetzt = new Date()
  const parameter = await searchParams
  const reiter = betriebReiterAus(parameter.reiter)
  if (reiter === 'protokoll') return <ProtokollAnsicht f={protokollFilterAus(parameter)} ich={ich} jetzt={jetzt} mailsOffen={await zaehleProblemeSicher(jetzt)} />
  if (reiter === 'version') return <VersionAnsicht jetzt={jetzt} />
  if (reiter === 'mails') {
    const suche = typeof parameter.suche === 'string' ? parameter.suche : ''
    // Seit Nr. 167: „Alle Mails“ (`&liste=alle`) mit Filter, Detail und Nochmal schicken.
    const alle = alleMailsAus(parameter)
    if (alle.liste) return <MailsAlle jetzt={jetzt} p={alle} suche={mailSucheAus(parameter.suche)} sucheRoh={suche.slice(0, 254)} />
    return <MailsAnsicht jetzt={jetzt} suche={mailSucheAus(parameter.suche)} sucheRoh={suche.slice(0, 254)} alle={alleArtenAus(parameter.alle)} />
  }

  let daten: Awaited<ReturnType<typeof ladeDaten>> | null = null
  try {
    daten = await ladeDaten(jetzt)
  } catch (err) {
    Sentry.captureException(err, { tags: { bereich: 'admin', seite: 'betrieb' } })
  }

  if (!daten) {
    return (
      <div className={ADMIN_RAHMEN}>
        <AdminFehler titel={BETRIEB_TEXT.titel} satz={BETRIEB_TEXT.ladefehler} nochmal={ADMIN_BETRIEB_HREF} />
      </div>
    )
  }

  const verlaufInhalt = (
    <>
      <VerlaufDiagramm von={daten.verlauf.von} bis={daten.verlauf.bis} linien={daten.verlauf.linien} beschreibung={verlaufBeschreibung(daten.verlauf.linien)} />
      <p className={cn('text-[12.5px] leading-snug', LEISE)}>{BETRIEB_TEXT.verlaufFuss}</p>
    </>
  )

  return (
    <div className={cn(ADMIN_RAHMEN, 'flex flex-col gap-4 lg:gap-[18px]')}>
      <Seitenkopf
        titel={BETRIEB_TEXT.titel}
        satz={BETRIEB_TEXT.satz}
        rechts={
          <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 md:w-auto md:justify-end">
            <span className={cn('inline-flex items-center gap-1.5 text-[13px]', LEISE)}>
              <Clock className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              {daten.gemessen}
            </span>
            <JetztMessen texte={{ knopf: BETRIEB_TEXT.jetztMessen, misst: BETRIEB_TEXT.misst, fehler: BETRIEB_TEXT.messFehler }} />
          </div>
        }
      />

      <BetriebUnterreiter aktiv="ueberblick" offen={daten.mailsOffen}>
        {!daten.produktion && (
          <p className="flex items-start gap-2 rounded-xl border border-border bg-muted/50 px-3.5 py-2.5 text-[13px] leading-snug text-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
            {BETRIEB_TEXT.vorschauUmgebung}
          </p>
        )}

        {daten.eintraege.length > 0 && (
          <Warnkarte
            eintraege={daten.eintraege}
            gruen={daten.gruen}
            ohneVerwendung={daten.warnungBilder}
            aktionen={
              <Link href={ADMIN_HEUTE_HREF} className={cn(KNOPF_RAHMEN, 'font-semibold')}>
                {BETRIEB_TEXT.warnungInHeute}
              </Link>
            }
          />
        )}

        <Kacheln kacheln={daten.kacheln} ohneVerwendung={daten.davonOhneVerwendung} />

        {/* Nr. 184 (Board admin-betrieb-neu): ab 1024 px links Dienste und Version, rechts die Alarm-Matrix. */}
        <div className="hidden gap-[18px] lg:grid lg:grid-cols-2 lg:items-start">
          <div className="flex min-w-0 flex-col gap-[18px]">
            <Karte titel={DIENSTE_TEXT.titel} zusatz={DIENSTE_TEXT.zusatz}>
              <DiensteInhalt zeilen={daten.dienste} />
            </Karte>
          </div>
          <Karte titel={DIENSTE_TEXT.matrixTitel} zusatz={DIENSTE_TEXT.matrixZusatz}>
            <AlarmMatrixTabelle />
          </Karte>
        </div>

        {/* Ab 1024 px: links Verlauf, Abläufe, Tabellen; rechts Tarife und Dashboard (Mockup admin-betrieb). */}
        <div className="hidden gap-[18px] lg:grid lg:grid-cols-[minmax(0,1fr)_468px] lg:items-start">
          <div className="flex min-w-0 flex-col gap-[18px]">
            <Karte titel={BETRIEB_TEXT.verlaufTitel} zusatz={BETRIEB_TEXT.verlaufSatz} rechts={<VerlaufLegende linien={daten.verlauf.linien} />}>
              {verlaufInhalt}
            </Karte>
            <section aria-label={BETRIEB_TEXT.ablaeufeTitel} className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-baseline gap-x-2.5">
                <h2 className="font-heading text-[17px] font-semibold text-foreground">{BETRIEB_TEXT.ablaeufeTitel}</h2>
                <span className={cn('text-[12.5px]', LEISE)}>{BETRIEB_TEXT.ablaeufeSatz}</span>
              </div>
              <AblaeufeTabelle zeilen={daten.zeilen} />
              <AblaeufeRegel />
            </section>
            <Karte titel={BETRIEB_TEXT.tabellenTitel} zusatz={daten.tabellenZusammen ?? undefined}>
              <TabellenInhalt tabellen={daten.tabellen} />
            </Karte>
          </div>
          <div className="flex min-w-0 flex-col gap-[18px]">
            <Karte titel={BETRIEB_TEXT.tarifeTitel}>
              <TarifeInhalt stripeMarke={STRIPE_MARKE} />
            </Karte>
            <Karte titel={BETRIEB_TEXT.vercelTitel}>
              <VercelAusgabenInhalt karte={daten.vercel} />
            </Karte>
            <Karte titel={BETRIEB_TEXT.dashboardTitel}>
              <p className={cn('-mt-2 text-[13px] leading-snug', LEISE)}>{BETRIEB_TEXT.dashboardSatz}</p>
              <DashboardInhalt />
            </Karte>
            <BilderOhneVerwendung karte={daten.ohneVerwendung} produktion={daten.produktion} anker={OHNE_VERWENDUNG_ANKER.breit} />
          </div>
        </div>

        {/* Am Handy (Mockup mobil-admin-betrieb): Abläufe offen, der Rest zugeklappt. */}
        <div className="flex flex-col gap-3 lg:hidden">
          <AblaeufeListe zeilen={daten.zeilen} puenktlich={daten.puenktlich} />
          <Klappkarte titel={DIENSTE_TEXT.titel} zeile={DIENSTE_TEXT.zusatz}>
            <DiensteInhalt zeilen={daten.dienste} />
          </Klappkarte>
          <Klappkarte titel={DIENSTE_TEXT.matrixTitel} zeile={DIENSTE_TEXT.matrixZusatz}>
            <AlarmMatrixListe />
          </Klappkarte>
          <BilderOhneVerwendung karte={daten.ohneVerwendung} produktion={daten.produktion} anker={OHNE_VERWENDUNG_ANKER.handy} />
          <Klappkarte titel={BETRIEB_TEXT.verlaufTitel} zeile={verlaufKurz(daten.verlauf.linien)}>
            <VerlaufLegende linien={daten.verlauf.linien} />
            {verlaufInhalt}
          </Klappkarte>
          <Klappkarte titel={BETRIEB_TEXT.tarifeTitel} zeile={TARIFE_KURZ}>
            <TarifeInhalt stripeMarke={STRIPE_MARKE} />
          </Klappkarte>
          <Klappkarte titel={BETRIEB_TEXT.vercelTitel} zeile={daten.vercel.kurz}>
            <VercelAusgabenInhalt karte={daten.vercel} />
          </Klappkarte>
          <Klappkarte titel={BETRIEB_TEXT.tabellenTitel} zeile={daten.tabellenZusammen ?? BETRIEB_TEXT.tabellenLeer}>
            <TabellenInhalt tabellen={daten.tabellen} />
          </Klappkarte>
          <Klappkarte titel={BETRIEB_TEXT.dashboardTitel} zeile={BETRIEB_TEXT.dashboardKurz}>
            <p className={cn('text-[13px] leading-snug', LEISE)}>{BETRIEB_TEXT.dashboardSatz}</p>
            <DashboardInhalt />
          </Klappkarte>
        </div>

        <p className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] leading-snug', LEISE)}>
          <a href={BETRIEB_EXPORT_HREF} download className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-md font-semibold text-status-fertig underline-offset-2 hover:underline', FOKUS_RAHMEN)}>
            <Download className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            {BETRIEB_TEXT.csv}
          </a>
          <span>{BETRIEB_TEXT.csvSatz}</span>
        </p>
      </BetriebUnterreiter>
    </div>
  )
}

/**
 * Unterreiter „Version“ (Nr. 193, N32): Stand, Migration und Nachtlauf — die
 * Karte, die bis dahin im Überblick stand (Nr. 184, dienste.ts). Scheitert das
 * Lesen der Migration, steht dort „nicht lesbar“ (ladeLetzteMigration).
 */
async function VersionAnsicht({ jetzt }: { jetzt: Date }): Promise<React.JSX.Element> {
  const [migration, mailsOffen] = await Promise.all([ladeLetzteMigration(), zaehleProblemeSicher(jetzt)])
  const version = versionZeilen(env.VERCEL_GIT_COMMIT_SHA ?? null, UMGEBUNG.branch, migration, jetzt)
  return (
    <div className={cn(ADMIN_RAHMEN, 'flex flex-col gap-4 lg:gap-[18px]')}>
      <Seitenkopf titel={BETRIEB_TEXT.titel} satz={BETRIEB_TEXT.satz} />
      <BetriebUnterreiter aktiv="version" offen={mailsOffen}>
        <div className="max-w-[720px]">
          <Karte titel={DIENSTE_TEXT.versionTitel} zusatz={DIENSTE_TEXT.versionZusatz}>
            <VersionInhalt zeilen={version} />
          </Karte>
        </div>
      </BetriebUnterreiter>
    </div>
  )
}
