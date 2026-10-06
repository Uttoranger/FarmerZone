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
import { abholChip, abholtagName, PACK_MARKE } from '@/lib/heute'
import { formatSlotTime } from '@/lib/pickup-days'
import { artikelFehltErlaubt } from '@/lib/artikel-fehlt'
import type { HofBestellFilter } from '@/schemas/hof-bestellungen'
/** Die Töne der StatusBadge (src/components/ui/status-badge.tsx). */
type StatusTon = 'offen' | 'fertig' | 'neutral'

/** Noch nicht übergeben und nicht storniert — „offen" in Kopf und Filter. */
export const OFFEN_STATUS: readonly string[] = ['PENDING_CONFIRMATION', 'PAID', 'CONFIRMED', 'IN_PREPARATION', 'READY']
const PACKEN_STATUS: readonly string[] = ['PAID', 'CONFIRMED', 'IN_PREPARATION']
const ERLEDIGT_STATUS: readonly string[] = ['PICKED_UP', 'CANCELLED', 'NOT_PICKED_UP']
/** Aus diesen Status darf storniert werden — dieselbe Sperre wie cancelOrder. */
const STORNIERBAR_NICHT: readonly string[] = ERLEDIGT_STATUS

export type ListenBestellung = {
  id: string
  status: string
  pickupDate: Date
  pickupTimeStart: string
  pickupTimeEnd: string
}

/** Was der Filter zeigt (`?filter=`, src/schemas/hof-bestellungen.ts). */
export function passtZumFilter(b: Pick<ListenBestellung, 'status' | 'pickupDate'>, filter: HofBestellFilter, jetzt: Date): boolean {
  switch (filter) {
    case 'offen':
      return OFFEN_STATUS.includes(b.status)
    case 'heute':
      return wienKalendertag(b.pickupDate) === wienKalendertag(jetzt)
    case 'packen':
      return PACKEN_STATUS.includes(b.status)
    case 'gepackt':
      return b.status === 'READY'
    case 'erledigt':
      return ERLEDIGT_STATUS.includes(b.status)
    case 'alle':
      return true
  }
}

/** Die Filter-Reihe: Beschriftung und Zahl (nur, wo sie bei der Arbeit hilft). */
export function filterChips(
  bestellungen: readonly Pick<ListenBestellung, 'status' | 'pickupDate'>[],
  jetzt: Date
): Array<{ filter: HofBestellFilter; text: string }> {
  const zahl = (f: HofBestellFilter) => bestellungen.filter((b) => passtZumFilter(b, f, jetzt)).length
  return [
    { filter: 'offen', text: `Offen · ${zahl('offen')}` },
    { filter: 'heute', text: `Heute · ${zahl('heute')}` },
    { filter: 'packen', text: `Zum Packen · ${zahl('packen')}` },
    { filter: 'gepackt', text: `Gepackt · ${zahl('gepackt')}` },
    { filter: 'erledigt', text: 'Erledigt' },
    { filter: 'alle', text: 'Alle' },
  ]
}

/** „5 offen · 2 gepackt" unter der Überschrift. */
export function bestellKopfzeile(bestellungen: readonly Pick<ListenBestellung, 'status'>[]): string {
  const offen = bestellungen.filter((b) => OFFEN_STATUS.includes(b.status)).length
  const gepackt = bestellungen.filter((b) => b.status === 'READY').length
  return `${offen} offen · ${gepackt} gepackt`
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

/** „heute, 15–18 Uhr" bzw. „Samstag, 9–12 Uhr" — mitten im Satz klein, Wochentage bleiben groß. */
export function abholungKurz(pickupDate: Date, start: string, ende: string, jetzt: Date): string {
  const tag = abholTag(pickupDate, jetzt)
  const imSatz = tag === 'Heute' || tag === 'Morgen' || tag === 'Gestern' ? tag.toLowerCase() : tag
  return `${imSatz}, ${fensterZeit(start, ende)}`
}

export type BestellGruppe<T> = {
  schluessel: string
  /** „Heute, 15–18 Uhr · 3 Bestellungen" */
  titel: string
  bestellungen: T[]
}

/**
 * Die Liste je Abholfenster (Tag + Zeit). Offenes von früh nach spät — was als
 * Nächstes abgeholt wird, steht oben; Erledigtes und „Alle" von neu nach alt.
 */
export function gruppiereNachAbholfenster<T extends ListenBestellung>(
  bestellungen: readonly T[],
  filter: HofBestellFilter,
  jetzt: Date
): BestellGruppe<T>[] {
  const absteigend = filter === 'erledigt' || filter === 'alle'
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
      titel: `${abholTag(erste.pickupDate, jetzt)}, ${fensterZeit(erste.pickupTimeStart, erste.pickupTimeEnd)} · ${anzahl} ${anzahl === 1 ? 'Bestellung' : 'Bestellungen'}`,
    }
  })
}

/** „1× Eier · 2× Bauernbrot +1" — Produktnamen tragen oft selbst Kommas, deshalb der Punkt als Trenner. */
export function positionenText(items: readonly { productName: string; quantity: number }[], hoechstens = 3): string {
  const gezeigt = items.slice(0, hoechstens).map((i) => `${i.quantity}× ${i.productName}`)
  const rest = items.length - gezeigt.length
  return rest > 0 ? `${gezeigt.join(' · ')} +${rest}` : gezeigt.join(' · ')
}

/** Die Marke einer Bestellung — offen orange, gepackt grün, alles andere neutral. */
export function bestellMarke(status: string): { text: string; ton: StatusTon } {
  switch (status) {
    case 'PICKED_UP':
      return { text: 'Abgeholt', ton: 'neutral' }
    case 'CANCELLED':
      return { text: 'Storniert', ton: 'neutral' }
    case 'NOT_PICKED_UP':
      return { text: 'Nicht abgeholt', ton: 'neutral' }
    default:
      return PACK_MARKE[abholChip(status)]
  }
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
