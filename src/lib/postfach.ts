/**
 * Das Postfach, Stufe 1 (Register N12, Nachtlauf Nr. 87): Texte, Ziele und
 * Regeln — rein und ohne Datenbank prüfbar (tests/postfach.test.ts).
 *
 * Das Team schreibt Höfen Nachrichten (Rundschreiben an alle, ausgewählte oder
 * nach Filter, auch an einen einzelnen Hof); jede Nachricht ist ein eigener
 * Faden (Unterhaltung), auf den der Hof antwortet und in dem das Team
 * antwortet. Höfe beginnen keine Fäden: Ein Problem, ein Wunsch oder eine
 * Frage geht über „Problem melden" (Meldung) — für jede Sache ein Weg.
 *
 * Wörter nur aus der Wortliste (Postfach, Nachricht, Rundschreiben,
 * Unterhaltung, Meldung); der Name nur aus MARKE_TEAM (Register M1), die
 * Domain nur aus PRODUKTION_HOST. Ohne env: Die Datei lädt auch im Browser
 * (Formulare, Zähler).
 */
import { MARKE_TEAM } from '@/lib/marke'
import { PROBLEM_MELDEN } from '@/lib/fehlerseite'
import { PRODUKTION_ADRESSE, PRODUKTION_HOST } from '@/lib/umgebung'
import { MONAT_KURZ } from '@/lib/format'
import { wienKalendertag, tagVersetzt } from '@/lib/kalender'
import { hatRegistrierung, type HofRegistrierung } from '@/lib/futter-registrierung'
import { uhrzeitInWien } from '@/lib/fristen'
import { datumKurz } from '@/lib/verkauf-eintragen'
import type { DbBremse } from '@/lib/bremse-datenbank'
// Nur Typen (zur Laufzeit nichts): Die Zod-Schemas sind die Quelle der Werte (CODING_STANDARDS §2).
import type { z } from 'zod'
import type { empfaengerRegelSchema, nachrichtArtSchema, unterhaltungSeiteSchema } from '@/schemas/postfach'

// ─── Ziele ───────────────────────────────────────────────────────────────────

/** Das Postfach des Hofs — Hauptpunkt nach „Bestellungen" (bauern-navigation.ts). */
export const POSTFACH_HREF = '/postfach'

/** Ein Faden im Postfach des Hofs. */
export function fadenHref(unterhaltungId: string): string {
  return `${POSTFACH_HREF}/${encodeURIComponent(unterhaltungId)}`
}

/** Das Postfach des Admins mit seinen drei Reitern (?reiter=…). */
export const ADMIN_POSTFACH_HREF = '/admin/postfach'

export type AdminPostfachReiter = 'unterhaltungen' | 'meldungen' | 'rundschreiben'

export const ADMIN_POSTFACH_REITER: readonly { id: AdminPostfachReiter; label: string }[] = [
  { id: 'unterhaltungen', label: 'Unterhaltungen' },
  { id: 'meldungen', label: 'Meldungen' },
  { id: 'rundschreiben', label: 'Rundschreiben' },
]

/** Der Reiter aus der Adresse — unbekannt oder leer heißt „Unterhaltungen". Next liefert Doppeltes als Liste: dann der erste. */
export function adminReiterAus(wert: string | string[] | undefined): AdminPostfachReiter {
  const roh = Array.isArray(wert) ? wert[0] : wert
  return ADMIN_POSTFACH_REITER.find((r) => r.id === roh)?.id ?? 'unterhaltungen'
}

/**
 * Ein Link in das Admin-Postfach. Die Filter des Reiters „Meldungen" kommen
 * aus briefkastenAdresse (admin-briefkasten.ts) als fertige Abfrage und
 * bleiben, wie sie sind; nur Ort und Reiter stehen hier.
 */
export function adminPostfachAdresse(reiter: AdminPostfachReiter, weitere: Record<string, string | undefined> = {}): string {
  const parameter = new URLSearchParams()
  if (reiter !== 'unterhaltungen') parameter.set('reiter', reiter)
  for (const [schluessel, wert] of Object.entries(weitere)) if (wert) parameter.set(schluessel, wert)
  const q = parameter.toString()
  return q ? `${ADMIN_POSTFACH_HREF}?${q}` : ADMIN_POSTFACH_HREF
}

