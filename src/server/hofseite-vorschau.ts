import { cache } from 'react'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getHofBesitzer, getOwnerFarm, getPublicFarm, type PublicFarm } from '@/server/queries/farm'
import { vorschauGewuenscht, vorschauZugriff } from '@/lib/hofseite-vorschau'

/**
 * Der Hof zu einem Slug — öffentlich, oder als Vorschau für den Besitzer
 * (?vorschau=1, src/lib/hofseite-vorschau.ts), der seine Seite auch vor der
 * Freigabe sieht: Dann lädt `getOwnerFarm` ohne die Sichtbarkeitsregel, sonst
 * `getPublicFarm` mit ihr. Sitzung und Besitzer werden nur mit dem Parameter
 * gelesen; die öffentliche Seite bleibt ohne Auth-Runde.
 *
 * Eigene Datei statt in der Seite: So lässt sich die Wahl zwischen den beiden
 * Abfragen mit nachgebildeter Sitzung prüfen (tests/hofseite-vorschau-laden.test.ts);
 * eine Seite darf nichts anderes exportieren als Next vorsieht.
 */
export async function ladeHofseite(
  farmSlug: string,
  parameter: string | undefined
): Promise<{ farm: PublicFarm | null; vorschau: boolean }> {
  const nutzerId = vorschauGewuenscht(parameter)
    ? ((await auth.api.getSession({ headers: await headers() }))?.user.id ?? null)
    : null
  // Der Besitzer interessiert nur, wenn jemand angemeldet ist — abgemeldet
  // bleibt es bei der öffentlichen Seite, ohne zweite Abfrage.
  const besitzerId = nutzerId ? await getHofBesitzer(farmSlug) : null
  const zugriff = vorschauZugriff({ parameter, angemeldeterNutzerId: nutzerId, besitzerId })
  const farm = zugriff === 'vorschau' && nutzerId ? await getOwnerFarm(nutzerId) : await getPublicFarm(farmSlug)
  // Der Besitzer hat genau einen Hof (ownerId ist eindeutig) — der Abgleich
  // ist eine Absicherung, keine Unterscheidung.
  return { farm: farm && farm.slug === farmSlug ? farm : null, vorschau: zugriff === 'vorschau' }
}

/** Dieselbe Antwort für Metadaten und Seite eines Aufrufs, statt zweimal zu laden. */
export const ladeHofseiteGeteilt = cache(ladeHofseite)
