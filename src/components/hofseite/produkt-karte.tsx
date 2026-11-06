'use client'

import type { ReactNode } from 'react'
import { usePreisAnzeige } from '@/components/shared/preis-anzeige'
import { mitEndpreis } from '@/lib/plattformgebuehr'
import Image from 'next/image'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { PublicProduct } from '@/server/queries/farm'
import { formatGrundpreis } from '@/lib/format'
import { knappText, ruhenderKnopfText, type KartenZustand } from '@/lib/bereiche-anzeige'
import { KAEUFER_VORSCHAU, type KartenVorschau } from '@/lib/hofseite-kunde'
import { zweitePreiszeile } from '@/lib/produktdetail'
import { produktInitiale } from '@/lib/hofuebersicht'
import { bildStil } from '@/lib/bild-ausschnitt'
import type { BildAusschnitt } from '@/schemas/bild-ausschnitt'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { AusverkauftMarke } from '@/components/ui/marke'
import { FOTO_HUELLE, ILLUSTRATION_BILD, ILLUSTRATION_HUELLE } from '@/components/ui/bild-dunkel'

/**
 * Die Liste der Produktkarten (Boards s1-/w1-hofseite): am Handy EINE Karte mit Zeilen
 * und Trennlinien, ab 768 px drei Kacheln nebeneinander. Eine Klasse für das Schaufenster
 * der Übersicht und die Abschnitte im Reiter Produkte.
 */
export const PRODUKT_LISTE =
  'flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card md:grid md:grid-cols-3 md:gap-3 md:divide-y-0 md:overflow-visible md:rounded-none md:border-0 md:bg-transparent'

/** Was der Preis braucht; null = kein gültiger Preis (nur in der Vorschau des Produktdialogs). */
type PreisAngabe = Pick<PublicProduct, 'price' | 'unit' | 'unitSize' | 'futter'> | null

function Preis({ preis: roh, className }: { preis: PreisAngabe; className?: string }) {
  // Im Hofpreis-Modell (N38) der Endpreis je Stück, Grundpreis aus dem Endpreis; ohne Rahmen der Warenpreis.
  const anzeige = usePreisAnzeige()
  const preis = roh ? mitEndpreis(roh, anzeige) : null
  if (!preis) {
    // Ruhiger Platzhalter statt „€ 0,00" oder „NaN" (Nr. 51).
    return <span className={cn('flex min-w-0 flex-col text-[15px] text-muted-foreground', className)}>{KAEUFER_VORSCHAU.preisFehlt}</span>
  }
  const zweite = zweitePreiszeile(preis)
  return (
    <span className={cn('flex min-w-0 flex-col', className)}>
      <span className="text-[15px] text-foreground tabular-nums">{formatGrundpreis(preis.price, preis.unit, preis.unitSize)}</span>
      {zweite && <span className="text-[13px] text-muted-foreground tabular-nums">{zweite}</span>}
    </span>
  )
}

type KaufKarte = {
  variante?: 'kauf'
  produkt: PublicProduct
  zustand: KartenZustand
  /** Menge dieses Produkts im Korb — 0, wenn keins drin liegt. */
  imKorb: number
  wirdHinzugefuegt: boolean
  /** Die Produktseite (produktLink — in der Vorschau des Hofs bleibt sie in der Vorschau). */
  href: string
  onInDenKorb: (p: PublicProduct) => void
}

type MusterKarte = {
  /**
   * Die Vorschau-Variante: „So sehen Käufer dein Produkt" im Produktdialog
   * (Nr. 51) — dieselbe Karte, ohne Link und ohne Korb. Sie heißt „muster",
   * weil „Vorschau" auf der Hofseite schon die Ansicht des Hofs meint
   * (?vorschau=1, ansichtsModus).
   */
  variante: 'muster'
  produkt: KartenVorschau
  /** Der Ausschnitt des Fotos (Register N17, Nr. 98) — ohne Angabe steht das Foto wie heute (Mitte). */
  ausschnitt?: BildAusschnitt | null
}

