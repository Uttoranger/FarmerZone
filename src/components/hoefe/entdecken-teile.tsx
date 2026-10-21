import Link from 'next/link'
import { ChevronRight, MapPinOff, SearchX, Store, X } from 'lucide-react'
import type { HoefeFilter } from '@/schemas/hoefe-filter'
import {
  aktiveFilter,
  alleZuruecksetzen,
  hoefeHref,
  type EntdeckenChip,
  type Leerzustand,
  type ProduktTreffer,
} from '@/lib/hoefe-entdecken'
import {
  ABHOLZEILE_TEXT,
  formatiereEntfernung,
  type AbholFenster,
  type Bezugspunkt,
  type NeuerBeitrag,
  type UmkreisStufe,
  type VorschauProdukt,
} from '@/lib/hofuebersicht'
import { hofseitenLink, istBestellbar, type AngebotVorhanden, type AngebotsProdukt } from '@/lib/bereiche-anzeige'
import { SIEGEL, illustrationPfad, type AnzeigeBereich, type ProductCategoryValue } from '@/lib/taxonomie'
import { formatGrundpreis, formatGrundpreisZeile, formatKilopreis } from '@/lib/format'
import { hofIllustrationen } from '@/lib/hoefe-anzeige'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { FilterChip, FilterChipReihe } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/empty-state'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { StatusBadge } from '@/components/ui/status-badge'
import HoefeFotostreifen from '@/components/hoefe/hoefe-fotostreifen'
import { HoefeProduktzeilen } from '@/components/hoefe/hoefe-produktzeilen'
import { HofBildflaeche } from '@/components/hoefe/hof-bildflaeche'
import { HofKopf } from '@/components/hoefe/hof-kopf'
import { Vorschaubild } from '@/components/hoefe/hof-vorschaubild'
import { Abholzeile } from '@/components/hoefe/abholzeile'
import { BeitragMarke } from '@/components/hoefe/beitrag-marke'
import { Abzeichen } from '@/components/ui/abzeichen'

/*
 * Die Teile von Entdecken (/hoefe) im neuen Design (Nachtlauf Nr. 09) —
 * ohne eigenen Zustand, damit sie sich ohne Browser rendern und prüfen
 * lassen (tests/hoefe-seite.test.ts). Was sie zeigen, entscheidet
 * src/lib/hoefe-entdecken.ts; Zustand und Verdrahtung hält hoefe-client.tsx.
 *
 * Mockups: web-k1-entdecken-einstieg, web-k1-suche-filter,
 * web-k1-filter-futtermittel, web-k1-leerzustand, mobil-k1-entdecken.
 */

/** Was ein Chip-Tipp auslöst: die Seite schreibt den Filter selbst in die Adresse. */
export type FilterWahl = (ziel: HoefeFilter) => void

/**
 * Der onNavigate eines Filter-Links: Ein gewöhnlicher Klick wendet den Filter
 * im Browser an (history.replaceState über use-hoefe-adresse.ts) statt die Seite
 * neu vom Server zu holen; Mittelklick und „In neuem Tab" erreichen ihn nie
 * und folgen dem echten Link.
 */
export function beimNavigieren(
  ziel: HoefeFilter,
  onWahl?: FilterWahl,
  /** Was zusätzlich wegfällt, das nicht in der Adresse steht (der Umkreis). */
  danach?: () => void
): ((ereignis: { preventDefault: () => void }) => void) | undefined {
  if (!onWahl && !danach) return undefined
  return (ereignis: { preventDefault: () => void }) => {
    if (onWahl) {
      ereignis.preventDefault()
      onWahl(ziel)
    }
    danach?.()
  }
}

