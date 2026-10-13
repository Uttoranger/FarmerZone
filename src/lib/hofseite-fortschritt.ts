/**
 * Die Abschnitte der Hofseite in Mein Hof — ab lg der Editor
 * (components/farmer/hofseite-editor.tsx), unter lg seit Nr. 50 die Liste
 * „Bearbeiten" (components/mein-hof/abschnitte-liste.tsx): welche Zeilen es
 * gibt, was jede über den Hof sagt, was fertig ist und was fehlt. Rein und
 * ohne Datenbank prüfbar (tests/hofseite-fortschritt.test.ts).
 *
 * EINE Liste für Fortschritt, Zeilentexte und die Markierung in der Vorschau —
 * die Ersten Schritte (erste-schritte.ts) zählen gröber und nur für neue
 * Höfe; hier zählt jeder Teil der Hofseite, den der Hof selbst füllen kann.
 * Leitspruch/Gründungsjahr und Werte (Nr. 50, aus dem früheren „Mein
 * Auftritt") stehen als freiwillige Zeilen dabei: Sie zeigen ihren Stand,
 * zählen aber weder zum Fortschritt noch in den Satz — „11 von 11" bleibt
 * für Heute, Einrichten, Einstellungen und Mein Hof dieselbe Zahl.
 * Auf Heute stehen die offenen Zeilen mit den Ersten Schritten in der einen
 * Liste „Zu tun" (zuTun, seit Nr. 53) — die freiwilligen nicht.
 */
import type { SchildFarbe } from '@/lib/mein-hof'
import { HOFSEITE_HREF, titelbildFoto } from '@/lib/mein-hof'
import { formatSlotTime, type WeeklySlot } from '@/lib/pickup-days'
import { ABHOLZEITEN_FEHLEN_ZEILE } from '@/lib/pickup-slot-rules'
import { ueberUnsText } from '@/lib/hofseite-kunde'
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
  /** Leitspruch unter dem Hofnamen (Farm.tagline). */
  tagline: string | null
  foundedYear: number | null
  /** Die Titel der Werte, in ihrer Reihenfolge. */
  werte: readonly string[]
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
  /** Zählt nicht zum Fortschritt (Leitspruch/Gründungsjahr, Werte — Nr. 50). */
  freiwillig: boolean
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

/**
 * Der Name jeder Zeile — eine Quelle für Liste, Editor, Blatt und für die
 * Meldung, wenn ein gespeicherter Wert das Speichern sperrt (abschnitt-stand.ts).
 */
export const ZEILE_TITEL: Record<HofseiteZeileId, string> = {
  titelbild: 'Titelbild',
  logo: 'Logo',
  name: 'Name und Kurzbeschreibung',
  tagline: 'Leitspruch und Gründungsjahr',
  'ueber-uns': 'Über uns',
  werte: 'Werte',
  fotos: 'Fotos',
  adresse: 'Adresse und Standort',
  abholzeiten: 'Abholzeiten',
  zahlung: 'Zahlungsarten',
  kontakt: 'Kontakt',
  bestellungen: 'Bestellungen',
  abschnitte: 'Abschnitte der Hofseite',
}

const FEHLT = { text: 'Fehlt', farbe: 'bernstein' } as const
/** Freiwilliges fehlt leise: grau statt bernstein — es ist kein offener Punkt. */
const FEHLT_FREIWILLIG = { text: 'Fehlt', farbe: 'grau' } as const

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

/** „„Frisch vom Feld“ · seit 1987" — Leitspruch und Gründungsjahr in einer Zeile. */
function leitspruchWert(leitspruch: string, jahr: number | null): string {
  if (leitspruch && jahr !== null) return `„${leitspruch}“ · seit ${jahr}`
  if (leitspruch) return `„${leitspruch}“`
  if (jahr !== null) return `Seit ${jahr} · noch kein Leitspruch`
  return 'Freiwillig — ein kurzer Satz unter deinem Hofnamen und seit wann es den Hof gibt'
}

