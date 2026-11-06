import { lstatSync, readdirSync, readlinkSync } from 'node:fs'
import { basename, join } from 'node:path'
import { istTestDatenbank } from '../../src/lib/umgebung'

/**
 * Die Loopback-Sperre des Prüfwerkzeugs (freigabe.md §36, „Prüf-Umgebung und
 * Admin-Abnahme“; Register N46, Ergänzung N20).
 *
 * Warum so streng: Der Prüf-Seed schreibt eine Passkey-Zeile für das
 * Betreiber-Konto und signierte Links mit dem Prüf-Geheimnis. Beides darf es nur
 * in einer Wegwerf-Datenbank auf diesem Rechner geben — in der Entwicklungs-
 * datenbank gibt es dasselbe Konto mit öffentlichem Seed-Passwort, ein Passkey
 * dort öffnete den Admin für jeden, der diese Datei liest.
 *
 * Rein bis auf das Lesen von Ordnern: Diese Datei importiert weder Prisma noch
 * auth noch env. Sie läuft deshalb als ERSTES, bevor ein Aufrufer einen Client
 * baut (pruef-seed.ts, sperre-cli.ts für fotograf.sh und passkey-browser.mjs).
 * `istTestDatenbank` bleibt unverändert die Quelle; hier kommt nur die engere
 * Auswahl dazu (kein „postgres“, kein ::1 — die Funktion kennt ::1 nicht).
 */

/** Nur diese Hosts — exakt, nicht als Teilwort. */
export const PRUEF_HOSTS = ['localhost', '127.0.0.1'] as const

export type PruefWerte = {
  DATABASE_URL?: string | undefined
  DIRECT_URL?: string | undefined
  VERCEL?: string | undefined
}

/** Nur die drei Namen aus der Umgebung — der Rest geht die Sperre nichts an. */
export function pruefWerteAus(env: Record<string, string | undefined>): PruefWerte {
  return { DATABASE_URL: env['DATABASE_URL'], DIRECT_URL: env['DIRECT_URL'], VERCEL: env['VERCEL'] }
}

/**
 * Host und Port einer Adresse für Meldungen — nie die volle Adresse, denn
 * darin steht das Passwort.
 */
export function hostUndPort(adresse: string | undefined): string {
  if (!adresse) return '(keine Adresse)'
  try {
    const url = new URL(adresse)
    return `${url.hostname}:${url.port || '5432'}`
  } catch {
    return '(keine lesbare Adresse)'
  }
}

function zerlegt(adresse: string): URL | null {
  try {
    const url = new URL(adresse)
    if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') return null
    return url
  } catch {
    return null
  }
}

/**
 * Prüft die Verbindungsadressen, bevor irgendetwas verbindet.
 * Ergebnis: null = erlaubt, sonst der Grund (ohne Adresse, nur Host und Port).
 */
export function pruefeDatenbankAdressen(werte: PruefWerte): string | null {
  if (werte.VERCEL !== undefined && werte.VERCEL !== '') {
    return 'VERCEL ist gesetzt. Das Prüfwerkzeug läuft nur auf diesem Rechner, nie bei Vercel.'
  }
  const db = werte.DATABASE_URL
  const direkt = werte.DIRECT_URL
  if (!db) return 'DATABASE_URL fehlt.'
  if (!direkt) return 'DIRECT_URL fehlt.'
  // Gleich, nicht nur „auch lokal“: Prisma nimmt DIRECT_URL für Migrationen —
  // eine zweite Adresse wäre ein zweites Ziel, das hier niemand ansieht.
  if (direkt !== db) return `DIRECT_URL (${hostUndPort(direkt)}) weicht von DATABASE_URL (${hostUndPort(db)}) ab.`
  if (!istTestDatenbank(db)) return `DATABASE_URL (${hostUndPort(db)}) ist keine lokale Testdatenbank.`
  const url = zerlegt(db)
  if (!url) return `DATABASE_URL (${hostUndPort(db)}) ist keine Postgres-Adresse.`
  if (!PRUEF_HOSTS.some((h) => h === url.hostname)) {
    return `DATABASE_URL zeigt auf ${hostUndPort(db)}. Erlaubt sind nur localhost und 127.0.0.1.`
  }
  // Doppelt zu istTestDatenbank, mit Absicht: Ein Tunnel auf localhost mit
  // `postgres.<ref>` als Benutzer zeigt auf ein gehostetes Projekt.
  if (decodeURIComponent(url.username).includes('.')) {
    return `DATABASE_URL (${hostUndPort(db)}) hat einen Benutzer eines gehosteten Projekts.`
  }
  return null
}

/**
 * Antwort von `SELECT inet_server_addr()`: null heißt Unix-Socket, sonst muss
 * es eine Loopback-Adresse sein. So fällt auch ein Tunnel auf, der auf
 * localhost lauscht, aber woanders hin verbindet, nicht — der Server selbst
 * meldet seine Adresse.
 */
export function istLoopbackServerAdresse(adresse: string | null): boolean {
  if (adresse === null) return true
  const ohneMaske = adresse.split('/')[0]?.trim() ?? ''
  if (ohneMaske === '::1') return true
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ohneMaske)) return true
  return /^::ffff:127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/i.test(ohneMaske)
}

/**
 * Ist das eine Wegwerf-Datenbank? Keine Passkey-Zeile (sonst lief der Seed
 * schon oder es ist eine echte DB) und nicht mehr Konten, als der Seed anlegt.
 */
export function pruefeDatenbankZustand(zustand: { passkeys: number; konten: number; seedKonten: number }): string | null {
  if (zustand.passkeys > 0) return `Die Datenbank hat schon ${zustand.passkeys} Passkey-Zeile(n). Prüf-Seed nur auf einer frischen Wegwerf-DB.`
  if (zustand.konten > zustand.seedKonten) {
    return `Die Datenbank hat ${zustand.konten} Konten, der Seed legt ${zustand.seedKonten} an. Das ist keine Wegwerf-DB.`
  }
  return null
}

/** `.env`, `.env.local`, `.env.test` … — aber nicht `.env.example` und Verwandte. */
export function istEnvDateiName(name: string): boolean {
  if (!/^\.env($|\.)/.test(name)) return false
  return !name.endsWith('.example')
}

/**
 * Sucht im Ordner (oberste Ebene, dort liest Next sie) nach .env-Dateien und
 * nach Verweisen, die auf eine zeigen. Keine Ausnahme, auch nicht für .env.test.
 */
export function findeEnvDateien(ordner: string): string[] {
  const funde: string[] = []
  let eintraege: string[]
  try {
    eintraege = readdirSync(ordner)
  } catch {
    return funde
  }
  for (const name of eintraege) {
    const pfad = join(ordner, name)
    if (istEnvDateiName(name)) {
      funde.push(pfad)
      continue
    }
    try {
      if (lstatSync(pfad).isSymbolicLink() && istEnvDateiName(basename(readlinkSync(pfad)))) funde.push(pfad)
    } catch {
      // Ein Eintrag, der beim Lesen verschwindet, ist keine .env-Datei.
    }
  }
  return funde
}

/** Alle Ordner auf einmal; Ergebnis null = keine .env-Datei, sonst die Meldung. */
export function pruefeOhneEnvDateien(ordner: readonly string[]): string | null {
  const funde = ordner.flatMap((o) => findeEnvDateien(o))
  if (funde.length === 0) return null
  return `.env-Datei oder Verweis darauf gefunden (${funde.join(', ')}). Im Prüf-Worktree sind keine .env-Dateien erlaubt.`
}