/** Eine Reihe Filter-Chips — jeder ein echter Link auf seine Adresse, mit nofollow (Register N19). */
export function ChipReihe({
  beschriftung,
  chips,
  onWahl,
  umbrechen = false,
  className,
}: {
  beschriftung: string
  chips: readonly EntdeckenChip[]
  onWahl?: FilterWahl
  /** Im Filter-Blatt brechen die Chips um (Mockup mobil-k1-filter); sonst scrollt die Reihe am Handy waagrecht. */
  umbrechen?: boolean
  className?: string
}): React.JSX.Element | null {
  if (chips.length === 0) return null
  const chipsAlsLinks = chips.map((chip) => (
    <FilterChip
      key={chip.schluessel}
      href={hoefeHref(chip.ziel)}
      aktiv={chip.aktiv}
      onNavigate={beimNavigieren(chip.ziel, onWahl)}
      nofollow
    >
      {chip.label}
    </FilterChip>
  ))
  if (umbrechen) {
    return (
      <ul aria-label={beschriftung} className={cn('flex flex-wrap gap-2', className)}>
        {chipsAlsLinks.map((chip) => (
          <li key={chip.key}>{chip}</li>
        ))}
      </ul>
    )
  }
  return (
    <FilterChipReihe beschriftung={beschriftung} className={className}>
      {chipsAlsLinks}
    </FilterChipReihe>
  )
}

/**
 * „Aktive Filter: [Suche: Eier ×] [Bio ×] Alle zurücksetzen" (Mockup
 * web-k1-suche-filter). Jeder Eintrag ist ein Link auf die Adresse ohne ihn
 * (nofollow, Register N19); Umkreis und Bezugspunkt (nur Seitenzustand) sind Knöpfe.
 */
export function AktiveFilterZeile({
  filter,
  onWahl,
  umkreis = null,
  onUmkreisAufheben,
  ort = null,
  onOrtAufheben,
  suchtextImFeld = false,
}: {
  filter: HoefeFilter
  onWahl?: FilterWahl
  /** Der Umkreis lebt nur im Seitenzustand (nie in der URL) — er kommt deshalb eigens herein. */
  umkreis?: UmkreisStufe
  onUmkreisAufheben?: () => void
  /** Der Bezugspunkt als Eintrag — nur im Kartenmodus am Handy, dem die Karte
   *  „Wir zeigen Höfe rund um …" samt „Ort ändern" fehlt (Nr. 52). */
  ort?: Bezugspunkt | null
  onOrtAufheben?: () => void
  /** Der getippte Suchtext steht schon im Feld daneben (Kartenmodus am Handy):
   *  kein eigener Eintrag „Suche: …" — sonst erschiene mit dem ersten Zeichen
   *  eine zweite Zeile, und die Karte schrumpfte beim Tippen (Nr. 52, Runde 1).
   *  Übernommene Such-Marken bleiben Einträge, sie stehen in keinem Feld. */
  suchtextImFeld?: boolean
}): React.JSX.Element | null {
  const aktiv = aktiveFilter(filter, umkreis, ort).filter((f) => !(suchtextImFeld && f.schluessel === 'suchtext'))
  if (aktiv.length === 0) return null
  const zurueck = alleZuruecksetzen(filter)
  // „Alle zurücksetzen" nimmt alles, was die Zeile zeigt — mit dem Bezugspunkt, wenn er darin steht.
  const zuruecksetzenDanach =
    onUmkreisAufheben || (ort && onOrtAufheben)
      ? () => {
          onUmkreisAufheben?.()
          if (ort) onOrtAufheben?.()
        }
      : undefined
  const eintrag = cn(
    // before: der unsichtbare Rand — 5 px je Seite, das ::before sitzt im Innenrand des Rahmens (wie chip.tsx): 34 + 10 = 44 px.
    "relative inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-3 text-[13px] text-foreground transition-colors duration-[250ms] before:absolute before:inset-x-0 before:-inset-y-[5px] before:content-[''] hover:bg-muted",
    FOKUS_RAHMEN
  )
  const inhalt = (label: string) => (
    <>
      {/* Gekürzt statt übergelaufen: Ein Suchbegriff darf 100 Zeichen lang sein. */}
      <span className="min-w-0 truncate">{label}</span>
      <X className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
    </>
  )
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span id="aktive-filter" className="text-[13px] text-muted-foreground">
        Aktive Filter:
      </span>
      <ul aria-labelledby="aktive-filter" className="flex min-w-0 flex-wrap gap-2">
        {aktiv.map((f) => (
          <li key={f.schluessel} className="min-w-0">
            {f.umkreis || f.ort ? (
              // Ein Knopf, kein Link: Umkreis und Bezugspunkt stehen in keiner Adresse.
              <button
                type="button"
                onClick={f.ort ? onOrtAufheben : onUmkreisAufheben}
                aria-label={`${f.label} entfernen`}
                title={f.label}
                className={eintrag}
              >
                {inhalt(f.label)}
              </button>
            ) : (
              <Link
                href={hoefeHref(f.ohne)}
                onNavigate={beimNavigieren(f.ohne, onWahl)}
                prefetch={onWahl ? false : undefined}
                rel="nofollow"
                aria-label={`${f.label} entfernen`}
                title={f.label}
                className={eintrag}
              >
                {inhalt(f.label)}
              </Link>
            )}
          </li>
        ))}
      </ul>
      <Link
        href={hoefeHref(zurueck)}
        onNavigate={beimNavigieren(zurueck, onWahl, zuruecksetzenDanach)}
        prefetch={onWahl ? false : undefined}
        rel="nofollow"
        className={cn(
          'inline-flex min-h-11 items-center rounded-lg px-1 text-[13px] font-semibold text-status-fertig hover:underline',
          FOKUS_RAHMEN
        )}
      >
        Alle zurücksetzen
      </Link>
    </div>
  )
}

