/**
 * Plattformgebühr im Hofpreis (Register N38, Nr. 197) — die EINE Quelle für
 * Modell, Satz, Gebühr je Stück, Endpreis, Bestellgebühr und Einzug.
 *
 * Grundsatz (N38): Die Gebühr ist Teil des Preises, den der Hof der Kundin
 * verrechnet — online und bar gleich hoch. Der Warenpreis (`Product.price`,
 * `Order.totalAmount`) bleibt, was der Hof bekommt; die Kundin zahlt je Stück
 * Warenpreis + Gebühr (Endpreis). Ab dem Stichtag „Hofpreis-Modell ab“
 * (`PlattformEinstellung.hofpreisModellAb`, sonst `BAR_SERVICEGEBUEHR_AB`)
 * gilt das für neue Bestellungen; davor bleibt alles beim Modell „bisher“
 * (servicegebuehr.ts, E4 und B1).
 *
 * Rein, ohne Prisma und ohne Uhr (der Zeitpunkt ist Parameter), in ganzen
 * Cent (Int) und Hundertstel-Prozent (6 % = 600). Kein Float in dieser Datei
 * (tests/plattformgebuehr.test.ts, Wache): Euro-Zahlen der Anzeige entstehen
 * nur über `alsCents` und `centsAlsEuro`.
 */
import { centsAlsEuro } from '@/lib/format'
import { BAR_SERVICEGEBUEHR_AB, MINDESTBESTELLWERT_CENTS, PLATTFORMGEBUEHR_BEZEICHNUNG, PLATTFORMGEBUEHR_PROZENT, PLATTFORMGEBUEHR_SATZ } from '@/lib/konditionen'
import { SERVICEGEBUEHR_BEZEICHNUNG, SERVICEGEBUEHR_HINWEIS, gebuehrFuerMonatsabrechnung, istVorOrtZahlung, type Zahlungsart } from '@/lib/servicegebuehr'
import { alsCents } from '@/lib/order-totals'
import { kalendertagInWien, wienerMitternacht } from '@/lib/wiener-tag'

/** Das Gebührenmodell einer Bestellung bzw. eines Hofs zu einem Zeitpunkt. */
export type GebuehrModell = 'bisher' | 'hofpreis'

/** Wie die Gebühr einer Bestellung im Hofpreis-Modell zur Plattform kommt (`Order.gebuehrEinzug`). */
export type GebuehrEinzug = 'stripe' | 'erlassen' | 'sepa' | 'ueberweisung'

/** Der Wert in `Order.gebuehrModell` für das Hofpreis-Modell; null = bisher. */
export const GEBUEHR_MODELL_HOFPREIS = 'hofpreis'

/** Die Zahlarten einer neuen Bestellung (E5) — als Text, src/lib bleibt ohne Prisma-Client. */
export type NeueBestellZahlart = 'ONLINE' | 'ONSITE_CASH'

/** Was aus PlattformEinstellung gebraucht wird: der Stichtag oder null. */
export type HofpreisEinstellung = { hofpreisModellAb: Date | null }

/** Decimal aus Prisma, Text oder Zahl — wie `Farm.plattformgebuehrProzent` ankommt. */
type DezimalWert = number | string | { toString(): string }

/** Ab wann das Hofpreis-Modell gilt: die Admin-Einstellung, sonst `BAR_SERVICEGEBUEHR_AB`. */
export function hofpreisModellAb(einstellung: HofpreisEinstellung | null): Date {
  return einstellung?.hofpreisModellAb ?? BAR_SERVICEGEBUEHR_AB
}

/**
 * Das Modell zu diesem Zeitpunkt — ab dem Stichtag (genau an der Grenze schon)
 * `hofpreis`, davor `bisher`. Für alle Höfe gleich, auch für Gründungshöfe
 * (N38: auch sie zeigen den Endpreis; nur der Einzug beginnt später).
 */
export function gebuehrModellFuer(einstellung: HofpreisEinstellung | null, jetzt: Date): GebuehrModell {
  return jetzt.getTime() >= hofpreisModellAb(einstellung).getTime() ? 'hofpreis' : 'bisher'
}

