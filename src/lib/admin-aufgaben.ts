import type { MeldungArt } from '@prisma/client'
import {
  ABLAEUFE,
  ADMIN_BETRIEB_HREF,
  ADMIN_BETRIEB_MAILS_HREF,
  UEBERFAELLIG_NACH_MS,
  ablaufStand,
  ablaufWarnArt,
  istMailWarnArt,
  warnHinweis,
  wartendeMailHinweis,
  zuletztText,
  type AblaufLaufDaten,
  type WartendeMail,
} from '@/lib/betrieb'
import { artName, fehlerText, wegName, type ProblemAuftrag } from '@/lib/betrieb-mails'
import { eingangAdresse, eingangMeldungAdresse, type ErstattungAufgabeRoh, type HofAufgabeRoh } from '@/lib/postfach'
import { MELDUNG_ART_LABEL, kurznummer } from '@/lib/meldung'
import { centsAlsEuro, formatEuro, formatTagKurz, formatZahl } from '@/lib/format'
import { TARIFE_AB_TAG } from '@/lib/konditionen'
import { wienWochenbeginn, wienWochenMontag } from '@/lib/kalender'
import { VORRANG } from '@/schemas/mail-auftrag'
import { kalendertagInWien } from '@/lib/wiener-tag'
import { uhrzeitInWien } from '@/lib/fristen'
import type { MarkeArt } from '@/lib/marke-art'
import { adminAktionSchema, ohnePersonendaten, type AdminAktionArt } from '@/schemas/admin-aktion'
import { SERVICEGEBUEHR_BEZEICHNUNG } from '@/lib/servicegebuehr'
import { ADMIN_HOEFE_HREF, adminHofHref } from '@/lib/admin-hof-akte'
import { ABWEICHUNG_FELD_TEXT, type OffeneAbweichung } from '@/lib/geld-abgleich'
import { bestellungenHref } from '@/lib/admin-bestellung'

/*
 * Admin › Heute (Register N32, Nr. 185): die EINE Liste „Braucht dich“ aus
 * allen Quellen, dazu die Texte der Seite. Rein, ohne Datenbank — die Daten
 * lädt src/server/queries/admin-heute.ts mit den bestehenden Abfragen
 * (Postfach-Eingang, Mail-Probleme, `ladeAeltesteWichtige`, Betrieb).
 *
 * Kein eigener Zustand: Jede Quelle ist eine reine Funktion `(stand, jetzt)`.
 * Ist die Ursache erledigt (Hof freigeschaltet, Erstattung abgeschlossen,
 * Mail verworfen, Warnung entwarnt), fehlt sie im Stand und damit hier —
 * nichts muss doppelt abgehakt werden.
 *
 * Nie Adresse, Name einer Person, Inhalt oder Token: Der Bezug ist eine
 * Kennung und ein Text aus Hofname, Bestellnummer oder Art.
 *
 * Gestapelt: 189 (Notbremse aktiv), 191 (Abweichung beim Geld) und 198 tragen
 * ihre Quellen hier ein — je Quelle eine Frist, ein Ziel und eine Funktion.
 */

const MINUTE_MS = 60_000
const STUNDE_MS = 60 * MINUTE_MS
const TAG_MS = 24 * STUNDE_MS

export const AUFGABE_QUELLEN = [
  'hof_wartet',
  'erstattung_offen',
  'mail_gescheitert',
  'mail_haengt',
  'meldung_neu',
  'betrieb_warnung',
  'uptime_still',
  'hof_ohne_abholzeit',
  'hof_ohne_bestellung',
  'geld_abweichung',
] as const

export type AufgabeQuelle = (typeof AUFGABE_QUELLEN)[number]

/** Das Wort vor dem Titel (Mockup admin-heute: „Geld“, „Höfe“, „E-Mails“, „Postfach“). */
export type AufgabeBereich = 'Höfe' | 'Geld' | 'E-Mails' | 'Postfach' | 'Betrieb'

/** „Was tun“ — der Knopf je Eintrag, aus dieser Liste und nirgends sonst. */
export const WAS_TUN = {
  pruefen: 'Prüfen',
  ansehen: 'Ansehen',
  oeffnen: 'Öffnen',
  hofAnsehen: 'Hof ansehen',
} as const

export type WasTun = keyof typeof WAS_TUN

export type AufgabeFrist = {
  /** Bis wann es erledigt sein soll. */
  ziel: Date
  /** Wie lange das Ziel ab `seit` ist (48 h, 24 h …) — für „Ziel 48 h“. */
  dauerMs: number
  ueberfaellig: boolean
}

export type Aufgabe = {
  quelle: AufgabeQuelle
  bereich: AufgabeBereich
  titel: string
  /** Kennung (Hof, Bestellnummer, Mail-Art …) und ein Text ohne Personendaten. */
  bezug: { kennung: string; text: string }
  /** Ein Satz, was los ist bzw. was hilft. */
  satz: string
  /** Seit wann die Ursache besteht. */
  seit: Date
  frist: AufgabeFrist
  wasTun: WasTun
  /** Wohin der Knopf führt (immer eine Admin-Seite). */
  ziel: string
}

/** Eine Meldung im Eingang — nur Art, erste Zeile und wer sie schickte (Hofname oder ein Wort, nie die Adresse). */
export type AufgabeMeldung = { id: string; art: MeldungArt; createdAt: Date; ersteZeile: string; von: string }

