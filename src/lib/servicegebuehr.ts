/**
 * Servicegebühr — die Gebühr, die die KUNDIN auf den Warenpreis zahlt.
 *
 * Preismodell des Betreibers (Stand 16.09.2026): FarmerZone verrechnet die
 * Gebühr automatisch, der Hof behält immer 100 % Warenpreis. Online wird sie
 * bei der Zahlung einbehalten (application_fee_amount, /api/checkout); bar
 * kassiert der Hof Warenpreis plus Gebühr und schuldet die Gebühr der späteren
 * Monatsabrechnung. Nicht abgeholte Bestellungen kosten keine Gebühr.
 * Bis zum SEPA-Start (`BAR_SERVICEGEBUEHR_AB`, konditionen.ts) kostet eine
 * Barzahlung keine Gebühr (Register B1, `barOhneServicegebuehr`).
 *
 * Rein (ohne Prisma, ohne Uhr — der Zeitpunkt ist Parameter), damit Checkout (Server UND Anzeige im
 * Browser), Bestell-Snapshot, Erstattung und Admin-Anzeige EINE Rechnung
 * teilen. Alle Beträge in CENT (ganze Zahlen) — Euro-Floats hätten hier
 * nichts verloren, siehe order-totals.ts für das Float-Artefakt 3 × 1,10.
 */

import type { PaymentMethod } from '@prisma/client'
import { vorBarStichtag } from '@/lib/konditionen'
import { alsCents } from '@/lib/order-totals'
import { kalendertagInWien, wienerMitternacht } from '@/lib/wiener-tag'

/*
 * Weitergereicht, damit jeder Aufrufer die Gebühren-Werkzeuge an EINER Stelle
 * findet. Die Werte stehen in konditionen.ts (Satz für neue Höfe, E4),
 * wiener-tag.ts und format.ts — dort, weil konditionen.ts servicegebuehr.ts
 * nicht einbinden darf (sonst ein Ring, siehe wiener-tag.ts).
 */
export { SERVICEGEBUEHR_STANDARD_MIND_CENTS, SERVICEGEBUEHR_STANDARD_PROZENT } from '@/lib/konditionen'
export { centsAlsEuro } from '@/lib/format'
export { kalendertagInWien, wienerMitternacht } from '@/lib/wiener-tag'

/**
 * Die Zahlungsart einer Bestellung — das Prisma-Enum, nur als Typ eingebunden
 * (src/lib bleibt ohne Prisma-Client, ARCHITECTURE §1). Eng statt `string`:
 * Ein Tippfehler wie 'BAR' fiele sonst still durch die B1-Regel.
 */
export type Zahlungsart = PaymentMethod

/** Die Hofeinstellung, so wie sie im Schema steht (Farm.serviceFee*). */
export type ServicegebuehrEinstellung = {
  /** Prozentsatz auf den Warenpreis, z. B. 5 — Decimal aus Prisma erlaubt. */
  serviceFeePercent: number | string | { toString(): string }
  /** Mindestgebühr in Cent, z. B. 50. */
  serviceFeeMinCents: number
  /** null = gebührenfrei; ein Datum = Gebühr gilt für Bestellungen AB diesem Zeitpunkt. */
  serviceFeeActiveFrom: Date | string | null
}

export type ServicegebuehrErgebnis = {
  /** Die Gebühr in Cent — 0, wenn keine gilt. */
  gebuehrCents: number
  /** Der angewendete Prozentsatz für den Bestell-Snapshot; null bei 0 Cent. */
  prozentAngewendet: number | null
}

/** Die Zeile im Checkout, auf den Bestellseiten und in den Mails. */
export const SERVICEGEBUEHR_BEZEICHNUNG = 'Servicegebühr'

/**
 * Der kurze Hinweis neben der Zeile — EIN Wortlaut an allen Stellen. Früher
 * stand dahinter „bei Online- und Barzahlung gleich"; bis zum SEPA-Start
 * stimmt das nicht (B1: bar ohne Gebühr), deshalb fehlt der Zusatz.
 */
export const SERVICEGEBUEHR_HINWEIS = 'Für Bereitstellung, Abwicklung und Zahlungsservice der Plattform.'

/** Die Erklärung neben der Admin-Einstellung. */
export const SERVICEGEBUEHR_ADMIN_ERKLAERUNG =
  'Neue Höfe sind gebührenfrei, bis du hier ein Datum setzt. Bestehende Bestellungen bleiben unverändert.'

/** Der Vermerk im Bauern-Bereich, wenn die Stripe-Erstattung der Gebühr
 *  fehlgeschlagen ist — der Statuswechsel ist trotzdem durch. */
