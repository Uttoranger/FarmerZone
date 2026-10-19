'use server'

import { headers } from 'next/headers'
import { revalidatePath, updateTag } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFarmForUser } from '@/server/queries/dashboard'
import { abzeichenSichtbarSchema } from '@/schemas/gruendung'
import { ABZEICHEN_TEXT } from '@/lib/gruendungshof'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'

export type AbzeichenErgebnis = { ok: true; zeigen: boolean } | { error: string }

/**
 * „Abzeichen zeigen“ unter Konditionen und Tarif (Register K2, Änderung
 * Nr. 116). Schreibt NUR Farm.gruendungAbzeichenZeigen — Platz, Ende und
 * Konditionen bleiben, wie sie sind. Der Hof kommt aus der Sitzung, Besitz und
 * „hat einen Platz“ stehen in derselben WHERE-Klausel (bedingtes Update): Eine
 * fremde Kennung gibt es in der Eingabe gar nicht, ein Hof ohne Platz ändert
 * nichts. Danach sofort weg bzw. da — Hofseite, Konditionen und die Höfe-Liste
 * samt Startseite (ihr Fünf-Minuten-Cache hängt an HOEFE_CACHE_TAG).
 */
export async function setzeAbzeichenSichtbar(eingabe: unknown): Promise<AbzeichenErgebnis> {
  const geprueft = abzeichenSichtbarSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: ABZEICHEN_TEXT.fehler }
  const { zeigen } = geprueft.data

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Bitte melde dich neu an.' }
  const farm = await getFarmForUser(session.user.id)
  if (!farm) return { error: 'Kein Hof gefunden.' }

  const { count } = await prisma.farm.updateMany({
    where: { id: farm.id, ownerId: session.user.id, gruendungPlatz: { not: null } },
    data: { gruendungAbzeichenZeigen: zeigen },
  })
  if (count === 0) return { error: ABZEICHEN_TEXT.fehler }

  revalidatePath(`/${farm.slug}`)
  revalidatePath('/settings/konditionen')
  updateTag(HOEFE_CACHE_TAG)
  return { ok: true, zeigen }
}
