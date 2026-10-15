import { Suspense, cache } from 'react'
import type { Metadata } from 'next'
import { unstable_rethrow } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { Eye } from 'lucide-react'
import { ladeOeffentlicheHoefe } from '@/server/queries/oeffentliche-hoefe'
import { ladeStartseite } from '@/server/queries/startseite'
import { vorschauDieserAnfrage } from '@/server/startseite-vorschau'
import { schonGemeldet } from '@/server/oeffentlich-lesen'
import { waehleKartenHoefe, waehleStartseitenHoefe, type StartseitenHof, type StartseitenKarte } from '@/lib/startseite'
import { HOEFE_AUSWAHL_MAX, standText, zuRendern, type RenderEintrag, type StartseitenBlockDaten } from '@/lib/startseite-gestalten'
import type { KartenForm } from '@/lib/regionskarte'
import { istBrennmaterialSaison } from '@/lib/brennmaterial-saison'
import { categoryImagePath } from '@/lib/product-image'
import { STARTSEITE_VORSCHAUBILD } from '@/lib/vorschaubild'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { RegionsKarte, StartseiteKopf } from '@/components/startseite/startseite-kopf'
import { HoefeInDerNaehe, HofKarten, HofKartenFehler, HofKartenSkelett } from '@/components/startseite/hoefe-in-der-naehe'
import { STARTSEITE_ABSCHNITTE } from '@/components/startseite/startseite-abschnitte'
import { StartseitenBlock } from '@/components/startseite/bloecke/startseiten-block'
import { MARKE } from '@/lib/marke'

// Futter steht im Titel und in der Beschreibung: Wer „Heu kaufen" sucht, soll
// die Startseite finden, nicht erst eine Hofseite. Open Graph und die
// X-/Twitter-Karte sagen dasselbe und zeigen das große Vorschaubild
// (src/lib/vorschaubild.ts), damit ein geteilter Link dieselbe Karte zeigt.
const SEITEN_TITEL = `${MARKE} — Lebensmittel und Futter direkt vom Hof`
const SEITEN_BESCHREIBUNG =
  'Lebensmittel für die Küche, Heu, Stroh und Futter für den Stall — direkt von den Höfen der Region bestellen und abholen. Pilotbetrieb mit ausgewählten Höfen.'

export const metadata: Metadata = {
  title: SEITEN_TITEL,
  description: SEITEN_BESCHREIBUNG,
  openGraph: {
    title: SEITEN_TITEL,
    description: SEITEN_BESCHREIBUNG,
    type: 'website',
    siteName: MARKE,
    images: [STARTSEITE_VORSCHAUBILD],
  },
  twitter: {
    card: 'summary_large_image',
    title: SEITEN_TITEL,
    description: SEITEN_BESCHREIBUNG,
    images: [STARTSEITE_VORSCHAUBILD],
  },
}

// Statisch vom CDN, alle fünf Minuten neu gebaut (ISR) — im selben Takt wie
// die Hofliste (src/server/queries/oeffentliche-hoefe.ts). Leert eine
// Produktaktion deren Etikett, baut Next die Seite sofort neu. Deshalb liest
// die Seite NICHTS aus der Anfrage (kein headers(), cookies(), auth.api): Das
// machte sie dynamisch, und jeder Besuch wartete auf eine Serverless-Funktion.
// Die Sitzung für die Kopfzeile liest KundeShellMitSitzung im Browser.
// „Saison" des Brennmaterial-Bands, Beispielrechnung, Jahr im Fuß und der
// Zeitraum der Blöcke (Admin › Startseite) gelten damit je Bau — höchstens
// fünf Minuten alt; Speichern in Admin › Startseite baut sofort neu.
//
// EINZIGE AUSNAHME: die Vorschau aus Admin › Startseite (Register N16). Nur
// im Draft Mode — den schaltet „Vorschau öffnen" für den Browser des Admins
// ein — rendert Next die Seite je Anfrage (Cache-Control: no-store), und
// erst dann liest vorschauDieserAnfrage den Link und die Admin-Sitzung
// (src/server/startseite-vorschau.ts). draftMode() selbst macht die Seite
// nicht dynamisch: Beim Bau und bei jedem anderen Besuch ist er aus.
export const revalidate = 300

/**
 * Die Höfe der Startseite — einmal je Bau (cache), obwohl die Karte im Kopf
 * (zweimal: Browser und Handy) und die Hofkarten sie brauchen. Karte und
 * Hofkarten kommen aus DERSELBEN Liste, auch die Koordinaten der Pins — keine
 * zweite Abfrage (Nr. 59). Scheitert das Laden, zeigt die Seite den
 * Fehler inline an den Karten (DESIGN_SYSTEM, „Zustände") statt der 500 für
 * die ganze Startseite; der Fehler geht trotzdem nach Sentry. BEWUSST IN KAUF
 * GENOMMEN: Diese Fassung bleibt dann bis zum nächsten Bau stehen (höchstens
 * fünf Minuten) — ein Wurf statt der Startseite wäre schlimmer, und beim Bau
 * ohne Datenbank (Build-Umgebung) bräche er den ganzen Build ab.
 */
