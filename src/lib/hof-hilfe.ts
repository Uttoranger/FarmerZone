/**
 * „Hilfe und Rückmeldung" im Hofbereich (Nachtlauf Nr. 22e; Mockups
 * web-/mobil-h6-meldung-abgeben, web-/mobil-h6-meine-meldungen): was die
 * beiden Seiten über die eigenen Meldungen sagen. Rein und ohne Datenbank
 * prüfbar (tests/beitraege-hilfe.test.ts).
 *
 * Grundlage ist immer die Hof-Sicht aus `fuerHof` (src/lib/meldung.ts) — hier
 * kommt nie ein Triage-Feld an. Meldungstext und Antwort sind Fremdtext und
 * bleiben Text: Sie werden nur gekürzt, nie als Markup gedeutet.
 */
import { MELDUNG_ART_LABEL, ersteZeile, type MeldungArt, type MeldungFuerHof, type MeldungTon } from '@/lib/meldung'
import { wienKalendertag } from '@/lib/kalender'
import { datumKurz } from '@/lib/verkauf-eintragen'

export const MEINE_MELDUNGEN_HREF = '/meldungen'
export const NEUE_MELDUNG_HREF = '/fehler-melden'

/** Art als Marke wie im Mockup: Fehler orange (etwas klemmt), Wunsch grün, Frage neutral. */
export const MELDUNG_ART_TON: Record<MeldungArt, MeldungTon> = {
  FEHLER: 'offen',
  WUNSCH: 'fertig',
  FRAGE: 'neutral',
}

/** Die Frage über dem Textfeld — passend zur gewählten Art (Mockup: „Was ist passiert?"). */
export const MELDUNG_TEXT_LABEL: Record<MeldungArt, string> = {
  FEHLER: 'Was ist passiert?',
  WUNSCH: 'Was wünschst du dir?',
  FRAGE: 'Was möchtest du wissen?',
}

export type MeldungZeile = {
  id: string
  kurznummer: string
  art: string
  artTon: MeldungTon
  /** Die erste Zeile des Texts, gekürzt — der volle Text bleibt beim Betreiber. */
  titel: string
  /** „Heute", „Gestern", „Fr, 26. Sep" — Wiener Tag. */
  datum: string
  status: string
  statusTon: MeldungTon
  /** Die Antwort des Betreibers; leer gilt als keine. */
  antwort: string | null
}

function hatAntwort(m: MeldungFuerHof): boolean {
  return (m.antwortAnMelder ?? '').trim() !== ''
}

/** Die Zeilen von „Meine Meldungen", in der Reihenfolge der Abfrage (neueste zuerst). */
export function meldungZeilen(meldungen: readonly MeldungFuerHof[], jetzt: Date): MeldungZeile[] {
  const heute = wienKalendertag(jetzt)
  return meldungen.map((m) => ({
    id: m.id,
    kurznummer: m.kurznummer,
    art: MELDUNG_ART_LABEL[m.art],
    artTon: MELDUNG_ART_TON[m.art],
    titel: ersteZeile(m.text, 120),
    datum: datumKurz(wienKalendertag(m.createdAt), heute),
    status: m.status,
    statusTon: m.statusTon,
    antwort: hatAntwort(m) ? (m.antwortAnMelder ?? '').trim() : null,
  }))
}

/**
 * Die Karte „Deine Meldungen" neben dem Formular: Offen = noch nicht
 * abgeschlossen, Beantwortet = mit Antwort des Betreibers. Beides kann auf
 * dieselbe Meldung zutreffen (In Arbeit mit Antwort) — es sind zwei Fragen,
 * keine Aufteilung.
 */
export function meldungenStand(meldungen: readonly MeldungFuerHof[]): { offen: number; beantwortet: number } {
  return {
    offen: meldungen.filter((m) => m.offen).length,
    beantwortet: meldungen.filter(hatAntwort).length,
  }
}

/**
 * Das Gerät in Worten für „Das schicken wir automatisch mit" („Chrome,
 * Windows"). Nur Anzeige — mitgeschickt wird die volle Browserangabe wie
 * bisher. Reihenfolge zählt: Edge und Opera nennen sich auch „Chrome", Chrome
 * nennt sich auch „Safari".
 */
export function geraetKurz(userAgent: string): string {
  const ua = userAgent.trim()
  if (ua === '') return '–'
  const browser = /Edg(e|A|iOS)?\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /SamsungBrowser\//.test(ua)
        ? 'Samsung Internet'
        : /Firefox\/|FxiOS\//.test(ua)
          ? 'Firefox'
          : /Chrome\/|CriOS\//.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : null
  const system = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Windows/.test(ua)
          ? 'Windows'
          : /CrOS/.test(ua)
            ? 'ChromeOS'
            : /Mac OS X|Macintosh/.test(ua)
              ? 'macOS'
              : /Linux/.test(ua)
                ? 'Linux'
                : null
  const teile = [browser, system].filter((t): t is string => t !== null)
  return teile.length > 0 ? teile.join(', ') : 'Unbekanntes Gerät'
}

/** Die Seite ohne Herkunft („/orders?filter=heute") — die Herkunft ist immer FarmerZone. */
export function seiteKurz(url: string): string {
  const roh = url.trim()
  if (roh === '') return '–'
  try {
    const adresse = new URL(roh)
    return `${adresse.pathname}${adresse.search}`
  } catch {
    return roh
  }
}