export const GEBUEHR_ERSTATTUNG_OFFEN_HINWEIS =
  'Servicegebühr-Erstattung ausstehend — bitte den Betreiber informieren.'

function alsZahl(wert: number | string | { toString(): string }): number {
  const n = typeof wert === 'number' ? wert : Number(wert.toString())
  return Number.isFinite(n) ? n : 0
}

function alsZeitpunkt(wert: Date | string | null): Date | null {
  if (wert === null) return null
  const d = wert instanceof Date ? wert : new Date(wert)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Register B1: Kostet diese Zahlung KEINE Servicegebühr, weil sie bar vor dem
 * SEPA-Start (`BAR_SERVICEGEBUEHR_AB`) bestellt wird? Maßgeblich ist der
 * Bestellzeitpunkt, die Grenze liegt um Mitternacht in Wien — genau an der
 * Grenze gilt die Gebühr schon (wie `serviceFeeActiveFrom`).
 *
 * Nur `ONSITE_CASH`: B1 nennt die Barzahlung. Online behält Stripe die Gebühr
 * ein; „Karte bei Abholung" (ONSITE_CARD) nimmt seit E5 keine neue Bestellung
 * mehr an, B1 sagt dazu nichts — sie bleibt, wie sie war.
 *
 * Dieselbe Frage stellt die Finanzseite (finanzen.ts, `topfVonBestellung`) und
 * die Admin-Hofliste in rohem SQL (queries/admin.ts): Eine Barbestellung vor
 * dem Stichtag bringt der Plattform nichts ein, auch eine ältere mit Gebühr
 * nicht — eingezogen wird sie nicht (B1).
 */
export function barOhneServicegebuehr(zahlungsart: Zahlungsart, bestellZeitpunkt: Date | string): boolean {
  const zeitpunkt = alsZeitpunkt(bestellZeitpunkt)
  // Unlesbarer Zeitpunkt: nicht befreien — die Gebühr folgt dann der Regel des Hofs.
  if (zeitpunkt === null) return false
  return zahlungsart === 'ONSITE_CASH' && vorBarStichtag(zeitpunkt)
}

/**
 * Berechnet die Servicegebühr für eine Bestellung — die EINZIGE Stelle, an der
 * aus Warenpreis und Hofeinstellung eine Gebühr wird. Checkout-Anzeige im
 * Browser, /api/checkout (Snapshot und Stripe) und der Seed rufen genau diese
 * Funktion; alles danach (Mails, Bestellseiten, Storno, Abrechnung) liest nur
 * noch den Snapshot `Order.serviceFeeCents` und rechnet nie neu.
 *
 * Die Zahlungsart ist Pflicht (B1): Bar vor `BAR_SERVICEGEBUEHR_AB` → 0 Cent,
 * Prozent null — derselbe Snapshot wie bei einem gebührenfreien Hof, damit
 * „Artikel fehlt" (E14) bei 0 bleibt. Online gilt immer die Regel unten.
 *
 * Gebührenfrei (0 Cent, Prozent null), wenn serviceFeeActiveFrom null ist oder
 * NACH dem Bestellzeitpunkt liegt. Sonst max(Mindestgebühr,
 * aufrunden(warenpreis × Prozent / 100)) — IMMER AUF den nächsten ganzen Cent
 * (E4, „Es wird aufgerundet"): 51,5 → 52, 50,05 → 51, glatte 100 bleiben 100.
 *
 * Die Rundung läuft in GANZEN ZAHLEN: Prozent als Hundertstel (5 % → 500),
 * Produkt in Zehntausendstel-Cent, dann ganzzahlig geteilt und bei jedem Rest
 * ein Cent dazu. Math.ceil auf einem Float käme bei glatten Beträgen einen
 * Cent zu hoch heraus: 3 € × 7 % ist als Float 21,000000000000004 → 22.
 */
export function berechneServicegebuehr(
  warenpreisCents: number,
  einstellung: ServicegebuehrEinstellung,
  bestellZeitpunkt: Date,
  zahlungsart: Zahlungsart
): ServicegebuehrErgebnis {
  if (barOhneServicegebuehr(zahlungsart, bestellZeitpunkt)) {
    return { gebuehrCents: 0, prozentAngewendet: null }
  }
  const giltAb = alsZeitpunkt(einstellung.serviceFeeActiveFrom)
  if (giltAb === null || giltAb.getTime() > bestellZeitpunkt.getTime()) {
    return { gebuehrCents: 0, prozentAngewendet: null }
  }

  const prozent = Math.max(0, alsZahl(einstellung.serviceFeePercent))
  const prozentHundertstel = Math.round(prozent * 100)
  const mindest = Math.max(0, Math.round(alsZahl(einstellung.serviceFeeMinCents)))
  const waren = Math.max(0, Math.round(warenpreisCents))

  // Zehntausendstel-Cent als ganze Zahl — exakt, solange das Produkt unter
  // 2^53 bleibt (bei 100 % wären das 90 Milliarden Euro Warenpreis).
  const zehntausendstel = waren * prozentHundertstel
  const anteil = Math.floor(zehntausendstel / 10000) + (zehntausendstel % 10000 > 0 ? 1 : 0)
  const gebuehr = Math.max(anteil, mindest)

  return { gebuehrCents: gebuehr, prozentAngewendet: prozentHundertstel / 100 }
}

/**
 * Der Satz, den die Hofseite VOR dem Bestellen nennt („Preise zzgl. 5 %
 * Servicegebühr, mind. € 0,50") — abgeleitet aus berechneServicegebuehr,
 * nicht daneben gerechnet: Bei Warenpreis 0 liefert sie genau die
 * Mindestgebühr und den angewendeten Satz, gebührenfrei `prozentAngewendet`
 * null. null heißt: Jetzt fällt keine Gebühr an (kein Datum, Datum in der
 * Zukunft oder Satz und Mindestgebühr 0) — dann steht auch kein Hinweis da.
 *
 * Gefragt wird nach der Online-Zahlung: Sie kostet immer nach der Regel des
 * Hofs. Dass bar bis zum SEPA-Start nichts dazukommt (B1), sagt die Kasse.
 */
export function servicegebuehrSatz(
  einstellung: ServicegebuehrEinstellung,
  jetzt: Date
): { prozent: number; mindestCents: number } | null {
  const { gebuehrCents, prozentAngewendet } = berechneServicegebuehr(0, einstellung, jetzt, 'ONLINE')
  if (prozentAngewendet === null) return null
  if (prozentAngewendet === 0 && gebuehrCents === 0) return null
  return { prozent: prozentAngewendet, mindestCents: gebuehrCents }
}

/** Ein Bestell-Snapshot, so weit ihn die Summen brauchen. */
export type BestellungMitGebuehr = {
  /** Der WARENPREIS in Euro (Order.totalAmount) — Decimal, String oder Zahl. */
  totalAmount: number | string | { toString(): string }
  /** Die Gebühr in Cent aus dem Snapshot (Order.serviceFeeCents). */
  serviceFeeCents: number
}

export type BestellSummen = {
  warenpreisCents: number
  gebuehrCents: number
  /** Was die Kundin zahlt: Warenpreis + Gebühr. */
  gesamtCents: number
}

/**
 * Der Warenpreis (Order.totalAmount, Decimal(10,2)) in ganzen Cent — über
 * `alsCents`, denselben Weg wie /api/checkout (`decimalZuCents`, der
 * Stripe-Betrag) und „Artikel fehlt" (Nr. 35, CODING_STANDARDS §2 Geld).
 * Für jeden Betrag mit höchstens zwei Nachkommastellen gleich wie früher
 * `Math.round(Zahl * 100)` (tests/bestellsummen-cent.test.ts).
 *
 * Unlesbares (leer, Text, NaN, unendlich) kommt aus der Datenbank nie; es
 * bleibt wie bisher 0 Cent, damit eine Bestellanzeige nicht an einem Wert aus
 * Testdaten oder JSON zerbricht. Decimal würde dort werfen.
 */
function warenpreisAlsCents(betrag: BestellungMitGebuehr['totalAmount']): number {
  const text = typeof betrag === 'number' ? String(betrag) : betrag.toString().trim()
  if (text === '' || !Number.isFinite(Number(text))) return 0
  return alsCents(text)
}

/**
 * Die drei Zahlen jeder Bestellanzeige — ausschließlich aus dem SNAPSHOT der
 * Bestellung, nie aus der aktuellen Hofeinstellung. Deshalb bleibt eine
 * Bestellung unverändert, wenn der Betreiber die Gebühr später umstellt.
 */
export function bestellSummen(bestellung: BestellungMitGebuehr): BestellSummen {
  const warenpreisCents = warenpreisAlsCents(bestellung.totalAmount)
  const gebuehrCents = Math.max(0, Math.round(bestellung.serviceFeeCents))
  return { warenpreisCents, gebuehrCents, gesamtCents: warenpreisCents + gebuehrCents }
}

/** Ein Bestellstand, so weit ihn der Erstattungs-Vermerk braucht. */
export type BestellungFuerGebuehrStatus = {
  status: string
  paymentMethod: string
  serviceFeeCents: number
  serviceFeeRefundedAt: Date | string | null
}

/**
 * Ist die Gebühr dieser Bestellung ENTFALLEN? (bar: nicht der Abrechnung
 * geschuldet; online: über Stripe erstattet.)
 */
export function gebuehrEntfallen(b: Pick<BestellungFuerGebuehrStatus, 'serviceFeeRefundedAt'>): boolean {
  return b.serviceFeeRefundedAt !== null && b.serviceFeeRefundedAt !== undefined
}

/**
 * Steht bei dieser Bestellung eine Stripe-Erstattung der Gebühr noch AUS?
 * Der Fall entsteht, wenn beim Wechsel auf „nicht abgeholt" die Erstattung
 * fehlschlägt: Der Status ist gesetzt (das darf nie an Stripe hängen), die
 * Gebühr aber noch nicht zurück. Abgeleitet statt gespeichert — kein
 * zusätzliches Feld, und der Vermerk verschwindet von selbst, sobald die
 * Erstattung nachgeholt und serviceFeeRefundedAt gesetzt ist.
 */
export function gebuehrErstattungOffen(b: BestellungFuerGebuehrStatus): boolean {
  return (
    b.status === 'NOT_PICKED_UP' &&
    b.paymentMethod === 'ONLINE' &&
    b.serviceFeeCents > 0 &&
    !gebuehrEntfallen(b)
  )
}

/**
 * Schuldet der Hof diese Gebühr der Monatsabrechnung? Nur wenn er sie vor Ort
 * kassiert, sie über 0 liegt und die Bestellung nicht bar vor dem SEPA-Start
 * aufgegeben wurde (Register B1: deren Gebühr wird nicht eingezogen, auch bei
 * einer älteren Bestellung, die noch eine trägt). Die EINE Frage hinter jedem
 * Hof-Satz „… holt / nimmt die Monatsabrechnung" (Bestellansicht, Dialog
 * „Artikel fehlt"); ohne sie steht der Satz nicht da.
 */
export function gebuehrFuerMonatsabrechnung(b: {
  paymentMethod: Zahlungsart
  serviceFeeCents: number
  bestelltAm: Date | string
}): boolean {
  return istVorOrtZahlung(b.paymentMethod) && b.serviceFeeCents > 0 && !barOhneServicegebuehr(b.paymentMethod, b.bestelltAm)
}

/** Vor-Ort-Zahlung (bar ODER Karte beim Hof): der Hof kassiert selbst. */
export function istVorOrtZahlung(paymentMethod: string): boolean {
  return paymentMethod === 'ONSITE_CASH' || paymentMethod === 'ONSITE_CARD'
}

/**
 * „Bar zu kassieren": Was der Hof bei einer Vor-Ort-Bestellung entgegennimmt —
 * Warenpreis PLUS Gebühr aus dem Snapshot (bar vor dem SEPA-Start ist sie 0, B1).
 * Für Online-Bestellungen null: da kassiert der Hof nichts.
 */
export function barZuKassierenCents(
  bestellung: BestellungMitGebuehr & { paymentMethod: string }
): number | null {
  if (!istVorOrtZahlung(bestellung.paymentMethod)) return null
  return bestellSummen(bestellung).gesamtCents
}

// ─── Admin: „Gebühr gilt ab" als Kalendertag in Wiener Ortszeit ──────────────

/*
 * `wienerMitternacht` und `kalendertagInWien` stehen in wiener-tag.ts und
 * werden oben weitergereicht.
 */

/**
 * Ein Kalendermonat als `JJJJ-MM` — die Form, in der die Adresse den Monat
 * trägt (`/admin/finanzen?monat=2026-09`) und in der ein Kostenposten sein
 * `ab` und `bis` nennt.
 *
 * Ein MONAT, kein Zeitpunkt: Erst `monatsgrenzenWienFuer` macht daraus die
 * beiden UTC-Zeitpunkte für die Datenbank. Wer mit einem Date rechnet, wo ein
 * Monat gemeint ist, verschiebt ihn irgendwann über die Zeitzonengrenze.
 */
export type Monatsschluessel = string

const MONATSMUSTER = /^(\d{4})-(0[1-9]|1[0-2])$/

/** Ist das ein gültiger Monatsschlüssel? (Zod und die Adressleiste fragen hier.) */
export function istMonatsschluessel(wert: string): boolean {
  return MONATSMUSTER.test(wert)
}

/** Jahr und Monat (1–12) → `2026-09`. */
export function monatsschluessel(jahr: number, monat: number): Monatsschluessel {
  return `${String(jahr).padStart(4, '0')}-${String(monat).padStart(2, '0')}`
}

/** `2026-09` → `{ jahr: 2026, monat: 9 }`, bei Unsinn null. */
export function zerlegeMonat(monat: Monatsschluessel): { jahr: number; monat: number } | null {
  const treffer = MONATSMUSTER.exec(monat)
  if (!treffer) return null
  return { jahr: Number(treffer[1]), monat: Number(treffer[2]) }
}

/**
 * Einen Monat um `schritte` Monate verschieben (negativ = zurück).
 * Gerechnet wird in Monaten seit Jahr 0, nicht mit einem Date — ein Date würde
 * beim 31. in einem 30-tägigen Monat überlaufen.
 */
export function monatVerschoben(monat: Monatsschluessel, schritte: number): Monatsschluessel {
  const teile = zerlegeMonat(monat)
  if (!teile) throw new Error('Kein Monatsschlüssel')
  const gesamt = teile.jahr * 12 + (teile.monat - 1) + schritte
  return monatsschluessel(Math.floor(gesamt / 12), (gesamt % 12) + 1)
}

/** Wie viele Monate liegen zwischen `von` und `bis`? (bis vor von = negativ.) */
export function monatsAbstand(von: Monatsschluessel, bis: Monatsschluessel): number {
  const a = zerlegeMonat(von)
  const b = zerlegeMonat(bis)
  if (!a || !b) throw new Error('Kein Monatsschlüssel')
  return (b.jahr - a.jahr) * 12 + (b.monat - a.monat)
}

/**
 * Die Grenzen EINES Kalendermonats in Wiener Zeit — [von, bis) als
 * UTC-Zeitpunkte für die Datenbank, dazu die Bezeichnung („September 2026").
 * Grundlage der Admin-Monatsspalten, der Finanzseite und der Monatsabrechnung.
 */
export function monatsgrenzenWienFuer(monat: Monatsschluessel): {
  von: Date
  bis: Date
  bezeichnung: string
} {
  const teile = zerlegeMonat(monat)
  if (!teile) throw new Error('Monatsgrenzen nicht bestimmbar')
  const tag = (m: Monatsschluessel) => `${m}-01`
  const von = wienerMitternacht(tag(monat))
  const bis = wienerMitternacht(tag(monatVerschoben(monat, 1)))
  if (!von || !bis) throw new Error('Monatsgrenzen nicht bestimmbar')
  const bezeichnung = von.toLocaleDateString('de-AT', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Vienna',
  })
  return { von, bis, bezeichnung }
}

