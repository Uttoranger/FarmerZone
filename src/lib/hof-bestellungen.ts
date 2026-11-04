/**
 * Bestellungen des Hofs (/orders, /orders/[orderId] — Nachtlauf Nr. 19,
 * Mockups web-h3-bestellungen-packen-uebergeben, mobil-h3-bestellungen,
 * mobil-h3-bestelldetail). Rein: Filter, Reihenfolge, Gruppen je Abholfenster,
 * Kopfzeile, Marken und welche Knöpfe eine Bestellung anbietet. Die Abfragen
 * stehen in src/server/queries/orders.ts, die Seite zeigt nur an.
 *
 * Tage in WIENER Zeit (CODING_STANDARDS §2): pickupDate steht um 12:00 des
 * Abholtags und fällt sicher in den Wiener Tag.
 */
import { tagVersetzt, wienKalendertag } from '@/lib/kalender'
import { ABHOLUNG_ERLEDIGT, HEUTE_ABHOLEN, abholChip, abholTagMitDatum, abholtagName, PACK_MARKE } from '@/lib/heute'
import { formatSlotTime } from '@/lib/pickup-days'
import { artikelFehltErlaubt } from '@/lib/artikel-fehlt'
import type { HofBestellFilter } from '@/schemas/hof-bestellungen'
import type { PaymentMethod, PaymentStatus } from '@prisma/client'
import type { MarkeArt } from '@/lib/marke-art'
import { GEBUEHR_MODELL_HOFPREIS, gebuehrBezeichnungFuer, istHofpreisBestellung } from '@/lib/plattformgebuehr'
import { INKL_PLATTFORMGEBUEHR } from '@/lib/konditionen'
import { centsAlsEuro } from '@/lib/servicegebuehr'
import { formatEuro } from '@/lib/format'
// Nur der Typ (beim Übersetzen gelöscht): Zur Laufzeit zöge die Abfrage Prisma in jedes Bündel,
// das diese Datei erreicht — auch in Client-Bauteile (admin/bestellungen/bestellung-aktionen.tsx
// über admin-bestellung.ts).
import type * as Bestellabfragen from '@/server/queries/orders'

/**
 * Offen = alles außer abgeholt, storniert, nicht abgeholt — auch „Bestätigung offen“
 * (Register N41 e). Die EINE Liste ist `OPEN_STATUSES` (src/server/queries/orders.ts):
 * Danach zählen die Navigation (getOpenOrdersCount) und hier Kopf und Chip
 * „Noch offen · n“. Der Typ ist genau der von `OPEN_STATUSES` — fehlt ein Status, kommt einer
 * dazu oder ändert sich die Reihenfolge dort, scheitert der Typecheck an dieser Zeile;
 * tests/hof-bestellungen-zaehler.test.ts prüft, dass Chip und Navigation dieselbe Zahl liefern.
 */
const OFFENE: typeof Bestellabfragen.OPEN_STATUSES = ['PENDING_CONFIRMATION', 'PAID', 'CONFIRMED', 'IN_PREPARATION', 'READY']
export const OFFEN_STATUS: readonly string[] = OFFENE
const PACKEN_STATUS: readonly string[] = ['PAID', 'CONFIRMED', 'IN_PREPARATION']
/** Durch — dieselben Status, die Heute aus der Packliste nimmt (ABHOLUNG_ERLEDIGT). */
const ERLEDIGT_STATUS: readonly string[] = ABHOLUNG_ERLEDIGT
/** Aus diesen Status darf storniert werden — dieselbe Sperre wie cancelOrder. */
const STORNIERBAR_NICHT: readonly string[] = ERLEDIGT_STATUS

export type ListenBestellung = {
  id: string
  status: string
  pickupDate: Date
  pickupTimeStart: string
  pickupTimeEnd: string
}

/**
 * Was der Filter zeigt (`?filter=`, src/schemas/hof-bestellungen.ts) — genau
 * drei (freigabe.md §12 Nr. 45), zugeordnet über die vorhandenen Status, ohne
 * neue Status-Logik:
 * - „Noch offen": jeder Status, in dem noch etwas zu tun ist (OFFEN_STATUS) —
 *   auch „wartet auf Kunde" und Überfälliges von früheren Tagen.
 * - „Erledigt": abgeholt, storniert, nicht abgeholt. Beide zusammen sind alle
 *   Bestellungen, jede steht in genau einem.
 * - „Heute abholen": noch offen UND Abholtag heute in Wien — dieselben
 *   Bestellungen wie die Packliste auf Heute (abholWhere).
 * Gerechnet wird beim Lesen mit `jetzt`; verwaiste Bestellungen hat die Seite
 * vorher freigegeben (gibVerwaisteFreiOhneRisiko: Frist gilt beim Lesen).
 */
