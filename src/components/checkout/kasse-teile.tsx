import { useId, useState, type ReactNode } from 'react'
import Link from 'next/link'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { AlertCircle, Info, TimerReset } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatEuro, formatPosition } from '@/lib/format'
import { SERVICEGEBUEHR_HINWEIS, centsAlsEuro } from '@/lib/servicegebuehr'
import { PLATTFORMGEBUEHR_BEZEICHNUNG, PLATTFORMGEBUEHR_SATZ } from '@/lib/konditionen'
import { mitEndpreis, type PreisAnzeige } from '@/lib/plattformgebuehr'
import type { RuecktrittAngabe } from '@/lib/ruecktritt-angaben'
import { RuecktrittHinweis } from '@/components/shared/ruecktritt-hinweis'
import {
  GEBUEHR_ENTFAELLT,
  KONTAKT_HINWEIS,
  PREISE_INKL_UST,
  RESERVIERUNG_MINUTEN,
  zahlungAbgelehntText,
  type AbholKachel,
  type KassenBetraege,
  type KassenZahlart,
  type ReservierungsStand,
} from '@/lib/kasse'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Hinweiskarte, HinweiskarteFehler } from '@/components/ui/hinweiskarte'
import { GrundpreisZeile } from '@/components/shared/grundpreis-zeile'

/*
 * Die Bausteine der Kasse im neuen Design (Nachtlauf Nr. 12), abgenommen von
 * docs/mockups/web-k3-warenkorb-bezahlen.html, web-k3-zahlung-abgelehnt.html,
 * mobil-k3-warenkorb-bezahlen.html und mobil-k3-zahlung-abgelehnt.html;
 * geglättet seit Nr. 82 (Register N10) nach web-/mobil-k3-kasse-glatt.html und
 * system-k3-kasse-bezahlen-bar.html.
 *
 * Nur Anzeige: Beträge, Frist und Zahlarten kommen fertig entschieden aus
 * src/lib/kasse.ts. Die Farben stimmen, weil die Kasse in der Fokus-Shell
 * (data-design="neu") steht — nur Tokens, in beiden Themes.
 */

/**
 * Karte: Radius 16 px, Fläche --surface mit Rahmen --border. Fest in Pixeln: Im neuen Design ist `--radius` 16 px,
 * `rounded-2xl` wären dort 29 px — fast eine Pille (Bewertung Lauf 31, Boards s1-/w1-kasse: 16 px).
 */
export const KARTE = 'rounded-[16px] border border-border bg-card px-4 py-4 md:px-[18px]'

/**
 * Ein Abschnitt der Kasse ohne Karte (Boards s1-/w1-kasse, Nr. 227): „Abholung wählen“, „Deine Daten“ und
 * „Bezahlen“ stehen auf dem Grund der Seite; Karten sind nur Korb, Übersicht und was darunter steht.
 */
export const ABSCHNITT = 'flex min-w-0 flex-col gap-3'

/** Titel eines Abschnitts bzw. einer Karte (17 px fett, Boards s1-/w1-kasse). */
export const KARTEN_TITEL = 'text-[17px] leading-tight font-bold text-foreground'

/** Kleine Überschrift in Großbuchstaben („ÜBERSICHT“, Board w1-kasse). */
export const ETIKETT = 'text-[12px] font-bold tracking-[1px] text-muted-foreground uppercase'

/** Leiser Hinweis, nie dunkler als --fz-text-muted. */
export const HINWEIS = 'text-[12.5px] leading-normal text-muted-foreground'

/** Beschriftung über einem Feld (15 px halbfett in der Textfarbe, Board w1-kasse Bild 2). */
export const FELD_LABEL = 'mb-1.5 block text-[15px] font-semibold text-foreground'

/**
 * Eingabefeld: 48 px hoch, Radius 12 px, auf der Fläche mit dem Feldrand (≥ 3:1, DESIGN_SYSTEM „Farbtokens“);
 * die Abschnitte stehen seit Nr. 227 ohne Karte auf dem Grund. 16 px am Handy (kein Zoom).
 */
export const FELD = cn(
  'h-12 w-full min-w-0 rounded-[12px] border border-input bg-card px-3.5 text-base text-foreground placeholder:text-muted-foreground aria-[invalid=true]:border-2 aria-[invalid=true]:border-status-offen md:text-[15px]',
  FOKUS_RAHMEN
)

