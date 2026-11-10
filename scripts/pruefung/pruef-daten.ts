/**
 * Was der Prüf-Seed zusätzlich anlegt (Nr. 262, Auftrag Lauf 33 6.1) — rein,
 * ohne Datenbank, damit die Tests es ohne Postgres prüfen.
 *
 * Alles hier ist erfunden: Namen wie „Hof Müller“, Adressen @example.com,
 * Telefonnummern genullt (TESTING_GUIDELINES §5). Beträge stehen hier NIE:
 * Preise sind Produktpreise wie im Seed; was eine Bestellung kostet, rechnet
 * `bestellSnapshot` mit den Funktionen, die /api/checkout benutzt.
 */
import { calcLineTotal, calcPlatformFeeAmount, calcTotalAmount, decimalZuCents, alsCents, type DecimalEingabe } from '../../src/lib/order-totals'
import { GEBUEHR_MODELL_HOFPREIS, bestellGebuehr, einzugFuer, mindestbestellwertErreicht, type GebuehrEinzug, type GebuehrLage } from '../../src/lib/plattformgebuehr'
import { berechneServicegebuehr, type ServicegebuehrEinstellung } from '../../src/lib/servicegebuehr'

/** Gründungsplätze in der Wegwerf-DB (E-026, Register K2/N48): 100, nie im Code oder in einer echten DB. */
export const PRUEF_GRUENDUNG_PLAETZE = 100

/**
 * Konten, die der Prüf-Seed ZUSÄTZLICH zum Seed anlegt. Die Sperre „nicht mehr
 * Konten als der Seed“ rechnet sie mit (`erwarteteKonten`), nie eine feste Zahl.
 */
export const PRUEF_KONTEN = [
  { email: 'bauer-wartet@example.com', name: 'Anna Beispiel', telefon: '+43 660 0000005', rolle: 'FARMER' as const },
] as const

/** Der Hof ohne Produkte, der auf die Freigabe wartet (6.1 g). */
export const PRUEF_HOF_WARTET = {
  slug: 'hof-am-bach',
  name: 'Hof Am Bach',
  inhaberEmail: 'bauer-wartet@example.com',
  adresse: 'Bachweg 1',
  plz: '5280',
  ort: 'Braunau am Inn',
} as const

/** Wie viele Konten eine Wegwerf-DB nach dem Prüf-Seed höchstens hat: Seed-Konten, Seed-Höfe, Prüf-Konten. */
export function erwarteteKonten(seed: { konten: readonly unknown[]; hoefe: readonly unknown[] }, pruef: readonly unknown[] = PRUEF_KONTEN): number {
  return seed.konten.length + seed.hoefe.length + pruef.length
}

// ─── Produkte (6.1 a, b) ──────────────────────────────────────────────────────

/** Eine Größe der Futter-Familie: alles lose (LOSE_BALLEN) — dafür reicht die LFBIS-Nummer des Pilothofs, BAES braucht es nicht. */
export type PruefFutterGroesse = { id: string; bezeichnung: string; preis: string; bestand: number; nettoKg: number }

export const PRUEF_FUTTER_FAMILIE = {
  hofSlug: 'hof-mueller',
  name: 'Wiesenheu',
  category: 'HEU_STROH' as const,
  subcategory: 'WIESENHEU' as const,
  zusammensetzung: 'Wiesenheu, erster Schnitt, aus eigenem Anbau',
  analytischeBestandteile: 'Rohprotein 9 %, Rohfaser 28 %',
  groessen: [
    { id: 'prod-pruef-heu-klein', bezeichnung: 'Kleinballen', preis: '5.50', bestand: 40, nettoKg: 15 },
    { id: 'prod-pruef-heu-quader', bezeichnung: 'Quaderballen', preis: '58.00', bestand: 6, nettoKg: 320 },
    // „gerade nicht da“: in der Familie sichtbar, aber ohne Vorrat.
    { id: 'prod-pruef-heu-rund', bezeichnung: 'Rundballen', preis: '45.00', bestand: 0, nettoKg: 250 },
  ] satisfies PruefFutterGroesse[],
}

export type PruefBrennholz = {
  id: string
  name: string
  preis: string
  bestand: number
  holzart: string
  scheitlaengeCm: number
  trocknung: 'OFENFERTIG' | 'LUFTTROCKEN'
  restfeuchteMax: number
  ueberdacht: boolean
  /** Gelagert seit so vielen Tagen vor dem Seed-Lauf. */
  gelagertVorTagen: number
}

