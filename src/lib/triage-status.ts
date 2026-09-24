/**
 * Die Regeln der Schreibroute POST /api/triage/status (Sprint
 * Briefkasten-Rückkopplung, Teil B) — rein, ohne Datenbank prüfbar.
 *
 * GRUNDSATZ: Die KI kann vorschlagen und planen, nie erledigen. Deshalb zwei
 * Tokens mit getrennten Rechten:
 *   WRITE  (Rechner des Entwicklers, CLI)  VERMUTLICH_WUNSCH, GEPLANT
 *   MERGE  (nur GitHub Actions)            ERLEDIGT, Wiederöffnen (→ GEPRUEFT)
 * Den MERGE-Token gibt es nur in Vercel und GitHub — ein Agent auf dem Rechner
 * kann ERLEDIGT also nicht einmal versuchen.
 *
 * Die Route schreibt nie Text, den ein Melder sieht, außer den festen Sätzen
 * aus automatischeAntwort. Die Art einer Meldung ändert sie nie.
 */
import { geheimnisGleich } from './geheimnis'
import {
  KI_NOTIZ_PRAEFIX,
  TRIAGE_NOTIZ_MAX,
  ohneKiNotiz,
  type MeldungArt,
  type MeldungStatus,
  type ZielStatus,
} from './meldung'

export type TriageRolle = 'WRITE' | 'MERGE'

/** Welcher Token welchen Zielstatus setzen darf. GEPRUEFT heißt hier immer: wieder öffnen. */
export const ROLLE_JE_ZIEL: Record<ZielStatus, TriageRolle> = {
  VERMUTLICH_WUNSCH: 'WRITE',
  GEPLANT: 'WRITE',
  ERLEDIGT: 'MERGE',
  GEPRUEFT: 'MERGE',
}

/**
 * Aus welchen Status ein Ziel erreichbar ist.
 * - GEPLANT → GEPLANT: ein zweiter PR, wenn der erste verworfen wurde.
 * - ERLEDIGT → ERLEDIGT: ein zweites Deployment desselben Commits; schreibt nichts.
 * - Nie aus KEIN_FEHLER oder DUPLIKAT: das hat der Mensch entschieden.
 */
export const ERLAUBT_AUS: Record<ZielStatus, readonly MeldungStatus[]> = {
  VERMUTLICH_WUNSCH: ['NEU', 'GEPRUEFT'],
  GEPLANT: ['NEU', 'GEPRUEFT', 'VERMUTLICH_WUNSCH', 'GEPLANT'],
  ERLEDIGT: ['GEPLANT', 'ERLEDIGT'],
  GEPRUEFT: ['ERLEDIGT'],
}

/**
 * Nur bei Art FEHLER. Einen Wunsch oder eine Frage plant der Mensch im Admin;
 * ERLEDIGT hat diese Sperre bewusst NICHT — hat der Mensch einen Wunsch selbst
 * auf GEPLANT gesetzt, ist das seine Freigabe, und das Deployment schließt ihn.
 */
export const NUR_FEHLER: readonly ZielStatus[] = ['VERMUTLICH_WUNSCH', 'GEPLANT']

/** Woher ein ERLEDIGT kommt: vom Production-Deployment oder (Ersatzweg) vom Merge. */
export type Quelle = 'deployment' | 'merge'

/** Wie ein Ziel im Audit und in Fehlermeldungen heißt. */
const ZIEL_WORT: Record<ZielStatus, string> = {
  VERMUTLICH_WUNSCH: 'Vermutlich Wunsch',
  GEPLANT: 'Geplant',
  ERLEDIGT: 'Erledigt',
  GEPRUEFT: 'Wieder geöffnet',
}

const STATUS_WORT: Record<MeldungStatus, string> = {
  NEU: 'Neu',
  GEPRUEFT: 'Geprüft',
  VERMUTLICH_WUNSCH: 'Vermutlich Wunsch',
  GEPLANT: 'Geplant',
  ERLEDIGT: 'Erledigt',
  KEIN_FEHLER: 'Kein Fehler',
  DUPLIKAT: 'Duplikat',
}

export function tagesDatum(jetzt: Date): string {
  return jetzt.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Vienna' })
}

// ─── Token ──────────────────────────────────────────────────────────────────

export type TokenErgebnis = TriageRolle | 'unbekannt' | 'nicht-getrennt'

/**
 * Welche Rolle der Bearer-Token trägt. Fail-closed: ein fehlender Token passt
 * nie. Sind zwei der drei Tokens (Lesen, Write, Merge) gleich, gilt keiner —
 * sonst hätte, wer lesen darf, still auch Schreibrechte.
 */
