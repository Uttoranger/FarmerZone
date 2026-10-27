import { permanentRedirect } from 'next/navigation'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { vonFinanzenNachGeld } from '../geld/texte'

/**
 * /admin/finanzen heißt seit Nr. 191 „Geld“ (Register N32, N37): 308 auf
 * /admin/geld mit denselben Parametern (Monat, Zeitraum, Jahr). Erst die
 * Wache, dann die Weiterleitung — wer kein Recht „Geld“ hat, erfährt auch die
 * neue Adresse nicht anders als über die Navigation. Die Teile der alten
 * Seite (Kostenliste, Blatt, Jahr, CSV unter ./export) nutzt Geld weiter.
 */
export default async function AdminFinanzenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<never> {
  await verlangeAdminSeite({ recht: 'geld' })
  permanentRedirect(vonFinanzenNachGeld(await searchParams))
}
