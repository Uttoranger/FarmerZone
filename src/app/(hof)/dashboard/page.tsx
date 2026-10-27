import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import { getFarmForUser, ladeDeinenBeitrag } from '@/server/queries/dashboard'
import { getHeute } from '@/server/queries/heute'
import { ladeFaedenHof } from '@/server/queries/postfach'
import { heutePostfach } from '@/lib/postfach'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'
import { ErsteSchritteSchalter } from '@/components/farmer/erste-schritte-schalter'
import {
  BrauchtDichKarte,
  HeuteKopf,
  Kennzahlen,
  NaechsteAbholungKarte,
  Packliste,
  PostfachKarte,
  StripeEinrichtenHinweis,
  StripeHinweis,
  TeamSperreKarte,
  TeilenKarte,
  WocheKarte,
  ZuTunKarte,
} from '@/components/heute/heute-teile'
import { FreischaltMoment } from '@/components/heute/freischalt-moment'
import { BeitragAnstoss, DeinBeitragKarte } from '@/components/heute/dein-beitrag'
import { StartbildschirmKarte } from '@/components/heute/startbildschirm-karte'
import { LastschriftSperreKarte } from '@/components/heute/lastschrift-karte'
import { ladeSperrKarte } from '@/server/queries/plattformgebuehr'
import { ERSTE_SCHRITTE_AUS_COOKIE, ersteSchritteAnzeige, ersteSchritteAusgeblendet } from '@/lib/erste-schritte'
import { beitragBlock, datumLang, entferneBeitragErinnerung, heuteAufbau, teilenSatz, vergleichText, type HeuteBlock } from '@/lib/heute'
import { freischaltMomentMoeglich } from '@/lib/freischalt-moment'
import { getTeilenFensterDaten } from '@/server/queries/teilen-bild'
import { getTeilenWirkung } from '@/server/queries/teilen-wirkung'
import { letzteTage, teilenWirkungSatz } from '@/lib/teilen-wirkung'
import { cn } from '@/lib/utils'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = {
  title: `Heute — ${MARKE}`,
}

/*
 * Heute — der Startbildschirm des Hofs, in der HofShell (Gate 5, Nachtlauf
 * Nr. 17; Mockups web-h3-heute-mit-teilen-karte, web-h3-heute-online-zahlung-
 * pausiert, mobil-h3-heute-*, web-h1-freigeschaltet-jetzt-teilen). Die Shell
 * kommt aus dem Layout der Routengruppe (hof), Zugang und Zahlen aus
 * ladeHofbereich.
 *
 * Packliste zuerst: Was wo steht, entscheidet heuteAufbau; Regeln und Zahlen
 * kommen aus src/lib/heute.ts und src/server/queries/heute.ts, hier wird nur
 * angeordnet. Oben höchstens EIN Kasten (Stripe), die Teilen-Zeile kompakt
 * zuletzt in der Hauptspalte, nach Packliste und „Braucht dich" (freigabe.md
 * §12 Nr. 45, Register N11). „Zu tun" ist EINE Liste statt
 * Erster Schritte und „Deine Hofseite" (Nr. 53). Ab 1280 px zwei Spalten
 * (Hauptspalte links, Seitenspalte 360 px rechts) — bei 1024 px neben der
 * Seitenleiste wäre die Packliste zu schmal, dort steht die Seitenspalte als
 * Raster darunter; „Zu tun" geht dort über beide Spalten.
 */
