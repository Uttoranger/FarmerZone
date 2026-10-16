'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { PublicProduct } from '@/server/queries/farm'
import { formatGrundpreis } from '@/lib/format'
import { knappText, type KartenZustand } from '@/lib/bereiche-anzeige'
import { KAEUFER_VORSCHAU, stepperObergrenze, type KartenVorschau } from '@/lib/hofseite-kunde'
import { zweitePreiszeile } from '@/lib/produktdetail'
import { produktInitiale } from '@/lib/hofuebersicht'
import { SHOP_PAUSED_BUTTON_LABEL } from '@/lib/shop-pause'
import { bildStil } from '@/lib/bild-ausschnitt'
import type { BildAusschnitt } from '@/schemas/bild-ausschnitt'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { StatusBadge } from '@/components/ui/status-badge'
import { Stepper } from '@/components/ui/stepper'

/** Die erste Zeile der Beschreibung als Unterzeile der Karte — der Rest steht im Produktdetail. */
function kurzbeschreibung(p: PublicProduct): string | null {
  const zeile = p.description?.trim().split('\n')[0]?.trim()
  return zeile ? zeile : null
}

/** Was der Preis braucht; null = kein gültiger Preis (nur in der Vorschau des Produktdialogs). */
type PreisAngabe = Pick<PublicProduct, 'price' | 'unit' | 'unitSize' | 'futter'> | null