function zeilen(stand: HofseiteStand): HofseiteZeile[] {
  const titelbild = titelbildFoto(stand) !== null
  const logo = (stand.logoUrl ?? '').trim().length > 0
  const beschreibung = einzeilig(stand.description)
  // Dieselbe Regel wie die Hofseite (Nr. 49): ohne eigenen Text zählt die Kurzbeschreibung.
  const ueberUns = einzeilig(ueberUnsText(stand) ?? '')
  const leitspruch = einzeilig(stand.tagline ?? '')
  const online = stand.acceptsOnline && stand.stripeAccountReady
  const kontakt = stand.phone.trim().length > 0 && stand.email.trim().length > 0
  const sichtbar = stand.sektionen
    .filter((s) => s.visible)
    .toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((s) => ABSCHNITT_LABEL[s.key] ?? s.key)

  const zeile = (
    id: HofseiteZeileId,
    gruppe: HofseiteGruppeId,
    wert: string,
    fertig: boolean,
    marke: HofseiteZeile['marke'] = fertig ? null : FEHLT
  ): HofseiteZeile => ({ id, gruppe, titel: ZEILE_TITEL[id], wert, fertig, marke, freiwillig: false })
  const freiwillig = (id: HofseiteZeileId, wert: string, fertig: boolean): HofseiteZeile => ({
    ...zeile(id, 'auftritt', wert, fertig, fertig ? null : FEHLT_FREIWILLIG),
    freiwillig: true,
  })

  return [
    zeile(
      'titelbild',
      'auftritt',
      titelbild ? 'Foto gesetzt · Ausschnitt anpassbar' : 'Farbverlauf — ein eigenes Foto wirkt persönlicher',
      titelbild
    ),
    zeile(
      'logo',
      'auftritt',
      logo ? 'Logo gesetzt' : 'Fehlt — macht deinen Hof auf einen Blick erkennbar',
      logo
    ),
    zeile(
      'name',
      'auftritt',
      beschreibung ? `${stand.name} · ${beschreibung}` : `${stand.name} — Kurzbeschreibung fehlt`,
      beschreibung.length > 0
    ),
    freiwillig('tagline', leitspruchWert(leitspruch, stand.foundedYear), leitspruch.length > 0),
    zeile('ueber-uns', 'auftritt', ueberUns || 'Noch kein Text', ueberUns.length > 0),
    freiwillig(
      'werte',
      stand.werte.length > 0 ? stand.werte.join(' · ') : 'Freiwillig — bis zu 4, etwa Regional oder Saisonal',
      stand.werte.length > 0
    ),
    zeile(
      'fotos',
      'auftritt',
      stand.fotos === 0 ? 'Noch keine Fotos' : stand.fotos === 1 ? '1 Foto' : `${stand.fotos} Fotos`,
      stand.fotos > 0
    ),
    zeile(
      'adresse',
      'abholen-bezahlen',
      `${stand.address}, ${stand.postalCode} ${stand.city} · ${
        stand.hatKoordinaten ? 'auf der Karte gesetzt' : 'Standort auf der Karte fehlt'
      }`,
      stand.hatKoordinaten
    ),
    zeile(
      'abholzeiten',
      'abholen-bezahlen',
      stand.abholzeiten.length > 0
        ? abholzeitenKurz(stand.abholzeiten)
        : ABHOLZEITEN_FEHLEN_ZEILE,
      stand.abholzeiten.length > 0
    ),
    // Die Zeile zählt als fertig, trägt ohne Online-Zahlung aber das
    // Warnschild „Online fehlt" statt des Häkchens (Mockup hof-mein-hof-v2-desktop).
    // Stripe ist Pflicht (Register Z1) — gezählt wird die Pflicht aber nur
    // einmal: in Einrichten und Erste Schritte, die dafür einen eigenen Schritt
    // haben. Hier zählte sie sonst doppelt („Hofseite 10 von 11").
    zeile(
      'zahlung',
      'abholen-bezahlen',
      online ? 'Online mit Karte · vor Ort bar und mit Karte' : 'Vor Ort bar und mit Karte · Online-Zahlung noch nicht eingerichtet',
      true,
      online ? null : { text: 'Online fehlt', farbe: 'bernstein' }
    ),
    zeile(
      'kontakt',
      'abholen-bezahlen',
      kontakt ? `${stand.phone} · ${stand.email}` : 'Telefon oder E-Mail fehlt',
      kontakt
    ),
    // Pausiert ist ein Zustand, kein Fehlen: fertig, aber mit eigenem Wort.
    zeile(
      'bestellungen',
      'sichtbarkeit',
      stand.isPaused ? 'Pausiert — Kunden können gerade nicht bestellen' : 'Nimmt Bestellungen an — pausieren möglich',
      true,
      stand.isPaused ? { text: 'Pausiert', farbe: 'bernstein' } : null
    ),
    zeile('abschnitte', 'sichtbarkeit', sichtbar.join(' · '), true),
  ]
}

/** „Logo", „Logo und Über uns", „Logo, Über uns und Fotos". */
export function aufzaehlung(teile: readonly string[]): string {
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
  // Freiwillige Zeilen zählen nicht — sonst sänke der Prozentwert jedes Hofs ohne Leitspruch.
  const gezaehlt = alle.filter((z) => !z.freiwillig)
  const fehlend = gezaehlt.filter((z) => !z.fertig).map((z) => z.titel)
  const erledigt = gezaehlt.length - fehlend.length
  return {
    gruppen,
    erledigt,
    gesamt: gezaehlt.length,
    prozent: Math.round((erledigt / gezaehlt.length) * 100),
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
 * selbst entscheidet. Leitspruch, Gründungsjahr und Werte darf ein Aufrufer
 * weglassen (Heute lädt sie nicht): Sie zählen nicht zum Fortschritt, die
 * Zahl bleibt dieselbe.
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
    tagline?: string | null
    foundedYear?: number | null
    farmValues?: readonly { title: string }[]
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
    tagline: hof.tagline ?? null,
    foundedYear: hof.foundedYear ?? null,
    werte: (hof.farmValues ?? []).map((w) => w.title),
  }
}