/**
 * Ein Prozentsatz als Hundertstel-Prozent über die Ziffern („6.50“ → 650),
 * nie über eine Gleitkommazahl. Unlesbares ergibt null.
 */
function alsHundertstel(wert: DezimalWert): number | null {
  const treffer = /^(\d{1,3})(?:\.(\d{1,2})\d*)?$/.exec(wert.toString().trim())
  if (!treffer) return null
  const ganz = Number.parseInt(treffer[1], 10)
  const nachkomma = Number.parseInt((treffer[2] ?? '').padEnd(2, '0'), 10)
  return ganz * 100 + nachkomma
}

/** Der Satz eines Hofs in Hundertstel-Prozent: `Farm.plattformgebuehrProzent` oder die Vorgabe (6 % → 600). */
export function satzHundertstel(hof: { plattformgebuehrProzent: DezimalWert | null }): number {
  const eigener = hof.plattformgebuehrProzent === null ? null : alsHundertstel(hof.plattformgebuehrProzent)
  return eigener ?? PLATTFORMGEBUEHR_PROZENT * 100
}

/** „6“ bzw. „6,5“ — der Satz für Texte, aus den Hundertstel ohne Gleitkomma. */
export function satzText(hundertstel: number): string {
  const ganz = Math.floor(hundertstel / 100)
  const rest = hundertstel % 100
  if (rest === 0) return String(ganz)
  return `${ganz},${String(rest).padStart(2, '0').replace(/0$/, '')}`
}

/**
 * Die Gebühr je Stück in Cent: Warenpreis × Satz, IMMER auf den nächsten
 * ganzen Cent aufgerundet (N38). Ganzzahlig: Cent × Hundertstel ergibt
 * Zehntausendstel-Cent, jeder Rest zählt einen Cent mehr.
 */
export function gebuehrJeStueckCents(preisCents: number, hundertstel: number): number {
  const zehntausendstel = Math.max(0, preisCents) * Math.max(0, hundertstel)
  const rest = zehntausendstel % 10000
  return (zehntausendstel - rest) / 10000 + (rest > 0 ? 1 : 0)
}

/** Der Endpreis je Stück, den die Kundin sieht und zahlt: Warenpreis + Gebühr je Stück. */
export function endpreisJeStueckCents(preisCents: number, hundertstel: number): number {
  return preisCents + gebuehrJeStueckCents(preisCents, hundertstel)
}

/** Eine Position für die Bestellgebühr: Warenpreis je Stück in Cent und Menge. */
export type GebuehrPosition = { preisCents: number; menge: number }

export type BestellGebuehr = {
  warenCents: number
  /** Summe aller Positionen: Menge × Gebühr je Stück. */
  gebuehrCents: number
  gesamtCents: number
  /** Die Gebühr je Position in derselben Reihenfolge — der Snapshot `OrderItem.gebuehrCents`. */
  jePosition: number[]
}

/**
 * Die Gebühr einer Bestellung im Hofpreis-Modell — Summe aus Menge × Gebühr
 * je Stück, nie Prozent auf die Summe (sonst wiche die Kasse um einen Cent von
 * den Endpreisen der Karten ab). Für online und bar dieselbe Rechnung.
 */
export function bestellGebuehr(positionen: readonly GebuehrPosition[], hundertstel: number): BestellGebuehr {
  const jePosition = positionen.map((p) => p.menge * gebuehrJeStueckCents(p.preisCents, hundertstel))
  const warenCents = positionen.reduce((summe, p) => summe + p.menge * p.preisCents, 0)
  const gebuehrCents = jePosition.reduce((summe, g) => summe + g, 0)
  return { warenCents, gebuehrCents, gesamtCents: warenCents + gebuehrCents, jePosition }
}

/** Erreicht der Warenwert den Mindestbestellwert (N38: 10 € Warenwert je Bestellung)? */
export function mindestbestellwertErreicht(warenCents: number): boolean {
  return warenCents >= MINDESTBESTELLWERT_CENTS
}

