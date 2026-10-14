import { permanentRedirect } from 'next/navigation'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { briefkastenAdresse, type BriefkastenSuche } from '@/lib/admin-briefkasten'
import { meldungenImPostfach } from '@/lib/postfach'

/*
 * /admin/meldungen — seit Nr. 87 (Register N12) der Reiter „Meldungen" im
 * Admin-Postfach: dauerhafte Umleitung (308) nach
 * /admin/postfach?reiter=meldungen, die Filter (status, art) gehen mit —
 * Lesezeichen und der Link der Wochen-Mail bleiben gültig. Der Inhalt steht
 * in src/app/admin/postfach/meldungen-reiter.tsx; die Detailseite
 * /admin/meldungen/[id] bleibt, wo sie ist. Zuerst die Admin-Prüfung wie auf
 * jeder Admin-Seite: Unbefugten verrät auch die Umleitung nicht, wohin es geht.
 */
export default async function AdminMeldungenUmleitung({
  searchParams,
}: {
  searchParams: Promise<BriefkastenSuche>
}): Promise<never> {
  await verlangeAdminSeite()
  const { status, art } = await searchParams
  permanentRedirect(meldungenImPostfach(briefkastenAdresse({}, { status: einzeln(status), art: einzeln(art) })))
}

/** Next liefert einen doppelten Parameter als Liste — dann zählt der erste. */
function einzeln(wert: string | string[] | undefined): string | undefined {
  return Array.isArray(wert) ? wert[0] : wert
}
