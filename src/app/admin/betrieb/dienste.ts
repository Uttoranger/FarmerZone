import { zuletztText, type AblaufStand } from '@/lib/betrieb'
import type { MarkeArt } from '@/lib/marke-art'
import type { StripeMarke } from '@/lib/testumgebung'

/*
 * Admin › Betrieb › Überblick, Karten „Dienste“ und „Version“ (Register N18,
 * Ergänzung 26.10.2026; Nr. 184; Board admin-betrieb-neu) — rein, ohne
 * Datenbank: Die Seite gibt hinein, was sie ohnehin geladen hat.
 *
 * Je Dienst eine Zeile mit Prüfweg (wie er geprüft wird) und einer Marke.
 * Was die App selbst nicht sehen kann (Sentry, der Workflow bei GitHub),
 * trägt die Marke „bei Sentry“ bzw. „bei GitHub“ statt eines erfundenen „ok“.
 */

export type DienstZeile = { dienst: string; satz: string; art: MarkeArt; marke: string }

export type DiensteEingabe = {
  stripe: StripeMarke | null
  testbetrieb: boolean
  mailWarnungOffen: boolean
  /** „15 MB von 8 GB“ aus der Messung, null ohne Messung. */
  datenbank: string | null
  /** Die Antwortzeit von `SELECT 1` beim Aufbau dieser Seite, null wenn sie scheiterte. */
  antwortMs: number | null
  ablaeufe: { puenktlich: number; von: number; ausgefallen: boolean }
  vonAussen: { stand: AblaufStand; gestartetAm: Date | null }
}

const OK = { art: 'laeuft', marke: 'ok' } as const
const TUN = { art: 'tun', marke: 'ansehen' } as const

/** „Noch nicht eingerichtet“ — der Uptime-Dienst hat /api/gesund nie aufgerufen (keine Warnung, N18-Ergänzung). */
export const NOCH_NICHT_EINGERICHTET = 'noch nicht eingerichtet'

export const DIENSTE_TEXT = {
  titel: 'Dienste',
  zusatz: 'je mit Prüfweg',
  versionTitel: 'Version',
  versionZusatz: 'was gerade live ist',
  matrixTitel: 'Alarm-Matrix',
  matrixZusatz: 'welches Signal wie kommt',
  matrixSpalten: { signal: 'Signal', weg: 'Weg', reaktion: 'Reaktion' },
} as const

export function dienstZeilen(e: DiensteEingabe, jetzt: Date): DienstZeile[] {
  const uptime = ((): DienstZeile => {
    const dienst = 'Uptime-Dienst'
    if (e.vonAussen.stand === 'nochKeinLauf' || e.vonAussen.gestartetAm === null) {
      return { dienst, satz: 'Noch nicht eingerichtet – dann ruft er /api/gesund alle 5 Min. und schickt dir einen Push aufs Handy.', art: 'erledigt', marke: NOCH_NICHT_EINGERICHTET }
    }
    const zuletzt = zuletztText(e.vonAussen.gestartetAm, jetzt)
    if (e.vonAussen.stand === 'puenktlich') return { dienst, satz: `ruft /api/gesund alle 5 Min. · zuletzt ${zuletzt} · Push an dein Handy`, ...OK }
    return { dienst, satz: `Still seit ${zuletzt} – länger als 30 Minuten kein Aufruf von /api/gesund. Sieh beim Uptime-Dienst nach.`, ...TUN }
  })()

  return [
    e.stripe === null
      ? { dienst: 'Stripe', satz: 'Kein Schlüssel eingerichtet – ohne ihn geht keine Online-Zahlung.', ...TUN }
      : { dienst: 'Stripe', satz: `${e.stripe.text} · jede Zahlung meldet sich über den Webhook${e.testbetrieb ? ' · Testmodus (bekannt)' : ''}`, ...OK },
    e.mailWarnungOffen
      ? { dienst: 'Resend', satz: 'Eine Warnung zu den E-Mails ist offen – die Einzelheiten stehen unter E-Mails.', ...TUN }
      : { dienst: 'Resend', satz: 'Mail-Warteschlange jede Minute · Zustellung unter E-Mails', ...OK },
    e.antwortMs === null
      ? { dienst: 'Datenbank', satz: 'Die Probe beim Laden dieser Seite hat nicht geantwortet.', ...TUN }
      : { dienst: 'Datenbank', satz: `${e.datenbank ?? 'noch nicht gemessen'} · Antwort ${e.antwortMs} ms`, ...OK },
    { dienst: 'Abläufe', satz: `${e.ablaeufe.puenktlich} von ${e.ablaeufe.von} pünktlich · E-Mails jede Minute`, ...(e.ablaeufe.ausgefallen ? TUN : OK) },
    { dienst: 'Fehler (Sentry)', satz: 'Mail und App nur bei neuen Fehlern · bekannte Zustände höchstens einmal je Tag und Deploy', art: 'erledigt', marke: 'bei Sentry' },
    uptime,
    { dienst: 'Lebenszeichen (GitHub)', satz: 'prüft die Abläufe alle 15 Min. · scheitert es, schreibt dir GitHub eine Mail', art: 'erledigt', marke: 'bei GitHub' },
  ]
}

export type VersionZeile = { name: string; wert: string }
export type LetzteMigration = { name: string; am: Date } | null

/** Die Karte „Version“: Commit des Deploys, letzte angewandte Migration, der Weg zurück. */
export function versionZeilen(commit: string | null, branch: string | null, migration: LetzteMigration | undefined, jetzt: Date): VersionZeile[] {
  const sha = commit?.trim().slice(0, 7) || null
  return [
    { name: 'Commit', wert: sha ? (branch ? `${sha} · ${branch}` : sha) : 'lokal – ohne Commit von Vercel' },
    {
      name: 'Letzte Migration',
      wert: migration === undefined ? 'gerade nicht lesbar' : migration === null ? 'keine' : `${migration.name} · angewandt ${zuletztText(migration.am, jetzt)}`,
    },
    { name: 'Zurück', wert: 'Vercel › Deployments › „Instant Rollback“' },
  ]
}
