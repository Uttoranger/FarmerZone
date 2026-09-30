/**
 * Der Hofseiten-Editor im Browser (components/farmer/hofseite-editor.tsx):
 * welche Zeilen er zeigt, was jede über den Hof sagt, was fertig ist und was
 * fehlt. Rein und ohne Datenbank prüfbar (tests/hofseite-fortschritt.test.ts).
 *
 * EINE Liste für Fortschritt, Zeilentexte und die Markierung in der Vorschau —
 * die Erste-Schritte-Karte (erste-schritte.ts) zählt gröber und nur für neue
 * Höfe; hier zählt jeder Teil der Hofseite, den der Hof selbst füllen kann.
 */
import type { SchildFarbe } from '@/lib/mein-hof'
import { titelbildFoto } from '@/lib/mein-hof'
import { formatSlotTime, type WeeklySlot } from '@/lib/pickup-days'
import type { HofseiteZeileId } from '@/schemas/hofseite-vorschau'

export type HofseiteGruppeId = 'auftritt' | 'abholen-bezahlen' | 'sichtbarkeit'

/** Alles, was die Liste zum Rechnen braucht — aus getOwnerFarm und getFarmSettings zusammengelegt. */
export type HofseiteStand = {
  name: string
  description: string
  aboutText: string | null
  logoUrl: string | null
  bannerType: string
  bannerUrl: string | null
  /** Anzahl der Galeriefotos. */
  fotos: number
  address: string
  postalCode: string
  city: string
  /** Kartenpunkt gesetzt (latitude UND longitude). */
  hatKoordinaten: boolean
  /** Nur aktive Abholzeiten — eine abgeschaltete nützt keinem Kunden. */
  abholzeiten: readonly WeeklySlot[]
  acceptsOnline: boolean
  stripeAccountReady: boolean
  phone: string
  email: string
  isPaused: boolean
  sektionen: readonly { key: string; visible: boolean; order?: number }[]
}

export type HofseiteZeile = {
  id: HofseiteZeileId
  gruppe: HofseiteGruppeId
  titel: string
  /** Der aktuelle Wert in einer Zeile — die Anzeige kürzt mit Auslassung. */
  wert: string
  fertig: boolean
  /** Ein Wort statt des Häkchens („Fehlt", „Pausiert"); null = Häkchen. */
  marke: { text: string; farbe: SchildFarbe } | null
}

export type HofseiteGruppe = {
  id: HofseiteGruppeId
  titel: string
  zeilen: HofseiteZeile[]
}

export type HofseiteFortschritt = {
  gruppen: HofseiteGruppe[]
  erledigt: number
  gesamt: number
  /** Anteil fertig (0–100), gerundet — für den Balken. */
  prozent: number
  /** Die Titel der fehlenden Zeilen, in Listenreihenfolge. */
  fehlend: string[]
  /** „Es fehlen noch: Logo und Über uns." — oder der Satz, wenn nichts fehlt. */
  satz: string
}

export const GRUPPEN_TITEL: Record<HofseiteGruppeId, string> = {
  auftritt: 'Auftritt',
  'abholen-bezahlen': 'Abholen und Bezahlen',
  sichtbarkeit: 'Sichtbarkeit',
}

/** Die Abschnitte der Hofseite in den Worten des Hofs — dieselben Schlüssel wie sectionsConfig. */
export const ABSCHNITT_LABEL: Record<string, string> = {
  status: 'Aktuelles',
  about: 'Über uns',
  values: 'Werte',
  gallery: 'Fotos',
  products: 'Produkte',
}

const FEHLT = { text: 'Fehlt', farbe: 'bernstein' } as const

const WOCHENTAG_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const WOCHE_AB_MONTAG = [1, 2, 3, 4, 5, 6, 0]

/** „Fr 15–18 · Sa 9–12" — die aktiven Abholzeiten in einer Zeile, Montag zuerst. */
export function abholzeitenKurz(slots: readonly WeeklySlot[]): string {
  return WOCHE_AB_MONTAG.filter((tag) => slots.some((s) => s.dayOfWeek === tag))
    .map((tag) => {
      const fenster = slots
        .filter((s) => s.dayOfWeek === tag)
        .toSorted((a, b) => a.startTime.localeCompare(b.startTime))
        .map((s) => `${formatSlotTime(s.startTime)}–${formatSlotTime(s.endTime)}`)
      return `${WOCHENTAG_KURZ[tag]} ${fenster.join(', ')}`
    })
    .join(' · ')
}

