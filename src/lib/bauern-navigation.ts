/**
 * Die Navigation des Bauern-Bereichs — EINE Ordnung für Handy und Browser.
 *
 * Am Handy: Heute · Bestellungen · ➕ · Mein Hof · Mehr. Im Browser dieselbe
 * Ordnung als Seitenleiste: Hof-Visitenkarte, „Neu", die Hauptpunkte
 * (dort zusätzlich „Produkte" zwischen Bestellungen und Mein Hof), die Gruppe
 * „Verkauf und Kunden", unten der Rest. Die Komponente
 * (components/farmer/farmer-nav.tsx) ordnet nur Symbole zu und zeichnet —
 * welcher Punkt wohin gehört und wann er aktiv ist, steht hier und ist
 * getestet (tests/bauern-navigation.test.ts).
 *
 * „Produkte" ist Tagesgeschäft und deshalb ein eigener Punkt (Mockup
 * hof-sidebar-komponente.html). Am Handy hat die Leiste nur fünf Plätze —
 * dort liegt Produkte oben im Mehr-Blatt (NUR_IM_MEHR).
 *
 * Das Plus in der Mitte ist eine bewusste Entscheidung für die drei
 * häufigsten Handlungen; es öffnet die vorhandenen Dialoge über die
 * URL-Parameter ?neu=1 (lib/url-auftrag.ts), keine neuen. Der „Neu"-Knopf
 * der Seitenleiste zeigt nach dem Mockup nur die beiden Dinge, die auf der
 * Hofseite landen (NEU_BROWSER).
 *
 * „Mein Hof" bündelt Hofseite und Beiträge unter einem Kopf mit Reitern —
 * beide auf /farm-page (?reiter=beitraege, E12,
 * components/mein-hof/seitenkopf.tsx). /status leitet seit Nr. 22e in den
 * Reiter um; seine Unterseiten (/status/new, WhatsApp fortsetzen) bleiben,
 * und der Punkt ist auch dort aktiv.
 */

import { MEIN_HOF_REITER_PARAMETER, MEIN_HOF_REITER_VALUES, meinHofReiterSchema } from '@/schemas/mein-hof-reiter'

export type NavPunktId =
  | 'heute'
  | 'bestellungen'
  | 'produkte'
  | 'mein-hof'
  | 'kunden'
  | 'verkaeufe'
  | 'auswertung'
  | 'einstellungen'
  | 'hilfe'
  | 'admin'

export type NavPunkt = {
  id: NavPunktId
  label: string
  href: string
  /**
   * Weitere Pfade, auf denen der Punkt aktiv ist: „Mein Hof" startet mit
   * /farm-page und umfasst auch /status mit seinen Unterseiten; „Hilfe und
   * Rückmeldung" führt nach /meldungen und leuchtet auch auf /fehler-melden.
   */
  auchAktivAuf?: readonly string[]
  /** Eine Zahl am Punkt: offene Bestellungen bzw. Meldungen, die auf den Betreiber warten. */
  zahl?: 'bestellungen' | 'admin'
  /** Nur für das Betreiber-Konto (frisch aus der DB, nie aus der Sitzung). */
  nurAdmin?: boolean
}

export type NeuId = 'verkauf-eintragen' | 'status-posten' | 'produkt-anlegen'

/** Ein Eintrag im Plus-Blatt bzw. im „Neu"-Menü: Symbol, Titel, ein Satz. */
export type NeuPunkt = {
  id: NeuId
  label: string
  satz: string
  href: string
}

/** Die Reiter unter dem Kopf von „Mein Hof" — Hofseite ist der Standard. */
export type MeinHofReiterId = (typeof MEIN_HOF_REITER_VALUES)[number]

export type MeinHofReiter = { id: MeinHofReiterId; label: string; href: string }

/**
 * Die Adresse des Reiters „Beiträge" — EINE Quelle für den Reiter, die
 * Umleitung von /status und die Rückwege nach dem Schreiben (Nr. 22e).
 */
export const BEITRAEGE_HREF = `/farm-page?${MEIN_HOF_REITER_PARAMETER}=beitraege`

/**
 * Die Reiter von „Mein Hof" in der HofShell (E12, Nachtlauf Nr. 16): beide
 * auf /farm-page, der Reiter steht in der Adresse. Seit Nr. 22e kann der
 * Reiter „Beiträge" alles, was /status konnte; /status leitet hierher um.
 */