/**
 * Hauptknopf der Kasse — Kundenaktion, also grün (DESIGN_SYSTEM, „Farbrollen"; Register N41 f); volle Breite,
 * darum Radius 14 px statt Pille (DESIGN_SYSTEM „Typografie und Form“, Boards s1-/w1-kasse), 52 px hoch.
 */
export const KNOPF_GRUEN = cn(
  'inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-accent px-[18px] text-base font-bold text-accent-foreground transition-opacity duration-[250ms] hover:opacity-90 disabled:opacity-60',
  FOKUS_RAHMEN
)

/**
 * Der Hauptknopf im Browser (Board w1-kasse): links unter dem Formular, rechts bündig und so breit wie sein Text.
 * Am Handy bleibt er die volle Breite der festen Leiste.
 */
export const KNOPF_GRUEN_IM_BROWSER = 'lg:w-auto lg:self-end lg:px-6'

/** Textknopf bzw. -link in grüner Schrift; Trefferfläche 44 px. */
export const TEXTLINK = cn(
  'inline-flex min-h-11 items-center rounded-full px-1 text-[13.5px] font-semibold text-status-fertig underline-offset-2 hover:underline',
  FOKUS_RAHMEN
)

/**
 * Fehler am Feld. Kein eigener Fehler-Token im Design-System (Bericht Nr. 08):
 * Orange wie die Hinweiskarten der umgestellten Seiten, als Text in
 * `text-status-offen` — der hält 4,5 : 1 in beiden Themes (DESIGN_SYSTEM).
 */
