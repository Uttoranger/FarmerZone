import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getHeute } from '@/server/queries/heute'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'
import { ErsteSchritteKarte } from '@/components/farmer/erste-schritte-karte'
import { ErsteSchritteSchalter } from '@/components/farmer/erste-schritte-schalter'
import {
  BrauchtDichKarte,
  HeuteKopf,
  HofseiteKarte,
  Kennzahlen,
  NaechsteAbholungKarte,
  Packliste,
  StripeEinrichtenHinweis,
  StripeHinweis,
  TeilenKarte,
  WocheKarte,
} from '@/components/heute/heute-teile'
import { FreischaltMoment } from '@/components/heute/freischalt-moment'
import { ERSTE_SCHRITTE_AUS_COOKIE, ersteSchritteAnzeige, ersteSchritteAusgeblendet } from '@/lib/erste-schritte'
import { datumLang, heuteAufbau, teilenSatz, vergleichText, type HeuteBlock } from '@/lib/heute'
import { freischaltMomentMoeglich } from '@/lib/freischalt-moment'
import { getTeilenFensterDaten } from '@/server/queries/teilen-bild'
import { getTeilenWirkung } from '@/server/queries/teilen-wirkung'
import { letzteTage, teilenWirkungSatz } from '@/lib/teilen-wirkung'

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
 * unter der Packliste (freigabe.md §12 Nr. 45). Ab 1280 px zwei Spalten
 * (Hauptspalte links, Seitenspalte 360 px rechts) — bei 1024 px neben der
 * Seitenleiste wäre die Packliste zu schmal, dort steht die Seitenspalte als
 * Raster darunter.
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
  // „Erste Schritte einblenden" kommt — so blitzt nichts auf und nichts rutscht nach.
  const ersteSchritteZeigen = ersteSchritteAnzeige(
    heute.ersteSchritte,
    ersteSchritteAusgeblendet(cookieJar.get(ERSTE_SCHRITTE_AUS_COOKIE)?.value, farm.id)
  )

  // Teilen nur, solange Kunden den Hof sehen und bei ihm bestellen können (heuteHofSichtbar).
  const teilen = heute.hof.sichtbar
  const aufbau = heuteAufbau({
    // „pausiert" (Notbremse) oder „einrichten" (Register Z1) — nie beide; wo er steht, entscheidet getHeute.
    stripe: heute.stripeOrt,
    teilen,
    ersteSchritte: ersteSchritteZeigen === 'karte',
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
    // Bestandskarte mit der Palette --app-*: im Geltungsbereich bekommt sie die Werte des Design-Systems.
    'erste-schritte': (
      <div data-app-palette="neu" className="[&>*]:mb-0">
        <ErsteSchritteKarte ergebnis={heute.ersteSchritte} wartetAufFreigabe={heute.wartetAufFreigabe} />
      </div>
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
    hofseite: <HofseiteKarte prozent={heute.hofseite.prozent} satz={heute.hofseite.satz} fertig={heute.hofseite.fertig} />,
  }
  const zeige = (ids: HeuteBlock[]) => ids.map((id) => <div key={id} className="min-w-0">{bloecke[id]}</div>)

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
        {ersteSchritteZeigen === 'zeile' && (
          <p className="text-center" data-app-palette="neu">
            <ErsteSchritteSchalter richtung="ein" className="px-3" />
          </p>
        )}
      </div>

      {freischaltMomentMoeglich(heute.hof, jetzt) && (
        <FreischaltMoment farmId={farm.id} hofName={farm.name} hofSlug={farm.slug} />
      )}
    </div>
  )
}