export const MEIN_HOF_REITER_HOFBEREICH: readonly MeinHofReiter[] = [
  { id: 'hofseite', label: 'Hofseite', href: '/farm-page' },
  { id: 'beitraege', label: 'Beiträge', href: BEITRAEGE_HREF },
]

/**
 * Der Reiter aus dem Suchparameter der Seite. Next liefert einen doppelten
 * Parameter als Liste — dann zählt der erste. Alles andere fällt über das
 * Schema still auf „hofseite".
 */
export function meinHofReiterAus(wert: string | string[] | undefined): MeinHofReiterId {
  return meinHofReiterSchema.parse(Array.isArray(wert) ? wert[0] : wert)
}

/** Der Hinweis rechts neben den Reitern im Browser — Produkte hat seinen eigenen Platz in der Leiste. */
export const MEIN_HOF_HINWEIS = 'Produkte verwaltest du links unter „Produkte".'

/** Die Hauptpunkte — im Browser alle vier in der Leiste, am Handy drei davon direkt. */
export const HAUPT: readonly NavPunkt[] = [
  { id: 'heute', label: 'Heute', href: '/dashboard' },
  { id: 'bestellungen', label: 'Bestellungen', href: '/orders', zahl: 'bestellungen' },
  { id: 'produkte', label: 'Produkte', href: '/products' },
  {
    id: 'mein-hof',
    label: 'Mein Hof',
    href: MEIN_HOF_REITER_HOFBEREICH[0].href,
    // /status selbst leitet um; gemeint sind seine Unterseiten (Neuer Beitrag, WhatsApp fortsetzen).
    auchAktivAuf: ['/status'],
  },
]

function hauptPunkt(id: NavPunktId): NavPunkt {
  const punkt = HAUPT.find((p) => p.id === id)
  if (!punkt) throw new Error(`Kein Hauptpunkt „${id}"`)
  return punkt
}

/** Plus am Handy: die drei häufigsten Handlungen. */
export const NEU: readonly NeuPunkt[] = [
  {
    id: 'verkauf-eintragen',
    label: 'Verkauf eintragen',
    satz: 'Was du am Hof oder am Markt verkauft hast.',
    href: '/sales?neu=1',
  },
  {
    id: 'status-posten',
    label: 'Status posten',
    satz: 'Sag deinen Kunden, was es gerade gibt.',
    href: '/status/new',
  },
  {
    id: 'produkt-anlegen',
    label: 'Produkt anlegen',
    satz: 'Etwas Neues für deinen Hofladen.',
    href: '/products?neu=1',
  },
]

/** „Neu" in der Seitenleiste: was auf der Hofseite landet (Mockup hof-mein-hof-v2-desktop.html). */
export const NEU_BROWSER: readonly NeuPunkt[] = [
  { id: 'produkt-anlegen', label: 'Neues Produkt', satz: 'Foto, Preis, Lagerstand', href: '/products?neu=1' },
  { id: 'status-posten', label: 'Neuer Beitrag', satz: 'Neuigkeit auf deiner Hofseite', href: '/status/new' },
]

/** „Verkauf und Kunden" — am Handy im Mehr-Blatt, im Browser als eigene Gruppe. */
export const VERKAUF_UND_KUNDEN: readonly NavPunkt[] = [
  { id: 'kunden', label: 'Kunden', href: '/customers' },
  { id: 'verkaeufe', label: 'Verkäufe', href: '/sales' },
  { id: 'auswertung', label: 'Auswertung', href: '/analytics' },
]

export const VERKAUF_UND_KUNDEN_TITEL = 'Verkauf und Kunden'

/**
 * Unten: Einstellungen, Hilfe, Admin — danach folgt „Abmelden" (eine Handlung,
 * kein Ziel). „Hilfe und Rückmeldung" ist EIN Punkt für Melden und Nachsehen:
 * Er führt nach /meldungen („Meine Meldungen" mit „+ Neue Meldung", seit
 * Nr. 22e nach Mockup web-/mobil-h6-meine-meldungen) und leuchtet auch auf
 * /fehler-melden; zwei Einträge nebeneinander („Fehler melden", „Meine
 * Meldungen") las sich wie zwei verschiedene Dinge.
 */
export const UNTEN: readonly NavPunkt[] = [
  { id: 'einstellungen', label: 'Einstellungen', href: '/settings' },
  { id: 'hilfe', label: 'Hilfe und Rückmeldung', href: '/meldungen', auchAktivAuf: ['/fehler-melden'] },
  { id: 'admin', label: 'Admin', href: '/admin', nurAdmin: true, zahl: 'admin' },
]

