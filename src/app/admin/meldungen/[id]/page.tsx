import { permanentRedirect } from 'next/navigation'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { eingangMeldungAdresse } from '@/lib/postfach'

/*
 * /admin/meldungen/[id] — seit Nr. 95 (Register N12-Änderung) die Spalte
 * „Meldung entscheiden" im Eingang des Admin-Postfachs: dauerhafte Umleitung
 * (308) nach /admin/postfach?art=meldung&meldung=<id>. Lesezeichen, die Links
 * älterer Mails und die Kurznummer bleiben gültig (der Eingang löst sie wie
 * bisher über getMeldungDetail auf). Der Inhalt steht in
 * MeldungEntscheidenSpalte (src/components/admin/briefkasten-teile.tsx),
 * Logik unverändert. Zuerst die Admin-Prüfung wie auf jeder Admin-Seite:
 * Unbefugten verrät auch die Umleitung nicht, wohin es geht.
 */
export default async function AdminMeldungUmleitung({ params }: { params: Promise<{ id: string }> }): Promise<never> {
  await verlangeAdminSeite()
  const { id } = await params
  permanentRedirect(eingangMeldungAdresse(id))
}