export function rolleAusToken(
  authorization: string,
  tokens: { lesen?: string; write?: string; merge?: string }
): TokenErgebnis {
  const gesetzt = [tokens.lesen, tokens.write, tokens.merge].filter((t): t is string => typeof t === 'string' && t !== '')
  if (new Set(gesetzt).size !== gesetzt.length) return 'nicht-getrennt'
  if (tokens.write && geheimnisGleich(authorization, `Bearer ${tokens.write}`)) return 'WRITE'
  if (tokens.merge && geheimnisGleich(authorization, `Bearer ${tokens.merge}`)) return 'MERGE'
  return 'unbekannt'
}

// ─── Feste Sätze an den Melder ──────────────────────────────────────────────

/**
 * Der einzige Text, den die Route einem Melder schreibt. Für eine Frage gibt
 * es keinen: „online" beantwortet keine Frage — die Antwort schreibt der Mensch.
 */
export function automatischeAntwort(art: MeldungArt, quelle: Quelle, jetzt: Date): string | null {
  const wort = art === 'FEHLER' ? 'Behoben' : art === 'WUNSCH' ? 'Umgesetzt' : null
  if (!wort) return null
  return quelle === 'deployment'
    ? `${wort} — seit ${tagesDatum(jetzt)} online.`
    : `${wort} — kommt mit dem nächsten Update online.`
}

const AUTOMATISCHE_ANTWORT = /^(Behoben|Umgesetzt) — (seit \d{2}\.\d{2}\.\d{4} online|kommt mit dem nächsten Update online)\.$/

/** Stammt die Antwort wörtlich von automatischeAntwort? Nur dann darf das Wiederöffnen sie entfernen. */
export function istAutomatischeAntwort(antwort: string | null): boolean {
  return antwort !== null && AUTOMATISCHE_ANTWORT.test(antwort)
}

// ─── Triage-Notiz ───────────────────────────────────────────────────────────

export function auditZeile(ziel: ZielStatus, prNummer: number | null, jetzt: Date): string {
  const herkunft = prNummer !== null ? `PR #${prNummer}` : 'KI'
  return `[Auto · ${herkunft} · ${tagesDatum(jetzt)} · ${ZIEL_WORT[ziel]}]`
}

/**
 * Hält die Notiz unter TRIAGE_NOTIZ_MAX — sonst könnte der Mensch sie im
 * Admin nicht mehr speichern. Zuerst fallen die ältesten Audit-Zeilen, erst
 * danach (wenn die Notiz des Menschen allein fast voll ist) der Anfang.
 */
export function begrenzeNotiz(zeilen: readonly string[]): string {
  const rest = [...zeilen]
  const laenge = () => rest.join('\n').length
  while (laenge() > TRIAGE_NOTIZ_MAX) {
    const aelteste = rest.findIndex((z) => z.startsWith('[Auto · '))
    if (aelteste === -1 || aelteste === rest.length - 1) break
    rest.splice(aelteste, 1)
  }
  const text = rest.join('\n')
  return text.length > TRIAGE_NOTIZ_MAX ? text.slice(text.length - TRIAGE_NOTIZ_MAX) : text
}

// ─── Übergang ───────────────────────────────────────────────────────────────

export type GeleseneMeldung = {
  status: MeldungStatus
  art: MeldungArt
  triageNotiz: string | null
  antwortAnMelder: string | null
  sprintName: string | null
}

/** Die PR-Nummer aus „PR #<nr>" — so schreibt GEPLANT sie; sonst null. */
function geplanterPr(sprintName: string | null): number | null {
  const treffer = sprintName ? /^PR #(\d+)$/.exec(sprintName.trim()) : null
  return treffer ? Number(treffer[1]) : null
}

/** Ziele, die eine PR-Nummer brauchen — sie steht in sprintName und im Audit. */
const BRAUCHT_PR: readonly ZielStatus[] = ['GEPLANT', 'ERLEDIGT', 'GEPRUEFT']

export type Aenderung = {
  ziel: ZielStatus
  prNummer: number | null
  grund: string | null
  quelle: Quelle
}

export type Entscheidung =
  | {
      art: 'schreiben'
      daten: {
        status: MeldungStatus
        triageNotiz: string
        sprintName?: string
        triagedAt?: Date
        antwortAnMelder?: string | null
      }
    }
  | { art: 'unveraendert' }
  | { art: 'abgelehnt'; code: 'UEBERGANG' | 'FALSCHE_ART' | 'ANDERER_PR' | 'PR_FEHLT'; grund: string }

