/**
 * Höfe und Freischaltung im Admin (Nachtlauf Nr. 22f; Mockups
 * admin-hoefe-und-freischaltung, admin-mobil-unterwegs-freischalten): was eine
 * Hofzeile sagt, wann Freischalten gesperrt ist, welche Filter es gibt. Rein
 * und ohne Datenbank prüfbar (tests/admin-hoefe.test.ts).
 *
 * Die Wirkung (freischalten, zurücknehmen, ablehnen, Gebühr setzen) bleibt in
 * src/server/actions/admin.ts; die Seite entscheidet hier nur, was sie zeigt.
 */
import { euroEingabeZuCent, formatZahl } from '@/lib/format'
import { wienKalendertag } from '@/lib/kalender'
import { SERVICEGEBUEHR_STANDARD_PROZENT } from '@/lib/konditionen'
import { FREISCHALTUNG_EMAIL_OFFEN_TEXT } from '@/lib/email-bestaetigung'
import { datumKurz } from '@/lib/verkauf-eintragen'
import { einstellungKurz, kalendertagInWien } from '@/lib/servicegebuehr'
import { MINDESTGEBUEHR_KEINE_ZAHL } from '@/schemas/servicegebuehr'

/**
 * Jeder Hof braucht vor dem Freischalten ein fertiges Stripe-Konto (Register
 * Z1, Mockup: „Stripe fehlt – Freischalten erst nach Stripe möglich"). Die
 * Sperre sitzt in approveFarmAction; hier steht nur, warum der Knopf ruht.
 */
export const FREISCHALTUNG_STRIPE_OFFEN_TEXT = 'Stripe fehlt – Freischalten erst nach Stripe möglich.'

/**
 * Das bedingte Schreiben der Freischaltung traf nichts: Zwischen Lesen und
 * Schreiben ist Stripe weggefallen, oder jemand hat den Hof schon
 * freigeschaltet bzw. gelöscht.
 */
export const FREISCHALTUNG_GEAENDERT_TEXT =
  'Der Hof hat sich gerade geändert (Stripe nicht mehr fertig oder schon freigeschaltet). Lade die Seite neu und versuch es noch einmal.'

/**
 * Warum ein wartender Hof (noch) nicht freigeschaltet werden kann — null, wenn
 * nichts im Weg steht. EINE Regel für Liste und Action (approveFarmAction).
 *
 * - Die E-Mail zuerst (S3, Nr. 17b): Sie kann der Hof sofort nachholen.
 * - Dann Stripe, für JEDEN Hof (Register Z1): Eine Wahl „nur bar" gibt es
 *   nicht mehr, `acceptsOnline` spielt hier keine Rolle. Die Lesart aus 22f
 *   Runde 1 (Sperre nur bei Online-Wunsch) ist verworfen.
 */
export function freischaltSperre(hof: { emailBestaetigungOffen: boolean; stripeBereit: boolean }): string | null {
  if (hof.emailBestaetigungOffen) return FREISCHALTUNG_EMAIL_OFFEN_TEXT
  if (!hof.stripeBereit) return FREISCHALTUNG_STRIPE_OFFEN_TEXT
  return null
}

/** Das Kennzeichen für freigeschaltete Höfe ohne Stripe (Z1) — Marke und Filter. */
export const STRIPE_FEHLT_TEXT = 'Stripe fehlt'

/**
 * Ein freigeschalteter Hof ohne fertiges Stripe-Konto (Register Z1): Er bleibt
 * online, der Betreiber soll ihn aber ansprechen. Wartende haben dafür ihre
 * Sperre (freischaltSperre), stillgelegte sind vom Netz.
 */
export function stripeFehlt(hof: { approvedAt: Date | null; archivedAt: Date | null; stripeBereit: boolean }): boolean {
  return hof.approvedAt !== null && hof.archivedAt === null && !hof.stripeBereit
}

/** Das Kennzeichen für Bestandshöfe mit Stripe, aber `acceptsOnline` false — neutral, kein Mangel des Kontos. */
export const ONLINE_AUS_TEXT = 'Online-Zahlung aus'

/**
 * Freigeschaltet, Stripe fertig, aber Online steht aus der Zeit vor Z1 noch
 * auf aus: Der Checkout bietet online dann nicht an. Der Hof schaltet es in
 * den Zahlungs-Einstellungen selbst ein; der Betreiber findet ihn über den
 * eigenen Filter.
 */
export function onlineAus(hof: { approvedAt: Date | null; archivedAt: Date | null; stripeBereit: boolean; onlineAn: boolean }): boolean {
  return hof.approvedAt !== null && hof.archivedAt === null && hof.stripeBereit && !hof.onlineAn
}

export type HofStatusId = 'wartet' | 'stillgelegt' | 'pausiert' | 'stripe-fehlt' | 'online-aus' | 'online'

