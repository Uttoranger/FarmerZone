import { Suspense } from 'react'
import { notFound, unstable_rethrow } from 'next/navigation'
import type { Metadata } from 'next'
import * as Sentry from '@sentry/nextjs'
import { getActiveStatusPosts, ladeAktivenBeitrag, type ActiveStatusPost } from '@/server/queries/status-posts'
import { ladeHofseiteGeteilt } from '@/server/hofseite-vorschau'
import { pruefeHofseiteGeteilt, type HofSeo } from '@/server/queries/seo'
import { verifyReorderToken } from '@/lib/reorder-token'
import { prisma } from '@/lib/prisma'
import { hofVorschaubild, metadatenBasis } from '@/lib/vorschaubild'
import { UMGEBUNG } from '@/lib/umgebung-server'
import { OG_LOCALE, hofJsonLd, jsonLdSicher } from '@/lib/json-ld'
import { sammleKategorien } from '@/lib/hofuebersicht'
import { kaufSperre } from '@/lib/bereiche-anzeige'
import { KATEGORIE_LABEL, PRODUCT_CATEGORY_VALUES } from '@/lib/taxonomie'
import { teilenVorschauText } from '@/lib/teilen-bild'
import { HOFSEITE_BEITRAEGE_MAX, entferneKontaktdaten, ueberUnsText } from '@/lib/hofseite-kunde'
import { ladeTeilenVorschau } from '@/server/queries/teilen-bild'
import type { Suchparameter } from '@/lib/ansichts-modus'
import type { PublicFarm } from '@/server/queries/farm'
import { nachbestellToken } from '@/schemas/nachbestellung'
import { BEITRAG_PARAMETER, beitragKennungSchema } from '@/schemas/hofseite-reiter'
import { FarmPageView } from '@/components/farm/farm-page-view'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { StartseiteFuss } from '@/components/startseite/startseite-abschnitte'
import { TeilenBesuchMelden } from '@/components/hofseite/teilen-besuch'
import { HofseiteSkelett } from './hofseite-skelett'

export const dynamic = 'force-dynamic'

/*
 * Seit Nachtlauf Nr. 10 im neuen Design in der KundeShell (Gate 4; Mockups
 * web-k2-hofseite, web-k2-alle-produkte-nach-kategorie, mobil-k2-*). Die
 * Sitzung für die Kopfzeile liest KundeShellMitSitzung im Browser — die Seite
 * liest sie für Kundinnen nicht auf dem Server (ansichtsModus fragt sie nur
 * mit ?vorschau=1). Dynamisch war sie schon vorher: Suchparameter (Bereich,
 * Reiter, Nachbestell-Link, Vorschau) und der Bestand mit der Fristfreigabe
 * beim Lesen.
 *
 * DIE Hofseite — es gibt sie genau einmal. Kundinnen sehen sie hier, und die
 * Vorschau im Bauern-Bereich ist dieselbe Route mit ?vorschau=1, nie ein
 * Nachbau (ARCHITECTURE §4). Was die Vorschau anders macht, entscheidet
 * `ansichtsModus` im Lader; diese Seite liest nur das Ergebnis (`ansicht`),
 * nie den Parameter selbst (tests/hofseite-einmal.test.ts).
 *
 * Echte 404 (Nr. 117): Jede Adresse `/<irgendwas>` landet hier. Zuerst prüft
 * `pruefeHofseiteGeteilt` die Form (ohne Datenbank) und dann mit EINER
 * schlanken Abfrage, ob der Hof öffentlich ist — die Vorschau des Besitzers
 * (?vorschau=1, auch vor der Freigabe) bleibt möglich. Passt etwas nicht,
 * `notFound()`, BEVOR etwas gestreamt wird: Status 404. Erst danach lädt die
 * Seite den Hof samt Fristfreigabe, hinter ihrem Skelett (Suspense statt
 * loading.tsx — eine Ladeansicht davor hätte die 404 als 200 gestreamt).
 */

type Props = {
  params: Promise<{ farmSlug: string }>
  searchParams: Promise<Suchparameter>
}

const HOF_NICHT_GEFUNDEN: Metadata = { title: 'Hof nicht gefunden', robots: { index: false, follow: false } }

/**
 * „{Hof} in {Ort} – {bis zu drei Kategorien}" (Nr. 117): Kategorien der
 * Produkte im Shop, in der festen Reihenfolge der Taxonomie.
 */