/** Ein verkaufender Hof für die Signale (freigeschaltet, nicht stillgelegt, nicht pausiert, kein Testhof). */
export type AufgabeHof = { id: string; name: string; approvedAt: Date; abholzeitAktiv: boolean; letzteBestellungAm: Date | null }

/** Alles, woraus die Quellen ihre Aufgaben bilden — geladen von ladeAufgabenStand. */
export type AufgabenStand = {
  hoefeWartend: readonly HofAufgabeRoh[]
  erstattungen: readonly ErstattungAufgabeRoh[]
  mailProbleme: readonly ProblemAuftrag[]
  wartendeMail: WartendeMail | null
  meldungen: readonly AufgabeMeldung[]
  warnungen: readonly { art: string; stufe: number; seit: Date }[]
  laeufe: ReadonlyMap<string, AblaufLaufDaten>
  hoefeAktiv: readonly AufgabeHof[]
  /** Offene Abweichungen aus dem Geld-Abgleich (Nr. 191) — nur Kennung, Feld und Cent. */
  geldAbweichungen: readonly OffeneAbweichung[]
}

/** Ein leerer Stand — Ausgangspunkt für Tests und für Bereiche, die außerhalb der Produktion nichts melden. */
export const LEERER_STAND: AufgabenStand = {
  hoefeWartend: [],
  erstattungen: [],
  mailProbleme: [],
  wartendeMail: null,
  meldungen: [],
  warnungen: [],
  laeufe: new Map(),
  hoefeAktiv: [],
  geldAbweichungen: [],
}

/** Ab wann ein verkaufender Hof ohne Bestellung auffällt (Register N32: „seit 14 Tagen ohne Bestellung“). */
export const OHNE_BESTELLUNG_TAGE = 14

/**
 * Das Ziel je Quelle (Freigabe 185; „am selben Tag“ = 12 h, „innerhalb
 * 1 Stunde“ und „diese Woche“ aus der Alarm-Matrix, ALARM_MATRIX in
 * src/lib/betrieb.ts). Eine Warnung des Betriebs hat zwei Ziele: Mail und
 * Abläufe 1 h, Grenzen 7 Tage (`betriebZiel`).
 */
export const AUFGABE_ZIEL_MS: Record<AufgabeQuelle, number> = {
  hof_wartet: 48 * STUNDE_MS,
  erstattung_offen: 24 * STUNDE_MS,
  mail_gescheitert: STUNDE_MS,
  mail_haengt: STUNDE_MS,
  meldung_neu: 7 * TAG_MS,
  betrieb_warnung: 7 * TAG_MS,
  uptime_still: 12 * STUNDE_MS,
  hof_ohne_abholzeit: 7 * TAG_MS,
  hof_ohne_bestellung: 7 * TAG_MS,
  geld_abweichung: 24 * STUNDE_MS,
}

const BEREICH: Record<AufgabeQuelle, AufgabeBereich> = {
  hof_wartet: 'Höfe',
  erstattung_offen: 'Geld',
  mail_gescheitert: 'E-Mails',
  mail_haengt: 'E-Mails',
  meldung_neu: 'Postfach',
  betrieb_warnung: 'Betrieb',
  uptime_still: 'Betrieb',
  hof_ohne_abholzeit: 'Höfe',
  hof_ohne_bestellung: 'Höfe',
  geld_abweichung: 'Geld',
}

// Die Höfe-Liste steht seit Nr. 185 unter /admin/hoefe; seit Nr. 187 hat jeder Hof eine Akte —
// Aufgaben zu einem Hof führen dorthin (adminHofHref), nicht in einen Listenfilter.
export { ADMIN_HOEFE_HREF }

type AufgabeTeile = Omit<Aufgabe, 'quelle' | 'bereich' | 'frist'>

function aufgabe(quelle: AufgabeQuelle, teile: AufgabeTeile, jetzt: Date, dauerMs: number = AUFGABE_ZIEL_MS[quelle]): Aufgabe {
  const ziel = new Date(teile.seit.getTime() + dauerMs)
  return { quelle, bereich: BEREICH[quelle], ...teile, frist: { ziel, dauerMs, ueberfaellig: ziel.getTime() < jetzt.getTime() } }
}

function mitAnzahlWort(n: number, eins: string, mehr: string): string {
  return `${formatZahl(n)} ${n === 1 ? eins : mehr}`
}

// ─── Quellen ─────────────────────────────────────────────────────────────────

function hofWartet(stand: AufgabenStand, jetzt: Date): Aufgabe[] {
  return stand.hoefeWartend.map((h) => {
    const angaben = [
      `Hofseite ${h.hofseite.erledigt} von ${h.hofseite.gesamt}`,
      h.stripeBereit ? 'Stripe eingerichtet' : 'Stripe fehlt',
      ...(h.futter && !h.lfbis ? ['LFBIS-Nummer fehlt'] : []),
      ...(h.email === 'bestaetigt' ? [] : ['E-Mail noch nicht bestätigt']),
    ]
    return aufgabe(
      'hof_wartet',
      {
        titel: 'Hof wartet auf Freischaltung',
        bezug: { kennung: h.id, text: `${h.name} · angemeldet ${zuletztText(h.createdAt, jetzt)}` },
        satz: `${angaben.join(' · ')}.`,
        seit: h.createdAt,
        wasTun: 'pruefen',
        ziel: eingangAdresse('aufgabe', { art: 'hof', id: h.id }),
      },
      jetzt
    )
  })
}