/**
 * Wohin die Vorschau springt, wenn eine Zeile offen ist (bzw. nach
 * „Gespeichert · Ansehen"): das Element mit `data-abschnitt` auf der
 * Hofseite. Mehrere Zeilen teilen sich ein Ziel — Logo, Name, Leitspruch und
 * Adresse stehen alle auf dem Titelbild; Gründungsjahr und Werte in der Karte
 * „Über uns" (seit Nr. 50 mit eigenem Ziel `ueberuns`; vorher sprang „Über
 * uns" zum Titelbild).
 */
export const ZIEL_ABSCHNITT: Record<HofseiteZeileId, string> = {
  titelbild: 'titelbild',
  logo: 'titelbild',
  name: 'titelbild',
  tagline: 'titelbild',
  'ueber-uns': 'ueberuns',
  werte: 'ueberuns',
  fotos: 'fotos',
  adresse: 'titelbild',
  abholzeiten: 'abholung',
  zahlung: 'kontakt',
  kontakt: 'kontakt',
  bestellungen: 'bestellungen',
  abschnitte: 'abschnitte',
}

/**
 * Wo ein Punkt der Liste außerhalb von Mein Hof bearbeitet wird — die
 * Übersicht der Einstellungen (lib/hof-einstellungen.ts) ordnet damit die
 * fehlenden Punkte ihren Zeilen zu („Hofdaten", „Mein Auftritt"), und „Zu
 * tun" auf Heute (zuTun in erste-schritte.ts, seit Nr. 53) verlinkt dorthin.
 * Was früher „Mein Auftritt" war (/settings/appearance), liegt seit Nr. 50 in
 * Mein Hof selbst (Register N4); in Mein Hof öffnet jede Zeile ihr Formular
 * direkt — ab lg in der Zeile, darunter im Blatt. Jedes Ziel ist eine Seite
 * unter src/app/(hof) (tests/mein-hof-seite.test.ts).
 */
export const EINSTELLUNG_FUER_ZEILE: Record<HofseiteZeileId, string> = {
  titelbild: HOFSEITE_HREF,
  logo: HOFSEITE_HREF,
  name: '/settings/profile',
  tagline: HOFSEITE_HREF,
  'ueber-uns': HOFSEITE_HREF,
  werte: HOFSEITE_HREF,
  fotos: HOFSEITE_HREF,
  adresse: '/settings/profile',
  abholzeiten: '/settings/pickup-slots',
  zahlung: '/settings/payments',
  kontakt: '/settings/profile',
  bestellungen: '/settings/pause',
  abschnitte: HOFSEITE_HREF,
}

/**
 * Die Zeilen in der Reihenfolge, in der ihre Abschnitte auf der Hofseite am
 * Handy stehen (hofseite-kunde.tsx, von oben nach unten): Titelbild mit Name,
 * Leitspruch und Adresse, der Hinweis bei Pause, die Reiter, das Schaufenster
 * mit dem Fotostreifen (Register N5, Nr. 51), dann die Seitenspalte
 * (Abholung, Zahlung und Kontakt) und Über uns mit Gründungsjahr und Werten.
 * So liest sich die Liste „Bearbeiten" unter lg wie die Seite, die die Kundin
 * sieht (Nr. 50). Maßstab ist die Übersicht mit Produkten: Ohne Produkte gibt
 * es kein Schaufenster, die Fotos stehen dann als Raster nach Über uns. Ab lg
 * bleiben die Gruppen des Editors.
 */
export const HOFSEITE_REIHENFOLGE: readonly HofseiteZeileId[] = [
  'titelbild',
  'logo',
  'name',
  'tagline',
  'adresse',
  'bestellungen',
  'abschnitte',
  'fotos',
  'abholzeiten',
  'zahlung',
  'kontakt',
  'ueber-uns',
  'werte',
]

/** Die Zeilen des Fortschritts in der Reihenfolge der Hofseite (HOFSEITE_REIHENFOLGE). */
export function zeilenWieAufDerHofseite(fortschritt: HofseiteFortschritt): HofseiteZeile[] {
  const alle = fortschritt.gruppen.flatMap((g) => g.zeilen)
  return HOFSEITE_REIHENFOLGE.flatMap((id) => alle.filter((z) => z.id === id))
}