function Preis({ preis, className }: { preis: PreisAngabe; className?: string }) {
  if (!preis) {
    // Ruhiger Platzhalter statt „€ 0,00" oder „NaN" (Nr. 51).
    return <span className={cn('flex min-w-0 flex-col text-[15px] text-muted-foreground md:text-base', className)}>{KAEUFER_VORSCHAU.preisFehlt}</span>
  }
  const zweite = zweitePreiszeile(preis)
  return (
    <span className={cn('flex min-w-0 flex-col', className)}>
      <span className="text-[15px] font-semibold text-foreground md:text-base">
        {formatGrundpreis(preis.price, preis.unit, preis.unitSize)}
      </span>
      {zweite && <span className="text-xs text-muted-foreground">{zweite}</span>}
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
  onMenge: (p: PublicProduct, menge: number) => void
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
 * Eine Produktkarte der Hofseite (Mockups web-k2-alle-produkte-nach-kategorie
 * und mobil-k2-produkte): am Handy eine Zeile mit Bild, Name, Preis und
 * Plus-Knopf, ab 768 px eine Kachel mit Bild oben und „In den Korb" rechts
 * neben dem Preis. Liegt das Produkt schon im Korb, steht dort die Menge mit
 * − und +; „+" endet am Bestand (stepperObergrenze), damit es nicht still an
 * der Reservierung scheitert.
 *
 * Bild und Name sind seit Nr. 11 ein echter Link auf die Produktseite
 * (/[hof]/produkt/[id]) — die eine Darstellung der Produktdetails; das Blatt
 * von vorher gibt es nicht mehr. Die zweite Preiszeile kommt aus derselben
 * Regel wie dort (zweitePreiszeile). Den Zustand (knapp, ausverkauft,
 * pausiert) entscheidet kartenZustand, die Karte zeigt ihn nur: knapp als
 * orangene Marke „Nur noch …", ausverkauft ausgegraut — nie über opacity auf
 * Text (Kontrast). Ohne „Merken" (E8, S11).
 *
 * Die Vorschau-Variante (`variante="muster"`, seit Nr. 51) ist dieselbe Karte
 * im Produktdialog: Foto, Name, Preis und Einheit aus dem Formular — ohne
 * Link, ohne Korb, ohne Beschreibung und Zustand, die erst das gespeicherte
 * Angebot hat.
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

  const { produkt, zustand, imKorb, wirdHinzugefuegt, href, onInDenKorb, onMenge } = props
  const kaufbar = zustand.art === 'kaufbar' || zustand.art === 'knapp'
  const ausverkauft = zustand.art === 'ausverkauft'
  const marke = ausverkauft ? <StatusBadge status="neutral">Ausverkauft</StatusBadge> : null
  // „Nur noch …" ist ein Hinweis an die Kundin, kein Zustand, den jemand erledigen muss: eine leise
  // Zeile statt einer Marke — „tun" (Orange) passte nicht, eine fünfte Art kennt DESIGN_SYSTEM nicht
  // (Freigabe Lauf 13, Nr. 85).
  const hinweis = zustand.art === 'knapp' ? knappText(zustand.bestand, produkt.unit, produkt.unitSize) : null

  return (
    <KartenAufbau
      name={produkt.name}
      bild={produkt.imageUrl ?? produkt.categoryImageUrl}
      istFoto={produkt.imageUrl !== null}
      ausschnitt={produkt.bildAusschnitt}
      preis={produkt}
      href={href}
      kurz={kurzbeschreibung(produkt)}
      ausgegraut={ausverkauft}
      markeAufBild={marke}
      hinweis={hinweis}
      aktion={
        kaufbar && imKorb > 0 ? (
          <Stepper
            beschriftung={`Menge ${produkt.name}`}
            wert={imKorb}
            max={stepperObergrenze(produkt.stock, imKorb)}
            onWertChange={(menge) => onMenge(produkt, menge)}
          />
        ) : kaufbar ? (
          <button
            type="button"
            onClick={() => onInDenKorb(produkt)}
            disabled={wirdHinzugefuegt}
            aria-label={`${produkt.name} in den Korb legen`}
            className={cn(
              "relative inline-flex size-11 items-center justify-center gap-1.5 rounded-full bg-accent text-accent-foreground transition-opacity duration-[250ms] before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] hover:opacity-90 disabled:opacity-60 md:h-9 md:w-auto md:px-3.5 md:text-[12.5px] md:font-semibold",
              FOKUS_RAHMEN
            )}
          >
            <Plus className="size-5 md:size-4" strokeWidth={1.7} aria-hidden="true" />
            <span className="hidden md:inline">{wirdHinzugefuegt ? 'Einen Moment …' : 'In den Korb'}</span>
          </button>
        ) : (
          <span className="max-w-32 rounded-full bg-muted px-3 py-1.5 text-center text-xs text-muted-foreground md:max-w-none">
            {zustand.art === 'pausiert'
              ? SHOP_PAUSED_BUTTON_LABEL
              : zustand.art === 'nicht-verfuegbar'
                ? zustand.grund
                : 'Ausverkauft'}
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
  kurz = null,
  ausgegraut = false,
  markeAufBild = null,
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
  kurz?: string | null
  ausgegraut?: boolean
  markeAufBild?: ReactNode
  /** Leise Zeile unter Name und Kurztext in jeder Breite, etwa „Nur noch 3 Stück"; „Ausverkauft" steht am Handy schon rechts. */
  hinweis?: string | null
  aktion?: ReactNode
}): React.JSX.Element {
  const bildUndName = (
    <>
      <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted md:h-[140px] md:w-full md:rounded-none">
        {bild ? (
          <Image
            src={bild}
            alt=""
            fill
            sizes="(min-width: 1280px) 260px, (min-width: 768px) 33vw, 64px"
            className={cn(
              istFoto ? 'object-cover' : 'object-contain p-1 dark:brightness-[0.85] dark:saturate-[0.9]',
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
        {markeAufBild && <span className="absolute top-2.5 left-2.5 hidden md:block">{markeAufBild}</span>}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 md:px-3.5 md:pt-3">
        <span className="line-clamp-2 text-[15px] font-semibold break-words text-foreground">{name}</span>
        {kurz && <span className="truncate text-[13px] text-muted-foreground">{kurz}</span>}
        <Preis preis={preis} className="md:hidden" />
        {hinweis && <span className="text-[12.5px] font-medium text-muted-foreground">{hinweis}</span>}
      </span>
    </>
  )
  const anordnung =
    'flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left md:flex-none md:flex-col md:items-stretch md:gap-0 md:rounded-none'

  return (
    <article className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 md:h-full md:flex-col md:items-stretch md:gap-0 md:overflow-hidden md:p-0">
      {href ? (
        <Link href={href} title={name} className={cn(anordnung, FOKUS_RAHMEN, 'md:focus-visible:-outline-offset-2')}>
          {bildUndName}
        </Link>
      ) : (
        <div title={name} className={anordnung}>
          {bildUndName}
        </div>
      )}

      <div className="flex shrink-0 items-center gap-2 md:mt-auto md:px-3.5 md:pt-2 md:pb-3.5">
        <Preis preis={preis} className="hidden flex-1 md:flex" />
        {aktion}
      </div>
    </article>
  )
}
