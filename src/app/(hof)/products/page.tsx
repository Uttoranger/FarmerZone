import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getProdukteSeite } from '@/server/queries/products'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'
import { ProdukteAnsicht } from '@/components/produkte/produkte-ansicht'

export const metadata: Metadata = {
  title: 'Produkte — FarmerZone',
}

/*
 * Produkte — die Tabelle des Hofs in der HofShell (Gate 5, Nachtlauf Nr. 18;
 * Mockups web-h2-produkte, mobil-h2-produkte, web-h2-neu-was-legst-du-an,
 * mobil-h2-neu-was-legst-du-an, web-h2-ware-wieder-da-teilen). Die Shell kommt
 * aus dem Layout der Routengruppe (hof), Zugang und Zahlen aus ladeHofbereich.
 *
 * ?neu=1 (mit ?bereich=) und ?edit=<id> liest die Ansicht selbst
 * (src/lib/use-url-auftrag.ts), ebenso Filter und Suche (?filter=, ?suche=).
 */
export default async function ProductsPage(): Promise<React.JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/onboarding')

  // Frist gilt beim Lesen: Verwaiste Bestellungen geben ihre Ware frei, bevor
  // die Seite Bestand zeigt (src/lib/fristen.ts) — sonst setzte der Hof den
  // Vorrat auf einem Stand, den die nächste Abfrage schon ändert. Fehler nur gemeldet.
  await gibVerwaisteFreiOhneRisiko(farm.id)

  const seite = await getProdukteSeite(farm.id, new Date())

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-5 pb-12 md:px-8 md:pt-8 xl:px-10">
      <ProdukteAnsicht
        products={seite.products}
        hofBetriebsnummer={seite.hofBetriebsnummer}
        registrierung={seite.registrierung}
        hof={{ name: farm.name, slug: farm.slug, sichtbar: seite.hofSichtbar, teilenMomenteAus: seite.teilenMomenteAus }}
        naechstesFenster={seite.naechstesFenster}
      />
    </div>
  )
}