function erstattungOffen(stand: AufgabenStand, jetzt: Date): Aufgabe[] {
  return stand.erstattungen.map((e) =>
    aufgabe(
      'erstattung_offen',
      {
        titel: 'Erstattung offen',
        bezug: {
          kennung: e.bestellnummer,
          text: [e.bestellnummer, e.hofName, ...(e.bezahltCents === null ? [] : [formatEuro(centsAlsEuro(e.bezahltCents))])].join(' · '),
        },
        satz: 'Das Geld ist noch nicht bei der Kundin. Im Postfach steht, wie du die Erstattung abschließt.',
        seit: e.seit,
        wasTun: 'oeffnen',
        ziel: eingangAdresse('aufgabe', { art: 'erstattung', id: e.id }),
      },
      jetzt
    )
  )
}

/** Aufgegebene Mails (Status „gescheitert“), je Art eine Aufgabe — sonst stünden bei einem Ausfall von Resend hundert Zeilen da. */
function mailGescheitert(stand: AufgabenStand, jetzt: Date): Aufgabe[] {
  const jeArt = new Map<string, ProblemAuftrag[]>()
  for (const p of stand.mailProbleme) {
    if (p.status !== 'gescheitert') continue
    jeArt.set(p.art, [...(jeArt.get(p.art) ?? []), p])
  }
  return [...jeArt.entries()].map(([art, mails]) => {
    // Gescheitert heißt: `naechsterVersuchAm` ist der letzte Versuch. Die älteste bestimmt die Frist, die jüngste den Grund.
    const nachZeit = [...mails].sort((a, b) => a.naechsterVersuchAm.getTime() - b.naechsterVersuchAm.getTime())
    const aelteste = nachZeit[0]
    const juengste = nachZeit[nachZeit.length - 1]
    const grund = fehlerText(juengste.fehlerCode)
    return aufgabe(
      'mail_gescheitert',
      {
        titel: `${artName(art)} gescheitert`,
        bezug: { kennung: art, text: `${mitAnzahlWort(mails.length, 'Mail', 'Mails')} · Weg ${wegName(juengste.vorrang)}` },
        satz: `${grund.grund}. ${grund.tun}`,
        seit: aelteste.naechsterVersuchAm,
        wasTun: 'ansehen',
        ziel: ADMIN_BETRIEB_MAILS_HREF,
      },
      jetzt
    )
  })
}

/** Die älteste wichtige Mail wartet länger als MAIL_WARTET_MINUTEN (dieselbe Regel wie die Betriebsleiste bisher, Nr. 161). */
function mailHaengt(stand: AufgabenStand, jetzt: Date): Aufgabe[] {
  const hinweis = wartendeMailHinweis(stand.wartendeMail, jetzt)
  if (!hinweis || !stand.wartendeMail) return []
  return [
    aufgabe(
      'mail_haengt',
      {
        titel: hinweis.text,
        bezug: { kennung: 'warteschlange', text: `Weg ${wegName(VORRANG.wichtig)}` },
        satz: 'Die Warteschlange schickt sie von selbst. Hängt sie weiter, sieh unter E-Mails nach, warum.',
        seit: stand.wartendeMail.erstelltAm,
        wasTun: 'ansehen',
        ziel: ADMIN_BETRIEB_MAILS_HREF,
      },
      jetzt
    ),
  ]
}

/** Die erste Zeile nur, wenn sie weder Adresse noch Telefonnummer trägt (Wache des Protokolls) — sonst nur die Art. */
function meldungTitel(m: AufgabeMeldung): string {
  const zeile = m.ersteZeile.trim()
  if (zeile === '' || !ohnePersonendaten(zeile)) return `Neue Meldung: ${MELDUNG_ART_LABEL[m.art]}`
  return `Neue Meldung: „${zeile.length > 60 ? `${zeile.slice(0, 59)}…` : zeile}“`
}

function meldungNeu(stand: AufgabenStand, jetzt: Date): Aufgabe[] {
  return stand.meldungen.map((m) =>
    aufgabe(
      'meldung_neu',
      {
        titel: meldungTitel(m),
        bezug: { kennung: m.id, text: `${m.von} · ${MELDUNG_ART_LABEL[m.art]} · Nr. ${kurznummer(m.id)}` },
        satz: 'Lesen, einordnen und dem Hof antworten.',
        seit: m.createdAt,
        wasTun: 'oeffnen',
        ziel: eingangMeldungAdresse(m.id),
      },
      jetzt
    )
  )
}

/** Mail-Warnungen und ausgefallene Abläufe eilen (1 h), Grenzen und Vercel-Ausgaben haben die Woche (Alarm-Matrix). */
function betriebZiel(art: string): number {
  return art.startsWith('ablauf:') || istMailWarnArt(art) ? STUNDE_MS : AUFGABE_ZIEL_MS.betrieb_warnung
}

const UPTIME_ART = ablaufWarnArt('von-aussen')

/**
 * Offene Warnungen des Betriebs und überfällige Abläufe ohne Warnung (wie
 * `betriebHinweis`). Der Uptime-Dienst hat seine eigene Quelle; „Mail
 * wartet“ steht schon als „wichtige Mail hängt“ da und zählt nicht doppelt.
 */
