'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { verlangeAdminAktion } from '@/server/admin-wache'
import { protokolliere } from '@/server/admin-protokoll'
import { adminHofHref } from '@/lib/admin-hof-akte'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'
import { kalendertagInWien, wienerMitternacht } from '@/lib/wiener-tag'
import { satzHundertstel, satzText } from '@/lib/plattformgebuehr'
import { PLATTFORMGEBUEHR_HOF_FEHLER, plattformgebuehrHofSchema } from '@/schemas/plattformgebuehr'

/**
 * Admin › Hof-Akte › Plattformgebühr (Register N38, Nr. 198): Satz, Mandat
 * Pflicht, Tage bis zur Sperre, Abrechnungstag und Einzug ab je Hof. Recht
 * `geld`, frisch mit Passkey (N20, N35), ins Protokoll mit alt → neu (nur
 * Zahlen und Kalendertage, keine Personendaten). Satz und Einzug gelten nur
 * für neue Bestellungen — gespeicherte behalten ihren Snapshot.
 */
export async function speichereHofPlattformgebuehr(eingabe: unknown): Promise<{ ok: true } | { error: string }> {
  const wache = await verlangeAdminAktion({ frisch: true, recht: 'geld' })
  if ('error' in wache) return { error: wache.error }
  const geprueft = plattformgebuehrHofSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: geprueft.error.issues[0]?.message ?? PLATTFORMGEBUEHR_HOF_FEHLER.satz }
  const d = geprueft.data
  const einzugAb = d.einzugAb === '' ? null : wienerMitternacht(d.einzugAb)
  if (d.einzugAb !== '' && !einzugAb) return { error: PLATTFORMGEBUEHR_HOF_FEHLER.einzug }

  const vorher = await prisma.farm.findUnique({
    where: { id: d.farmId },
    select: { slug: true, plattformgebuehrProzent: true, barMandatPflicht: true, barSperreNachTagen: true, abrechnungsTag: true, einzugAb: true },
  })
  if (!vorher) return { error: 'Den Hof gibt es nicht mehr.' }
  await prisma.farm.update({
    where: { id: d.farmId },
    data: { plattformgebuehrProzent: d.satz, barMandatPflicht: d.mandatPflicht, barSperreNachTagen: d.sperreTage, abrechnungsTag: d.abrechnungsTag, einzugAb },
  })

  const tag = (x: Date | null): string => (x ? kalendertagInWien(x) : 'Vorgabe')
  const teile = [
    `Satz ${satzText(satzHundertstel(vorher))} → ${satzText(satzHundertstel({ plattformgebuehrProzent: d.satz }))} %`,
    `Mandat Pflicht ${vorher.barMandatPflicht ? 'ja' : 'nein'} → ${d.mandatPflicht ? 'ja' : 'nein'}`,
    `Sperre ${vorher.barSperreNachTagen} → ${d.sperreTage} Tage`,
    `Abrechnungstag ${vorher.abrechnungsTag} → ${d.abrechnungsTag}`,
    `Einzug ab ${tag(vorher.einzugAb)} → ${tag(einzugAb)}`,
  ]
  await protokolliere({ wer: wache.userId, art: 'plattformgebuehr_geaendert', bezugArt: 'hof', bezugId: d.farmId, mitPasskey: wache.mitPasskey, grund: teile.join(' · ') })
  // Der Satz steht auf der Hofseite und in der Hofübersicht (Zwischenspeicher) — wie in admin-hof.ts neu laden.
  revalidatePath(adminHofHref(d.farmId))
  revalidatePath(`/${vorher.slug}`)
  updateTag(HOEFE_CACHE_TAG)
  return { ok: true }
}
