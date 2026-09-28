/**
 * Die Navigation des Bauern-Bereichs — EINE Ordnung für Handy und Browser.
 *
 * Am Handy: Heute · Bestellungen · ➕ · Mein Hof · Mehr. Im Browser dieselbe
 * Reihenfolge als Seitenleiste: Hof-Visitenkarte, „Neu", die Hauptpunkte,
 * die Gruppe „Verkauf und Kunden", unten der Rest. Die Komponente
 * (components/farmer/farmer-nav.tsx) ordnet nur Symbole zu und zeichnet —
 * welcher Punkt wohin gehört und wann er aktiv ist, steht hier und ist
 * getestet (tests/bauern-navigation.test.ts).
 *
 * Das Plus in der Mitte ist eine bewusste Entscheidung für die drei
 * häufigsten Handlungen; es öffnet die vorhandenen Dialoge über die
 * URL-Parameter ?neu=1 (lib/url-auftrag.ts), keine neuen.
 *
 * „Mein Hof" bündelt drei vorhandene Seiten unter einem gemeinsamen Kopf
 * mit Reitern (components/farmer/mein-hof-kopf.tsx): Produkte, Hofseite,
 * Beiträge. Der Punkt ist auf allen dreien aktiv.
 */

export type NavPunktId =
  | 'heute'
  | 'bestellungen'
  | 'mein-hof'
  | 'kunden'
  | 'verkaeufe'
  | 'auswertung'
  | 'einstellungen'
  | 'fehler-melden'
  | 'meldungen'
  | 'admin'

export type NavPunkt = {
  id: NavPunktId
  label: string
  href: string
  /**
   * Weitere Pfade, auf denen der Punkt aktiv ist — nur bei „Mein Hof", der
   * mit /products startet und auch /farm-page und /status umfasst.
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

/** Die Reiter unter dem Kopf von „Mein Hof" — Produkte ist der Standard. */
export type MeinHofReiterId = 'produkte' | 'hofseite' | 'beitraege'

export type MeinHofReiter = { id: MeinHofReiterId; label: string; href: string }

export const MEIN_HOF_REITER: readonly MeinHofReiter[] = [
  { id: 'produkte', label: 'Produkte', href: '/products' },
  { id: 'hofseite', label: 'Hofseite', href: '/farm-page' },
  { id: 'beitraege', label: 'Beiträge', href: '/status' },
]

/** Die drei Hauptpunkte — am Handy direkt in der Leiste. */
export const HAUPT: readonly NavPunkt[] = [
  { id: 'heute', label: 'Heute', href: '/dashboard' },
  { id: 'bestellungen', label: 'Bestellungen', href: '/orders', zahl: 'bestellungen' },
  {
    id: 'mein-hof',
    label: 'Mein Hof',
    href: MEIN_HOF_REITER[0].href,
    auchAktivAuf: MEIN_HOF_REITER.slice(1).map((r) => r.href),
  },
]

/** Plus bzw. „Neu": die drei häufigsten Handlungen. */
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

/** „Verkauf und Kunden" — am Handy im Mehr-Blatt, im Browser als eigene Gruppe. */
export const VERKAUF_UND_KUNDEN: readonly NavPunkt[] = [
  { id: 'kunden', label: 'Kunden', href: '/customers' },
  { id: 'verkaeufe', label: 'Verkäufe', href: '/sales' },
  { id: 'auswertung', label: 'Auswertung', href: '/analytics' },
]

export const VERKAUF_UND_KUNDEN_TITEL = 'Verkauf und Kunden'

/** Unten: Einstellungen, Briefkasten, Admin — danach folgt „Abmelden" (eine Handlung, kein Ziel). */
export const UNTEN: readonly NavPunkt[] = [
  { id: 'einstellungen', label: 'Einstellungen', href: '/settings' },
  { id: 'fehler-melden', label: 'Fehler melden', href: '/fehler-melden' },
  { id: 'meldungen', label: 'Meine Meldungen', href: '/meldungen' },
  { id: 'admin', label: 'Admin', href: '/admin', nurAdmin: true, zahl: 'admin' },
]

export const ABMELDEN_LABEL = 'Abmelden'

/** Die fünf Plätze der Handy-Leiste, von links nach rechts. */
export type LeistenPlatz = { art: 'punkt'; punkt: NavPunkt } | { art: 'neu' } | { art: 'mehr' }

export const HANDY_LEISTE: readonly LeistenPlatz[] = [
  { art: 'punkt', punkt: HAUPT[0] },
  { art: 'punkt', punkt: HAUPT[1] },
  { art: 'neu' },
  { art: 'punkt', punkt: HAUPT[2] },
  { art: 'mehr' },
]

export type Navigation = {
  haupt: readonly NavPunkt[]
  neu: readonly NeuPunkt[]
  verkaufUndKunden: readonly NavPunkt[]
  unten: readonly NavPunkt[]
}

/** Die Navigation für dieses Konto — „Admin" nur für den Betreiber. */
export function fuerNutzer({ isAdmin }: { isAdmin: boolean }): Navigation {
  const sichtbar = (p: NavPunkt) => isAdmin || !p.nurAdmin
  return {
    haupt: HAUPT.filter(sichtbar),
    neu: NEU,
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

/**
 * Der aktive Punkt zu einem Pfad — der längste passende, damit ein
 * Unterpfad nie zwei Punkte zugleich hervorhebt. null = kein Punkt
 * (z. B. /onboarding).
 */
export function aktiverPunkt(pfad: string): NavPunktId | null {
  let bester: { id: NavPunktId; laenge: number } | null = null
  for (const punkt of ALLE) {
    for (const ziel of [punkt.href, ...(punkt.auchAktivAuf ?? [])]) {
      const laenge = treffer(pfad, ziel)
      if (laenge >= 0 && (!bester || laenge > bester.laenge)) bester = { id: punkt.id, laenge }
    }
  }
  return bester?.id ?? null
}

/** „Mehr" gilt als aktiv für jeden Pfad, dessen Ziel im Mehr-Blatt liegt. */
export function mehrAktiv(pfad: string): boolean {
  const id = aktiverPunkt(pfad)
  return id !== null && [...VERKAUF_UND_KUNDEN, ...UNTEN].some((p) => p.id === id)
}

/**
 * aria-current für einen Punkt: 'page' nur, wenn der Link genau auf diese
 * Seite führt; 'true', wenn er nur für sie steht (Unterseite, oder „Mein Hof"
 * auf /farm-page) — sonst hörte der Screenreader zwei Links mit
 * verschiedenen Zielen als „aktuelle Seite".
 */
export function ariaAktuell(pfad: string, punkt: NavPunkt): 'page' | 'true' | undefined {
  if (aktiverPunkt(pfad) !== punkt.id) return undefined
  return pfad === punkt.href.split('?')[0] ? 'page' : 'true'
}