function betriebWarnung(stand: AufgabenStand, jetzt: Date): Aufgabe[] {
  const mailHaengtDa = mailHaengt(stand, jetzt).length > 0
  const offen = stand.warnungen.filter((w) => w.stufe > 0 && w.art !== UPTIME_ART && !(mailHaengtDa && w.art === 'mail:wartet'))
  const ohneWarnung = ABLAEUFE.flatMap((a) => {
    const art = ablaufWarnArt(a.name)
    const lauf = stand.laeufe.get(a.name) ?? null
    if (a.rhythmus === 'vonAussen' || lauf === null || stand.warnungen.some((w) => w.art === art && w.stufe > 0)) return []
    if (ablaufStand(a, lauf, jetzt) !== 'ueberfaellig') return []
    return [{ art, stufe: 1, seit: new Date(lauf.gestartetAm.getTime() + UEBERFAELLIG_NACH_MS[a.rhythmus]) }]
  })
  return [...offen, ...ohneWarnung].map((w) =>
    aufgabe(
      'betrieb_warnung',
      {
        titel: warnHinweis(w.art, w.stufe).text,
        bezug: { kennung: w.art, text: 'Warnung des Betriebs' },
        satz: 'Die Einzelheiten und was hilft stehen unter Betrieb.',
        seit: w.seit,
        wasTun: 'ansehen',
        ziel: istMailWarnArt(w.art) ? ADMIN_BETRIEB_MAILS_HREF : ADMIN_BETRIEB_HREF,
      },
      jetzt,
      betriebZiel(w.art)
    )
  )
}

/** Der Uptime-Dienst ist still: überfällig (> 30 Min. kein Aufruf von /api/gesund) oder die Warnung steht noch. Ohne je einen Aufruf: nichts (noch nicht eingerichtet). */
function uptimeStill(stand: AufgabenStand, jetzt: Date): Aufgabe[] {
  const ablauf = ABLAEUFE.find((a) => a.name === 'von-aussen')
  const lauf = stand.laeufe.get('von-aussen') ?? null
  if (!ablauf || lauf === null) return []
  const warnung = stand.warnungen.find((w) => w.art === UPTIME_ART && w.stufe > 0)
  if (!warnung && ablaufStand(ablauf, lauf, jetzt) !== 'ueberfaellig') return []
  return [
    aufgabe(
      'uptime_still',
      {
        titel: 'Uptime-Dienst ist still',
        bezug: { kennung: 'von-aussen', text: `zuletzt ${zuletztText(lauf.gestartetAm, jetzt)}` },
        satz: 'Seit über 30 Minuten kein Aufruf von /api/gesund. Sieh beim Uptime-Dienst nach – solange er still ist, merkt niemand einen Ausfall.',
        seit: warnung?.seit ?? new Date(lauf.gestartetAm.getTime() + UEBERFAELLIG_NACH_MS.vonAussen),
        wasTun: 'ansehen',
        ziel: ADMIN_BETRIEB_HREF,
      },
      jetzt
    ),
  ]
}

/**
 * Ein verkaufender Hof ohne aktive Abholzeit hat nächste Woche keine.
 * Gemessen ab Wochenbeginn (Wien): Ziel ist der Beginn der nächsten Woche;
 * ein Hof, der in dieser Woche erst freigeschaltet wurde, ab da.
 */
function hofOhneAbholzeit(stand: AufgabenStand, jetzt: Date): Aufgabe[] {
  const wochenbeginn = wienWochenbeginn(jetzt)
  return stand.hoefeAktiv
    .filter((h) => !h.abholzeitAktiv)
    .map((h) =>
      aufgabe(
        'hof_ohne_abholzeit',
        {
          titel: 'Hof ohne Abholzeit nächste Woche',
          bezug: { kennung: h.id, text: h.name },
          satz: 'Ohne Abholzeit kann niemand bestellen. Den Hof anschreiben und fragen, ob er pausieren will.',
          seit: new Date(Math.max(h.approvedAt.getTime(), wochenbeginn.getTime())),
          wasTun: 'hofAnsehen',
          ziel: adminHofHref(h.id),
        },
        jetzt
      )
    )
}

/** Seit OHNE_BESTELLUNG_TAGE keine Bestellung (seit der Freischaltung, wenn es nie eine gab) — nur Höfe mit Abholzeit, die übrigen stehen schon oben. */
function hofOhneBestellung(stand: AufgabenStand, jetzt: Date): Aufgabe[] {
  const grenze = OHNE_BESTELLUNG_TAGE * TAG_MS
  return stand.hoefeAktiv.flatMap((h) => {
    if (!h.abholzeitAktiv) return []
    const letzte = h.letzteBestellungAm ?? h.approvedAt
    if (jetzt.getTime() - letzte.getTime() < grenze) return []
    return [
      aufgabe(
        'hof_ohne_bestellung',
        {
          titel: `Seit ${OHNE_BESTELLUNG_TAGE} Tagen ohne Bestellung`,
          bezug: { kennung: h.id, text: h.letzteBestellungAm ? `${h.name} · letzte ${zuletztText(h.letzteBestellungAm, jetzt)}` : `${h.name} · nie bestellt` },
          satz: 'Nachfragen, ob Angebot, Fotos und Abholzeit stimmen.',
          seit: new Date(letzte.getTime() + grenze),
          wasTun: 'hofAnsehen',
          ziel: adminHofHref(h.id),
        },
        jetzt
      ),
    ]
  })
}