/**
 * Ab wann die Plattform die Bargebühr eines Hofs einzieht (N38, „Start“):
 *  - `Farm.einzugAb`, falls im Admin gesetzt
 *  - bei einem Gründungshof der spätere Tag von Stichtag und Tag nach `gruendungBis`
 *  - sonst der Stichtag.
 * `gruendungBis` ist das wirksame Gründungs-Ende (`bestimmeGruendungBis`,
 * null = kein Gründungshof oder ausgenommen); die Spalte trägt den letzten
 * Gründungstag als Kalendertag, der Einzug beginnt um Mitternacht in Wien danach.
 */
export function einzugAbFuer(hof: { einzugAb: Date | null }, einstellung: HofpreisEinstellung | null, gruendungBis: Date | null): Date {
  if (hof.einzugAb) return hof.einzugAb
  const stichtag = hofpreisModellAb(einstellung)
  if (!gruendungBis) return stichtag
  const letzterTag = kalendertagInWien(gruendungBis)
  const naechster = new Date(`${letzterTag}T12:00:00.000Z`)
  naechster.setUTCDate(naechster.getUTCDate() + 1)
  const tagDanach = wienerMitternacht(naechster.toISOString().slice(0, 10))
  if (!tagDanach) return stichtag
  return tagDanach.getTime() > stichtag.getTime() ? tagDanach : stichtag
}

/**
 * Was der Einzug über einen Hof wissen muss — `einzugAb` schon aufgelöst (`einzugAbFuer`).
 * `barGesperrt` (Nr. 198): eine Monatsabrechnung sperrt bar (`abrechnungSperrtBar`); fehlt es, gilt nein.
 */
export type HofFuerEinzug = { einzugAb: Date; barMandatPflicht: boolean; sepaMandatAm: Date | null; barGesperrt?: boolean }

/**
 * Wie die Gebühr einer neuen Bestellung zur Plattform kommt (N38):
 *  - online: `stripe` (als application_fee einbehalten)
 *  - bar vor dem Einzugsbeginn: `erlassen` (sie bleibt beim Hof, kein Mandat nötig)
 *  - bar mit Mandat: `sepa`
 *  - bar ohne Mandat, Mandat nicht Pflicht: `ueberweisung`
 *  - bar ohne Mandat bei Pflicht: null — dann gibt es bar bei diesem Hof nicht.
 *  - bar bei gesperrtem Hof (Lastschrift zurückgebucht oder zu lange offen, Nr. 198): null.
 */
export function einzugFuer(hof: HofFuerEinzug, zahlart: NeueBestellZahlart, jetzt: Date): GebuehrEinzug | null {
  if (zahlart === 'ONLINE') return 'stripe'
  if (hof.barGesperrt) return null
  if (jetzt.getTime() < hof.einzugAb.getTime()) return 'erlassen'
  if (hof.sepaMandatAm) return 'sepa'
  if (!hof.barMandatPflicht) return 'ueberweisung'
  return null
}

/** Die Gebührenlage eines Hofs jetzt — was Checkout, Kasse und Anzeigen brauchen. */
export type GebuehrLage = { modell: 'bisher' } | ({ modell: 'hofpreis'; hundertstel: number } & HofFuerEinzug)

/**
 * Darf bei diesem Hof jetzt bar bestellt werden? Im Modell `bisher` immer
 * (dort entscheidet `acceptsOnsite`); im Modell `hofpreis` nicht, wenn der
 * Einzug fällig ist, das Mandat Pflicht ist und keins da ist, oder wenn eine
 * Monatsabrechnung den Hof sperrt (`barGesperrt`, Nr. 198). EINE Quelle für
 * Kasse und /api/checkout (beide über `einzugFuer`).
 */
export function barMoeglich(lage: GebuehrLage, jetzt: Date): boolean {
  if (lage.modell === 'bisher') return true
  return einzugFuer(lage, 'ONSITE_CASH', jetzt) !== null
}

/**
 * Was eine Kundenansicht für den Preis braucht: im Modell `hofpreis` der Satz
 * (dann zeigt sie den Endpreis „inkl. Plattformgebühr“), sonst null (der
 * Warenpreis wie bisher). Reines JSON — darf an Client-Komponenten.
 */
