/*
 * Auskunft als Export (Register N36, Nachtlauf Nr. 190) — je Art EINE reine
 * Funktion, die aus den gelesenen Zeilen die Datei baut. Die Liste der Felder
 * steht in docs/ai/ARCHITECTURE.md („Konto-Anfragen“); geladen wird in
 * src/server/actions/konto-anfragen.ts.
 *
 *  - Hof: Konto, Hof, Produkte, Abholzeiten, Beiträge, Postfach-Fäden, eigene
 *    Meldungen und die Bestellungen als Verkäufer — OHNE Daten der Kundschaft
 *    (kein Name, keine Adresse, keine Telefonnummer, keine Notiz der Kundin).
 *  - Kundschaft (genaue Adresse): Bestellungen, Abos, Sitzungen ohne IP. Die
 *    Funktion lässt jede Zeile weg, deren Adresse nicht genau passt — auch
 *    wenn die Abfrage sie fälschlich lieferte (keine Daten anderer Personen).
 *
 * Datum als ISO-Text, Geld als Text mit zwei Nachkommastellen bzw. Cent als
 * ganze Zahl — nie als Kommazahl (CODING_STANDARDS §2).
 */

export const AUSKUNFT_VERSION = 1

type Datum = Date | null

const iso = (d: Datum): string | null => (d ? d.toISOString() : null)

/** Geld aus der Datenbank (Decimal) als Text — ohne Rechnung. */
type Geldwert = { toFixed: (stellen: number) => string }
const geld = (wert: Geldwert | null): string | null => (wert === null ? null : wert.toFixed(2))

// ─── Hof ──────────────────────────────────────────────────────────────────────

export type AuskunftHofEingabe = {
  konto: { id: string; email: string; name: string | null; phone: string | null; emailVerified: boolean; createdAt: Date }
  hof: {
    id: string
    slug: string
    name: string
    ownerName: string
    description: string
    tagline: string | null
    aboutText: string | null
    address: string
    postalCode: string
    city: string
    country: string
    phone: string
    email: string
    betriebsnummer: string | null
    createdAt: Date
    approvedAt: Datum
    archivedAt: Datum
    geschlossenAm: Datum
  }
  produkte: Array<{ id: string; name: string; description: string | null; price: Geldwert; unit: string; stock: number; isAvailable: boolean; createdAt: Date }>
  abholzeiten: Array<{ dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }>
  beitraege: Array<{ id: string; title: string; body: string; publishedAt: Datum; createdAt: Date }>
  postfach: Array<{ id: string; createdAt: Date; nachrichten: Array<{ vonFarmId: string | null; text: string; art: string; createdAt: Date }> }>
  meldungen: Array<{ id: string; art: string; text: string; status: string; createdAt: Date }>
  bestellungen: Array<{
    id: string
    orderNumber: string
    status: string
    paymentMethod: string
    paymentStatus: string
    totalAmount: Geldwert
    createdAt: Date
    pickupDate: Datum
    items: Array<{ productName: string; quantity: number; unitPrice: Geldwert; totalPrice: Geldwert }>
  }>
}

