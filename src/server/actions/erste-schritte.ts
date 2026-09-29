'use server'

import { cookies, headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { ERSTE_SCHRITTE_AUS_COOKIE, ERSTE_SCHRITTE_AUS_DAUER_S } from '@/lib/erste-schritte'

/*
 * Erste Schritte aus- und wieder einblenden. Es gibt keine Eingabe zu prüfen:
 * Der Wert des Cookies ist die Hof-ID der Sitzung, nie etwas aus der Anfrage —
 * damit ist die Besitzprüfung der Cookie selbst. Geschrieben wird nichts in
 * die Datenbank (Begründung in src/lib/erste-schritte.ts).
 */

type Ergebnis = { ok: true } | { error: string }

async function hofDerSitzung(): Promise<{ id: string } | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  return getFarmForUser(session.user.id)
}

/** Blendet die Karte für diesen Hof auf diesem Gerät aus — ein Jahr lang. */
export async function blendeErsteSchritteAus(): Promise<Ergebnis> {
  const farm = await hofDerSitzung()
  if (!farm) return { error: 'Bitte melde dich neu an.' }

  const jar = await cookies()
  jar.set({
    name: ERSTE_SCHRITTE_AUS_COOKIE,
    value: farm.id,
    maxAge: ERSTE_SCHRITTE_AUS_DAUER_S,
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    // Lokal läuft die App über http — dort dürfte der Browser einen
    // Secure-Cookie nicht setzen. NODE_ENV ist die eine Variable, die laut
    // TECH_STACK direkt gelesen werden darf.
    secure: process.env.NODE_ENV === 'production',
  })
  revalidatePath('/dashboard')
  return { ok: true }
}

/** Holt die Karte zurück: Der Cookie fällt weg. */
export async function blendeErsteSchritteEin(): Promise<Ergebnis> {
  const farm = await hofDerSitzung()
  if (!farm) return { error: 'Bitte melde dich neu an.' }

  const jar = await cookies()
  jar.delete(ERSTE_SCHRITTE_AUS_COOKIE)
  revalidatePath('/dashboard')
  return { ok: true }
}