export function passtZumFilter(b: Pick<ListenBestellung, 'status' | 'pickupDate'>, filter: HofBestellFilter, jetzt: Date): boolean {
  switch (filter) {
    case 'offen':
      return OFFEN_STATUS.includes(b.status)
    case 'heute':
      return OFFEN_STATUS.includes(b.status) && wienKalendertag(b.pickupDate) === wienKalendertag(jetzt)
    case 'erledigt':
      return ERLEDIGT_STATUS.includes(b.status)
  }
}

/** Die drei Filter beim Namen — EINE Quelle für die Chips und für Verweise (Kundendetail). */
export const BESTELL_FILTER_TEXT: Record<HofBestellFilter, string> = {
  heute: HEUTE_ABHOLEN,
  offen: 'Noch offen',
  erledigt: 'Erledigt',
}

/** Die Filter-Reihe: Beschriftung und Zahl (nur, wo sie bei der Arbeit hilft). */
export function filterChips(
  bestellungen: readonly Pick<ListenBestellung, 'status' | 'pickupDate'>[],
  jetzt: Date
): Array<{ filter: HofBestellFilter; text: string }> {
  const zahl = (f: HofBestellFilter) => bestellungen.filter((b) => passtZumFilter(b, f, jetzt)).length
  return [
    { filter: 'heute', text: `${BESTELL_FILTER_TEXT.heute} · ${zahl('heute')}` },
    { filter: 'offen', text: `${BESTELL_FILTER_TEXT.offen} · ${zahl('offen')}` },
    { filter: 'erledigt', text: BESTELL_FILTER_TEXT.erledigt },
  ]
}

/** Die Adresse der Liste mit diesem Filter — der Standard „Noch offen" ohne Parameter, die Adresse bleibt kurz. */
export function bestellListeHref(filter: HofBestellFilter): string {
  return filter === 'offen' ? '/orders' : `/orders?filter=${filter}`
}

/** „6 offen, davon 1 gepackt" unter der Überschrift (Board s1-bestellungen); ohne Gepacktes „2 offen". */
export function bestellKopfzeile(bestellungen: readonly Pick<ListenBestellung, 'status'>[]): string {
  const offen = bestellungen.filter((b) => OFFEN_STATUS.includes(b.status)).length
  const gepackt = bestellungen.filter((b) => b.status === 'READY').length
  return gepackt > 0 ? `${offen} offen, davon ${gepackt} gepackt` : `${offen} offen`
}

/** „15–18 Uhr" bzw. „9:30–12 Uhr" — Schreibweise der Hofseite (formatSlotTime). */
export function fensterZeit(start: string, ende: string): string {
  return `${formatSlotTime(start)}–${formatSlotTime(ende)} Uhr`
}

/** „Heute", „Morgen", „Gestern", Wochentag oder Wochentag mit Datum — vom Wiener Heute aus. */
export function abholTag(pickupDate: Date, jetzt: Date): string {
  const heute = wienKalendertag(jetzt)
  const tag = wienKalendertag(pickupDate)
  if (tag === heute) return 'Heute'
  if (tag === tagVersetzt(heute, -1)) return 'Gestern'
  return abholtagName(heute, tag)
}

/**
 * „heute, Mi 3. März, 15–18 Uhr" bzw. „Sa, 6. März, 9–12 Uhr" — mit Wochentag und Datum
 * (V9, Board s1-bestellung); „heute“, „morgen“, „gestern“ mitten im Satz klein.
 */
export function abholungKurz(pickupDate: Date, start: string, ende: string, jetzt: Date): string {
  const tag = abholTagMitDatum(wienKalendertag(jetzt), wienKalendertag(pickupDate))
  const imSatz = /^(Heute|Morgen|Gestern),/.test(tag) ? tag[0].toLowerCase() + tag.slice(1) : tag
  return `${imSatz}, ${fensterZeit(start, ende)}`
}

export type BestellGruppe<T> = {
  schluessel: string
  /** „Heute, Mi 3. März, 15–18 Uhr · 3" */
  titel: string
  bestellungen: T[]
}

/**
 * Die Liste je Abholfenster (Tag + Zeit). Offenes von früh nach spät — was als
 * Nächstes abgeholt wird, steht oben; Erledigtes von neu nach alt.
 */
