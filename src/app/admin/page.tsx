import type { Metadata } from 'next'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { ladeHoefeListe } from '@/server/queries/admin-hof'
import { HoefeAnsicht } from '@/components/admin/hoefe-ansicht'
import { ADMIN_RAHMEN, AdminFehler } from '@/components/admin/admin-teile'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = { title: `Admin — ${MARKE}` }
export const dynamic = 'force-dynamic'

/*
 * /admin — bis Admin › Heute (Nr. 185) hier einzieht, zeigt der Einstieg die
 * Höfe im Regelbetrieb (Nr. 187), dieselbe Liste wie /admin/hoefe. Die Shell
 * kommt aus src/app/admin/layout.tsx; die Seite prüft trotzdem selbst und
 * zuerst (verlangeAdminSeite, frisch aus der Datenbank).
 */
export default async function AdminPage(): Promise<React.JSX.Element> {
  await verlangeAdminSeite()
  const zeilen = await ladeHoefeListe(new Date())
  return (
    <div className={ADMIN_RAHMEN}>
      {zeilen ? <HoefeAnsicht zeilen={zeilen} /> : <AdminFehler titel="Höfe" satz="Wir konnten die Höfe gerade nicht laden." nochmal="/admin" />}
    </div>
  )
}