export type PreisAnzeige = { hundertstel: number } | null

/** Die Preisanzeige aus der Lage. */
export function preisAnzeigeAus(lage: GebuehrLage): PreisAnzeige {
  return lage.modell === 'hofpreis' ? { hundertstel: lage.hundertstel } : null
}

/** Der Endpreis je Stück in Cent für die Anzeige — ohne Hofpreis-Modell der Preis selbst. */
export function anzeigePreisCents(preisCents: number, anzeige: PreisAnzeige): number {
  return anzeige ? endpreisJeStueckCents(preisCents, anzeige.hundertstel) : preisCents
}

/**
 * Der Endpreis als Euro-Zahl für die Formatierer (`formatGrundpreis`,
 * `formatEuro`, `GrundpreisZeile`) — der Grundpreis je kg bzw. Liter entsteht
 * so aus dem Endpreis (N38). Der Weg: Preis → Cent (`alsCents`), Endpreis in
 * Cent, zurück über `centsAlsEuro`. Ohne Hofpreis-Modell unverändert.
 */
export function endpreisEuro(preis: number, anzeige: PreisAnzeige): number {
  if (!anzeige) return preis
  return centsAlsEuro(endpreisJeStueckCents(alsCents(String(preis)), anzeige.hundertstel))
}

/** Der Satz eines Hofs, wie ihn die Lage braucht — `Farm.plattformgebuehrProzent` (null = Vorgabe). */
export type HofMitSatz = { plattformgebuehrProzent: DezimalWert | null }

/**
 * Die Preisanzeige eines Hofs jetzt (N38): im Modell `hofpreis` sein Satz,
 * sonst null. Das Modell hängt nur am Stichtag, der Satz am Hof — Hofseite,
 * Produktseite, Startseite, Entdecken und Teilen-Bild fragen hier.
 */
export function preisAnzeigeFuer(hof: HofMitSatz, einstellung: HofpreisEinstellung | null, jetzt: Date): PreisAnzeige {
  return gebuehrModellFuer(einstellung, jetzt) === 'hofpreis' ? { hundertstel: satzHundertstel(hof) } : null
}

/**
 * Die volle Gebührenlage eines Hofs jetzt — für /api/checkout und die Kasse.
 * `gruendungBis` ist das wirksame Gründungs-Ende (`bestimmeGruendungBis`,
 * null ohne Gründungsplatz); es zählt nur, wenn `Farm.einzugAb` leer ist.
 */
export function gebuehrLageFuer(
  hof: HofMitSatz & { einzugAb: Date | null; barMandatPflicht: boolean; sepaMandatAm: Date | null },
  einstellung: HofpreisEinstellung | null,
  gruendungBis: Date | null,
  jetzt: Date,
  barGesperrt = false
): GebuehrLage {
  if (gebuehrModellFuer(einstellung, jetzt) === 'bisher') return { modell: 'bisher' }
  return {
    modell: 'hofpreis',
    hundertstel: satzHundertstel(hof),
    einzugAb: einzugAbFuer(hof, einstellung, gruendungBis),
    barMandatPflicht: hof.barMandatPflicht,
    sepaMandatAm: hof.sepaMandatAm,
    barGesperrt,
  }
}

/**
 * Ein Produkt (oder eine Korbzeile) mit dem Endpreis statt dem Warenpreis —
 * NUR für die Anzeige. So rechnen die Formatierer (`formatGrundpreis`,
 * `zweitePreiszeile`, `GrundpreisZeile`, Kilopreis) den Grundpreis je kg bzw.
 * Liter aus dem Endpreis (N38). Nie in den Warenkorb legen: Der Korb trägt
 * den Warenpreis, /api/checkout gleicht ihn mit der Datenbank ab.
 */
export function mitEndpreis<T extends { price: number }>(produkt: T, anzeige: PreisAnzeige): T {
  return anzeige ? { ...produkt, price: endpreisEuro(produkt.price, anzeige) } : produkt
}