export const ABMELDEN_LABEL = 'Abmelden'

/** Die fünf Plätze der Handy-Leiste, von links nach rechts. */
export type LeistenPlatz = { art: 'punkt'; punkt: NavPunkt } | { art: 'neu' } | { art: 'mehr' }

export const HANDY_LEISTE: readonly LeistenPlatz[] = [
  { art: 'punkt', punkt: hauptPunkt('heute') },
  { art: 'punkt', punkt: hauptPunkt('bestellungen') },
  { art: 'neu' },
  { art: 'punkt', punkt: hauptPunkt('mein-hof') },
  { art: 'mehr' },
]

/** Hauptpunkte ohne Platz in der Handy-Leiste — sie stehen oben im Mehr-Blatt. */
export const NUR_IM_MEHR: readonly NavPunkt[] = HAUPT.filter(
  (p) => !HANDY_LEISTE.some((platz) => platz.art === 'punkt' && platz.punkt.id === p.id)
)

export type Navigation = {
  haupt: readonly NavPunkt[]
  neu: readonly NeuPunkt[]
  neuBrowser: readonly NeuPunkt[]
  nurImMehr: readonly NavPunkt[]
  verkaufUndKunden: readonly NavPunkt[]
  unten: readonly NavPunkt[]
}

/** Die Navigation für dieses Konto — „Admin" nur für den Betreiber. */
export function fuerNutzer({ isAdmin }: { isAdmin: boolean }): Navigation {
  const sichtbar = (p: NavPunkt) => isAdmin || !p.nurAdmin
  return {
    haupt: HAUPT.filter(sichtbar),
    neu: NEU,
    neuBrowser: NEU_BROWSER,
    nurImMehr: NUR_IM_MEHR.filter(sichtbar),
    verkaufUndKunden: VERKAUF_UND_KUNDEN.filter(sichtbar),
    unten: UNTEN.filter(sichtbar),
  }
}

const ALLE: readonly NavPunkt[] = [...HAUPT, ...VERKAUF_UND_KUNDEN, ...UNTEN]

/** Wie weit `pfad` unter `ziel` liegt — die Länge des passenden Ziels, sonst -1. */
function treffer(pfad: string, ziel: string): number {
  const ohneSuche = ziel.split('?')[0]
  return pfad === ohneSuche || pfad.startsWith(ohneSuche + '/') ? ohneSuche.length : -1
}

/** Der längste passende Punkt einer Liste — gemeinsam für Bestand und HofShell. */
function aktivIn<Id extends string>(
  liste: readonly { id: Id; href: string; auchAktivAuf?: readonly string[] }[],
  pfad: string
): Id | null {
  let bester: { id: Id; laenge: number } | null = null
  for (const punkt of liste) {
    for (const ziel of [punkt.href, ...(punkt.auchAktivAuf ?? [])]) {
      const laenge = treffer(pfad, ziel)
      if (laenge >= 0 && (!bester || laenge > bester.laenge)) bester = { id: punkt.id, laenge }
    }
  }
  return bester?.id ?? null
}

/**
 * Der aktive Punkt zu einem Pfad — der längste passende, damit ein
 * Unterpfad nie zwei Punkte zugleich hervorhebt. null = kein Punkt
 * (z. B. /onboarding).
 */
export function aktiverPunkt(pfad: string): NavPunktId | null {
  return aktivIn(ALLE, pfad)
}

/** „Mehr" gilt als aktiv für jeden Pfad, dessen Ziel im Mehr-Blatt liegt. */
export function mehrAktiv(pfad: string): boolean {
  const id = aktiverPunkt(pfad)
  return id !== null && [...NUR_IM_MEHR, ...VERKAUF_UND_KUNDEN, ...UNTEN].some((p) => p.id === id)
}

/**
 * aria-current für einen Punkt: 'page' nur, wenn der Link genau auf diese
 * Seite führt; 'true', wenn er nur für sie steht (Unterseite, oder „Mein Hof"
 * auf /status/new) — sonst hörte der Screenreader zwei Links mit
 * verschiedenen Zielen als „aktuelle Seite".
 */
export function ariaAktuell(pfad: string, punkt: NavPunkt): 'page' | 'true' | undefined {
  if (aktiverPunkt(pfad) !== punkt.id) return undefined
  return pfad === punkt.href.split('?')[0] ? 'page' : 'true'
}

