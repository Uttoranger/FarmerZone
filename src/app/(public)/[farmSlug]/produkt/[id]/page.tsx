import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ladeHofseiteGeteilt } from '@/server/hofseite-vorschau'
import type { Suchparameter } from '@/lib/ansichts-modus'
import { gewaehlteGroesse, produktFamilie, produktMetadaten, sichtbaresProdukt } from '@/lib/produktdetail'
import { hofVorschaubild } from '@/lib/vorschaubild'
import { GROESSE_PARAMETER, leseGroesse } from '@/schemas/produktdetail'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { ProduktdetailKunde } from '@/components/produktdetail/produktdetail-kunde'
import { StartseiteFuss } from '@/components/startseite/startseite-abschnitte'

/*
 * Die Produktseite eines Hofs (Nachtlauf Nr. 11, Gate 4; Mockups
 * web-k2-futter-groesse-waehlen, web-k2-brennmaterial-brennholz,
 * mobil-k2-futter-groesse-waehlen, mobil-k2-brennmaterial-brennholz).
 *
 * Sichtbarkeit genau wie auf der Hofseite: dieselbe Abfrage
 * (ladeHofseiteGeteilt — öffentliche Höfe, mit Fristfreigabe beim Lesen, die
 * Vorschau nur für den Besitzer), und das Produkt muss in der Liste DIESES
 * Hofs stehen und im Shop sein. Die ID allein öffnet nichts: ein fremdes,
 * ausgeblendetes oder unbekanntes Produkt und ein falscher Slug enden in 404.
 *
 * Dynamisch wie die Hofseite: Bestand mit Fristfreigabe beim Lesen und
 * Suchparameter (?groesse=, ?vorschau=). Die Sitzung für den Kopf liest
 * KundeShellMitSitzung im Browser, nie der Server. Fokus-Seite: Kopf ja,
 * Unterleiste am Handy nein (DESIGN_SYSTEM, „Fokus-Seiten ohne Unterleiste").
 */
export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ farmSlug: string; id: string }>
  searchParams: Promise<Suchparameter>
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { farmSlug, id } = await params
  const { farm, ansicht } = await ladeHofseiteGeteilt(farmSlug, await searchParams)
  const robots = ansicht.noindex ? { robots: { index: false, follow: false } } : {}
  const produkt = farm ? sichtbaresProdukt(farm.products, id) : null
  if (!farm || !produkt) return { title: 'Produkt nicht gefunden', ...robots }

  // Nur öffentliche Daten: Name, Beschreibung, Preis, Hofname, Ort, Bild.
  const { titel, beschreibung } = produktMetadaten(produkt, farm)
  const bild = produkt.imageUrl ? { url: produkt.imageUrl, alt: produkt.name } : hofVorschaubild(farm)
  return {
    title: titel,
    description: beschreibung,
    ...robots,
    openGraph: { title: titel, description: beschreibung, type: 'website', images: [bild] },
  }
}

export default async function ProduktSeite({ params, searchParams }: Props) {
  const { farmSlug, id } = await params
  const suche = await searchParams
  const { farm, ansicht } = await ladeHofseiteGeteilt(farmSlug, suche)
  if (!farm) notFound()
  const einstieg = sichtbaresProdukt(farm.products, id)
  if (!einstieg) notFound()

  const gewaehlt = gewaehlteGroesse(produktFamilie(farm.products, einstieg), einstieg, leseGroesse(suche[GROESSE_PARAMETER]))
  // Einmal hier, auf dem Server: Gebührensatz und Abholtage rechnen in Server
  // und Browser vom selben Zeitpunkt (sonst Hydration-Abweichung).
  const jetzt = new Date()

  return (
    <KundeShellMitSitzung unterleiste={false}>
      <ProduktdetailKunde
        farm={farm}
        produktId={einstieg.id}
        gewaehltId={gewaehlt.id}
        ansicht={{ art: ansicht.art, kaufen: ansicht.kaufen }}
        jetzt={jetzt.toISOString()}
      />
      <StartseiteFuss jahr={jetzt.getFullYear()} />
    </KundeShellMitSitzung>
  )
}
