import { Suspense, cache } from 'react'
import { unstable_rethrow } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { Eye } from 'lucide-react'
import { ladeOeffentlicheHoefe } from '@/server/queries/oeffentliche-hoefe'
import { schonGemeldet } from '@/server/oeffentlich-lesen'
import { waehleKartenHoefe, waehleStartseitenHoefe, type StartseitenHof, type StartseitenKarte } from '@/lib/startseite'
import { HOEFE_AUSWAHL_MAX, type RenderEintrag, type StartseitenBlockDaten } from '@/lib/startseite-gestalten'
import { vorschauBandText } from '@/lib/startseite-fassung'
import type { VorschauQuelle } from '@/schemas/startseite'
import type { KartenForm } from '@/lib/regionskarte'
import { categoryImagePath } from '@/lib/product-image'
import { metadatenBasis } from '@/lib/vorschaubild'
import { UMGEBUNG } from '@/lib/umgebung-server'
import { jsonLdSicher, startseiteJsonLd } from '@/lib/json-ld'
import { MARKE } from '@/lib/marke'
import { RegionsKarte, StartseiteKopf } from '@/components/startseite/startseite-kopf'
import { HoefeInDerNaehe, HofKarten, HofKartenFehler, HofKartenSkelett } from '@/components/startseite/hoefe-in-der-naehe'
import { STARTSEITE_ABSCHNITTE } from '@/components/startseite/startseite-abschnitte'
import { StartseitenBlock } from '@/components/startseite/bloecke/startseiten-block'

/*
 * Der Inhalt der Startseite — EIN Baustein für die Startseite `/` (statisch,
 * ISR) und ihre Vorschau `/startseite-vorschau` (dynamisch, signierter Link
 * und Admin-Sitzung; Register N16, Ergänzung 25.10.2026, Nr. 182). Die
 * Seiten entscheiden nur, WELCHE Einträge zu welchem Tag gelten
 * (`zuRendern`), und legen die KundeShell darum; was daraus wird, steht nur
 * hier — so sieht die Vorschau genau aus wie die Seite für Kundinnen.
 * `tests/isr-liest-keine-anfrage-wache.test.ts` wacht, dass es keine zweite
 * Kopie gibt.
 */

// Futter steht im Titel und in der Beschreibung: Wer „Heu kaufen" sucht, soll
// die Startseite finden, nicht erst eine Hofseite. Open Graph und die
// X-/Twitter-Karte sagen dasselbe und zeigen das große Vorschaubild
// (src/lib/vorschaubild.ts), damit ein geteilter Link dieselbe Karte zeigt.
// Die Vorschau trägt denselben Titel (Nr. 182).
export const STARTSEITE_TITEL = `${MARKE} — Lebensmittel und Futter direkt vom Hof`
export const STARTSEITE_BESCHREIBUNG =
  'Lebensmittel für die Küche, Heu, Stroh und Futter für den Stall — direkt von den Höfen der Region bestellen und abholen. Pilotbetrieb mit ausgewählten Höfen.'

/**
 * Die Höfe der Startseite — einmal je Bau bzw. je Anfrage der Vorschau
 * (cache), obwohl die Karte im Kopf (zweimal: Browser und Handy) und die
 * Hofkarten sie brauchen. Karte und Hofkarten kommen aus DERSELBEN Liste,
 * auch die Koordinaten der Pins — keine zweite Abfrage (Nr. 59). Scheitert
 * das Laden, zeigt die Seite den Fehler inline an den Karten
 * (DESIGN_SYSTEM, „Zustände") statt der 500 für die ganze Startseite; der
 * Fehler geht trotzdem nach Sentry. BEWUSST IN KAUF GENOMMEN: Diese Fassung
 * bleibt dann bis zum nächsten Bau stehen (höchstens fünf Minuten) — ein
 * Wurf statt der Startseite wäre schlimmer, und beim Bau ohne Datenbank
 * (Build-Umgebung) bräche er den ganzen Build ab.
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

/** `jetzt` für die Marke „Neu · vor …“ am Bild (Register N22, Nr. 129): einmal von der Seite, den Rest rechnet der Browser. */
async function HofKartenGeladen({ jetzt }: { jetzt: Date }) {
  const daten = await ladeStartseitenHoefe()
  return daten === 'fehler' ? <HofKartenFehler /> : <HofKarten hoefe={daten.hoefe} jetzt={jetzt.toISOString()} />
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
            <HofKartenGeladen jetzt={jetzt} />
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

/** Nur in der Vorschau: oben ein Band, damit niemand die Vorschau für die echte Seite hält — mit Quelle und Tag (Nr. 106). */
function VorschauBand({ quelle, datum }: { quelle: VorschauQuelle; datum: Date }) {
  return (
    <p role="status" className="flex items-center justify-center gap-2 border-b border-primary/45 bg-primary/12 px-4 py-2 text-center text-[13px] font-semibold text-foreground">
      <Eye className="size-4 shrink-0 text-status-offen" strokeWidth={1.8} aria-hidden="true" />
      {vorschauBandText(quelle, datum)}
    </p>
  )
}

/**
 * Die Startseite im neuen Design (Gate 4, Mockups web-k0-startseite und
 * mobil-k0-startseite): die Einträge in ihrer Reihenfolge aus Admin ›
 * Startseite (Register N16), dazu die strukturierten Daten. `band` nur auf
 * /startseite-vorschau: dann steht oben das Band mit Quelle und Tag.
 *
 * Die Höfe laden hinter Suspense-Grenzen mit eigenem Skelett — die Seite
 * wartet auf nichts davon (DESIGN_SYSTEM, „Ladeansicht").
 */
export function StartseitenInhalt({
  eintraege,
  jetzt,
  band,
}: {
  eintraege: RenderEintrag[]
  jetzt: Date
  band?: { quelle: VorschauQuelle; datum: Date }
}): React.JSX.Element {
  return (
    <>
      {/* Strukturierte Daten (Nr. 117): Organization und WebSite, ohne Suchfeld — /hoefe? sperrt robots.txt. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSicher(startseiteJsonLd(metadatenBasis(UMGEBUNG.appUrl))) }} />
      {band && <VorschauBand quelle={band.quelle} datum={band.datum} />}
      {eintraege.map((eintrag) => (
        <Eintrag key={eintrag.art === 'BLOCK' ? eintrag.block.id : eintrag.art} eintrag={eintrag} jetzt={jetzt} />
      ))}
    </>
  )
}
