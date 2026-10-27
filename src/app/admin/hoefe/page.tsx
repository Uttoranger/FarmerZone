import type { Metadata } from 'next'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { ladeHoefeListe } from '@/server/queries/admin-hof'
import { ADMIN_HOEFE_HREF } from '@/lib/admin-hof-akte'
import { HoefeAnsicht } from '@/components/admin/hoefe-ansicht'
import { ADMIN_RAHMEN, AdminFehler } from '@/components/admin/admin-teile'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = { title: `Höfe — Admin — ${MARKE}` }
export const dynamic = 'force-dynamic'

/*
 * /admin/hoefe — die Höfe im Regelbetrieb (Register N32; Nachtlauf Nr. 187;
 * Mockup admin-hoefe-neu): „Braucht Blick“ zuerst, je Hof „Prüfen“ bzw.
 * „Akte“. Die Shell kommt aus src/app/admin/layout.tsx; die Seite prüft
 * trotzdem selbst und zuerst (verlangeAdminSeite, frisch aus der Datenbank,
 * Recht „ansehen“ — N35: Höfe sieht jede Person im Team).
 */
export default async function AdminHoefePage(): Promise<React.JSX.Element> {
  await verlangeAdminSeite()
  const zeilen = await ladeHoefeListe(new Date())
  return (
    <div className={ADMIN_RAHMEN}>
      {zeilen ? <HoefeAnsicht zeilen={zeilen} /> : <AdminFehler titel="Höfe" satz="Wir konnten die Höfe gerade nicht laden." nochmal={ADMIN_HOEFE_HREF} />}
    </div>
  )
}