const ladeStartseitenHoefe = cache(async (): Promise<
  { hoefe: StartseitenHof[]; karte: StartseitenKarte; alle: StartseitenHof[] } | 'fehler'
> => {
  try {
    const liste = await ladeOeffentlicheHoefe()
    // `alle` für die Höfe-Auswahl der Blöcke — aus DERSELBEN Liste, keine Abfrage je Block.
    return { hoefe: waehleStartseitenHoefe(liste), karte: waehleKartenHoefe(liste), alle: waehleStartseitenHoefe(liste, liste.length) }
  } catch (err) {
    // Nexts eigene Steuersignale (Umleitung, dynamisches Rendern) gehören
    // nicht in die Fehleranzeige.
    unstable_rethrow(err)
    // Einen Verbindungsabbruch hat die Wiederholung schon gemeldet (Nr. 47).
    if (!schonGemeldet(err)) Sentry.captureException(err, { tags: { bereich: 'startseite-hoefe' } })
    return 'fehler'
  }
})

async function HofKartenGeladen() {
  const daten = await ladeStartseitenHoefe()
  return daten === 'fehler' ? <HofKartenFehler /> : <HofKarten hoefe={daten.hoefe} />
}

/** Ohne Daten (Fehler) nur das Land — den Fehler sagen die Hofkarten darunter. */
async function RegionsKarteGeladen({ form }: { form: KartenForm }) {
  const daten = await ladeStartseitenHoefe()
  return <RegionsKarte form={form} karte={daten === 'fehler' ? null : daten.karte} />
}

/** Ein Block; die Höfe-Auswahl nimmt ihre Höfe aus derselben Liste wie die Hofkarten. */
async function BlockGeladen({ block }: { block: StartseitenBlockDaten }) {
  if (block.vorlage === 'HOEFE_AUSWAHL') {
    const daten = await ladeStartseitenHoefe()
    if (daten === 'fehler') return null
    const hoefe = block.hofSlugs
      .flatMap((slug) => daten.alle.find((h) => h.slug === slug) ?? [])
      .slice(0, HOEFE_AUSWAHL_MAX)
    return <StartseitenBlock block={block} hoefe={hoefe} />
  }
  const kategorieBild = block.vorlage === 'KATEGORIE_HINWEIS' ? categoryImagePath(block.kategorie) : null
  return <StartseitenBlock block={block} kategorieBild={kategorieBild} />
}

/** Ein Eintrag der Liste: Kopf und Höfe mit den Daten der Seite, die übrigen Abschnitte aus ihrer Tabelle, Blöcke als Vorlage. */
function Eintrag({ eintrag, jetzt }: { eintrag: RenderEintrag; jetzt: Date }) {
  switch (eintrag.art) {
    case 'KOPF':
      return (
        <StartseiteKopf
          karte={(form) => (
            <Suspense fallback={<RegionsKarte form={form} karte={null} />}>
              <RegionsKarteGeladen form={form} />
            </Suspense>
          )}
        />
      )
    case 'HOEFE':
      return (
        <HoefeInDerNaehe>
          <Suspense fallback={<HofKartenSkelett />}>
            <HofKartenGeladen />
          </Suspense>
        </HoefeInDerNaehe>
      )
    case 'BLOCK':
      return (
        <Suspense fallback={null}>
          <BlockGeladen block={eintrag.block} />
        </Suspense>
      )
    default: {
      const Abschnitt = STARTSEITE_ABSCHNITTE[eintrag.art]
      return <Abschnitt jetzt={jetzt} />
    }
  }
}

/** Nur in der Vorschau: oben ein Band, damit niemand die Vorschau für die echte Seite hält. */
function VorschauBand({ datum }: { datum: Date }) {
  return (
    <p role="status" className="flex items-center justify-center gap-2 border-b border-primary/45 bg-primary/12 px-4 py-2 text-center text-[13px] font-semibold text-foreground">
      <Eye className="size-4 shrink-0 text-status-offen" strokeWidth={1.8} aria-hidden="true" />
      Vorschau · Stand am {standText(datum)}
    </p>
  )
}

/**
 * Die Startseite im neuen Design (Gate 4, Mockups web-k0-startseite und
 * mobil-k0-startseite) in der KundeShell: Kopfzeile im Browser, Unterleiste
 * am Handy. Seit Nr. 96 (Register N16) in der Reihenfolge aus Admin ›
 * Startseite — EINE Abfrage für die Liste samt Blöcken (ladeStartseite); ohne
 * Zeilen oder bei einem Lesefehler die heutige Reihenfolge (zuRendern).
 * Blöcke nur in ihrem Zeitraum, verglichen hier am Server.
 *
 * Die Seite wartet auf nichts: Die Höfe laden hinter Suspense-Grenzen mit
 * eigenem Skelett, die Sitzung liest der Browser. Deshalb gibt es keine
 * src/app/loading.tsx: Sie gälte für jede Route ohne eigene Ladeansicht
 * (DESIGN_SYSTEM, „Ladeansicht").
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<React.JSX.Element> {
  // Liest die Anfrage nur im Draft Mode (vorschauDieserAnfrage) — sonst bliebe die Seite nicht statisch.
  const vorschau = await vorschauDieserAnfrage(searchParams, new Date())
  const jetzt = vorschau?.datum ?? new Date()
  const eintraege = zuRendern(await ladeStartseite(), jetzt, {
    brennmaterialSaison: istBrennmaterialSaison(jetzt),
    blockEntwurfId: vorschau?.blockEntwurfId ?? null,
  })

  return (
    <KundeShellMitSitzung>
      {vorschau && <VorschauBand datum={vorschau.datum} />}
      {eintraege.map((eintrag) => (
        <Eintrag key={eintrag.art === 'BLOCK' ? eintrag.block.id : eintrag.art} eintrag={eintrag} jetzt={jetzt} />
      ))}
    </KundeShellMitSitzung>
  )
}
