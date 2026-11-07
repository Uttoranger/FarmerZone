import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getFarmBannerState } from '@/server/queries/farm'
import { barFristSatz, getBestellungenSeite, getHofBestellDetail, ladeBestellGeldsatz, naechstesFensterMitZahl } from '@/server/queries/orders'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'
import { hofBestellFilterAus, hofBestellWunschAus } from '@/schemas/hof-bestellungen'
import { BestellungenAnsicht } from '@/components/hof-bestellungen/bestellungen-ansicht'
import { MARKE } from '@/lib/marke'
import { hofWartetAufFreigabe, naechsteAbholungSatz } from '@/lib/heute'
import { wienKalendertag } from '@/lib/kalender'

export const metadata: Metadata = {
  title: `Bestellungen — ${MARKE}`,
}

export const dynamic = 'force-dynamic'

/*
 * Laufzeit der Funktion: „Artikel fehlt" hält eine Transaktion bis
 * TRANSAKTION_MS (42 s, src/server/artikel-fehlt.ts) plus bis zu 10 s Warten
 * auf eine Verbindung. Die Server Actions laufen mit der Laufzeit dieser Seite
 * — endete die Funktion vorher, rollte die Datenbank zurück, während Stripe
 * schon gebucht hat (der nächste Versuch trüge nach, aber der Hof sähe einen
 * Fehler). Vercel: Hobby erlaubt bis 60 s, Pro mehr — beim Plan prüfen.
 * tests/teilerstattung.test.ts hält die Rechnung fest.
 */
export const maxDuration = 60

/*
 * Bestellungen in der HofShell (Gate 5, Nachtlauf Nr. 19; Mockups
 * web-h3-bestellungen-packen-uebergeben, mobil-h3-bestellungen). Die Shell
 * kommt aus dem Layout der Routengruppe (hof). Ab 1024 px steht rechts die
 * gewählte Bestellung als kompakte Vorschau (Board w1-bestellungen): die aus
 * `?bestellung=`, wenn sie in der Liste steht, sonst die erste; am Handy nur
 * die Liste — eine Zeile führt in die Bestellung (/orders/[orderId]).
 */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string | string[]; bestellung?: string | string[] }>
}): Promise<React.JSX.Element> {
  const { userId } = await verlangeHofDerSitzung()

  const farm = await getFarmForUser(userId)
  if (!farm) redirect('/onboarding')

  // Frist gilt beim Lesen: Verwaiste Bestellungen geben ihre Ware frei, bevor
  // die Seite Bestand und Bestellungen zeigt (src/lib/fristen.ts). Fehler nur gemeldet.
  await gibVerwaisteFreiOhneRisiko(farm.id)

  const suche = await searchParams
  const filter = hofBestellFilterAus(suche.filter)
  const jetzt = new Date()
  const seite = await getBestellungenSeite(farm.id, filter, jetzt)
  // Nur eine Bestellung aus der eigenen Liste wird gewählt — eine fremde oder alte ID fällt still auf die erste.
  const wunsch = hofBestellWunschAus(suche.bestellung)
  const inListe = seite.gruppen.flatMap((g) => g.bestellungen)
  const gewaehlt = inListe.find((b) => b.id === wunsch) ?? inListe[0]
  const detail = gewaehlt ? await getHofBestellDetail(farm, gewaehlt.id, jetzt) : null
  const [barFrist, geldsatz] = detail ? await Promise.all([barFristSatz(farm.id, detail, jetzt), ladeBestellGeldsatz(farm.id, detail.id, jetzt)]) : [null, null]

  // „Heute abholen" leer (Board s1-bestellungen, Bild 2): die nächste Abholung samt ihrer Zahl, wie auf Heute.
  const naechstes = filter === 'heute' && seite.gruppen.length === 0 && seite.hatBestellungen ? await naechstesFensterMitZahl(farm.id, jetzt) : null
  const naechsteAbholung = naechstes ? naechsteAbholungSatz(naechstes.fenster, naechstes.anzahl, wienKalendertag(jetzt)) : null

  // Noch nie eine Bestellung: der Leerzustand je Stand (Board s1-bestellungen Bild 3) — nur dann gefragt.
  // Der vorhandene Baustein liefert Freigabe UND Stilllegung; ein stillgelegter Hof wartet nicht auf die Freischaltung.
  const wartet = seite.hatBestellungen ? false : hofWartetAufFreigabe(await getFarmBannerState(userId))

  return (
    <BestellungenAnsicht
      seite={seite}
      filter={filter}
      detail={detail}
      modus="liste"
      hofName={farm.name}
      barFrist={barFrist}
      naechsteAbholung={naechsteAbholung}
      wartetAufFreigabe={wartet}
      geldsatz={geldsatz}
    />
  )
}