/** `/admin/meldungen?status=…` → `/admin/postfach?reiter=meldungen&status=…` (die Umleitung und die Filter im Reiter). */
export function meldungenImPostfach(briefkastenLink: string): string {
  const abfrage = briefkastenLink.split('?')[1] ?? ''
  const filter = new URLSearchParams(abfrage)
  return adminPostfachAdresse('meldungen', { status: filter.get('status') ?? undefined, art: filter.get('art') ?? undefined })
}

// ─── Grenzen ─────────────────────────────────────────────────────────────────

/** Titel eines Rundschreibens (Freigabe: ≤ 80). */
export const TITEL_MAX = 80
/** Text einer Nachricht oder eines Rundschreibens (Freigabe: ≤ 1000). */
export const TEXT_MAX = 1000
/** Ein Link in einer Nachricht — Adressen der App sind weit kürzer. */
export const LINK_MAX = 300
/** Rate-Limit je Hof und Tag (N12): Antworten eines Hofs. */
export const NACHRICHTEN_JE_HOF_UND_TAG = 30
export const TAG_MS = 24 * 60 * 60 * 1000
/** Höchstens eine E-Mail je Faden in dieser Spanne, wenn das Team antwortet (N12) — als Bedingung im UPDATE auf letzteMailAm (actions/postfach.ts). */
export const MAIL_ABSTAND_MS = 60 * 60 * 1000
/** Ein offener Faden lädt so oft nach (router.refresh, kein Polling-Endpunkt). */
export const NACHLADEN_MS = 60 * 1000

/**
 * Die zweite Stufe des Rate-Limits (Register R1) für Antworten eines Hofs:
 * gezählt in RateLimitZaehler über alle Instanzen, Merkmal ist die Hof-ID.
 * Dieselbe Zahl und dasselbe Fenster wie die erste Stufe je Instanz
 * (createRateLimiter in der Action). Steht hier statt in DB_BREMSEN
 * (src/lib/bremse-datenbank.ts), weil die Datei außerhalb der Grenze von
 * Nr. 87 liegt — zieht bei der nächsten Änderung dorthin (Bericht 87).
 */
export const POSTFACH_DB_BREMSE: DbBremse = { zweck: 'postfach-hof', max: NACHRICHTEN_JE_HOF_UND_TAG, fensterMs: TAG_MS }

// ─── Texte ───────────────────────────────────────────────────────────────────

/** Alle Sätze des Postfachs beim Hof — EINE Quelle für Liste, Faden und Heute. */
export const POSTFACH_TEXT = {
  titel: 'Postfach',
  absender: MARKE_TEAM,
  filterBeschriftung: 'Nachrichten filtern',
  alle: 'Alle',
  ungelesen: 'Ungelesen',
  wichtig: 'Wichtig',
  duHastGeantwortet: 'Du hast geantwortet',
  ungelesenSr: 'ungelesen',
  /** Wofür die Zahl an „Postfach" zählt (Screenreader, HofShell). */
  zaehler: 'ungelesene Nachrichten',
  erklaerung: `Hier schreibt dir das ${MARKE_TEAM}: Neues, Abrechnung, Rechtliches. Du kannst auf jede Nachricht antworten. Ein Problem oder einen Wunsch meldest du wie bisher unter „${PROBLEM_MELDEN}“.`,
  antwortFeld: 'Antwort an das Team …',
  antwortBeschriftung: 'Deine Antwort',
  antwortHinweis: `Deine Antwort geht nur an das ${MARKE_TEAM}.`,
  senden: 'Senden',
  sendet: 'Wird gesendet …',
  linkKnopf: 'Ansehen',
  antworten: 'Antworten',
  gelesen: 'Gelesen',
  gelesenVomTeam: 'gelesen',
  auchPerMail: 'auch per E-Mail',
  ohneTitel: 'Nachricht vom Team',
} as const