/**
 * Abweichung beim Geld (Nr. 191, N37): Der Geld-Abgleich fand Datenbank und
 * Stripe nicht gleich — je Bestellung eine Aufgabe mit Nummer, Feld und
 * Unterschied in Cent. Die älteste Abweichung der Bestellung bestimmt die
 * Frist (24 h, wie eine offene Erstattung). Stimmen beide wieder, löscht der
 * nächste Lauf die Zeile, und die Aufgabe verschwindet von selbst.
 */
function geldAbweichung(stand: AufgabenStand, jetzt: Date): Aufgabe[] {
  const jeBestellung = new Map<string, OffeneAbweichung[]>()
  for (const a of stand.geldAbweichungen) jeBestellung.set(a.orderId, [...(jeBestellung.get(a.orderId) ?? []), a])
  return [...jeBestellung.values()].map((liste) => {
    const erste = liste.reduce((a, b) => (b.seit.getTime() < a.seit.getTime() ? b : a))
    const teile = liste.map((a) => `${ABWEICHUNG_FELD_TEXT[a.feld]} ${a.differenzCents > 0 ? '+' : '−'}${formatEuro(centsAlsEuro(Math.abs(a.differenzCents)))}`)
    return aufgabe(
      'geld_abweichung',
      {
        titel: 'Abweichung beim Geld',
        bezug: { kennung: erste.orderNumber, text: [erste.orderNumber, ...teile].join(' · ') },
        satz: 'Die Datenbank und Stripe sagen nicht dasselbe (Plus: die Datenbank hat mehr). Bei Stripe nachsehen und die Bestellung prüfen.',
        seit: erste.seit,
        wasTun: 'pruefen',
        ziel: bestellungenHref({}, { suche: erste.orderNumber }),
      },
      jetzt
    )
  })
}

/** Das Register: je Quelle eine reine Funktion `(stand, jetzt) → Aufgabe[]`. */
export const ADMIN_AUFGABEN: Record<AufgabeQuelle, (stand: AufgabenStand, jetzt: Date) => Aufgabe[]> = {
  hof_wartet: hofWartet,
  erstattung_offen: erstattungOffen,
  mail_gescheitert: mailGescheitert,
  mail_haengt: mailHaengt,
  meldung_neu: meldungNeu,
  betrieb_warnung: betriebWarnung,
  uptime_still: uptimeStill,
  hof_ohne_abholzeit: hofOhneAbholzeit,
  hof_ohne_bestellung: hofOhneBestellung,
  geld_abweichung: geldAbweichung,
}

/** Alle Aufgaben aus allen Quellen, nach Frist sortiert (das nächste Ziel zuerst — überfällige stehen damit oben). */
export function sammleAufgaben(stand: AufgabenStand, jetzt: Date): Aufgabe[] {
  return AUFGABE_QUELLEN.flatMap((q) => ADMIN_AUFGABEN[q](stand, jetzt)).sort((a, b) => a.frist.ziel.getTime() - b.frist.ziel.getTime())
}

export type AufgabenZahl = { offen: number; ueberfaellig: number }

export function aufgabenZahl(aufgaben: readonly Aufgabe[]): AufgabenZahl {
  return { offen: aufgaben.length, ueberfaellig: aufgaben.filter((a) => a.frist.ueberfaellig).length }
}

// ─── Texte ───────────────────────────────────────────────────────────────────

/** „40 Min.“, „21 h“, „3 Tage“ — abgerundet, nie „0 Min.“; bis `stundenBis` in Stunden (das Ziel „48 h“ bleibt so stehen). */
function dauerText(ms: number, dativ: boolean, stundenBis = 47): string {
  const minuten = Math.max(1, Math.floor(ms / MINUTE_MS))
  if (minuten < 60) return `${formatZahl(minuten)} Min.`
  const stunden = Math.floor(minuten / 60)
  if (stunden <= stundenBis) return `${formatZahl(stunden)} h`
  const tage = Math.floor(stunden / 24)
  return `${formatZahl(tage)} ${dativ ? 'Tagen' : 'Tage'}`
}

/** „überfällig · seit 2 Tagen“ bzw. „Ziel 48 h · noch 21 h“ (Mockup admin-heute). „überfällig“ steht als Wort da, nie nur als Farbe. */
export function fristText(a: Pick<Aufgabe, 'seit' | 'frist'>, jetzt: Date): string {
  if (a.frist.ueberfaellig) return `überfällig · seit ${dauerText(jetzt.getTime() - a.seit.getTime(), true)}`
  return `Ziel ${dauerText(a.frist.dauerMs, false, 48)} · noch ${dauerText(a.frist.ziel.getTime() - jetzt.getTime(), false)}`
}

/** „4 offen · 1 überfällig“ bzw. „4 offen“. */
export function zahlText(zahl: AufgabenZahl): string {
  return zahl.ueberfaellig > 0 ? `${formatZahl(zahl.offen)} offen · ${formatZahl(zahl.ueberfaellig)} überfällig` : `${formatZahl(zahl.offen)} offen`
}

/** Betriebsleiste (Nr. 185 Punkt 4): „4 offen · 1 überfällig – ansehen“, am Handy „4 offen – ansehen“. Nichts offen: keine Zeile. */
export type AufgabenLeiste = { text: string; kurz: string; href: string }

export function aufgabenLeiste(zahl: AufgabenZahl | null | undefined): AufgabenLeiste | null {
  if (!zahl || zahl.offen === 0) return null
  return { text: `${zahlText(zahl)} – ansehen`, kurz: `${formatZahl(zahl.offen)} offen – ansehen`, href: ADMIN_HEUTE_HREF }
}