export function auskunftHof(e: AuskunftHofEingabe, jetzt: Date) {
  return {
    art: 'auskunft-hof' as const,
    version: AUSKUNFT_VERSION,
    erstelltAm: jetzt.toISOString(),
    konto: { ...e.konto, createdAt: iso(e.konto.createdAt) },
    hof: { ...e.hof, createdAt: iso(e.hof.createdAt), approvedAt: iso(e.hof.approvedAt), archivedAt: iso(e.hof.archivedAt), geschlossenAm: iso(e.hof.geschlossenAm) },
    produkte: e.produkte.map((p) => ({ ...p, price: geld(p.price), createdAt: iso(p.createdAt) })),
    abholzeiten: e.abholzeiten.map((a) => ({ ...a })),
    beitraege: e.beitraege.map((b) => ({ ...b, publishedAt: iso(b.publishedAt), createdAt: iso(b.createdAt) })),
    postfach: e.postfach.map((f) => ({
      id: f.id,
      createdAt: iso(f.createdAt),
      nachrichten: f.nachrichten.map((n) => ({ von: n.vonFarmId === e.hof.id ? 'hof' : 'team', art: n.art, text: n.text, createdAt: iso(n.createdAt) })),
    })),
    meldungen: e.meldungen.map((m) => ({ ...m, createdAt: iso(m.createdAt) })),
    // Nur was der Hof als Verkäufer selbst weiß: Nummer, Stand, Zahlart, Beträge, Positionen — nie die Kundin.
    bestellungen: e.bestellungen.map((b) => ({
      id: b.id,
      orderNumber: b.orderNumber,
      status: b.status,
      paymentMethod: b.paymentMethod,
      paymentStatus: b.paymentStatus,
      totalAmount: geld(b.totalAmount),
      createdAt: iso(b.createdAt),
      pickupDate: iso(b.pickupDate),
      positionen: b.items.map((i) => ({ productName: i.productName, quantity: i.quantity, unitPrice: geld(i.unitPrice), totalPrice: geld(i.totalPrice) })),
    })),
  }
}

// ─── Kundschaft ──────────────────────────────────────────────────────────────

export type AuskunftKundinEingabe = {
  bestellungen: Array<{
    id: string
    orderNumber: string
    customerEmail: string
    customerName: string
    customerPhone: string | null
    status: string
    paymentMethod: string
    totalAmount: Geldwert
    createdAt: Date
    pickupDate: Datum
    farm: { name: string }
    items: Array<{ productName: string; quantity: number; unitPrice: Geldwert; totalPrice: Geldwert }>
  }>
  abos: Array<{ customerEmail: string; optInEmail: boolean; optInWhatsApp: boolean; createdAt: Date; farm: { name: string } }>
  /** Sitzungen des Kontos mit genau dieser Adresse — ohne IP (die Abfrage liest sie nicht). */
  konto: { email: string; sitzungen: Array<{ createdAt: Date; expiresAt: Date; userAgent: string | null }> } | null
}

const gleicheAdresse = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase()

export function auskunftKundin(adresse: string, e: AuskunftKundinEingabe, jetzt: Date) {
  const konto = e.konto && gleicheAdresse(e.konto.email, adresse) ? e.konto : null
  return {
    art: 'auskunft-kundschaft' as const,
    version: AUSKUNFT_VERSION,
    erstelltAm: jetzt.toISOString(),
    adresse: adresse.trim().toLowerCase(),
    bestellungen: e.bestellungen
      .filter((b) => gleicheAdresse(b.customerEmail, adresse))
      .map((b) => ({
        id: b.id,
        orderNumber: b.orderNumber,
        hof: b.farm.name,
        name: b.customerName,
        telefon: b.customerPhone,
        status: b.status,
        paymentMethod: b.paymentMethod,
        totalAmount: geld(b.totalAmount),
        createdAt: iso(b.createdAt),
        pickupDate: iso(b.pickupDate),
        positionen: b.items.map((i) => ({ productName: i.productName, quantity: i.quantity, unitPrice: geld(i.unitPrice), totalPrice: geld(i.totalPrice) })),
      })),
    abos: e.abos
      .filter((a) => gleicheAdresse(a.customerEmail, adresse))
      .map((a) => ({ hof: a.farm.name, optInEmail: a.optInEmail, optInWhatsApp: a.optInWhatsApp, createdAt: iso(a.createdAt) })),
    sitzungen: konto ? konto.sitzungen.map((s) => ({ createdAt: iso(s.createdAt), expiresAt: iso(s.expiresAt), userAgent: s.userAgent })) : [],
  }
}

/** Dateiname ohne Namen und ohne Adresse (Freigabe Lauf 26, §2: Export-Dateinamen ohne Personendaten). */
export function auskunftDateiname(art: 'hof' | 'kundschaft', kennung: string | null, jetzt: Date): string {
  const tag = jetzt.toISOString().slice(0, 10)
  return art === 'hof' && kennung ? `auskunft-hof-${kennung}-${tag}.json` : `auskunft-kundschaft-${tag}.json`
}
