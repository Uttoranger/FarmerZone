/**
 * Admin › Betrieb (Register N18 neu, N15 geändert; Nachtlauf Nr. 103): was die
 * Plattform im Hintergrund braucht — Bilder-Speicher, Datenbank, E-Mails und
 * Bild-Vorgänge gegen die Grenze des Tarifs, die Abläufe mit ihrem letzten
 * Lauf, Warnstufen und die Texte von Seite und Warn-Mail. EINE Quelle für
 * Tarife, Grenzen, Arten und Abläufe; rein, ohne Datenbank prüfbar
 * (tests/betrieb.test.ts). `jetzt` ist immer ein Parameter.
 *
 * Tage: Gespeichert wird je UTC-Tag (Resend zählt den Tag ab 0 Uhr UTC, und
 * eine Messung zwischen 0 und 2 Uhr Wiener Zeit schreibt so nie in den
 * Vortag); angezeigt werden Uhrzeiten in Wiener Zeit.
 *
 * Wörter nur aus der Wortliste: Betrieb, Grenze, Ablauf, Bilder ohne
 * Verwendung (nicht Monitoring, Quota, Cron, Job); der Name nur aus MARKE.
 */
import { MONAT_KURZ, formatDezimal, formatTagKurz, formatZahl } from '@/lib/format'
import { kalendertagInWien } from '@/lib/wiener-tag'
import { tagVersetzt } from '@/lib/kalender'
import { uhrzeitInWien } from '@/lib/fristen'
import { MARKE } from '@/lib/marke'
import type { MarkeArt } from '@/lib/marke-art'

// ─── Tarife und Grenzen ──────────────────────────────────────────────────────

/** Die Tarife der Dienste (Stand 16.10.2026). Nach einem Tarifwechsel NUR hier ändern. */
export const TARIFE = { vercel: 'HOBBY', supabase: 'FREE', resend: 'FREE' } as const

/*
 * Grenzen je Tarif. Speicher in Dezimal-Einheiten (1 GB = 10⁹ Bytes, 1 MB =
 * 10⁶): Ob ein Dienst binär zählt, sagt er nicht eindeutig — die kleinere Zahl
 * warnt früher, nie später.
 */
export const GRENZEN = {
  vercel: {
    HOBBY: { bilderBytes: 1_000_000_000, bildVorgaengeMonat: 2_000, uebertragungBytesMonat: 10_000_000_000 },
  },
  supabase: {
    FREE: { datenbankBytes: 500_000_000, uebertragungBytesMonat: 5_000_000_000 },
  },
  resend: {
    FREE: { mailsTag: 100, mailsMonat: 3_000 },
  },
} as const

/** Die Grenzen der Tarife von heute — daran misst die Seite, daran warnt die Mail. */
export const GRENZE = {
  bilderBytes: GRENZEN.vercel[TARIFE.vercel].bilderBytes,
  bildVorgaengeMonat: GRENZEN.vercel[TARIFE.vercel].bildVorgaengeMonat,
  bildUebertragungBytesMonat: GRENZEN.vercel[TARIFE.vercel].uebertragungBytesMonat,
  datenbankBytes: GRENZEN.supabase[TARIFE.supabase].datenbankBytes,
  datenbankUebertragungBytesMonat: GRENZEN.supabase[TARIFE.supabase].uebertragungBytesMonat,
  mailsTag: GRENZEN.resend[TARIFE.resend].mailsTag,
  mailsMonat: GRENZEN.resend[TARIFE.resend].mailsMonat,
} as const

// ─── Arten der Messung ───────────────────────────────────────────────────────

/**
 * Was in BetriebMessung steht — je UTC-Tag und Art EINE Zahl. `mails` zählt
 * der Mail-Zähler (src/server/betrieb-zaehler.ts) hoch, `bilderAuflistungen`
 * die Messung selbst (jede Seite von `list()` ist ein Vorgang bei Vercel);
 * den Rest schreibt `messeBetrieb`.
 */
export const BETRIEB_ARTEN = [
  'bilderBytes',
  'bilderDateien',
  'bilderUploadsMonat',
  'bilderAuflistungen',
  'bildVorgaengeMonat',
  'datenbankBytes',
  'mails',
] as const
export type BetriebArt = (typeof BETRIEB_ARTEN)[number]

/** Was nur `messeBetrieb` schreibt — daraus „Gemessen heute, hh:mm“ (der Mail-Zähler ist keine Messung). */
export const MESS_ARTEN = ['bilderBytes', 'bilderDateien', 'bilderUploadsMonat', 'bildVorgaengeMonat', 'datenbankBytes'] as const satisfies readonly BetriebArt[]

/** „Jetzt messen“ misst nicht neu, wenn die letzte Messung jünger ist (jede Messung listet den Bild-Speicher). */
export const NEU_MESSEN_AB_MS = 10 * 60 * 1000

/** Misst „Jetzt messen“ neu? Nicht, solange die letzte Messung jünger als 10 Minuten ist — jede Auflistung ist ein Bild-Vorgang. */
export function darfNeuMessen(letzte: Date | null, jetzt: Date): boolean {
  return letzte === null || jetzt.getTime() - letzte.getTime() >= NEU_MESSEN_AB_MS
}

/** So lange bleiben Messungen (Register N18; aufgeräumt wird mit Nr. 104). */
export const MESSUNGEN_AUFBEWAHREN_TAGE = 400

/** Der Verlauf auf der Seite. */
export const VERLAUF_TAGE = 90

/** Die Fortschreibung „voll in …“ nimmt die letzten 30 Tage. */
export const TREND_TAGE = 30

/**
 * Bild-Vorgänge im Monat, geschätzt: Jedes Foto lädt zweimal hoch (Original
 * und fertiges Bild; das Original wird danach gelöscht,
 * src/app/api/upload/verarbeiten/route.ts), dazu jede eigene Auflistung.
 * Blicke ins Vercel-Dashboard zählen auch — die sieht nur Vercel.
 */
export function bildVorgaengeSchaetzung(uploadsImMonat: number, auflistungenImMonat: number): number {
  return 2 * uploadsImMonat + auflistungenImMonat
}

// ─── Tage in UTC ─────────────────────────────────────────────────────────────

/** Der UTC-Tag eines Zeitpunkts als JJJJ-MM-TT — der Schlüssel jeder Messung. */
export function utcTag(jetzt: Date): string {
  return jetzt.toISOString().slice(0, 10)
}

/** 0 Uhr UTC des Tages. */
export function utcTagesbeginn(jetzt: Date): Date {
  return new Date(`${utcTag(jetzt)}T00:00:00.000Z`)
}

/** 0 Uhr UTC am Ersten des Monats. */
export function utcMonatsbeginn(jetzt: Date): Date {
  return new Date(`${utcTag(jetzt).slice(0, 7)}-01T00:00:00.000Z`)
}