/** Die Sätze der zwei E-Mails (src/emails/postfach-*.tsx) — Betriebsmitteilungen, geantwortet wird in der App. */
export const POSTFACH_MAIL_TEXT = {
  vonTeam: `Nachricht vom ${MARKE_TEAM} · Betriebsmitteilung`,
  antwortTitel: `Antwort vom ${MARKE_TEAM}`,
  antwortBetreff: (titel: string) => `Antwort vom ${MARKE_TEAM}: ${titel}`,
  zu: 'Zu',
  link: 'Ansehen',
  oeffnen: 'Im Postfach öffnen',
  antwortenInDerApp: 'Antworten geht in der App: Öffne die Nachricht in deinem Postfach und schreib dort zurück.',
  gruss: `Dein ${MARKE_TEAM}`,
  /** Der Satz unter der Karte (EmailLayout `fusszeile`): Absender ist das Team, nicht ein Hof. */
  fuss: `Versandt vom ${MARKE_TEAM}.`,
} as const

/**
 * Der Leerzustand des Postfachs (Register N9). Ohne Aktion – Höfe beginnen keine Unterhaltung (N12);
 * der Grund steht als fester Text im Aufruf (`ausweg={{ ohne: … }}`, Wache tests/leerzustaende-wache, Nr. 85).
 */
export const POSTFACH_LEER = {
  titel: 'Noch keine Nachricht vom Team',
  satz: `Schreibt dir das ${MARKE_TEAM}, steht die Nachricht hier – und auf Heute ganz oben.`,
} as const

/** Filter „Ungelesen" ohne Treffer — der Ausweg zeigt wieder alle. */
export const POSTFACH_ALLES_GELESEN = { titel: 'Alles gelesen', satz: 'Neue Nachrichten vom Team erscheinen hier.', ausweg: 'Alle zeigen' } as const

/** Fehler an der Oberfläche (deutsch, geduzt, mit Ausweg). */
export const POSTFACH_FEHLER = {
  laden: 'Wir konnten dein Postfach gerade nicht laden. Lade die Seite bitte neu.',
  nichtGefunden: 'Diese Unterhaltung gibt es nicht. Schau in dein Postfach.',
  textLeer: 'Schreib bitte zuerst etwas.',
  textZuLang: `Höchstens ${TEXT_MAX} Zeichen – bitte kürzen.`,
  titelLeer: 'Gib dem Rundschreiben bitte einen Titel.',
  titelZuLang: `Höchstens ${TITEL_MAX} Zeichen – bitte kürzen.`,
  link: `Der Link muss mit „/“ beginnen oder auf https://${PRODUKTION_HOST} zeigen.`,
  eingabe: 'Das hat nicht geklappt. Bitte lade die Seite neu.',
  anmelden: 'Bitte melde dich neu an.',
  keinHof: 'Kein Hof gefunden.',
  zuViele: `Du hast heute schon ${NACHRICHTEN_JE_HOF_UND_TAG} Nachrichten geschrieben. Morgen geht es weiter – oder melde dich über „${PROBLEM_MELDEN}“.`,
  keineEmpfaenger: 'Für diese Auswahl gibt es keinen Hof. Wähl andere Empfänger.',
} as const

/** „1 neu", „3 neu" — die Marke neben dem Titel. */
export function neuText(anzahl: number): string {
  return `${anzahl} neu`
}

/** „2 weitere im Postfach" unter der Karte auf Heute. */
export function weitereText(anzahl: number): string {
  return `${anzahl} weitere im Postfach`
}

// ─── Links ───────────────────────────────────────────────────────────────────

/**
 * Der Weg in der App, den ein Link einer Nachricht meint — oder null, wenn er
 * nicht erlaubt ist. Erlaubt: relativ („/…", nie „//…" und kein „\", das
 * Browser als „//" lesen) oder https auf genau PRODUKTION_HOST (ohne Port,
 * ohne Anmeldedaten). Zurück kommt immer der Pfad samt Abfrage und Anker —
 * gezeigt und gemailt wird die eigene Herkunft, so führt ein Link in der
 * Testumgebung nicht in die Produktion.
 */
export function appPfadAusLink(link: string): string | null {
  const roh = link.trim()
  if (roh === '' || /[\s\\\u0000-\u001f\u007f]/.test(roh)) return null
  if (roh.startsWith('/')) {
    if (roh.startsWith('//')) return null
    const url = new URL(roh, PRODUKTION_ADRESSE)
    return url.origin === PRODUKTION_ADRESSE ? url.pathname + url.search + url.hash : null
  }
  let url: URL
  try {
    url = new URL(roh)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.hostname !== PRODUKTION_HOST || url.port !== '' || url.username !== '' || url.password !== '') return null
  return url.pathname + url.search + url.hash
}

