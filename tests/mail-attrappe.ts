import { vi, type Mock } from 'vitest'
import type * as Warteschlange from '@/server/mail-warteschlange'
import type * as MailSchema from '@/schemas/mail-auftrag'

/*
 * Gemeinsame Modul-Attrappen für die Tests der Bestellwechsel (Nr. 168,
 * Register N26, Ergänzung 25.10.2026). Die Hilfen der Warteschlange bleiben
 * ECHT und werden nur beobachtet: So prüft ein Test, was wirklich in der
 * Transaktion geschieht (Savepoint über `tx.$transaction`, EIN createMany),
 * und eine Lücke in der Prisma-Attrappe verschwindet nicht hinter „wirft nie"
 * — die Tests prüfen die Rückgabe ausdrücklich (`ergebnis`).
 *
 * Aufruf je Testdatei (vi.mock wird nur in der Testdatei selbst gehoben):
 *   vi.mock('@/server/mail-warteschlange', async (o) => (await import('./mail-attrappe')).warteschlangeEcht(await o()))
 *   vi.mock('@/schemas/mail-auftrag', async (o) => (await import('./mail-attrappe')).schemaEcht(await o()))
 *   vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort: vi.fn() }))
 */

export function warteschlangeEcht(echt: typeof Warteschlange) {
  return {
    ...echt,
    stelleMailEin: vi.fn(echt.stelleMailEin),
    stelleMailEinInTransaktion: vi.fn(echt.stelleMailEinInTransaktion),
    stelleEinOhneRisiko: vi.fn(echt.stelleEinOhneRisiko),
  }
}

export function schemaEcht(echt: typeof MailSchema) {
  return { ...echt, bezugSchemaFuer: vi.fn(echt.bezugSchemaFuer) }
}

/** „Schema per Attrappe zum Werfen gebracht": Jede Prüfung eines Bezugs wirft. */
export function bezugWirft(bezugSchemaFuer: (...args: never[]) => unknown): void {
  ;(bezugSchemaFuer as unknown as Mock).mockImplementation(() => {
    throw new Error('Schema-Attrappe: Bezug ungültig')
  })
}

/** Die Rückgabe des n-ten Aufrufs einer beobachteten async-Hilfe — ausdrücklich, nie stillschweigend. */
export async function ergebnis(hilfe: (...args: never[]) => unknown, n = 0): Promise<unknown> {
  const eintrag = (hilfe as unknown as Mock).mock.results[n]
  if (!eintrag) throw new Error(`Aufruf ${n} fehlt`)
  return eintrag.value
}

/** Die Arten aller Zeilen aus den createMany-Aufrufen einer Attrappe, in Reihenfolge. */
export function geschriebeneArten(createMany: Mock): string[] {
  return createMany.mock.calls.flatMap(([arg]) => (arg as { data: Array<{ art: string }> }).data.map((z) => z.art))
}