/** Ist diese gespeicherte Bestellung im Modell `hofpreis`? (`Order.gebuehrModell`, null = bisher). */
export function istHofpreisBestellung(bestellung: { gebuehrModell: string | null }): boolean {
  return bestellung.gebuehrModell === GEBUEHR_MODELL_HOFPREIS
}

/**
 * Das Wort für die Gebühr einer gespeicherten Bestellung (N8): im
 * Hofpreis-Modell „Plattformgebühr“, sonst „Servicegebühr“ — Bestellseiten,
 * Bestätigung und Mails nennen so die Zeile aus dem Snapshot.
 */
export function gebuehrBezeichnungFuer(bestellung: { gebuehrModell?: string | null }): string {
  return istHofpreisBestellung({ gebuehrModell: bestellung.gebuehrModell ?? null }) ? PLATTFORMGEBUEHR_BEZEICHNUNG : SERVICEGEBUEHR_BEZEICHNUNG
}

/** Der Erklärsatz zur Gebühr einer gespeicherten Bestellung — N38-Satz im Hofpreis-Modell, sonst der bisherige. */
export function gebuehrHinweisFuer(bestellung: { gebuehrModell?: string | null }): string {
  return istHofpreisBestellung({ gebuehrModell: bestellung.gebuehrModell ?? null }) ? PLATTFORMGEBUEHR_SATZ : SERVICEGEBUEHR_HINWEIS
}

/**
 * Holt die Monatsabrechnung die Gebühr dieser gespeicherten Bestellung? Im
 * Hofpreis-Modell (N38) nur bei Vor-Ort-Zahlung, die per Lastschrift (`sepa`)
 * oder Überweisung kommt — `erlassen` bleibt beim Hof, `stripe` ist schon
 * einbehalten. Im Modell `bisher` die Regel aus servicegebuehr.ts (B1).
 * EINE Frage für die Bestellansicht des Hofs und „Artikel fehlt“.
 */
export function gebuehrFuerMonatsabrechnungJeModell(b: {
  paymentMethod: Zahlungsart
  serviceFeeCents: number
  bestelltAm: Date | string
  gebuehrModell?: string | null
  gebuehrEinzug?: string | null
}): boolean {
  if (!istHofpreisBestellung({ gebuehrModell: b.gebuehrModell ?? null })) return gebuehrFuerMonatsabrechnung(b)
  return istVorOrtZahlung(b.paymentMethod) && b.serviceFeeCents > 0 && (b.gebuehrEinzug === 'sepa' || b.gebuehrEinzug === 'ueberweisung')
}

// ─── Monatsabrechnung (Register N38, Nr. 198): Sperre und Summen ─────────────

/**
 * Die Stände einer Monatsabrechnung (`Monatsabrechnung.stand`):
 *   entwurf         angelegt, Rechnung bar noch nicht fertig
 *   nichts          bar 0 € — keine Rechnung bar (online höchstens „bezahlt außerhalb“)
 *   offen           Rechnung bar finalisiert, Einzug bzw. Überweisung läuft
 *   bezahlt         `invoice.paid`
 *   gescheitert     `invoice.payment_failed` — Stripe versucht es erneut
 *   zurueckgebucht  `charge.dispute.created` zur Rechnungszahlung
 */
export const ABRECHNUNG_STAENDE = ['entwurf', 'nichts', 'offen', 'bezahlt', 'gescheitert', 'zurueckgebucht'] as const
export type AbrechnungStand = (typeof ABRECHNUNG_STAENDE)[number]

/** Das Wort für den Stand — nie nur als Farbe (DESIGN_SYSTEM). */
export const ABRECHNUNG_STAND_WORT: Record<AbrechnungStand, string> = {
  entwurf: 'in Arbeit',
  nichts: 'nichts fällig',
  offen: 'offen',
  bezahlt: 'bezahlt',
  gescheitert: 'Lastschrift gescheitert',
  zurueckgebucht: 'zurückgebucht',
}