export function gruppiereNachAbholfenster<T extends ListenBestellung>(
  bestellungen: readonly T[],
  filter: HofBestellFilter,
  jetzt: Date
): BestellGruppe<T>[] {
  const absteigend = filter === 'erledigt'
  const sortiert = bestellungen
    .filter((b) => passtZumFilter(b, filter, jetzt))
    .toSorted((a, b) => {
      const vergleich =
        wienKalendertag(a.pickupDate).localeCompare(wienKalendertag(b.pickupDate)) ||
        a.pickupTimeStart.localeCompare(b.pickupTimeStart) ||
        a.pickupTimeEnd.localeCompare(b.pickupTimeEnd)
      // Innerhalb eines Fensters fest nach Kennung — sonst springt eine Zeile nach jedem Speichern.
      return (absteigend ? -vergleich : vergleich) || a.id.localeCompare(b.id)
    })

  const gruppen: BestellGruppe<T>[] = []
  for (const b of sortiert) {
    const schluessel = `${wienKalendertag(b.pickupDate)}|${b.pickupTimeStart}|${b.pickupTimeEnd}`
    const letzte = gruppen.at(-1)
    if (letzte && letzte.schluessel === schluessel) letzte.bestellungen.push(b)
    else gruppen.push({ schluessel, titel: '', bestellungen: [b] })
  }
  return gruppen.map((g) => {
    const erste = g.bestellungen[0]
    const anzahl = g.bestellungen.length
    return {
      ...g,
      // Board s1-bestellungen: Tag mit Datum (V9), Fenster, die Zahl ohne Wort — die Zeilen darunter sind die Bestellungen.
      titel: `${abholTagMitDatum(wienKalendertag(jetzt), wienKalendertag(erste.pickupDate))}, ${fensterZeit(erste.pickupTimeStart, erste.pickupTimeEnd)} · ${anzahl}`,
    }
  })
}

/** „1× Eier · 2× Bauernbrot +1" — Produktnamen tragen oft selbst Kommas, deshalb der Punkt als Trenner. */
export function positionenText(items: readonly { productName: string; quantity: number }[], hoechstens = 3): string {
  const gezeigt = items.slice(0, hoechstens).map((i) => `${i.quantity}× ${i.productName}`)
  const rest = items.length - gezeigt.length
  return rest > 0 ? `${gezeigt.join(' · ')} +${rest}` : gezeigt.join(' · ')
}

/**
 * Die Marke einer Bestellung aus Sicht des Hofs, ihre Bedeutung als Art (Register G5): zum
 * Packen tun, gepackt läuft, wartend und abgeschlossen erledigt (auch „Nicht abgeholt" — für den
 * Hof ist nichts mehr zu tun), storniert abgebrochen. Die EINE Hof-Lesart für Bestellliste,
 * Bestelldetail, Kundendetail und Packliste; die Kundin liest dieselben Status anders
 * (`bestellStatusAnzeige`, src/lib/bestellstatus.ts).
 */
export function bestellMarke(status: string): { text: string; art: MarkeArt } {
  switch (status) {
    case 'PENDING_CONFIRMATION':
      // V22: am Bildschirm „Bestätigung offen“ (orange, der Hof sieht, dass noch etwas fehlt);
      // nur Packliste und Papier sagen „Wartet auf Kunde“ (PACK_MARKE, papierMarke).
      return { text: 'Bestätigung offen', art: 'tun' }
    case 'PICKED_UP':
      return { text: 'Abgeholt', art: 'erledigt' }
    case 'CANCELLED':
      return { text: 'Storniert', art: 'abgebrochen' }
    case 'NOT_PICKED_UP':
      return { text: 'Nicht abgeholt', art: 'erledigt' }
    default:
      return PACK_MARKE[abholChip(status)]
  }
}

/**
 * Die Marke auf dem Papier (Abholzettel, Packliste; V57 „Papier = Bildschirm“): offene
 * Bestellungen mit den Wörtern der Packliste („Zum Packen“, „Wartet auf Kunde“, „Gepackt“),
 * abgeschlossene wie am Bildschirm.
 */
export function papierMarke(status: string): { text: string; art: MarkeArt } {
  return OFFEN_STATUS.includes(status) ? PACK_MARKE[abholChip(status)] : bestellMarke(status)
}

// ─── Papier (Abholzettel, Packliste; Boards s2-druck, w2-druck) ─────────────

/** Unter dem Abholzettel — derselbe Satz wie am Bildschirm sinngemäß, auf Papier kurz. */
export const DRUCK_ABGLEICH = 'Bestellnummer nur zum Abgleich – bitte zusätzlich den Namen prüfen.'

