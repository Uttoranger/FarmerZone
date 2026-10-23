import { cache } from 'react'
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
import { HOF_PFAD_KOPF } from '@/lib/hof-pfade'
import { hofAnmeldeAdresse } from '@/lib/anmeldecode'

/**
 * Was jedes Layout des Hofbereichs braucht — für das Bestandslayout
 * (`(farmer)/layout.tsx`, FarmerNav) und das Layout der Routen, die schon in
 * der HofShell stehen (`(hof)/layout.tsx`, seit Nachtlauf Nr. 16). EIN Lader,
 * damit Zugang, Zahlen und Balken nicht in zwei Fassungen auseinanderlaufen,
 * solange der Hofbereich Route für Route umzieht (kein Big Bang).
 *
 * Nicht angemeldet oder keine Hof-Rolle → Anmeldung (mit Rücksprung); ohne
 * Hof → Einrichten — beides über verlangeHofDerSitzung.
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

// Je Anfrage einmal (React `cache`): Layout und Seite rendern nebeneinander
// und fragen beide über die Wache — so bleibt es bei einer Sitzungs- und
// einer Hof-Abfrage für beide zusammen.
const sitzungDieserAnfrage = cache(async () => auth.api.getSession({ headers: await headers() }))
const hofDesKontos = cache((userId: string) => getFarmForUser(userId))

/**
 * Zur Anmeldung, mit Rücksprung auf die Seite, von der die Anfrage kam. Den
 * Pfad setzt der Proxy (Kopf x-hof-pfad); er gilt trotzdem als Eingabe und
 * kommt nur geprüft in die Adresse (hofAnmeldeAdresse), sonst `/login` ohne
 * Ziel. Nie loggen.
 */
export async function zurHofAnmeldung(): Promise<never> {
  redirect(hofAnmeldeAdresse((await headers()).get(HOF_PFAD_KOPF)))
}

/**
 * Die Wache „Hof der Sitzung" (Nr. 156, Seitenkarte P9) — EINE Stelle für
 * jede Seite unter (hof) und für ladeHofbereich. Keine Sitzung oder nicht
 * FARMER → Anmeldung mit Rücksprung; kein Hof → /onboarding.
 *
 * Warum in jeder Seite und nicht nur im Layout: Ein Layout rendert beim
 * Wechsel zwischen Seiten im Browser nicht neu und kennt seinen Pfad nicht.
 * Die Lader der Seiten bleiben; findet einer danach nichts, geht es ebenfalls
 * nach /onboarding (tests/hof-seiten-wache.test.ts).
 */
export async function verlangeHofDerSitzung(): Promise<{ userId: string; farmId: string }> {
  const session = await sitzungDieserAnfrage()
  if (!session?.user) return zurHofAnmeldung()
  const role = (session.user as typeof session.user & { role?: string }).role
  if (role !== 'FARMER') return zurHofAnmeldung()

  const hof = await hofDesKontos(session.user.id)
  if (!hof) redirect('/onboarding')
  return { userId: session.user.id, farmId: hof.id }
}

export async function ladeHofbereich(): Promise<Hofbereich> {
  const { userId } = await verlangeHofDerSitzung()
  // Beide aus dem Speicher dieser Anfrage — die Wache hat sie eben geladen.
  const [session, zeile] = await Promise.all([sitzungDieserAnfrage(), hofDesKontos(userId)])
  if (!session?.user) return zurHofAnmeldung()
  if (!zeile) redirect('/onboarding')
  // Ausdrücklich gebaut: Der Json-Wert geht nur geprüft an die Navigation (Client).
  const hof = { id: zeile.id, name: zeile.name, slug: zeile.slug, logoUrl: zeile.logoUrl, logoAusschnitt: leseAusschnitt(zeile.logoAusschnitt) }

  // Unabhängig voneinander, also nebeneinander (Nachtlauf Nr. 31) — vorher
  // vier Rundreisen zur Datenbank hintereinander vor jeder Hof-Seite.
  const [offeneBestellungen, ungelesenPostfach, bannerState, { isAdmin, zuEntscheiden }, tarifZeile] = await Promise.all([
    getOpenOrdersCount(hof.id),
    zaehleUngelesenHof(hof.id),
    getFarmBannerState(userId),
    // Menüpunkt „Admin" nur für den Betreiber — frisch aus der DB, nicht aus der Sitzung.
    isAdminUser(userId).then(async (admin) => ({
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
