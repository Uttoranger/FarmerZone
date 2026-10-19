import { z } from 'zod'
import { uhrzeitInWien } from '@/lib/fristen'
import { kalendertagInWien } from '@/lib/wiener-tag'
import { tagVersetzt } from '@/lib/kalender'
import { MARKE } from '@/lib/marke'
import { PROBLEM_MELDEN } from '@/lib/fehlerseite'

/*
 * Angemeldete Geräte, Mail bei neuem Gerät und „Das war ich nicht"
 * (Register E7, Ergänzung Lauf 17; Nr. 114) — die reinen Regeln: Gerätename,
 * Geräte-Kennung, Einmal-Links, Zeilen und Texte. Hashen und Datenbank liegen
 * in src/server/geraete.ts: Diese Datei lädt auch der Browser (Baustein
 * AngemeldeteGeraete), node:crypto gehört nicht dorthin.
 *
 * Nie Ort, IP-Adresse oder ein Token: Ein Gerät heißt nur nach Gerät und
 * Browser, in festen Wörtern — die volle Browserangabe verlässt den Server nie.
 */

// ── Geräte-Kennung ──────────────────────────────────────────────────────────

/**
 * Das Cookie mit der zufälligen Geräte-Kennung. Bewusst ein fester Name,
 * nicht aus MARKE gebaut: Hieße es nach einem Markenwechsel anders, wäre jedes
 * Gerät „neu" und jeder Hof bekäme eine Mail „Neue Anmeldung". Steht deshalb
 * in der Ausnahmeliste von tests/marke-name-wache.test.ts.
 */
export const GERAETE_COOKIE = 'agrilo_geraet'

/** 400 Tage — länger hält kein Browser ein Cookie (Chrome kappt dort). */
export const GERAETE_COOKIE_MAX_ALTER_SEKUNDEN = 400 * 24 * 60 * 60

/** 128 bit Zufall, base64url: genau 22 Zeichen. */
export const GERAETE_KENNUNG_BYTES = 16
export const GERAETE_KENNUNG_MUSTER = /^[A-Za-z0-9_-]{22}$/

/**
 * Die Attribute des Cookies außer `secure` — das entscheidet Better Auth wie
 * für das Sitzungs-Cookie (https → Secure; lokal über http nicht).
 * httpOnly: Kein Skript der Seite liest die Kennung. SameSite=Lax: Der Link
 * aus einer Mail öffnet die Seite mit Cookie, ein fremdes Formular schickt
 * es nicht mit.
 */
export const GERAETE_COOKIE_OPTIONEN = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: GERAETE_COOKIE_MAX_ALTER_SEKUNDEN,
} as const

/** Ein Wert aus dem Cookie ist Fremdtext: Nur die Form, die wir selbst setzen, zählt. */
export function gueltigeGeraeteKennung(wert: string | null | undefined): string | null {
  return typeof wert === 'string' && GERAETE_KENNUNG_MUSTER.test(wert) ? wert : null
}

/** Welche Konten ein Gerät gemerkt und bei einem neuen eine Mail bekommen: Höfe und der Betrieb. */
export function merktGeraete(konto: { role: string; isAdmin: boolean }): boolean {
  return konto.isAdmin || konto.role === 'FARMER' || konto.role === 'ADMIN'
}

// ── Gerätename ──────────────────────────────────────────────────────────────

export type GeraetArt = 'handy' | 'computer'

type System = 'iPhone' | 'iPad' | 'Android' | 'Windows' | 'Mac' | 'ChromeOS' | 'Linux'

/** Reihenfolge zählt: iPhone und iPad nennen sich auch „Mac OS X", Android auch „Linux". */
function systemVon(ua: string): System | null {
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Windows/.test(ua)) return 'Windows'
  if (/CrOS/.test(ua)) return 'ChromeOS'
  if (/Macintosh|Mac OS X/.test(ua)) return 'Mac'
  if (/Linux/.test(ua)) return 'Linux'
  return null
}