/**
 * Die eigene Zeile mit der Gebühr auf dem Papier — nur im Modell „bisher“ und nur mit
 * Gebühr (Wort über gebuehrBezeichnungFuer). Im Hofpreis-Modell steckt die
 * Plattformgebühr im Preis (N38): keine Zeile, dafür druckPreisHinweis.
 */
export function druckGebuehrZeile(bestellung: { gebuehrModell: string | null }, gebuehrCents: number): string | null {
  if (istHofpreisBestellung(bestellung) || gebuehrCents <= 0) return null
  return gebuehrBezeichnungFuer(bestellung)
}

/** „Preise inkl. Plattformgebühr.“ — nur bei Bestellungen im Hofpreis-Modell (Board w2-druck). */
export function druckPreisHinweis(bestellung: { gebuehrModell: string | null }): string | null {
  return istHofpreisBestellung(bestellung) ? `Preise ${INKL_PLATTFORMGEBUEHR}.` : null
}

const ZAHLART: Record<string, string> = {
  ONLINE: 'Online bezahlt',
  ONSITE_CASH: 'Bar bei Abholung',
  ONSITE_CARD: 'Karte bei Abholung',
}

/** „Online bezahlt", „Bar bei Abholung" — online noch nicht bezahlt: „Online, noch offen". */
export function zahlartText(paymentMethod: string, paymentStatus: string): string {
  if (paymentMethod === 'ONLINE' && paymentStatus === 'REFUNDED') return 'Online, erstattet'
  if (paymentMethod === 'ONLINE' && paymentStatus !== 'PAID') return 'Online, noch offen'
  return ZAHLART[paymentMethod] ?? paymentMethod
}

/** Das Modell einer Bestellung aus der Anzeige (`betrag.hofpreis`) — für die Wort-Helfer aus plattformgebuehr.ts. */
export function modellDerBestellung(betrag: { hofpreis: boolean }): { gebuehrModell: string | null } {
  return { gebuehrModell: betrag.hofpreis ? GEBUEHR_MODELL_HOFPREIS : null }
}

/** Was der Betragsblock einer Bestellung braucht — in Cent, wie getHofBestellDetail ihn liefert. */
export type BetragFuerSatz = {
  warenCents: number
  gebuehrCents: number
  gesamtCents: number
  /** Vor Ort: holt die Monatsabrechnung die Gebühr? */
  gebuehrFuerAbrechnung: boolean
  hofpreis: boolean
}

/**
 * Der Satz unter dem Betrag einer offenen Bestellung (Board s1-bestellung): was beim Hof
 * bleibt und wie sich der Betrag zusammensetzt — das Wort der Gebühr je Modell der
 * Bestellung (gebuehrBezeichnungFuer, V62/V63), nie ein festes Wort.
 * - Hofpreis-Modell (N38): „Du bekommst € 18,00 · die Kundin zahlt € 19,12 – die Gebühr
 *   ist online einbehalten.“ bzw. bar „… – die Gebühr holt die Monatsabrechnung.“; holt
 *   sie keine Abrechnung (Gründungshof, „erlassen“), „Du bekommst die vollen € 17,31 – auf
 *   diese Barbestellung zahlst du keine Plattformgebühr.“
 * - Modell „bisher“: „Warenpreis € 10,00 + Servicegebühr € 0,50“ mit demselben Zusatz.
 * Gerechnet wird nichts: alle Beträge kommen aus dem Snapshot der Bestellung.
 */
export function betragSatz(betrag: BetragFuerSatz, vorOrt: boolean): string {
  const euro = (cents: number) => formatEuro(centsAlsEuro(cents))
  const wort = gebuehrBezeichnungFuer(modellDerBestellung(betrag))
  if (betrag.hofpreis && vorOrt && !betrag.gebuehrFuerAbrechnung) {
    return `Du bekommst die vollen ${euro(betrag.gesamtCents)} – auf diese Barbestellung zahlst du keine ${wort}.`
  }
  const teile = betrag.hofpreis
    ? `Du bekommst ${euro(betrag.warenCents)} · die Kundin zahlt ${euro(betrag.gesamtCents)}`
    : betrag.gebuehrCents > 0
      ? `Warenpreis ${euro(betrag.warenCents)} + ${wort} ${euro(betrag.gebuehrCents)}`
      : `Warenpreis ${euro(betrag.warenCents)}`
  if (betrag.gebuehrCents <= 0) return teile
  if (vorOrt) return teile + (betrag.gebuehrFuerAbrechnung ? ' – die Gebühr holt die Monatsabrechnung.' : '')
  return `${teile} – die Gebühr ist online einbehalten.`
}

