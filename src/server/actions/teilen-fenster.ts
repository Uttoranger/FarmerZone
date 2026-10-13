'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { ladeTeilenFensterBeitrag } from '@/server/queries/teilen-bild'
import { beitragIdSchema } from '@/schemas/status-post'
import { BEITRAG_TEILEN_TEXT, type TeilenFensterBeitrag } from '@/lib/teilen-fenster'

/**
 * Die Daten des Teilen-Fensters für EINEN eigenen Beitrag (Register T5,
 * Nr. 67) — nach dem Veröffentlichen und über „Teilen" im Reiter „Beiträge".
 * Nur lesen: Teilen legt keinen Beitrag an (Teilen (d)), deshalb auch kein
 * revalidatePath. Der Hof kommt aus der Sitzung, nie aus der Eingabe; ein
 * fremder, unbekannter oder nicht mehr öffentlicher Beitrag bekommt denselben
 * Satz — die Antwort verrät nicht, ob es die Kennung bei einem anderen Hof gibt.
 * Unerwartete Fehler wirft die Action weiter (Sentry); der Aufrufer im Browser
 * fängt sie mit `ladeBeitragFenster` ab.
 */
export async function ladeTeilenFensterBeitragAction(postId: unknown): Promise<{ daten: TeilenFensterBeitrag } | { error: string }> {
  const geprueft = beitragIdSchema.safeParse(postId)
  if (!geprueft.success) return { error: BEITRAG_TEILEN_TEXT.nichtTeilbar }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Bitte melde dich neu an.' }
  const farm = await getFarmForUser(session.user.id)
  if (!farm) return { error: 'Bitte melde dich neu an.' }

  const daten = await ladeTeilenFensterBeitrag(farm.id, geprueft.data, new Date())
  return daten ? { daten } : { error: BEITRAG_TEILEN_TEXT.nichtTeilbar }
}