/** Der Ton einer Marke — dieselben Werte wie StatusBadge (components/ui/status-badge.tsx). */
export type HofTon = 'offen' | 'fertig' | 'neutral'

export type HofStatus = { id: HofStatusId; text: string; ton: HofTon }

/**
 * Der Zustand eines Hofs in einem Wort (Mockup: Online, Pausiert, Zahlung
 * fehlt — seit Z1 „Stripe fehlt"). Reihenfolge zählt: Stillgelegt und Wartet
 * nehmen die Hofseite vom Netz und stechen alles andere; Pausiert ist ein
 * Wunsch des Hofs (der Filter „Stripe fehlt" findet einen pausierten Hof ohne
 * Stripe trotzdem, er fragt `stripeFehlt`). Orange, nie Rot: Der Hof ist
 * online, der Betreiber kann nachfassen.
 */
export function hofStatus(hof: {
  approvedAt: Date | null
  archivedAt: Date | null
  isPaused: boolean
  stripeBereit: boolean
  onlineAn: boolean
}): HofStatus {
  if (hof.archivedAt) return { id: 'stillgelegt', text: 'Stillgelegt', ton: 'neutral' }
  if (hof.approvedAt === null) return { id: 'wartet', text: 'Wartet', ton: 'offen' }
  if (hof.isPaused) return { id: 'pausiert', text: 'Pausiert', ton: 'neutral' }
  if (!hof.stripeBereit) return { id: 'stripe-fehlt', text: STRIPE_FEHLT_TEXT, ton: 'offen' }
  if (!hof.onlineAn) return { id: 'online-aus', text: ONLINE_AUS_TEXT, ton: 'neutral' }
  return { id: 'online', text: 'Online', ton: 'fertig' }
}

/** Die Filter über der Hofliste (Mockup: Alle · Online · Pausiert · Ohne Zahlung → „Stripe fehlt"), dazu Stillgelegt. */
export const HOF_FILTER_WERTE = ['alle', 'online', 'pausiert', 'stripe-fehlt', 'online-aus', 'stillgelegt'] as const
export type HofFilter = (typeof HOF_FILTER_WERTE)[number]

export const HOF_FILTER_LABEL: Record<HofFilter, string> = {
  alle: 'Alle',
  online: 'Online',
  pausiert: 'Pausiert',
  'stripe-fehlt': STRIPE_FEHLT_TEXT,
  'online-aus': ONLINE_AUS_TEXT,
  stillgelegt: 'Stillgelegt',
}

const FILTER_STATUS: Record<Exclude<HofFilter, 'alle' | 'stripe-fehlt' | 'online-aus'>, HofStatusId> = {
  online: 'online',
  pausiert: 'pausiert',
  stillgelegt: 'stillgelegt',
}

type FilterHof = { name: string; slug: string; status: HofStatus; stripeFehlt: boolean; onlineAus: boolean }

/** Passt ein Hof zu einem Filter? „Stripe fehlt" fragt das Kennzeichen, die übrigen den Status. */
function passtZumFilter(hof: FilterHof, filter: HofFilter): boolean {
  if (filter === 'alle') return true
  if (filter === 'stripe-fehlt') return hof.stripeFehlt
  if (filter === 'online-aus') return hof.onlineAus
  return hof.status.id === FILTER_STATUS[filter]
}

/** Passt ein Hof zur Suche? Name oder Adresse der Hofseite, ohne Groß/klein. */
export function passtZurSuche(hof: { name: string; slug: string }, suche: string): boolean {
  const s = suche.trim().toLocaleLowerCase('de-AT')
  if (s === '') return true
  return hof.name.toLocaleLowerCase('de-AT').includes(s) || hof.slug.toLocaleLowerCase('de-AT').includes(s)
}

/**
 * Die Liste unter den wartenden Höfen: nur freigeschaltete und stillgelegte
 * (wartende stehen oben als eigene Karten), gefiltert und gesucht.
 */
export function filtereHoefe<T extends FilterHof>(hoefe: readonly T[], ansicht: { filter: HofFilter; suche: string }): T[] {
  return hoefe.filter((h) => {
    if (h.status.id === 'wartet') return false
    if (!passtZumFilter(h, ansicht.filter)) return false
    return passtZurSuche(h, ansicht.suche)
  })
}

/** Die Zahl hinter jedem Filter-Chip — ohne Suche, wie in der Kundenliste. */
export function zaehleHofFilter(hoefe: readonly FilterHof[]): Record<HofFilter, number> {
  const zahlen: Record<HofFilter, number> = { alle: 0, online: 0, pausiert: 0, 'stripe-fehlt': 0, 'online-aus': 0, stillgelegt: 0 }
  for (const h of hoefe) {
    if (h.status.id === 'wartet') continue
    for (const f of HOF_FILTER_WERTE) {
      if (passtZumFilter(h, f)) zahlen[f]++
    }
  }
  return zahlen
}

