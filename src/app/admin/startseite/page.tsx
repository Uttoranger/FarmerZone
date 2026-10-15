import type { Metadata } from 'next'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { ADMIN_RAHMEN } from '@/components/admin/admin-teile'
import { Seitenkopf } from '@/components/admin/seitenkopf'
import { STARTSEITE_PLATZHALTER } from '@/lib/admin-seiten'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = { title: `${STARTSEITE_PLATZHALTER.titel} — Admin — ${MARKE}` }

/*
 * /admin/startseite — bis Nr. 96 (Startseite gestalten, Register N16) nur der
 * Kopf des Admin-Seitenmusters (Register N15). Nr. 96 ersetzt die Seite.
 * Die Seite prüft selbst und zuerst (verlangeAdminSeite), wie jede Admin-Seite.
 */
export default async function AdminStartseitePage(): Promise<React.JSX.Element> {
  await verlangeAdminSeite()

  return (
    <div className={ADMIN_RAHMEN}>
      <Seitenkopf titel={STARTSEITE_PLATZHALTER.titel} satz={STARTSEITE_PLATZHALTER.satz} />
    </div>
  )
}
