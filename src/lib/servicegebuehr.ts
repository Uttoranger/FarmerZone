/**
 * Servicegebühr — die Gebühr, die die KUNDIN auf den Warenpreis zahlt.
 *
 * Preismodell des Betreibers (Stand 16.09.2026): FarmerZone verrechnet die
 * Gebühr automatisch, der Hof behält immer 100 % Warenpreis. Online wird sie
 * bei der Zahlung einbehalten (application_fee_amount, /api/checkout); bar
 * kassiert der Hof Warenpreis plus Gebühr und schuldet die Gebühr der späteren
 * Monatsabrechnung. Nicht abgeholte Bestellungen kosten keine Gebühr.
 *
 * Rein und ohne Abhängigkeiten, damit Checkout (Server UND Anzeige im
 * Browser), Bestell-Snapshot, Erstattung und Admin-Anzeige EINE Rechnung
 * teilen. Alle Beträge in CENT (ganze Zahlen) — Euro-Floats hätten hier
 * nichts verloren, siehe order-totals.ts für das Float-Artefakt 3 × 1,10.
 */

/** Die Hofeinstellung, so wie sie im Schema steht (Farm.serviceFee*). */
export type ServicegebuehrEinstellung = {
  /** Prozentsatz auf den Warenpreis, z. B. 4.9 — Decimal aus Prisma erlaubt. */
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

/** Der kurze Hinweis neben der Zeile — EIN Wortlaut an allen Stellen. */
export const SERVICEGEBUEHR_HINWEIS =
  'Für Bereitstellung, Abwicklung und Zahlungsservice der Plattform — bei Online- und Barzahlung gleich.'

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
 * Berechnet die Servicegebühr für eine Bestellung.
 *
 * Gebührenfrei (0 Cent, Prozent null), wenn serviceFeeActiveFrom null ist oder
 * NACH dem Bestellzeitpunkt liegt. Sonst max(rund(warenpreis × Prozent / 100),
 * Mindestgebühr) — kaufmännisch auf ganze Cent gerundet (24,5 → 25).
 *
 * Die Rundung läuft in GANZEN ZAHLEN: Prozent als Hundertstel (4,9 % → 490),
 * Produkt in Zehntausendstel-Cent, dann +5000 und abschneiden. Math.round auf
 * einem Float käme bei 0,5-Fällen aus Darstellungsgründen mal so, mal so.
 */
export function berechneServicegebuehr(
  warenpreisCents: number,
  einstellung: ServicegebuehrEinstellung,
  bestellZeitpunkt: Date
): ServicegebuehrErgebnis {
  const giltAb = alsZeitpunkt(einstellung.serviceFeeActiveFrom)
  if (giltAb === null || giltAb.getTime() > bestellZeitpunkt.getTime()) {
    return { gebuehrCents: 0, prozentAngewendet: null }
  }

  const prozent = Math.max(0, alsZahl(einstellung.serviceFeePercent))
  const prozentHundertstel = Math.round(prozent * 100)
  const mindest = Math.max(0, Math.round(alsZahl(einstellung.serviceFeeMinCents)))
  const waren = Math.max(0, Math.round(warenpreisCents))

  const anteil = Math.floor((waren * prozentHundertstel + 5000) / 10000)
  const gebuehr = Math.max(anteil, mindest)

  return { gebuehrCents: gebuehr, prozentAngewendet: prozentHundertstel / 100 }
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
 * Die drei Zahlen jeder Bestellanzeige — ausschließlich aus dem SNAPSHOT der
 * Bestellung, nie aus der aktuellen Hofeinstellung. Deshalb bleibt eine
 * Bestellung unverändert, wenn der Betreiber die Gebühr später umstellt.
 */
export function bestellSummen(bestellung: BestellungMitGebuehr): BestellSummen {
  const warenpreisCents = Math.round(alsZahl(bestellung.totalAmount) * 100)
  const gebuehrCents = Math.max(0, Math.round(bestellung.serviceFeeCents))
  return { warenpreisCents, gebuehrCents, gesamtCents: warenpreisCents + gebuehrCents }
}

/** Cent → Euro-Zahl für die bestehenden formatEuro-Bausteine. */
export function centsAlsEuro(cents: number): number {
  return cents / 100
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

/** Vor-Ort-Zahlung (bar ODER Karte beim Hof): der Hof kassiert selbst. */
export function istVorOrtZahlung(paymentMethod: string): boolean {
  return paymentMethod === 'ONSITE_CASH' || paymentMethod === 'ONSITE_CARD'
}

/**
 * „Bar zu kassieren": Was der Hof bei einer Vor-Ort-Bestellung entgegennimmt —
 * Warenpreis PLUS Gebühr (die Gebühr schuldet er der Monatsabrechnung).
 * Für Online-Bestellungen null: da kassiert der Hof nichts.
 */
export function barZuKassierenCents(
  bestellung: BestellungMitGebuehr & { paymentMethod: string }
): number | null {
  if (!istVorOrtZahlung(bestellung.paymentMethod)) return null
  return bestellSummen(bestellung).gesamtCents
}

// ─── Admin: „Gebühr gilt ab" als Kalendertag in Wiener Ortszeit ──────────────

/**
 * Ein Kalendertag (JJJJ-MM-TT) → Mitternacht dieses Tages in Europe/Vienna,
 * als UTC-Zeitpunkt für die Datenbank. Der Betreiber denkt in Tagen („ab
 * 1. Oktober"), die Bestellung trägt einen Zeitpunkt — die Grenze muss um
 * Mitternacht WIENER Zeit liegen, nicht um Mitternacht UTC (das wäre 01:00
 * bzw. 02:00 Uhr in Wien, und eine Bestellung um 00:30 fiele auf die
 * falsche Seite).
 */
export function wienerMitternacht(kalendertag: string): Date | null {
  const treffer = /^(\d{4})-(\d{2})-(\d{2})$/.exec(kalendertag)
  if (!treffer) return null
  const [, j, m, t] = treffer
  const utcMitternacht = Date.UTC(Number(j), Number(m) - 1, Number(t), 0, 0, 0)
  if (Number.isNaN(utcMitternacht)) return null
  // Welche Stunde ist es in Wien, wenn in UTC Mitternacht ist? (1 oder 2)
  const wienStunde = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Vienna',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(new Date(utcMitternacht))
  )
  const ergebnis = new Date(utcMitternacht - wienStunde * 60 * 60 * 1000)
  // Plausibilität: das Ergebnis muss in Wien genau auf den gewünschten Tag fallen.
  if (kalendertagInWien(ergebnis) !== kalendertag) return null
  return ergebnis
}

/** Ein Zeitpunkt → sein Kalendertag in Wien als JJJJ-MM-TT (für <input type="date">). */
export function kalendertagInWien(zeitpunkt: Date): string {
  const teile = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Vienna',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(zeitpunkt)
  const wert = (typ: string) => teile.find((p) => p.type === typ)?.value ?? ''
  return `${wert('year')}-${wert('month')}-${wert('day')}`
}

/**
 * Die Grenzen des laufenden Kalendermonats in Wiener Zeit — [von, bis) als
 * UTC-Zeitpunkte für die Datenbank, dazu die Bezeichnung („September 2026").
 * Grundlage der Admin-Monatsspalten und später der Monatsabrechnung.
 */
export function monatsgrenzenWien(jetzt: Date): { von: Date; bis: Date; bezeichnung: string } {
  const [jahr, monat] = kalendertagInWien(jetzt).split('-').map(Number)
  const tag = (j: number, m: number) => `${j}-${String(m).padStart(2, '0')}-01`
  const von = wienerMitternacht(tag(jahr, monat))
  const bis = wienerMitternacht(monat === 12 ? tag(jahr + 1, 1) : tag(jahr, monat + 1))
  if (!von || !bis) throw new Error('Monatsgrenzen nicht bestimmbar')
  const bezeichnung = von.toLocaleDateString('de-AT', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Vienna',
  })
  return { von, bis, bezeichnung }
}

/**
 * Kurzfassung der Hofeinstellung für die Admin-Liste, z. B.
 * „4,9 % · mind. 0,50 € · gilt ab 01.10.2026" oder „gebührenfrei".
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