/** Die Adresse der Hofliste mit Filter und Suche — ohne Standardwerte. */
export function hoefeAdresse(ansicht: { filter: HofFilter; suche: string }): string {
  const parameter = new URLSearchParams()
  if (ansicht.filter !== 'alle') parameter.set('filter', ansicht.filter)
  const suche = ansicht.suche.trim()
  if (suche !== '') parameter.set('suche', suche)
  const q = parameter.toString()
  return q ? `/admin?${q}` : '/admin'
}

/** „registriert heute", „registriert gestern", „registriert Fr, 25. Sep" — Wiener Tag. */
export function registriertText(createdAt: Date, jetzt: Date): string {
  const tag = datumKurz(wienKalendertag(createdAt), wienKalendertag(jetzt))
  return tag === 'Heute' || tag === 'Gestern' ? `registriert ${tag.toLowerCase()}` : `registriert ${tag}`
}

/**
 * Der Satz der Servicegebühr in der Tabelle: „5 %" bzw. „5 % ab 01.11.2026",
 * solange der Satz noch nicht gilt, oder „gebührenfrei". Nur Anzeige — die
 * Gebühr rechnet allein berechneServicegebuehr, jede Bestellung friert ihre
 * zur Bestellzeit ein.
 */
export function satzKurz(einstellung: { prozent: number; giltAb: Date | null }, jetzt: Date): string {
  if (einstellung.giltAb === null) return 'gebührenfrei'
  const satz = `${einstellung.prozent.toLocaleString('de-AT', { maximumFractionDigits: 2 })} %`
  if (einstellung.giltAb.getTime() <= jetzt.getTime()) return satz
  const tag = einstellung.giltAb.toLocaleDateString('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Vienna',
  })
  return `${satz} ab ${tag}`
}

/** Der Satz unter der Tabelle (Mockup) — der Standard aus konditionen.ts, keine Zahl im Text. */
export const SERVICEGEBUEHR_NUR_NEUE =
  `Servicegebühr pro Hof änderbar (Standard ${formatZahl(SERVICEGEBUEHR_STANDARD_PROZENT)} %). ` +
  'Gilt nur für neue Bestellungen – bestehende behalten ihren Satz.'

/**
 * Die Betriebsnummer, wie der Hof sie angegeben hat — nur Anzeige (Register
 * E9): Die Plattform prüft sie nicht, es gibt keinen Haken „geprüft".
 */
export function nummerAnzeige(betriebsnummer: string | null): string | null {
  const nummer = betriebsnummer?.trim()
  return nummer ? nummer : null
}

export const NUMMER_HINWEIS = 'Betriebsnummern laut Angabe des Hofs.'

// ─── Die Zeile, wie die Seite sie an den Browser gibt ──────────────────────

/** Was die Admin-Abfrage je Hof liefert (getAdminFarms) — nur die Felder, die die Zeile liest. */
export type HofRohdaten = {
  id: string
  name: string
  slug: string
  ownerEmail: string
  emailBestaetigt: boolean
  emailBestaetigungOffen: boolean
  createdAt: Date
  approvedAt: Date | null
  archivedAt: Date | null
  land: string
  serviceFeePercent: number
  serviceFeeMinCents: number
  serviceFeeActiveFrom: Date | null
  monat: { bestellungen: number; gebuehrOnlineCents: number; gebuehrBarCents: number; gebuehrEntfallenCents: number }
  monatBezeichnung: string
  stripeBereit: boolean
  /** Farm.acceptsOnline — false nur bei Bestandshöfen aus der Zeit vor Register Z1. */
  onlineAn: boolean
  isPaused: boolean
  betriebsnummer: string | null
  sepaErteilt: boolean
}

/**
 * Eine Hofzeile nur aus Text, Zahlen und Wahrheitswerten — kein Date an die
 * Client-Komponente (CODING_STANDARDS „Serialisierung"). Der Zeitpunkt kommt
 * einmal von der Seite.
 */
