/**
 * Ein Verbindungsabbruch zur Datenbank, den eine Wiederholung heilen kann
 * (Nr. 47) — rein und ohne Datenbank prüfbar (tests/oeffentlich-lesen.test.ts).
 *
 * Befund aus Vercel: Beim Hintergrund-Neubau der öffentlichen Hofliste
 * scheiterte die Anmeldung am Verbindungs-Pooler mit „(EAUTHTIMEOUT)" —
 * SQLSTATE 08006 (connection_failure). Prisma 7 reicht das mit dem
 * pg-Adapter als `DriverAdapterError` durch, die Ursache steht in `cause`:
 * `{ kind: 'postgres', originalCode: '08006', originalMessage: '(EAUTHTIMEOUT) …' }`.
 * Hängt Prisma ihn an einen eigenen Fehler, steht derselbe unter
 * `meta.driverAdapterError`.
 *
 * Bewusst eng: nur dieser Abbruch. Andere Netzfehler (P1001, P1008, P1017)
 * werden nicht wiederholt — ob eine zweite Runde dort hilft oder nur die
 * Seite verlangsamt, ist nicht belegt.
 */

/** SQLSTATE connection_failure — so meldet der Pooler einen Anmelde-Zeitablauf. */
export const VERBINDUNGSABBRUCH_CODE = '08006'

/** Die Kennung des Poolers für den Anmelde-Zeitablauf, falls der Code fehlt. */
export const ANMELDE_ZEITABLAUF = 'EAUTHTIMEOUT'

/** So lange wartet die eine Wiederholung — kurz, eine Seite wartet darauf. */
export const WIEDERHOLUNG_PAUSE_MS = 300

function alsObjekt(wert: unknown): Record<string, unknown> | null {
  return typeof wert === 'object' && wert !== null ? (wert as Record<string, unknown>) : null
}

/** Der Fehler selbst, seine Ursache und der angehängte Fehler des Adapters samt Ursache. */
function kandidaten(fehler: unknown): Record<string, unknown>[] {
  const selbst = alsObjekt(fehler)
  if (!selbst) return []
  const adapter = alsObjekt(alsObjekt(selbst.meta)?.driverAdapterError)
  return [selbst, alsObjekt(selbst.cause), adapter, alsObjekt(adapter?.cause)].filter(
    (k): k is Record<string, unknown> => k !== null
  )
}

/** Ist das der Abbruch, den eine Wiederholung heilen kann? */
export function istVerbindungsabbruch(fehler: unknown): boolean {
  return kandidaten(fehler).some(
    (k) =>
      k.originalCode === VERBINDUNGSABBRUCH_CODE ||
      k.code === VERBINDUNGSABBRUCH_CODE ||
      [k.originalMessage, k.message].some((text) => typeof text === 'string' && text.includes(ANMELDE_ZEITABLAUF))
  )
}

/** Code und Kennung für die Meldung — ohne den Rohtext des Fehlers. */
export function verbindungsUrsache(fehler: unknown): { code: string | null; ursache: string | null } {
  const alle = kandidaten(fehler)
  // Der SQLSTATE der Datenbank, nicht der Code von Prisma (P2010 o. ä.).
  const original = alle.map((k) => k.originalCode).find((c): c is string => typeof c === 'string')
  const postgres = alle.find((k) => k.kind === 'postgres' && typeof k.code === 'string')?.code as string | undefined
  const code = original ?? postgres ?? null
  const zeitablauf = alle.some((k) => [k.originalMessage, k.message].some((t) => typeof t === 'string' && t.includes(ANMELDE_ZEITABLAUF)))
  return { code, ursache: zeitablauf ? ANMELDE_ZEITABLAUF : null }
}