/**
 * DIE Entscheidung der Route: darf die Meldung vom gelesenen Status zum Ziel,
 * und was wird dabei geschrieben. Die Route liest, ruft das hier und schreibt
 * bedingt auf genau den gelesenen Stand.
 */
export function entscheideUebergang(m: GeleseneMeldung, a: Aenderung, jetzt: Date): Entscheidung {
  if (NUR_FEHLER.includes(a.ziel) && m.art !== 'FEHLER') {
    return {
      art: 'abgelehnt',
      code: 'FALSCHE_ART',
      grund: `„${ZIEL_WORT[a.ziel]}" gibt es nur für Fehler-Meldungen. Wünsche und Fragen entscheidest du im Admin.`,
    }
  }
  if (!ERLAUBT_AUS[a.ziel].includes(m.status)) {
    const von = ERLAUBT_AUS[a.ziel].map((s) => STATUS_WORT[s]).join(', ')
    return {
      art: 'abgelehnt',
      code: 'UEBERGANG',
      grund: `Die Meldung steht auf „${STATUS_WORT[m.status]}". „${ZIEL_WORT[a.ziel]}" geht nur aus: ${von}.`,
    }
  }
  // Das Schema verlangt die Nummer schon — die Regel verlässt sich nicht darauf.
  if (BRAUCHT_PR.includes(a.ziel) && a.prNummer === null) {
    return { art: 'abgelehnt', code: 'PR_FEHLT', grund: `„${ZIEL_WORT[a.ziel]}" braucht die Nummer des PR.` }
  }
  if (a.ziel === 'ERLEDIGT' && m.status === 'ERLEDIGT') return { art: 'unveraendert' }
  // Nur der PR, für den die Meldung eingeplant ist, schließt sie. Nennt ein
  // anderer PR die ID (Tippfehler, Zitat), läse der Melder sonst „Behoben",
  // obwohl der Fix noch gar nicht gemergt ist. Hat der Mensch im Admin ohne
  // PR-Nummer geplant (etwa einen Wunsch), gilt seine Freigabe für jeden PR.
  const eingeplant = geplanterPr(m.sprintName)
  if (a.ziel === 'ERLEDIGT' && eingeplant !== null && eingeplant !== a.prNummer) {
    return {
      art: 'abgelehnt',
      code: 'ANDERER_PR',
      grund: `Die Meldung ist für PR #${eingeplant} eingeplant, nicht für PR #${a.prNummer}.`,
    }
  }

  const audit = auditZeile(a.ziel, a.prNummer, jetzt)
  const notiz = (zeilen: readonly (string | null)[]) =>
    begrenzeNotiz(zeilen.filter((z): z is string => z !== null && z !== ''))

  switch (a.ziel) {
    case 'VERMUTLICH_WUNSCH':
      // Ein zweiter Vorschlag ersetzt den ersten, statt ihn zu stapeln.
      return {
        art: 'schreiben',
        daten: {
          status: 'VERMUTLICH_WUNSCH',
          triageNotiz: notiz([ohneKiNotiz(m.triageNotiz), `${KI_NOTIZ_PRAEFIX}${a.grund ?? ''}`, audit]),
        },
      }
    case 'GEPLANT':
      return {
        art: 'schreiben',
        daten: {
          status: 'GEPLANT',
          sprintName: `PR #${a.prNummer}`,
          triagedAt: jetzt,
          triageNotiz: notiz([m.triageNotiz, audit]),
        },
      }
    case 'ERLEDIGT': {
      const leer = m.antwortAnMelder === null || m.antwortAnMelder.trim() === ''
      const antwort = leer ? automatischeAntwort(m.art, a.quelle, jetzt) : null
      return {
        art: 'schreiben',
        daten: {
          status: 'ERLEDIGT',
          // triagedAt ist der Abschluss — ab ihm zählen die 90 Tage bis zum Löschen.
          triagedAt: jetzt,
          triageNotiz: notiz([m.triageNotiz, audit]),
          ...(antwort !== null ? { antwortAnMelder: antwort } : {}),
        },
      }
    }
    case 'GEPRUEFT':
      return {
        art: 'schreiben',
        daten: {
          status: 'GEPRUEFT',
          triageNotiz: notiz([m.triageNotiz, audit]),
          // Nur den festen Satz zurücknehmen — eine Antwort des Menschen bleibt.
          ...(istAutomatischeAntwort(m.antwortAnMelder) ? { antwortAnMelder: null } : {}),
        },
      }
  }
}