/** „Nicht auf der Karte" — ein Hof ohne Kartenpunkt steht nur in der Liste (Register N22). */
export function OhneKartenpunkt(): React.JSX.Element {
  return (
    <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
      <MapPinOff className="size-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
      {ABHOLZEILE_TEXT.nichtAufDerKarte}
    </p>
  )
}

/** Was eine Hofkarte braucht — ein Ausschnitt aus HofUebersichtEintrag samt Entfernung. */
export type KartenHof = {
  slug: string
  name: string
  postalCode: string
  city: string
  isPaused: boolean
  /** Die Kategorien im gewählten Bereich — ohne Foto zeigt die Bildfläche ihre Illustrationen. */
  kategorien: ProductCategoryValue[]
  /** Die aktiven Abholzeiten; die Abholzeile rechnet daraus mit der Uhr des Browsers. */
  abholfenster?: readonly AbholFenster[]
  /** Das kaufbare Angebot — nur, ob es eines gibt, zählt hier (istBestellbar). */
  angebot: AngebotVorhanden
  fotos: string[]
  entfernungKm: number | null
  latitude: number | null
  longitude: number | null
  /** Abzeichen „Gründungshof“ (Register K2, Nr. 116) — nur Ja/Nein, nie die Nummer. */
  gruendungshof: boolean
  /** Der neueste aktive Beitrag (höchstens sieben Tage alt) — die Marke am Bild (Register N22, Nr. 129); fehlt er, keine Marke. */
  neuerBeitrag?: NeuerBeitrag | null
}

/**
 * Eine Hofkarte der Liste — Variante A des Boards system-k1-entdecken-v2
 * (Register N22): oben Foto (wischbar) oder die Bildfläche, beide 150 px
 * hoch; darunter Name, Entfernung, Ort, „Nicht auf der Karte" für Höfe ohne
 * Kartenpunkt, die Abholzeile (bzw. „Noch nicht bestellbar") und drei
 * Produktzeilen mit Preis samt „+ n weitere". Keine Initialen, keine
 * Kategorie-Chips. Pausierte Höfe bleiben sichtbar, aber ausgegraut
 * (Umsetzungsprompt §4, „Urlaubsmodus"): ruhigere Fläche, gestrichelter
 * Rand, Bild entsättigt, Name leiser — der Text bleibt lesbar.
 *
 * EIN Link (Regel aus #82): Die Produktzeilen haben keine eigenen.
 *  - `split` (Browser ab 1024 px, Karte daneben): Die Fläche WÄHLT den Hof
 *    (Karte fliegt zum Pin) — so mit dem Betreiber entschieden; zur Hofseite
 *    führt nur „Zum Hof". Das Bild (116 × 100) steht links.
 *  - schmal: Die ganze Karte ist der Link zur Hofseite, oben der
 *    Fotostreifen (Wischen) wie bisher.
 */
