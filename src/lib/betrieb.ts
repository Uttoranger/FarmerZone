/**
 * Admin › Betrieb (Register N18 neu, N15 geändert; Nachtlauf Nr. 103): was die
 * Plattform im Hintergrund braucht — Bilder-Speicher, Datenbank, E-Mails und
 * Bild-Vorgänge gegen die Grenze des Tarifs, die Abläufe mit ihrem letzten
 * Lauf, Warnstufen und die Texte von Seite und Warn-Mail. EINE Quelle für
 * Tarife, Grenzen, Arten und Abläufe; rein, ohne Datenbank prüfbar
 * (tests/betrieb.test.ts). `jetzt` ist immer ein Parameter. Seit Nr. 113:
 * Vercel Pro (Bilder ohne feste Grenze), die Regel des Lebenszeichens
 * (`fehlendeAblaeufe`) und die Vercel-Ausgaben aus Spend Management.
 *
 * Tage: Gespeichert wird je UTC-Tag (Resend zählt den Tag ab 0 Uhr UTC, und
 * eine Messung zwischen 0 und 2 Uhr Wiener Zeit schreibt so nie in den
 * Vortag); angezeigt werden Uhrzeiten in Wiener Zeit.
 *
 * Wörter nur aus der Wortliste: Betrieb, Grenze, Ablauf, Bilder ohne
 * Verwendung, Lebenszeichen (nicht Monitoring, Quota, Cron, Job, Heartbeat);
 * der Name nur aus MARKE.
 */
import { MONAT_KURZ, formatDezimal, formatDollar, formatTagKurz, formatZahl } from '@/lib/format'
import { kalendertagInWien } from '@/lib/wiener-tag'
import { tagVersetzt } from '@/lib/kalender'
import { uhrzeitInWien } from '@/lib/fristen'
import { MARKE } from '@/lib/marke'
import type { MarkeArt } from '@/lib/marke-art'
import { AUFBEWAHRUNG_TAGE as MELDUNG_AUFBEWAHRUNG_TAGE } from '@/lib/meldung'
import { STARTSEITE_ORIGINAL_PREFIX, STARTSEITE_ZIEL_PREFIX, type UploadZweck } from '@/lib/upload-pfade'

// ─── Tarife und Grenzen ──────────────────────────────────────────────────────

/** Die Namen der Tarife, wie sie auf der Seite stehen. */
const TARIF_NAME: Record<'HOBBY' | 'PRO' | 'FREE', string> = { HOBBY: 'Hobby', PRO: 'Pro', FREE: 'Free' }

/*
 * Grenzen je Tarif. Speicher in Dezimal-Einheiten (1 GB = 10⁹ Bytes, 1 MB =
 * 10⁶): Ob ein Dienst binär zählt, sagt er nicht eindeutig — die kleinere Zahl
 * warnt früher, nie später. `null` = keine feste Grenze: Bei Vercel Pro ist
 * der Bild-Speicher nutzungsbasiert (bezahlt aus dem Pro-Guthaben, darüber
 * zählt er zum Ausgabenlimit aus Spend Management; Nr. 113).
 *
 * Supabase Pro (Stand 24.10.2026, supabase.com/pricing): 8 GB Speicher je
 * Projekt inklusive, darüber wächst er automatisch und kostet je GB extra;
 * 250 GB Übertragung im Monat inklusive; tägliche Sicherung, 7 Tage
 * aufbewahrt; keine Pause. Die 8 GB bleiben die Grenze der Warnstufen — ab da
 * kostet es Geld, gesperrt wird nichts.
 *
 * Resend Pro (Stand 24.10.2026, resend.com/pricing): keine Tagesgrenze
 * (`mailsTag: null` — keine Prozent, keine Tageswarnung), 50.000 im Monat.
 */
export const GRENZEN = {
  vercel: {
    HOBBY: { bilderBytes: 1_000_000_000, bildVorgaengeMonat: 2_000, uebertragungBytesMonat: 10_000_000_000 },
    PRO: { bilderBytes: null, bildVorgaengeMonat: null, uebertragungBytesMonat: null },
  },
  supabase: {
    FREE: { datenbankBytes: 500_000_000, uebertragungBytesMonat: 5_000_000_000 },
    PRO: { datenbankBytes: 8_000_000_000, uebertragungBytesMonat: 250_000_000_000 },
  },
  resend: {
    FREE: { mailsTag: 100, mailsMonat: 3_000 },
    PRO: { mailsTag: null, mailsMonat: 50_000 },
  },
} as const

/** Je Dienst ein Tarif aus GRENZEN. */
export type Tarife = { vercel: keyof typeof GRENZEN.vercel; supabase: keyof typeof GRENZEN.supabase; resend: keyof typeof GRENZEN.resend }

/**
 * Die Tarife der Dienste (Stand 24.10.2026: Vercel Pro seit 19.10., Supabase
 * Pro seit 24.10.). Nach einem Tarifwechsel NUR hier ändern. Resend bleibt
 * Free, bis die Projektleitung umstellt — dann genügt `resend: 'PRO'`.
 */
export const TARIFE: Tarife = { vercel: 'PRO', supabase: 'PRO', resend: 'FREE' }

/** Die Grenzen eines Tarifs: daran misst die Seite, daran warnt die Mail. null = keine feste Grenze (keine Prozente, keine Warnstufe). */
export type Grenze = {
  bilderBytes: number | null
  bildVorgaengeMonat: number | null
  bildUebertragungBytesMonat: number | null
  datenbankBytes: number
  datenbankUebertragungBytesMonat: number
  mailsTag: number | null
  mailsMonat: number
}

/** Die Grenzen zu Tarifen — ein Parameter, damit die Texte jedes Tarifs ohne Umschalten prüfbar sind. */
export function grenzeFuer(tarife: Tarife): Grenze {
  const vercel = GRENZEN.vercel[tarife.vercel]
  const supabase = GRENZEN.supabase[tarife.supabase]
  const resend = GRENZEN.resend[tarife.resend]
  return {
    bilderBytes: vercel.bilderBytes,
    bildVorgaengeMonat: vercel.bildVorgaengeMonat,
    bildUebertragungBytesMonat: vercel.uebertragungBytesMonat,
    datenbankBytes: supabase.datenbankBytes,
    datenbankUebertragungBytesMonat: supabase.uebertragungBytesMonat,
    mailsTag: resend.mailsTag,
    mailsMonat: resend.mailsMonat,
  }
}

/** Die Grenzen der Tarife von heute. */
export const GRENZE: Grenze = grenzeFuer(TARIFE)

/** Der Satz statt Prozent und Balken, wo der Tarif keine feste Grenze kennt (Nr. 113). */
const OHNE_GRENZE = `nutzungsbasiert (${TARIF_NAME.PRO}) – zählt zum Ausgabenlimit`
/** Was bei Vercel Pro statt einer Sperre droht (Spend Management, Nr. 113). */
const OHNE_SPERRE = 'Keine Sperre bei einer Menge – erst bei 100 % des Ausgabenlimits pausiert Vercel das Projekt.'

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
  // Bilder ohne Verwendung (Nr. 104): je Gruppe Bytes und Dateien, dazu die älteste Datei (ms seit 1970) — nur in der Produktion gemessen.
  'ohneVerwendung:produktfotos:bytes',
  'ohneVerwendung:produktfotos:dateien',
  'ohneVerwendung:galerie:bytes',
  'ohneVerwendung:galerie:dateien',
  'ohneVerwendung:titelbilder:bytes',
  'ohneVerwendung:titelbilder:dateien',
  'ohneVerwendung:logos:bytes',
  'ohneVerwendung:logos:dateien',
  'ohneVerwendung:beitragsfotos:bytes',
  'ohneVerwendung:beitragsfotos:dateien',
  'ohneVerwendung:meldungen:bytes',
  'ohneVerwendung:meldungen:dateien',
  'ohneVerwendung:originale:bytes',
  'ohneVerwendung:originale:dateien',
  'ohneVerwendung:unbekannterHof:bytes',
  'ohneVerwendung:unbekannterHof:dateien',
  'ohneVerwendung:startseite:bytes',
  'ohneVerwendung:startseite:dateien',
  'ohneVerwendung:aelteste',
  // Vercel-Ausgaben (Nr. 113): was Spend Management zuletzt gemeldet hat, in ganzen Cent (aus Dollar) — Ausgaben und Limit.
  'vercelAusgaben',
  'vercelLimit',
] as const
export type BetriebArt = (typeof BETRIEB_ARTEN)[number]

/** Was nur `messeBetrieb` schreibt — daraus „Gemessen heute, hh:mm“ (der Mail-Zähler ist keine Messung). */
export const MESS_ARTEN = ['bilderBytes', 'bilderDateien', 'bilderUploadsMonat', 'bildVorgaengeMonat', 'datenbankBytes'] as const satisfies readonly BetriebArt[]

/**
 * Der Merker „eine Messung hat begonnen“ (Nr. 113): eine Zeile je UTC-Tag in
 * BetriebMessung, die „Jetzt messen“ in EINER Anweisung belegt. Bewusst nicht
 * in BETRIEB_ARTEN — er ist kein Messwert, Seite und CSV lassen ihn weg.
 */
