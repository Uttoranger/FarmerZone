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
 * „Meine Bestellungen" führt seit Nr. 14 in jeder Sitzung auf /bestellungen:
 * Dort findet die Kundin ihre Bestellungen mit E-Mail und Code (E7/E8, nur
 * für diese Sitzung, kein Konto). Der Punkt steht deshalb auch im Web-Kopf —
 * in jeder Sitzung —, denn das Ziel der Handy-Leiste muss die Kopfzeile
 * derselben Sitzung auch anbieten.
 *
 * Drei Sitzungen (kundenSitzung): ohne Sitzung steht rechts im Kopf
 * „Anmelden", mit der freiwilligen Kunden-Anmeldung (/account/login) „Mein
 * Konto" (/account/profile), mit einer Hof-Sitzung „Mein Hof" (/dashboard).
 * Seit Nr. 41 (Register N1) führt „Anmelden" auf /login — die Seite zeigt
 * beide Wege, die Hofkarte vorgewählt — und steht auch am Handy oben rechts.
 *
 * Bestehende Kundenseiten nutzen weiter KundenKopf (src/lib/kunden-kopf.ts);
 * für seinen Knopf gilt kopfKnopf aus dieser Quelle — dieselben drei
 * Varianten wie in der KundeShell.
 */

export type KundenNavId = 'entdecken' | 'so-gehts' | 'fuer-hoefe' | 'bestellungen' | 'anmelden' | 'mein-hof' | 'konto'

export type KundenNavPunkt = {
  id: KundenNavId
  label: string
  /** Kurzer Name für die Handy-Leiste (10,5 px, fünf Buchstaben weniger). */
  kurz?: string
  href: string
}

const ENTDECKEN: KundenNavPunkt = { id: 'entdecken', label: 'Höfe entdecken', kurz: 'Entdecken', href: '/hoefe' }

// Sprungmarke auf den Abschnitt der Startseite (src/components/startseite/
// startseite-abschnitte.tsx: SoFunktionierts trägt sie).
const SO_GEHTS: KundenNavPunkt = { id: 'so-gehts', label: 'So funktioniert’s', href: '/#so-funktionierts' }
// Seit Nr. 15 eine eigene Seite (/fuer-hoefe) statt der Sprungmarke auf der Startseite.
const FUER_HOEFE: KundenNavPunkt = { id: 'fuer-hoefe', label: 'Für Höfe', href: '/fuer-hoefe' }

// Register N1: „Anmelden" führt auf die Hof-Anmeldung. Die Seite zeigt auch
// den Weg der Kundinnen (Umschalter am Handy, zwei Karten im Browser) — vorher
// führte die KundeShell auf /account/login, bestehende Höfe fanden ihre
// Anmeldung am Handy nur ganz unten im Fuß der Startseite.
const ANMELDEN: KundenNavPunkt = { id: 'anmelden', label: 'Anmelden', href: '/login' }
// Mit Hof-Sitzung der Weg zurück in den eigenen Bereich (Heute).
const MEIN_HOF: KundenNavPunkt = { id: 'mein-hof', label: 'Mein Hof', href: '/dashboard' }
const KONTO: KundenNavPunkt = { id: 'konto', label: 'Mein Konto', href: '/account/profile' }

/**
 * „Schon dabei? Anmelden" — der Weg bestehender Höfe zur Anmeldung, wo sonst
 * nur Registrieren angeboten wird (Band „Für Höfe" der Startseite,
 * /fuer-hoefe oben und unten, /register). Wort und Ziel des Links sind die des
 * Knopfs „Anmelden".
 */
export const SCHON_DABEI = { frage: 'Schon dabei?', link: ANMELDEN.label, href: ANMELDEN.href } as const

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

/**
 * Wie eine öffentliche Seite die Sitzung sieht: ohne Sitzung (`gast`), mit
 * der freiwilligen Kunden-Anmeldung (`kunde`) oder mit einer Hof-Sitzung
 * (`hof`, Register N1).
 */
export type KundenSitzung = 'gast' | 'kunde' | 'hof'