/**
 * Eine Produktkarte der Hofseite (Boards s1-/w1-hofseite, seit Nr. 235): am Handy eine
 * Zeile in der gemeinsamen Karte (`PRODUKT_LISTE`) mit Bild 56 px, Name, Preis,
 * Grundpreis und rundem „+“ mit grünem Rand; ab 768 px eine Kachel mit Bild oben und
 * „In den Korb“ mit grünem Rand über die volle Breite. Die Menge ändert man im
 * Warenkorb — die Karte hat kein Mengenfeld mehr (Board: auch mit Ware im Korb steht
 * „In den Korb“). Liegt schon alles im Korb, was der Hof hat, ist der Knopf gesperrt,
 * damit er nicht still an der Reservierung scheitert.
 *
 * Bild und Name sind seit Nr. 11 ein echter Link auf die Produktseite
 * (/[hof]/produkt/[id]) — die eine Darstellung der Produktdetails. Die zweite
 * Preiszeile kommt aus derselben Regel wie dort (zweitePreiszeile). Den Zustand
 * (knapp, ausverkauft, pausiert, nicht bestellbar — Kaufsperre, N24) entscheidet
 * kartenZustand, die Karte zeigt ihn nur: knapp als leise Zeile „Nur noch …",
 * ausverkauft als neutrale Marke mit entsättigtem Bild, pausiert ohne Bedienelement
 * (Board Bild 4) — nie über opacity auf Text (Kontrast). Ohne „Merken" (E8, S11).
 *
 * Die Vorschau-Variante (`variante="muster"`, seit Nr. 51) ist dieselbe Karte
 * im Produktdialog: Foto, Name, Preis und Einheit aus dem Formular — ohne
 * Link, ohne Korb und Zustand, die erst das gespeicherte Angebot hat.
 */
export function ProduktKarte(props: KaufKarte | MusterKarte): React.JSX.Element {
  if (props.variante === 'muster') {
    const { produkt } = props
    return (
      <KartenAufbau
        name={produkt.name}
        bild={produkt.imageUrl ?? produkt.categoryImageUrl}
        istFoto={produkt.imageUrl !== null}
        ausschnitt={props.ausschnitt ?? null}
        preis={produkt.price === null ? null : { price: produkt.price, unit: produkt.unit, unitSize: produkt.unitSize, futter: null }}
      />
    )
  }

  const { produkt, zustand, imKorb, wirdHinzugefuegt, href, onInDenKorb } = props
  const kaufbar = zustand.art === 'kaufbar' || zustand.art === 'knapp'
  const ausverkauft = zustand.art === 'ausverkauft'
  // „Nur noch …" ist ein Hinweis an die Kundin, kein Zustand, den jemand erledigen muss: eine leise
  // Zeile statt einer Marke (Freigabe Lauf 13, Nr. 85).
  const hinweis = zustand.art === 'knapp' ? knappText(zustand.bestand, produkt.unit, produkt.unitSize) : null
  // Alles, was der Hof hat, liegt schon im Korb: „+" ginge nur an der Reservierung zugrunde.
  const allesImKorb = imKorb > 0 && imKorb >= produkt.stock

  return (
    <KartenAufbau
      name={produkt.name}
      bild={produkt.imageUrl ?? produkt.categoryImageUrl}
      istFoto={produkt.imageUrl !== null}
      ausschnitt={produkt.bildAusschnitt}
      preis={produkt}
      href={href}
      ausgegraut={ausverkauft}
      hinweis={hinweis}
      aktion={
        kaufbar ? (
          <button
            type="button"
            onClick={() => onInDenKorb(produkt)}
            disabled={wirdHinzugefuegt || allesImKorb}
            aria-label={[`${produkt.name} in den Korb legen`, imKorb > 0 ? `${imKorb} im Warenkorb` : null].filter(Boolean).join(', ')}
            className={cn(
              'inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-accent bg-card text-brand-text transition-colors duration-[250ms] hover:bg-accent/12 disabled:cursor-not-allowed disabled:opacity-60 md:h-11 md:w-full md:rounded-xl md:text-[14px] md:font-bold',
              FOKUS_RAHMEN
            )}
          >
            <Plus className="size-5 md:hidden" strokeWidth={1.7} aria-hidden="true" />
            <span className="hidden md:inline">{wirdHinzugefuegt ? 'Einen Moment …' : 'In den Korb'}</span>
          </button>
        ) : ausverkauft ? (
          <AusverkauftMarke className="shrink-0 md:self-start" />
        ) : zustand.art === 'pausiert' ? null : (
          // Nicht bestellbar oder nicht im Angebot: der Grund leise, wo sonst der Knopf steht.
          <span className="max-w-32 shrink-0 rounded-full bg-muted px-3 py-1.5 text-center text-[12px] text-muted-foreground md:max-w-none md:self-start">
            {ruhenderKnopfText(zustand)}
          </span>
        )
      }
    />
  )
}