export const MESS_BEGINN_ART = 'messBeginn'

/** „Jetzt messen“ misst nicht neu, wenn die letzte Messung jünger ist (jede Messung listet den Bild-Speicher). */
export const NEU_MESSEN_AB_MS = 10 * 60 * 1000

/** Ab wann eine Messung „jung“ ist: Begann eine nach diesem Zeitpunkt, misst „Jetzt messen“ nicht neu — genau 10 Minuten danach wieder. */
export function neuMessenAb(jetzt: Date): Date {
  return new Date(jetzt.getTime() - NEU_MESSEN_AB_MS)
}

// ─── Aufbewahrung: was der Ablauf „Aufräumen“ löscht (Register N18, Nr. 104) ──

/** So lange bleiben Messungen; danach löscht sie der Ablauf „Aufräumen“. */
export const MESSUNGEN_AUFBEWAHREN_TAGE = 400
/** Abgelaufene Sitzungen (tragen IP-Adresse und Browserangabe) bleiben so viele Tage nach ihrem Ablauf — eine gültige nie. */
export const SITZUNGEN_NACH_ABLAUF_TAGE = 7
/** Abgelaufene Anmelde- und Bestätigungscodes bleiben so viele Tage nach ihrem Ablauf. */
export const CODES_NACH_ABLAUF_TAGE = 1
/**
 * Webhook-Ereignisse bleiben so lange: Sie halten Stripe-Ereignisse nur
 * davon ab, doppelt verarbeitet zu werden, und Stripe wiederholt ein
 * Ereignis höchstens drei Tage lang. Die Melde-Vermerke (MELDE_VERMERK_TYP)
 * bleiben immer — sie verhindern eine zweite Mail „Erstattung gescheitert“.
 */
export const WEBHOOK_EREIGNISSE_AUFBEWAHREN_TAGE = 30
/** Ein Bild ohne Verwendung kommt erst ab diesem Alter in die Liste — ein jüngeres kann noch in einem offenen Formular hängen. */
export const BILDER_OHNE_VERWENDUNG_AB_TAGE = 7

const TAG_MS = 24 * 60 * 60 * 1000

export type AufraeumGrenzen = { sitzungen: Date; codes: Date; webhookEreignisse: Date; messungen: Date }

/**
 * Die festen Grenzen des Aufräumens: gelöscht wird, was VOR der Grenze liegt
 * (Sitzungen und Codes nach `expiresAt`, Webhook-Ereignisse nach `createdAt`,
 * Messungen nach ihrem UTC-Tag). Genau an der Grenze bleibt eine Zeile.
 */
export function aufraeumGrenzen(jetzt: Date): AufraeumGrenzen {
  const vor = (tage: number): Date => new Date(jetzt.getTime() - tage * TAG_MS)
  return {
    sitzungen: vor(SITZUNGEN_NACH_ABLAUF_TAGE),
    codes: vor(CODES_NACH_ABLAUF_TAGE),
    webhookEreignisse: vor(WEBHOOK_EREIGNISSE_AUFBEWAHREN_TAGE),
    messungen: new Date(`${utcTagVersetzt(utcTag(jetzt), -MESSUNGEN_AUFBEWAHREN_TAGE)}T00:00:00.000Z`),
  }
}

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

/** Beginn eines Abrechnungszeitraums, der am `tag` jedes Monats um 0 Uhr UTC beginnt: dieser Monat, davor der Vormonat. */
function zeitraumBeginnAm(jetzt: Date, tag: number): Date {
  const jahr = jetzt.getUTCFullYear()
  const monat = jetzt.getUTCMonth()
  const diesen = Date.UTC(jahr, monat, tag)
  // Date.UTC rechnet Monat −1 ins Vorjahr um (Januar → Dezember).
  return new Date(jetzt.getTime() >= diesen ? diesen : Date.UTC(jahr, monat - 1, tag))
}

/**
 * Der Tag, an dem bei Resend ein neuer Abrechnungszeitraum beginnt (Register
 * N18, Ergänzung 24.10.2026): Der Monat der E-Mails läuft vom 17. zum 17.,
 * nicht im Kalendermonat. Resend beginnt zur Uhrzeit des Vertragsbeginns
 * (heute 20:23 UTC); 0 Uhr UTC zählt die Stunden davor schon zum neuen
 * Zeitraum — die Warnung kommt so früher, nie später.
 */
export const RESEND_ABRECHNUNG_TAG = 17

/** Beginn des laufenden Abrechnungszeitraums bei Resend: der 17. dieses Monats, vor dem 17. der des Vormonats (0 Uhr UTC). */
export function resendAbrechnungsBeginn(jetzt: Date): Date {
  return zeitraumBeginnAm(jetzt, RESEND_ABRECHNUNG_TAG)
}

/** Ende des laufenden Abrechnungszeitraums bei Resend (ausschließlich): der Beginn des nächsten. */
export function resendAbrechnungsEnde(jetzt: Date): Date {
  const beginn = resendAbrechnungsBeginn(jetzt)
  return new Date(Date.UTC(beginn.getUTCFullYear(), beginn.getUTCMonth() + 1, RESEND_ABRECHNUNG_TAG))
}

/**
 * Wo der Monat eines Werts beginnt: E-Mails im Abrechnungszeitraum von Resend,
 * alles andere (Bild-Vorgänge, eigene Auflistungen) im Kalendermonat.
 */
export function monatsBeginn(art: 'mails' | 'mailsMonat' | 'bildVorgaenge' | 'bilderAuflistungen', jetzt: Date): Date {
  return art === 'mails' || art === 'mailsMonat' ? resendAbrechnungsBeginn(jetzt) : utcMonatsbeginn(jetzt)
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
  const z = zuwachsImFenster(verlauf, heute)
  if (z === null) return null
  const { zuwachs, tage, letzter } = z
  if (letzter.wert >= grenze) return { zuwachs, tage, vollIn: { art: 'voll' } }
  const jeTag = zuwachs / tage
  if (jeTag <= 0) return { zuwachs, tage, vollIn: { art: 'mehrAls5Jahre' } }
  const rest = Math.ceil((grenze - letzter.wert) / jeTag)
  return { zuwachs, tage, vollIn: rest > FUENF_JAHRE_TAGE ? { art: 'mehrAls5Jahre' } : { art: 'tage', tage: rest } }
}