// ─── Lesestand ───────────────────────────────────────────────────────────────

export type Seite = z.infer<typeof unterhaltungSeiteSchema>

/** Neu für diese Seite ist, was die ANDERE Seite nach dem Lesestand geschrieben hat. */
export function istNeuFuer(seite: Seite, nachricht: { vonFarmId: string | null; createdAt: Date }, gelesenBis: Date | null): boolean {
  const vonAnderer = seite === 'HOF' ? nachricht.vonFarmId === null : nachricht.vonFarmId !== null
  return vonAnderer && (gelesenBis === null || nachricht.createdAt.getTime() > gelesenBis.getTime())
}

// ─── Zeit ────────────────────────────────────────────────────────────────────

/** Was eben erst kam — in Listen und in der Vorschau des Rundschreibens. */
export const GERADE_EBEN = 'gerade eben'

function datumOhneWochentag(kalendertag: string, heute: string): string {
  const [j, m, t] = kalendertag.split('-').map(Number)
  const jahr = j !== Number(heute.slice(0, 4)) ? ` ${j}` : ''
  return `${t}. ${MONAT_KURZ[m - 1]}${jahr}`
}

/**
 * Wann etwas kam, kurz für Listen: „gerade eben", „vor 20 Min.", „vor 3 Std."
 * (heute), „gestern", sonst „12. Okt" — immer nach Wiener Kalendertag.
 */
export function wannText(zeitpunkt: Date, jetzt: Date): string {
  const heute = wienKalendertag(jetzt)
  const tag = wienKalendertag(zeitpunkt)
  if (tag === heute) {
    const minuten = Math.max(0, Math.floor((jetzt.getTime() - zeitpunkt.getTime()) / 60_000))
    if (minuten < 1) return GERADE_EBEN
    if (minuten < 60) return `vor ${minuten} Min.`
    return `vor ${Math.floor(minuten / 60)} Std.`
  }
  if (tag === tagVersetzt(heute, -1)) return 'gestern'
  return datumOhneWochentag(tag, heute)
}

/** „Rundschreiben vom 10. Okt" im Kopf eines Fadens. */
export function rundschreibenVomText(gesendetAm: Date, jetzt: Date): string {
  return `Rundschreiben vom ${datumOhneWochentag(wienKalendertag(gesendetAm), wienKalendertag(jetzt))}`
}

// ─── Liste des Hofs ──────────────────────────────────────────────────────────

export type PostfachFilter = 'alle' | 'ungelesen'

/** Der Filter aus der Adresse (?filter=ungelesen) — alles andere heißt „Alle". */
export function postfachFilterAus(wert: string | string[] | undefined): PostfachFilter {
  return (Array.isArray(wert) ? wert[0] : wert) === 'ungelesen' ? 'ungelesen' : 'alle'
}

export function postfachFilterHref(filter: PostfachFilter): string {
  return filter === 'ungelesen' ? `${POSTFACH_HREF}?filter=ungelesen` : POSTFACH_HREF
}

type NachrichtArtWert = z.infer<typeof nachrichtArtSchema>

/** Ein Faden, wie ihn die Abfrage liefert (src/server/queries/postfach.ts). */
export type FadenRoh = {
  id: string
  /** Titel des Rundschreibens; null, wenn es keines (mehr) gibt. */
  titel: string | null
  rundschreibenWichtig: boolean
  letzteNachrichtAm: Date
  /** Lesestand des Hofs; null = nie geöffnet. */
  gelesenBis: Date | null
  neuesteVomTeam: { id: string; text: string; linkUrl: string | null; art: NachrichtArtWert; createdAt: Date } | null
  neuesteVomHof: { text: string; createdAt: Date } | null
}

export type FadenZeile = {
  id: string
  href: string
  titel: string
  wichtig: boolean
  ungelesen: boolean
  wann: string
  /** „Du hast geantwortet · …" — nur, wenn die Antwort des Hofs das Neueste im Faden ist. */
  eigeneAntwort: string | null
}

function ungelesenFuerHof(f: FadenRoh): boolean {
  return f.neuesteVomTeam !== null && istNeuFuer('HOF', { vonFarmId: null, createdAt: f.neuesteVomTeam.createdAt }, f.gelesenBis)
}

function wichtigImFaden(f: FadenRoh): boolean {
  return f.rundschreibenWichtig || f.neuesteVomTeam?.art === 'WICHTIG'
}