/**
 * Der Aufbau der Karte — EINER für beide Varianten, damit die Vorschau im
 * Produktdialog nie von der Hofseite abweicht. Mit `href` sind Bild und Name
 * ein Link (Kaufkarte), ohne stehen sie als reine Anzeige da (Vorschau).
 */
function KartenAufbau({
  name,
  bild,
  istFoto,
  ausschnitt,
  preis,
  href,
  ausgegraut = false,
  hinweis = null,
  aktion = null,
}: {
  name: string
  bild: string | null
  istFoto: boolean
  /** Nur mit echtem Foto: Die Kategorie-Illustration bekommt nie einen Ausschnitt (Register N17). */
  ausschnitt: BildAusschnitt | null
  preis: PreisAngabe
  href?: string
  ausgegraut?: boolean
  /** Leise Zeile unter dem Preis in jeder Breite, etwa „Nur noch 3 Stück". */
  hinweis?: string | null
  aktion?: ReactNode
}): React.JSX.Element {
  const bildUndName = (
    <>
      {/* Im Dunkeln gedämpft (Freigabe Lauf 31, Maßstab Punkt 4): kein heller Fleck auf der dunklen Karte —
          die Illustration über ILLUSTRATION_HUELLE/-BILD, das Foto leicht (FOTO_HUELLE). Gerahmt statt Schatten
          (CODING_STANDARDS §7). */}
      <span
        className={cn(
          'relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted md:h-24 md:w-full md:rounded-[10px]',
          bild && !istFoto ? ILLUSTRATION_HUELLE : FOTO_HUELLE
        )}
      >
        {bild ? (
          <Image
            src={bild}
            // Das Produktfoto heißt wie das Produkt (Nr. 117); die Kategorie-Illustration ist Schmuck.
            alt={istFoto ? name : ''}
            fill
            sizes="(min-width: 1280px) 220px, (min-width: 768px) 30vw, 56px"
            className={cn(
              istFoto ? 'object-cover' : cn('object-contain p-1', ILLUSTRATION_BILD),
              ausgegraut && 'grayscale'
            )}
            // Ausgegraut ohne Filter des Hofs: Ein Inline-Filter überschriebe sonst die Klasse grayscale.
            style={istFoto ? bildStil(ausschnitt, { filter: !ausgegraut }) : undefined}
          />
        ) : (
          <span aria-hidden="true" className="font-heading text-xl font-semibold text-brand-text">
            {produktInitiale(name)}
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="line-clamp-2 text-[15px] font-bold break-words text-foreground">{name}</span>
        <Preis preis={preis} />
        {hinweis && <span className="text-[13px] font-medium text-muted-foreground">{hinweis}</span>}
      </span>
    </>
  )
  const anordnung = 'flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left md:flex-none md:flex-col md:items-stretch md:gap-1.5'

  return (
    <article className="flex items-center gap-3 px-2.5 py-2 md:h-full md:flex-col md:items-stretch md:gap-1.5 md:rounded-2xl md:border md:border-border md:bg-card md:p-2.5">
      {href ? (
        <Link href={href} title={name} className={cn(anordnung, FOKUS_RAHMEN)}>
          {bildUndName}
        </Link>
      ) : (
        <div title={name} className={anordnung}>
          {bildUndName}
        </div>
      )}
      {aktion && <div className="flex shrink-0 md:mt-auto">{aktion}</div>}
    </article>
  )
}