/** Brennholz je Raummeter (6.1 b): eines mit Vorrat, eines ausverkauft. */
export const PRUEF_BRENNHOLZ: readonly PruefBrennholz[] = [
  { id: 'prod-pruef-buche-rm', name: 'Buche Scheitholz', preis: '98.00', bestand: 8, holzart: 'Buche', scheitlaengeCm: 33, trocknung: 'OFENFERTIG', restfeuchteMax: 20, ueberdacht: true, gelagertVorTagen: 400 },
  { id: 'prod-pruef-fichte-rm', name: 'Fichte Scheitholz', preis: '72.00', bestand: 0, holzart: 'Fichte', scheitlaengeCm: 50, trocknung: 'LUFTTROCKEN', restfeuchteMax: 25, ueberdacht: false, gelagertVorTagen: 200 },
]

// ─── Postfach (6.1 c) ─────────────────────────────────────────────────────────

export const PRUEF_POSTFACH = {
  hofSlug: 'hof-mueller',
  unterhaltung: [
    { von: 'hof' as const, vorStunden: 30, text: 'Hallo Team, wie stelle ich meine Abholzeiten für die Feiertage um?' },
    { von: 'team' as const, vorStunden: 26, text: 'Hallo Franz, unter Einstellungen › Abholung kannst du einzelne Tage sperren. Sag Bescheid, wenn etwas fehlt.' },
    // Die jüngste Nachricht vom Team bleibt ungelesen (Lesestand des Hofs davor).
    { von: 'team' as const, vorStunden: 2, text: 'Kleiner Nachtrag: Gesperrte Tage siehst du auch in der Vorschau deiner Hofseite.' },
  ],
  rundschreiben: {
    titel: 'Neu: Abholzeiten für Feiertage',
    text: 'Ab sofort kannst du einzelne Tage sperren, ohne deine Abholzeiten zu ändern. Mehr dazu unter Einstellungen › Abholung.',
    vorStunden: 20,
  },
} as const

// ─── Abonnentin mit WhatsApp (6.1 d) ─────────────────────────────────────────

export const PRUEF_WHATSAPP_ABO = {
  hofSlug: 'hof-mueller',
  email: 'abo-whatsapp@example.com',
  telefon: '+43 660 0000006',
} as const

// ─── Snapshot einer Bestellung (6.1 f) ───────────────────────────────────────

/**
 * Die Felder, die /api/checkout beim Anlegen einer Bestellung als Snapshot
 * schreibt (Schritt 5 bis 9 der Route) — dieselbe Liste prüft der
 * Integrationstest gegen eine Bestellung über die Kasse.
 */
export const SNAPSHOT_FELDER_BESTELLUNG = [
  'totalAmount',
  'platformFeeAmount',
  'serviceFeeCents',
  'serviceFeePercentApplied',
  'serviceFeeMinCentsApplied',
  'gebuehrModell',
  'gebuehrEinzug',
  'kaeuferArt',
  'betriebsnummer',
] as const

export const SNAPSHOT_FELDER_POSITION = ['productId', 'productName', 'unitPrice', 'quantity', 'totalPrice', 'vatRate', 'gebuehrCents'] as const

export type SnapshotPosition = { productId: string; name: string; unitPrice: DecimalEingabe; quantity: number; vatRate: DecimalEingabe }

export type SnapshotHof = ServicegebuehrEinstellung & { platformFeePercent: DecimalEingabe }

export type BestellSnapshot = {
  totalAmount: ReturnType<typeof calcTotalAmount>
  platformFeeAmount: ReturnType<typeof calcPlatformFeeAmount>
  serviceFeeCents: number
  serviceFeePercentApplied: number | string | null
  serviceFeeMinCentsApplied: number | null
  gebuehrModell: string | null
  gebuehrEinzug: GebuehrEinzug | null
  kaeuferArt: 'PRIVAT'
  betriebsnummer: null
  items: Array<{
    productId: string
    productName: string
    unitPrice: DecimalEingabe
    quantity: number
    totalPrice: ReturnType<typeof calcLineTotal>
    vatRate: DecimalEingabe
    gebuehrCents: number
  }>
}