/** Die Zeilen der Liste, neueste zuerst — mit Filter. */
export function postfachZeilen(faeden: readonly FadenRoh[], filter: PostfachFilter, jetzt: Date): FadenZeile[] {
  return [...faeden]
    .sort((a, b) => b.letzteNachrichtAm.getTime() - a.letzteNachrichtAm.getTime())
    .map((f) => {
      const eigene = f.neuesteVomHof !== null && (f.neuesteVomTeam === null || f.neuesteVomHof.createdAt.getTime() > f.neuesteVomTeam.createdAt.getTime())
      return {
        id: f.id,
        href: fadenHref(f.id),
        titel: f.titel ?? POSTFACH_TEXT.ohneTitel,
        wichtig: wichtigImFaden(f),
        ungelesen: ungelesenFuerHof(f),
        wann: wannText(f.letzteNachrichtAm, jetzt),
        eigeneAntwort: eigene && f.neuesteVomHof ? f.neuesteVomHof.text : null,
      }
    })
    .filter((z) => filter === 'alle' || z.ungelesen)
}

/** Wie viele Fäden etwas Ungelesenes vom Team haben — der Zähler an „Postfach". */
export function zaehleUngelesen(faeden: readonly FadenRoh[]): number {
  return faeden.filter(ungelesenFuerHof).length
}

// ─── Heute ───────────────────────────────────────────────────────────────────

export type HeuteNachricht = {
  unterhaltungId: string
  nachrichtId: string
  href: string
  titel: string
  text: string
  /** Weg in der App (appPfadAusLink); null ohne Link. */
  link: string | null
  wichtig: boolean
  wann: string
}

/**
 * Die Karte ganz oben in der Hauptspalte von Heute (N12, Mockup
 * mobil-h3-heute-post-karte): die neueste ungelesene Nachricht vom Team, dazu
 * wie viele Fäden sonst noch Ungelesenes haben. null = keine Karte.
 */
export function heutePostfach(faeden: readonly FadenRoh[], jetzt: Date): { nachricht: HeuteNachricht; weitere: number } | null {
  const ungelesen = faeden
    .filter(ungelesenFuerHof)
    .sort((a, b) => (b.neuesteVomTeam?.createdAt.getTime() ?? 0) - (a.neuesteVomTeam?.createdAt.getTime() ?? 0))
  const erster = ungelesen[0]
  const n = erster?.neuesteVomTeam
  if (!erster || !n) return null
  return {
    nachricht: {
      unterhaltungId: erster.id,
      nachrichtId: n.id,
      href: fadenHref(erster.id),
      titel: erster.titel ?? POSTFACH_TEXT.ohneTitel,
      text: n.text,
      link: n.linkUrl === null ? null : appPfadAusLink(n.linkUrl),
      wichtig: wichtigImFaden(erster),
      wann: wannText(n.createdAt, jetzt),
    },
    weitere: ungelesen.length - 1,
  }
}

// ─── Der Faden ───────────────────────────────────────────────────────────────

export type FadenNachricht = {
  id: string
  vonFarmId: string | null
  text: string
  linkUrl: string | null
  art: NachrichtArtWert
  createdAt: Date
}

export type FadenEintrag =
  | { art: 'tag'; schluessel: string; text: string }
  | {
      art: 'nachricht'
      id: string
      /** true = vom Team, links mit Absender; false = vom Hof, rechts. */
      vomTeam: boolean
      text: string
      link: string | null
      wichtig: boolean
      uhrzeit: string
      /** Hat die andere Seite sie gelesen? Nur für die eigenen Nachrichten der Seite, sonst null. */
      gelesen: boolean | null
    }

/**
 * Der Faden in Tagen, älteste zuerst: vor der ersten Nachricht eines Wiener
 * Tags eine Zeile „Heute"/„Gestern"/„Fr, 10. Okt" (datumKurz), je Nachricht
 * die Wiener Uhrzeit. „gelesen" nur an den eigenen Nachrichten der Seite —
 * die andere Seite hat sie gelesen, wenn ihr Lesestand bis dorthin reicht.
 */
