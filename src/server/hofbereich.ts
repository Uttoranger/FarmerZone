import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getOpenOrdersCount } from '@/server/queries/orders'
import { getFarmBannerState } from '@/server/queries/farm'
import { isAdminUser } from '@/server/queries/admin'
import { zaehleZuEntscheiden } from '@/server/queries/meldung'
import { ladeTarifStand } from '@/server/queries/einstellungen'
import { baueTarifZeile, type TarifZeileDaten } from '@/lib/konditionen'

/**
 * Was jedes Layout des Hofbereichs braucht — für das Bestandslayout
 * (`(farmer)/layout.tsx`, FarmerNav) und das Layout der Routen, die schon in
 * der HofShell stehen (`(hof)/layout.tsx`, seit Nachtlauf Nr. 16). EIN Lader,
 * damit Zugang, Zahlen und Balken nicht in zwei Fassungen auseinanderlaufen,
 * solange der Hofbereich Route für Route umzieht (kein Big Bang).
 *
 * Nicht angemeldet oder keine Hof-Rolle → Anmeldung; ohne Hof → Einrichten.
 */
export type Hofbereich = {
  hof: { id: string; name: string; slug: string; logoUrl: string | null }
  personName: string
  offeneBestellungen: number
  /** Ein Zugriff für beide Balken (stillgelegt / wartet auf Freigabe). */
  balken:
    | { art: 'stillgelegt' }
    | { art: 'wartet'; farmId: string; farmName: string; country: string }
    | null
  /** Frisch aus der Datenbank, nie aus der Sitzung. */
  isAdmin: boolean
  /** Meldungen, die auf den Betreiber warten — 0 für jeden Hof. */
  zuEntscheiden: number
  /** Die Tarif-Zeile der HofShell, fertig berechnet (Nr. 61); null = keine Zeile (Hofladen). */
  tarifZeile: TarifZeileDaten | null
}

/**
 * Die Tarif-Zeile eines Hofs (Nr. 61) — Zustand und Texte auf dem Server,
 * die HofShell zeigt sie nur. Für `(hof)/layout.tsx` (über ladeHofbereich)
 * und Einrichten, das die HofShell selbst trägt.
 */
export async function ladeTarifZeile(farmId: string, jetzt: Date): Promise<TarifZeileDaten | null> {
  const stand = await ladeTarifStand(farmId)
  // Gründungshöfe erkennt erst Nr. 62 (Farm.gruendungBis und Platzvergabe) — bis dahin null.
  return baueTarifZeile({ ...stand, gruendungBis: null }, jetzt)
}

export async function ladeHofbereich(): Promise<Hofbereich> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const role = (session.user as typeof session.user & { role: string }).role
  if (role !== 'FARMER') redirect('/login')

  const hof = await getFarmForUser(session.user.id)
  if (!hof) redirect('/onboarding')

  // Unabhängig voneinander, also nebeneinander (Nachtlauf Nr. 31) — vorher
  // vier Rundreisen zur Datenbank hintereinander vor jeder Hof-Seite.
  const [offeneBestellungen, bannerState, { isAdmin, zuEntscheiden }, tarifZeile] = await Promise.all([
    getOpenOrdersCount(hof.id),
    getFarmBannerState(session.user.id),
    // Menüpunkt „Admin" nur für den Betreiber — frisch aus der DB, nicht aus der Sitzung.
    isAdminUser(session.user.id).then(async (admin) => ({
      isAdmin: admin,
      // Die Zählabfrage nur für den Betreiber — kein Hof bezahlt dafür.
      zuEntscheiden: admin ? await zaehleZuEntscheiden() : 0,
    })),
    ladeTarifZeile(hof.id, new Date()),
  ])

  // Reihenfolge wie bei der Server-Prüfung: stillgelegt sticht „wartet auf Freigabe".
  const balken: Hofbereich['balken'] =
    bannerState?.archivedAt != null
      ? { art: 'stillgelegt' }
      : bannerState != null && bannerState.approvedAt == null
        ? { art: 'wartet', farmId: bannerState.id, farmName: bannerState.name, country: bannerState.country }
        : null

  return { hof, personName: session.user.name ?? '', offeneBestellungen, balken, isAdmin, zuEntscheiden, tarifZeile }
}
