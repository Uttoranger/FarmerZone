/**
 * Testzahlungen aus den Auswertungen heraushalten (Register Z4, Nachtlauf Nr. 55).
 *
 * Bis zur Live-Schaltung läuft Stripe im Testmodus (Register Z2): Online-
 * Bestellungen aus dieser Zeit sind Testzahlungen, es floss kein echtes Geld.
 * Sie zählen nicht als Umsatz und nicht als Servicegebühr. Barbestellungen aus
 * derselben Zeit sind echt (das Geld wurde übergeben) und zählen immer.
 *
 * DIE REGEL: Zahlart online (`paymentMethod` ONLINE) UND angelegt vor dem
 * Stichtag (`createdAt` < STRIPE_LIVE_AB). Genau an der Grenze zählt die
 * Bestellung schon. Ohne Stichtag gibt es keine Testzahlung — alles bleibt wie
 * vor Nr. 55. „Karte bei Abholung" (ONSITE_CARD) kassiert der Hof selbst, das
 * Geld ist echt; die Regel nennt nur ONLINE.
 *
 * Eine Regel aus EINER Quelle in drei Formen, damit keine Summe sie anders
 * rechnet: die Prüfung (`istTestzahlung`), die Bedingung für Prisma
 * (`testzahlungWhere`, `ohneTestzahlungenWhere`) und der Baustein für rohes
 * SQL (`ohneTestzahlungenSql`). Wer Umsatz oder Gebühr summiert, nimmt eine
 * davon — nie einen eigenen Vergleich mit dem Stichtag
 * (tests/testzahlung-wache.test.ts).
 *
 * Rein: Der Stichtag kommt als Parameter. Gelesen wird die Variable nur in
 * src/lib/umgebung-server.ts (`STRIPE_LIVE_AB`), geprüft in
 * src/lib/umgebung.ts (`leseStripeLiveAb`). Nur Anzeige und Auswertung —
 * Bestellungen, Beträge, Checkout, Webhook, Erstattung und Storno kennen die
 * Regel nicht.
 */
import type { Prisma } from '@prisma/client'
import type { Zahlungsart } from '@/lib/servicegebuehr'
import { formatDatumLang } from '@/lib/format'
import { uhrzeitInWien } from '@/lib/fristen'

/** Die Zahlart, die vor dem Stichtag eine Testzahlung ist — der Weg über Stripe. */
export const TESTZAHLUNG_ZAHLART = 'ONLINE' satisfies Zahlungsart

/**
 * Was eine Seite an Summen zeigt — daran misst sich ihre Hinweiszeile: Sie
 * steht genau dann, wenn eine dieser Zahlen eine Testzahlung auslässt.
 *   umsatz          Fenster der Umsatzregel (abgeholte Bestellungen,
 *                   `umsatzBestellungWhere`), je Summe eines;
 *   gebuehrenMonat  Wiener Monat der „Servicegebühren dieses Monats"
 *                   (Bestelleingang, `topfVonBestellung`), nur auf der Auswertung.
 */
export type GezeigteSummen = {
  umsatz: readonly { von: Date; bis: Date }[]
  gebuehrenMonat?: { von: Date; bis: Date }
}

/** Was die Prüfung von einer Bestellung braucht. */
export type BestellungFuerTestzahlung = { paymentMethod: Zahlungsart; createdAt: Date }

/** Ist diese Bestellung eine Testzahlung? Ohne Stichtag nie. */
export function istTestzahlung(bestellung: BestellungFuerTestzahlung, stripeLiveAb: Date | null): boolean {
  if (stripeLiveAb === null) return false
  return bestellung.paymentMethod === TESTZAHLUNG_ZAHLART && bestellung.createdAt.getTime() < stripeLiveAb.getTime()
}

/** Dieselbe Regel als Prisma-Bedingung: genau die Testzahlungen (für den Hinweis „betrifft Bestellungen"). */
export function testzahlungWhere(stripeLiveAb: Date): Prisma.OrderWhereInput {
  return { paymentMethod: TESTZAHLUNG_ZAHLART, createdAt: { lt: stripeLiveAb } }
}

/**
 * Alles außer den Testzahlungen — zum Einmischen in eine Bedingung
 * (`{ ...andere, ...ohneTestzahlungenWhere(ab) }`). Ohne Stichtag ein leeres
 * Objekt: Die Bedingung bleibt Zeichen für Zeichen, wie sie vor Nr. 55 war.
 * `NOT` über beide Felder heißt „nicht (online UND vor dem Stichtag)" — beide
 * Spalten sind Pflicht, NULL kann die Verneinung nicht kippen.
 *
 * Als Element von `AND`, nicht als `NOT` oben: Ein `NOT`, das ein Aufrufer
 * danach selbst setzt (`{ ...umsatzBestellungWhere(…), NOT: … }`), ersetzte
 * sonst still die Regel. Wer selbst `AND` braucht, nimmt diese Bedingung als
 * eines seiner Elemente.
 */
export function ohneTestzahlungenWhere(stripeLiveAb: Date | null): Prisma.OrderWhereInput {
  return stripeLiveAb === null ? {} : { AND: [{ NOT: testzahlungWhere(stripeLiveAb) }] }
}

/**
 * Dieselbe Regel für rohes SQL über "Order" (Admin-Hofliste): ein Baustein
 * für die WHERE-Klausel, der Stichtag als gebundener Parameter, nie als Text.
 * Ohne Stichtag `TRUE` — die Abfrage zählt wie vor Nr. 55.
 *
 * Das Werkzeug `Prisma.sql` gibt der Aufrufer mit: src/lib bleibt so ohne die
 * Prisma-Laufzeit (ARCHITECTURE §1), und Bausteine wie Finanzen und Kunden,
 * die auch im Browser landen, ziehen sie nicht mit. 'ONLINE' steht als
 * Literal da, weil die Spalte ein Enum ist (ein Text-Parameter bräuchte eine
 * Umwandlung) — es ist TESTZAHLUNG_ZAHLART (tests/testzahlung.test.ts).
 */
export function ohneTestzahlungenSql(sql: typeof Prisma.sql, stripeLiveAb: Date | null): Prisma.Sql {
  if (stripeLiveAb === null) return sql`TRUE`
  return sql`NOT ("paymentMethod" = 'ONLINE' AND "createdAt" < ${stripeLiveAb})`
}

/**
 * Die leise Zeile in Auswertung, Verkäufe und Admin-Finanzen, wenn der
 * Stichtag Bestellungen betrifft: „Testzahlungen vor dem 2. November 2026,
 * 21:00 Uhr sind nicht mitgezählt." Mit Uhrzeit, weil der Stichtag ein
 * Zeitpunkt ist (Beginn des Redeploys) — am selben Tag davor angelegte
 * Online-Bestellungen zählen ebenfalls nicht. Wiener Zeit.
 */
export function testzahlungenHinweis(stripeLiveAb: Date): string {
  return `Testzahlungen vor dem ${formatDatumLang(stripeLiveAb)}, ${uhrzeitInWien(stripeLiveAb)} Uhr sind nicht mitgezählt.`
}