/**
 * Der Satz zu einer Bar-Bestellung mit „Bestätigung offen“ (V87): bis wann die Kundin
 * bestätigt und was sonst geschieht (verwaiste Bestellungen geben ihre Ware frei,
 * src/server/verwaiste-bestellungen.ts). `bis` ist „heute, 09:50 Uhr“ aus fristVon.
 */
export function bestaetigungOffenSatz(vorname: string, bis: string): string {
  return `${vorname} hat noch nicht bestätigt. Ohne Bestätigung bis ${bis} entfällt die Bestellung, die Ware kommt zurück in deinen Vorrat.`
}

/** „Anna Beispiel" → „Anna" — für „Anna bekommt zurück". Lange oder leere Namen: „Die Kundin". */
export function vorname(name: string): string {
  const erster = name.trim().split(/\s+/)[0] ?? ''
  return erster.length > 0 && erster.length <= 24 ? erster : 'Die Kundin'
}

export type BestellAktionen = {
  /** „Als gepackt markieren" (markAsReady). */
  packen: boolean
  /** „Abgeholt" (online, markAsPickedUp). */
  abgeholt: boolean
  /** „Abgeholt und bezahlt" (vor Ort, markAsPickedUpAndPaid). */
  abgeholtBezahlt: boolean
  artikelFehlt: boolean
  nichtAbgeholt: boolean
  stornieren: boolean
  /** „Doch nicht gepackt" (revertReady). */
  dochNichtGepackt: boolean
  /** „Abholung rückgängig" (revertPickedUp). */
  abholungZurueck: boolean
}

/**
 * Welche Knöpfe eine Bestellung anbietet — dieselben Status wie die Sperren
 * der Server-Aktionen (src/server/actions/orders.ts). Die Oberfläche ist nie
 * die Sperre; sie bietet nur nicht an, was der Server ablehnen würde.
 */
export function bestellAktionen(b: { status: string; paymentMethod: string; offenePositionen: number }): BestellAktionen {
  const online = b.paymentMethod === 'ONLINE'
  return {
    packen: PACKEN_STATUS.includes(b.status),
    abgeholt: b.status === 'READY' && online,
    abgeholtBezahlt: b.status === 'READY' && !online,
    artikelFehlt: artikelFehltErlaubt(b.status) && b.offenePositionen > 0,
    nichtAbgeholt: artikelFehltErlaubt(b.status),
    stornieren: !STORNIERBAR_NICHT.includes(b.status),
    dochNichtGepackt: b.status === 'READY',
    abholungZurueck: b.status === 'PICKED_UP',
  }
}

/** Der Zahlstand, den ein Rückweg liest — so, wie er in der Bestellung steht. */
export type ZahlstandFuerRueckweg = {
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  paidAt: Date | null
  pickedUpAt: Date | null
}

/**
 * Was „Rückgängig" im Hinweis (revertOrderStatus) an der Zahlung ändert —
 * `null` heißt: nichts. Zahlstatus und Zahlzeitpunkt bleiben dabei immer
 * stimmig (Nr. 19b; vorher löschte der Rückweg nur `paidAt`).
 *
 * Fachlich konservativ: Eine Zahlung, die nicht genau dieser Schritt
 * verbucht hat, bleibt stehen.
 * - Online liegt das Geld bei Stripe; ein Rückweg im Hofbereich ändert daran
 *   nichts, also auch nicht am Vermerk.
 * - Bar, zurück aus „Abgeholt und kassiert" (`ausStatus` PICKED_UP):
 *   `markAsPickedUpAndPaid` schreibt Abholung und Zahlung mit DEMSELBEN
 *   Zeitpunkt. Stimmen beide überein, war das Kassieren Teil des
 *   zurückgenommenen Schritts — die Bestellung ist wieder offen zu kassieren.
 * - Zurück aus „Gepackt" (`ausStatus` READY) hat nie etwas kassiert.
 */
export function zahlungNachRueckweg(
  b: ZahlstandFuerRueckweg,
  ausStatus: 'READY' | 'PICKED_UP'
): { paymentStatus: 'PENDING'; paidAt: null } | null {
  if (ausStatus !== 'PICKED_UP') return null
  if (b.paymentMethod === 'ONLINE' || b.paymentStatus !== 'PAID') return null
  if (!b.paidAt || !b.pickedUpAt || b.paidAt.getTime() !== b.pickedUpAt.getTime()) return null
  return { paymentStatus: 'PENDING', paidAt: null }
}
