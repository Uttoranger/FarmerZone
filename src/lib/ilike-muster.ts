/**
 * Ein ILIKE-Muster, das nur genau diesen Text trifft (ohne Rücksicht auf
 * Groß-/Kleinschreibung). Prisma übersetzt `equals` mit `mode: 'insensitive'`
 * in ein ILIKE OHNE Maskierung — „_" und „%" wären dort Platzhalter, und
 * „b_uer-01@example.com" fände „bauer-01@example.com" (gemessen gegen die
 * Test-Datenbank, Nr. 08 Nachbesserung 3 / Nr. 14). Postgres maskiert in
 * ILIKE standardmäßig mit „\"; deshalb wird der Backslash zuerst verdoppelt
 * (in einem Durchgang, sonst maskierte er das folgende Zeichen).
 *
 * Nur für `equals` mit `mode: 'insensitive'`. Änderte Prisma je die
 * Übersetzung (etwa mit eigener Maskierung), fiele das in
 * tests/integration/anmeldecode.int.test.ts auf: Der Hof „…_hof" würde dann
 * nicht mehr gefunden.
 */
export function genauesIlikeMuster(text: string): string {
  return text.replace(/[\\%_]/g, (zeichen) => `\\${zeichen}`)
}
