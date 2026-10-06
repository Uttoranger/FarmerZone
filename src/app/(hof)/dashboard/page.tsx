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
  StripeHinweis,
  TeilenKarte,
  WocheKarte,
} from '@/components/heute/heute-teile'
import { FreischaltMoment } from '@/components/heute/freischalt-moment'
import { ERSTE_SCHRITTE_AUS_COOKIE, ersteSchritteAnzeige, ersteSchritteAusgeblendet } from '@/lib/erste-schritte'
import { datumLang, heuteAufbau, teilenKarte, teilenSatz, vergleichText, type HeuteBlock } from '@/lib/heute'
import { freischaltMomentMoeglich } from '@/lib/freischalt-moment'
import { hofAdresse } from '@/lib/mein-hof'
import { APP_URL } from '@/lib/umgebung-server'

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
 * angeordnet. Ab 1280 px zwei Spalten (Hauptspalte links, Seitenspalte 360 px
 * rechts) — bei 1024 px neben der Seitenleiste wäre die Packliste zu schmal,
 * dort steht die Seitenspalte als Raster darunter.
 */
export default async function HeutePage(): Promise<React.JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/onboarding')

  // Frist gilt beim Lesen: Verwaiste Bestellungen geben ihre Ware frei, bevor
  // die Seite Bestand und Bestellungen zeigt (src/lib/fristen.ts). Fehler nur gemeldet.
  await gibVerwaisteFreiOhneRisiko(farm.id)

  // Ein Zeitpunkt für die ganze Seite: Datum, Tag, Woche und Zeitfenster passen zusammen.
  const jetzt = new Date()
  const heute = await getHeute(farm.id, jetzt)

  // Der Cookie entscheidet auf dem Server, ob die Karte oder die Zeile
  // „Erste Schritte einblenden" kommt — so blitzt nichts auf und nichts rutscht nach.
  const cookieJar = await cookies()
  const ersteSchritteZeigen = ersteSchritteAnzeige(
    heute.ersteSchritte,
    ersteSchritteAusgeblendet(cookieJar.get(ERSTE_SCHRITTE_AUS_COOKIE)?.value, farm.id)
  )

  const teilen = teilenKarte({ sichtbar: heute.hof.sichtbar, abholtag: heute.abholfensterHeute !== null })
  const aufbau = heuteAufbau({
    stripeHinweis: heute.onlinePausiert !== null,
    teilen,
    ersteSchritte: ersteSchritteZeigen === 'karte',
  })
  const satz = teilenSatz(heute.angebot, heute.naechstesFenster?.fenster ?? null)
  const adresse = hofAdresse(APP_URL, farm.slug).anzeige

  const bloecke: Record<HeuteBlock, ReactNode> = {
    stripe: heute.onlinePausiert && <StripeHinweis barMoeglich={heute.onlinePausiert.barMoeglich} />,
    'teilen-schmal': teilen && <TeilenKarte form="schmal" hofName={farm.name} hofSlug={farm.slug} satz={satz} adresse={adresse} />,
    'teilen-gross': teilen && <TeilenKarte form="gross" hofName={farm.name} hofSlug={farm.slug} satz={satz} adresse={adresse} />,
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

      {freischaltMomentMoeglich({ approvedAt: heute.hof.approvedAt, sichtbar: heute.hof.sichtbar }, jetzt) && (
        <FreischaltMoment farmId={farm.id} hofName={farm.name} hofSlug={farm.slug} />
      )}
    </div>
  )
}
