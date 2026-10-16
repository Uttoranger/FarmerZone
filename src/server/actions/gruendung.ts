'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { verlangeAdminAktion } from '@/server/admin-wache'
import { ladeHoefeFuerGruendung } from '@/server/queries/admin'
import { lesePlattformEinstellung } from '@/server/queries/plattform-einstellung'
import { gruendungEinstellungAus } from '@/lib/plattform-einstellung'
import { GRUENDUNGSPLAETZE_SPERRE, gruendungAlleVergeben, istGruendungshof, wiederAufnahmeMoeglich } from '@/lib/gruendungshof'
import {
  GRUENDUNG_AUSNEHMEN_GEAENDERT,
  GRUENDUNG_AUSNEHMEN_ZUSTIMMUNG_FEHLT,
  GRUENDUNG_EINGABE_UNGUELTIG,
  GRUENDUNG_NUR_FREIGESCHALTET,
  nimmAusGruendungSchema,
  nimmWiederAufSchema,
} from '@/schemas/gruendung'

/*
 * Gründungshöfe: Testhöfe ausnehmen (Register K2, Ergänzung 16.10.2026,
 * Nachtlauf Nr. 109). Der Admin nimmt einen freigeschalteten Hof aus der
 * Vergabe der Gründungsplätze und wieder auf; die Höfe danach rücken auf bzw.
 * eine Nummer weiter (die Nummer ist eine Reihenfolge, die Zusage ist das Datum).
 *
 * SPERRE: Beide Wege und approveFarmAction nehmen in ihrer Transaktion dieselbe
 * Advisory-Sperre (GRUENDUNGSPLAETZE_SPERRE) und lesen die Höfe erst danach —
 * so können Freischalten und Wiederaufnahme nie gleichzeitig denselben letzten
 * Platz vergeben. Die Sperre endet mit der Transaktion.
 *
 * Keine Nachricht an einen Hof, keine Mail — auch nicht an einen Hof, der
 * dadurch neu Gründungshof wird (K2).
 */

type Ergebnis = { ok: true } | { error: string }

/** Die Seiten, die Plätze zählen oder zeigen. Der Satz der Startseite kommt frisch aus gruendungFuerSeiten, nicht aus dem Cache der Fassung — ein Pfad genügt. */
function revalidiereGruendung(): void {
  revalidatePath('/admin')
  revalidatePath('/admin/einstellungen')
  revalidatePath('/fuer-hoefe')
  revalidatePath('/register')
  revalidatePath('/')
}

/**
 * „Nicht als Gründungshof zählen“: Hält der Hof gerade einen Platz, nur mit
 * `bestaetigt` (Testhof oder Zustimmung des Hofs — zugesagte Konditionen
 * bleiben sonst, K1). Bedingt geschrieben (`gruendungAusgenommen: false`):
 * Zweimal ausnehmen ändert nichts, auch nicht „zuletzt geändert“.
 */
export async function nimmAusGruendung(eingabe: unknown): Promise<Ergebnis> {
  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }

  const parsed = nimmAusGruendungSchema.safeParse(eingabe)
  if (!parsed.success) return { error: GRUENDUNG_EINGABE_UNGUELTIG }
  const { farmId, bestaetigt } = parsed.data

  // Frisch, nie aus dem Cache: die Zahl der Plätze, die gerade gilt.
  const { plaetze } = gruendungEinstellungAus(await lesePlattformEinstellung())

  const ergebnis = await prisma.$transaction(async (tx): Promise<Ergebnis> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${GRUENDUNGSPLAETZE_SPERRE})`
    // Nach der Sperre gelesen: der Stand nach jedem anderen Weg, der gerade vergab.
    const hoefe = await ladeHoefeFuerGruendung(tx)
    if (!hoefe.some((h) => h.id === farmId)) return { error: GRUENDUNG_NUR_FREIGESCHALTET }
    if (istGruendungshof(farmId, hoefe, plaetze) && !bestaetigt) return { error: GRUENDUNG_AUSNEHMEN_ZUSTIMMUNG_FEHLT }

    const { count } = await tx.farm.updateMany({
      where: { id: farmId, gruendungAusgenommen: false, approvedAt: { not: null }, archivedAt: null },
      data: { gruendungAusgenommen: true, gruendungGeaendertAm: new Date(), gruendungGeaendertVonUserId: guard.userId },
    })
    return count === 0 ? { error: GRUENDUNG_AUSNEHMEN_GEAENDERT } : { ok: true }
  })
  if ('error' in ergebnis) return ergebnis

  revalidiereGruendung()
  return { ok: true }
}

/**
 * „Wieder als Gründungshof zählen“: nur, wenn danach höchstens so viele Höfe
 * im Rennen sind, wie die Einstellung Plätze hat (nie die feste 12) — so
 * verliert nie ein anderer Hof seine Zusage. Bedingt geschrieben
 * (`gruendungAusgenommen: true`).
 */
export async function nimmWiederAuf(eingabe: unknown): Promise<Ergebnis> {
  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }

  const parsed = nimmWiederAufSchema.safeParse(eingabe)
  if (!parsed.success) return { error: GRUENDUNG_EINGABE_UNGUELTIG }
  const { farmId } = parsed.data

  const { plaetze } = gruendungEinstellungAus(await lesePlattformEinstellung())

  const ergebnis = await prisma.$transaction(async (tx): Promise<Ergebnis> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${GRUENDUNGSPLAETZE_SPERRE})`
    const hoefe = await ladeHoefeFuerGruendung(tx)
    const hof = hoefe.find((h) => h.id === farmId)
    if (!hof) return { error: GRUENDUNG_NUR_FREIGESCHALTET }
    // Dieselbe Regel wie der Menüeintrag im Admin (folgenDerAenderung), hier mit dem Stand nach der Sperre.
    if (hof.gruendungAusgenommen && !wiederAufnahmeMoeglich(farmId, hoefe, plaetze)) return { error: gruendungAlleVergeben(plaetze) }

    const { count } = await tx.farm.updateMany({
      where: { id: farmId, gruendungAusgenommen: true, approvedAt: { not: null }, archivedAt: null },
      data: { gruendungAusgenommen: false, gruendungGeaendertAm: new Date(), gruendungGeaendertVonUserId: guard.userId },
    })
    return count === 0 ? { error: GRUENDUNG_AUSNEHMEN_GEAENDERT } : { ok: true }
  })
  if ('error' in ergebnis) return ergebnis

  revalidiereGruendung()
  return { ok: true }
}
