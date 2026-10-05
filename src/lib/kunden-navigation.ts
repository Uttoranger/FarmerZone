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
 * Angemeldet heißt heute: über die bestehende freiwillige Kunden-Anmeldung
 * (/account/login). Gezeigt wird nur, was es dafür schon gibt — die Seite
 * „Mein Konto" (/account/profile). Eine Seite mit den eigenen Bestellungen
 * gibt es noch nicht: „Bestellungen" führt deshalb vorläufig zur Anmeldung,
 * bis Nr. 08 „Bestellungen finden" (E-Mail und Code, E7/E8) baut — dann
 * ändert sich hier nur das Ziel.
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

// Sprungmarken auf die Startseite, wie im Bestand (kunden-menue.ts). „So
// funktioniert’s" bekommt seine Marke mit dem Umbau der Startseite (Nr. 07);
// bis dahin landet der Link oben auf der Startseite, nicht im Leeren.
const SO_GEHTS: KundenNavPunkt = { id: 'so-gehts', label: 'So funktioniert’s', href: '/#so-funktionierts' }
const FUER_HOEFE: KundenNavPunkt = { id: 'fuer-hoefe', label: 'Für Höfe', href: '/#weiter' }

const ANMELDEN: KundenNavPunkt = { id: 'anmelden', label: 'Anmelden', href: '/account/login' }
const KONTO: KundenNavPunkt = { id: 'konto', label: 'Mein Konto', href: '/account/profile' }

/** Vorläufiges Ziel, siehe Kopf der Datei: die Anmeldung, über die man heute an sein Konto kommt. */
const BESTELLUNGEN: KundenNavPunkt = {
  id: 'bestellungen',
  label: 'Meine Bestellungen',
  kurz: 'Bestellungen',
  href: ANMELDEN.href,
}

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
    : { web: [ENTDECKEN, SO_GEHTS, FUER_HOEFE], anmelden: ANMELDEN, konto: null, handy: HANDY_LEISTE }
}

// Ohne Anmelden: Bestellungen hat (vorläufig) dasselbe Ziel und ist der Punkt,
// der in der Leiste leuchten soll. Anker (#…) sind nie eine eigene Seite.
const AKTIVIERBAR: readonly KundenNavPunkt[] = [ENTDECKEN, BESTELLUNGEN, KONTO]

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

/** aria-current: 'page' auf genau der Zielseite, 'true' auf Unterseiten, sonst nichts. */
export function kundenAriaAktuell(pfad: string, punkt: KundenNavPunkt): 'page' | 'true' | undefined {
  if (kundenAktiverPunkt(pfad) !== punkt.id) return undefined
  return pfad === punkt.href ? 'page' : 'true'
}