export default async function HeutePage(): Promise<React.JSX.Element> {
  const { userId } = await verlangeHofDerSitzung()

  const farm = await getFarmForUser(userId)
  if (!farm) redirect('/onboarding')

  // Ein Zeitpunkt für die ganze Seite: Datum, Tag, Woche und Zeitfenster passen zusammen.
  const jetzt = new Date()

  // Frist gilt beim Lesen: Verwaiste Bestellungen geben ihre Ware frei, bevor
  // die Seite Bestand und Bestellungen zeigt (src/lib/fristen.ts). Fehler nur
  // gemeldet. Bewusst VOR der Antwort, nicht per after(): Packliste,
  // „überfällig", „ausverkauft" und das Angebot der Teilen-Karte zeigten sonst
  // eine verfallene Bestellung und ihre noch gebundene Ware. getHeute wartet
  // nur mit diesen Abfragen auf die Freigabe, alle anderen laufen daneben
  // (Nachtlauf Nr. 31); der Cookie ebenso.
  const [heute, cookieJar, faeden, deinBeitrag, sperrKarte] = await Promise.all([
    getHeute(farm.id, jetzt, gibVerwaisteFreiOhneRisiko(farm.id, jetzt)),
    cookies(),
    // Postfach (Register N12, Nr. 87): Ein Ladefehler nimmt nur die Karte weg, nie Heute — gemeldet ohne Nachrichtentext.
    ladeFaedenHof(farm.id).catch((err: unknown) => {
      Sentry.captureException(err, { tags: { bereich: 'postfach', seite: 'heute' }, extra: { farmId: farm.id } })
      return []
    }),
    // „Dein Beitrag“ (Register E12, Nr. 129): Ein Ladefehler nimmt nur den Block weg, nie Heute.
    ladeDeinenBeitrag(farm.id, jetzt).catch((err: unknown) => {
      Sentry.captureException(err, { tags: { bereich: 'dein-beitrag', seite: 'heute' }, extra: { farmId: farm.id } })
      return null
    }),
    // Barzahlung pausiert nach offener Plattformgebühr (Register N38, Nr. 198): ein Ladefehler nimmt nur die Karte weg.
    ladeSperrKarte(farm.id, jetzt).catch((err: unknown) => {
      Sentry.captureException(err, { tags: { bereich: 'monatsabrechnung', seite: 'heute' }, extra: { farmId: farm.id } })
      return null
    }),
  ])
  const postfach = heutePostfach(faeden, jetzt)

  // Der Cookie entscheidet auf dem Server, ob die Karte oder die Zeile
  // „Zu tun einblenden" kommt — so blitzt nichts auf und nichts rutscht nach.
  const zuTunZeigen = ersteSchritteAnzeige(
    heute.zuTun,
    ersteSchritteAusgeblendet(cookieJar.get(ERSTE_SCHRITTE_AUS_COOKIE)?.value, farm.id)
  )

  // Teilen nur, solange Kunden den Hof sehen und bei ihm bestellen können (heuteHofSichtbar).
  const teilen = heute.hof.sichtbar
  // Karte mit dem laufenden Beitrag, der Anstoß oder nichts (beitragBlock).
  const beitragArt = deinBeitrag ? beitragBlock(deinBeitrag) : null
  // Steht der Anstoß, entfällt in „Braucht dich“ die Erinnerung an einen Beitrag (N11, Nr. 134): nie zwei Erinnerungen an dieselbe Sache.
  const brauchtDichEintraege = entferneBeitragErinnerung(heute.brauchtDich, beitragArt)
  const aufbau = heuteAufbau({
    // „pausiert" (Notbremse) oder „einrichten" (Register Z1) — nie beide; der eine Kasten oben, auch über dem Balken der Shell.
    // Dieselbe Antwort nimmt die Online-Zahlung aus „Zu tun" (getHeute rechnet sie einmal).
    stripeHinweis: heute.stripeImKasten,
    teilen,
    zuTun: zuTunZeigen === 'karte',
    postfach: postfach !== null,
    beitrag: beitragArt !== null,
  })
  const satz = teilenSatz(heute.angebot, heute.naechstesFenster?.fenster ?? null)
  // Teilen-Fenster und „letzte Woche … über deine Links" (Nr. 21, Gate 7) —
  // nur, wenn die Zeile überhaupt steht.
  const [fenster, wirkung] = teilen
    ? await Promise.all([getTeilenFensterDaten(farm.id, jetzt), getTeilenWirkung(farm.id, letzteTage(jetzt, 7))])
    : [null, null]
  const wirkungSatz = wirkung ? teilenWirkungSatz(wirkung) : null

  const bloecke: Record<HeuteBlock, ReactNode> = {
    postfach: postfach && <PostfachKarte nachricht={postfach.nachricht} weitere={postfach.weitere} />,
    stripe: heute.onlinePausiert ? (
      <StripeHinweis barMoeglich={heute.onlinePausiert.barMoeglich} />
    ) : (
      heute.stripeEinrichten && <StripeEinrichtenHinweis />
    ),
    beitrag:
      beitragArt === 'karte' && deinBeitrag?.aktiv ? (
        <DeinBeitragKarte beitrag={deinBeitrag.aktiv} hofSlug={farm.slug} jetzt={jetzt.toISOString()} />
      ) : (
        beitragArt === 'anstoss' && <BeitragAnstoss />
      ),
    teilen: teilen && <TeilenKarte hofName={farm.name} hofSlug={farm.slug} satz={satz} fenster={fenster} wirkung={wirkungSatz} />,
    packliste: (
      <Packliste
        zeilen={heute.abholungen}
        zuPacken={heute.zahlen.zuPacken}
        naechsteAbholung={heute.naechsteAbholung}
        leer={{ abholfenster: heute.naechstesFenster?.fenster ?? null }}
      />
    ),
    'braucht-dich': <BrauchtDichKarte eintraege={brauchtDichEintraege} packlisteLeer={heute.abholungen.length === 0} />,
    'zu-tun': (
      <ZuTunKarte
        aufgaben={heute.zuTun.aufgaben}
        wartetAufFreigabe={heute.wartetAufFreigabe}
        ausblenden={<ErsteSchritteSchalter richtung="aus" />}
      />
    ),
    'naechste-abholung': (
      <NaechsteAbholungKarte fenster={heute.naechstesFenster?.fenster ?? null} anzahl={heute.naechstesFenster?.anzahl ?? 0} />
    ),
    woche: (
      <WocheKarte
        summeCent={heute.woche.dieseWocheCent}
        vergleich={vergleichText(heute.woche.prozent, jetzt)}
        balken={heute.wochenBalken}
      />
    ),
  }
  // „Zu tun" geht im Raster der Seitenspalte (768–1279 px) über beide Spalten — sonst bliebe neben der Woche ein Loch.
  const zeige = (ids: HeuteBlock[]) =>
    ids.map((id) => (
      <div key={id} className={cn('min-w-0', id === 'zu-tun' && 'md:col-span-2 xl:col-span-1')}>
        {bloecke[id]}
      </div>
    ))

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-5 pb-12 md:px-8 md:pt-8 xl:px-10">
      <div className="flex flex-col gap-4 md:gap-5">
        {/* Die Sperre des Teams (N34, Nr. 187) steht über allem: Ohne sie kommt keine neue Bestellung. */}
        {farm.adminGesperrtAm && <TeamSperreKarte grund={farm.adminSperrGrund} />}
        {sperrKarte && <LastschriftSperreKarte abrechnungId={sperrKarte.abrechnungId} monatText={sperrKarte.monatText} />}
        {zeige(aufbau.oben)}
        <HeuteKopf datum={datumLang(jetzt)} abholungHeute={heute.abholfensterHeute} />
        <Kennzahlen
          bestellungen={heute.zahlen.bestellungen}
          zuPacken={heute.zahlen.zuPacken}
          umsatzHeuteCent={heute.zahlen.umsatzHeuteCent}
        />
        <div className="flex flex-col gap-4 md:gap-5 xl:flex-row xl:items-start xl:gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-4 md:gap-5">{zeige(aufbau.haupt)}</div>
          <div className="grid gap-4 md:grid-cols-2 md:gap-5 xl:w-[360px] xl:shrink-0 xl:grid-cols-1">{zeige(aufbau.seite)}</div>
        </div>
        {zuTunZeigen === 'zeile' && (
          <p className="text-center">
            <ErsteSchritteSchalter richtung="ein" />
          </p>
        )}
        {/* Ganz unten (Register N1): die Karte „auf den Startbildschirm legen" —
            nur im Browser, nicht in der installierten App; das entscheidet die
            Karte selbst nach dem Mounten. */}
        <StartbildschirmKarte />
      </div>

      {freischaltMomentMoeglich(heute.hof, jetzt) && (
        <FreischaltMoment farmId={farm.id} hofName={farm.name} hofSlug={farm.slug} />
      )}
    </div>
  )
}