function hofTitel(farm: Pick<PublicFarm, 'name' | 'city' | 'products'>): string {
  const imShop = farm.products.filter((p) => p.isAvailable)
  const kategorien = sammleKategorien(imShop, PRODUCT_CATEGORY_VALUES).slice(0, 3).map((k) => KATEGORIE_LABEL[k])
  const kopf = `${farm.name} in ${farm.city}`
  return kategorien.length > 0 ? `${kopf} – ${kategorien.join(', ')}` : kopf
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { farmSlug } = await params
  const suche = await searchParams
  // Dieselbe Prüfung wie die Seite, zuerst: Metadaten laufen parallel zur
  // Seite und fragten sonst für jede Adresse die Datenbank.
  const seo = await pruefeHofseiteGeteilt(farmSlug, suche)
  if (!seo) return HOF_NICHT_GEFUNDEN
  // Hof und Teilen-Bild hängen nicht voneinander ab (das Bild fragt nur den Slug): gleichzeitig,
  // nicht nacheinander (Nr. 180). Das Bild scheitert nie laut (ladeTeilenVorschauOhneRisiko).
  const [{ farm, ansicht }, vorschau] = await Promise.all([
    ladeHofseiteGeteilt(farmSlug, suche),
    ladeTeilenVorschauOhneRisiko(farmSlug),
  ])
  if (!farm) return HOF_NICHT_GEFUNDEN
  // Die Vorschau-Adresse bleibt ganz fern; ein Hof ohne Produkt im Shop und ein
  // Testhof (Register N21) nur aus dem Index — seinen Links folgen Suchmaschinen weiter.
  const robots = ansicht.noindex ? { robots: { index: false, follow: false } } : !seo.indexieren ? { robots: { index: false, follow: true } } : {}

  // Dieselbe Regel wie „Über uns“ auf der Seite: Ein geleerter eigener Text
  // ('' aus dem Formular „Auftritt“) fällt auf die Kurzbeschreibung zurück.
  const desc = (ueberUnsText(farm) ?? '').slice(0, 155)
  // Das Teilen-Bild (Gate 7, oben geladen) — ist es nicht ladbar, bleibt die Seite und
  // nimmt das Bild der Startseite; der Fehler geht nur nach Sentry.

  return {
    title: hofTitel(farm),
    description: desc,
    // Ohne Parameter (Bereich, Reiter, Nachbestell-Link): alle Varianten zählen als diese eine Seite.
    alternates: { canonical: `/${farm.slug}` },
    ...robots,
    openGraph: {
      // Wie im Mockup mobil-k1-ueber-einen-geteilten-link: „Hof – frisch vom
      // Hof in Ort" und „Eier, Erdäpfel · Abholung …" (teilenVorschauText).
      ...teilenVorschauText(farm.name, desc, vorschau?.daten ?? null),
      type: 'website',
      locale: OG_LOCALE,
      // Das Teilen-Bild, sonst das der Startseite — ein geteilter Hof-Link
      // soll nie ohne Bild ankommen (src/lib/vorschaubild.ts).
      images: [hofVorschaubild(farm, vorschau?.version ?? null)],
    },
  }
}

/** Das Teilen-Bild für die Metadaten; scheitert es, fehlt nur das Bild (gemeldet), nie die Seite. */
async function ladeTeilenVorschauOhneRisiko(slug: string): Promise<Awaited<ReturnType<typeof ladeTeilenVorschau>>> {
  try {
    return await ladeTeilenVorschau(slug, new Date())
  } catch (err) {
    unstable_rethrow(err)
    Sentry.captureException(err, { tags: { bereich: 'hofseite-teilen-bild' } })
    return null
  }
}

type ReorderItem = { productId: string; productName: string; quantity: number }

async function loadReorderItems(token: string, farmId: string): Promise<ReorderItem[]> {
  const parsed = verifyReorderToken(token)
  if (!parsed || parsed.farmId !== farmId) return []

  const order = await prisma.order.findFirst({
    where: { id: parsed.orderId, farmId },
    select: {
      items: {
        select: { productId: true, productName: true, quantity: true },
      },
    },
  })

  return order?.items ?? []
}

/**
 * Die aktiven Beiträge des Hofs für „Aktuell vom Hof“ (Register F8: höchstens
 * fünf, der neueste zuerst). Trägt die Adresse `?beitrag=<id>` (geprüft) und
 * ist der Beitrag nicht unter den fünf, kommt er — nur wenn er aktiv ist und
 * GENAU diesem Hof gehört (ladeAktivenBeitrag) — hinten dazu; die Seite stellt
 * ihn oben hin (ordneBeitraege). Scheitert das Laden, fehlt nur der Abschnitt —
 * die Seite mit Produkten und Korb bleibt (Fehler inline statt der 500 für
 * alles); der Fehler geht nach Sentry, und `fehler` sagt der Seite, dass sie zu
 * `?beitrag=` nichts sagen kann („nicht mehr aktuell“ stimmte nicht: Der
 * Beitrag kann aktiv sein, Nr. 134). Die Vorschau im Bauern-Bereich ist
 * dieselbe Route (?vorschau=1) und bekommt deshalb dieselbe Liste.
 */