/**
 * In welchem Kalendermonat liegt dieser Zeitpunkt — in WIENER Zeit?
 * Eine Bestellung am 30. September um 23:30 Uhr Wien ist 21:30 UTC und gehört
 * in den September; eine am 1. Oktober um 00:30 Wien ist 22:30 UTC am 30.
 * September und gehört trotzdem in den Oktober.
 */
export function monatsschluesselInWien(zeitpunkt: Date): Monatsschluessel {
  return kalendertagInWien(zeitpunkt).slice(0, 7)
}

/**
 * Die Grenzen des LAUFENDEN Kalendermonats in Wiener Zeit.
 * Dünne Hülle über `monatsgrenzenWienFuer`, damit es eine Rechnung bleibt.
 */
export function monatsgrenzenWien(jetzt: Date): { von: Date; bis: Date; bezeichnung: string } {
  return monatsgrenzenWienFuer(monatsschluesselInWien(jetzt))
}

/**
 * Kurzfassung der Hofeinstellung für die Admin-Liste, z. B.
 * „5,0 % · mind. 0,50 € · gilt ab 01.10.2026" oder „gebührenfrei".
 */
export function einstellungKurz(einstellung: ServicegebuehrEinstellung): string {
  const giltAb = alsZeitpunkt(einstellung.serviceFeeActiveFrom)
  if (giltAb === null) return 'gebührenfrei'
  const prozent = alsZahl(einstellung.serviceFeePercent).toLocaleString('de-AT', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })
  const mindest = (alsZahl(einstellung.serviceFeeMinCents) / 100).toLocaleString('de-AT', {
    style: 'currency',
    currency: 'EUR',
  })
  const tag = giltAb.toLocaleDateString('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Vienna',
  })
  return `${prozent} % · mind. ${mindest} · gilt ab ${tag}`
}