/** Ein UTC-Tag (JJJJ-MM-TT) um n Tage versetzt. */
export function utcTagVersetzt(tag: string, tage: number): string {
  const d = new Date(`${tag}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + tage)
  return utcTag(d)
}

function tageZwischen(von: string, bis: string): number {
  return Math.round((Date.parse(`${bis}T00:00:00Z`) - Date.parse(`${von}T00:00:00Z`)) / 86_400_000)
}

// ─── Anteil, Stufe, Trend ────────────────────────────────────────────────────

/** Ab diesen Anteilen (in %) steigt die Warnstufe: 1 = ab 80 %, 2 = ab 95 %, 3 = voll. */
export const STUFEN = [80, 95, 100] as const
/** Speicher gilt erst unter 75 % wieder als grün — sonst pendelte ein Wert um 80 % zwischen Warnung und Entwarnung. */
export const ENTWARNUNG_UNTER = 75

export type Stufe = 0 | 1 | 2 | 3

/** Wie viel Prozent der Grenze belegt sind (ohne Deckel: voll ist ≥ 100). */
export function anteil(wert: number, grenze: number): number {
  return grenze > 0 ? (wert / grenze) * 100 : 0
}

/** Die Warnstufe eines Anteils. */
export function stufe(anteilProzent: number): Stufe {
  if (anteilProzent >= STUFEN[2]) return 3
  if (anteilProzent >= STUFEN[1]) return 2
  if (anteilProzent >= STUFEN[0]) return 1
  return 0
}

/** „82 %“ — abgerundet, damit 79,6 % nie „80 %“ heißt, solange keine Warnung gilt. */
export function prozentText(anteilProzent: number): string {
  return `${formatZahl(Math.floor(Math.max(0, anteilProzent)))} %`
}

export type VerlaufPunkt = { tag: string; wert: number }
export type VollIn = { art: 'voll' } | { art: 'tage'; tage: number } | { art: 'mehrAls5Jahre' }
export type Trend = { zuwachs: number; tage: number; vollIn: VollIn }

const FUENF_JAHRE_TAGE = 5 * 365

/**
 * Lineare Fortschreibung der letzten 30 Tage: vom ältesten zum jüngsten
 * Messpunkt im Fenster. Wächst nichts (oder schrumpft es), ist der Speicher
 * „in mehr als 5 Jahren“ voll — das ist auch der Deckel. Ohne zwei Messtage
 * gibt es keinen Trend (null).
 */
export function vollIn(verlauf: readonly VerlaufPunkt[], grenze: number, heute: string): Trend | null {
  const ab = utcTagVersetzt(heute, -TREND_TAGE)
  const fenster = verlauf.filter((p) => p.tag >= ab && p.tag <= heute).sort((a, b) => a.tag.localeCompare(b.tag))
  if (fenster.length < 2) return null
  const erster = fenster[0]
  const letzter = fenster[fenster.length - 1]
  const tage = tageZwischen(erster.tag, letzter.tag)
  if (tage < 1) return null
  const zuwachs = letzter.wert - erster.wert
  if (letzter.wert >= grenze) return { zuwachs, tage, vollIn: { art: 'voll' } }
  const jeTag = zuwachs / tage
  if (jeTag <= 0) return { zuwachs, tage, vollIn: { art: 'mehrAls5Jahre' } }
  const rest = Math.ceil((grenze - letzter.wert) / jeTag)
  return { zuwachs, tage, vollIn: rest > FUENF_JAHRE_TAGE ? { art: 'mehrAls5Jahre' } : { art: 'tage', tage: rest } }
}

/** „voll in ≈ 3 Monaten“, „voll in mehr als 5 Jahren“. */
export function vollInText(v: VollIn): string {
  if (v.art === 'voll') return 'voll'
  if (v.art === 'mehrAls5Jahre') return 'voll in mehr als 5 Jahren'
  if (v.tage <= 60) return `voll in ≈ ${v.tage} ${v.tage === 1 ? 'Tag' : 'Tagen'}`
  if (v.tage <= 730) return `voll in ≈ ${Math.round(v.tage / 30)} Monaten`
  return `voll in ≈ ${Math.round(v.tage / 365)} Jahren`
}

// ─── Anzeige von Zahlen ──────────────────────────────────────────────────────

/** „838 MB“, „2,1 MB“, „1 GB“, „1,2 GB“ — Dezimal-Einheiten wie die Grenzen. */
export function speicherText(bytes: number): string {
  const b = Math.max(0, bytes)
  if (b >= 1e9) {
    const gb = b / 1e9
    return `${Number.isInteger(Math.round(gb * 10) / 10) ? formatZahl(Math.round(gb)) : formatDezimal(gb, 1)} GB`
  }
  const mb = b / 1e6
  if (mb === 0) return '0 MB'
  return mb < 10 ? `${formatDezimal(mb, 1)} MB` : `${formatZahl(Math.round(mb))} MB`
}

/** „+ 61 MB in 30 Tagen“ bzw. „− 3 MB in 12 Tagen“. */
export function zuwachsText(zuwachs: number, tage: number, alsSpeicher = true): string {
  const betrag = alsSpeicher ? speicherText(Math.abs(zuwachs)) : formatZahl(Math.abs(zuwachs))
  return `${zuwachs < 0 ? '−' : '+'} ${betrag} in ${tage} ${tage === 1 ? 'Tag' : 'Tagen'}`
}

/** „0,9 s“ — die Dauer eines Laufs. */
export function dauerText(ms: number | null): string {
  if (ms === null) return '–'
  const s = ms / 1000
  return s < 100 ? `${formatDezimal(s, 1)} s` : `${formatZahl(Math.round(s))} s`
}

/** „heute 05:02“, „gestern 05:31“, „Mo, 12. Okt, 07:01“ — in Wiener Zeit. */
export function zuletztText(zeitpunkt: Date, jetzt: Date): string {
  const tag = kalendertagInWien(zeitpunkt)
  const heute = kalendertagInWien(jetzt)
  const uhr = uhrzeitInWien(zeitpunkt)
  if (tag === heute) return `heute ${uhr}`
  if (tag === tagVersetzt(heute, -1)) return `gestern ${uhr}`
  return `${formatTagKurz(tag)}, ${uhr}`
}

// ─── Abläufe ─────────────────────────────────────────────────────────────────

export type AblaufName = 'aufraeumen' | 'verwaisteBestellungen' | 'betrieb' | 'briefkasten'
export type Rhythmus = 'taeglich' | 'woechentlich'

export type Ablauf = {
  name: AblaufName
  /** Wie er auf der Seite heißt. */
  text: string
  /** Was er tut — ein Satz für die Warn-Mail. */
  zweck: string
  pfad: string
  /** Wie in vercel.json (UTC); tests/betrieb.test.ts hält beide gleich. */
  zeitplan: string
  rhythmus: Rhythmus
}

/**
 * Die Abläufe aus vercel.json (Hobby: höchstens täglich, Start irgendwann in
 * der genannten Stunde). Der Wochenlauf heißt nach der Wortliste „Wochenbericht
 * (Postfach)“ — das alte Wort steht in keinem Nutzertext mehr (Register N12).
 */
export const ABLAEUFE: readonly Ablauf[] = [
  {
    name: 'aufraeumen',
    text: 'Aufräumen',
    zweck: 'Er räumt abgelaufene Reservierungen und alte Zähler der Bremse weg.',
    pfad: '/api/cron/cleanup-reservations',
    zeitplan: '0 3 * * *',
    rhythmus: 'taeglich',
  },
  {
    name: 'verwaisteBestellungen',
    text: 'Verwaiste Bestellungen',
    zweck: 'Er gibt bei Höfen, bei denen tagelang niemand nachsieht, verfallene Bestellungen frei und meldet bezahlte, bei denen die Bestätigung von Stripe fehlt.',
    pfad: '/api/cron/verwaiste-bestellungen',
    zeitplan: '30 3 * * *',
    rhythmus: 'taeglich',
  },
  {
    name: 'betrieb',
    text: 'Messung (Betrieb)',
    zweck: 'Er misst jeden Morgen Bilder-Speicher, Datenbank und E-Mails und schickt diese Warnungen.',
    pfad: '/api/cron/betrieb',
    zeitplan: '0 4 * * *',
    rhythmus: 'taeglich',
  },
  {
    name: 'briefkasten',
    text: 'Wochenbericht (Postfach)',
    zweck: 'Er räumt alte abgeschlossene Meldungen weg und schickt montags den Wochenbericht des Postfachs.',
    pfad: '/api/cron/briefkasten',
    zeitplan: '0 5 * * 1',
    rhythmus: 'woechentlich',
  },
]

/**
 * Ab wann ein Ablauf überfällig ist, gemessen vom letzten Start: Hobby
 * startet irgendwann in der genannten Stunde — zwischen zwei Läufen liegen
 * bis zu 24 h 59 min, also 26 h Spielraum; wöchentlich 8 Tage.
 */
export const UEBERFAELLIG_NACH_MS: Record<Rhythmus, number> = {
  taeglich: 26 * 60 * 60 * 1000,
  woechentlich: 8 * 24 * 60 * 60 * 1000,
}

/** Ein Lauf ohne Ende, der älter ist, gilt als abgebrochen (Zeitlimit der Funktion). */
export const LAUF_ABGEBROCHEN_NACH_MS = 15 * 60 * 1000

export type AblaufLaufDaten = {
  gestartetAm: Date
  beendetAm: Date | null
  ok: boolean
  fehlerKlasse: string | null
  dauerMs: number | null
}

export type AblaufStand = 'puenktlich' | 'ueberfaellig' | 'fehler' | 'nochKeinLauf'

/**
 * Der Stand eines Ablaufs. Keine Zeile heißt „noch kein Lauf“ — nie
 * überfällig (nach dem Deploy hat der Wochenlauf bis Montag keine Zeile).
 * Überfällig geht vor Fehler: Dann ist er gar nicht mehr gelaufen.
 */
export function ablaufStand(ablauf: Pick<Ablauf, 'rhythmus'>, lauf: AblaufLaufDaten | null, jetzt: Date): AblaufStand {
  if (lauf === null) return 'nochKeinLauf'
  const seitStart = jetzt.getTime() - lauf.gestartetAm.getTime()
  if (seitStart > UEBERFAELLIG_NACH_MS[ablauf.rhythmus]) return 'ueberfaellig'
  if (lauf.beendetAm === null) return seitStart > LAUF_ABGEBROCHEN_NACH_MS ? 'fehler' : 'puenktlich'
  return lauf.ok ? 'puenktlich' : 'fehler'
}

/** Die Fehlerklasse für AblaufLauf und Sentry — nur ein Bezeichner, nie ein Text aus dem Fehler. */
export function fehlerKlasse(err: unknown): string {
  return err instanceof Error && /^[A-Za-z][A-Za-z0-9_]{0,59}$/.test(err.name) ? err.name : 'Unbekannt'
}

const WOCHENTAG_PLURAL = ['sonntags', 'montags', 'dienstags', 'mittwochs', 'donnerstags', 'freitags', 'samstags'] as const

/** „täglich ab 05:00“ bzw. „montags ab 07:00“ — die UTC-Zeit aus dem Zeitplan in Wiener Zeit von heute. */
export function wannText(ablauf: Pick<Ablauf, 'zeitplan' | 'rhythmus'>, jetzt: Date): string {
  const [minute, stunde, , , wochentag] = ablauf.zeitplan.split(' ')
  const start = new Date(`${utcTag(jetzt)}T${stunde.padStart(2, '0')}:${minute.padStart(2, '0')}:00.000Z`)
  const uhr = uhrzeitInWien(start)
  if (ablauf.rhythmus === 'taeglich') return `täglich ab ${uhr}`
  return `${WOCHENTAG_PLURAL[Number(wochentag) % 7]} ab ${uhr}`
}

// ─── Warnungen ───────────────────────────────────────────────────────────────

/** Die Werte mit Grenze, je mit ihrer Regel: Speicher mit Entwarnung, Monatswerte ohne, E-Mails je Tag als Hinweis am Morgen. */
export const GRENZ_WERTE = ['bilder', 'datenbank', 'mailsMonat', 'bildVorgaenge', 'mailsTag'] as const
export type GrenzWert = (typeof GRENZ_WERTE)[number]
export type GrenzRegel = 'speicher' | 'monat' | 'tag'

export const GRENZ_REGEL: Record<GrenzWert, GrenzRegel> = {
  bilder: 'speicher',
  datenbank: 'speicher',
  mailsMonat: 'monat',
  bildVorgaenge: 'monat',
  mailsTag: 'tag',
}

/** Der Schlüssel in BetriebWarnung: ein Grenzwert oder `ablauf:<name>`. */
export type WarnArt = GrenzWert | `ablauf:${AblaufName}`

export function ablaufWarnArt(name: AblaufName): WarnArt {
  return `ablauf:${name}`
}

/** Was BetriebWarnung über eine Art weiß. */
export type WarnStand = { stufe: number; gemeldetAm: Date } | null

/**
 * Was eine Prüfung mit einer Art tut. „warnen“ und „entwarnen“ setzen die
 * Stufe BEDINGT (die Bedingung steht in derselben Anweisung, src/server/
 * betrieb.ts) und schicken nur dann eine Mail, wenn die Anweisung eine Zeile
 * traf; „still“ setzt die Stufe ohne Mail auf 0.
 */
export type WarnSchritt = { tun: 'nichts' } | { tun: 'warnen'; stufe: Exclude<Stufe, 0> } | { tun: 'entwarnen' } | { tun: 'still' }

const NICHTS: WarnSchritt = { tun: 'nichts' }

/**
 * Die Regel je Grenzwert. Speicher (Bilder, Datenbank): Stufe steigt bei 80,
 * 95 und 100 %, sinkt nicht mit dem Wert — erst unter 75 % die Entwarnung.
 * Monatswerte (E-Mails, Bild-Vorgänge): je Monat einmal je Stufe, keine
 * Entwarnung, der neue Monat beginnt still bei 0. E-Mails je Tag (`anteil` ist
 * der VORTAG): ein Hinweis am Morgen, einmal je Tag, keine Entwarnung.
 */
export function grenzSchritt(regel: GrenzRegel, bisher: WarnStand, anteilProzent: number, jetzt: Date): WarnSchritt {
  const ziel = stufe(anteilProzent)
  const bisherStufe = bisher?.stufe ?? 0
  if (regel === 'speicher') {
    if (anteilProzent < ENTWARNUNG_UNTER) return bisherStufe > 0 ? { tun: 'entwarnen' } : NICHTS
    return ziel > bisherStufe ? { tun: 'warnen', stufe: ziel as Exclude<Stufe, 0> } : NICHTS
  }
  if (regel === 'monat') {
    const imMonat = bisher !== null && bisher.gemeldetAm.getTime() >= utcMonatsbeginn(jetzt).getTime() ? bisherStufe : 0
    if (ziel > imMonat) return { tun: 'warnen', stufe: ziel as Exclude<Stufe, 0> }
    return bisherStufe > 0 && imMonat === 0 ? { tun: 'still' } : NICHTS
  }
  const heuteGemeldet = bisher !== null && bisher.gemeldetAm.getTime() >= utcTagesbeginn(jetzt).getTime()
  if (ziel > 0) return heuteGemeldet ? NICHTS : { tun: 'warnen', stufe: ziel as Exclude<Stufe, 0> }
  return bisherStufe > 0 ? { tun: 'still' } : NICHTS
}

/**
 * Die Regel je Ablauf: überfällig oder gescheitert → Warnung, höchstens eine
 * Mail je Ablauf und (UTC-)Tag; der nächste gute Lauf entwarnt; „noch kein
 * Lauf“ warnt nie.
 */
export function ablaufSchritt(stand: AblaufStand, bisher: WarnStand, jetzt: Date): WarnSchritt {
  if (stand === 'nochKeinLauf') return NICHTS
  const bisherStufe = bisher?.stufe ?? 0
  if (stand === 'puenktlich') return bisherStufe > 0 ? { tun: 'entwarnen' } : NICHTS
  const heuteGemeldet = bisher !== null && bisher.gemeldetAm.getTime() >= utcTagesbeginn(jetzt).getTime()
  return bisherStufe === 0 || !heuteGemeldet ? { tun: 'warnen', stufe: 1 } : NICHTS
}

// ─── Texte: Grenzwerte ───────────────────────────────────────────────────────

/** Je Grenzwert: Name im Satz, Grenze als Text und was bei 100 % passiert. */
export const GRENZ_TEXT: Record<GrenzWert, { name: string; kurz: string; voll: string; hilft: string | null }> = {
  bilder: {
    name: 'Bilder-Speicher',
    kurz: 'Bilder',
    voll: `Bei ${speicherText(GRENZE.bilderBytes)} sperrt Vercel alle Bilder für 30 Tage – Hofseiten und Produkte zeigen dann keine Fotos.`,
    hilft: 'Vercel Pro, dort gibt es keine harte Sperre.',
  },
  datenbank: {
    name: 'Datenbank',
    kurz: 'Datenbank',
    voll: `Bei ${speicherText(GRENZE.datenbankBytes)} ist die Datenbank nur noch lesbar – keine neuen Bestellungen.`,
    hilft: 'Supabase Pro mit 8 GB.',
  },
  mailsMonat: {
    name: 'E-Mails im Monat',
    kurz: 'E-Mails',
    voll: `Bei ${formatZahl(GRENZE.mailsMonat)} im Monat geht bis zum Monatsende keine E-Mail mehr hinaus.`,
    hilft: null,
  },
  bildVorgaenge: {
    name: 'Bild-Vorgänge im Monat',
    kurz: 'Bild-Vorgänge',
    voll: `Bei ${formatZahl(GRENZE.bildVorgaengeMonat)} im Monat sperrt Vercel alle Bilder für 30 Tage.`,
    hilft: 'Vercel Pro, dort gibt es keine harte Sperre.',
  },
  mailsTag: {
    name: 'E-Mails gestern',
    kurz: 'E-Mails',
    voll: `Bei ${formatZahl(GRENZE.mailsTag)} am Tag gehen weitere E-Mails erst nach 0 Uhr UTC hinaus.`,
    hilft: null,
  },
}

/** „Bilder-Speicher bei 82 %“ bzw. „Bilder-Speicher voll“ — Titel von Warnkarte und Mail. */
export function grenzTitel(wert: GrenzWert, anteilProzent: number): string {
  const name = GRENZ_TEXT[wert].name
  return stufe(anteilProzent) === 3 ? `${name} voll` : `${name} bei ${prozentText(anteilProzent)}`
}

const STUFE_HINWEIS: Record<Exclude<Stufe, 0>, string> = { 1: 'über 80 %', 2: 'über 95 %', 3: 'voll' }

/**
 * Der Hinweis rechts in der Betriebsleiste und am Reiter — nur aus der
 * gespeicherten Stufe, damit die Shell je Seitenaufbau nur EINE schlanke
 * Abfrage braucht (Register N15). Die genaue Zahl steht auf der Seite.
 */
export function warnHinweis(art: string, gespeicherteStufe: number): { text: string; kurz: string } {
  const s = Math.min(3, Math.max(1, gespeicherteStufe)) as Exclude<Stufe, 0>
  if (art.startsWith('ablauf:')) {
    const ablauf = ABLAEUFE.find((a) => `ablauf:${a.name}` === art)
    return { text: `Ablauf „${ablauf?.text ?? 'unbekannt'}“ ausgefallen`, kurz: 'Ablauf ausgefallen' }
  }
  const wert = (GRENZ_WERTE as readonly string[]).includes(art) ? (art as GrenzWert) : null
  if (!wert) return { text: 'Warnung offen', kurz: 'Warnung' }
  return { text: `${GRENZ_TEXT[wert].name} ${STUFE_HINWEIS[s]}`, kurz: `${GRENZ_TEXT[wert].kurz} ${STUFE_HINWEIS[s]}` }
}

/** „1 Warnung“, „2 Warnungen“ — auch das aria-label des Punkts am Reiter. */
export function warnungenText(anzahl: number): string {
  return `${anzahl} ${anzahl === 1 ? 'Warnung' : 'Warnungen'}`
}

/** Was die Shell über offene Warnungen weiß: wie viele und der Hinweis zur ersten. */
export type BetriebHinweis = { anzahl: number; text: string; kurz: string }

/** Die Rangfolge einer Warnung: höhere Stufe zuerst, dann in der Reihenfolge der Seite. */
export function warnRang(art: string, gespeicherteStufe: number): number {
  const i = (GRENZ_WERTE as readonly string[]).indexOf(art)
  return -gespeicherteStufe * 100 + (i === -1 ? 50 : i)
}

/**
 * Der Hinweis der Shell aus den Warnungen und den Läufen: jede Warnung mit
 * Stufe > 0, dazu jeder überfällige Ablauf, der (noch) keine Warnung hat —
 * so fällt auch auf, wenn gar kein Ablauf mehr läuft. null = nichts offen.
 */
export function betriebHinweis(
  warnungen: ReadonlyArray<{ art: string; stufe: number }>,
  laeufe: ReadonlyMap<string, AblaufLaufDaten>,
  jetzt: Date
): BetriebHinweis | null {
  const offen = warnungen.filter((w) => w.stufe > 0).map((w) => ({ art: w.art, stufe: w.stufe }))
  for (const ablauf of ABLAEUFE) {
    const art = ablaufWarnArt(ablauf.name)
    if (offen.some((w) => w.art === art)) continue
    if (ablaufStand(ablauf, laeufe.get(ablauf.name) ?? null, jetzt) === 'ueberfaellig') offen.push({ art, stufe: 1 })
  }
  if (offen.length === 0) return null
  offen.sort((a, b) => warnRang(a.art, a.stufe) - warnRang(b.art, b.stufe))
  return { anzahl: offen.length, ...warnHinweis(offen[0].art, offen[0].stufe) }
}

// ─── Texte: Seite ────────────────────────────────────────────────────────────

export const ADMIN_BETRIEB_HREF = '/admin/betrieb'
export const BETRIEB_EXPORT_HREF = '/admin/betrieb/export'

/** Alle Sätze von Admin › Betrieb — EINE Quelle (Mockups admin-betrieb, mobil-admin-betrieb). */
export const BETRIEB_TEXT = {
  titel: 'Betrieb',
  /** Rechts in der Betriebsleiste der AdminShell, solange eine Warnung offen ist (Register N15). */
  leiste: (hinweis: string): string => `${hinweis} – ansehen`,
  satz: `Was ${MARKE} im Hintergrund braucht – jeden Morgen gemessen. Ab 80 % kommt eine Warn-Mail.`,
  vorschauUmgebung: 'Vorschau: Bilder gemeinsam mit der Produktion gemessen; Abläufe laufen nur in der Produktion',
  jetztMessen: 'Jetzt messen',
  misst: 'Wird gemessen …',
  gemessen: 'Gemessen. Die Kacheln zeigen die neuen Zahlen.',
  geradeGemessen: (uhr: string): string => `Gerade erst gemessen – um ${uhr}`,
  messFehler: 'Das Messen hat nicht geklappt. Versuch es in ein paar Minuten noch einmal.',
  nochNichtGemessen: 'Noch nicht gemessen',
  ladefehler: 'Wir konnten die Zahlen des Betriebs gerade nicht laden.',
  kacheln: 'Werte gegen die Grenze',
  grueneZone: (puenktlich: number, von: number): string => `Sonst alles im grünen Bereich · ${puenktlich} von ${von} Abläufen pünktlich`,
  alleGruen: (puenktlich: number, von: number): string => `Alles im grünen Bereich · ${puenktlich} von ${von} Abläufen pünktlich`,
  warnMail: (uhr: string): string => `Die Warn-Mail ist um ${uhr} hinausgegangen.`,
  warnMailAm: (wann: string): string => `Die Warn-Mail ist ${wann} hinausgegangen.`,
  balkenStrich: 'Strich bei 80 %',
  /** Die Beschriftung des Balkens für Screenreader (role="progressbar"). */
  balken: (titel: string): string => `${titel} – Anteil an der Grenze`,
  nichtGemessen: 'nicht gemessen',
  bilderOhneZugang: 'Noch nicht gemessen – ohne Zugang zum Bild-Speicher (etwa lokal) bleibt diese Kachel leer; die anderen Werte laufen weiter.',
  standVom: (tag: string): string => `Stand vom ${tag} – die letzte Messung kam an diese Quelle nicht heran.`,
  trendAb: 'Trend ab dem zweiten Messtag',
  verlaufTitel: 'Verlauf · 90 Tage',
  verlaufSatz: 'in % der Grenze, je Morgen gemessen',
  verlaufFuss: 'Die heutigen Werte stehen in den Kacheln, alle Messungen als CSV unten.',
  verlaufWarnung: 'Warnung ab 80 %',
  verlaufLeer: 'Noch keine Messung – der Verlauf beginnt mit der ersten.',
  tarifeTitel: 'Tarife und Grenzen',
  tarifeFuss: 'Die Grenzen stehen an einer Stelle im Code (wie Name und Adresse, Register M1) – nach einem Tarifwechsel dort ändern lassen.',
  stripeDienst: 'Stripe',
  stripeSatz: 'Bestimmt der Schlüssel der Umgebung.',
  ohneStripe: 'kein Schlüssel eingerichtet',
  ablaeufeTitel: 'Abläufe',
  ablaeufeSatz: 'jeder Lauf meldet sich hier (Wiener Zeit)',
  ablaeufeSpalten: { ablauf: 'Ablauf', wann: 'Wann', zuletzt: 'Zuletzt', dauer: 'Dauer', stand: 'Stand' },
  ablaeufePuenktlich: (puenktlich: number, von: number): string => `${puenktlich} von ${von} pünktlich`,
  ablaeufeRegel:
    '= mehr als 26 Stunden (täglich) bzw. 8 Tage (wöchentlich) ohne Lauf – Vercel startet einen Ablauf irgendwann in der genannten Stunde.',
  ablaeufeRegelFehler:
    '= der Lauf ist gescheitert (Fehlerklasse in Sentry, ohne Inhalt). Beides schickt eine Warn-Mail; jeder Ablauf prüft nach seinem Lauf die anderen.',
  dashboardTitel: 'Nur im Dashboard',
  dashboardSatz: `Das kann ${MARKE} selbst nicht messen – einmal im Monat ansehen.`,
  dashboardKurz: 'Vercel, Supabase, Sentry, Resend',
  neuerTab: '(öffnet in neuem Tab)',
  tabellenTitel: 'Größte Tabellen',
  tabellenZusammen: (gesamt: string): string => `zusammen ${gesamt}`,
  tabellenSpalten: { tabelle: 'Tabelle', zeilen: 'Zeilen', groesse: 'Größe' },
  tabellenLeer: 'Die Tabellen konnten gerade nicht gelesen werden.',
  csv: 'Messungen als CSV',
  csvSatz: 'Gespeichert wird je Tag und Wert eine Zahl, 400 Tage lang. Keine Personendaten, keine Inhalte.',
} as const

export const STAND_TEXT: Record<AblaufStand, string> = {
  puenktlich: 'pünktlich',
  ueberfaellig: 'überfällig',
  fehler: 'Fehler',
  nochKeinLauf: 'noch kein Lauf',
}

/** Die Bedeutung der Marke je Stand (Register G5): kein Rot — überfällig und Fehler sind „tun“. */
export const STAND_MARKE: Record<AblaufStand, MarkeArt> = {
  puenktlich: 'laeuft',
  ueberfaellig: 'tun',
  fehler: 'tun',
  nochKeinLauf: 'erledigt',
}

/** „Gemessen heute, 06:12“ bzw. „Gemessen am Mo, 12. Okt, 06:12“. */
export function gemessenText(am: Date | null, jetzt: Date): string {
  if (am === null) return BETRIEB_TEXT.nochNichtGemessen
  const tag = kalendertagInWien(am)
  if (tag === kalendertagInWien(jetzt)) return `Gemessen heute, ${uhrzeitInWien(am)}`
  return `Gemessen am ${formatTagKurz(tag)}, ${uhrzeitInWien(am)}`
}

/** Die Tarife für die Karte „Tarife und Grenzen“ — Zahlen aus GRENZE, Namen aus TARIFE. */
const TARIF_NAME: Record<'HOBBY' | 'FREE', string> = { HOBBY: 'Hobby', FREE: 'Free' }

export type TarifZeile = { dienst: string; marke: string; ton: MarkeArt; satz: string }

export const TARIF_ZEILEN: readonly TarifZeile[] = [
  {
    dienst: 'Vercel',
    marke: `${TARIF_NAME[TARIFE.vercel]} · nicht-kommerziell`,
    ton: 'tun',
    satz: `Bilder ${speicherText(GRENZE.bilderBytes)}, ${formatZahl(GRENZE.bildVorgaengeMonat)} Vorgänge und ${speicherText(GRENZE.bildUebertragungBytesMonat)} Übertragung im Monat. Vor Stripe live auf Pro.`,
  },
  {
    dienst: 'Supabase',
    marke: `${TARIF_NAME[TARIFE.supabase]} · ohne Sicherung`,
    ton: 'tun',
    satz: `Datenbank ${speicherText(GRENZE.datenbankBytes)}, ${speicherText(GRENZE.datenbankUebertragungBytesMonat)} Übertragung. Pausiert nach 7 Tagen ohne Zugriff.`,
  },
  {
    dienst: 'Resend',
    marke: TARIF_NAME[TARIFE.resend],
    ton: 'erledigt',
    satz: `${formatZahl(GRENZE.mailsTag)} E-Mails am Tag, ${formatZahl(GRENZE.mailsMonat)} im Monat.`,
  },
]

/** Kurzzeile der zugeklappten Karte am Handy: „Vercel Hobby · Supabase Free · Resend Free“. */
export const TARIFE_KURZ = `Vercel ${TARIF_NAME[TARIFE.vercel]} · Supabase ${TARIF_NAME[TARIFE.supabase]} · Resend ${TARIF_NAME[TARIFE.resend]}`

/**
 * Was nur die Dashboards der Dienste wissen — Links ohne Kennung in der
 * Adresse (Team, Projekt und Organisation wählt der Dienst selbst), damit das
 * öffentliche Repository keine Kennungen trägt.
 */
export const NUR_IM_DASHBOARD = [
  { titel: 'Vercel › Usage', satz: 'Datenübertragung, Bild-Übertragung (10 GB), Funktionen', href: 'https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fusage' },
  { titel: 'Supabase › Usage', satz: 'Übertragung (5 GB), aktive Konten', href: 'https://supabase.com/dashboard/org/_/usage' },
  { titel: 'Sentry › Stats', satz: 'Kontingent der Fehlermeldungen', href: 'https://sentry.io/stats/' },
  { titel: 'Resend › Usage', satz: 'Zustellquote, Bounces', href: 'https://resend.com/settings/usage' },
] as const

/** Die Tabellen mit deutschem Namen; eine unbekannte steht mit ihrem Modellnamen da. */
const TABELLEN_NAME: Record<string, string> = {
  Order: 'Bestellungen',
  OrderItem: 'Bestellpositionen',
  WebhookEvent: 'Webhook-Ereignisse',
  Session: 'Sitzungen',
  Product: 'Produkte',
  Meldung: 'Meldungen',
  Farm: 'Höfe',
  User: 'Konten',
  Account: 'Anmeldewege',
  Verification: 'Codes',
  StockReservation: 'Reservierungen',
  RateLimitZaehler: 'Zähler der Bremse',
  StatusPost: 'Beiträge',
  FarmPhoto: 'Galerie',
  Nachricht: 'Nachrichten',
  Unterhaltung: 'Unterhaltungen',
  Rundschreiben: 'Rundschreiben',
  PickupSlot: 'Abholzeiten',
  ManualSale: 'Verkäufe',
  CustomerFarmSubscription: 'Neuigkeiten-Anmeldungen',
  TeilenAufruf: 'Teilen-Aufrufe',
  BetriebMessung: 'Messungen',
}

export function tabellenName(modell: string): string {
  return TABELLEN_NAME[modell] ?? modell
}

// ─── Kacheln, Verlauf, Abläufe: die Seite als Daten ──────────────────────────

/** Eine Messung, wie die Abfrage sie liefert: Tag als JJJJ-MM-TT (UTC), Wert als Zahl (Werte < 2^53). */
export type Messung = { tag: string; art: BetriebArt; wert: number; gemessenAm: Date }

export type KachelId = 'bilder' | 'datenbank' | 'mailsHeute' | 'bildVorgaenge'

export type Kachel = {
  id: KachelId
  titel: string
  /** Leise Zeile unter dem Titel (E-Mails: wann der Tag bei Resend beginnt). */
  untertitel: string | null
  tarif: string
  /** null = noch nie gemessen. */
  wert: string | null
  von: string
  anteil: number | null
  prozent: string | null
  /** Orange ab 80 %, sonst grün. */
  warnt: boolean
  zeile: string
  satz: string
  /** Die eine Zeile am Handy. */
  kurz: string
  /** Wenn der Wert nicht von der letzten Messung stammt (oder es keinen gibt). */
  hinweis: string | null
}

/** Der letzte Wert einer Art und von welchem Tag. */
function letzter(messungen: readonly Messung[], art: BetriebArt): Messung | null {
  let bester: Messung | null = null
  for (const m of messungen) if (m.art === art && (bester === null || m.tag > bester.tag)) bester = m
  return bester
}

function reihe(messungen: readonly Messung[], art: BetriebArt): VerlaufPunkt[] {
  return messungen.filter((m) => m.art === art).map((m) => ({ tag: m.tag, wert: m.wert }))
}

/** E-Mails eines Monats bis einschließlich `tag`. */
function mailsImMonatBis(messungen: readonly Messung[], tag: string): number {
  const monat = tag.slice(0, 7)
  return messungen.filter((m) => m.art === 'mails' && m.tag.slice(0, 7) === monat && m.tag <= tag).reduce((s, m) => s + m.wert, 0)
}

/** Der Tag der letzten Messung (aus MESS_ARTEN) — daran sieht eine Kachel, ob ihr Wert von heute ist. */
function letzterMesstag(messungen: readonly Messung[]): string | null {
  let tag: string | null = null
  for (const m of messungen) if ((MESS_ARTEN as readonly string[]).includes(m.art) && (tag === null || m.tag > tag)) tag = m.tag
  return tag
}

function trendZeile(verlauf: readonly VerlaufPunkt[], grenze: number, heute: string): string {
  const t = vollIn(verlauf, grenze, heute)
  return t ? `${zuwachsText(t.zuwachs, t.tage)} · ${vollInText(t.vollIn)}` : BETRIEB_TEXT.trendAb
}

/** Die vier Kacheln (Mockup admin-betrieb): Bilder, Datenbank, E-Mails heute, Bild-Vorgänge. */
export function betriebKacheln(messungen: readonly Messung[], jetzt: Date): Kachel[] {
  const heute = utcTag(jetzt)
  const messtag = letzterMesstag(messungen)
  const hinweisFuer = (m: Messung | null, leer: string): string | null =>
    m === null ? leer : messtag !== null && m.tag < messtag ? BETRIEB_TEXT.standVom(formatTagKurz(m.tag)) : null

  const bilder = letzter(messungen, 'bilderBytes')
  const dateien = letzter(messungen, 'bilderDateien')
  const bilderAnteil = bilder ? anteil(bilder.wert, GRENZE.bilderBytes) : null
  const bilderTrend = trendZeile(reihe(messungen, 'bilderBytes'), GRENZE.bilderBytes, heute)

  const db = letzter(messungen, 'datenbankBytes')
  const dbAnteil = db ? anteil(db.wert, GRENZE.datenbankBytes) : null
  const dbTrend = trendZeile(reihe(messungen, 'datenbankBytes'), GRENZE.datenbankBytes, heute)

  const mailsHeute = messungen.find((m) => m.art === 'mails' && m.tag === heute)?.wert ?? 0
  const mailsMonat = mailsImMonatBis(messungen, heute)
  const mailsAnteil = anteil(mailsHeute, GRENZE.mailsTag)
  const mailsMonatAnteil = anteil(mailsMonat, GRENZE.mailsMonat)

  const vorgaenge = letzter(messungen, 'bildVorgaengeMonat')
  // Ein Monatswert aus dem Vormonat gilt nicht mehr.
  const vorgaengeHeute = vorgaenge && vorgaenge.tag.slice(0, 7) === heute.slice(0, 7) ? vorgaenge : null
  const uploads = letzter(messungen, 'bilderUploadsMonat')
  const uploadsImMonat = uploads && uploads.tag.slice(0, 7) === heute.slice(0, 7) ? uploads.wert : 0
  const vorgaengeAnteil = vorgaengeHeute ? anteil(vorgaengeHeute.wert, GRENZE.bildVorgaengeMonat) : null

  return [
    {
      id: 'bilder',
      titel: 'Bilder',
      untertitel: null,
      tarif: `Vercel ${TARIF_NAME[TARIFE.vercel]}`,
      wert: bilder ? speicherText(bilder.wert) : null,
      von: `von ${speicherText(GRENZE.bilderBytes)}`,
      anteil: bilderAnteil,
      prozent: bilderAnteil === null ? null : prozentText(bilderAnteil),
      warnt: bilderAnteil !== null && stufe(bilderAnteil) > 0,
      zeile: dateien ? `${bilderTrend} · ${formatZahl(dateien.wert)} Dateien` : bilderTrend,
      satz: `Bei ${speicherText(GRENZE.bilderBytes)} sperrt Vercel alle Bilder für 30 Tage.`,
      kurz: `${bilderTrend}. Bei ${speicherText(GRENZE.bilderBytes)} sperrt Vercel alle Bilder für 30 Tage.`,
      hinweis: hinweisFuer(bilder, BETRIEB_TEXT.bilderOhneZugang),
    },
    {
      id: 'datenbank',
      titel: 'Datenbank',
      untertitel: null,
      tarif: `Supabase ${TARIF_NAME[TARIFE.supabase]}`,
      wert: db ? speicherText(db.wert) : null,
      von: `von ${speicherText(GRENZE.datenbankBytes)}`,
      anteil: dbAnteil,
      prozent: dbAnteil === null ? null : prozentText(dbAnteil),
      warnt: dbAnteil !== null && stufe(dbAnteil) > 0,
      zeile: dbTrend,
      satz: `Bei ${speicherText(GRENZE.datenbankBytes)} nur noch lesbar – keine neuen Bestellungen.`,
      kurz: `${dbTrend}. Bei ${speicherText(GRENZE.datenbankBytes)} nur noch lesbar.`,
      hinweis: hinweisFuer(db, BETRIEB_TEXT.nochNichtGemessen),
    },
    {
      id: 'mailsHeute',
      titel: 'E-Mails heute',
      untertitel: 'Resend-Tag ab 0 Uhr UTC',
      tarif: `Resend ${TARIF_NAME[TARIFE.resend]}`,
      wert: formatZahl(mailsHeute),
      von: `von ${formatZahl(GRENZE.mailsTag)}`,
      anteil: mailsAnteil,
      prozent: prozentText(mailsAnteil),
      warnt: stufe(mailsAnteil) > 0 || stufe(mailsMonatAnteil) > 0,
      zeile: `Monat: ${formatZahl(mailsMonat)} von ${formatZahl(GRENZE.mailsMonat)} (${prozentText(mailsMonatAnteil)}) · zählt je Empfänger`,
      satz: GRENZ_TEXT.mailsTag.voll,
      kurz: `Monat ${formatZahl(mailsMonat)} von ${formatZahl(GRENZE.mailsMonat)} · zählt je Empfänger.`,
      hinweis: null,
    },
    {
      id: 'bildVorgaenge',
      titel: 'Bild-Vorgänge',
      untertitel: null,
      tarif: `Vercel ${TARIF_NAME[TARIFE.vercel]}`,
      wert: vorgaengeHeute ? `≈ ${formatZahl(vorgaengeHeute.wert)}` : null,
      von: `von ${formatZahl(GRENZE.bildVorgaengeMonat)} im Monat`,
      anteil: vorgaengeAnteil,
      prozent: vorgaengeAnteil === null ? null : prozentText(vorgaengeAnteil),
      warnt: vorgaengeAnteil !== null && stufe(vorgaengeAnteil) > 0,
      zeile: `${formatZahl(uploadsImMonat)} Fotos hochgeladen · jedes zählt doppelt (Original + fertiges Bild)`,
      satz: `Ein Blick in den Speicher im Vercel-Dashboard zählt auch. Bei ${formatZahl(GRENZE.bildVorgaengeMonat)}: Bilder 30 Tage gesperrt.`,
      kurz: 'Jedes Foto zählt doppelt; das Vercel-Dashboard auch.',
      hinweis: vorgaengeHeute ? hinweisFuer(vorgaengeHeute, BETRIEB_TEXT.bilderOhneZugang) : BETRIEB_TEXT.bilderOhneZugang,
    },
  ]
}

export type VerlaufLinie = { id: 'bilder' | 'datenbank' | 'mailsMonat'; name: string; punkte: Array<{ tag: string; prozent: number }> }

/** Der Verlauf von 90 Tagen in % der Grenze — Bilder, Datenbank, E-Mails im Monat (laufende Summe je Tag). */
export function betriebVerlauf(messungen: readonly Messung[], jetzt: Date): { von: string; bis: string; linien: VerlaufLinie[] } {
  const bis = utcTag(jetzt)
  const von = utcTagVersetzt(bis, -(VERLAUF_TAGE - 1))
  const imFenster = (tag: string): boolean => tag >= von && tag <= bis
  const prozentReihe = (art: BetriebArt, grenze: number): Array<{ tag: string; prozent: number }> =>
    reihe(messungen, art)
      .filter((p) => imFenster(p.tag))
      .sort((a, b) => a.tag.localeCompare(b.tag))
      .map((p) => ({ tag: p.tag, prozent: anteil(p.wert, grenze) }))
  const mailTage = [...new Set(messungen.filter((m) => m.art === 'mails' && imFenster(m.tag)).map((m) => m.tag))].sort()
  return {
    von,
    bis,
    linien: [
      { id: 'bilder', name: 'Bilder', punkte: prozentReihe('bilderBytes', GRENZE.bilderBytes) },
      { id: 'datenbank', name: 'Datenbank', punkte: prozentReihe('datenbankBytes', GRENZE.datenbankBytes) },
      { id: 'mailsMonat', name: 'E-Mails im Monat', punkte: mailTage.map((tag) => ({ tag, prozent: anteil(mailsImMonatBis(messungen, tag), GRENZE.mailsMonat) })) },
    ],
  }
}

/** Der Tag als Stelle auf der Zeitachse des Verlaufs (0 = erster Tag des Fensters). */
export function verlaufIndex(von: string, tag: string): number {
  return tageZwischen(von, tag)
}

/**
 * Die Beschriftung der Zeitachse: der erste Tag, jeder Monatserste (mit
 * mindestens einer Woche Abstand zu den Rändern) und „heute“. Monatsnamen
 * fest aus MONAT_KURZ, nie über Intl (CODING_STANDARDS „Tage und Wochen“).
 */
export function verlaufAchse(von: string, bis: string): Array<{ index: number; text: string }> {
  const beschriftung = (tag: string): string => `${Number(tag.slice(8, 10))}. ${MONAT_KURZ[Number(tag.slice(5, 7)) - 1]}`
  const achse = [{ index: 0, text: beschriftung(von) }]
  for (let tag = utcTagVersetzt(von, 1); tag < bis; tag = utcTagVersetzt(tag, 1)) {
    if (tag.endsWith('-01') && tageZwischen(von, tag) >= 7 && tageZwischen(tag, bis) >= 7) achse.push({ index: tageZwischen(von, tag), text: beschriftung(tag) })
  }
  achse.push({ index: tageZwischen(von, bis), text: 'heute' })
  return achse
}

/** „Bilder 58 → 82 %, Datenbank 8 → 9 %“ — die Zeile des zugeklappten Verlaufs am Handy. */
export function verlaufKurz(linien: readonly VerlaufLinie[]): string {
  const teile = linien
    .filter((l) => l.id !== 'mailsMonat' && l.punkte.length > 0)
    .map((l) => `${l.name} ${formatZahl(Math.floor(l.punkte[0].prozent))} → ${prozentText(l.punkte[l.punkte.length - 1].prozent)}`)
  return teile.length > 0 ? teile.join(', ') : BETRIEB_TEXT.verlaufLeer
}

/** Das aria-label des Verlaufs: die Werte von heute. */
export function verlaufBeschreibung(linien: readonly VerlaufLinie[]): string {
  const heute = linien.map((l) => (l.punkte.length > 0 ? `${l.name} ${prozentText(l.punkte[l.punkte.length - 1].prozent)}` : `${l.name} nicht gemessen`))
  return `${BETRIEB_TEXT.verlaufTitel}, ${BETRIEB_TEXT.verlaufSatz}. Zuletzt: ${heute.join(', ')}.`
}

export type AblaufZeile = {
  name: AblaufName
  text: string
  wann: string
  zuletzt: string
  dauer: string
  stand: AblaufStand
}

export function ablaufZeilen(laeufe: ReadonlyMap<string, AblaufLaufDaten>, jetzt: Date): AblaufZeile[] {
  return ABLAEUFE.map((a) => {
    const lauf = laeufe.get(a.name) ?? null
    return {
      name: a.name,
      text: a.text,
      wann: wannText(a, jetzt),
      zuletzt: lauf ? zuletztText(lauf.gestartetAm, jetzt) : '–',
      dauer: lauf ? dauerText(lauf.dauerMs) : '–',
      stand: ablaufStand(a, lauf, jetzt),
    }
  })
}

export type WarnEintrag = { art: string; titel: string; saetze: string[] }

/**
 * Die Warnkarte: jede Warnung mit Stufe > 0 (Grenzwert mit dem Anteil von
 * heute, Ablauf mit seinem Stand), dazu — nur in der Produktion, wie die
 * Prüfung selbst — jeder überfällige Ablauf ohne Warnzeile. Höhere Stufe zuerst.
 */
export function warnEintraege(
  warnungen: ReadonlyArray<{ art: string; stufe: number; gemeldetAm: Date }>,
  kacheln: readonly Kachel[],
  zeilen: readonly AblaufZeile[],
  messungen: readonly Messung[],
  jetzt: Date,
  produktion: boolean
): WarnEintrag[] {
  const anteilVon = (wert: GrenzWert): number | null => {
    if (wert === 'bilder') return kacheln.find((k) => k.id === 'bilder')?.anteil ?? null
    if (wert === 'datenbank') return kacheln.find((k) => k.id === 'datenbank')?.anteil ?? null
    if (wert === 'bildVorgaenge') return kacheln.find((k) => k.id === 'bildVorgaenge')?.anteil ?? null
    if (wert === 'mailsMonat') return anteil(mailsImMonatBis(messungen, utcTag(jetzt)), GRENZE.mailsMonat)
    const gestern = utcTagVersetzt(utcTag(jetzt), -1)
    return anteil(messungen.find((m) => m.art === 'mails' && m.tag === gestern)?.wert ?? 0, GRENZE.mailsTag)
  }
  const mailSatz = (am: Date): string =>
    kalendertagInWien(am) === kalendertagInWien(jetzt) ? BETRIEB_TEXT.warnMail(uhrzeitInWien(am)) : BETRIEB_TEXT.warnMailAm(zuletztText(am, jetzt))

  const offen = warnungen.filter((w) => w.stufe > 0).sort((a, b) => warnRang(a.art, a.stufe) - warnRang(b.art, b.stufe))
  const eintraege: WarnEintrag[] = []
  for (const w of offen) {
    if ((GRENZ_WERTE as readonly string[]).includes(w.art)) {
      const wert = w.art as GrenzWert
      const a = anteilVon(wert)
      const text = GRENZ_TEXT[wert]
      eintraege.push({
        art: w.art,
        titel: a === null ? warnHinweis(w.art, w.stufe).text : grenzTitel(wert, a),
        saetze: [text.voll, ...(text.hilft ? [`${BETRIEB_MAIL_TEXT.hilft} ${text.hilft}`] : []), mailSatz(w.gemeldetAm)],
      })
    } else {
      const zeile = zeilen.find((z) => ablaufWarnArt(z.name) === w.art)
      eintraege.push({
        art: w.art,
        titel: zeile ? `Ablauf „${zeile.text}“ ${zeile.stand === 'fehler' ? 'gescheitert' : zeile.stand === 'ueberfaellig' ? 'überfällig' : 'ausgefallen'}` : warnHinweis(w.art, w.stufe).text,
        saetze: [mailSatz(w.gemeldetAm)],
      })
    }
  }
  for (const z of produktion ? zeilen : []) {
    if (z.stand === 'ueberfaellig' && !eintraege.some((e) => e.art === ablaufWarnArt(z.name))) {
      eintraege.push({ art: ablaufWarnArt(z.name), titel: `Ablauf „${z.text}“ überfällig`, saetze: [`Zuletzt ${z.zuletzt}; ${z.wann}.`] })
    }
  }
  return eintraege
}

// ─── Warn-Mail ───────────────────────────────────────────────────────────────

/** Woraus eine Warn-Mail entsteht — nur Zahlen und Namen aus den festen Listen, keine Personendaten. */
export type BetriebMailAnlass =
  | { art: 'grenze'; wert: GrenzWert; anteil: number; stand: string; trend: string | null }
  | { art: 'entwarnung'; wert: GrenzWert; anteil: number; stand: string }
  | { art: 'ablauf'; name: AblaufName; stand: 'ueberfaellig' | 'fehler'; zuletzt: string | null; stundenSeit: number | null; wann: string }
  | { art: 'ablaufWieder'; name: AblaufName }

export type BetriebMail = { betreff: string; titel: string; absaetze: string[]; hilft: string | null; knopf: string; fuss: string }

/** Die festen Wörter der Warn-Mail (Mockup email-betrieb-warnung). */
export const BETRIEB_MAIL_TEXT = { kopf: 'Betrieb', hilft: 'Was hilft:', knopf: 'Betrieb ansehen' } as const

const FUSS_SPEICHER = `Diese Mail kommt einmal je Stufe (80 %, 95 %, voll) und noch einmal, wenn der Wert wieder unter ${ENTWARNUNG_UNTER} % liegt. Abschalten lässt sie sich nicht – es geht um den Betrieb der Plattform.`
const FUSS_MONAT = 'Diese Mail kommt einmal je Stufe (80 %, 95 %, voll) und Monat; der neue Monat beginnt still bei 0. Abschalten lässt sie sich nicht – es geht um den Betrieb der Plattform.'
const FUSS_TAG = 'Dieser Hinweis kommt höchstens einmal am Morgen, wenn der Vortag 80 % erreicht hat. Abschalten lässt er sich nicht – es geht um den Betrieb der Plattform.'
const FUSS_ABLAUF = 'Höchstens eine Mail je Ablauf und Tag. Sobald er wieder läuft, kommt eine kurze Entwarnung.'

function ablaufVon(name: AblaufName): Ablauf {
  const ablauf = ABLAEUFE.find((a) => a.name === name)
  // Der Typ AblaufName ist genau die Liste der Namen; ein Fund ist sicher.
  return ablauf ?? ABLAEUFE[0]
}

/** Betreff und Sätze der Warn-Mail (Mockup email-betrieb-warnung) — die Vorlage rendert nur. */
export function betriebMail(anlass: BetriebMailAnlass): BetriebMail {
  const knopf = BETRIEB_MAIL_TEXT.knopf
  if (anlass.art === 'grenze') {
    const text = GRENZ_TEXT[anlass.wert]
    const titel = grenzTitel(anlass.wert, anlass.anteil)
    const regel = GRENZ_REGEL[anlass.wert]
    return {
      betreff: `Betrieb: ${titel}`,
      titel,
      absaetze: [`${anlass.stand}${anlass.trend ? `, ${anlass.trend}` : ''}. ${text.voll}`],
      hilft: text.hilft,
      knopf,
      fuss: regel === 'speicher' ? FUSS_SPEICHER : regel === 'monat' ? FUSS_MONAT : FUSS_TAG,
    }
  }
  if (anlass.art === 'entwarnung') {
    const name = GRENZ_TEXT[anlass.wert].name
    return {
      betreff: `Betrieb: ${name} wieder bei ${prozentText(anlass.anteil)}`,
      titel: `Entwarnung: ${name} bei ${prozentText(anlass.anteil)}`,
      absaetze: [`${anlass.stand} – wieder unter ${ENTWARNUNG_UNTER} %. Bis zur nächsten Stufe kommt keine Mail mehr.`],
      hilft: null,
      knopf,
      fuss: FUSS_SPEICHER,
    }
  }
  const ablauf = ablaufVon(anlass.name)
  if (anlass.art === 'ablaufWieder') {
    return {
      betreff: `Betrieb: Ablauf „${ablauf.text}“ läuft wieder`,
      titel: 'Der Ablauf läuft wieder',
      absaetze: [`„${ablauf.text}“ hat sich wieder gemeldet und ist durchgelaufen.`],
      hilft: null,
      knopf,
      fuss: FUSS_ABLAUF,
    }
  }
  const zuletzt = anlass.zuletzt ? ` (zuletzt ${anlass.zuletzt})` : ''
  const satz =
    anlass.stand === 'ueberfaellig'
      ? `„${ablauf.text}“ läuft ${anlass.wann} und hat sich seit ${anlass.stundenSeit ?? 'über 26'} Stunden nicht gemeldet${zuletzt}.`
      : `„${ablauf.text}“ läuft ${anlass.wann} und ist beim letzten Lauf gescheitert${zuletzt}. Die Fehlerklasse steht in Sentry, ohne Inhalt.`
  return {
    betreff: `Betrieb: Ablauf „${ablauf.text}“ ist ${anlass.stand === 'ueberfaellig' ? 'überfällig' : 'gescheitert'}`,
    titel: anlass.stand === 'ueberfaellig' ? 'Ein Ablauf ist nicht gelaufen' : 'Ein Ablauf ist gescheitert',
    absaetze: [`${satz} ${ablauf.zweck}`],
    hilft: null,
    knopf,
    fuss: FUSS_ABLAUF,
  }
}

/** „838 MB von 1 GB sind belegt“ bzw. „412 von 3.000 E-Mails“ — der Stand im ersten Satz der Mail. */
export function grenzStandText(wert: GrenzWert, zahl: number): string {
  if (wert === 'bilder') return `${speicherText(zahl)} von ${speicherText(GRENZE.bilderBytes)} sind belegt`
  if (wert === 'datenbank') return `${speicherText(zahl)} von ${speicherText(GRENZE.datenbankBytes)} sind belegt`
  if (wert === 'mailsMonat') return `${formatZahl(zahl)} von ${formatZahl(GRENZE.mailsMonat)} E-Mails in diesem Monat`
  if (wert === 'bildVorgaenge') return `≈ ${formatZahl(zahl)} von ${formatZahl(GRENZE.bildVorgaengeMonat)} Bild-Vorgängen in diesem Monat`
  return `${formatZahl(zahl)} von ${formatZahl(GRENZE.mailsTag)} E-Mails gestern`
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

/** Alle Messungen als CSV (UTF-8 mit BOM, Semikolon wie Admin › Finanzen) — nur Tag, Art, Zahl. */
export function messungenAlsCsv(messungen: ReadonlyArray<Pick<Messung, 'tag' | 'art' | 'wert'>>): string {
  const zeilen = [['Tag', 'Art', 'Wert'], ...[...messungen].sort((a, b) => a.tag.localeCompare(b.tag) || a.art.localeCompare(b.art)).map((m) => [m.tag, m.art, String(m.wert)])]
  return `\uFEFF${zeilen.map((z) => z.join(';')).join('\r\n')}\r\n`
}
