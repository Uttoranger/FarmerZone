import 'server-only'
import { prisma } from '@/lib/prisma'
import type { LetzteMigration } from './dienste'

/*
 * Lesen für die Karten „Dienste“ und „Version“ (Nr. 184): die Antwortzeit
 * der Datenbank und die letzte angewandte Migration aus `_prisma_migrations`
 * — nur lesen, ohne Parameter von außen. Jede Abfrage für sich: Scheitert
 * eine, steht in ihrer Zeile ein Satz, die Seite bleibt.
 */

/** Wie lange `SELECT 1` beim Aufbau der Seite braucht, in ganzen Millisekunden; null, wenn es scheitert. */
export async function messeAntwort(): Promise<number | null> {
  const start = performance.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return Math.max(0, Math.round(performance.now() - start))
  } catch {
    return null
  }
}

/** Die jüngste angewandte Migration (nicht zurückgerollt); undefined, wenn die Tabelle nicht lesbar ist. */
export async function ladeLetzteMigration(): Promise<LetzteMigration | undefined> {
  try {
    const [zeile] = await prisma.$queryRaw<Array<{ name: string; am: Date }>>`
      SELECT "migration_name" AS "name", "finished_at" AS "am" FROM "_prisma_migrations"
      WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL
      ORDER BY "migration_name" DESC LIMIT 1`
    return zeile ? { name: zeile.name, am: zeile.am } : null
  } catch {
    return undefined
  }
}
