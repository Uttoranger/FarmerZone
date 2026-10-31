'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AGB_ZUSTIMMUNG_TEXT } from '@/lib/agb-zustimmung'
import { agbFassung } from '@/lib/rechtstexte/agb-datei'
import { agbZustimmungSchema } from '@/schemas/agb-zustimmung'

/*
 * „Ich stimme den AGB zu“ (§ 104 JN, P2B; Nachtlauf Nr. 207): speichert für
 * den Hof der Sitzung die aktuelle Fassung und den Zeitpunkt. Besitz über die
 * Sitzung (ownerId in der WHERE), nie über eine Kennung aus dem Browser.
 *
 * Bedingt geschrieben (`updateMany`): nur, wenn der Hof dieser Fassung noch
 * nicht zugestimmt hat — eine zweite Zustimmung (Doppelklick, zweiter Tab)
 * ändert nichts, auch nicht den Zeitpunkt der ersten. `not` allein ließe in
 * SQL die Höfe mit NULL aus, darum das OR.
 */
export async function stimmeAgbZu(eingabe: unknown): Promise<{ ok: true } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: AGB_ZUSTIMMUNG_TEXT.abgemeldet }
  const geprueft = agbZustimmungSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: AGB_ZUSTIMMUNG_TEXT.fehler }
  const aktuell = agbFassung()
  if (geprueft.data.fassung !== aktuell) return { error: AGB_ZUSTIMMUNG_TEXT.veraltet }
  try {
    const { count } = await prisma.farm.updateMany({
      where: { ownerId: session.user.id, OR: [{ agbFassung: null }, { agbFassung: { not: aktuell } }] },
      data: { agbFassung: aktuell, agbZugestimmtAm: new Date() },
    })
    // Nichts geschrieben: entweder schon zugestimmt (Erfolg) oder gar kein eigener Hof (kein Erfolg melden).
    if (count === 0 && (await prisma.farm.count({ where: { ownerId: session.user.id } })) === 0) return { error: AGB_ZUSTIMMUNG_TEXT.fehler }
  } catch (err) {
    Sentry.captureException(err, { tags: { bereich: 'agb-zustimmung' }, extra: { userId: session.user.id } })
    return { error: AGB_ZUSTIMMUNG_TEXT.fehler }
  }
  revalidatePath('/dashboard')
  revalidatePath('/onboarding')
  return { ok: true }
}