export function FeldFehler({ id, children }: { id: string; children: ReactNode }): React.JSX.Element {
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-[13px] leading-snug font-medium text-status-offen">
      <AlertCircle className="mt-px size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

/**
 * Das Raster der Kasse: im Browser ab 1024 px links Korb und Angaben, rechts
 * die Übersicht (klebend); darunter alles in einer Spalte. Am Handy steht die
 * Übersicht direkt unter dem Korb (Mockup mobil-k3-warenkorb-bezahlen: Summen
 * am Korb) — mit `uebersichtZuletzt` (Formular seit Nr. 82, Mockup
 * mobil-k3-kasse-glatt) wie im Quelltext nach Bezahlen. Unten Platz für die
 * feste Leiste am Handy.
 *
 * Mit `kopf` (Formular, Lauf 31, Board w1-kasse): ab 768 px die h1 „Bestellen bei <Hof>“ über dem Inhalt, und ab
 * 1024 px teilt `KassenAbschluss` sich auf — Übersicht und Angaben zum Hof rechts, Zusammenfassung, Gewährleistung
 * und Kaufknopf links unter „Bezahlen“ (`ABSCHLUSS_RECHTS`, `ABSCHLUSS_LINKS`). Die Reihenfolge im Quelltext bleibt
 * Übersicht → Angaben → Zusammenfassung → Gewährleistung → Knopf (Nr. 60, 210, 211): Die Hülle der Übersicht ist ab
 * 1024 px `display: contents`, ihre zwei Gruppen stehen direkt im Raster.
 */
export function KassenRaster({
  korb,
  uebersicht,
  uebersichtZuletzt = false,
  kopf,
  children,
}: {
  korb: ReactNode
  uebersicht: ReactNode
  uebersichtZuletzt?: boolean
  /** Die h1 der Seite ab 768 px; am Handy steht sie im Kopf der Fokus-Shell. */
  kopf?: ReactNode
  children: ReactNode
}): React.JSX.Element {
  if (kopf !== undefined) {
    return (
      // lg:grid-rows-[auto_auto_auto_1fr]: Kopf, Korb, Abschnitte, Abschluss. Die rechte Spalte (Zeile 2 bis 4) ist
      // meist länger als Korb und Abschnitte; den Überhang nimmt die letzte, flexible Zeile — unter dem Korb klafft
      // keine Lücke.
      <div className="mx-auto grid max-w-[1200px] gap-4 px-4 pt-4 pb-44 md:px-6 md:pt-6 md:pb-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[auto_auto_auto_1fr] lg:gap-x-7">
        <div className="hidden min-w-0 md:block lg:col-start-1 lg:row-start-1">{kopf}</div>
        <div className="min-w-0 lg:col-start-1 lg:row-start-2">{korb}</div>
        <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-3">{children}</div>
        <div className="min-w-0 lg:contents">{uebersicht}</div>
      </div>
    )
  }
  return (
    // Im Quelltext steht die Übersicht mit der Hauptaktion ZULETZT: Die
    // Tastatur kommt erst durch die Angaben, dann zum Knopf. Ohne
    // `uebersichtZuletzt` zeigt `order` sie am Handy direkt unter dem Korb,
    // ab 1024 px steht sie rechts.
    // lg:grid-rows-[auto_1fr]: Die rechte Spalte (zwei Zeilen hoch) ist meist länger als der Korb; ohne die Regel
    // verteilte das Raster den Überhang auf beide Zeilen, und unter dem Korb klaffte eine Lücke vor „Abholung“.
    <div className="mx-auto grid max-w-[1200px] gap-4 px-4 pt-4 pb-44 md:px-6 md:pt-7 md:pb-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[auto_1fr] lg:gap-x-7">
      <div className={cn(!uebersichtZuletzt && 'order-1', 'min-w-0 lg:order-none lg:col-start-1 lg:row-start-1')}>{korb}</div>
      <div className={cn(!uebersichtZuletzt && 'order-3', 'flex min-w-0 flex-col gap-4 lg:order-none lg:col-start-1 lg:row-start-2')}>
        {children}
      </div>
      <div
        className={cn(
          !uebersichtZuletzt && 'order-2',
          'min-w-0 lg:sticky lg:top-24 lg:order-none lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start'
        )}
      >
        {uebersicht}
      </div>
    </div>
  )
}

/** Ab 1024 px die rechte Spalte des Formulars: Übersicht und Angaben zum Hof, klebend (KassenRaster mit `kopf`). */
export const ABSCHLUSS_RECHTS = 'flex min-w-0 flex-col gap-3.5 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-3 lg:row-start-2 lg:self-start'

/**
 * Ab 1024 px links unter „Bezahlen“ nach einer Linie (Board w1-kasse): Zusammenfassung, Gewährleistung, Knopf und
 * Sätze — der Knopf rechts bündig. Am Handy die Folge über und in der festen Leiste.
 */
export const ABSCHLUSS_LINKS = 'flex min-w-0 flex-col gap-3.5 lg:col-start-1 lg:row-start-4 lg:self-start lg:border-t lg:border-border lg:pt-5'

export type KorbPosition = {
  productId: string
  name: string
  imageUrl?: string | null
  quantity: number
  unit: string
  unitSize?: number | null
  price: number
  /**
   * Angaben des Hofs zum Rücktritt (Nr. 214) — der Hinweis unter dem Namen. Nur bei Verbraucherinnen
   * gesetzt; bei „Betrieb“ und ohne Angabe null bzw. weggelassen, dann steht nichts.
   */
  ruecktritt?: RuecktrittAngabe | null
}

/** „Dein Korb bei …" — Positionen mit Menge und Zeilensumme in Cent; ändern nur auf der Hofseite. */
export function KorbKarte({
  hofName,
  positionen,
  zeilenCents,
  aendernHref,
  anzeige,
}: {
  hofName: string
  positionen: readonly KorbPosition[]
  zeilenCents: ReadonlyMap<string, number>
  /** Zum Korb auf der Hofseite — nur, solange keine Bestellung steht. */
  aendernHref?: string
  /** N38: im Hofpreis-Modell der Satz — dann stehen Endpreise da (mitEndpreis), sonst der Warenpreis. */
  anzeige?: PreisAnzeige
}): React.JSX.Element {
  return (
    <section aria-labelledby="kasse-korb" className={KARTE}>
      <div className="flex items-center gap-3">
        <h2 id="kasse-korb" className={cn(KARTEN_TITEL, 'min-w-0 flex-1 break-words')}>
          Dein Warenkorb bei <span title={hofName}>{hofName}</span>
        </h2>
        {aendernHref && (
          // Sichtbar nur „Ändern“ (Board w1-kasse); der Name sagt, was geändert wird, und beginnt mit dem sichtbaren Wort nicht —
          // er enthält es (WCAG 2.5.3, Groß-/Kleinschreibung zählt nicht).
          <Link href={aendernHref} aria-label="Warenkorb ändern" className={cn(TEXTLINK, 'shrink-0 text-[15px] underline')}>
            Ändern
          </Link>
        )}
      </div>
      <ul className="mt-1">
        {positionen.map((roh) => {
          // Nur Anzeige: Endpreis je Stück und Grundpreis aus dem Endpreis (N38); die Zeilensumme kommt aus kassenBetraege.
          const p = mitEndpreis(roh, anzeige ?? null)
          return (
          // Eine Zeile je Position wie im Board (Name und Menge in der einen Schreibweise `formatPosition`, der Betrag
          // rechts), ohne Vorschaubild; darunter leise Grundpreis und der Hinweis zum Rücktritt (Nr. 214) — beide
          // bleiben vor dem Kaufknopf.
          <li key={p.productId} className="py-1.5">
            {/* Boards s1-/w1-kasse (Lauf 31): der Betrag hinter der Position — „3 × Bergkäse, 250 g · € 19,74“. */}
            <p className="line-clamp-2 text-[15px] leading-snug break-words" title={p.name}>
              {formatPosition({ name: p.name, quantity: p.quantity, unit: p.unit, unitSize: p.unitSize })}
              {' · '}
              <span className="whitespace-nowrap tabular-nums">{formatEuro(centsAlsEuro(zeilenCents.get(p.productId) ?? 0))}</span>
            </p>
            <GrundpreisZeile price={p.price} unit={p.unit} unitSize={p.unitSize} className="text-[12px]" />
            {p.ruecktritt && <RuecktrittHinweis angabe={p.ruecktritt} className="mt-0.5 text-[12px]" />}
          </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * Die Frist der Reservierung (Mockup: „Deine Ware ist bis 14:32 Uhr für dich
 * reserviert."). Die Restzeit ändert sich jede Minute und wird deshalb NICHT
 * vorgelesen; vorgelesen wird erst, wenn die Frist abläuft (role="alert").
 */
export function ReservierungsHinweis({
  stand,
  schritt,
  farmSlug,
  onNeuPruefen,
  prueftGerade = false,
}: {
  stand: ReservierungsStand
  schritt: 'formular' | 'zahlung'
  farmSlug?: string
  onNeuPruefen?: () => void
  prueftGerade?: boolean
}): React.JSX.Element | null {
  if (stand.zustand === 'unbekannt') return null

  if (stand.zustand === 'laeuft') {
    return (
      <p className="flex items-start gap-2.5 rounded-[11px] border border-border bg-background px-3 py-2.5 text-[13px] leading-snug">
        <TimerReset className="mt-px size-4 shrink-0 text-status-fertig" strokeWidth={1.7} aria-hidden="true" />
        <span>
          Deine Ware ist bis <b className="font-semibold">{stand.uhrzeit} Uhr</b> für dich reserviert{' '}
          <span className="text-muted-foreground">({stand.rest})</span>.
        </span>
      </p>
    )
  }

  // Abgelaufen. Vor dem Bestellen: Der Halt ist weg, andere können kaufen —
  // dieselbe Prüfung wie beim Öffnen der Kasse setzt ihn neu, soweit die Ware
  // noch da ist (/api/warenkorb/pruefen). Beim Bezahlen: Die Bestellung ist
  // verfallen, die Zahlung abgebrochen (src/server/verwaiste-bestellungen.ts).
  return (
    <div role="alert">
      {schritt === 'formular' ? (
        <Hinweiskarte
          ton="orange"
          symbol={TimerReset}
          // Die Übersicht ist nur 380 px breit: Aktion unter dem Text, nie daneben.
          className="sm:flex-col sm:items-start"
          titel="Deine Reservierung ist abgelaufen"
          aktion={
            onNeuPruefen && (
              <button type="button" onClick={onNeuPruefen} disabled={prueftGerade} aria-busy={prueftGerade} className={TEXTLINK}>
                {prueftGerade ? 'Wird geprüft …' : 'Verfügbarkeit neu prüfen'}
              </button>
            )
          }
        >
          Andere können die Ware jetzt wieder kaufen. Prüf die Verfügbarkeit neu – was noch da ist, halten wir dann wieder{' '}
          {RESERVIERUNG_MINUTEN} Minuten für dich.
        </Hinweiskarte>
      ) : (
        <Hinweiskarte
          ton="orange"
          symbol={TimerReset}
          // Die Übersicht ist nur 380 px breit: Aktion unter dem Text, nie daneben.
          className="sm:flex-col sm:items-start"
          aktion={
            farmSlug && (
              <Link href={`/${farmSlug}`} className={TEXTLINK}>
                Zurück zum Hof und neu bestellen
              </Link>
            )
          }
        >
          Deine Reservierung ist abgelaufen, es wurde nichts abgebucht.
        </Hinweiskarte>
      )}
    </div>
  )
}

/**
 * Die Übersicht rechts (Browser) bzw. unter dem Korb oder nach Bezahlen
 * (Handy): Frist, Warenpreis, Servicegebühr als EIGENE Zeile (E4, nie
 * eingerechnet), Gesamt, darunter die Hauptaktion.
 *
 * Die Gebührenzeile (N10): Titel, daneben ein (i)-Knopf, der die Erklärung
 * aufklappt (`gebuehrErklaerung`, ohne Angabe der Erklärsatz allein). Geld nur
 * anzeigen: Der Betrag kommt allein aus `betraege`; „entfällt" steht nur, wo
 * kein Betrag anfällt und die Kasse es so sagt (bar vor dem Stichtag,
 * `gebuehrZeile`). Sonst entfällt die Zeile ohne Gebühr ersatzlos.
 */
export function UebersichtKarte({
  betraege,
  gebuehrText,
  gebuehrErklaerung = SERVICEGEBUEHR_HINWEIS,
  gebuehrEntfaellt = false,
  hofpreis = false,
  reservierung,
  fehler,
  positionen,
  children,
}: {
  betraege: Pick<KassenBetraege, 'warenCents' | 'gebuehrCents' | 'gesamtCents'>
  /** Die Positionen als Zeilen über „Ware“ (Board s1-/w1-kasse Bild 5: unter dem Mindestbestellwert steht nur die Übersicht). */
  positionen?: readonly string[]
  /** Titel der Gebührenzeile — „Servicegebühr (5 %)" (`gebuehrZeile`), im Zahlungsschritt `zahlungsGebuehrText`. */
  gebuehrText: string
  /** Was der (i)-Knopf aufklappt. */
  gebuehrErklaerung?: string
  /** Bar vor dem Stichtag (Register B1): „entfällt" statt € 0,00. */
  gebuehrEntfaellt?: boolean
  /** N38: Hofpreis-Modell — „Ware · Plattformgebühr (6 %) · Gesamt“, der Satz steht offen unter der Summe. */
  hofpreis?: boolean
  reservierung?: ReactNode
  /** Ein Fehler der Anfrage — inline an der Karte, kein Modal. */
  fehler?: ReactNode
  children?: ReactNode
}): React.JSX.Element {
  const [erklaerungOffen, setErklaerungOffen] = useState(false)
  const erklaerungId = useId()
  const gebuehr =
    betraege.gebuehrCents > 0 ? formatEuro(centsAlsEuro(betraege.gebuehrCents)) : gebuehrEntfaellt ? GEBUEHR_ENTFAELLT : null
  return (
    <section aria-labelledby="kasse-uebersicht" className={cn(KARTE, 'flex flex-col gap-3')}>
      <h2 id="kasse-uebersicht" className={ETIKETT}>
        Übersicht
      </h2>
      {reservierung}
      {positionen && positionen.length > 0 && (
        <ul className="flex flex-col gap-1 text-[15px]">
          {positionen.map((zeile, i) => (
            <li key={i} className="break-words">
              {zeile}
            </li>
          ))}
        </ul>
      )}
      <dl className="flex flex-col gap-2 text-[15px]">
        <div className="flex items-baseline gap-2">
          <dt>{hofpreis ? 'Ware' : 'Warenpreis'}</dt>
          <dd className="ml-auto tabular-nums">{formatEuro(centsAlsEuro(betraege.warenCents))}</dd>
        </div>
        {gebuehr && (
          <div className="flex items-center gap-2">
            <dt className="flex min-w-0 items-center">
              <span className="min-w-0 break-words">{gebuehrText}</span>
              {/* Tippfläche 44 px, die Zeile bleibt durch den negativen Rand so hoch wie der Text. */}
              <button
                type="button"
                aria-label={hofpreis ? `Was ist die ${PLATTFORMGEBUEHR_BEZEICHNUNG}?` : 'Was ist die Servicegebühr?'}
                aria-expanded={erklaerungOffen}
                aria-controls={erklaerungId}
                onClick={() => setErklaerungOffen((offen) => !offen)}
                className={cn(
                  '-my-3 -ml-1.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground',
                  FOKUS_RAHMEN
                )}
              >
                {/* Der Kreis mit „i“ in der Größe des Boards (22 px, Strich 2). */}
                <Info className="size-[22px]" strokeWidth={2} aria-hidden="true" />
              </button>
            </dt>
            <dd className={cn('ml-auto shrink-0 tabular-nums', betraege.gebuehrCents === 0 && 'text-muted-foreground')}>{gebuehr}</dd>
          </div>
        )}
      </dl>
      {gebuehr && (
        <p id={erklaerungId} hidden={!erklaerungOffen} className={HINWEIS}>
          {gebuehrErklaerung}
        </p>
      )}
      <div className="h-px bg-border" />
      <p className="flex items-baseline gap-2 font-bold">
        <span className="text-base">Gesamt</span>
        <span className="ml-auto text-[22px] tabular-nums">{formatEuro(centsAlsEuro(betraege.gesamtCents))}</span>
      </p>
      <p className={cn(HINWEIS, '-mt-1.5')}>{PREISE_INKL_UST}</p>
      {hofpreis && <p className={HINWEIS}>{PLATTFORMGEBUEHR_SATZ}</p>}
      {fehler}
      {children}
    </section>
  )
}

/**
 * Die eine feste Leiste unten am Handy — ab 768 px dasselbe Element in der
 * Übersicht (DESIGN_SYSTEM, „Fokus-Seiten": nie zwei Leisten übereinander).
 */
export function AktionsLeiste({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div
      data-feste-leiste
      // Der Kaufknopf: Der Cookie-Hinweis steht darüber, nie darauf (src/lib/cookie-hinweis.ts).
      data-unten-fest=""
      // Lauf 31 (Board s1-kasse): am Handy knapp — 10 px oben, 6 px zwischen Knopf und Sätzen, 12 px unten; die Sätze
      // laufen als ein Absatz in 12 px (`KaufknopfSaetze`). Vorher nahm die Leiste rund 40 % der Höhe.
      className="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-1.5 border-t border-border bg-card px-4 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:static md:z-auto md:gap-2 md:border-0 md:bg-transparent md:p-0"
    >
      {children}
    </div>
  )
}

/**
 * „Zahlung abgelehnt“ als orange Hinweiskarte im Bezahlen-Block (V17, Boards s1-/w1-kasse Bild 4; seit Nr. 227 der
 * Baustein `HinweiskarteFehler`, `role="alert"`): nichts abgebucht, Ware wartet bis … Kein „Nochmal“ — der Kaufknopf
 * heißt dann „Erneut bezahlen“.
 */
export function ZahlungAbgelehnt({ bisUhrzeit }: { bisUhrzeit: string | null }): React.JSX.Element {
  const { titel, text } = zahlungAbgelehntText(bisUhrzeit)
  return <HinweiskarteFehler titel={titel}>{text}</HinweiskarteFehler>
}

/** Der Satz unter der E-Mail — der Weg zur Bestellung ist der Link in der Bestätigung. */
export function KontaktHinweis(): React.JSX.Element {
  return <p className={cn(HINWEIS, 'mt-1.5')}>{KONTAKT_HINWEIS}</p>
}

/**
 * Die Zahlart-Wahl (E5: online und bar). Echte Radioknöpfe — Pfeiltasten
 * wechseln, der Screenreader sagt die Gruppe an. Jede Zahlart ist eine Karte
 * mit Titel und eigener Erklärung (`zusatz`), ab 768 px nebeneinander
 * (Register N10, Mockups web-/mobil-k3-kasse-glatt); die ganze Karte ist
 * Tippfläche.
 *
 * Ein `hinweis` (heute nur der Testbetrieb, Register Z2) steht als eigene
 * Zeile unter der Erklärung, orange, IM Label: Er gehört zur Zahlart und
 * wird mit ihr vorgelesen — wer „Online bezahlen" wählt, hat ihn gehört.
 */
export function ZahlartWahl({
  zahlarten,
  feld,
  fehler,
}: {
  zahlarten: readonly KassenZahlart[]
  feld: UseFormRegisterReturn<'paymentMethod'>
  fehler?: string
}): React.JSX.Element {
  return (
    <fieldset aria-describedby={fehler ? 'paymentMethod-fehler' : undefined}>
      <legend className="sr-only">Wie möchtest du bezahlen?</legend>
      <div className={cn('grid gap-2.5', zahlarten.length > 1 && 'md:grid-cols-2')}>
        {zahlarten.map((z) => (
          // Board s1-/w1-kasse: Karte auf der Fläche, der Kreis links, Titel und Erklärung rechts daneben; gewählt mit
          // grünem Rand (2 px), ohne Tönung.
          <label
            key={z.wert}
            // Gewählt: Rand und Punkt in `status-fertig` — hell das Grün der Kundenaktion, dunkel das helle Mint der
            // Boards (s1-/w1-kasse-dunkel); `accent` läge dort mit 1,9 : 1 kaum über der Fläche.
            className="flex min-h-[72px] min-w-0 cursor-pointer items-start gap-3 rounded-[16px] border border-border bg-card px-3.5 py-3.5 has-[:checked]:border-2 has-[:checked]:border-status-fertig has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-solid"
          >
            <input type="radio" value={z.wert} {...feld} className="mt-0.5 size-[22px] shrink-0 cursor-pointer accent-status-fertig outline-none" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[15px] font-semibold">{z.titel}</span>
              <span className="text-[13px] leading-snug text-muted-foreground">{z.zusatz}</span>
              {z.hinweis && (
                <span className="mt-1 flex items-start gap-1.5 text-[12.5px] leading-snug font-medium text-status-offen">
                  <AlertCircle className="mt-px size-3.5 shrink-0" strokeWidth={1.7} aria-hidden="true" />
                  <span>{z.hinweis}</span>
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
      {fehler && <FeldFehler id="paymentMethod-fehler">{fehler}</FeldFehler>}
    </fieldset>
  )
}

/**
 * Die Abholfenster als Kacheln (Boards s1-/w1-kasse, seit Nr. 227): echte Radioknöpfe, sichtbar links in der
 * Kachel, daneben „Heute, Mi, 3. März“ und die Uhrzeit; der Fokus zeigt sich am Rahmen der Kachel. Volle
 * Fenster bleiben sichtbar, gestrichelt auf der Nebenfläche, nicht wählbar und mit „ausgebucht“ statt der
 * Uhrzeit — ohne Deckkraft auf dem Text (Kontrast). Am Handy eine je Zeile, ab 640 px zwei, ab 768 px drei.
 */
export function AbholWahl({
  kacheln,
  feld,
  fehler,
}: {
  kacheln: readonly AbholKachel[]
  feld: UseFormRegisterReturn<'pickupSlotKey'>
  fehler?: string
}): React.JSX.Element {
  return (
    <fieldset aria-describedby={fehler ? 'pickupSlotKey-fehler' : undefined}>
      <legend className="sr-only">Wann holst du ab?</legend>
      <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3">
        {kacheln.map((k) => (
          <label
            key={k.key}
            className={cn(
              'flex min-h-[64px] min-w-0 items-center gap-3 rounded-[16px] border px-3.5 py-2.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-solid',
              k.ausgebucht
                ? 'cursor-not-allowed border-dashed border-border bg-muted text-muted-foreground'
                : 'cursor-pointer border-border bg-card has-[:checked]:border-2 has-[:checked]:border-status-fertig'
            )}
          >
            <input type="radio" value={k.key} {...feld} disabled={k.ausgebucht} className="size-[22px] shrink-0 cursor-pointer accent-status-fertig outline-none disabled:cursor-not-allowed" />
            <span className="flex min-w-0 flex-col">
              {/* Jeder Termin mit Datum (Nr. 46): „Heute"/„Morgen" nur zusätzlich, nie statt des Datums. */}
              <span className="text-[15px] font-semibold break-words">
                {k.relativ ? `${k.relativ}, ${k.datum}` : k.datum}
              </span>
              {/* Voll heißt: Der Hof nimmt für dieses Fenster nichts mehr an (maxOrders). */}
              {k.ausgebucht ? (
                <span className="text-[13px] font-semibold">ausgebucht</span>
              ) : (
                <span className="text-[13px] whitespace-nowrap text-muted-foreground">{k.zeit}</span>
              )}
            </span>
          </label>
        ))}
      </div>
      {fehler && <FeldFehler id="pickupSlotKey-fehler">{fehler}</FeldFehler>}
    </fieldset>
  )
}