export function fadenEintraege(
  nachrichten: readonly FadenNachricht[],
  seite: Seite,
  gelesenBisAndere: Date | null,
  jetzt: Date
): FadenEintrag[] {
  const heute = wienKalendertag(jetzt)
  const eintraege: FadenEintrag[] = []
  let letzterTag: string | null = null
  for (const n of [...nachrichten].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    const tag = wienKalendertag(n.createdAt)
    if (tag !== letzterTag) {
      eintraege.push({ art: 'tag', schluessel: `tag-${tag}`, text: datumKurz(tag, heute) })
      letzterTag = tag
    }
    const vomTeam = n.vonFarmId === null
    const eigene = seite === 'TEAM' ? vomTeam : !vomTeam
    eintraege.push({
      art: 'nachricht',
      id: n.id,
      vomTeam,
      text: n.text,
      link: n.linkUrl === null ? null : appPfadAusLink(n.linkUrl),
      wichtig: n.art === 'WICHTIG',
      uhrzeit: uhrzeitInWien(n.createdAt),
      gelesen: eigene ? gelesenBisAndere !== null && n.createdAt.getTime() <= gelesenBisAndere.getTime() : null,
    })
  }
  return eintraege
}

/** Die neueste Nachricht der anderen Seite — bis zu ihr setzt das Öffnen den Lesestand. null = nichts zu lesen. */
export function neuesteDerAnderenSeite(nachrichten: readonly FadenNachricht[], seite: Seite): FadenNachricht | null {
  const andere = nachrichten.filter((n) => (seite === 'HOF' ? n.vonFarmId === null : n.vonFarmId !== null))
  return andere.reduce<FadenNachricht | null>((neueste, n) => (neueste === null || n.createdAt.getTime() > neueste.createdAt.getTime() ? n : neueste), null)
}

// ─── Rundschreiben: Empfänger ────────────────────────────────────────────────

export type EmpfaengerRegel = z.infer<typeof empfaengerRegelSchema>

export type EmpfaengerArt = EmpfaengerRegel['art']

export const EMPFAENGER_ARTEN: readonly EmpfaengerArt[] = ['alle', 'ausgewaehlt', 'ohne-online-zahlung', 'futter-ohne-nummer']

export const EMPFAENGER_LABEL: Record<EmpfaengerArt, string> = {
  alle: 'Alle Höfe',
  ausgewaehlt: 'Ausgewählte',
  'ohne-online-zahlung': 'Ohne Online-Zahlung',
  'futter-ohne-nummer': 'Futter ohne Nummer',
}

/** Was die Empfänger-Regeln über einen Hof wissen müssen — ohne Namen der Person, ohne E-Mail. */
export type EmpfaengerHof = {
  id: string
  name: string
  ort: string
  stripeAccountReady: boolean
  betriebsnummer: HofRegistrierung['betriebsnummer']
  betriebsstatus: HofRegistrierung['betriebsstatus']
  /** Mindestens ein Futtermittel im Shop (verfügbar). */
  hatFutter: boolean
}

/**
 * Trifft ein Filter diesen Hof? „Ohne Online-Zahlung": Das Stripe-Konto trägt
 * (noch) keine Zahlungen — eingerichtet ist sie erst mit fertigem Konto.
 * „Futter ohne Nummer": Futtermittel im Shop, aber keine Betriebsnummer (LFBIS,
 * dieselbe Regel wie Futter kaufen, futter-registrierung.ts).
 */
export function passtZumFilter(hof: EmpfaengerHof, art: 'ohne-online-zahlung' | 'futter-ohne-nummer'): boolean {
  if (art === 'ohne-online-zahlung') return !hof.stripeAccountReady
  return hof.hatFutter && !hatRegistrierung('LFBIS', hof)
}

/**
 * Die Empfänger einer Regel aus der Liste der möglichen Höfe (nicht
 * stillgelegt; die Abfrage liefert nur solche). „Ausgewählte" nimmt nur
 * Kennungen, die in der Liste stehen — eine fremde oder stillgelegte fällt
 * still heraus. Jeder Hof höchstens einmal.
 */
export function empfaengerFuer(regel: EmpfaengerRegel, hoefe: readonly EmpfaengerHof[]): string[] {
  if (regel.art === 'alle') return hoefe.map((h) => h.id)
  if (regel.art === 'ausgewaehlt') {
    const gewaehlt = new Set(regel.hofIds)
    return hoefe.filter((h) => gewaehlt.has(h.id)).map((h) => h.id)
  }
  const art = regel.art
  return hoefe.filter((h) => passtZumFilter(h, art)).map((h) => h.id)
}

