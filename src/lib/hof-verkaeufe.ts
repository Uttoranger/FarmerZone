/**
 * Regeln der Seite Verkäufe (/sales, Nachtlauf Nr. 22b) — rein, ohne Browser
 * prüfbar (tests/hof-verkaeufe.test.ts). Die Abfrage (src/server/queries/
 * manual-sales.ts) mischt abgeholte Bestellungen und Direktverkäufe zu EINER
 * Liste (mergeSalesFeed); hier wird daraus, was eine Zeile zeigt — nur Text
 * und Zahlen, damit nichts roh an den Browser geht (CODING_STANDARDS §2).
 */
import type { SalesFeedEntry, SummableSale } from '@/lib/sales-summary'
import { isOnlinePaidOrder } from '@/lib/sales-summary'
import { CHANNEL_LABELS } from '@/schemas/manual-sale'
import { wienKalendertag } from '@/lib/kalender'
import { datumKurz } from '@/lib/verkauf-eintragen'

/**
 * Die Zeile unter der Wochenzahl (Register F6, 22b). Die Summe ist nicht der
 * ganze Umsatz, sondern das Wiener Kalenderjahr ohne Urproduktion
 * (`getYtdRevenue`, countsTowardLimit) — also das, was für die Umsatzgrenze
 * zählt. „Gesamt" versprach mehr, als die Zahl ist.
 */
export const JAHRESSUMME_TEXT = 'Dieses Jahr (für die Umsatzgrenze)'

/** Ein Direktverkauf, wie das Formular ihn zum Bearbeiten und Wiederholen braucht. */
export type VerkaufDaten = {
  id: string
  productId: string | null
  productName: string
  /** Menge ist Anzeige und Vorbelegung, kein Geld — als Zahl zulässig. */
  quantity: number
  unit: string | null
  /** Euro, aus ganzen Cent abgeleitet (centsAlsEuro) — nur Vorbelegung des Betragsfelds. */
  totalAmount: number
  channel: string
  /** Wiener Kalendertag JJJJ-MM-TT. */
  saleTag: string
  note: string | null
}

/**
 * Ein Direktverkauf im gemischten Feed. `totalAmount` trägt hier ganze Cent
 * (die Summen-Funktionen in sales-summary.ts rechnen einheitenlos), `saleDate`
 * ordnet die Liste.
 */
export type FeedVerkauf = SummableSale & { daten: VerkaufDaten }

export type VerkaufsMarke = { text: string; ton: 'fertig' | 'neutral' }

export type VerkaufsZeile =
  | {
      art: 'bestellung'
      schluessel: string
      href: string
      titel: string
      nummer: string
      unterzeile: string
      marke: VerkaufsMarke
      betragCent: number
      datum: string
    }
  | {
      art: 'verkauf'
      schluessel: string
      titel: string
      unterzeile: string
      kanal: string
      marke: VerkaufsMarke
      betragCent: number
      datum: string
      verkauf: VerkaufDaten
    }

/** Wie ein Verkaufsweg heißt — unbekannte Werte so, wie sie gespeichert sind. */
export function kanalText(kanal: string): string {
  return CHANNEL_LABELS[kanal] ?? kanal
}

/**
 * Die Zeilen der Liste „Letzte Verkäufe". Beträge in ganzen Cent (im Feed
 * tragen Bestellungen und Verkäufe beide Cent), der Tag nach Wiener Zeit
 * („Heute", „Gestern", „Fr, 25. Sep") — eine Abholung um 0:30 Uhr in Wien
 * steht so nicht im Gestern, wie es mit der Serverzeit (UTC) geschähe.
 */
export function verkaufsZeilen(feed: SalesFeedEntry<FeedVerkauf>[], jetzt: Date): VerkaufsZeile[] {
  const heute = wienKalendertag(jetzt)
  return feed.map((eintrag): VerkaufsZeile => {
    const datum = datumKurz(wienKalendertag(eintrag.when), heute)
    if (eintrag.kind === 'order') {
      const o = eintrag.order
      return {
        art: 'bestellung',
        schluessel: `bestellung-${o.id}`,
        href: `/orders/${o.id}`,
        titel: o.customerName,
        nummer: o.orderNumber,
        unterzeile: o.itemsLabel,
        marke: isOnlinePaidOrder(o) ? { text: 'Online', ton: 'fertig' } : { text: 'Bar · Abholung', ton: 'neutral' },
        betragCent: o.totalAmount,
        datum,
      }
    }
    const v = eintrag.sale
    return {
      art: 'verkauf',
      schluessel: `verkauf-${v.id}`,
      titel: v.daten.productName,
      unterzeile: 'Direktverkauf',
      kanal: v.daten.channel,
      marke: { text: kanalText(v.daten.channel), ton: 'neutral' },
      betragCent: v.totalAmount,
      datum,
      verkauf: v.daten,
    }
  })
}

/** „Wiederholen": die letzten Direktverkäufe der Liste als Vorlage — Bestellungen nicht. */
export function wiederholVorlagen(zeilen: VerkaufsZeile[], anzahl = 4): VerkaufDaten[] {
  return zeilen.flatMap((z) => (z.art === 'verkauf' ? [z.verkauf] : [])).slice(0, anzahl)
}

/** Ein Produkt zur Schnellwahl „Was?" — nur, was das Formular braucht. */
export type VerkaufProdukt = { id: string; name: string; unit: string }
