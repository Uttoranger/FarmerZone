import { verlangeAdminSeite } from '@/server/admin-wache'

/*
 * Die Admin-Prüfung VOR der Ladeansicht (Nachtlauf Nr. 31). Seit es unter
 * /admin loading.tsx gibt, streamt Next.js die Seite: Was eine Seite erst
 * hinter der Grenze prüft, geht mit 200 und Skelett hinaus, und die 404 bzw.
 * die Umleitung kämen erst im Datenstrom — der Bereich gäbe sich Unbefugten
 * zu erkennen (ARCHITECTURE §3 „Die Admin-Prüfung"). Ein Layout steht
 * außerhalb der Grenze seines Segments; hier entscheidet die Prüfung, bevor
 * irgendetwas gesendet wird. Die Seiten prüfen weiter selbst (eine Seite
 * schützt die Ansicht, eine Aktion die Wirkung) — dieses Layout ersetzt das
 * nicht, es holt die Antwort nur vor die Ladeansicht.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  await verlangeAdminSeite()
  return <>{children}</>
}
