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
 * Seit Nr. 247 (G9, V12) ist der Kopf in jeder Sitzung derselbe: vier Links
 * und rechts EIN Knopf als Umriss-Pille — auch „Mein Konto" (vorher ein
 * Personen-Symbol mit Suchfeld und nur zwei Links).
 *
 * Bestehende Kundenseiten nutzen weiter KundenKopf (src/lib/kunden-kopf.ts);
 * für seinen Knopf gilt kopfKnopf aus dieser Quelle — dieselben drei
 * Varianten wie in der KundeShell.
 *
 * Seit Nr. 120 (Register N22) auch die Ziele des Seitenfußs (SEITENFUSS):
 * Impressum, Datenschutz, AGB und „Problem melden" auf jeder Seite der
 * Kundschaft, am Computer dazu die Wege der Kopfzeile.
 */
import { AGB_LINK_TEXT, AGB_PFAD } from '@/lib/rechtstexte/agb-einbindung'
import { PROBLEM_MELDEN } from '@/lib/fehlerseite'
import { WIDERRUF_PFAD, WIDERRUF_TEXT } from '@/lib/widerruf'

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

/** Ein Link im Seitenfuß: Ziel und Wort, sonst nichts. */
export type FussLink = { href: string; label: string }

/**
 * Der Seitenfuß (Register N22, Board system-k1-entdecken-v2): `rechtlich` auf
 * jeder Seite der Kundschaft, am Handy wie am Computer — das erfüllt „AGB-Link
 * in jeder Fußzeile" (O4); `wege` nur am Computer (am Handy führt die
 * Unterleiste). AGB-Pfad und -Wort kommen aus der Einbindung der AGB, „Problem
 * melden" aus der Fehlerseite — eine Quelle je Wort.
 */
export const SEITENFUSS: { rechtlich: readonly FussLink[]; wege: readonly FussLink[] } = {
  rechtlich: [
    { href: '/impressum', label: 'Impressum' },
    { href: '/datenschutz', label: 'Datenschutz' },
    { href: AGB_PFAD, label: AGB_LINK_TEXT },
    { href: '/problem-melden', label: PROBLEM_MELDEN },
    // Nr. 200 (N39, § 13a FAGG): der Widerruf online — im Fuß jeder Kundenseite.
    { href: WIDERRUF_PFAD, label: WIDERRUF_TEXT.fussLink },
  ],
  wege: [ENTDECKEN, FUER_HOEFE, SO_GEHTS].map(({ href, label }) => ({ href, label })),
}

/**
 * Die Wörter des Darstellungs-Schalters (Nr. 220): „Darstellung: hell“ im
 * Seitenfuß der Kundschaft (Board s1-startseite), die Pillen „Hell“ und
 * „Dunkel“ im Blatt „Mehr“ des Hofbereichs (Board s1-mehr-neu). Hier und nicht
 * bei der HofShell, weil der Schalter jede Kundenseite mitlädt.
 */
export const DARSTELLUNG_TEXT = {
  titel: 'Darstellung',
  hell: 'Hell',
  dunkel: 'Dunkel',
  aufHell: 'auf hell umschalten',
  aufDunkel: 'auf dunkel umschalten',
} as const

/** Das Wort unter dem grünen Mittelknopf der Unterleiste (V10, Board s1-startseite) — Wortliste: „Warenkorb“. */
export const WARENKORB_WORT = 'Warenkorb'

/**
 * „Warenkorb · n“ im Browser-Kopf (N41 c, V12): nur bei gefülltem Warenkorb —
 * die Shell zeigt leer gar nichts. Dieselbe Fassung nennt der Mittelknopf am
 * Handy seinem Screenreader-Namen voran.
 */
export function warenkorbKopfText(anzahl: number): string {
  return `${WARENKORB_WORT} · ${anzahl}`
}

export type KundenLeistenPlatz = { art: 'punkt'; punkt: KundenNavPunkt } | { art: 'warenkorb'; wort: string }

const HANDY_LEISTE: readonly KundenLeistenPlatz[] = [
  { art: 'punkt', punkt: ENTDECKEN },
  { art: 'warenkorb', wort: WARENKORB_WORT },
  { art: 'punkt', punkt: BESTELLUNGEN },
]

/**
 * Wie eine öffentliche Seite die Sitzung sieht: ohne Sitzung (`gast`), mit
 * der freiwilligen Kunden-Anmeldung (`kunde`) oder mit einer Hof-Sitzung
 * (`hof`, Register N1).
 */
export type KundenSitzung = 'gast' | 'kunde' | 'hof'

