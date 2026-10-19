import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ladeHofseiteGeteilt } from '@/server/hofseite-vorschau'
import { pruefeProduktseiteGeteilt } from '@/server/queries/seo'
import type { Suchparameter } from '@/lib/ansichts-modus'
import { gewaehlteGroesse, produktFamilie, produktMetadaten, produktPfad, sichtbaresProdukt } from '@/lib/produktdetail'
import { entferneKontaktdaten } from '@/lib/hofseite-kunde'
import { hofTitelbildVorschau, metadatenBasis } from '@/lib/vorschaubild'
import { UMGEBUNG } from '@/lib/umgebung-server'
import { OG_LOCALE, jsonLdSicher, produktJsonLd } from '@/lib/json-ld'
import { GROESSE_PARAMETER, leseGroesse } from '@/schemas/produktdetail'
import { KAEUFER_PARAMETER, leseKaeuferVorbelegung } from '@/schemas/kaeufer-vorbelegung'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { ProduktdetailKunde } from '@/components/produktdetail/produktdetail-kunde'
import { StartseiteFuss } from '@/components/startseite/startseite-abschnitte'
import { ProduktSkelett } from './produkt-skelett'

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
 *
 * Echte 404 (Nr. 117, wie die Hofseite): Erst die Form des Slugs (ohne
 * Datenbank), dann EINE schlanke Abfrage — Produkt im Shop eines öffentlichen
 * Hofs; die Vorschau des Besitzers bleibt möglich. Passt etwas nicht,
 * `notFound()`, bevor etwas gestreamt wird; erst danach lädt die Seite den Hof
 * samt Fristfreigabe hinter ihrem Skelett.
 */
export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ farmSlug: string; id: string }>
  searchParams: Promise<Suchparameter>
}

const PRODUKT_NICHT_GEFUNDEN: Metadata = { title: 'Produkt nicht gefunden', robots: { index: false, follow: false } }

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { farmSlug, id } = await params
  const suche = await searchParams
  // Dieselbe Prüfung wie die Seite, zuerst (parallel zur Seite, einmal je Anfrage).
  const seo = await pruefeProduktseiteGeteilt(farmSlug, id, suche)
  if (!seo) return PRODUKT_NICHT_GEFUNDEN
  const { farm, ansicht } = await ladeHofseiteGeteilt(farmSlug, suche)
  // Wie auf der Hofseite: Die Vorschau-Adresse bleibt ganz fern; das Produkt
  // eines ausgenommenen Hofs (Testhof) nur aus dem Index.
  const robots = ansicht.noindex ? { robots: { index: false, follow: false } } : !seo.indexieren ? { robots: { index: false, follow: true } } : {}
  const produkt = farm ? sichtbaresProdukt(farm.products, id) : null
  if (!farm || !produkt) return { ...PRODUKT_NICHT_GEFUNDEN, ...robots }

  // Nur öffentliche Daten: Name, Beschreibung, Preis, Hofname, Ort, Bild.
  // „{Produkt} vom {Hof} in {Ort}" (Nr. 117); die Beschreibung wie bisher.
  const titel = `${produkt.name} vom ${farm.name} in ${farm.city}`
  const { beschreibung } = produktMetadaten(produkt, farm)
  const bild = produkt.imageUrl ? { url: produkt.imageUrl, alt: produkt.name } : hofTitelbildVorschau(farm)
  return {
    title: titel,
    description: beschreibung,
    // Ohne Parameter (?groesse=, ?kaeufer=): jede Größe hat ihre eigene Seite unter ihrer ID.
    alternates: { canonical: produktPfad(farm.slug, produkt.id) },
    ...robots,
    openGraph: { title: titel, description: beschreibung, type: 'website', locale: OG_LOCALE, images: [bild] },
  }
}

export default async function ProduktSeite({ params, searchParams }: Props) {
  const { farmSlug, id } = await params
  const suche = await searchParams
  // Vor dem Streamen: unbekannter Hof oder unbekanntes Produkt → 404, ohne Laden und Fristfreigabe.
  if (!(await pruefeProduktseiteGeteilt(farmSlug, id, suche))) notFound()

  return (
    <Suspense fallback={<ProduktSkelett />}>
      <Produktseite farmSlug={farmSlug} id={id} suche={suche} />
    </Suspense>
  )
}

/** Der Inhalt hinter dem Skelett — erst nach der Prüfung in ProduktSeite. */
async function Produktseite({ farmSlug, id, suche }: { farmSlug: string; id: string; suche: Suchparameter }) {
  const { farm, ansicht } = await ladeHofseiteGeteilt(farmSlug, suche)
  // Nur noch ein Wettlauf oder die Vorschau des Besitzers mit einem Produkt,
  // das nicht im Shop ist: die 404-Ansicht hinter dem Skelett (Status 200, noindex).
  if (!farm) notFound()
  const einstieg = sichtbaresProdukt(farm.products, id)
  if (!einstieg) notFound()

  const gewaehlt = gewaehlteGroesse(produktFamilie(farm.products, einstieg), einstieg, leseGroesse(suche[GROESSE_PARAMETER]))
  // Aus „Region › Futter kaufen" (Nr. 29): `?kaeufer=betrieb` reist nur über
  // die Adresse weiter zur Kasse — Ungültiges fällt im Schema still weg.
  const kaeufer = leseKaeuferVorbelegung(suche[KAEUFER_PARAMETER])
  // Einmal hier, auf dem Server: Gebührensatz und Abholtage rechnen in Server
  // und Browser vom selben Zeitpunkt (sonst Hydration-Abweichung).
  const jetzt = new Date()

  return (
    <KundeShellMitSitzung unterleiste={false}>
      <ProduktdetailKunde
        // Telefon und E-Mail erst nach dem Kauf (Nr. 60, hier seit Nr. 70): Sie bleiben auf
        // dem Server und stehen so nicht in den Seitendaten der Client-Komponente.
        farm={entferneKontaktdaten(farm)}
        produktId={einstieg.id}
        gewaehltId={gewaehlt.id}
        ansicht={{ art: ansicht.art, kaufen: ansicht.kaufen }}
        kaeufer={kaeufer}
        jetzt={jetzt.toISOString()}
      />
      {/* Strukturierte Daten (Nr. 117): Preis und Verfügbarkeit des Einstiegs, auf dem Server gebaut. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSicher(produktJsonLd(einstieg, farm, metadatenBasis(UMGEBUNG.appUrl))) }} />
      <StartseiteFuss jahr={jetzt.getFullYear()} />
    </KundeShellMitSitzung>
  )
}
