import type { Metadata } from 'next'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { FRISCH_TEXT, sichererWeiterPfad } from '@/lib/admin-anmeldung'
import { MARKE } from '@/lib/marke'
import { cn } from '@/lib/utils'
import { ADMIN_RAHMEN } from '@/components/admin/admin-teile'
import { Seitenkopf } from '@/components/admin/seitenkopf'
import { BestaetigenKarte } from './bestaetigen-karte'

export const metadata: Metadata = { title: `${FRISCH_TEXT.seitentitel} — Admin — ${MARKE}` }

/**
 * /admin/bestaetigen?weiter=<Pfad> — die frische Bestätigung vor einem
 * CSV-Export (Register N20; Nr. 115): Die Exporte antworten ohne Bestätigung
 * mit 303 hierher (frischOderBestaetigen). `weiter` nur als relativer Pfad
 * unter /admin, sonst /admin — keine offene Weiterleitung.
 */
export default async function AdminBestaetigenPage({
  searchParams,
}: {
  searchParams: Promise<{ weiter?: string | string[] }>
}): Promise<React.JSX.Element> {
  await verlangeAdminSeite()

  const { weiter } = await searchParams
  const ziel = sichererWeiterPfad(typeof weiter === 'string' ? weiter : null)
  return (
    <div className={cn(ADMIN_RAHMEN, 'flex max-w-[640px] flex-col gap-4 lg:gap-[18px]')}>
      <Seitenkopf titel={FRISCH_TEXT.seitentitel} satz={FRISCH_TEXT.satz} />
      <BestaetigenKarte weiter={ziel} />
    </div>
  )
}
