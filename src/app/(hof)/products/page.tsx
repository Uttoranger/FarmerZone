import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getProdukteSeite } from '@/server/queries/products'
import { getMeinHofKopf } from '@/server/queries/farm'
import { ladeMeinHofZustand } from '@/server/mein-hof-zustand'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'
import { ProdukteAnsicht } from '@/components/produkte/produkte-ansicht'
import { MeinHofAnsicht } from '@/components/mein-hof/mein-hof-ansicht'
import { MEIN_HOF_KOPF_HUELLE, MeinHofKopf } from '@/components/mein-hof/mein-hof-kopf'
import { cn } from '@/lib/utils'
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
 * Unter md gehört Produkte seit Nr. 49 zu „Mein Hof" (Register N3). Seit
 * Nr. 143 (N3, Ergänzung 22.10.2026) steht dort derselbe Kopf wie auf Hofseite
 * und Beiträge, in derselben Hülle (mein-hof-kopf.tsx): Titelbild-Streifen mit
 * Teilen und „Kundenansicht" (öffnet das Vollbild aus Nr. 107 mit dem Reiter
 * Produkte der Hofseite), Zustandszeile, Reiter. Ab md bleibt die Seite, wie sie
 * war — Produkte ist dort ein Punkt der Seitenleiste.
 */

export default async function ProductsPage(): Promise<React.JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/onboarding')

  // Frist gilt beim Lesen: Verwaiste Bestellungen geben ihre Ware frei, bevor
  // die Seite Bestand zeigt (src/lib/fristen.ts) — sonst setzte der Hof den
  // Vorrat auf einem Stand, den die nächste Abfrage schon ändert. Fehler nur gemeldet.
  // Danach zählt auch der Kopf (ladeMeinHofZustand) die vollen Abholfenster — nicht im selben Promise.all.
  await gibVerwaisteFreiOhneRisiko(farm.id)

  const jetzt = new Date()
  const [seite, kopf, zustand] = await Promise.all([
    getProdukteSeite(farm.id, jetzt),
    getMeinHofKopf(session.user.id),
    ladeMeinHofZustand(farm.id, jetzt),
  ])
  // Derselbe Besitzer wie getFarmForUser oben — ohne Hof gibt es auch keinen Kopf.
  if (!kopf) redirect('/onboarding')

  return (
    <MeinHofAnsicht
      reiter="produkte"
      slug={farm.slug}
      kopf={
        <div className={cn(MEIN_HOF_KOPF_HUELLE, 'md:hidden')}>
          <MeinHofKopf hof={kopf} zustand={zustand} aktiv="produkte" />
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
