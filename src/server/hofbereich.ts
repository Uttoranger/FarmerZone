import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getOpenOrdersCount } from '@/server/queries/orders'
import { getFarmBannerState } from '@/server/queries/farm'
import { isAdminUser } from '@/server/queries/admin'
import { zaehleZuEntscheiden } from '@/server/queries/meldung'
import { zaehleUngelesenHof } from '@/server/queries/postfach'
import { ladeTarifStand } from '@/server/queries/einstellungen'
import { baueTarifZeile, type TarifZeileDaten } from '@/lib/konditionen'
import { leseAusschnitt, type BildAusschnitt } from '@/schemas/bild-ausschnitt'

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
  /** logoAusschnitt schon geprüft (Register N17, Nr. 98): das runde Logo der Identitätskarte. */
  hof: { id: string; name: string; slug: string; logoUrl: string | null; logoAusschnitt: BildAusschnitt | null }
  personName: string
  offeneBestellungen: number
  /** Fäden im Postfach mit Ungelesenem vom Team (Register N12, Nr. 87) — der Zähler an „Postfach". */
  ungelesenPostfach: number
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
  // Der Stand trägt das wirksame Gründungs-Ende mit (ladeGruendungBis, Nr. 62).
  return baueTarifZeile(await ladeTarifStand(farmId), jetzt)
}

export async function ladeHofbereich(): Promise<Hofbereich> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const role = (session.user as typeof session.user & { role: string }).role
  if (role !== 'FARMER') redirect('/login')

  const zeile = await getFarmForUser(session.user.id)
  if (!zeile) redirect('/onboarding')
  // Ausdrücklich gebaut: Der Json-Wert geht nur geprüft an die Navigation (Client).
  const hof = { id: zeile.id, name: zeile.name, slug: zeile.slug, logoUrl: zeile.logoUrl, logoAusschnitt: leseAusschnitt(zeile.logoAusschnitt) }

  // Unabhängig voneinander, also nebeneinander (Nachtlauf Nr. 31) — vorher
  // vier Rundreisen zur Datenbank hintereinander vor jeder Hof-Seite.
  const [offeneBestellungen, ungelesenPostfach, bannerState, { isAdmin, zuEntscheiden }, tarifZeile] = await Promise.all([
    getOpenOrdersCount(hof.id),
    zaehleUngelesenHof(hof.id),
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

  return { hof, personName: session.user.name ?? '', offeneBestellungen, ungelesenPostfach, balken, isAdmin, zuEntscheiden, tarifZeile }
}