export function HofKarte({
  hof,
  bereich,
  schaufenster,
  split,
  ausgewaehlt,
  jetzt,
  onAuswaehlen,
  onFotoTipp,
}: {
  hof: KartenHof
  bereich: AnzeigeBereich
  /** Die Schaufenster-Auswahl (waehleVorschauImBereich, drei Zeilen) und „+ n weitere". */
  schaufenster: { produkte: VorschauProdukt[]; weitere: number }
  split: boolean
  ausgewaehlt: boolean
  /** Der Zeitpunkt des Servers beim Bauen der Seite (ISO-Text) — für die Abholzeile. */
  jetzt: string
  onAuswaehlen?: () => void
  onFotoTipp?: () => void
}): React.JSX.Element {
  const ziel = hofseitenLink(hof.slug, bereich)
  const bilder = hofIllustrationen(hof.kategorien)
  const ohneKartenpunkt = hof.latitude == null || hof.longitude == null
  // Die Marke „Neu · vor …“ am Bild (Nr. 129): Ihr Satz für den Screenreader hängt am einen Link der Karte.
  const markeId = hof.neuerBeitrag ? `beitrag-marke-${hof.slug}` : undefined
  const marke = (kompakt: boolean, className: string) => (
    <BeitragMarke beitrag={hof.neuerBeitrag} jetzt={jetzt} beschreibungId={`beitrag-marke-${hof.slug}`} kompakt={kompakt} className={className} />
  )
  return (
    <article
      data-pausiert={hof.isPaused ? 'ja' : undefined}
      className={cn(
        'relative overflow-hidden rounded-2xl border transition-colors duration-[250ms]',
        hof.isPaused ? 'border-dashed border-border bg-background' : 'border-border bg-card',
        ausgewaehlt && 'border-status-fertig bg-accent/10'
      )}
    >
      {split ? (
        <button
          type="button"
          onClick={onAuswaehlen}
          aria-label={`${hof.name} auf der Karte zeigen`}
          aria-describedby={markeId}
          // Die Überlagerung fängt den Zeiger — sie trägt den vollen Namen.
          title={hof.name}
          className={cn('absolute inset-0 rounded-2xl', FOKUS_RAHMEN_INNEN)}
        />
      ) : (
        <Link
          href={ziel}
          aria-label={`${hof.name} ansehen`}
          aria-describedby={markeId}
          title={hof.name}
          className={cn('absolute inset-0 rounded-2xl', FOKUS_RAHMEN_INNEN)}
        />
      )}

      {/* Nach der Überlagerung im Baum: So liegt der Streifen über ihr, und das
          Wischen erreicht ihn (Pfeile und Punkte stoppen die Weitergabe selbst).
          Ohne Foto die Bildfläche in derselben Höhe — durchlässig für den Zeiger. */}
      {!split &&
        (hof.fotos.length > 0 ? (
          <div className={cn(hof.isPaused && 'opacity-60 grayscale')}>
            <HoefeFotostreifen
              fotos={hof.fotos}
              hofName={hof.name}
              sizes="(min-width: 768px) 720px, calc(100vw - 2rem)"
              onTipp={onFotoTipp}
            />
          </div>
        ) : (
          <HofBildflaeche
            bilder={bilder}
            sizes="150px"
            gedaempft={hof.isPaused}
            className="pointer-events-none relative h-[150px] w-full rounded-t-2xl"
          />
        ))}
      {/* Am Bild oben links, über Streifen und Fläche, durchlässig für Zeiger und Wischen — keine zweite Zeile. */}
      {!split && marke(false, 'absolute top-2.5 left-2.5 z-10')}

      {/* Über der Überlagerung (relative), aber durchlässig für den Zeiger:
          Klicks landen auf ihr, und Axe kann Schrift und Fläche messen. */}
      <div className="pointer-events-none relative flex items-start gap-3.5 p-3">
        {split && (
          <span className="relative shrink-0">
            <Vorschaubild
              foto={hof.fotos[0] ?? null}
              illustration={bilder[0]}
              sizes="116px"
              gedaempft={hof.isPaused}
              className="h-[100px] w-[116px] rounded-xl"
            />
            {marke(true, 'absolute bottom-1.5 left-1.5')}
          </span>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* Klein über dem Namen, kein eigener Knopf — die ganze Karte bleibt der Link (Nr. 116). */}
          {hof.gruendungshof && <Abzeichen groesse="klein" className="self-start" />}
          <HofKopf hof={hof} als="h2" gedaempft={hof.isPaused} />
          {ohneKartenpunkt && <OhneKartenpunkt />}
          <Abholzeile fenster={hof.abholfenster} isPaused={hof.isPaused} bestellbar={istBestellbar(hof)} jetzt={jetzt} />
          <HoefeProduktzeilen produkte={schaufenster.produkte} weitere={schaufenster.weitere} />
          {split && (
            <p className="mt-1">
              {/* Der einzige Weg zur Hofseite im Splitscreen — über der Auswahl-Fläche. */}
              <Link
                href={ziel}
                className={cn(
                  // before: der unsichtbare Rand oben und unten — 36 px Knopf, 44 px Trefferfläche (wie chip.tsx: 5 px, das ::before sitzt im Innenrand des Rahmens).
                  "pointer-events-auto relative z-10 inline-flex h-9 items-center gap-1 rounded-full border border-border bg-card px-3.5 text-[13px] font-semibold text-foreground transition-colors duration-[250ms] before:absolute before:inset-x-0 before:-inset-y-[5px] before:content-[''] hover:bg-muted",
                  FOKUS_RAHMEN
                )}
              >
                Zum Hof
                <ChevronRight className="size-4" strokeWidth={1.7} aria-hidden="true" />
              </Link>
            </p>
          )}
        </div>
      </div>
    </article>
  )
}

/** Was eine Produktzeile vom Hof braucht. */
export type TrefferHof = {
  slug: string
  name: string
  postalCode: string
  city: string
  isPaused: boolean
  abholfenster?: readonly AbholFenster[]
  angebot: AngebotVorhanden
  entfernungKm: number | null
}

/** Preis je Gebinde und darunter der Grundpreis — Futter aus der Kennzeichnung, sonst aus dem Gebinde. */
function preise(p: AngebotsProdukt): {
  preis: string
  grundpreis: string | null
} {
  return {
    preis: formatGrundpreis(p.price, p.unit, p.unitSize),
    grundpreis: (p.grundpreis && formatKilopreis(p.grundpreis)) || formatGrundpreisZeile(p.price, p.unit, p.unitSize),
  }
}

/**
 * Eine Zeile der Produktsuche (Mockups web-k1-suche-filter,
 * web-k1-filter-futtermittel): Produkt, Siegel, Hof mit Entfernung oder Ort,
 * Abholung, Preis. Die ganze Zeile führt zur Hofseite — In-den-Korb gibt es
 * dort (Reservierung gehört zur Hofseite, ARCHITECTURE §5); das Produktdetail
 * kommt mit Nr. 11.
 */
export function ProduktZeile({
  treffer,
  bereich,
  jetzt,
}: {
  treffer: ProduktTreffer<TrefferHof>
  bereich: AnzeigeBereich
  /** Der Zeitpunkt des Servers beim Bauen der Seite (ISO-Text) — für die Abholzeile. */
  jetzt: string
}): React.JSX.Element {
  const { hof, produkt } = treffer
  const { preis, grundpreis } = preise(produkt)
  const wo = hof.entfernungKm !== null ? formatiereEntfernung(hof.entfernungKm) : `${hof.postalCode} ${hof.city}`
  return (
    <article
      data-pausiert={hof.isPaused ? 'ja' : undefined}
      className={cn(
        'relative flex items-center gap-3.5 rounded-2xl border p-3 transition-colors duration-[250ms]',
        hof.isPaused ? 'border-dashed border-border bg-background' : 'border-border bg-card hover:border-foreground/30'
      )}
    >
      <Link
        href={hofseitenLink(hof.slug, bereich)}
        aria-label={`${produkt.name} bei ${hof.name} ansehen`}
        title={`${produkt.name} – ${hof.name}`}
        className={cn('absolute inset-0 rounded-2xl', FOKUS_RAHMEN_INNEN)}
      />
      {/* Über dem gestreckten Link, aber durchlässig für den Zeiger (wie bei der Hofkarte). */}
      <div className="pointer-events-none relative flex min-w-0 flex-1 items-center gap-3.5">
        <Vorschaubild
          foto={produkt.imageUrl}
          ausschnitt={produkt.bildAusschnitt}
          illustration={illustrationPfad(produkt.category, produkt.subcategory)}
          sizes="72px"
          gedaempft={hof.isPaused}
          className="size-[72px] rounded-xl"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="line-clamp-2 min-w-0 text-[15px] font-semibold break-words text-foreground">{produkt.name}</h2>
            {produkt.labels.map((s) => (
              <StatusBadge key={s} status="fertig">
                {SIEGEL[s].name}
              </StatusBadge>
            ))}
          </div>
          <p className="truncate text-[13px] text-muted-foreground" title={hof.name}>
            {hof.name} · {wo}
          </p>
          <Abholzeile fenster={hof.abholfenster} isPaused={hof.isPaused} bestellbar={istBestellbar(hof)} jetzt={jetzt} />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
          <span className="text-[15px] font-semibold whitespace-nowrap text-foreground">{preis}</span>
          {grundpreis && <span className="text-[12px] whitespace-nowrap text-muted-foreground">{grundpreis}</span>}
          <span
            aria-hidden="true"
            className="mt-1 hidden h-8 items-center gap-0.5 rounded-full border border-border px-3 text-[12.5px] font-semibold text-foreground sm:inline-flex"
          >
            Zum Hof
            <ChevronRight className="size-3.5" strokeWidth={1.7} />
          </span>
        </div>
      </div>
    </article>
  )
}

/** Leerzustand mit Ausweg (Mockup web-k1-leerzustand) — Link (nofollow) oder Umkreis-Knopf. */
export function EntdeckenLeer({
  leer,
  onWahl,
  onUmkreis,
}: {
  leer: Leerzustand
  onWahl?: FilterWahl
  onUmkreis?: (stufe: UmkreisStufe) => void
}): React.JSX.Element {
  const { ausweg } = leer
  const knopf = cn(
    'inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground transition-opacity duration-[250ms] hover:opacity-90',
    FOKUS_RAHMEN
  )
  return (
    <EmptyState
      symbol={SearchX}
      titel={leer.titel}
      satz={leer.satz}
      ausweg={
        ausweg.art === 'link' ? (
          <Link
            href={hoefeHref(ausweg.ziel)}
            onNavigate={beimNavigieren(ausweg.ziel, onWahl)}
            prefetch={onWahl ? false : undefined}
            rel="nofollow"
            className={knopf}
          >
            {ausweg.label}
          </Link>
        ) : (
          <button type="button" onClick={() => onUmkreis?.(ausweg.stufe)} className={knopf}>
            {ausweg.label}
          </button>
        )
      }
    />
  )
}

/** Noch kein einziger öffentlicher Hof — kein Fehler, ein Anfang (wie die Startseite). */
export function KeineHoefe(): React.JSX.Element {
  return (
    <EmptyState
      symbol={Store}
      titel="Die ersten Höfe kommen gerade dazu"
      satz="Schau bald wieder vorbei. Du hast selbst einen Hof? Dann mach den Anfang."
      ausweg={
        <Link
          href="/register"
          className={cn(
            'inline-flex h-11 items-center rounded-full border border-border px-[18px] text-sm font-semibold text-foreground hover:bg-muted',
            FOKUS_RAHMEN
          )}
        >
          Hof registrieren
        </Link>
      }
    />
  )
}

/**
 * Fehler inline statt der 500 für die ganze Seite (DESIGN_SYSTEM, „Zustände"):
 * dieselbe Gestalt wie auf der Startseite — orange Hinweiskarte, Schrift in
 * der normalen Textfarbe. So gibt es keinen roten Text, der im hellen Theme
 * unter 4,5:1 fiele (das neue Design hat noch kein Fehler-Token, Nr. 08).
 */
export function HoefeFehler(): React.JSX.Element {
  return (
    <Hinweiskarte
      ton="orange"
      titel="Wir konnten die Höfe gerade nicht laden."
      aktion={
        <Link
          // Die Seite wird alle fünf Minuten neu gebaut (Register N19): Derselbe Weg zeigt die Höfe, sobald ein Bau sie lesen konnte.
          href="/hoefe"
          prefetch={false}
          className={cn(
            'inline-flex h-11 items-center rounded-full border border-border px-4 text-sm font-semibold hover:bg-muted',
            FOKUS_RAHMEN
          )}
        >
          Noch einmal versuchen
        </Link>
      }
    >
      Versuch es in einem Moment noch einmal.
    </Hinweiskarte>
  )
}