async function ladeBeitraege(farmId: string, kennung: string | null): Promise<{ beitraege: ActiveStatusPost[]; fehler: boolean }> {
  try {
    const neueste = await getActiveStatusPosts(farmId, HOFSEITE_BEITRAEGE_MAX)
    if (kennung === null || neueste.some((beitrag) => beitrag.id === kennung)) return { beitraege: neueste, fehler: false }
    const geteilt = await ladeAktivenBeitrag(farmId, kennung)
    return { beitraege: geteilt ? [...neueste, geteilt] : neueste, fehler: false }
  } catch (err) {
    unstable_rethrow(err)
    Sentry.captureException(err, { tags: { bereich: 'hofseite-beitrag' } })
    return { beitraege: [], fehler: true }
  }
}

export default async function FarmPage({ params, searchParams }: Props) {
  const { farmSlug } = await params
  const suche = await searchParams
  // Vor dem Streamen: Was kein öffentlicher Hof ist, antwortet mit 404 —
  // ohne den Hof zu laden und ohne Fristfreigabe.
  const seo = await pruefeHofseiteGeteilt(farmSlug, suche)
  if (!seo) notFound()

  return (
    <Suspense fallback={<HofseiteSkelett />}>
      <Hofseite farmSlug={farmSlug} suche={suche} geo={seo.geo} />
    </Suspense>
  )
}

/** Der Inhalt hinter dem Skelett — erst nach der Prüfung in FarmPage. */
async function Hofseite({ farmSlug, suche, geo }: { farmSlug: string; suche: Suchparameter; geo: HofSeo['geo'] }) {
  const { farm, ansicht } = await ladeHofseiteGeteilt(farmSlug, suche)

  // Nur noch ein Wettlauf (Hof zwischen Prüfung und Laden stillgelegt): Die
  // 404-Ansicht kommt dann hinter dem Skelett, mit Status 200 und noindex.
  if (!farm) notFound()

  // `?beitrag=` ist eine Systemgrenze: Was nicht passt, wird verworfen (Zod).
  // Wo Kaufen nicht wirkt (Vorschau), gibt es keinen Korb — also auch nichts,
  // was ein Nachbestell-Link hineinlegen dürfte (korbErlaubt, src/lib/hofseite-vorschau.ts).
  const reorder = nachbestellToken(suche.reorder)
  // Beiträge und Nachbestell-Artikel hängen nicht voneinander ab: gleichzeitig (Nr. 180). Die Beiträge fangen ihre Fehler selbst, der Nachbestell-Link wie bisher nicht.
  const [{ beitraege, fehler: beitraegeFehler }, reorderItems] = await Promise.all([
    ladeBeitraege(farm.id, beitragKennungSchema.parse(suche[BEITRAG_PARAMETER])),
    (async (): Promise<ReorderItem[]> => (reorder && ansicht.kaufen ? await loadReorderItems(reorder, farm.id) : []))(),
  ])
  // Einmal hier, auf dem Server: Gebührensatz und „vor 2 Tagen" rechnen in
  // Server und Browser vom selben Zeitpunkt (sonst Hydration-Abweichung).
  const jetzt = new Date()
  // Die Kaufsperre (Register N24) einmal je Seite, mit demselben Zeitpunkt und den vollen Tagen, die
  // ladeHofseite schon gezählt hat — alle Kaufwege der Seite lesen nur dieses Ergebnis.
  const sperre = kaufSperre(farm, jetzt)

  return (
    <KundeShellMitSitzung>
      <FarmPageView
        // Telefon und E-Mail erst nach dem Kauf (Nr. 60): Sie bleiben hier auf
        // dem Server und stehen so nicht in den Seitendaten der Client-Komponente.
        farm={entferneKontaktdaten(farm)}
        beitraege={beitraege}
        beitraegeFehler={beitraegeFehler}
        reorderItems={reorderItems}
        ansicht={ansicht}
        jetzt={jetzt.toISOString()}
        sperre={sperre}
      />
      {/* Strukturierte Daten (Nr. 117): auf dem Server gebaut — Koordinaten und volle Adresse gehen nicht an die Client-Komponente. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSicher(hofJsonLd(farm, geo, metadatenBasis(UMGEBUNG.appUrl))) }} />
      {/* Teilen-Zählung (Gate 7): nur auf der Seite für Kundinnen, nie in der Vorschau des Hofs. */}
      {ansicht.art === 'kundin' && <TeilenBesuchMelden farmSlug={farm.slug} />}
      {/* Der Fuß der Startseite — ein Server-Teil, deshalb hier statt in der Client-Komponente. */}
      <StartseiteFuss jahr={jetzt.getFullYear()} />
    </KundeShellMitSitzung>
  )
}