/** Zuwachs vom ältesten zum jüngsten Messpunkt der letzten 30 Tage — ohne zwei Messtage null. Auch für Werte ohne feste Grenze (Vercel Pro). */
function zuwachsImFenster(verlauf: readonly VerlaufPunkt[], heute: string): { zuwachs: number; tage: number; letzter: VerlaufPunkt } | null {
  const ab = utcTagVersetzt(heute, -TREND_TAGE)
  const fenster = verlauf.filter((p) => p.tag >= ab && p.tag <= heute).sort((a, b) => a.tag.localeCompare(b.tag))
  if (fenster.length < 2) return null
  const erster = fenster[0]
  const letzter = fenster[fenster.length - 1]
  const tage = tageZwischen(erster.tag, letzter.tag)
  if (tage < 1) return null
  return { zuwachs: letzter.wert - erster.wert, tage, letzter }
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
 * Die Abläufe aus vercel.json (Vercel Pro seit 19.10.2026: Start in der
 * genannten Minute; unter Hobby waren es höchstens täglich und irgendwann in
 * der Stunde). Der Wochenlauf heißt nach der Wortliste „Wochenbericht
 * (Postfach)“ — das alte Wort steht in keinem Nutzertext mehr (Register N12).
 */
export const ABLAEUFE: readonly Ablauf[] = [
  {
    name: 'aufraeumen',
    text: 'Aufräumen',
    zweck: 'Er räumt abgelaufene Reservierungen, alte Zähler der Bremse, abgelaufene Sitzungen und Codes, alte Webhook-Ereignisse und alte Messungen weg.',
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
 * Ab wann ein Ablauf überfällig ist, gemessen vom letzten Start: täglich
 * 26 h, wöchentlich 8 Tage. Vercel Pro startet in der genannten Minute; die
 * zwei Stunden Spielraum (aus der Hobby-Zeit, als ein Lauf irgendwann in der
 * Stunde begann) fangen einen verzögerten Start ab, ohne Fehlalarm.
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

/**
 * Was das Lebenszeichen vermisst (Nr. 113): die Namen der Abläufe, die
 * überfällig oder gescheitert sind — gleiche Regel wie `ablaufStand` (täglich
 * 26 Stunden, wöchentlich 8 Tage). Fail-closed, strenger als die Seite: Ein
 * TÄGLICHER Ablauf ohne Zeile fehlt (er lief nie — genau der Ausfall, den
 * das Lebenszeichen melden soll); nur der wöchentliche hat ohne Zeile
 * Schonfrist, weil er nach dem Deploy bis Montag keine haben kann.
 */
export function fehlendeAblaeufe(laeufe: ReadonlyMap<string, AblaufLaufDaten>, jetzt: Date): AblaufName[] {
  return ABLAEUFE.filter((a) => {
    const stand = ablaufStand(a, laeufe.get(a.name) ?? null, jetzt)
    return stand === 'ueberfaellig' || stand === 'fehler' || (stand === 'nochKeinLauf' && a.rhythmus === 'taeglich')
  }).map((a) => a.name)
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

/** Die Grenze eines Werts im Tarif von heute — null = keine feste Grenze (Vercel Pro: Bilder, Bild-Vorgänge), dann gibt es keine Warnstufe. */
export function grenzeVon(wert: GrenzWert): number | null {
  if (wert === 'bilder') return GRENZE.bilderBytes
  if (wert === 'bildVorgaenge') return GRENZE.bildVorgaengeMonat
  if (wert === 'datenbank') return GRENZE.datenbankBytes
  if (wert === 'mailsMonat') return GRENZE.mailsMonat
  return GRENZE.mailsTag
}

/** Die Art der Warnung für die Vercel-Ausgaben (Nr. 113). */
export const VERCEL_WARN_ART = 'vercelAusgaben'

/** Der Schlüssel in BetriebWarnung: ein Grenzwert, `ablauf:<name>` oder die Vercel-Ausgaben. */
export type WarnArt = GrenzWert | `ablauf:${AblaufName}` | typeof VERCEL_WARN_ART

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
 * Ohne feste Grenze (`anteilProzent` null: Vercel Pro, Resend Pro je Tag)
 * gibt es keine Stufe: Eine noch offene aus dem alten Tarif geht still auf 0.
 * `monatsbeginn`: wo der Monat des Werts beginnt (`monatsBeginn` — bei den
 * E-Mails der Abrechnungszeitraum von Resend, Nr. 162).
 */
export function grenzSchritt(
  regel: GrenzRegel,
  bisher: WarnStand,
  anteilProzent: number | null,
  jetzt: Date,
  monatsbeginn: Date = utcMonatsbeginn(jetzt)
): WarnSchritt {
  const bisherStufe = bisher?.stufe ?? 0
  if (anteilProzent === null) return bisherStufe > 0 ? { tun: 'still' } : NICHTS
  const ziel = stufe(anteilProzent)
  if (regel === 'speicher') {
    if (anteilProzent < ENTWARNUNG_UNTER) return bisherStufe > 0 ? { tun: 'entwarnen' } : NICHTS
    return ziel > bisherStufe ? { tun: 'warnen', stufe: ziel as Exclude<Stufe, 0> } : NICHTS
  }
  if (regel === 'monat') {
    const imMonat = bisher !== null && bisher.gemeldetAm.getTime() >= monatsbeginn.getTime() ? bisherStufe : 0
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

// ─── Vercel-Ausgaben (Register N18, Nr. 113) ─────────────────────────────────

/** Der Tag im Monat, an dem bei Vercel ein neuer Abrechnungszeitraum beginnt (0 Uhr UTC). */
export const VERCEL_ABRECHNUNG_TAG = 19

/** Ab diesen Anteilen des Ausgabenlimits meldet Spend Management (in %): Stufe 1, 2, 3 — bei 100 % pausiert Vercel das Projekt. */
export const VERCEL_SCHWELLEN = [50, 75, 100] as const

/** Der Beginn des laufenden Abrechnungszeitraums: der 19. dieses Monats, vor dem 19. der des Vormonats (UTC). */
export function abrechnungsBeginn(jetzt: Date): Date {
  return zeitraumBeginnAm(jetzt, VERCEL_ABRECHNUNG_TAG)
}

/** Die Stufe einer Meldung von Spend Management: 50 % → 1, 75 % → 2, 100 % → 3, darunter keine. */
export function vercelStufe(schwelleProzent: number): Stufe {
  if (schwelleProzent >= VERCEL_SCHWELLEN[2]) return 3
  if (schwelleProzent >= VERCEL_SCHWELLEN[1]) return 2
  if (schwelleProzent >= VERCEL_SCHWELLEN[0]) return 1
  return 0
}

/**
 * Die Regel der Vercel-Ausgaben: je Abrechnungszeitraum einmal je Stufe
 * (wie die Monatswerte, nur mit dem 19. statt dem Ersten), keine Entwarnung;
 * der neue Zeitraum beginnt still bei 0. `ziel` 0 heißt: keine Meldung, nur
 * prüfen, ob eine alte Stufe still auf 0 muss (die tägliche Messung).
 */
export function vercelSchritt(bisher: WarnStand, ziel: Stufe, jetzt: Date): WarnSchritt {
  const bisherStufe = bisher?.stufe ?? 0
  const imZeitraum = bisher !== null && bisher.gemeldetAm.getTime() >= abrechnungsBeginn(jetzt).getTime() ? bisherStufe : 0
  if (ziel > imZeitraum) return { tun: 'warnen', stufe: ziel as Exclude<Stufe, 0> }
  return bisherStufe > 0 && imZeitraum === 0 ? { tun: 'still' } : NICHTS
}

/** „25,10 $ von 50 $ (50 %)“ — Ausgaben gegen das Limit. */
function ausgabenText(ausgabenCent: number, limitCent: number): string {
  return `${formatDollar(ausgabenCent)} von ${formatDollar(limitCent)} (${prozentText(anteil(ausgabenCent, limitCent))})`
}

// ─── Texte: Grenzwerte ───────────────────────────────────────────────────────

/**
 * Was Supabase je Tarif sagt — EINE Quelle für Kachel, Tarif-Zeile, Warnkarte
 * und Warn-Mail (Nr. 162). Free sperrt bei der Grenze (nur noch lesbar) und
 * pausiert ohne Zugriff; Pro wächst über die 8 GB hinaus und kostet ab dann
 * extra, sichert täglich und pausiert nie. Alle Zahlen aus GRENZEN.
 */
function supabaseTexte(tarif: Tarife['supabase']): {
  marke: string
  ton: MarkeArt
  satz: string
  kachel: string
  kachelKurz: string
  voll: string
  hilft: string
} {
  const g = GRENZEN.supabase[tarif]
  const speicher = speicherText(g.datenbankBytes)
  const uebertragung = speicherText(g.uebertragungBytesMonat)
  if (tarif === 'FREE') {
    return {
      marke: `${TARIF_NAME.FREE} · ohne Sicherung`,
      ton: 'tun',
      satz: `Datenbank ${speicher}, ${uebertragung} Übertragung. Pausiert nach 7 Tagen ohne Zugriff.`,
      kachel: `Bei ${speicher} nur noch lesbar – keine neuen Bestellungen.`,
      kachelKurz: `Bei ${speicher} nur noch lesbar.`,
      voll: `Bei ${speicher} ist die Datenbank nur noch lesbar – keine neuen Bestellungen.`,
      hilft: `Supabase ${TARIF_NAME.PRO} mit ${speicherText(GRENZEN.supabase.PRO.datenbankBytes)}.`,
    }
  }
  return {
    marke: `${TARIF_NAME.PRO} · tägliche Sicherung (7 Tage)`,
    ton: 'erledigt',
    satz: `Datenbank ${speicher} inklusive, ${uebertragung} Übertragung im Monat – darüber kostet es extra.`,
    kachel: `${speicher} inklusive, darüber wächst der Speicher automatisch und kostet extra.`,
    kachelKurz: `${speicher} inklusive, darüber kostet es extra.`,
    voll: `Bei ${speicher} ist der inklusive Speicher voll – die Datenbank wächst weiter und kostet ab dann extra.`,
    hilft: 'Unter „Größte Tabellen“ auf der Seite Betrieb steht, was wächst.',
  }
}

/** Der Satz, wenn der Tarif keine Tagesgrenze kennt (Resend Pro, Nr. 162). */
const OHNE_TAGESGRENZE = 'Keine Tagesgrenze – es zählt nur der Monat.'

export type GrenzText = { name: string; kurz: string; voll: string; hilft: string | null }

/**
 * Je Grenzwert: Name im Satz, Grenze als Text und was bei 100 % passiert —
 * für die Tarife `tarife` (Standard: die von heute). „Vercel Pro hilft“ gilt
 * nur, solange der Tarif eine Grenze hat — ohne Grenze gibt es für diese
 * Werte keine Warnung, die den Satz zeigte.
 */
export function grenzTexte(tarife: Tarife = TARIFE): Record<GrenzWert, GrenzText> {
  const grenze = grenzeFuer(tarife)
  const supabase = supabaseTexte(tarife.supabase)
  return {
    bilder: {
      name: 'Bilder-Speicher',
      kurz: 'Bilder',
      voll:
        grenze.bilderBytes === null
          ? OHNE_SPERRE
          : `Bei ${speicherText(grenze.bilderBytes)} sperrt Vercel alle Bilder für 30 Tage – Hofseiten und Produkte zeigen dann keine Fotos.`,
      hilft: 'Vercel Pro, dort gibt es keine harte Sperre.',
    },
    datenbank: { name: 'Datenbank', kurz: 'Datenbank', voll: supabase.voll, hilft: supabase.hilft },
    mailsMonat: {
      name: 'E-Mails im Monat',
      kurz: 'E-Mails',
      voll: `Bei ${formatZahl(grenze.mailsMonat)} im Monat geht bis zum ${RESEND_ABRECHNUNG_TAG}. keine E-Mail mehr hinaus.`,
      hilft: null,
    },
    bildVorgaenge: {
      name: 'Bild-Vorgänge im Monat',
      kurz: 'Bild-Vorgänge',
      voll: grenze.bildVorgaengeMonat === null ? OHNE_SPERRE : `Bei ${formatZahl(grenze.bildVorgaengeMonat)} im Monat sperrt Vercel alle Bilder für 30 Tage.`,
      hilft: 'Vercel Pro, dort gibt es keine harte Sperre.',
    },
    mailsTag: {
      name: 'E-Mails gestern',
      kurz: 'E-Mails',
      voll: grenze.mailsTag === null ? OHNE_TAGESGRENZE : `Bei ${formatZahl(grenze.mailsTag)} am Tag gehen weitere E-Mails erst nach 0 Uhr UTC hinaus.`,
      hilft: null,
    },
  }
}

/** Die Texte der Grenzwerte im Tarif von heute. */
export const GRENZ_TEXT: Record<GrenzWert, GrenzText> = grenzTexte()

/** „Bilder-Speicher bei 82 %“ bzw. „Bilder-Speicher voll“ — Titel von Warnkarte und Mail. */
export function grenzTitel(wert: GrenzWert, anteilProzent: number): string {
  const name = GRENZ_TEXT[wert].name
  return stufe(anteilProzent) === 3 ? `${name} voll` : `${name} bei ${prozentText(anteilProzent)}`
}

const STUFE_HINWEIS: Record<Exclude<Stufe, 0>, string> = { 1: 'über 80 %', 2: 'über 95 %', 3: 'voll' }
/** Die Stufen der Vercel-Ausgaben (Spend Management meldet bei 50, 75 und 100 %). */
const VERCEL_STUFE_HINWEIS: Record<Exclude<Stufe, 0>, string> = { 1: 'ab 50 %', 2: 'ab 75 %', 3: 'am Limit' }

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
  if (art === VERCEL_WARN_ART) return { text: `Vercel-Ausgaben ${VERCEL_STUFE_HINWEIS[s]}`, kurz: `Vercel ${VERCEL_STUFE_HINWEIS[s]}` }
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
/** „Liste als CSV“ der Bilder ohne Verwendung (Nr. 104). */
export const BILDER_EXPORT_HREF = '/admin/betrieb/bilder-export'
/** Die Anker der Karte „Bilder ohne Verwendung“: ab 1024 px rechts, am Handy unter den Abläufen — beide Fassungen stehen im Dokument. */
export const OHNE_VERWENDUNG_ANKER = { breit: 'ohne-verwendung', handy: 'ohne-verwendung-handy' } as const

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
    '= mehr als 26 Stunden (täglich) bzw. 8 Tage (wöchentlich) ohne Lauf – zwei Stunden Spielraum, falls Vercel einen Lauf verzögert.',
  ablaeufeRegelFehler:
    '= der Lauf ist gescheitert (Fehlerklasse in Sentry, ohne Inhalt). Beides schickt eine Warn-Mail; jeder Ablauf prüft nach seinem Lauf die anderen.',
  ablaeufeAufraeumen: '„Aufräumen“ = Reservierungen, Bremse, abgelaufene Sitzungen und Codes, alte Webhook-Ereignisse und Messungen.',
  dashboardTitel: 'Nur im Dashboard',
  dashboardSatz: `Das kann ${MARKE} selbst nicht messen – einmal im Monat ansehen.`,
  dashboardKurz: 'Vercel, Supabase, Sentry, Resend',
  neuerTab: '(öffnet in neuem Tab)',
  tabellenTitel: 'Größte Tabellen',
  tabellenZusammen: (gesamt: string): string => `zusammen ${gesamt}`,
  tabellenSpalten: { tabelle: 'Tabelle', zeilen: 'Zeilen', groesse: 'Größe', bleibt: 'Bleibt' },
  tabellenLeer: 'Die Tabellen konnten gerade nicht gelesen werden.',
  csv: 'Messungen als CSV',
  csvSatz: `Gespeichert wird je Tag und Wert eine Zahl, ${MESSUNGEN_AUFBEWAHREN_TAGE} Tage lang. Keine Personendaten, keine Inhalte.`,
  // Bilder ohne Verwendung (Nr. 104, Mockups admin-betrieb und mobil-admin-betrieb)
  ohneVerwendungTitel: 'Bilder ohne Verwendung',
  ohneVerwendungMarke: 'nur Liste',
  ohneVerwendungSatz: 'Hängen an keinem Hof, Produkt, Beitrag, keiner Fassung der Startseite und keiner Meldung.',
  ohneVerwendungGetrennt: 'Getrennt geführt, nicht mitgezählt',
  ohneVerwendungDateien: 'Dateien',
  ohneVerwendungCsv: 'Liste als CSV',
  ohneVerwendungFuss: `Gelöscht wird nichts. In die Liste kommt nur, was älter als ${BILDER_OHNE_VERWENDUNG_AB_TAGE} Tage ist – jüngere Bilder können noch in einem offenen Formular hängen. Löschen kommt nach deiner Durchsicht in einer eigenen Nummer.`,
  ohneVerwendungVorschau: 'Nur in der Produktion – Vorschau und Produktion teilen sich den Bild-Speicher.',
  ohneVerwendungLeer: 'Die Liste kommt mit der nächsten Messung am Morgen.',
  ohneVerwendungAnsehen: 'Bilder ohne Verwendung ansehen',
  davonOhneVerwendung: (menge: string): string => `davon ${menge} ohne Verwendung`,
  // Vercel Pro und Vercel-Ausgaben (Nr. 113; Karte nach dem Muster „Tarife und Grenzen“)
  ohneGrenze: OHNE_GRENZE,
  belegt: 'belegt',
  /** „von …“ der Kachel E-Mails heute, wenn der Tarif keine Tagesgrenze kennt (Resend Pro, Nr. 162). */
  ohneTagesgrenze: 'ohne Tagesgrenze',
  imMonat: 'im Monat',
  vercelTitel: 'Vercel-Ausgaben',
  vercelGemeldet: (ausgaben: string, tag: string): string => `Zuletzt gemeldet: ${ausgaben} am ${tag}`,
  /** Nie eine Meldung von Spend Management (Nr. 162): Ob die Meldung eingerichtet ist, sieht nur Vercel. */
  vercelKeineMeldung: 'Noch keine Meldung von Vercel. Vercel meldet erst ab 50 % des Limits – ob die Meldung eingerichtet ist, steht in Vercel › Settings › Billing.',
  vercelKeineMeldungKurz: 'Noch keine Meldung',
  /** Eine Meldung aus einem früheren Abrechnungszeitraum, im laufenden keine (Nr. 162). */
  vercelUnter50: (tag: string): string => `Unter 50 % (letzte Meldung ${tag}).`,
  vercelUnter50Kurz: 'Unter 50 %',
  vercelLink: 'Vercel › Usage',
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

export type TarifZeile = { dienst: string; marke: string; ton: MarkeArt; satz: string }

/**
 * Die Zeile von Vercel je Tarif. Bei Pro steht „nutzungsbasiert“ in der Marke
 * und „Ausgabenlimit in Spend Management“ am Anfang des Satzes — die Marke
 * kürzt einen langen Text mit Auslassung (eine Zeile, Register G5).
 */
const VERCEL_TARIF: Record<(typeof TARIFE)['vercel'] | 'HOBBY', Omit<TarifZeile, 'dienst'>> = {
  HOBBY: {
    marke: `${TARIF_NAME.HOBBY} · nicht-kommerziell`,
    ton: 'tun',
    satz: `Bilder ${speicherText(GRENZEN.vercel.HOBBY.bilderBytes)}, ${formatZahl(GRENZEN.vercel.HOBBY.bildVorgaengeMonat)} Vorgänge und ${speicherText(GRENZEN.vercel.HOBBY.uebertragungBytesMonat)} Übertragung im Monat. Vor Stripe live auf Pro.`,
  },
  PRO: {
    marke: `${TARIF_NAME.PRO} · nutzungsbasiert`,
    ton: 'erledigt',
    satz: 'Ausgabenlimit in Spend Management. Bilder, Bild-Vorgänge und Übertragung ohne feste Grenze – sie zählen zum Ausgabenlimit; bei 100 % pausiert Vercel das Projekt.',
  },
}

/** Die Zeilen von „Tarife und Grenzen“ für die Tarife `tarife` (Standard: die von heute) — Texte je Tarif aus `supabaseTexte` und GRENZEN. */
export function tarifZeilen(tarife: Tarife = TARIFE): TarifZeile[] {
  const grenze = grenzeFuer(tarife)
  const supabase = supabaseTexte(tarife.supabase)
  const imMonat = `im Monat (ab dem ${RESEND_ABRECHNUNG_TAG}.)`
  return [
    { dienst: 'Vercel', ...VERCEL_TARIF[tarife.vercel] },
    { dienst: 'Supabase', marke: supabase.marke, ton: supabase.ton, satz: supabase.satz },
    {
      dienst: 'Resend',
      marke: TARIF_NAME[tarife.resend],
      ton: 'erledigt',
      satz:
        grenze.mailsTag === null
          ? `Keine Tagesgrenze, ${formatZahl(grenze.mailsMonat)} E-Mails ${imMonat}.`
          : `${formatZahl(grenze.mailsTag)} E-Mails am Tag, ${formatZahl(grenze.mailsMonat)} ${imMonat}.`,
    },
  ]
}

export const TARIF_ZEILEN: readonly TarifZeile[] = tarifZeilen()

/** Kurzzeile der zugeklappten Karte am Handy: „Vercel Pro · Supabase Pro · Resend Free“. */
export const TARIFE_KURZ = `Vercel ${TARIF_NAME[TARIFE.vercel]} · Supabase ${TARIF_NAME[TARIFE.supabase]} · Resend ${TARIF_NAME[TARIFE.resend]}`

/**
 * Was nur die Dashboards der Dienste wissen — Links ohne Kennung in der
 * Adresse (Team, Projekt und Organisation wählt der Dienst selbst), damit das
 * öffentliche Repository keine Kennungen trägt.
 */
export const VERCEL_USAGE_HREF = 'https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fusage'

export const NUR_IM_DASHBOARD = [
  {
    titel: 'Vercel › Usage',
    satz: `Datenübertragung, Bild-Übertragung${GRENZE.bildUebertragungBytesMonat === null ? '' : ` (${speicherText(GRENZE.bildUebertragungBytesMonat)})`}, Funktionen`,
    href: VERCEL_USAGE_HREF,
  },
  { titel: 'Supabase › Usage', satz: `Übertragung (${speicherText(GRENZE.datenbankUebertragungBytesMonat)}), aktive Konten`, href: 'https://supabase.com/dashboard/org/_/usage' },
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

/** Wie lange die Zeilen einer Tabelle bleiben (Spalte „Bleibt“, Nr. 104) — aus denselben Grenzen, nach denen aufgeräumt wird. */
const TABELLEN_BLEIBT: Record<string, string> = {
  Order: '7 Jahre (BAO) – nie automatisch',
  OrderItem: '7 Jahre (BAO) – nie automatisch',
  WebhookEvent: `${WEBHOOK_EREIGNISSE_AUFBEWAHREN_TAGE} Tage`,
  Session: `abgelaufene nach ${SITZUNGEN_NACH_ABLAUF_TAGE} Tagen`,
  Verification: `abgelaufene nach ${CODES_NACH_ABLAUF_TAGE} Tag`,
  Product: 'solange der Hof sie führt',
  Meldung: `erledigt ${MELDUNG_AUFBEWAHRUNG_TAGE} Tage`,
  BetriebMessung: `${MESSUNGEN_AUFBEWAHREN_TAGE} Tage`,
  StockReservation: 'abgelaufene bis zum nächsten Aufräumen',
  RateLimitZaehler: 'abgelaufene bis zum nächsten Aufräumen',
}

/** „–“ heißt: Kein Ablauf löscht diese Tabelle von selbst. */
export function tabellenBleibt(modell: string): string {
  return TABELLEN_BLEIBT[modell] ?? '–'
}

// ─── Bilder ohne Verwendung (Register N18, Nr. 104) ──────────────────────────

/**
 * Die Arten der Bilder ohne Verwendung — je Ordner unter `farms/<hofId>/`
 * bzw. `originals/<hofId>/` (src/lib/upload-pfade.ts). Getrennt geführt und
 * NICHT als „ohne Verwendung“ gezählt: Pfade mit unbekannter Hof-Kennung
 * (gelöscht oder aus der Vorschau, die den Speicher teilt) und der
 * Startseiten-Ordner (ohne Hof-Kennung, auch von der Vorschau benutzt).
 */
export const BILD_ARTEN = ['produktfotos', 'galerie', 'titelbilder', 'logos', 'beitragsfotos', 'meldungen', 'originale'] as const
export type BildArt = (typeof BILD_ARTEN)[number]
export const BILD_GRUPPEN_GETRENNT = ['unbekannterHof', 'startseite'] as const
export type BildGruppe = BildArt | (typeof BILD_GRUPPEN_GETRENNT)[number]

export const BILD_GRUPPE_TEXT: Record<BildGruppe, string> = {
  produktfotos: 'Produktfotos',
  galerie: 'Galerie',
  titelbilder: 'Titelbilder',
  logos: 'Logos',
  beitragsfotos: 'Beitragsfotos',
  meldungen: 'Bildschirmfotos aus Meldungen',
  originale: 'Reste von Originalen',
  unbekannterHof: 'unbekannter Hof – gelöscht oder aus der Vorschau',
  startseite: 'Startseite – auch Bilder aus der Vorschau',
}

/** Der Ordner eines Zwecks unter `farms/<hofId>/` → Art. */
const ZWECK_ART = {
  product: 'produktfotos',
  gallery: 'galerie',
  banner: 'titelbilder',
  logo: 'logos',
  status: 'beitragsfotos',
  meldung: 'meldungen',
} as const satisfies Record<Exclude<UploadZweck, 'startseite'>, BildArt>

/** Die Art einer Messung der Bilder ohne Verwendung. */
export function ohneVerwendungArt(gruppe: BildGruppe, was: 'bytes' | 'dateien'): BetriebArt {
  return `ohneVerwendung:${gruppe}:${was}`
}

/**
 * Wohin eine Datei im Bild-Speicher gehört — null, wenn ihr Pfad keinem
 * bekannten Ordner folgt (dann wird sie weder gezählt noch gelistet).
 */
export function ordneBildEin(pathname: string, hoefe: ReadonlySet<string>): BildGruppe | null {
  if (pathname.startsWith(STARTSEITE_ZIEL_PREFIX) || pathname.startsWith(STARTSEITE_ORIGINAL_PREFIX)) return 'startseite'
  const ziel = /^farms\/([^/]+)\/([^/]+)\/[^/]+/.exec(pathname)
  if (ziel) {
    if (!hoefe.has(ziel[1])) return 'unbekannterHof'
    return Object.hasOwn(ZWECK_ART, ziel[2]) ? ZWECK_ART[ziel[2] as keyof typeof ZWECK_ART] : null
  }
  const original = /^originals\/([^/]+)\/.+/.exec(pathname)
  if (original) return hoefe.has(original[1]) ? 'originale' : 'unbekannterHof'
  return null
}

/** Der Pfad einer gespeicherten Bild-Adresse (ohne Domain und Abfrage) — null, wenn sie keine Web-Adresse ist (etwa ein Verlauf im Titelbild). */
export function pfadAusAdresse(adresse: string): string | null {
  let url: URL
  try {
    url = new URL(adresse)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const roh = url.pathname.replace(/^\/+/, '')
  try {
    return decodeURIComponent(roh)
  } catch {
    // Kaputt kodiert: der rohe Pfad zählt trotzdem als benutzt — lieber ein Bild zu wenig in der Liste.
    return roh
  }
}

/** Jede `bildUrl` in einem Json (Fassung der Startseite), auch verschachtelt. */
export function bildUrlsAusInhalt(inhalt: unknown): string[] {
  if (Array.isArray(inhalt)) return inhalt.flatMap(bildUrlsAusInhalt)
  if (inhalt === null || typeof inhalt !== 'object') return []
  return Object.entries(inhalt).flatMap(([schluessel, wert]) => (schluessel === 'bildUrl' && typeof wert === 'string' ? [wert] : bildUrlsAusInhalt(wert)))
}

export type BildVerwendung = {
  /** Die Pfade aller gespeicherten Bild-Adressen (pfadAusAdresse). */
  benutzt: ReadonlySet<string>
  /** Die Kennungen aller Höfe DIESER Datenbank. */
  hoefe: ReadonlySet<string>
}

export type BildOhneVerwendung = { gruppe: BildGruppe; pathname: string; size: number; uploadedAt: Date }

/**
 * Welche Dateien an nichts hängen: kein Feld trägt ihre Adresse, älter als 7
 * Tage, und ihr Pfad gehört zu einem bekannten Ordner. Die Gruppe sagt, ob
 * sie als „ohne Verwendung“ zählt (BILD_ARTEN) oder getrennt geführt wird.
 * Älteste zuerst. Es wird nichts gelöscht.
 */
export function bilderOhneVerwendung(
  dateien: ReadonlyArray<{ pathname: string; url: string; size: number; uploadedAt: Date }>,
  verwendung: BildVerwendung,
  jetzt: Date
): BildOhneVerwendung[] {
  const ab = jetzt.getTime() - BILDER_OHNE_VERWENDUNG_AB_TAGE * TAG_MS
  const liste: BildOhneVerwendung[] = []
  for (const d of dateien) {
    if (d.uploadedAt.getTime() >= ab) continue
    if (verwendung.benutzt.has(d.pathname) || verwendung.benutzt.has(pfadAusAdresse(d.url) ?? d.pathname)) continue
    const gruppe = ordneBildEin(d.pathname, verwendung.hoefe)
    if (gruppe !== null) liste.push({ gruppe, pathname: d.pathname, size: d.size, uploadedAt: d.uploadedAt })
  }
  return liste.sort((a, b) => a.uploadedAt.getTime() - b.uploadedAt.getTime())
}

/** Zählt „ohne Verwendung“? Nur die Arten — unbekannter Hof und Startseite nicht. */
export function zaehltOhneVerwendung(gruppe: BildGruppe): gruppe is BildArt {
  return (BILD_ARTEN as readonly string[]).includes(gruppe)
}

/** Die Summen für BetriebMessung: je Gruppe Bytes und Dateien (auch 0 — ein zweiter Lauf am Tag überschreibt), dazu die älteste gezählte Datei (0 = keine). */
export function ohneVerwendungWerte(liste: readonly BildOhneVerwendung[]): Array<readonly [BetriebArt, number]> {
  const werte: Array<readonly [BetriebArt, number]> = []
  for (const gruppe of [...BILD_ARTEN, ...BILD_GRUPPEN_GETRENNT]) {
    const eigene = liste.filter((b) => b.gruppe === gruppe)
    werte.push([ohneVerwendungArt(gruppe, 'bytes'), eigene.reduce((s, b) => s + b.size, 0)], [ohneVerwendungArt(gruppe, 'dateien'), eigene.length])
  }
  const gezaehlt = liste.filter((b) => zaehltOhneVerwendung(b.gruppe))
  werte.push(['ohneVerwendung:aelteste', gezaehlt.length === 0 ? 0 : Math.min(...gezaehlt.map((b) => b.uploadedAt.getTime()))])
  return werte
}

export type OhneVerwendungZeile = { gruppe: BildGruppe; text: string; dateien: string; groesse: string }
export type OhneVerwendungKarte = {
  bytes: number
  summe: string
  zeile: string
  arten: OhneVerwendungZeile[]
  getrennt: OhneVerwendungZeile[]
  hinweis: string | null
}

/** „3. Aug“, aus einem anderen Jahr „3. Aug 2025“ — der Wiener Tag. */
function tagMitMonat(zeitpunkt: Date, jetzt: Date): string {
  const tag = kalendertagInWien(zeitpunkt)
  const text = `${Number(tag.slice(8, 10))}. ${MONAT_KURZ[Number(tag.slice(5, 7)) - 1]}`
  return tag.slice(0, 4) === kalendertagInWien(jetzt).slice(0, 4) ? text : `${text} ${tag.slice(0, 4)}`
}

/**
 * Die Karte „Bilder ohne Verwendung“ aus der jüngsten Messung, die sie
 * gezählt hat — null, wenn es keine gibt. Stammt sie nicht vom letzten
 * Messtag, sagt ein Hinweis, von wann.
 */
export function ohneVerwendungKarte(messungen: readonly Messung[], jetzt: Date): OhneVerwendungKarte | null {
  let tag: string | null = null
  for (const m of messungen) if (m.art.startsWith('ohneVerwendung:') && (tag === null || m.tag > tag)) tag = m.tag
  if (tag === null) return null
  const wert = (art: BetriebArt): number => messungen.find((m) => m.tag === tag && m.art === art)?.wert ?? 0
  const roh = (gruppen: readonly BildGruppe[]): Array<{ gruppe: BildGruppe; anzahl: number; bytes: number }> =>
    gruppen
      .map((gruppe) => ({ gruppe, anzahl: wert(ohneVerwendungArt(gruppe, 'dateien')), bytes: wert(ohneVerwendungArt(gruppe, 'bytes')) }))
      .filter((z) => z.anzahl > 0)
      .sort((a, b) => b.bytes - a.bytes)
  const zeile = (z: { gruppe: BildGruppe; anzahl: number; bytes: number }): OhneVerwendungZeile => ({
    gruppe: z.gruppe,
    text: BILD_GRUPPE_TEXT[z.gruppe],
    dateien: formatZahl(z.anzahl),
    groesse: speicherText(z.bytes),
  })
  const arten = roh(BILD_ARTEN)
  const bytes = arten.reduce((s, z) => s + z.bytes, 0)
  const anzahl = arten.reduce((s, z) => s + z.anzahl, 0)
  const aelteste = wert('ohneVerwendung:aelteste')
  const messtag = letzterMesstag(messungen)
  return {
    bytes,
    summe: speicherText(bytes),
    zeile: `in ${formatZahl(anzahl)} ${anzahl === 1 ? 'Datei' : 'Dateien'}${aelteste > 0 ? ` · älteste vom ${tagMitMonat(new Date(aelteste), jetzt)}` : ''}`,
    arten: arten.map(zeile),
    getrennt: roh(BILD_GRUPPEN_GETRENNT).map(zeile),
    hinweis: messtag !== null && tag < messtag ? BETRIEB_TEXT.standVom(formatTagKurz(tag)) : null,
  }
}

/** „Was hilft“ in der Warnkarte: beim Bilder-Speicher mit den Bildern ohne Verwendung, sobald sie gezählt sind (Mockup admin-betrieb). */
export function hilftSatz(wert: GrenzWert, ohneVerwendungBytes: number | null): string | null {
  if (wert === 'bilder' && ohneVerwendungBytes !== null && ohneVerwendungBytes > 0) {
    return `${speicherText(ohneVerwendungBytes)} hängen an nichts mehr, oder Vercel Pro (ohne harte Sperre).`
  }
  return GRENZ_TEXT[wert].hilft
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
  /** Der Satz statt Balken, wenn der Tarif keine feste Grenze kennt (Vercel Pro, Nr. 113) — dann auch kein Prozent. */
  ohneGrenze: string | null
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

/** E-Mails im Abrechnungszeitraum von Resend bis einschließlich `tag` (ab dem 17., Nr. 162). */
function mailsImMonatBis(messungen: readonly Messung[], tag: string): number {
  const ab = utcTag(resendAbrechnungsBeginn(new Date(`${tag}T00:00:00.000Z`)))
  return messungen.filter((m) => m.art === 'mails' && m.tag >= ab && m.tag <= tag).reduce((s, m) => s + m.wert, 0)
}

/** „17. Okt – 16. Nov“: der laufende Abrechnungszeitraum von Resend, erster und letzter Tag (UTC). */
function resendZeitraumText(jetzt: Date): string {
  const tagText = (d: Date): string => `${d.getUTCDate()}. ${MONAT_KURZ[d.getUTCMonth()]}`
  const letzter = new Date(resendAbrechnungsEnde(jetzt).getTime() - TAG_MS)
  return `${tagText(resendAbrechnungsBeginn(jetzt))} – ${tagText(letzter)}`
}

/** Der Tag der letzten Messung (aus MESS_ARTEN) — daran sieht eine Kachel, ob ihr Wert von heute ist. */
function letzterMesstag(messungen: readonly Messung[]): string | null {
  let tag: string | null = null
  for (const m of messungen) if ((MESS_ARTEN as readonly string[]).includes(m.art) && (tag === null || m.tag > tag)) tag = m.tag
  return tag
}

/** Ohne feste Grenze nur der Zuwachs, ohne „voll in …“. */
function trendZeile(verlauf: readonly VerlaufPunkt[], grenze: number | null, heute: string): string {
  if (grenze === null) {
    const z = zuwachsImFenster(verlauf, heute)
    return z ? zuwachsText(z.zuwachs, z.tage) : BETRIEB_TEXT.trendAb
  }
  const t = vollIn(verlauf, grenze, heute)
  return t ? `${zuwachsText(t.zuwachs, t.tage)} · ${vollInText(t.vollIn)}` : BETRIEB_TEXT.trendAb
}

/**
 * Die vier Kacheln (Mockup admin-betrieb): Bilder, Datenbank, E-Mails heute,
 * Bild-Vorgänge. Ohne feste Grenze (Vercel Pro, Nr. 113) zeigen Bilder und
 * Bild-Vorgänge den Wert ohne Prozent und Balken, dafür den Satz `ohneGrenze`;
 * ebenso E-Mails heute ohne Tagesgrenze (Resend Pro). Der Monat der E-Mails
 * ist der Abrechnungszeitraum von Resend, die Kachel nennt Beginn und Ende
 * (Nr. 162). `tarife` nur für Tests anderer Tarife.
 */
export function betriebKacheln(messungen: readonly Messung[], jetzt: Date, tarife: Tarife = TARIFE): Kachel[] {
  const grenze = grenzeFuer(tarife)
  const supabase = supabaseTexte(tarife.supabase)
  const heute = utcTag(jetzt)
  const messtag = letzterMesstag(messungen)
  const hinweisFuer = (m: Messung | null, leer: string): string | null =>
    m === null ? leer : messtag !== null && m.tag < messtag ? BETRIEB_TEXT.standVom(formatTagKurz(m.tag)) : null

  const bilderGrenze = grenze.bilderBytes
  const bilder = letzter(messungen, 'bilderBytes')
  const dateien = letzter(messungen, 'bilderDateien')
  const bilderAnteil = bilder && bilderGrenze !== null ? anteil(bilder.wert, bilderGrenze) : null
  const bilderTrend = trendZeile(reihe(messungen, 'bilderBytes'), bilderGrenze, heute)

  const db = letzter(messungen, 'datenbankBytes')
  const dbAnteil = db ? anteil(db.wert, grenze.datenbankBytes) : null
  const dbTrend = trendZeile(reihe(messungen, 'datenbankBytes'), grenze.datenbankBytes, heute)

  const mailsHeute = messungen.find((m) => m.art === 'mails' && m.tag === heute)?.wert ?? 0
  const mailsMonat = mailsImMonatBis(messungen, heute)
  const mailsTagGrenze = grenze.mailsTag
  // Ohne Tagesgrenze (Resend Pro) kein Anteil des Tages — dann warnt nur der Monat.
  const mailsAnteil = mailsTagGrenze === null ? null : anteil(mailsHeute, mailsTagGrenze)
  const zeitraum = resendZeitraumText(jetzt)
  const mailsMonatAnteil = anteil(mailsMonat, grenze.mailsMonat)

  const vorgaenge = letzter(messungen, 'bildVorgaengeMonat')
  // Ein Monatswert aus dem Vormonat gilt nicht mehr.
  const vorgaengeHeute = vorgaenge && vorgaenge.tag.slice(0, 7) === heute.slice(0, 7) ? vorgaenge : null
  const uploads = letzter(messungen, 'bilderUploadsMonat')
  const uploadsImMonat = uploads && uploads.tag.slice(0, 7) === heute.slice(0, 7) ? uploads.wert : 0
  const vorgaengeGrenze = grenze.bildVorgaengeMonat
  const vorgaengeAnteil = vorgaengeHeute && vorgaengeGrenze !== null ? anteil(vorgaengeHeute.wert, vorgaengeGrenze) : null
  const bilderSperre = bilderGrenze === null ? null : `Bei ${speicherText(bilderGrenze)} sperrt Vercel alle Bilder für 30 Tage.`

  return [
    {
      id: 'bilder',
      titel: 'Bilder',
      untertitel: null,
      tarif: `Vercel ${TARIF_NAME[tarife.vercel]}`,
      wert: bilder ? speicherText(bilder.wert) : null,
      von: bilderGrenze === null ? BETRIEB_TEXT.belegt : `von ${speicherText(bilderGrenze)}`,
      anteil: bilderAnteil,
      prozent: bilderAnteil === null ? null : prozentText(bilderAnteil),
      ohneGrenze: bilderGrenze === null ? BETRIEB_TEXT.ohneGrenze : null,
      warnt: bilderAnteil !== null && stufe(bilderAnteil) > 0,
      zeile: dateien ? `${bilderTrend} · ${formatZahl(dateien.wert)} Dateien` : bilderTrend,
      satz: bilderSperre ?? OHNE_SPERRE,
      kurz: bilderSperre === null ? `${bilderTrend}.` : `${bilderTrend}. ${bilderSperre}`,
      hinweis: hinweisFuer(bilder, BETRIEB_TEXT.bilderOhneZugang),
    },
    {
      id: 'datenbank',
      titel: 'Datenbank',
      untertitel: null,
      tarif: `Supabase ${TARIF_NAME[tarife.supabase]}`,
      wert: db ? speicherText(db.wert) : null,
      von: `von ${speicherText(grenze.datenbankBytes)}`,
      anteil: dbAnteil,
      prozent: dbAnteil === null ? null : prozentText(dbAnteil),
      ohneGrenze: null,
      warnt: dbAnteil !== null && stufe(dbAnteil) > 0,
      zeile: dbTrend,
      satz: supabase.kachel,
      kurz: `${dbTrend}. ${supabase.kachelKurz}`,
      hinweis: hinweisFuer(db, BETRIEB_TEXT.nochNichtGemessen),
    },
    {
      id: 'mailsHeute',
      titel: 'E-Mails heute',
      untertitel: 'Resend-Tag ab 0 Uhr UTC',
      tarif: `Resend ${TARIF_NAME[tarife.resend]}`,
      wert: formatZahl(mailsHeute),
      von: mailsTagGrenze === null ? BETRIEB_TEXT.ohneTagesgrenze : `von ${formatZahl(mailsTagGrenze)}`,
      anteil: mailsAnteil,
      prozent: mailsAnteil === null ? null : prozentText(mailsAnteil),
      ohneGrenze: mailsTagGrenze === null ? OHNE_TAGESGRENZE : null,
      warnt: (mailsAnteil !== null && stufe(mailsAnteil) > 0) || stufe(mailsMonatAnteil) > 0,
      zeile: `Monat ${zeitraum}: ${formatZahl(mailsMonat)} von ${formatZahl(grenze.mailsMonat)} (${prozentText(mailsMonatAnteil)}) · zählt je Empfänger`,
      satz: grenzTexte(tarife).mailsTag.voll,
      kurz: `Monat ${zeitraum}: ${formatZahl(mailsMonat)} von ${formatZahl(grenze.mailsMonat)} · zählt je Empfänger.`,
      hinweis: null,
    },
    {
      id: 'bildVorgaenge',
      titel: 'Bild-Vorgänge',
      untertitel: null,
      tarif: `Vercel ${TARIF_NAME[tarife.vercel]}`,
      wert: vorgaengeHeute ? `≈ ${formatZahl(vorgaengeHeute.wert)}` : null,
      von: vorgaengeGrenze === null ? BETRIEB_TEXT.imMonat : `von ${formatZahl(vorgaengeGrenze)} ${BETRIEB_TEXT.imMonat}`,
      anteil: vorgaengeAnteil,
      prozent: vorgaengeAnteil === null ? null : prozentText(vorgaengeAnteil),
      ohneGrenze: vorgaengeGrenze === null ? BETRIEB_TEXT.ohneGrenze : null,
      warnt: vorgaengeAnteil !== null && stufe(vorgaengeAnteil) > 0,
      zeile: `${formatZahl(uploadsImMonat)} Fotos hochgeladen · jedes zählt doppelt (Original + fertiges Bild)`,
      satz:
        vorgaengeGrenze === null
          ? 'Ein Blick in den Speicher im Vercel-Dashboard zählt auch.'
          : `Ein Blick in den Speicher im Vercel-Dashboard zählt auch. Bei ${formatZahl(vorgaengeGrenze)}: Bilder 30 Tage gesperrt.`,
      kurz: 'Jedes Foto zählt doppelt; das Vercel-Dashboard auch.',
      hinweis: vorgaengeHeute ? hinweisFuer(vorgaengeHeute, BETRIEB_TEXT.bilderOhneZugang) : BETRIEB_TEXT.bilderOhneZugang,
    },
  ]
}

export type VerlaufLinie = { id: 'bilder' | 'datenbank' | 'mailsMonat'; name: string; punkte: Array<{ tag: string; prozent: number }> }

/**
 * Der Verlauf von 90 Tagen in % der Grenze — Bilder, Datenbank, E-Mails im
 * Monat (laufende Summe je Tag). Ohne feste Grenze (Vercel Pro) fehlt die
 * Linie der Bilder: Prozent von nichts gibt es nicht.
 */
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
  const bilderGrenze = GRENZE.bilderBytes
  return {
    von,
    bis,
    linien: [
      ...(bilderGrenze === null ? [] : [{ id: 'bilder' as const, name: 'Bilder', punkte: prozentReihe('bilderBytes', bilderGrenze) }]),
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

export type VercelAusgabenKarte = {
  /** Gibt es im laufenden Abrechnungszeitraum eine Meldung von Spend Management? */
  gemeldet: boolean
  satz: string
  /** Die Zeile der zugeklappten Karte am Handy. */
  kurz: string
}

/**
 * Die Karte „Vercel-Ausgaben“ (Nr. 113, ehrlich seit Nr. 162): die jüngste
 * Meldung von Spend Management im laufenden Abrechnungszeitraum — „Zuletzt
 * gemeldet: … am …“; mit einer Meldung nur aus einem früheren Zeitraum
 * „Unter 50 % (letzte Meldung …)“; ganz ohne Meldung „Noch keine Meldung“ —
 * nie „Unter 50 %“ ohne Beleg. Gelesen wird, was die Seite lädt (90 Tage).
 * Kein Abruf der Vercel-API: Die Zahlen kommen nur über den Webhook.
 */
export function vercelAusgabenKarte(messungen: readonly Messung[], jetzt: Date): VercelAusgabenKarte {
  const ab = utcTag(abrechnungsBeginn(jetzt))
  const ausgaben = letzter(
    messungen.filter((m) => m.tag >= ab),
    'vercelAusgaben'
  )
  const limit = ausgaben ? messungen.find((m) => m.art === 'vercelLimit' && m.tag === ausgaben.tag) : undefined
  if (!ausgaben || !limit) {
    const frueher = letzter(
      messungen.filter((m) => m.tag < ab),
      'vercelAusgaben'
    )
    if (frueher === null) return { gemeldet: false, satz: BETRIEB_TEXT.vercelKeineMeldung, kurz: BETRIEB_TEXT.vercelKeineMeldungKurz }
    return { gemeldet: false, satz: BETRIEB_TEXT.vercelUnter50(tagMitMonat(new Date(`${frueher.tag}T12:00:00.000Z`), jetzt)), kurz: BETRIEB_TEXT.vercelUnter50Kurz }
  }
  const betrag = ausgabenText(ausgaben.wert, limit.wert)
  return { gemeldet: true, satz: BETRIEB_TEXT.vercelGemeldet(betrag, formatTagKurz(ausgaben.tag)), kurz: betrag }
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
 * Mit gezählten Bildern ohne Verwendung nennt „Was hilft“ beim Bilder-Speicher
 * ihre Größe (Nr. 104).
 */
export function warnEintraege(
  warnungen: ReadonlyArray<{ art: string; stufe: number; gemeldetAm: Date }>,
  kacheln: readonly Kachel[],
  zeilen: readonly AblaufZeile[],
  messungen: readonly Messung[],
  jetzt: Date,
  produktion: boolean,
  ohneVerwendungBytes: number | null = null
): WarnEintrag[] {
  const anteilVon = (wert: GrenzWert): number | null => {
    if (wert === 'bilder') return kacheln.find((k) => k.id === 'bilder')?.anteil ?? null
    if (wert === 'datenbank') return kacheln.find((k) => k.id === 'datenbank')?.anteil ?? null
    if (wert === 'bildVorgaenge') return kacheln.find((k) => k.id === 'bildVorgaenge')?.anteil ?? null
    if (wert === 'mailsMonat') return anteil(mailsImMonatBis(messungen, utcTag(jetzt)), GRENZE.mailsMonat)
    const gestern = utcTagVersetzt(utcTag(jetzt), -1)
    const tagGrenze = GRENZE.mailsTag
    return tagGrenze === null ? null : anteil(messungen.find((m) => m.art === 'mails' && m.tag === gestern)?.wert ?? 0, tagGrenze)
  }
  const mailSatz = (am: Date): string =>
    kalendertagInWien(am) === kalendertagInWien(jetzt) ? BETRIEB_TEXT.warnMail(uhrzeitInWien(am)) : BETRIEB_TEXT.warnMailAm(zuletztText(am, jetzt))

  const offen = warnungen.filter((w) => w.stufe > 0).sort((a, b) => warnRang(a.art, a.stufe) - warnRang(b.art, b.stufe))
  const eintraege: WarnEintrag[] = []
  for (const w of offen) {
    if ((GRENZ_WERTE as readonly string[]).includes(w.art)) {
      const wert = w.art as GrenzWert
      const a = anteilVon(wert)
      const hilft = hilftSatz(wert, ohneVerwendungBytes)
      eintraege.push({
        art: w.art,
        titel: a === null ? warnHinweis(w.art, w.stufe).text : grenzTitel(wert, a),
        saetze: [GRENZ_TEXT[wert].voll, ...(hilft ? [`${BETRIEB_MAIL_TEXT.hilft} ${hilft}`] : []), mailSatz(w.gemeldetAm)],
      })
    } else if (w.art === VERCEL_WARN_ART) {
      const karte = vercelAusgabenKarte(messungen, jetzt)
      eintraege.push({
        art: w.art,
        titel: warnHinweis(w.art, w.stufe).text,
        saetze: [...(karte.gemeldet ? [`${karte.satz}.`] : []), w.stufe >= 3 ? VERCEL_PAUSIERT : VERCEL_BEI_VOLL, mailSatz(w.gemeldetAm)],
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
  /** `ohneVerwendungBytes`: die Summe der Bilder ohne Verwendung — beim Bilder-Speicher nennt „Was hilft“ sie (Nr. 113, Mockup email-betrieb-warnung). */
  | { art: 'grenze'; wert: GrenzWert; anteil: number; stand: string; trend: string | null; ohneVerwendungBytes: number | null }
  | { art: 'entwarnung'; wert: GrenzWert; anteil: number; stand: string }
  | { art: 'ablauf'; name: AblaufName; stand: 'ueberfaellig' | 'fehler'; zuletzt: string | null; stundenSeit: number | null; wann: string }
  | { art: 'ablaufWieder'; name: AblaufName }
  /** Spend Management meldet 50, 75 oder 100 % des Ausgabenlimits (Nr. 113) — Beträge in ganzen Cent. */
  | { art: 'vercelAusgaben'; stufe: Exclude<Stufe, 0>; ausgabenCent: number; limitCent: number }

export type BetriebMail = { betreff: string; titel: string; absaetze: string[]; hilft: string | null; knopf: string; fuss: string }

/** Die festen Wörter der Warn-Mail (Mockup email-betrieb-warnung). */
export const BETRIEB_MAIL_TEXT = { kopf: 'Betrieb', hilft: 'Was hilft:', knopf: 'Betrieb ansehen' } as const

const FUSS_SPEICHER = `Diese Mail kommt einmal je Stufe (80 %, 95 %, voll) und noch einmal, wenn der Wert wieder unter ${ENTWARNUNG_UNTER} % liegt. Abschalten lässt sie sich nicht – es geht um den Betrieb der Plattform.`
const FUSS_MONAT = 'Diese Mail kommt einmal je Stufe (80 %, 95 %, voll) und Monat; der neue Monat beginnt still bei 0. Abschalten lässt sie sich nicht – es geht um den Betrieb der Plattform.'
/** Die E-Mails zählen im Abrechnungszeitraum von Resend (Nr. 162). */
const FUSS_MAILS_MONAT = `Diese Mail kommt einmal je Stufe (80 %, 95 %, voll) und Abrechnungszeitraum von Resend; der neue Zeitraum beginnt am ${RESEND_ABRECHNUNG_TAG}. still bei 0. Abschalten lässt sie sich nicht – es geht um den Betrieb der Plattform.`
const FUSS_TAG = 'Dieser Hinweis kommt höchstens einmal am Morgen, wenn der Vortag 80 % erreicht hat. Abschalten lässt er sich nicht – es geht um den Betrieb der Plattform.'
const FUSS_ABLAUF = 'Höchstens eine Mail je Ablauf und Tag. Sobald er wieder läuft, kommt eine kurze Entwarnung.'
const FUSS_VERCEL = `Diese Mail kommt einmal je Stufe (50 %, 75 %, 100 %) und Abrechnungszeitraum; der neue Zeitraum beginnt am ${VERCEL_ABRECHNUNG_TAG}. still bei 0. Abschalten lässt sie sich nicht – es geht um den Betrieb der Plattform.`

/** Der Satz bei 100 % des Ausgabenlimits (Freigabe Nr. 113, wörtlich). */
const VERCEL_PAUSIERT = 'Vercel pausiert das Projekt – die Seite ist offline, bis du fortsetzt oder das Limit erhöhst.'
const VERCEL_BEI_VOLL = 'Bei 100 % pausiert Vercel das Projekt – die Seite ist dann offline, bis du fortsetzt oder das Limit erhöhst.'
const VERCEL_HILFT = 'In Vercel › Spend Management das Limit erhöhen; in Vercel › Usage steht, was die Kosten treibt.'

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
      // Derselbe Satz wie in der Warnkarte der Seite — mit den Bildern ohne Verwendung, sobald sie gezählt sind.
      hilft: hilftSatz(anlass.wert, anlass.ohneVerwendungBytes),
      knopf,
      fuss: regel === 'speicher' ? FUSS_SPEICHER : anlass.wert === 'mailsMonat' ? FUSS_MAILS_MONAT : regel === 'monat' ? FUSS_MONAT : FUSS_TAG,
    }
  }
  if (anlass.art === 'vercelAusgaben') {
    const titel = anlass.stufe === 3 ? 'Vercel-Ausgabenlimit erreicht' : `Vercel-Ausgaben ${VERCEL_STUFE_HINWEIS[anlass.stufe]}`
    return {
      betreff: `Betrieb: ${titel}`,
      titel,
      absaetze: [
        `Vercel meldet ${ausgabenText(anlass.ausgabenCent, anlass.limitCent)} des Ausgabenlimits in diesem Abrechnungszeitraum.`,
        anlass.stufe === 3 ? VERCEL_PAUSIERT : VERCEL_BEI_VOLL,
      ],
      hilft: VERCEL_HILFT,
      knopf,
      fuss: FUSS_VERCEL,
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
  const bilder = GRENZE.bilderBytes
  const vorgaenge = GRENZE.bildVorgaengeMonat
  if (wert === 'bilder') return bilder === null ? `${speicherText(zahl)} sind belegt` : `${speicherText(zahl)} von ${speicherText(bilder)} sind belegt`
  if (wert === 'datenbank') return `${speicherText(zahl)} von ${speicherText(GRENZE.datenbankBytes)} sind belegt`
  if (wert === 'mailsMonat') return `${formatZahl(zahl)} von ${formatZahl(GRENZE.mailsMonat)} E-Mails in diesem Monat`
  if (wert === 'bildVorgaenge')
    return vorgaenge === null ? `≈ ${formatZahl(zahl)} Bild-Vorgänge in diesem Monat` : `≈ ${formatZahl(zahl)} von ${formatZahl(vorgaenge)} Bild-Vorgängen in diesem Monat`
  return GRENZE.mailsTag === null ? `${formatZahl(zahl)} E-Mails gestern` : `${formatZahl(zahl)} von ${formatZahl(GRENZE.mailsTag)} E-Mails gestern`
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

/** Alle Messungen als CSV (UTF-8 mit BOM, Semikolon wie Admin › Finanzen) — nur Tag, Art, Zahl. */
export function messungenAlsCsv(messungen: ReadonlyArray<Pick<Messung, 'tag' | 'art' | 'wert'>>): string {
  const zeilen = [['Tag', 'Art', 'Wert'], ...[...messungen].sort((a, b) => a.tag.localeCompare(b.tag) || a.art.localeCompare(b.art)).map((m) => [m.tag, m.art, String(m.wert)])]
  return `\uFEFF${zeilen.map((z) => z.join(';')).join('\r\n')}\r\n`
}