/** Die Art einer gespeicherten Regel (Rundschreiben.empfaengerRegel, JSON) — Unbekanntes zählt als „alle". */
export function empfaengerArtAus(regel: unknown): EmpfaengerArt {
  const art = typeof regel === 'object' && regel !== null && 'art' in regel ? regel.art : null
  return EMPFAENGER_ARTEN.find((a) => a === art) ?? 'alle'
}

/** Die Zahl hinter jeder Empfänger-Wahl („Alle Höfe · 4"). */
export function empfaengerZahlen(hoefe: readonly EmpfaengerHof[], ausgewaehlt: readonly string[]): Record<EmpfaengerArt, number> {
  return {
    alle: hoefe.length,
    ausgewaehlt: empfaengerFuer({ art: 'ausgewaehlt', hofIds: [...ausgewaehlt] }, hoefe).length,
    'ohne-online-zahlung': empfaengerFuer({ art: 'ohne-online-zahlung' }, hoefe).length,
    'futter-ohne-nummer': empfaengerFuer({ art: 'futter-ohne-nummer' }, hoefe).length,
  }
}

function hoefeText(anzahl: number): string {
  return `${anzahl} ${anzahl === 1 ? 'Hof' : 'Höfe'}`
}

/** „An 2 Höfe senden", „An 1 Hof senden". */
export function sendenText(anzahl: number): string {
  return `An ${hoefeText(anzahl)} senden`
}

/** Wer ein gesendetes Rundschreiben bekam: „Alle Höfe · 4", „2 Höfe (Futter ohne Nummer)", „1 Hof (ausgewählt)". */
export function empfaengerText(art: EmpfaengerArt, anzahl: number): string {
  if (art === 'alle') return `${EMPFAENGER_LABEL.alle} · ${anzahl}`
  if (art === 'ausgewaehlt') return `${hoefeText(anzahl)} (ausgewählt)`
  return `${hoefeText(anzahl)} (${EMPFAENGER_LABEL[art]})`
}

/** Nach dem Senden: „Rundschreiben an 2 Höfe gesendet." */
export function gesendetText(anzahl: number): string {
  return `Rundschreiben an ${hoefeText(anzahl)} gesendet.`
}

/** „3 von 4 gelesen" — die Lesequote eines Rundschreibens. */
export function lesequoteText(gelesen: number, empfaenger: number): string {
  return `${gelesen} von ${empfaenger} gelesen`
}

/** Hat der Hof das Rundschreiben gelesen? Sein Lesestand reicht bis zum Versand. */
export function rundschreibenGelesen(gelesenBis: Date | null, gesendetAm: Date): boolean {
  return gelesenBis !== null && gelesenBis.getTime() >= gesendetAm.getTime()
}

/** Die Art der ersten Nachricht folgt dem Rundschreiben. */
export function nachrichtArtVon(art: 'INFO' | 'WICHTIG'): 'NORMAL' | 'WICHTIG' {
  return art === 'WICHTIG' ? 'WICHTIG' : 'NORMAL'
}