/** Der Stand als Wort; ein unbekannter Text bleibt, wie er ist. */
export function abrechnungStandWort(stand: string): string {
  const bekannt = ABRECHNUNG_STAENDE.find((s) => s === stand)
  return bekannt ? ABRECHNUNG_STAND_WORT[bekannt] : stand
}

/** Die Stände, die eine Sperre auslösen können — für die Abfrage der Lage. */
export const SPERRE_STAENDE: readonly AbrechnungStand[] = ['offen', 'gescheitert', 'zurueckgebucht']

const TAG_MS = 24 * 60 * 60 * 1000

/**
 * Sperrt eine Abrechnung bar bei diesem Hof (N38, „Einzug scheitert“)? Ja,
 * wenn eine zurückgebucht ist, oder wenn eine länger als `barSperreNachTagen`
 * offen bzw. gescheitert ist (gezählt ab `offenSeit`: erster Fehlschlag, bei
 * Überweisung das Senden der Rechnung). Nach `invoice.paid` steht die
 * Abrechnung auf „bezahlt“ — der Hof ist von selbst wieder frei, es gibt kein
 * eigenes Feld.
 */
export function abrechnungSperrtBar(
  abrechnungen: readonly { stand: string; offenSeit: Date | null }[],
  barSperreNachTagen: number,
  jetzt: Date
): boolean {
  return abrechnungen.some((a) => {
    if (a.stand === 'zurueckgebucht') return true
    if (a.stand !== 'offen' && a.stand !== 'gescheitert') return false
    if (!a.offenSeit) return false
    return jetzt.getTime() - a.offenSeit.getTime() > Math.max(0, barSperreNachTagen) * TAG_MS
  })
}

/** Eine Bestellung für die Monatsabrechnung — nur Kennung, Nummer, Stände und Cent (der Lader filtert den Monat). */
export type BestellungFuerAbrechnung = {
  id: string
  orderNumber: string
  paymentMethod: string
  status: string
  paymentStatus: string
  /** Order.serviceFeeCents — im Hofpreis-Modell die aktuelle Summe der Gebühren je Position. */
  serviceFeeCents: number
  gebuehrModell: string | null
  gebuehrEinzug: string | null
  /** serviceFeeRefundedAt gesetzt (Gebühr entfallen). */
  gebuehrEntfallen: boolean
}

export type AbrechnungsZeile = { orderId: string; orderNumber: string; cents: number }

export type MonatsSummen = {
  /** Bar: je Bestellnummer eine Zeile (Lastschrift oder Überweisung). */
  barZeilen: AbrechnungsZeile[]
  barCents: number
  /** Erlassen (vor dem Einzugsbeginn) — nur zur Information, nie auf einer Rechnung. */
  erlassenBestellungen: number
  erlassenCents: number
  /** Online: schon von Stripe einbehalten, abzüglich erstatteter Gebühren. */
  onlineZeilen: AbrechnungsZeile[]
  onlineCents: number
  nichtAbgeholtBestellungen: number
}

/**
 * Die Summen eines Monats aus den Bestellungen (N38, Nr. 198). Rein, ganze
 * Cent, kein Betrag wird neu gerechnet — es zählt der Snapshot
 * `serviceFeeCents`:
 *  - bar: Modell hofpreis, Zahlart vor Ort, abgeholt, Einzug `sepa` oder
 *    `ueberweisung` → eine Zeile; `erlassen` nur gezählt; nicht abgeholt nur
 *    gezählt (fällig wird erst mit „Abgeholt“).
 *  - online: Modell hofpreis, online, bezahlt (PAID) und Gebühr nicht
 *    entfallen → eine Zeile; voll erstattet (REFUNDED) bzw. entfallen → 0.
 * Bestellungen im Modell `bisher` zählen nie.
 */