export type KundenNavigation = {
  /** Die Textlinks der Kopfzeile im Browser, links nach rechts. Suche und Warenkorb zeichnet die Shell. */
  web: readonly KundenNavPunkt[]
  /**
   * Der Knopf rechts in der Kopfzeile, am Handy wie im Browser: „Anmelden"
   * ohne Sitzung, „Mein Hof" mit Hof-Sitzung; mit Kundensitzung keiner.
   */
  knopf: KundenNavPunkt | null
  /** Das Konto rechts in der Kopfzeile — nur mit Kundensitzung. */
  konto: KundenNavPunkt | null
  /** Die Unterleiste am Handy. */
  handy: readonly KundenLeistenPlatz[]
}

/**
 * Die Navigation passend zur Sitzung. Eine Hof-Sitzung sieht die Kundenseite
 * wie ohne Sitzung — nur der Knopf führt in den eigenen Bereich statt zur
 * Anmeldung (ein Hof bekäme sonst „Mein Konto" mit den Kunden-Abos).
 */
export function kundenNavigation({ sitzung }: { sitzung: KundenSitzung }): KundenNavigation {
  switch (sitzung) {
    case 'kunde':
      return { web: [ENTDECKEN, BESTELLUNGEN], knopf: null, konto: KONTO, handy: HANDY_LEISTE }
    case 'hof':
      return { web: [ENTDECKEN, SO_GEHTS, FUER_HOEFE, BESTELLUNGEN], knopf: MEIN_HOF, konto: null, handy: HANDY_LEISTE }
    case 'gast':
      return { web: [ENTDECKEN, SO_GEHTS, FUER_HOEFE, BESTELLUNGEN], knopf: ANMELDEN, konto: null, handy: HANDY_LEISTE }
  }
}

/**
 * Der Knopf oben rechts in KundenKopf (Seiten, die noch nicht in der
 * KundeShell stehen) — dieselbe Wahl wie in der KundeShell, damit öffentliche
 * Seiten nie eine vierte Variante zeigen: „Anmelden", mit Hof-Sitzung „Mein
 * Hof", mit Kundensitzung „Mein Konto" (Entscheidung des Dirigenten in
 * Nachbesserung 1 zu Nr. 41; eine angemeldete Kundin sah dort vorher
 * „Anmelden", und /login leitet sie nicht weiter).
 */
export function kopfKnopf(sitzung: KundenSitzung): KundenNavPunkt {
  switch (sitzung) {
    case 'hof':
      return MEIN_HOF
    case 'kunde':
      return KONTO
    case 'gast':
      return ANMELDEN
  }
}

// Jeder Punkt mit eigener Seite. Anker (#…) sind nie eine eigene Seite.
const AKTIVIERBAR: readonly KundenNavPunkt[] = [ENTDECKEN, FUER_HOEFE, BESTELLUNGEN, ANMELDEN, MEIN_HOF, KONTO]

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
 * Die Sitzung zu einer Rolle (Zusatzfeld `role` der Sitzung, src/lib/auth.ts).
 *
 * - CUSTOMER → `kunde`: die freiwillige Kunden-Anmeldung. Auch ein Betreiber
 *   ohne Hof trägt diese Rolle (das Admin-Recht ist `isAdmin`, getrennt von
 *   der Rolle) und sieht wie bisher „Mein Konto".
 * - FARMER → `hof`: Nur diese Rolle öffnet den Hofbereich (ladeHofbereich,
 *   src/server/hofbereich.ts) — auch ein Betreiber mit eigenem Hof trägt sie.
 *   Ob der Hof schon eingerichtet ist, braucht der Browser nicht: Ohne Hof
 *   führt /dashboard zum Einrichten (/onboarding), also auch in den eigenen
 *   Bereich. Ein eigener Lesepfad für die Frage „hat ein Hof?" entfällt.
 * - alles andere → `gast`: Für keine andere Rolle gibt es auf der Kundenseite
 *   einen eigenen Weg; „Mein Hof" führte dort auf /login zurück.
 */
export function kundenSitzung(nutzer: { role?: string | null } | null | undefined): KundenSitzung {
  if (nutzer?.role === 'CUSTOMER') return 'kunde'
  if (nutzer?.role === 'FARMER') return 'hof'
  return 'gast'
}