/** Sätze des Admin-Postfachs — EINE Quelle für die drei Reiter und das Formular. */
export const ADMIN_POSTFACH_TEXT = {
  titel: 'Postfach',
  satz: 'Alles, was Höfe und Kundschaft dir schreiben – an einem Ort.',
  neuesRundschreiben: 'Neues Rundschreiben',
  unterhaltungenHinweis: 'Hier stehen die Antworten der Höfe auf deine Rundschreiben. Was ein Hof von sich aus meldet, steht unter „Meldungen“.',
  rundschreibenHinweis: 'Ein Rundschreiben landet bei jedem Empfänger als Nachricht vom Team im Postfach; Antworten kommen unter „Unterhaltungen“ zu dir.',
  antwortAuf: 'Antwort auf',
  antwortFeld: (hof: string) => `Antwort an ${hof} …`,
  alsWichtig: 'Als Wichtig markieren',
  linkEinfuegen: 'Link einfügen',
  auchPerMail: 'Auch per E-Mail (Betriebsmitteilung)',
  // Ohne „links": Unter 1024 px steht der Faden unter der Liste.
  waehlen: 'Wähl eine Unterhaltung, um sie zu lesen und zu antworten.',
  du: 'du',
  gesendet: 'Gesendet',
  regeln: 'Regeln',
  regelnText:
    'Rundschreiben sind für Betriebsmitteilungen: neue Funktionen, Abrechnung, Rechtliches, Bitten an einzelne Höfe. Werbung für Dritte gibt es hier nicht. Per E-Mail geht ein Rundschreiben nur, wenn es den Betrieb des Hofs betrifft – sonst bleibt es in der App. Jeder Hof kann antworten; die Antwort landet als Unterhaltung in deinem Postfach.',
  an: 'An',
  hofSuchen: 'Hof suchen …',
  art: 'Art',
  info: 'Info',
  titelFeld: 'Titel',
  textFeld: 'Text',
  linkFeld: 'Link (freiwillig)',
  linkHinweis: `Beginnt mit „/“ (Weg in der App) oder https://${PRODUKTION_HOST}/…`,
  /**
   * Beispiel im Feld „Link" — die Produkte des Hofs (wie PRODUKTE_HREF in
   * bauern-navigation.ts; von dort nicht eingebunden, weil die Datei selbst
   * POSTFACH_HREF von hier holt). Nur Platzhalter, kein Ziel.
   */
  linkBeispiel: '/products',
  perMail: 'Auch per E-Mail schicken – Betriebsmitteilung',
  // Kein „Absender: …": Der Kopf der Mail nennt die Plattform (EMAIL_FROM), das Team steht in der Mail.
  perMailSatz: `Nur, wenn es den Betrieb des Hofs betrifft. In der Mail steht „Nachricht vom ${MARKE_TEAM}“, geantwortet wird in der App.`,
  soSiehtsDerHof: 'So sieht’s der Hof',
  nochNichtGelesen: 'noch nicht gelesen',
  rundschreiben: 'Rundschreiben',
  keinHofGewaehlt: 'Wähl oben mindestens einen Hof aus.',
  reiterBeschriftung: 'Bereiche des Postfachs',
  zaehlerAntworten: 'ungelesene Antworten',
  zaehlerMeldungen: 'Meldungen zu entscheiden',
  /** Die Zahl am Reiter „Postfach" der AdminShell zählt beides (adminbereich.ts). */
  zaehlerReiter: 'ungelesene Antworten und Meldungen zu entscheiden',
  listeBeschriftung: 'Unterhaltungen mit Antworten der Höfe',
  fadenBeschriftung: 'Unterhaltung',
  gespeichert: 'Antwort gespeichert.',
  mitMail: 'Antwort gespeichert – mit E-Mail an den Hof.',
  gedrosselt: 'Antwort gespeichert. Keine E-Mail: Zu dieser Unterhaltung ging in der letzten Stunde schon eine.',
  entfernen: 'entfernen',
  keinTreffer: 'Kein Hof passt zur Suche.',
  rundschreibenAn: (anzahl: number) => `Rundschreiben an ${anzahl} ${anzahl === 1 ? 'Hof' : 'Höfe'}`,
  gelesenVomHof: 'gelesen',
  /** Ein Reiter ließ sich nicht laden — AdminFehler mit „Noch einmal versuchen". */
  ladeFehler: {
    unterhaltungen: 'Wir konnten die Unterhaltungen gerade nicht laden.',
    meldungen: 'Wir konnten die Meldungen gerade nicht laden.',
    rundschreiben: 'Wir konnten die Rundschreiben gerade nicht laden.',
  } satisfies Record<AdminPostfachReiter, string>,
} as const

/** Der Leerzustand „Unterhaltungen" (Register N9): Der Ausweg ist ein neues Rundschreiben. */
export const UNTERHALTUNGEN_LEER = {
  titel: 'Noch keine Antwort von einem Hof',
  satz: 'Antwortet ein Hof auf ein Rundschreiben, steht die Unterhaltung hier.',
} as const

/** Der Leerzustand „Gesendet" (Register N9). Ohne Aktion, Grund in `ohne` (wie POSTFACH_LEER). */
export const RUNDSCHREIBEN_LEER = {
  titel: 'Noch kein Rundschreiben gesendet',
  satz: 'Was du unter „Neues Rundschreiben“ schreibst und sendest, steht danach hier – mit der Zahl der Höfe, die es gelesen haben.',
} as const
