import * as Sentry from '@sentry/nextjs'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { adminAktionSchema, adminGrundSchema, type AdminAktionEintrag } from '@/schemas/admin-aktion'

/*
 * Das Admin-Protokoll schreiben (Register N33, Nr. 188) — die EINE Stelle,
 * die in die Tabelle AdminAktion schreibt. Jede Admin-Action ruft
 * `protokolliere` NACH ihrer Wirkung (Wache: tests/admin-rechte-wache.test.ts).
 *
 * FAIL-OPEN (CLAUDE.md §2: nie eine gültige Aktion wegen eines Nachlaufs
 * zurückrollen): `protokolliere` wirft nie. Scheitert das Schreiben oder die
 * Prüfung, geht genau EINE Meldung nach Sentry — mit Art und Bezugsart, nie
 * mit Grund oder Kennung —, und die Aktion gilt.
 *
 * Darum nie MITTEN in eine interaktive Transaktion der Aktion: Ein
 * gescheitertes INSERT bricht in Postgres die ganze Transaktion ab (die
 * Wirkung rollte still zurück). `db` ist der Client, über den in EINER
 * eigenen Anweisung geschrieben wird — Standard `prisma`; Tests geben eine
 * Attrappe, ein Ablauf (System, `wer: null`) denselben Client.
 *
 * Der Grund wird getrennt geprüft (`adminGrundSchema`): Trägt er etwas, das
 * wie eine Adresse oder Telefonnummer aussieht, wird nur er verworfen (null)
 * — der Eintrag selbst bleibt. Actions, die einen Grund abfragen, prüfen ihn
 * vorher mit demselben Schema und lehnen ab.
 *
 * Aufräumen nach ADMIN_PROTOKOLL_JAHRE (src/server/aufraeumen.ts).
 */

/** Einträge bleiben 5 Jahre (N33), dann löscht sie das tägliche Aufräumen. */
export const ADMIN_PROTOKOLL_JAHRE = 5

/** Älter als diese Grenze → gelöscht. Kalenderjahre in UTC (ein Schalttag verschiebt nichts Wesentliches). */
export function adminProtokollGrenze(jetzt: Date): Date {
  const grenze = new Date(jetzt.getTime())
  grenze.setUTCFullYear(grenze.getUTCFullYear() - ADMIN_PROTOKOLL_JAHRE)
  return grenze
}

type ProtokollDb = { adminAktion: Pick<Prisma.TransactionClient['adminAktion'], 'create'> }

function melde(grund: string, eintrag: Partial<AdminAktionEintrag>, err?: unknown): void {
  const meldung = new Error(`Admin-Protokoll: ${grund}`)
  if (err instanceof Error) meldung.name = err.name
  // Nur Art und Bezugsart — nie Grund, Kennung oder Person.
  Sentry.captureException(meldung, {
    level: 'warning',
    tags: { bereich: 'admin-protokoll', art: String(eintrag.art ?? 'unbekannt'), bezugArt: String(eintrag.bezugArt ?? 'unbekannt') },
  })
}

/** Schreibt einen Eintrag ins Admin-Protokoll. Wirft nie; `true` = geschrieben. */
export async function protokolliere(eintrag: AdminAktionEintrag, db: ProtokollDb = prisma): Promise<boolean> {
  try {
    const geprueft = adminAktionSchema.safeParse(eintrag)
    if (!geprueft.success) {
      melde('Eintrag ungültig', eintrag)
      return false
    }
    let grund: string | null = null
    if (eintrag.grund !== undefined && eintrag.grund !== null && eintrag.grund.trim() !== '') {
      const g = adminGrundSchema.safeParse(eintrag.grund)
      // Nur den Grund verwerfen, nie den Eintrag (s. oben); die Meldung kommt hier, nicht doppelt.
      if (g.success) grund = g.data
      else melde('Grund verworfen', eintrag)
    }
    await db.adminAktion.create({ data: { ...geprueft.data, grund }, select: { id: true } })
    return true
  } catch (err) {
    melde('nicht geschrieben', eintrag, err)
    return false
  }
}