export type KundenNavigation = {
  /** Die Textlinks der Kopfzeile im Browser, links nach rechts — in jeder Sitzung dieselben vier (V12). Den Warenkorb zeichnet die Shell. */
  web: readonly KundenNavPunkt[]
  /**
   * Der Knopf rechts in der Kopfzeile, am Handy wie im Browser, immer als
   * Umriss-Pille (G9): „Anmelden" ohne Sitzung, „Mein Konto" mit
   * Kundensitzung, „Mein Hof" mit Hof-Sitzung.
   */
  knopf: KundenNavPunkt
  /** Die Unterleiste am Handy. */
  handy: readonly KundenLeistenPlatz[]
}

const WEB_LINKS: readonly KundenNavPunkt[] = [ENTDECKEN, SO_GEHTS, FUER_HOEFE, BESTELLUNGEN]

/**
 * Die Navigation passend zur Sitzung. Die Links sind in jeder Sitzung
 * dieselben (V12, G9 seit Nr. 247: auch mit Kundensitzung, ohne Suchfeld im
 * Kopf — gesucht wird auf /hoefe); nur der Knopf rechts wechselt. Eine
 * Hof-Sitzung bekommt „Mein Hof" statt „Mein Konto" (ein Hof bekäme sonst das
 * Konto mit den Kunden-Abos).
 */
export function kundenNavigation({ sitzung }: { sitzung: KundenSitzung }): KundenNavigation {
  return { web: WEB_LINKS, knopf: kopfKnopf(sitzung), handy: HANDY_LEISTE }
}

/**
 * Die Seiten, die selbst die Anmeldung sind (Liste Lauf 32, Q2): /login, /register und die Anmeldung der Kundschaft
 * /account/login (Projektleitung 7.11.2026, Nr. 253). Unterpfade zählen mit (/login/admin, /account/login/…), ein
 * Pfad, der nur so anfängt (/loginhilfe, /account/loginx), nicht.
 */
const OHNE_KNOPF_AM_HANDY: readonly string[] = [ANMELDEN.href, '/register', '/account/login']

/**
 * Ob der Knopf rechts oben am Handy entfällt (Liste Lauf 32, Q2 und G9): auf
 * /login und /register selbst — die Seite IST die Anmeldung, der Knopf führte
 * im Kreis (Board s2-anmelden: nur die Marke). Im Browser bleibt er stehen
 * (Board w2-anmelden: „Anmelden" als Pille im vollen Kopf).
 */
export function ohneKopfKnopfAmHandy(pfad: string): boolean {
  return OHNE_KNOPF_AM_HANDY.some((ziel) => pfad === ziel || pfad.startsWith(ziel + '/'))
}

/**
 * Ob der Kopf der Shell am Handy wegscrollt statt zu kleben (G9, Liste Lauf 32
 * hofseite/produkt): Auf Hof- und Produktseite klebt dort nur der Kopf des
 * Hofs — zwei feste Leisten übereinander waren unruhig. Die Shell erkennt die
 * beiden Seiten an `aktiv` = `entdecken`: Nur sie setzen den Punkt selbst
 * (Nr. 177), ihr Pfad sagt ihn nicht — so bleiben die Props der Shell gleich.
 * Seit Nr. 252 auch auf der Produktseite (ohne Unterleiste): Dort klebt am
 * Handy die Zeile „‹ Alle Produkte von <Hof>“ mit dem Warenkorb — der Weg zum
 * Korb bleibt, ohne dass der Kopf der Shell kleben muss.
 */
