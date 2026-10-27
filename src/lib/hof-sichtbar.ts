import type { Prisma } from '@prisma/client'

/*
 * Ob ein Hof öffentlich offline ist (Register N36, Nachtlauf Nr. 190) — die
 * EINE Quelle für alle Leser der Sichtbarkeit. Offline sind ein stillgelegter
 * Hof (`archivedAt`, setzt der Hof selbst) und ein geschlossener
 * (`geschlossenAm`, „Konto schließen“ durch das Team, src/lib/konto-schliessen.ts).
 * Jeder Leser nimmt diese Bedingung bzw. `hofSichtbar`, nie eines der Felder
 * allein (tests/hof-sichtbar-wache.test.ts). Rein, ohne Datenbank — auch für
 * reine Regeldateien.
 */

/** Für Prisma-Bedingungen: weder stillgelegt noch geschlossen. */
export const HOF_SICHTBAR_WO = { archivedAt: null, geschlossenAm: null } as const satisfies Prisma.FarmWhereInput

/** Dasselbe für einen schon gelesenen Hof. Wahrheitswert statt `=== null`: Ein Zeitpunkt sperrt, leer nie. */
export function hofSichtbar(hof: { archivedAt: Date | null; geschlossenAm: Date | null }): boolean {
  return !hof.archivedAt && !hof.geschlossenAm
}

