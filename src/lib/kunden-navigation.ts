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
 * gibt es unter /account noch nicht (dort liegen nur login, profile und
 * unsubscribe). Deshalb:
 *  - Im Browser steht „Meine Bestellungen" angemeldet NICHT im Kopf — ein
 *    Punkt, der nur zur Anmeldung führt, die man schon hinter sich hat, wäre
 *    ein Link ins Leere.
 *  - Am Handy bleibt „Bestellungen" (E8 legt die drei Plätze fest). Er führt
 *    abgemeldet vorläufig zur Anmeldung, angemeldet zu „Mein Konto" — die
 *    Anmeldeseite prüft keine Sitzung und böte einer Angemeldeten nur das
 *    Anmeldeformular noch einmal an.
 * Beide Ziele kommen aus bestellungenPunkt(); Nr. 08 „Bestellungen finden"
 * (E-Mail und Code, E7/E8) ändert nur dort das Ziel und nimmt den Punkt
 * wieder in den Kopf.
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

/**
 * „Bestellungen" mit seinem vorläufigen Ziel, siehe Kopf der Datei: immer eine
 * Seite, die die Kopfzeile derselben Sitzung auch anbietet (abgemeldet
 * „Anmelden", angemeldet „Mein Konto") — so führen Web und Handy aus dieser
 * einen Quelle nie an verschiedene Orte.
 */
function bestellungenPunkt(angemeldet: boolean): KundenNavPunkt {
  return {
    id: 'bestellungen',
    label: 'Meine Bestellungen',
    kurz: 'Bestellungen',
    href: angemeldet ? KONTO.href : ANMELDEN.href,
  }
}

export type KundenLeistenPlatz = { art: 'punkt'; punkt: KundenNavPunkt } | { art: 'warenkorb' }

function handyLeiste(angemeldet: boolean): readonly KundenLeistenPlatz[] {
  return [{ art: 'punkt', punkt: ENTDECKEN }, { art: 'warenkorb' }, { art: 'punkt', punkt: bestellungenPunkt(angemeldet) }]
}

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
    ? { web: [ENTDECKEN], anmelden: null, konto: KONTO, handy: handyLeiste(true) }
    : { web: [ENTDECKEN, SO_GEHTS, FUER_HOEFE], anmelden: ANMELDEN, konto: null, handy: handyLeiste(false) }
}

// Ohne Anmelden: Bestellungen hat (vorläufig) dasselbe Ziel und ist der Punkt,
// der in der Leiste leuchten soll. Angemeldet teilt er sich das Ziel mit „Mein
// Konto" — dort leuchtet das Konto, nicht ein Punkt, der nur Platzhalter ist.
// Anker (#…) sind nie eine eigene Seite.
const AKTIVIERBAR: readonly KundenNavPunkt[] = [ENTDECKEN, bestellungenPunkt(false), KONTO]

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
 * nichts. Der Punkt muss selbst dorthin führen — sonst leuchtete „Bestellungen"
 * der Angemeldeten auf der Anmeldeseite, zu der er gar nicht führt.
 */
export function kundenAriaAktuell(pfad: string, punkt: KundenNavPunkt): 'page' | 'true' | undefined {
  if (kundenAktiverPunkt(pfad) !== punkt.id) return undefined
  if (pfad !== punkt.href && !pfad.startsWith(punkt.href + '/')) return undefined
  return pfad === punkt.href ? 'page' : 'true'
}