/** Reihenfolge zählt: Edge, Opera und Samsung nennen sich auch „Chrome", Chrome nennt sich auch „Safari". */
function browserVon(ua: string): string | null {
  if (/Edg(e|A|iOS)?\//.test(ua)) return 'Edge'
  if (/OPR\/|Opera/.test(ua)) return 'Opera'
  if (/SamsungBrowser\//.test(ua)) return 'Samsung Internet'
  if (/Firefox\/|FxiOS\//.test(ua)) return 'Firefox'
  if (/Chrome\/|CriOS\//.test(ua)) return 'Chrome'
  if (/Safari\//.test(ua)) return 'Safari'
  return null
}

export const UNBEKANNTES_GERAET = 'Unbekanntes Gerät'

/**
 * „iPhone · Safari", „Windows · Edge", „Mac · Safari" — aus der Browserangabe
 * der Sitzung, nur in festen Wörtern (die Angabe selbst ist Fremdtext). Ohne
 * Paket: Eine Liste der üblichen Geräte reicht, der Rest heißt „Unbekanntes
 * Gerät". (`geraetKurz` in src/lib/hof-hilfe.ts schreibt für Meldungen
 * „Chrome, Windows" — eine andere Form für einen anderen Zweck.)
 */
export function geraetName(userAgent: string | null): string {
  const ua = (userAgent ?? '').trim()
  const teile = [systemVon(ua), browserVon(ua)].filter((t): t is string => t !== null)
  return teile.length > 0 ? teile.join(' · ') : UNBEKANNTES_GERAET
}

/** Für das Symbol der Zeile: Handy (auch Tablet) oder Computer. */
export function geraetArt(userAgent: string | null): GeraetArt {
  const system = systemVon((userAgent ?? '').trim())
  return system === 'iPhone' || system === 'iPad' || system === 'Android' ? 'handy' : 'computer'
}

// ── Liste „Angemeldete Geräte" ──────────────────────────────────────────────

/** Eine gültige Sitzung des eigenen Kontos — nie Token, nie IP. */
export type EigeneSitzung = { id: string; userAgent: string | null; createdAt: Date; updatedAt: Date }

/** Was der Baustein zeigt — Texte fertig auf dem Server, ohne Datum (CODING_STANDARDS §2). */
export type GeraeteZeile = { id: string; name: string; art: GeraetArt; dieses: boolean; unterzeile: string }

/** „12.10." — Tag und Monat in Wien, ohne führende Null (Mockup system-h1-angemeldete-geraete). */
export function tagMonat(zeitpunkt: Date): string {
  const [, monat, tag] = kalendertagInWien(zeitpunkt).split('-')
  return `${Number(tag)}.${Number(monat)}.`
}

/**
 * „heute, 08:14", „gestern, 19:02", „vor 3 Tagen" — vom Wiener Kalendertag aus.
 * Better Auth frischt eine Sitzung höchstens einmal am Tag auf (updateAge in
 * src/lib/auth.ts): „zuletzt" ist so genau wie ein Tag, nicht wie ein Klick.
 */
export function zuletztText(zeitpunkt: Date, jetzt: Date): string {
  const tag = kalendertagInWien(zeitpunkt)
  const heute = kalendertagInWien(jetzt)
  if (tag >= heute) return `heute, ${uhrzeitInWien(zeitpunkt)}`
  if (tag === tagVersetzt(heute, -1)) return `gestern, ${uhrzeitInWien(zeitpunkt)}`
  const tage = Math.round((Date.parse(`${heute}T00:00:00Z`) - Date.parse(`${tag}T00:00:00Z`)) / 86_400_000)
  return `vor ${tage} Tagen`
}

/**
 * Die Zeilen der Liste: dieses Gerät zuerst, dann nach „zuletzt", neueste oben.
 * Eine Zeile je Sitzung (Wortliste: Angemeldete Geräte).
 */
export function geraeteZeilen(sitzungen: readonly EigeneSitzung[], aktuelleId: string, jetzt: Date): GeraeteZeile[] {
  return [...sitzungen]
    .sort((a, b) => Number(b.id === aktuelleId) - Number(a.id === aktuelleId) || b.updatedAt.getTime() - a.updatedAt.getTime())
    .map((s) => {
      const dieses = s.id === aktuelleId
      const seit = `angemeldet seit ${tagMonat(s.createdAt)}`
      return {
        id: s.id,
        name: geraetName(s.userAgent),
        art: geraetArt(s.userAgent),
        dieses,
        unterzeile: dieses ? `${GERAETE_TEXT.diesesGeraet} · ${seit}` : `zuletzt ${zuletztText(s.updatedAt, jetzt)} · ${seit}`,
      }
    })
}

export const GERAETE_TEXT = {
  titel: 'Angemeldete Geräte',
  diesesGeraet: 'dieses Gerät',
  abmelden: 'Abmelden',
  alleAnderenAbmelden: 'Alle anderen abmelden',
  hinweis:
    'Ein Gerät kennst du nicht? Melde es ab und ändere danach dein Passwort. Wir zeigen nur Gerät und Browser – keinen Ort, keine IP-Adresse.',
  blattTitel: 'Alle anderen Geräte abmelden?',
  blattZusatz:
    'Auf den anderen Geräten musst du dich danach neu anmelden. Kennst du ein Gerät nicht, ändere danach dein Passwort.',
  abbrechen: 'Abbrechen',
  einenMoment: 'Einen Moment …',
  fehler: 'Das hat nicht geklappt. Bitte versuch es noch einmal.',
} as const

/** „A und B", „A, B und C" — gleiche Namen einmal, mit Anzahl. */
function aufzaehlung(namen: readonly string[]): string {
  const anzahl = new Map<string, number>()
  for (const n of namen) anzahl.set(n, (anzahl.get(n) ?? 0) + 1)
  const teile = [...anzahl].map(([name, n]) => (n > 1 ? `${name} (${n}×)` : name))
  return teile.length <= 1 ? (teile[0] ?? '') : `${teile.slice(0, -1).join(', ')} und ${teile[teile.length - 1]}`
}

/**
 * Der Satz im Blatt „Alle anderen Geräte abmelden?" — nennt die Geräte
 * („Windows · Chrome und Android · Chrome werden sofort abgemeldet. Dieses
 * iPhone bleibt angemeldet.").
 */
export function alleAnderenSatz(zeilen: readonly GeraeteZeile[]): string {
  const andere = zeilen.filter((z) => !z.dieses).map((z) => z.name)
  const dieses = zeilen.find((z) => z.dieses)
  const system = dieses?.name.split(' · ')[0]
  const diesesWort = system === 'iPhone' || system === 'iPad' ? `Dieses ${system}` : 'Dieses Gerät'
  const verb = andere.length === 1 ? 'wird' : 'werden'
  return `${aufzaehlung(andere)} ${verb} sofort abgemeldet. ${diesesWort} bleibt angemeldet.`
}

// ── Einmal-Links ────────────────────────────────────────────────────────────

/** Ein Link aus einer Mail gilt 7 Tage und einmal (E7, Ergänzung). */
export const EINMAL_LINK_GUELTIG_TAGE = 7
/** Benutzte Links bleiben so lange stehen, danach löscht sie das tägliche Aufräumen. */
export const EINMAL_LINK_BENUTZT_AUFBEWAHREN_TAGE = 7

const TAG_MS = 24 * 60 * 60 * 1000

/** 256 bit Zufall, base64url: genau 43 Zeichen. */
export const EINMAL_TOKEN_BYTES = 32
export const einmalTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/)

/**
 * Wofür ein Link gilt: die Art vorn, ein Bezug nach „:" (`nicht-ich:<Gerät>`;
 * Nr. 115: `admin-einrichten:<Sitzung>`). Einlösen prüft die Art.
 */
export const EINMAL_LINK_ART = { nichtIch: 'nicht-ich' } as const

export function einmalLinkZweck(art: string, bezug: string): string {
  return `${art}:${bezug}`
}

/** Der Bezug hinter der Art, oder null, wenn der Zweck nicht zur Art passt. */
export function bezugAusZweck(zweck: string, art: string): string | null {
  return zweck.startsWith(`${art}:`) ? zweck.slice(art.length + 1) : null
}

export function einmalLinkAblauf(jetzt: Date, tage: number = EINMAL_LINK_GUELTIG_TAGE): Date {
  return new Date(jetzt.getTime() + tage * TAG_MS)
}

/** Ab wann ein benutzter Link weg darf; ein abgelaufener darf sofort (src/server/aufraeumen.ts). */
export function einmalLinkAufraeumGrenze(jetzt: Date): Date {
  return new Date(jetzt.getTime() - EINMAL_LINK_BENUTZT_AUFBEWAHREN_TAGE * TAG_MS)
}

// ── „Das war ich nicht" ─────────────────────────────────────────────────────

export const NICHT_ICH_PFAD = '/sicherheit/nicht-ich'

/** Knopf „Alle Geräte abmelden" je IP und Minute — nur gegen Schleifen, raten lässt sich der Token nicht. */
export const NICHT_ICH_JE_MINUTE = 10

export function nichtIchLink(appUrl: string, token: string): string {
  return `${appUrl}${NICHT_ICH_PFAD}?t=${token}`
}

/** „19.10. um 14:32" — Wiener Zeit, wie im Mockup. */
export function anmeldeZeitpunkt(zeitpunkt: Date): string {
  return `${tagMonat(zeitpunkt)} um ${uhrzeitInWien(zeitpunkt)}`
}

export const NICHT_ICH_TEXT = {
  seitentitel: 'Das war ich nicht',
  titel: 'Das warst nicht du?',
  anmeldung: 'Anmeldung am',
  auf: 'auf',
  erklaerung:
    'Wir melden alle Geräte ab – auch dieses. Danach legst du ein neues Passwort fest; den Link dafür schicken wir dir per E-Mail.',
  knopf: 'Alle Geräte abmelden',
  doch: 'Doch, das war ich',
  vorab: 'Erst dieser Knopf meldet ab – ein Programm, das Links in Mails vorab öffnet, löst nichts aus.',
  fertigTitel: 'Alle Geräte sind abgemeldet',
  // „1 Stunde" = resetPasswordTokenExpiresIn in src/lib/auth.ts (wie die Mail password-reset.tsx).
  fertigSatz: 'Wir haben dir eine E-Mail mit einem Link für ein neues Passwort geschickt. Der Link gilt 1 Stunde.',
  fertigOhneMail: 'Leg über „Passwort vergessen" auf der Anmeldeseite ein neues Passwort fest.',
  fertigHinweis:
    'Kommt die Mail nicht an oder hat jemand dein Postfach übernommen? Ändere zuerst das Passwort deines E-Mail-Postfachs und schreib uns dann über',
  problemMelden: PROBLEM_MELDEN,
  ungueltigTitel: 'Dieser Link gilt nicht mehr.',
  ungueltigSatz:
    'Er war 7 Tage und einmal gültig. Kennst du ein Gerät nicht, melde dich an und schau unter Einstellungen › Konto und Sicherheit nach deinen Geräten.',
  zurAnmeldung: 'Zur Anmeldung',
  zuViele: 'Das waren gerade zu viele Versuche. Warte eine Minute und probier es dann noch einmal.',
} as const

// ── Mail „Neue Anmeldung" ───────────────────────────────────────────────────

export const NEUE_ANMELDUNG_MAIL = {
  betreff: (hof: boolean): string => (hof ? 'Neue Anmeldung bei deinem Hof-Konto' : 'Neue Anmeldung bei deinem Konto'),
  anrede: (name: string | null): string => (name ? `Hallo ${name},` : 'Hallo,'),
  vorher: 'am',
  nachher: 'hat sich jemand mit deinem Konto angemeldet:',
  neuesGeraet: 'ein Gerät, das wir bei dir noch nicht kannten',
  warstDu: 'Warst du das? Dann musst du nichts tun.',
  knopf: 'Das war ich nicht',
  fuss: `Der Knopf öffnet eine Seite bei ${MARKE} – erst dort meldest du alle Geräte ab. Der Link gilt ${EINMAL_LINK_GUELTIG_TAGE} Tage und einmal. Wir fragen dich nie per Mail nach deinem Passwort.`,
} as const