// ─── Neue HofShell (Redesign, Gate 2) ───────────────────────────────────────
//
// Die Ordnung der HofShell (components/shells/hof-shell.tsx) nach
// docs/ai/DESIGN_SYSTEM.md, „Shells und Navigation – feste Einträge". Sie baut
// aus denselben Punkten wie die Bestandsnavigation oben und steht deshalb in
// derselben Datei — EINE Quelle für die Welt des Hofs. Getrennt bleibt sie,
// solange noch keine Route in die HofShell umgezogen ist: Die Bestandsleiste
// (farmer-nav.tsx) behält ihre Ordnung (Mein Hof in der Handy-Leiste, kein
// „Region"), damit nichts auf einmal umspringt (kein Big Bang). Zieht die
// letzte Seite um, fällt der Bestandsteil weg.
//
// Unterschiede zum Bestand, alle aus dem Mockup:
//  - Handy: Produkte statt Mein Hof in der Leiste; Mein Hof steht in „Mehr".
//  - „Verkauf und Kunden" bekommt „Region" — seit Nr. 22c (Gate 8) eine
//    eigene Route /region mit den Reitern Preise vergleichen | Futter kaufen;
//    das alte /analytics/umfeld leitet dorthin um.
//  - „Beiträge" ist ein Reiter in Mein Hof (E12), kein eigener Punkt.
//  - Das Neu-Menü fragt „Was legst du an?". Seit Nr. 18 bestimmt die Wahl
//    Lebensmittel · Futtermittel · Brennmaterial das Formular (?bereich= am
//    Anlegen-Auftrag, lib/url-auftrag.ts); darunter „Oder etwas anderes":
//    Beitrag und Verkauf eintragen (E13).

/**
 * Die Adresse von „Region" (Nr. 22c) — EINE Quelle für den Punkt der Shell,
 * die Reiter-Links und die Umleitung von /analytics/umfeld.
 */
export const REGION_HREF = '/region'

/** Punkte der HofShell: die des Bestands plus „Region". */
export type HofNavId = NavPunktId | 'region'

export type HofNavPunkt = Omit<NavPunkt, 'id'> & { id: HofNavId }

const REGION: HofNavPunkt = { id: 'region', label: 'Region', href: REGION_HREF }

/** „Verkauf und Kunden" der HofShell — im Browser als Gruppe, am Handy in „Mehr". */
const HOF_VERKAUF_UND_KUNDEN: readonly HofNavPunkt[] = [...VERKAUF_UND_KUNDEN, REGION]

export const HOF_NEU_TITEL = 'Was legst du an?'

/** Die zweite Gruppe des Neu-Menüs (Mockup web-h2-neu-was-legst-du-an). */
export const HOF_NEU_ANDERES_TITEL = 'Oder etwas anderes'

/** Das Wort am Neu-Knopf: in der Seitenleiste und unter dem Plus der Unterleiste (freigabe.md §12 Nr. 45). */
export const HOF_NEU_KNOPF = 'Neu'

/** Der Name des Plus-Knopfs für Vorleser — beginnt mit dem sichtbaren Wort (WCAG 2.5.3 „Label in Name"). */
export const HOF_NEU_KNOPF_NAME = `${HOF_NEU_KNOPF} erstellen`

export type HofNeuId = 'lebensmittel' | 'futtermittel' | 'brennmaterial' | 'status-posten' | 'verkauf-eintragen'

/** Ein Eintrag im Neu-Menü der HofShell: oben die Bereiche (anlegen), darunter der Rest. */
export type HofNeuPunkt = {
  id: HofNeuId
  label: string
  satz: string
  href: string
  gruppe: 'anlegen' | 'anderes'
}

/**
 * „Neues Futtermittel" — das Formular mit Verkaufsgrößen (Nr. 20). Auch der
 * Produktdialog verweist dorthin, wenn man in ihm ein Futtermittel anlegen will.
 */
export const FUTTER_ANLEGEN_HREF = '/products?neu=1&bereich=futter'

/**
 * Das Neu-Menü (Browser: Aufklappmenü am Neu-Knopf und der Dialog hinter
 * „+ Neues Produkt", Handy: Blatt hinter dem Plus) — EINE Liste für alle drei.
 * Seit Gate 6 (Nr. 20) öffnen Futtermittel und Brennmaterial die Formulare mit
 * Verkaufsgrößen (src/components/produkte/futter-formular.tsx,
 * brennmaterial-formular.tsx); Lebensmittel den Produktdialog.
 */