/**
 * 600 Hundertstel → „6.00“ — wie `hundertstelAlsDezimal` in /api/checkout
 * (dort nicht exportiert; die Route bleibt in diesem Lauf ohne Diff). Nur die
 * Schreibweise des Satzes für die Decimal-Spalte, kein Betrag.
 */
export function hundertstelAlsDezimal(hundertstel: number): string {
  return `${Math.floor(hundertstel / 100)}.${String(hundertstel % 100).padStart(2, '0')}`
}

/**
 * Der Snapshot einer neuen Bestellung, wie /api/checkout ihn schreibt —
 * Schritt 5 (Warenpreis, Plattformgebühr alt), 5b (`berechneServicegebuehr`,
 * Modell „bisher“) bzw. 5c (`einzugFuer`, `bestellGebuehr`, Modell „hofpreis“)
 * und 9 (Positionen mit `calcLineTotal` und Gebühr je Position). Jeder Betrag
 * kommt aus diesen Funktionen der App, keiner ist eingetippt. Wo die Kasse die
 * Bestellung ablehnte (Mindestbestellwert, bar ohne Einzugsweg), kommt der
 * Grund zurück und der Seed legt sie nicht an.
 */
export function bestellSnapshot(
  lage: GebuehrLage,
  hof: SnapshotHof,
  positionen: readonly SnapshotPosition[],
  zahlart: 'ONLINE' | 'ONSITE_CASH',
  jetzt: Date
): BestellSnapshot | { grund: string } {
  const totalAmount = calcTotalAmount(positionen)
  const platformFeeAmount = calcPlatformFeeAmount(totalAmount, hof.platformFeePercent)
  const warenpreisCents = decimalZuCents(totalAmount)
  let gebuehr: { gebuehrCents: number; prozent: number | string | null; mindestCents: number | null; modell: string | null; einzug: GebuehrEinzug | null; jePosition: number[] | null }
  if (lage.modell === 'hofpreis') {
    if (!mindestbestellwertErreicht(warenpreisCents)) return { grund: 'Mindestbestellwert nicht erreicht' }
    const einzug = einzugFuer(lage, zahlart, jetzt)
    if (einzug === null) return { grund: 'bar bei diesem Hof nicht möglich' }
    const summe = bestellGebuehr(positionen.map((p) => ({ preisCents: alsCents(p.unitPrice), menge: p.quantity })), lage.hundertstel)
    gebuehr = { gebuehrCents: summe.gebuehrCents, prozent: hundertstelAlsDezimal(lage.hundertstel), mindestCents: 0, modell: GEBUEHR_MODELL_HOFPREIS, einzug, jePosition: summe.jePosition }
  } else {
    const servicegebuehr = berechneServicegebuehr(warenpreisCents, hof, jetzt, zahlart)
    gebuehr = {
      gebuehrCents: servicegebuehr.gebuehrCents,
      prozent: servicegebuehr.prozentAngewendet,
      mindestCents: servicegebuehr.prozentAngewendet === null ? null : hof.serviceFeeMinCents,
      modell: null,
      einzug: null,
      jePosition: null,
    }
  }
  return {
    totalAmount,
    platformFeeAmount,
    serviceFeeCents: gebuehr.gebuehrCents,
    serviceFeePercentApplied: gebuehr.prozent,
    serviceFeeMinCentsApplied: gebuehr.mindestCents,
    gebuehrModell: gebuehr.modell,
    gebuehrEinzug: gebuehr.einzug,
    kaeuferArt: 'PRIVAT',
    betriebsnummer: null,
    items: positionen.map((p, index) => ({
      productId: p.productId,
      productName: p.name,
      unitPrice: p.unitPrice,
      quantity: p.quantity,
      totalPrice: calcLineTotal(p.unitPrice, p.quantity),
      vatRate: p.vatRate,
      gebuehrCents: gebuehr.jePosition?.[index] ?? 0,
    })),
  }
}

// ─── Bestellungen (6.1 f, h, i) ──────────────────────────────────────────────

export type PruefBestellung = {
  nummer: string
  zustand: string
  kundenEmail: 'kundin@example.com' | 'kunde@example.com'
  positionen: ReadonlyArray<{ produktId: string; menge: number }>
  zahlart: 'ONLINE' | 'ONSITE_CASH'
  status: 'PENDING_CONFIRMATION' | 'PAID' | 'CONFIRMED' | 'IN_PREPARATION' | 'READY'
  /** Eingang so viele Stunden vor dem Seed-Lauf. */
  eingangVorStunden: number
  /** Abholtag relativ zum Seed-Lauf (0 = heute in Wien). */
  abholTag: number
  /** Index der Position, die als „Artikel fehlt“ gemeldet ist (6.1 i). */
  fehlt?: number
}

