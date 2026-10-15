'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { verlangeAdminAktion } from '@/server/admin-wache'
import { bildeGruendungBis, vergebeneGruendungsplaetze } from '@/lib/gruendungshof'
import {
  ADMIN_EINSTELLUNGEN_HREF,
  GRUENDUNG_EINSTELLUNG_FEHLER,
  PLATTFORM_EINSTELLUNG_ID,
  PLATTFORM_EINSTELLUNG_TAG,
  pruefeGruendungEingabe,
} from '@/lib/plattform-einstellung'
import { gruendungEinstellungSchema } from '@/schemas/plattform-einstellung'
import { ladeHoefeFuerGruendung } from '@/server/queries/admin'
import { lesePlattformEinstellung } from '@/server/queries/plattform-einstellung'

/** Die Sätze, die eine Zod-Meldung sein dürfen — alles andere wäre Zods englischer Standardtext. */
const EIGENE_SAETZE: ReadonlySet<string> = new Set([
  GRUENDUNG_EINSTELLUNG_FEHLER.plaetze,
  GRUENDUNG_EINSTELLUNG_FEHLER.datum,
  GRUENDUNG_EINSTELLUNG_FEHLER.ungueltig,
])

/**
 * Die Gruppe Gründungshöfe in Admin › Einstellungen speichern (Register
 * K2-Ergänzung, Nr. 93): Plätze gesamt, Standard-Ende, Anzeige an/aus. Nur
 * der Admin (frisch aus der Datenbank, verlangeAdminAktion).
 *
 * Plätze gesamt nie unter den vergebenen — gezählt mit den Plätzen, die bis
 * eben galten: Wer einen Platz hat, behält ihn (K1). Das Ende nicht vor dem
 * heutigen Wiener Tag. Beides prüft dieselbe reine Funktion wie das Formular.
 *
 * Geschrieben wird per upsert NUR in die Felder dieser Gruppe — die
 * Zustell-Regeln (Nr. 95) bleiben, wie sie sind; dazu wer gespeichert hat
 * (Protokollzeile, N15). Danach den Cache der Einstellung leeren und die
 * Seiten neu bauen, die die Zahlen zeigen.
 */
export async function speichereGruendungEinstellung(eingabe: unknown): Promise<{ ok: true } | { error: string }> {
  const guard = await verlangeAdminAktion()
  if ('error' in guard) return { error: guard.error }

  const geprueft = gruendungEinstellungSchema.safeParse(eingabe)
  if (!geprueft.success) {
    const satz = geprueft.error.issues[0]?.message
    return { error: satz !== undefined && EIGENE_SAETZE.has(satz) ? satz : GRUENDUNG_EINSTELLUNG_FEHLER.ungueltig }
  }
  const { plaetze, bisTag, anzeige } = geprueft.data

  const [bisher, hoefe] = await Promise.all([lesePlattformEinstellung(), ladeHoefeFuerGruendung()])
  const fehler = pruefeGruendungEingabe({ plaetze, bisTag, anzeige }, vergebeneGruendungsplaetze(hoefe, bisher.gruendungPlaetze), new Date())
  if (fehler) return { error: fehler }

  const werte = {
    gruendungPlaetze: plaetze,
    gruendungBisStandard: bildeGruendungBis(bisTag),
    gruendungAnzeige: anzeige,
    geaendertVonUserId: guard.userId,
  }
  await prisma.plattformEinstellung.upsert({
    where: { id: PLATTFORM_EINSTELLUNG_ID },
    create: { id: PLATTFORM_EINSTELLUNG_ID, ...werte },
    update: werte,
  })

  // updateTag statt revalidateTag: In Next 16 verlangt revalidateTag ein
  // Profil; updateTag gilt für Server Actions (wie revalidiereProdukte).
  updateTag(PLATTFORM_EINSTELLUNG_TAG)
  revalidatePath('/')
  revalidatePath('/fuer-hoefe')
  revalidatePath('/register')
  revalidatePath(ADMIN_EINSTELLUNGEN_HREF)
  return { ok: true }
}