export const HOF_NEU: readonly HofNeuPunkt[] = [
  { id: 'lebensmittel', label: 'Lebensmittel', satz: 'Eier, Gemüse, Fleisch, Brot, Honig …', href: '/products?neu=1&bereich=lebensmittel', gruppe: 'anlegen' },
  { id: 'futtermittel', label: 'Futtermittel', satz: 'Heu, Stroh, Getreide, Silage', href: FUTTER_ANLEGEN_HREF, gruppe: 'anlegen' },
  { id: 'brennmaterial', label: 'Brennmaterial', satz: 'Brennholz, Anzündholz, Hackschnitzel', href: '/products?neu=1&bereich=brennmaterial', gruppe: 'anlegen' },
  { id: 'status-posten', label: 'Neuer Beitrag', satz: 'Neuigkeit auf deiner Hofseite', href: '/status/new', gruppe: 'anderes' },
  { id: 'verkauf-eintragen', label: 'Verkauf eintragen', satz: 'Was du am Hof oder am Markt verkauft hast', href: '/sales?neu=1', gruppe: 'anderes' },
]

export type HofLeistenPlatz = { art: 'punkt'; punkt: HofNavPunkt } | { art: 'neu' } | { art: 'mehr' }

const HOF_HANDY_LEISTE: readonly HofLeistenPlatz[] = [
  { art: 'punkt', punkt: hauptPunkt('heute') },
  { art: 'punkt', punkt: hauptPunkt('bestellungen') },
  { art: 'neu' },
  { art: 'punkt', punkt: hauptPunkt('produkte') },
  { art: 'mehr' },
]

const HOF_ALLE: readonly HofNavPunkt[] = [...HAUPT, ...HOF_VERKAUF_UND_KUNDEN, ...UNTEN]

/** Was in „Mehr" steht: alle Ziele der Seitenleiste ohne Platz in der Handy-Leiste, in Leistenreihenfolge. */
const HOF_MEHR: readonly HofNavPunkt[] = HOF_ALLE.filter(
  (p) => !HOF_HANDY_LEISTE.some((platz) => platz.art === 'punkt' && platz.punkt.id === p.id)
)

export type HofNavigation = {
  /** Seitenleiste oben: Heute · Bestellungen · Produkte · Mein Hof. */
  haupt: readonly HofNavPunkt[]
  verkaufUndKunden: readonly HofNavPunkt[]
  /** Seitenleiste unten, danach folgen Darstellung und Abmelden (Handlungen, keine Ziele). */
  unten: readonly HofNavPunkt[]
  neu: readonly HofNeuPunkt[]
  handyLeiste: readonly HofLeistenPlatz[]
  /** Das Mehr-Blatt am Handy, danach Darstellung und Abmelden. */
  mehr: readonly HofNavPunkt[]
}

/** Die Ordnung der HofShell für dieses Konto — „Admin" nur für den Betreiber. */
export function hofNavigation({ isAdmin }: { isAdmin: boolean }): HofNavigation {
  const sichtbar = (p: HofNavPunkt) => isAdmin || !p.nurAdmin
  return {
    haupt: HAUPT.filter(sichtbar),
    verkaufUndKunden: HOF_VERKAUF_UND_KUNDEN.filter(sichtbar),
    unten: UNTEN.filter(sichtbar),
    neu: HOF_NEU,
    handyLeiste: HOF_HANDY_LEISTE,
    mehr: HOF_MEHR.filter(sichtbar),
  }
}

/** Der aktive Punkt der HofShell — wie `aktiverPunkt`, mit „Region". */
export function hofAktiverPunkt(pfad: string): HofNavId | null {
  return aktivIn(HOF_ALLE, pfad)
}

/** „Mehr" gilt als aktiv für jeden Pfad, dessen Ziel im Mehr-Blatt der HofShell liegt. */
export function hofMehrAktiv(pfad: string): boolean {
  const id = hofAktiverPunkt(pfad)
  return id !== null && HOF_MEHR.some((p) => p.id === id)
}

/** aria-current für einen Punkt der HofShell — Regel wie `ariaAktuell`. */
export function hofAriaAktuell(pfad: string, punkt: HofNavPunkt): 'page' | 'true' | undefined {
  if (hofAktiverPunkt(pfad) !== punkt.id) return undefined
  return pfad === punkt.href.split('?')[0] ? 'page' : 'true'
}
