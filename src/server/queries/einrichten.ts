import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { hofseiteFortschritt, hofseiteStand } from '@/lib/hofseite-fortschritt'
import type { EinrichtenDaten } from '@/lib/einrichten'
import type { Tarif } from '@prisma/client'
import { getFarmSettings, getOwnerFarm } from './farm'

export type EinrichtenHof = NonNullable<EinrichtenDaten['hof']> & {
  id: string
  slug: string
  /** Farm.tarif — heute bei jedem Hof leer (E6, gesetzt erst ab Gate 8). */
  tarif: Tarif | null
}

/**
 * Was „Hof einrichten" über den eigenen Hof braucht (Nr. 15). Der Stand der
 * Hofseite kommt aus denselben Abfragen und derselben Zählung wie „Mein Hof"
 * (farm-page/page.tsx: getOwnerFarm + getFarmSettings → hofseiteFortschritt),
 * damit beide Seiten dieselbe Zahl nennen. Nur der eigene Hof (ownerId).
 *
 * null heißt „kein Hof" — Einrichten zeigt dann „Hof anlegen".
 */
export async function ladeEinrichtenHof(ownerId: string): Promise<EinrichtenHof | null> {
  const hof = await prisma.farm.findUnique({
    where: { ownerId },
    select: { id: true, slug: true, approvedAt: true, tarif: true },
  })
  if (!hof) return null

  const [farm, einstellungen, produkte] = await Promise.all([
    getOwnerFarm(ownerId),
    getFarmSettings(ownerId),
    // Alle Produkte, auch ausgeblendete — wie die Erste-Schritte-Karte.
    prisma.product.count({ where: { farmId: hof.id } }),
  ])
  // Hof da, Daten unvollständig: nicht null zurückgeben. Einrichten zeigte
  // sonst „Hof anlegen", createFarm gäbe den bestehenden Hof zurück, und Mein
  // Hof schickte bei fehlenden Einstellungen wieder hierher — eine Schleife.
  // Das Dashboard kommt mit dem Hof allein aus (wie vor Nr. 15).
  if (!farm || !einstellungen) redirect('/dashboard')

  const fortschritt = hofseiteFortschritt(hofseiteStand(farm, einstellungen))
  return {
    id: hof.id,
    slug: hof.slug,
    tarif: hof.tarif,
    name: farm.name,
    hofseite: { erledigt: fortschritt.erledigt, gesamt: fortschritt.gesamt, fehlend: fortschritt.fehlend },
    produkte,
    stripeBereit: farm.stripeAccountReady,
    freigeschaltet: hof.approvedAt !== null,
  }
}