export function monatsSummen(bestellungen: readonly BestellungFuerAbrechnung[]): MonatsSummen {
  const s: MonatsSummen = { barZeilen: [], barCents: 0, erlassenBestellungen: 0, erlassenCents: 0, onlineZeilen: [], onlineCents: 0, nichtAbgeholtBestellungen: 0 }
  for (const b of bestellungen) {
    if (!istHofpreisBestellung(b)) continue
    if (b.paymentMethod === 'ONLINE') {
      if (b.paymentStatus !== 'PAID' || b.gebuehrEntfallen || b.serviceFeeCents <= 0) continue
      s.onlineZeilen.push({ orderId: b.id, orderNumber: b.orderNumber, cents: b.serviceFeeCents })
      s.onlineCents += b.serviceFeeCents
      continue
    }
    if (!istVorOrtZahlung(b.paymentMethod as Zahlungsart)) continue
    if (b.status === 'NOT_PICKED_UP') {
      s.nichtAbgeholtBestellungen += 1
      continue
    }
    if (b.status !== 'PICKED_UP' || b.serviceFeeCents <= 0) continue
    if (b.gebuehrEinzug === 'erlassen') {
      s.erlassenBestellungen += 1
      s.erlassenCents += b.serviceFeeCents
    } else if (b.gebuehrEinzug === 'sepa' || b.gebuehrEinzug === 'ueberweisung') {
      s.barZeilen.push({ orderId: b.id, orderNumber: b.orderNumber, cents: b.serviceFeeCents })
      s.barCents += b.serviceFeeCents
    }
  }
  return s
}

/**
 * Wie die Rechnung bar eingezogen wird: mit Mandat per Lastschrift, ohne
 * Mandat nur, wenn es nicht Pflicht ist, per Überweisung (`send_invoice`).
 * Pflicht und kein Mandat: null — dann steht eine Warnung an, keine Rechnung.
 */
export function barEinzugsweg(hof: { sepaMandatAm: Date | null; sepaZahlungsmittelId: string | null; barMandatPflicht: boolean }): 'lastschrift' | 'ueberweisung' | null {
  if (hof.sepaMandatAm && hof.sepaZahlungsmittelId) return 'lastschrift'
  if (!hof.barMandatPflicht) return 'ueberweisung'
  return null
}

/** Der Vormonat eines Wiener Kalendertags: `2028-03-03` → `2028-02`. */
export function vormonat(kalendertag: string): string {
  const [j, m] = kalendertag.split('-').map((t) => Number.parseInt(t, 10))
  return m === 1 ? `${j - 1}-12` : `${j}-${String(m - 1).padStart(2, '0')}`
}

/** Der Folgemonat: `2027-12` → `2028-01`. */
export function folgemonat(monat: string): string {
  const [j, m] = monat.split('-').map((t) => Number.parseInt(t, 10))
  return m === 12 ? `${j + 1}-01` : `${j}-${String(m + 1).padStart(2, '0')}`
}

/** Ist heute (Wiener Kalendertag) der Abrechnungstag dieses Hofs (1–28)? */
export function istAbrechnungsTag(abrechnungsTag: number, kalendertag: string): boolean {
  return Number.parseInt(kalendertag.slice(8, 10), 10) === abrechnungsTag
}

/** „März 2028“ aus `2028-03` — für Rechnung, Postfach und Mail. */
export function monatText(monat: string): string {
  const namen = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
  const [j, m] = monat.split('-').map((t) => Number.parseInt(t, 10))
  return `${namen[m - 1] ?? monat} ${j}`
}

/** Die Ankündigung kommt 28 Tage vor dem Einzugsbeginn (N38: „4 Wochen vorher“). */
export const ANKUENDIGUNG_TAGE = 28

/** Ist die Ankündigung fällig? Einzugsbeginn in höchstens 28 Tagen (auch schon vorbei) und noch nicht angekündigt. */
export function ankuendigungFaellig(einzugAb: Date, gebuehrHinweisAm: Date | null, jetzt: Date): boolean {
  if (gebuehrHinweisAm) return false
  return einzugAb.getTime() - jetzt.getTime() <= ANKUENDIGUNG_TAGE * TAG_MS
}

/** Die Quote „nicht abgeholt bei bar“ (90 Tage) ist auffällig: ab 10 Barbestellungen und über 20 %. */
export function nichtAbgeholtAuffaellig(barBestellungen: number, nichtAbgeholt: number): boolean {
  return barBestellungen >= 10 && nichtAbgeholt * 5 > barBestellungen
}
