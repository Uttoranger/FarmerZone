import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getProdukteSeite } from '@/server/queries/products'
import { zaehleBeitraege } from '@/server/queries/mein-hof-zahl'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'
import { ProdukteAnsicht } from '@/components/produkte/produkte-ansicht'
import { MeinHofAnsicht } from '@/components/mein-hof/mein-hof-ansicht'
import { MeinHofReiterLeiste } from '@/components/mein-hof/reiter-leiste'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = {
  title: `Produkte — ${MARKE}`,
}

/*
 * Produkte — die Tabelle des Hofs in der HofShell (Gate 5, Nachtlauf Nr. 18;
 * Mockups web-h2-produkte, mobil-h2-produkte, web-h2-neu-was-legst-du-an,
 * mobil-h2-neu-was-legst-du-an, web-h2-ware-wieder-da-teilen). Die Shell kommt
 * aus dem Layout der Routengruppe (hof), Zugang und Zahlen aus ladeHofbereich.
 *
 * ?neu=1 (mit ?bereich=) und ?edit=<id> liest die Ansicht selbst
 * (src/lib/use-url-auftrag.ts), ebenso Filter und Suche (?filter=, ?suche=).
 *
 * Unter md gehört Produkte seit Nr. 49 zu „Mein Hof" (Register N3): oben die
 * Reiter Produkte · Hofseite · Beiträge und der Umschalter „Bearbeiten · So
 * sieht’s die Kundin" (dort der Reiter Produkte der Hofseite). Ab md bleibt
 * die Seite, wie sie war — Produkte ist dort ein Punkt der Seitenleiste.
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

  const [seite, beitraegeZahl] = await Promise.all([getProdukteSeite(farm.id, new Date()), zaehleBeitraege(farm.id)])

  return (
    <MeinHofAnsicht
      reiter="produkte"
      slug={farm.slug}
      kopf={
        <div className="px-4 pt-5 md:hidden">
          <MeinHofReiterLeiste aktiv="produkte" beitraegeZahl={beitraegeZahl} nurUnterMd />
        </div>
      }
    >
      <div className="mx-auto w-full max-w-6xl px-4 pt-5 pb-12 md:px-8 md:pt-8 xl:px-10">
        <ProdukteAnsicht
          products={seite.products}
          hofBetriebsnummer={seite.hofBetriebsnummer}
          registrierung={seite.registrierung}
          hof={{ name: farm.name, slug: farm.slug, sichtbar: seite.hofSichtbar, teilenMomenteAus: seite.teilenMomenteAus }}
          naechstesFenster={seite.naechstesFenster}
        />
      </div>
    </MeinHofAnsicht>
  )
}
