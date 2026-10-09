import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { AlertCircle, CreditCard, Package, TimerReset } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatEuro, formatMenge } from '@/lib/format'
import { SERVICEGEBUEHR_HINWEIS, centsAlsEuro } from '@/lib/servicegebuehr'
import {
  KONTAKT_HINWEIS,
  RESERVIERUNG_MINUTEN,
  zahlungAbgelehntText,
  type AbholKachel,
  type KassenBetraege,
  type KassenZahlart,
  type ReservierungsStand,
} from '@/lib/kasse'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { GrundpreisZeile } from '@/components/shared/grundpreis-zeile'

/*
 * Die Bausteine der Kasse im neuen Design (Nachtlauf Nr. 12), abgenommen von
 * docs/mockups/web-k3-warenkorb-bezahlen.html, web-k3-zahlung-abgelehnt.html,
 * mobil-k3-warenkorb-bezahlen.html und mobil-k3-zahlung-abgelehnt.html.
 *
 * Nur Anzeige: Beträge, Frist und Zahlarten kommen fertig entschieden aus
 * src/lib/kasse.ts. Die Farben stimmen, weil die Kasse in der Fokus-Shell
 * (data-design="neu") steht — nur Tokens, in beiden Themes.
 */

/** Karte: Radius 16 px, Fläche --surface mit Rahmen --border. */
export const KARTE = 'rounded-2xl border border-border bg-card px-4 py-4 md:px-[18px]'

/** Titel einer Karte (Fraunces 18 px). */
export const KARTEN_TITEL = 'font-heading text-[18px] leading-tight font-semibold'

/** Leiser Hinweis, nie dunkler als --fz-text-muted. */
export const HINWEIS = 'text-[12.5px] leading-normal text-muted-foreground'

/** Beschriftung über einem Feld. */
export const FELD_LABEL = 'mb-1 block text-[12.5px] font-semibold text-muted-foreground'

/** Eingabefeld: 46 px hoch, Radius 11 px, Grund etwas tiefer als die Karte; 16 px am Handy (kein Zoom). */
export const FELD = cn(
  'h-[46px] w-full min-w-0 rounded-[11px] border border-border bg-background px-3.5 text-base text-foreground placeholder:text-muted-foreground aria-[invalid=true]:border-status-offen md:text-[14.5px]',
  FOKUS_RAHMEN
)

/** Hauptknopf der Kasse — Kundenaktion, also grün (DESIGN_SYSTEM, „Farbrollen"); volle Breite. */
export const KNOPF_GRUEN = cn(
  'inline-flex h-[50px] w-full items-center justify-center gap-2 rounded-full bg-accent px-[18px] text-[15px] font-semibold text-accent-foreground transition-opacity duration-[250ms] hover:opacity-90 disabled:opacity-60',
  FOKUS_RAHMEN
)

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
 * die Übersicht (klebend); darunter alles in einer Spalte, die Übersicht direkt
 * unter dem Korb (Mockup mobil: Summen am Korb). Unten Platz für die feste
 * Leiste am Handy.
 */
export function KassenRaster({
  korb,
  uebersicht,
  children,
}: {
  korb: ReactNode
  uebersicht: ReactNode
  children: ReactNode
}): React.JSX.Element {
  return (
    // Im Quelltext steht die Übersicht mit der Hauptaktion ZULETZT: Die
    // Tastatur kommt erst durch die Angaben, dann zum Knopf. Gezeigt wird sie
    // am Handy direkt unter dem Korb (order), ab 1024 px rechts.
    <div className="mx-auto grid max-w-[1200px] gap-4 px-4 pt-4 pb-44 md:px-6 md:pt-7 md:pb-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-x-7">
      <div className="order-1 min-w-0 lg:order-none lg:col-start-1 lg:row-start-1">{korb}</div>
      <div className="order-3 flex min-w-0 flex-col gap-4 lg:order-none lg:col-start-1 lg:row-start-2">{children}</div>
      <div className="order-2 min-w-0 lg:sticky lg:top-24 lg:order-none lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
        {uebersicht}
      </div>
    </div>
  )
}

export type KorbPosition = {
  productId: string
  name: string
  imageUrl?: string | null
  quantity: number
  unit: string
  unitSize?: number | null
  price: number
}

