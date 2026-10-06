/**
 * Die Navigation der KundeShell (components/shells/kunde-shell.tsx) — EINE
 * Quelle für Kopfzeile im Browser und Unterleiste am Handy. Rein, ohne
 * Browser prüfbar (tests/kunden-navigation.test.ts); die Shell ordnet nur
 * Symbole zu und zeichnet.
 *
 * Grundlage: docs/ai/DESIGN_SYSTEM.md, „Shells und Navigation – feste
 * Einträge", eingeschränkt durch die Entscheidung E8 (docs/nachtlauf/
 * freigabe.md): vorläufig KEIN Kundenkonto. Deshalb gibt es weder „Meine
 * Höfe" noch „Merken" noch „Neuigkeiten deiner Höfe", und die Handy-Leiste hat
 * drei Plätze statt fünf: Entdecken · [Warenkorb] · Bestellungen.
 *
 * „Meine Bestellungen" führt seit Nr. 14 in beiden Zuständen auf
 * /bestellungen: Dort findet die Kundin ihre Bestellungen mit E-Mail und Code
 * (E7/E8, nur für diese Sitzung, kein Konto). Der Punkt steht deshalb auch im
 * Web-Kopf — abgemeldet wie angemeldet —, denn das Ziel der Handy-Leiste muss
 * die Kopfzeile derselben Sitzung auch anbieten.
 *
 * Angemeldet heißt: über die bestehende freiwillige Kunden-Anmeldung
 * (/account/login). Dazu gehört „Mein Konto" (/account/profile) rechts im Kopf.
 *
 * Bestehende Kundenseiten nutzen weiter KundenKopf (src/lib/kunden-kopf.ts);
 * diese Quelle gilt erst, wenn eine Route in die KundeShell umzieht.
 */

export type KundenNavId = 'entdecken' | 'so-gehts' | 'fuer-hoefe' | 'bestellungen' | 'anmelden' | 'konto'

export type KundenNavPunkt = {
  id: KundenNavId
  label: string
  /** Kurzer Name für die Handy-Leiste (10,5 px, fünf Buchstaben weniger). */
  kurz?: string
  href: string
}

const ENTDECKEN: KundenNavPunkt = { id: 'entdecken', label: 'Höfe entdecken', kurz: 'Entdecken', href: '/hoefe' }

// Sprungmarken auf die Abschnitte der Startseite (src/components/startseite/
// startseite-abschnitte.tsx: SoFunktionierts und FuerHoefeBand tragen sie).
const SO_GEHTS: KundenNavPunkt = { id: 'so-gehts', label: 'So funktioniert’s', href: '/#so-funktionierts' }
const FUER_HOEFE: KundenNavPunkt = { id: 'fuer-hoefe', label: 'Für Höfe', href: '/#fuer-hoefe' }

const ANMELDEN: KundenNavPunkt = { id: 'anmelden', label: 'Anmelden', href: '/account/login' }
const KONTO: KundenNavPunkt = { id: 'konto', label: 'Mein Konto', href: '/account/profile' }

/**
 * „Bestellungen finden" (Nr. 14) — dasselbe Ziel für alle: Die Seite zeigt
 * ohne bewiesene Adresse das Formular, danach die Liste. Der Pfad steht in
 * src/lib/bestellungen-finden.ts (BESTELLUNGEN_PFAD); hier als Text, damit
 * die Navigation keine Fachregeln lädt.
 */
const BESTELLUNGEN: KundenNavPunkt = { id: 'bestellungen', label: 'Meine Bestellungen', kurz: 'Bestellungen', href: '/bestellungen' }

export type KundenLeistenPlatz = { art: 'punkt'; punkt: KundenNavPunkt } | { art: 'warenkorb' }

const HANDY_LEISTE: readonly KundenLeistenPlatz[] = [
  { art: 'punkt', punkt: ENTDECKEN },
  { art: 'warenkorb' },
  { art: 'punkt', punkt: BESTELLUNGEN },
]

export type KundenNavigation = {
  /** Die Textlinks der Kopfzeile im Browser, links nach rechts. Suche und Warenkorb zeichnet die Shell. */
  web: readonly KundenNavPunkt[]
  /** Der Knopf rechts in der Kopfzeile — nur abgemeldet. */
  anmelden: KundenNavPunkt | null
  /** Das Konto rechts in der Kopfzeile — nur angemeldet. */
  konto: KundenNavPunkt | null
  /** Die Unterleiste am Handy. */
  handy: readonly KundenLeistenPlatz[]
}

/** Die Navigation passend zur Sitzung — öffentliche Seiten kennen genau diese zwei Varianten. */
export function kundenNavigation({ angemeldet }: { angemeldet: boolean }): KundenNavigation {
  return angemeldet
    ? { web: [ENTDECKEN, BESTELLUNGEN], anmelden: null, konto: KONTO, handy: HANDY_LEISTE }
    : { web: [ENTDECKEN, SO_GEHTS, FUER_HOEFE, BESTELLUNGEN], anmelden: ANMELDEN, konto: null, handy: HANDY_LEISTE }
}

// Jeder Punkt mit eigener Seite. Anker (#…) sind nie eine eigene Seite.
const AKTIVIERBAR: readonly KundenNavPunkt[] = [ENTDECKEN, BESTELLUNGEN, ANMELDEN, KONTO]

/** Der aktive Punkt zu einem Pfad — der längste passende; null auf Startseite, Hofseite und allem anderen. */
export function kundenAktiverPunkt(pfad: string): KundenNavId | null {
  let bester: { id: KundenNavId; laenge: number } | null = null
  for (const punkt of AKTIVIERBAR) {
    if (pfad === punkt.href || pfad.startsWith(punkt.href + '/')) {
      if (!bester || punkt.href.length > bester.laenge) bester = { id: punkt.id, laenge: punkt.href.length }
    }
  }
  return bester?.id ?? null
}

/**
 * aria-current: 'page' auf genau der Zielseite, 'true' auf Unterseiten, sonst
 * nichts. Der Punkt muss selbst dorthin führen.
 */
export function kundenAriaAktuell(pfad: string, punkt: KundenNavPunkt): 'page' | 'true' | undefined {
  if (kundenAktiverPunkt(pfad) !== punkt.id) return undefined
  if (pfad !== punkt.href && !pfad.startsWith(punkt.href + '/')) return undefined
  return pfad === punkt.href ? 'page' : 'true'
}

/**
 * Ob eine Sitzung für die KundeShell als „angemeldet" zählt: nur die
 * freiwillige Kunden-Anmeldung (Rolle CUSTOMER, /account/login). Ein Hof, der
 * im Bauern-Bereich angemeldet ist, bekäme sonst „Mein Konto" mit den
 * Kunden-Abos angeboten — für ihn bleibt die Kundenseite die abgemeldete.
 */
export function istKundensitzung(nutzer: { role?: string | null } | null | undefined): boolean {
  return nutzer?.role === 'CUSTOMER'
}
