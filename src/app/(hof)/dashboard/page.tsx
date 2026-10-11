import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getHeute } from '@/server/queries/heute'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'
import { ErsteSchritteSchalter } from '@/components/farmer/erste-schritte-schalter'
import {
  BrauchtDichKarte,
  HeuteKopf,
  Kennzahlen,
  NaechsteAbholungKarte,
  Packliste,
  StripeEinrichtenHinweis,
  StripeHinweis,
  TeilenKarte,
  WocheKarte,
  ZuTunKarte,
} from '@/components/heute/heute-teile'
import { FreischaltMoment } from '@/components/heute/freischalt-moment'
import { StartbildschirmKarte } from '@/components/heute/startbildschirm-karte'
import { ERSTE_SCHRITTE_AUS_COOKIE, ersteSchritteAnzeige, ersteSchritteAusgeblendet } from '@/lib/erste-schritte'
import { datumLang, heuteAufbau, teilenSatz, vergleichText, type HeuteBlock } from '@/lib/heute'
import { freischaltMomentMoeglich } from '@/lib/freischalt-moment'
import { getTeilenFensterDaten } from '@/server/queries/teilen-bild'
import { getTeilenWirkung } from '@/server/queries/teilen-wirkung'
import { letzteTage, teilenWirkungSatz } from '@/lib/teilen-wirkung'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Heute — FarmerZone',
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
 * unter der Packliste (freigabe.md §12 Nr. 45). „Zu tun" ist EINE Liste statt
 * Erster Schritte und „Deine Hofseite" (Nr. 53). Ab 1280 px zwei Spalten
 * (Hauptspalte links, Seitenspalte 360 px rechts) — bei 1024 px neben der
 * Seitenleiste wäre die Packliste zu schmal, dort steht die Seitenspalte als
 * Raster darunter; „Zu tun" geht dort über beide Spalten.
 */
export default async function HeutePage(): Promise<React.JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
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
  const [heute, cookieJar] = await Promise.all([
    getHeute(farm.id, jetzt, gibVerwaisteFreiOhneRisiko(farm.id, jetzt)),
    cookies(),
  ])

  // Der Cookie entscheidet auf dem Server, ob die Karte oder die Zeile
  // „Zu tun einblenden" kommt — so blitzt nichts auf und nichts rutscht nach.
  const zuTunZeigen = ersteSchritteAnzeige(
    heute.zuTun,
    ersteSchritteAusgeblendet(cookieJar.get(ERSTE_SCHRITTE_AUS_COOKIE)?.value, farm.id)
  )

  // Teilen nur, solange Kunden den Hof sehen und bei ihm bestellen können (heuteHofSichtbar).
  const teilen = heute.hof.sichtbar
  const aufbau = heuteAufbau({
    // „pausiert" (Notbremse) oder „einrichten" (Register Z1) — nie beide; der eine Kasten oben, auch über dem Balken der Shell.
    // Dieselbe Antwort nimmt die Online-Zahlung aus „Zu tun" (getHeute rechnet sie einmal).
    stripeHinweis: heute.stripeImKasten,
    teilen,
    zuTun: zuTunZeigen === 'karte',
  })
  const satz = teilenSatz(heute.angebot, heute.naechstesFenster?.fenster ?? null)
  // Teilen-Fenster und „letzte Woche … über deine Links" (Nr. 21, Gate 7) —
  // nur, wenn die Zeile überhaupt steht.
  const [fenster, wirkung] = teilen
    ? await Promise.all([getTeilenFensterDaten(farm.id, jetzt), getTeilenWirkung(farm.id, letzteTage(jetzt, 7))])
    : [null, null]
  const wirkungSatz = wirkung ? teilenWirkungSatz(wirkung) : null

  const bloecke: Record<HeuteBlock, ReactNode> = {
    stripe: heute.onlinePausiert ? (
      <StripeHinweis barMoeglich={heute.onlinePausiert.barMoeglich} />
    ) : (
      heute.stripeEinrichten && <StripeEinrichtenHinweis />
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
    'braucht-dich': <BrauchtDichKarte eintraege={heute.brauchtDich} />,
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
        {/* Ganz unten (Register N1): „Leg FarmerZone auf den Startbildschirm" —
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