/** „Dein Korb bei …" — Positionen mit Menge und Zeilensumme in Cent; ändern nur auf der Hofseite. */
export function KorbKarte({
  hofName,
  positionen,
  zeilenCents,
  aendernHref,
}: {
  hofName: string
  positionen: readonly KorbPosition[]
  zeilenCents: ReadonlyMap<string, number>
  /** Zum Korb auf der Hofseite — nur, solange keine Bestellung steht. */
  aendernHref?: string
}): React.JSX.Element {
  return (
    <section aria-labelledby="kasse-korb" className={KARTE}>
      <div className="flex items-baseline gap-3">
        <h2 id="kasse-korb" className={cn(KARTEN_TITEL, 'min-w-0 flex-1 text-[19px] break-words')}>
          Dein Korb bei <span title={hofName}>{hofName}</span>
        </h2>
        {aendernHref && (
          <Link href={aendernHref} className={cn(TEXTLINK, 'shrink-0')}>
            Korb ändern
          </Link>
        )}
      </div>
      <p className={cn(HINWEIS, 'mt-0.5')}>Ein Korb pro Hof</p>
      <ul className="mt-2 divide-y divide-border">
        {positionen.map((p) => (
          <li key={p.productId} className="flex items-center gap-3 py-2.5">
            {p.imageUrl ? (
              <Image src={p.imageUrl} alt="" width={52} height={52} className="size-[52px] shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="flex size-[52px] shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Package className="size-5" strokeWidth={1.5} aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-[14.5px] font-semibold break-words" title={p.name}>
                {p.name}
              </p>
              <p className="text-[12.5px] text-muted-foreground">
                {formatMenge(p.quantity, p.unit, p.unitSize)} × {formatEuro(p.price)}
              </p>
              <GrundpreisZeile price={p.price} unit={p.unit} unitSize={p.unitSize} className="text-[11.5px]" />
            </div>
            <span className="shrink-0 text-right text-[14.5px] font-semibold tabular-nums">
              {formatEuro(centsAlsEuro(zeilenCents.get(p.productId) ?? 0))}
            </span>
          </li>
        ))}
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
 * Die Übersicht rechts (Browser) bzw. unter dem Korb (Handy): Frist,
 * Warenpreis, Servicegebühr als EIGENE Zeile (E4, nie eingerechnet), Gesamt,
 * darunter die Hauptaktion. Ohne Gebühr entfällt die Zeile ersatzlos.
 */
export function UebersichtKarte({
  betraege,
  gebuehrText,
  reservierung,
  fehler,
  children,
}: {
  betraege: Pick<KassenBetraege, 'warenCents' | 'gebuehrCents' | 'gesamtCents'>
  gebuehrText: string
  reservierung?: ReactNode
  /** Ein Fehler der Anfrage — inline an der Karte, kein Modal. */
  fehler?: ReactNode
  children?: ReactNode
}): React.JSX.Element {
  return (
    <section aria-labelledby="kasse-uebersicht" className={cn(KARTE, 'flex flex-col gap-3')}>
      <h2 id="kasse-uebersicht" className={KARTEN_TITEL}>
        Übersicht
      </h2>
      {reservierung}
      <dl className="flex flex-col gap-2 text-[13.5px]">
        <div className="flex items-baseline gap-2">
          <dt className="text-muted-foreground">Warenpreis</dt>
          <dd className="ml-auto tabular-nums">{formatEuro(centsAlsEuro(betraege.warenCents))}</dd>
        </div>
        {betraege.gebuehrCents > 0 && (
          <div className="flex items-baseline gap-2">
            <dt className="text-muted-foreground">{gebuehrText}</dt>
            <dd className="ml-auto shrink-0 tabular-nums">{formatEuro(centsAlsEuro(betraege.gebuehrCents))}</dd>
          </div>
        )}
      </dl>
      {betraege.gebuehrCents > 0 && <p className={HINWEIS}>{SERVICEGEBUEHR_HINWEIS}</p>}
      <div className="h-px bg-border" />
      <p className="flex items-baseline gap-2 text-[15px] font-semibold">
        <span>Gesamt</span>
        <span className="ml-auto tabular-nums">{formatEuro(centsAlsEuro(betraege.gesamtCents))}</span>
      </p>
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
      className="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-2 border-t border-border bg-card px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] md:static md:z-auto md:border-0 md:bg-transparent md:p-0"
    >
      {children}
    </div>
  )
}

/** „Zahlung abgelehnt" (Mockup web-k3-zahlung-abgelehnt): nichts abgebucht, Ware wartet bis … */
export function ZahlungAbgelehnt({ bisUhrzeit }: { bisUhrzeit: string | null }): React.JSX.Element {
  const { titel, text } = zahlungAbgelehntText(bisUhrzeit)
  return (
    <div role="alert">
      <Hinweiskarte ton="orange" symbol={CreditCard} titel={titel}>
        {text}
      </Hinweiskarte>
    </div>
  )
}

/** Der Satz unter der E-Mail — der Weg zur Bestellung ist der Link in der Bestätigung. */
export function KontaktHinweis(): React.JSX.Element {
  return <p className={cn(HINWEIS, 'mt-1.5')}>{KONTAKT_HINWEIS}</p>
}

/**
 * Die Zahlart-Wahl (E5: online und bar). Echte Radioknöpfe — Pfeiltasten
 * wechseln, der Screenreader sagt die Gruppe an; jede Zeile ist 50 px hoch.
 *
 * Ein `hinweis` (heute nur der Testbetrieb, Register Z2) steht als eigene
 * Zeile unter Titel und Zusatz, orange, IM Label: Er gehört zur Zahlart und
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
      <div className="divide-y divide-border">
        {zahlarten.map((z) => (
          <label
            key={z.wert}
            className="flex min-h-[50px] cursor-pointer flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg py-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-solid"
          >
            <input type="radio" value={z.wert} {...feld} className="size-5 shrink-0 cursor-pointer accent-accent outline-none" />
            <span className="text-[14px] font-semibold">{z.titel}</span>
            <span className="basis-full pl-8 text-[12.5px] text-muted-foreground sm:ml-auto sm:basis-auto sm:pl-0 sm:text-right">
              {z.zusatz}
            </span>
            {z.hinweis && (
              <span className="mt-1 flex basis-full items-start gap-1.5 pl-8 text-[12.5px] leading-snug font-medium text-status-offen">
                <AlertCircle className="mt-px size-3.5 shrink-0" strokeWidth={1.7} aria-hidden="true" />
                <span>{z.hinweis}</span>
              </span>
            )}
          </label>
        ))}
      </div>
      {fehler && <FeldFehler id="paymentMethod-fehler">{fehler}</FeldFehler>}
    </fieldset>
  )
}

/**
 * Die Abholfenster als Kacheln (Mockup: „Heute · 15–18 Uhr"). Echte
 * Radioknöpfe, unsichtbar; der Fokus zeigt sich am Rahmen der Kachel. Volle
 * Fenster bleiben sichtbar, gestrichelt und nicht wählbar — ohne Deckkraft auf
 * dem Text (Kontrast).
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
      {/* Ab 768 px steht die Karte halb breit neben „Deine Daten" — dann zwei Spalten. */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-2">
        {kacheln.map((k) => (
          <label
            key={k.key}
            className={cn(
              'flex min-h-14 flex-col justify-center rounded-xl border px-2.5 py-2.5 text-center has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-solid',
              k.ausgebucht
                ? 'cursor-not-allowed border-dashed border-border text-muted-foreground'
                : 'cursor-pointer border-border has-[:checked]:border-2 has-[:checked]:border-accent has-[:checked]:bg-accent/12'
            )}
          >
            <input type="radio" value={k.key} {...feld} disabled={k.ausgebucht} className="sr-only" />
            {/* Jeder Termin mit Datum (Nr. 46): „Heute"/„Morgen" nur zusätzlich, nie statt des Datums. */}
            {k.relativ && <span className="text-[12px] font-semibold text-status-fertig">{k.relativ}</span>}
            <span className="text-[13.5px] font-semibold break-words">{k.datum}</span>
            <span className="mt-0.5 text-[12px] whitespace-nowrap text-muted-foreground">{k.zeit}</span>
            {/* Voll heißt: Der Hof nimmt für dieses Fenster nichts mehr an (maxOrders). */}
            {k.ausgebucht && <span className="text-[12px] font-semibold">ausgebucht</span>}
          </label>
        ))}
      </div>
      {fehler && <FeldFehler id="pickupSlotKey-fehler">{fehler}</FeldFehler>}
    </fieldset>
  )
}