/** Ein Text in einer Zeile: Umbrüche und Doppelleerzeichen zu einem Leerzeichen. */
function einzeilig(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function zeilen(stand: HofseiteStand): HofseiteZeile[] {
  const titelbild = titelbildFoto(stand) !== null
  const logo = (stand.logoUrl ?? '').trim().length > 0
  const beschreibung = einzeilig(stand.description)
  const ueberUns = einzeilig(stand.aboutText ?? '')
  const online = stand.acceptsOnline && stand.stripeAccountReady
  const kontakt = stand.phone.trim().length > 0 && stand.email.trim().length > 0
  const sichtbar = stand.sektionen
    .filter((s) => s.visible)
    .toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((s) => ABSCHNITT_LABEL[s.key] ?? s.key)

  const zeile = (
    id: HofseiteZeileId,
    gruppe: HofseiteGruppeId,
    titel: string,
    wert: string,
    fertig: boolean,
    marke: HofseiteZeile['marke'] = fertig ? null : FEHLT
  ): HofseiteZeile => ({ id, gruppe, titel, wert, fertig, marke })

  return [
    zeile(
      'titelbild',
      'auftritt',
      'Titelbild',
      titelbild ? 'Foto gesetzt · Ausschnitt anpassbar' : 'Farbverlauf — ein eigenes Foto wirkt persönlicher',
      titelbild
    ),
    zeile(
      'logo',
      'auftritt',
      'Logo',
      logo ? 'Logo gesetzt' : 'Fehlt — macht deinen Hof auf einen Blick erkennbar',
      logo
    ),
    zeile(
      'name',
      'auftritt',
      'Name und Kurzbeschreibung',
      beschreibung ? `${stand.name} · ${beschreibung}` : `${stand.name} — Kurzbeschreibung fehlt`,
      beschreibung.length > 0
    ),
    zeile('ueber-uns', 'auftritt', 'Über uns', ueberUns || 'Noch kein Text', ueberUns.length > 0),
    zeile(
      'fotos',
      'auftritt',
      'Fotos',
      stand.fotos === 0 ? 'Noch keine Fotos' : stand.fotos === 1 ? '1 Foto' : `${stand.fotos} Fotos`,
      stand.fotos > 0
    ),
    zeile(
      'adresse',
      'abholen-bezahlen',
      'Adresse und Standort',
      `${stand.address}, ${stand.postalCode} ${stand.city} · ${
        stand.hatKoordinaten ? 'auf der Karte gesetzt' : 'Standort auf der Karte fehlt'
      }`,
      stand.hatKoordinaten
    ),
    zeile(
      'abholzeiten',
      'abholen-bezahlen',
      'Abholzeiten',
      stand.abholzeiten.length > 0
        ? abholzeitenKurz(stand.abholzeiten)
        : 'Noch keine — erst dann können Kunden bestellen',
      stand.abholzeiten.length > 0
    ),
    // Bar vor Ort geht immer (settings/payments) — online ist die Kür, nie ein
    // Fehlen: Die Zeile zählt als fertig, trägt ohne Online-Zahlung aber das
    // Warnschild „Online fehlt" statt des Häkchens (Mockup hof-mein-hof-v2-desktop).
    zeile(
      'zahlung',
      'abholen-bezahlen',
      'Zahlungsarten',
      online ? 'Online mit Karte · vor Ort bar und mit Karte' : 'Vor Ort bar und mit Karte · Online-Zahlung noch nicht eingerichtet',
      true,
      online ? null : { text: 'Online fehlt', farbe: 'bernstein' }
    ),
    zeile(
      'kontakt',
      'abholen-bezahlen',
      'Kontakt',
      kontakt ? `${stand.phone} · ${stand.email}` : 'Telefon oder E-Mail fehlt',
      kontakt
    ),
    // Pausiert ist ein Zustand, kein Fehlen: fertig, aber mit eigenem Wort.
    zeile(
      'bestellungen',
      'sichtbarkeit',
      'Bestellungen',
      stand.isPaused ? 'Pausiert — Kunden können gerade nicht bestellen' : 'Nimmt Bestellungen an — pausieren möglich',
      true,
      stand.isPaused ? { text: 'Pausiert', farbe: 'bernstein' } : null
    ),
    zeile('abschnitte', 'sichtbarkeit', 'Abschnitte der Hofseite', sichtbar.join(' · '), true),
  ]
}

/** „Logo", „Logo und Über uns", „Logo, Über uns und Fotos". */
function aufzaehlung(teile: readonly string[]): string {
  if (teile.length <= 1) return teile.join('')
  return `${teile.slice(0, -1).join(', ')} und ${teile[teile.length - 1]}`
}

export function hofseiteFortschritt(stand: HofseiteStand): HofseiteFortschritt {
  const alle = zeilen(stand)
  const gruppen = (Object.keys(GRUPPEN_TITEL) as HofseiteGruppeId[]).map((id) => ({
    id,
    titel: GRUPPEN_TITEL[id],
    zeilen: alle.filter((z) => z.gruppe === id),
  }))
  const fehlend = alle.filter((z) => !z.fertig).map((z) => z.titel)
  const erledigt = alle.length - fehlend.length
  return {
    gruppen,
    erledigt,
    gesamt: alle.length,
    prozent: Math.round((erledigt / alle.length) * 100),
    fehlend,
    satz:
      fehlend.length === 0
        ? 'Alles da — Kunden sehen deinen Hof vollständig.'
        : `Es ${fehlend.length === 1 ? 'fehlt' : 'fehlen'} noch: ${aufzaehlung(fehlend)}.`,
  }
}

/**
 * Der Stand aus den Daten, wie die Seite sie lädt: die Hofseite des Besitzers
 * (getOwnerFarm — Abholzeiten dort nur aktive) und der Kartenpunkt aus den
 * Einstellungen (getFarmSettings). Reine Abbildung, damit die Seite nichts
 * selbst entscheidet.
 */
export function hofseiteStand(
  hof: {
    name: string
    description: string
    aboutText: string | null
    logoUrl: string | null
    bannerType: string
    bannerUrl: string | null
    farmPhotos: readonly unknown[]
    address: string
    postalCode: string
    city: string
    pickupSlots: readonly WeeklySlot[]
    acceptsOnline: boolean
    stripeAccountReady: boolean
    phone: string
    email: string
    isPaused: boolean
    sectionsConfig: readonly { key: string; visible: boolean; order?: number }[]
  },
  standort: { latitude: number | null; longitude: number | null }
): HofseiteStand {
  return {
    name: hof.name,
    description: hof.description,
    aboutText: hof.aboutText,
    logoUrl: hof.logoUrl,
    bannerType: hof.bannerType,
    bannerUrl: hof.bannerUrl,
    fotos: hof.farmPhotos.length,
    address: hof.address,
    postalCode: hof.postalCode,
    city: hof.city,
    hatKoordinaten: standort.latitude != null && standort.longitude != null,
    abholzeiten: hof.pickupSlots,
    acceptsOnline: hof.acceptsOnline,
    stripeAccountReady: hof.stripeAccountReady,
    phone: hof.phone,
    email: hof.email,
    isPaused: hof.isPaused,
    sektionen: hof.sectionsConfig,
  }
}

/**
 * Wohin die Vorschau springt, wenn eine Zeile offen ist: das Element mit
 * `data-abschnitt` auf der Hofseite. Mehrere Zeilen teilen sich ein Ziel —
 * Logo, Name und Adresse stehen alle auf dem Titelbild.
 */
export const ZIEL_ABSCHNITT: Record<HofseiteZeileId, string> = {
  titelbild: 'titelbild',
  logo: 'titelbild',
  name: 'titelbild',
  'ueber-uns': 'titelbild',
  fotos: 'fotos',
  adresse: 'titelbild',
  abholzeiten: 'abholung',
  zahlung: 'kontakt',
  kontakt: 'kontakt',
  bestellungen: 'bestellungen',
  abschnitte: 'abschnitte',
}