export const ADMIN_HEUTE_HREF = '/admin'

/**
 * Die alte Adresse der Höfe-Liste (`/admin?reiter=…`, `?filter=…`, `?suche=…`)
 * führt seit Nr. 185 nach /admin/hoefe — mit denselben Parametern. Heute
 * selbst hat keine; jede Adresse mit Parametern ist darum eine alte.
 */
export function alteHoefeAdresse(parameter: Record<string, string | string[] | undefined>): string | null {
  const q = new URLSearchParams()
  for (const [name, wert] of Object.entries(parameter)) {
    for (const w of Array.isArray(wert) ? wert : wert === undefined ? [] : [wert]) q.append(name, w)
  }
  const text = q.toString()
  return text === '' ? null : `${ADMIN_HOEFE_HREF}?${text}`
}

/** Alle Sätze von Admin › Heute — EINE Quelle (Mockups admin-heute, mobil-admin-heute). */
export const HEUTE_TEXT = {
  titel: 'Heute',
  satz: 'Was dich braucht, was von selbst läuft, was kommt – der Einstieg für jeden Tag.',
  stand: (jetzt: Date): string => `${formatTagKurz(kalendertagInWien(jetzt))} · Stand ${uhrzeitInWien(jetzt)}`,
  brauchtDich: 'Braucht dich',
  leer: 'Nichts offen. Was dazukommt, steht hier von selbst.',
  regel:
    'Alles aus Höfe, Bestellungen, Geld, E-Mails und Postfach an einer Stelle – sortiert nach Frist. Erledigt verschwindet von selbst; nichts muss doppelt abgehakt werden.',
  lage: 'Lage heute',
  laeuft: 'Läuft von selbst',
  laeuftZusatz: 'heute',
  kommt: 'Kommt',
  kommtZusatz: 'nächste Termine',
  kommtLeer: 'Nichts geplant.',
  routine: 'Montags-Routine',
  routineZusatz: '10 Minuten',
  protokoll: 'Zuletzt im Protokoll',
  protokollZusatz: 'wer hat was getan',
  protokollLeer: 'Noch nichts im Protokoll.',
  fehler: 'Wir konnten Heute gerade nicht laden.',
} as const

// ─── Lage ────────────────────────────────────────────────────────────────────

/** Die Woche aller Höfe nach der Umsatzregel (abgeholt seit Montag, ohne Testzahlungen); Beträge in Cent. */
export type HeuteWoche = {
  umsatzCents: number
  /** Servicegebühr dieser Bestellungen, ohne entfallene. */
  gebuehrCents: number
  anzahl: number
  /** Dieselbe Zahl in der Vorwoche bis zum selben Zeitpunkt. */
  anzahlVorwoche: number
}

/** „Woche: 118 (+9 % zur Vorwoche)“ — ohne Bestellung in der Vorwoche kein Prozent. */
export function wochenZeile(w: Pick<HeuteWoche, 'anzahl' | 'anzahlVorwoche'>): string {
  // Dieselbe Rundung wie `wochenvergleich` (src/lib/heute.ts) — nicht importiert, weil diese Datei auch im Browser der Betriebsleiste landet.
  const prozent = w.anzahlVorwoche > 0 ? Math.round(((w.anzahl - w.anzahlVorwoche) / w.anzahlVorwoche) * 100) : null
  const vergleich = prozent === null ? 'Vorwoche: keine' : `${prozent > 0 ? '+' : prozent < 0 ? '−' : '±'}${formatZahl(Math.abs(prozent))} % zur Vorwoche`
  return `Woche: ${formatZahl(w.anzahl)} (${vergleich})`
}

export type HeuteLage = {
  bestellungen: { zurAbholung: number; nichtGepackt: number; storniert: number }
  woche: HeuteWoche
  dienste: { laufen: number; von: number; ansehen: readonly string[]; testbetrieb: boolean }
  hoefe: { verkaufen: number; warten: number }
  /** Der letzte erfolgreiche Geld-Abgleich (Nr. 191); null = noch keiner (außerhalb der Produktion immer). */
  geldAbgleichOk?: boolean
}

export type LageKachel = {
  id: 'bestellungen' | 'geld' | 'dienste' | 'hoefe'
  titel: string
  wert: string
  einheit: string
  /** Das Zustandswort — nie nur Farbe; fehlt, wo es nichts zu sagen gibt. */
  marke: { wort: string; art: MarkeArt } | null
  zeilen: string[]
}

