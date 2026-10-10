import { prisma } from '@/lib/prisma'
import { kontoHatHof } from '@/lib/admin-navigation'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { zaehleWartendeHoefe } from '@/server/queries/admin'
import { zaehleZuEntscheiden } from '@/server/queries/meldung'

export type Adminbereich = {
  personName: string
  /**
   * Ob das Konto einen eigenen Hof hat (kontoHatHof): Nur dann zeigt der Kopf
   * „← Mein Hof" und die Plakette als Link auf „Konto und Sicherheit" —
   * beide Ziele liegen im Hofbereich.
   */
  hatHof: boolean
  /** Die Zähler der Reiter: wartende Höfe, Meldungen zu entscheiden. */
  zahlen: { hoefe: number; briefkasten: number }
}

/**
 * Was das Layout von /admin für die AdminShell braucht (Nachtlauf Nr. 22f) —
 * das Gegenstück zu ladeHofbereich (src/server/hofbereich.ts).
 *
 * ZUERST die Admin-Wache: Ein Layout rendert parallel zur Seite, und ohne
 * eigene Prüfung zeigte es einem Unbefugten Kopf und Zähler, während die Seite
 * noch ihr notFound() wirft. Die Seiten prüfen trotzdem selbst
 * (verlangeAdminSeite als erste Anweisung): Ein Layout rendert beim Wechsel
 * zwischen Unterseiten nicht neu, eine Seite schon.
 *
 * Ob es einen eigenen Hof gibt, liest dieselbe Abfrage mit (Rolle und nur die
 * Kennung des Hofs, Register N1 / Nr. 41) — frisch aus der Datenbank wie das
 * Admin-Recht, nicht aus der Sitzung.
 */
export async function ladeAdminbereich(): Promise<Adminbereich> {
  const userId = await verlangeAdminSeite()
  const [nutzer, hoefe, briefkasten] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, role: true, farm: { select: { id: true } } } }),
    zaehleWartendeHoefe(),
    zaehleZuEntscheiden(),
  ])
  return {
    personName: nutzer?.name ?? '',
    hatHof: kontoHatHof({ rolle: nutzer?.role, hofVorhanden: nutzer?.farm != null }),
    zahlen: { hoefe, briefkasten },
  }
}