export function kopfScrolltWegAmHandy(aktiv: KundenNavId | undefined): boolean {
  return aktiv === ENTDECKEN.id
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

/**
 * Der aktive Punkt zu einem Pfad — der längste passende; null auf Startseite,
 * Hofseite und allem anderen. Hof- und Produktseite setzen ihren Punkt selbst
 * (`aktiv` in kundenAriaAktuell, Nr. 177); die Startseite bleibt ohne.
 */
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
 *
 * `aktiv` (Nr. 177, Board system-sterne-hofseite-orientierung Punkt 1): Hof-
 * und Produktseite liegen unter /[hof] — kein Pfad eines Punkts, darum sagt
 * die Seite selbst, wo sie steht (`entdecken`, über KundeShellMitSitzung).
 * Dann ist genau dieser Punkt aktiv, als 'true' (ein Ort darin, nicht die
 * Zielseite selbst), und kein anderer. Die Startseite setzt nichts.
 */
export function kundenAriaAktuell(pfad: string, punkt: KundenNavPunkt, aktiv?: KundenNavId): 'page' | 'true' | undefined {
  if (aktiv) return aktiv === punkt.id ? 'true' : undefined
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

/**
 * aria-current in der Unterleiste am Handy (Nr. 220, Board s1-startseite): wie
 * `kundenAriaAktuell`, nur steht auf der Startseite „Entdecken“ als Ort
 * (`true`) — die Startseite IST am Handy der Einstieg ins Entdecken, die Leiste
 * zeigt sonst keinen Ort. Der Web-Kopf bleibt dort ohne aktiven Punkt (V12).
 */
export function kundenHandyAriaAktuell(pfad: string, punkt: KundenNavPunkt, aktiv?: KundenNavId): 'page' | 'true' | undefined {
  if (!aktiv && pfad === '/') return punkt.id === ENTDECKEN.id ? 'true' : undefined
  return kundenAriaAktuell(pfad, punkt, aktiv)
}

/**
 * Die Spalte, in der der Seitenfuß im Browser steht (G11, Liste Lauf 32 §3.2; Nr. 267): so breit wie die
 * Inhaltsspalte der Seite, benannt nach deren Breite — `schmal` 520 px (Meine Bestellungen, Passwort, Neuigkeiten),
 * `mittel` 896 px (Anmelden, Bestellseite, Bestätigung, Registrieren), `seite` 1000 px (Konto, Rechtstexte,
 * Systemseiten, Widerruf, Problem melden, Fehlerseiten), `breit` 1200 px (Startseite, /hoefe, Hofseite, Produktseite,
 * Für Höfe). Am Handy steht der Fuß immer über die volle Breite. Die Klassen je Art zeichnet der Fuß
 * (components/shells/kunde-fuss.tsx); hier steht nur die Zuordnung.
 */
export type FussSpalte = 'schmal' | 'mittel' | 'seite' | 'breit'

/**
 * Route → Spalte, EINE Quelle für KundeShell (Seitenfuß) und KundeFokusShell (Zeile „Vertrag widerrufen“).
 * Ein Muster passt Segment für Segment; `*` steht für genau ein Segment (Hof, Bestellung), `/**` am Ende auch für
 * alle Unterseiten (/login/admin, /agb/<fassung>). Die Seiten der Spalte kommen aus ihren eigenen Klassen
 * (z. B. `max-w-[1032px] px-4` = 1000 px Inhalt); wer eine Spalte ändert, zieht diese Liste nach.
 */
export const SPALTE_JE_ROUTE: readonly (readonly [muster: string, spalte: FussSpalte])[] = [
  ['/', 'breit'],
  ['/hoefe', 'breit'],
  ['/fuer-hoefe', 'breit'],
  ['/startseite-vorschau', 'breit'],
  ['/login/**', 'mittel'],
  ['/account/login', 'mittel'],
  ['/register', 'mittel'],
  ['/*/bestellung/*', 'mittel'],
  ['/*/confirm/*', 'mittel'],
  ['/bestellungen', 'schmal'],
  ['/forgot-password', 'schmal'],
  ['/reset-password', 'schmal'],
  ['/account/neuigkeiten-bestaetigen', 'schmal'],
  ['/account/profile', 'seite'],
  ['/account/unsubscribe', 'seite'],
  ['/konto/email-bestaetigen', 'seite'],
  ['/sicherheit/nicht-ich', 'seite'],
  ['/widerruf', 'seite'],
  ['/agb/**', 'seite'],
  ['/datenschutz', 'seite'],
  ['/impressum', 'seite'],
  ['/konditionen', 'seite'],
  ['/problem-melden', 'seite'],
]

function segmente(pfad: string): string[] {
  return pfad.split('/').filter(Boolean)
}

function passt(muster: string, pfad: readonly string[]): boolean {
  const teile = segmente(muster)
  const mitUnterseiten = teile.at(-1) === '**'
  const feste = mitUnterseiten ? teile.slice(0, -1) : teile
  if (mitUnterseiten ? pfad.length < feste.length : pfad.length !== feste.length) return false
  return feste.every((teil, i) => teil === '*' || teil === pfad[i])
}

/**
 * Die Spalte einer Kundenseite (G11, Nr. 267) — `null`, wenn die Route nicht in der Liste steht; dann entscheidet
 * die Shell (KundeShell: `seite` wie die Fehlerseiten, deren Adresse beliebig ist; KundeFokusShell: `breit` wie
 * bisher). Hof- und Produktseite erkennt die Shell an `aktiv` = `entdecken` wie bei kopfScrolltWegAmHandy: Ihr
 * Pfad (/<hof>) sähe aus wie eine unbekannte Adresse, deren 404 in der Spalte der Fehlerseiten steht.
 */
export function spalteDerSeite(pfad: string | null, aktiv?: KundenNavId): FussSpalte | null {
  if (aktiv === ENTDECKEN.id) return 'breit'
  if (pfad === null) return null
  const teile = segmente(pfad)
  return SPALTE_JE_ROUTE.find(([muster]) => passt(muster, teile))?.[1] ?? null
}