/** Die vier Lage-Kacheln (Mockup admin-heute): Bestellungen heute, Geld · Woche, Dienste, Höfe. Ton nur bei Handlungsbedarf. */
export function lageKacheln(lage: HeuteLage, aufgaben: readonly Aufgabe[]): LageKachel[] {
  const b = lage.bestellungen
  const d = lage.dienste
  const ohneAbholzeit = aufgaben.filter((a) => a.quelle === 'hof_ohne_abholzeit').length
  const ohneBestellung = aufgaben.filter((a) => a.quelle === 'hof_ohne_bestellung').length
  const abweichungen = aufgaben.filter((a) => a.quelle === 'geld_abweichung').length
  return [
    {
      id: 'bestellungen',
      titel: 'Bestellungen heute',
      wert: formatZahl(b.zurAbholung),
      einheit: 'zur Abholung',
      // Wort aus dem Mockup; einen Rahmen, der „zu viel“ meldet, gibt es (noch) nicht — darum kein `tun`.
      marke: { wort: 'Im Rahmen', art: 'laeuft' },
      zeilen: [`${formatZahl(b.nichtGepackt)} noch nicht gepackt · ${mitAnzahlWort(b.storniert, 'Storno', 'Stornos')}`, wochenZeile(lage.woche)],
    },
    {
      id: 'geld',
      titel: 'Geld · Woche',
      wert: formatEuro(centsAlsEuro(lage.woche.umsatzCents), 0),
      einheit: 'Umsatz der Höfe',
      // „stimmt“ nur nach einem erfolgreichen Abgleich (Nr. 191); „Auszahlung Do“ hat keine Quelle im Code und fehlt weiter.
      marke: lage.geldAbgleichOk ? (abweichungen === 0 ? { wort: 'stimmt', art: 'laeuft' } : { wort: mitAnzahlWort(abweichungen, 'Abweichung', 'Abweichungen'), art: 'tun' }) : null,
      zeilen: [
        `${SERVICEGEBUEHR_BEZEICHNUNG} ${formatEuro(centsAlsEuro(lage.woche.gebuehrCents))}`,
        ...(lage.geldAbgleichOk ? [abweichungen === 0 ? 'Abgleich mit Stripe ohne Abweichung' : 'Abgleich mit Stripe: Abweichung in Braucht dich'] : []),
      ],
    },
    {
      id: 'dienste',
      titel: 'Dienste',
      wert: `${formatZahl(d.laufen)} von ${formatZahl(d.von)}`,
      einheit: 'laufen',
      marke: d.ansehen.length === 0 ? { wort: 'gut', art: 'laeuft' } : { wort: `${formatZahl(d.ansehen.length)} ansehen`, art: 'tun' },
      zeilen: [
        d.ansehen.length === 0 ? 'Stripe · Resend · Datenbank · Abläufe · Uptime' : `Ansehen: ${d.ansehen.join(' · ')}`,
        ...(d.testbetrieb ? ['Stripe im Testmodus – bekannt, kein Alarm'] : []),
      ],
    },
    {
      id: 'hoefe',
      titel: 'Höfe',
      wert: formatZahl(lage.hoefe.verkaufen),
      einheit: 'verkaufen',
      marke: lage.hoefe.warten > 0 ? { wort: `${formatZahl(lage.hoefe.warten)} warten`, art: 'tun' } : null,
      zeilen: [`${formatZahl(ohneBestellung)} seit ${OHNE_BESTELLUNG_TAGE} Tagen ohne Bestellung`, `${formatZahl(ohneAbholzeit)} ohne Abholzeit nächste Woche`],
    },
  ]
}

// ─── Kommt ───────────────────────────────────────────────────────────────────

/** Eigene Termine (Freigabe 185: „aus einer Konstante“). Vergangene fallen von selbst weg. */
export const HEUTE_TERMINE: readonly { titel: string; am: string; satz: string }[] = [
  // Der Stichtag nur aus src/lib/konditionen.ts (tests/konditionen-uebergang.test.ts).
  { titel: 'Plattformgebühr im Hofpreis (Register N38)', am: TARIFE_AB_TAG, satz: 'Vorgabe-Stichtag · Rechtstexte müssen vorher stehen' },
]

export type KommtEintrag = { titel: string; wann: string; marke: { wort: string; art: MarkeArt }; kalendertag: string }

/**
 * „Kommt“: die nächste geplante Fassung der Startseite, das Festschreiben der
 * Gründungsaktion (solange nicht festgeschrieben) und die eigenen Termine —
 * nach Tag sortiert.
 */
export function kommtEintraege(e: { naechsteFassung: Date | null; gruendungAktionBisTag: string | null; gruendungFest: boolean }, jetzt: Date): KommtEintrag[] {
  const heute = kalendertagInWien(jetzt)
  const eintraege: KommtEintrag[] = []
  if (e.naechsteFassung) {
    const tag = kalendertagInWien(e.naechsteFassung)
    eintraege.push({
      titel: 'Startseite: geplante Fassung',
      wann: `${formatTagKurz(tag)}, ${uhrzeitInWien(e.naechsteFassung)} · geht von selbst live`,
      marke: { wort: 'geplant', art: 'laeuft' },
      kalendertag: tag,
    })
  }
  if (!e.gruendungFest && e.gruendungAktionBisTag !== null && e.gruendungAktionBisTag >= heute) {
    eintraege.push({
      titel: 'Gründungsaktion festschreiben',
      wann: `${formatTagKurz(e.gruendungAktionBisTag)} · Einstellungen`,
      marke: { wort: 'Termin', art: 'erledigt' },
      kalendertag: e.gruendungAktionBisTag,
    })
  }
  for (const t of HEUTE_TERMINE) {
    if (t.am >= heute) eintraege.push({ titel: t.titel, wann: `${formatTagKurz(t.am)} · ${t.satz}`, marke: { wort: 'Termin', art: 'erledigt' }, kalendertag: t.am })
  }
  return eintraege.sort((a, b) => a.kalendertag.localeCompare(b.kalendertag))
}

// ─── Montags-Routine ─────────────────────────────────────────────────────────

/**
 * Die Montags-Routine (docs/betrieb/handbuch.md, „Montag (10 Minuten)“; die
 * Punkte wie im Mockup admin-heute). Die Haken stehen nur im Browser
 * (localStorage, je Woche ein Schlüssel) — eine Merkhilfe, kein Zustand der
 * Plattform.
 */