export type AdminHofZeile = {
  id: string
  name: string
  slug: string
  ownerEmail: string
  /** „ja", „nein" oder „nein (Konto vor der Pflicht)" — S3, Nr. 17b. */
  emailBestaetigtText: string
  emailBestaetigungOffen: boolean
  registriert: string
  /** TT.MM.JJJJ der Freischaltung, sonst null. */
  freigeschaltetAm: string | null
  status: HofStatus
  /** Belegter Gründungsplatz (1 … 12) — null ohne Platz. */
  gruendungsplatz: number | null
  stripeBereit: boolean
  /** Freigeschaltet, aber ohne fertiges Stripe-Konto (stripeFehlt, Z1). */
  stripeFehlt: boolean
  onlineAn: boolean
  /** Freigeschaltet, Stripe fertig, Online aber aus (onlineAus). */
  onlineAus: boolean
  sepaErteilt: boolean
  nummer: string | null
  istDeutsch: boolean
  sperre: string | null
  satz: string
  satzLang: string
  monat: HofRohdaten['monat']
  monatBezeichnung: string
  /** Vorbelegung des Gebühren-Formulars: Prozent als Text, Mindestgebühr in Cent, Tag JJJJ-MM-TT oder leer. */
  gebuehr: { prozent: string; mindestCents: number; giltAbTag: string }
}

function tagText(d: Date): string {
  return d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Vienna' })
}

export function adminHofZeile(
  hof: HofRohdaten,
  zusatz: { gruendungsplatz: number | null; maxPlaetze: number },
  jetzt: Date
): AdminHofZeile {
  const platz = zusatz.gruendungsplatz !== null && zusatz.gruendungsplatz <= zusatz.maxPlaetze ? zusatz.gruendungsplatz : null
  return {
    id: hof.id,
    name: hof.name,
    slug: hof.slug,
    ownerEmail: hof.ownerEmail,
    emailBestaetigtText: hof.emailBestaetigt ? 'ja' : hof.emailBestaetigungOffen ? 'nein' : 'nein (Konto vor der Pflicht)',
    emailBestaetigungOffen: hof.emailBestaetigungOffen,
    registriert: registriertText(hof.createdAt, jetzt),
    freigeschaltetAm: hof.approvedAt ? tagText(hof.approvedAt) : null,
    status: hofStatus(hof),
    // Ein wartender Hof hat noch keinen Platz, ein stillgelegter belegt keinen mehr.
    gruendungsplatz: hof.approvedAt && !hof.archivedAt ? platz : null,
    stripeBereit: hof.stripeBereit,
    stripeFehlt: stripeFehlt(hof),
    onlineAn: hof.onlineAn,
    onlineAus: onlineAus(hof),
    sepaErteilt: hof.sepaErteilt,
    nummer: nummerAnzeige(hof.betriebsnummer),
    istDeutsch: hof.land === 'DE',
    sperre: hof.approvedAt === null ? freischaltSperre(hof) : null,
    satz: satzKurz({ prozent: hof.serviceFeePercent, giltAb: hof.serviceFeeActiveFrom }, jetzt),
    satzLang: einstellungKurz(hof),
    monat: hof.monat,
    monatBezeichnung: hof.monatBezeichnung,
    gebuehr: {
      prozent: String(hof.serviceFeePercent),
      mindestCents: hof.serviceFeeMinCents,
      giltAbTag: hof.serviceFeeActiveFrom ? kalendertagInWien(hof.serviceFeeActiveFrom) : '',
    },
  }
}

/** Der Satz im Servicegebühr-Dialog, wenn die Mindestgebühr kein Betrag ist —
 *  derselbe, den der Server bei falschem Typ zurückgibt (Nr. 47, eine Quelle). */
export const MINDESTGEBUEHR_UNGUELTIG = MINDESTGEBUEHR_KEINE_ZAHL

/**
 * Die getippte Mindestgebühr (Euro) → ganze Cent für setServiceFeeAction,
 * `null` = kein gültiger Betrag (der Dialog zeigt MINDESTGEBUEHR_UNGUELTIG und
 * schickt nichts). Leer bleibt 0 € wie bisher: So hat sich das Feld immer
 * verhalten, und eine Mindestgebühr von 0 € ist erlaubt (Nr. 32, Runde 1).
 */
export function mindestgebuehrCent(eingabe: string): number | null {
  if (eingabe.trim() === '') return 0
  return euroEingabeZuCent(eingabe)
}

/**
 * Der getippte Prozentsatz → Zahl für setServiceFeeAction (Nr. 35), `null` =
 * keiner (der Dialog zeigt PROZENT_UNGUELTIG und schickt nichts). Über die
 * Ziffern wie bei der Mindestgebühr — Komma oder Punkt, höchstens zwei
 * Nachkommastellen, kein Exponent —, als ganze Hundertstel und erst am Ende
 * geteilt: 490 / 100 ist genau die Zahl 4,9, die das Schema erwartet.
 * Leer ist, anders als bei der Mindestgebühr, kein Satz: Vorher wurde daraus
 * still 0 % — eine Gebühr soll nie aus einem versehentlich geleerten Feld fallen.
 */
export function prozentsatzEingabe(eingabe: string): number | null {
  const hundertstel = euroEingabeZuCent(eingabe)
  if (hundertstel === null || hundertstel > 10_000) return null
  return hundertstel / 100
}
