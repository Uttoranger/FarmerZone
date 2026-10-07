'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFarmForUser } from '@/server/queries/dashboard'
import { teilenMomenteSchema } from '@/schemas/teilen-momente'
import { TEILEN_MOMENTE_PFAD } from '@/lib/teilen-momente'

export type TeilenMomenteErgebnis = { ok: true; an: boolean } | { error: string }

/**
 * Teilen-Momente an- oder abschalten (/settings/teilen, Gate 7 Aufgabe 5,
 * Nachtlauf Nr. 30). Schreibt NUR Farm.teilenMomenteAus. Die Eingabe prüft
 * Zod (strikt, nur `an`); der Hof kommt aus der Sitzung, und der Besitz steht
 * in derselben WHERE-Klausel wie die Kennung (id UND ownerId) — eine fremde
 * Kennung in der Eingabe gibt es gar nicht.
 */
export async function setzeTeilenMomente(eingabe: unknown): Promise<TeilenMomenteErgebnis> {
  const geprueft = teilenMomenteSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: 'Das hat nicht geklappt. Bitte lade die Seite neu.' }
  const { an } = geprueft.data

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Bitte melde dich neu an.' }
  const farm = await getFarmForUser(session.user.id)
  if (!farm) return { error: 'Kein Hof gefunden.' }

  const { count } = await prisma.farm.updateMany({
    where: { id: farm.id, ownerId: session.user.id },
    data: { teilenMomenteAus: !an },
  })
  if (count === 0) return { error: 'Wir konnten die Einstellung nicht speichern. Bitte versuch es noch einmal.' }

  // Die Seiten, die den Schalter lesen: die Einstellungen und die drei Momente.
  revalidatePath('/settings')
  revalidatePath(TEILEN_MOMENTE_PFAD)
  revalidatePath('/dashboard')
  revalidatePath('/products')
  return { ok: true, an }
}