export const MONTAGS_ROUTINE = [
  { id: 'braucht-dich', text: 'Braucht dich leer oder geplant' },
  { id: 'abholzeit', text: 'Höfe ohne Abholzeit angeschrieben' },
  { id: 'sentry', text: 'Sentry: neue Fehler angesehen' },
  { id: 'geld', text: 'Geld: Woche mit Stripe-Auszahlung abgeglichen' },
  { id: 'notfall', text: 'Betriebshandbuch: ein Notfall gelesen' },
] as const

export type RoutinePunkt = (typeof MONTAGS_ROUTINE)[number]['id']

/** Der Schlüssel im Browser-Speicher: je Wiener Woche einer — am Montag beginnt die Liste leer. */
export function routineSchluessel(jetzt: Date): string {
  return `fz_admin_montag_${wienWochenMontag(jetzt)}`
}

/** Was im Speicher steht, als Liste bekannter Punkte — alles andere (kaputt, fremd, alt) fällt weg. */
export function leseRoutine(roh: string | null): RoutinePunkt[] {
  if (!roh) return []
  let wert: unknown
  try {
    wert = JSON.parse(roh)
  } catch {
    return []
  }
  if (!Array.isArray(wert)) return []
  return MONTAGS_ROUTINE.map((p) => p.id).filter((id) => wert.includes(id))
}

export function routineZeile(erledigt: number): string {
  return `${formatZahl(erledigt)} von ${MONTAGS_ROUTINE.length} erledigt`
}

// ─── Protokoll ───────────────────────────────────────────────────────────────

/**
 * Wie eine Art im Protokoll heißt. Teilweise: Was gestapelte Nummern neu
 * eintragen, heißt bis dahin „Admin-Aktion“ — ein fehlender Text bricht nie
 * die Seite.
 */
export const PROTOKOLL_TEXT: Partial<Record<AdminAktionArt, string>> = {
  hof_freigeschaltet: 'Hof freigeschaltet',
  hof_freigabe_entzogen: 'Freischaltung zurückgenommen',
  hof_abgelehnt: 'Hof abgelehnt',
  servicegebuehr_geaendert: 'Servicegebühr geändert',
  gruendung_bis_geaendert: 'Gründungshof-Ende geändert',
  gruendung_ausgenommen: 'Aus der Gründungsaktion genommen',
  gruendung_wieder_aufgenommen: 'In die Gründungsaktion aufgenommen',
  gruendung_festgeschrieben: 'Gründungsaktion festgeschrieben',
  gruendung_einstellung_geaendert: 'Gründungshöfe eingestellt',
  testhof_markiert: 'Testhof markiert',
  testhof_zurueckgenommen: 'Testhof zurückgenommen',
  rundschreiben_gesendet: 'Rundschreiben gesendet',
  meldung_triagiert: 'Meldung eingeordnet',
  meldung_buendel_stand: 'Wunsch-Bündel geändert',
  meldung_abgelegt: 'Meldung abgelegt',
  team_antwort: 'Hof geantwortet',
  mail_jetzt_geschickt: 'Mail jetzt geschickt',
  mail_verworfen: 'Mail verworfen',
  mail_nochmal: 'Mail nochmal geschickt',
  mail_art_nochmal: 'Mails einer Art nochmal geschickt',
  betrieb_gemessen: 'Betrieb gemessen',
  kostenposten_angelegt: 'Kosten eingetragen',
  kostenposten_geaendert: 'Kosten geändert',
  kostenposten_beendet: 'Kosten beendet',
  kostenposten_geloescht: 'Kosten gelöscht',
  finanzen_export: 'Geld als CSV geladen',
  monat_abgeschlossen: 'Monat abgeschlossen',
  erstattung_erledigt: 'Erstattung als erledigt markiert',
  empfaenger_hinzugefuegt: 'Empfänger hinzugefügt',
  empfaenger_entfernt: 'Empfänger entfernt',
  zustellregeln_geaendert: 'Zustellung geändert',
  testmail_gesendet: 'Testmail gesendet',
  startseite_block_geloescht: 'Block der Startseite gelöscht',
  startseite_veroeffentlicht: 'Startseite veröffentlicht',
  startseite_zurueckgezogen: 'Geplante Startseite zurückgezogen',
  startseite_uebernommen: 'Fassung als Entwurf übernommen',
  ersatzcodes_erstellt: 'Ersatzcodes erstellt',
  passkey_entfernt: 'Passkey entfernt',
}

export type ProtokollRoh = { wann: Date; wer: string | null; art: string }
export type ProtokollZeile = { wer: string; text: string; wann: string }

const artSchema = adminAktionSchema.shape.art

/** Die Art steht als Text in der Datenbank — erst geprüft, eine unbekannte heißt „Admin-Aktion“. */
function protokollText(art: string): string {
  const geprueft = artSchema.safeParse(art)
  return (geprueft.success ? PROTOKOLL_TEXT[geprueft.data] : undefined) ?? 'Admin-Aktion'
}

/** „Du“, „Team“ oder „System“ — nie ein Name (Register N33). */
export function protokollZeilen(zeilen: readonly ProtokollRoh[], ichId: string, jetzt: Date): ProtokollZeile[] {
  return zeilen.map((z) => ({
    wer: z.wer === null ? 'System' : z.wer === ichId ? 'Du' : 'Team',
    text: protokollText(z.art),
    wann: zuletztText(z.wann, jetzt),
  }))
}