/** Alle neuen Bestellungen am Pilothof (Modell nach Stichtag, beim Prüf-Seed „vergangenheit“ das Hofpreis-Modell). */
export const PRUEF_BESTELLUNGEN: readonly PruefBestellung[] = [
  // (f) Hofpreis-Modell: offene Barbestellung (Frist in der Zukunft) und eine online bezahlte.
  // Eingang 5 Minuten vor dem Seed: Die Bestätigungsfrist (fristVon, höchstens zwei Stunden) läuft
  // noch knapp zwei Stunden — sonst storniert das erste Lesen die Bestellung (Frist beim Lesen).
  { nummer: 'TP-HP-BAR', zustand: 'bar, wartet auf Bestätigung', kundenEmail: 'kundin@example.com', positionen: [{ produktId: 'prod-eier', menge: 3 }, { produktId: 'prod-milch', menge: 2 }], zahlart: 'ONSITE_CASH', status: 'PENDING_CONFIRMATION', eingangVorStunden: 5 / 60, abholTag: 2 },
  { nummer: 'TP-HP-ONLINE', zustand: 'online bezahlt', kundenEmail: 'kunde@example.com', positionen: [{ produktId: 'prod-pruef-heu-klein', menge: 4 }], zahlart: 'ONLINE', status: 'CONFIRMED', eingangVorStunden: 5, abholTag: 3 },
  // (h) Abholtag heute mit vier Bestellungen …
  { nummer: 'TP-HEUTE-1', zustand: 'heute, bestätigt', kundenEmail: 'kundin@example.com', positionen: [{ produktId: 'prod-milch', menge: 8 }], zahlart: 'ONSITE_CASH', status: 'CONFIRMED', eingangVorStunden: 30, abholTag: 0 },
  { nummer: 'TP-HEUTE-2', zustand: 'heute, gepackt', kundenEmail: 'kunde@example.com', positionen: [{ produktId: 'prod-eier', menge: 4 }], zahlart: 'ONLINE', status: 'READY', eingangVorStunden: 28, abholTag: 0 },
  { nummer: 'TP-HEUTE-3', zustand: 'heute, in Vorbereitung', kundenEmail: 'kundin@example.com', positionen: [{ produktId: 'prod-pruef-heu-klein', menge: 2 }], zahlart: 'ONLINE', status: 'IN_PREPARATION', eingangVorStunden: 26, abholTag: 0 },
  { nummer: 'TP-HEUTE-4', zustand: 'heute, bezahlt', kundenEmail: 'kunde@example.com', positionen: [{ produktId: 'prod-milch', menge: 2 }, { produktId: 'prod-eier', menge: 2 }], zahlart: 'ONLINE', status: 'PAID', eingangVorStunden: 20, abholTag: 0 },
  // … und ein künftiges Fenster mit Bestellungen.
  { nummer: 'TP-KUENFTIG-1', zustand: 'künftiges Fenster', kundenEmail: 'kundin@example.com', positionen: [{ produktId: 'prod-pruef-buche-rm', menge: 1 }], zahlart: 'ONLINE', status: 'CONFIRMED', eingangVorStunden: 10, abholTag: 4 },
  { nummer: 'TP-KUENFTIG-2', zustand: 'künftiges Fenster', kundenEmail: 'kunde@example.com', positionen: [{ produktId: 'prod-eier', menge: 5 }], zahlart: 'ONSITE_CASH', status: 'CONFIRMED', eingangVorStunden: 8, abholTag: 4 },
  // (i) online bezahlt, zwei Positionen, die zweite fehlt.
  { nummer: 'TP-FEHLT', zustand: 'online, Artikel fehlt', kundenEmail: 'kundin@example.com', positionen: [{ produktId: 'prod-milch', menge: 4 }, { produktId: 'prod-eier', menge: 2 }], zahlart: 'ONLINE', status: 'CONFIRMED', eingangVorStunden: 22, abholTag: 1, fehlt: 1 },
]

/** Platzhalter statt einer Stripe-ID — sieht nie wie eine echte aus. */
export function stripePlatzhalter(nummer: string): string {
  return `pi_pruefung_${nummer.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
}
