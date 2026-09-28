/**
 * Die Navigation des Bauern-Bereichs — EINE Ordnung für Handy und Browser.
 *
 * Am Handy: Heute · Bestellungen · ➕ · Produkte · Mehr. Im Browser dieselbe
 * Reihenfolge als Seitenleiste: Hof-Visitenkarte, „Neu", die Hauptpunkte,
 * die Gruppe „Dein Hof", unten der Rest. Die Komponente
 * (components/farmer/farmer-nav.tsx) ordnet nur Symbole zu und zeichnet —
 * welcher Punkt wohin gehört und wann er aktiv ist, steht hier und ist
 * getestet (tests/bauern-navigation.test.ts).
 *
 * Das Plus in der Mitte ist eine bewusste Entscheidung für die drei
 * häufigsten Handlungen; es öffnet die vorhandenen Dialoge über die
 * URL-Parameter ?neu=1 (lib/url-auftrag.ts), keine neuen.
 */

export type NavPunktId =
  | 'heute'
  | 'bestellungen'
  | 'produkte'
  | 'hofseite'
  | 'kunden'
  | 'verkaeufe'
  | 'auswertung'
  | 'status'
  | 'einstellungen'
  | 'fehler-melden'
  | 'meldungen'
  | 'admin'

export type NavPunkt = {
  id: NavPunktId
  label: string
  href: string
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

/** Die drei Hauptpunkte — am Handy direkt in der Leiste. */
export const HAUPT: readonly NavPunkt[] = [
  { id: 'heute', label: 'Heute', href: '/dashboard' },
  { id: 'bestellungen', label: 'Bestellungen', href: '/orders', zahl: 'bestellungen' },
  { id: 'produkte', label: 'Produkte', href: '/products' },
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

/** „Dein Hof" — am Handy im Mehr-Blatt, im Browser als eigene Gruppe. */
export const DEIN_HOF: readonly NavPunkt[] = [
  { id: 'hofseite', label: 'Meine Hof-Seite', href: '/farm-page' },
  { id: 'kunden', label: 'Kunden', href: '/customers' },
  { id: 'verkaeufe', label: 'Verkäufe', href: '/sales' },
  { id: 'auswertung', label: 'Auswertung', href: '/analytics' },
  // Bisher nur über die Übersicht und die Hof-Seite erreichbar.
  { id: 'status', label: 'Status-Beiträge', href: '/status' },
]

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
  deinHof: readonly NavPunkt[]
  unten: readonly NavPunkt[]
}

/** Die Navigation für dieses Konto — „Admin" nur für den Betreiber. */
export function fuerNutzer({ isAdmin }: { isAdmin: boolean }): Navigation {
  const sichtbar = (p: NavPunkt) => isAdmin || !p.nurAdmin
  return {
    haupt: HAUPT.filter(sichtbar),
    neu: NEU,
    deinHof: DEIN_HOF.filter(sichtbar),
    unten: UNTEN.filter(sichtbar),
  }
}

const ALLE: readonly NavPunkt[] = [...HAUPT, ...DEIN_HOF, ...UNTEN]

function trifft(pfad: string, href: string): boolean {
  const ziel = href.split('?')[0]
  return pfad === ziel || pfad.startsWith(ziel + '/')
}

/**
 * Der aktive Punkt zu einem Pfad — der längste passende, damit ein
 * Unterpfad nie zwei Punkte zugleich hervorhebt. null = kein Punkt
 * (z. B. /onboarding).
 */
export function aktiverPunkt(pfad: string): NavPunktId | null {
  let treffer: NavPunkt | null = null
  for (const punkt of ALLE) {
    if (trifft(pfad, punkt.href) && (!treffer || punkt.href.length > treffer.href.length)) treffer = punkt
  }
  return treffer?.id ?? null
}

/** „Mehr" gilt als aktiv für jeden Pfad, dessen Ziel im Mehr-Blatt liegt. */
export function mehrAktiv(pfad: string): boolean {
  const id = aktiverPunkt(pfad)
  return id !== null && [...DEIN_HOF, ...UNTEN].some((p) => p.id === id)
}
