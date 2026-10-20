/**
 * Die Pin-Vorschau am Computer (Register N22): eine kurze Hofkarte am Pin der
 * Karte auf /hoefe, als `role="tooltip"`. Region bindet sie in Lauf 19 ein.
 */
import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { formatiereEntfernung, type AbholFenster, type VorschauProdukt } from '@/lib/hofuebersicht'
import { hofseitenLink, istBestellbar } from '@/lib/bereiche-anzeige'
import { hofIllustrationen } from '@/lib/hoefe-anzeige'
import type { AnzeigeBereich, ProductCategoryValue } from '@/lib/taxonomie'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Abholzeile } from '@/components/hoefe/abholzeile'
import { HofBildflaeche } from '@/components/hoefe/hof-bildflaeche'
import { HoefeProduktzeilen } from '@/components/hoefe/hoefe-produktzeilen'

/** Was die Pin-Vorschau vom Hof braucht — ein Ausschnitt aus HofUebersichtEintrag samt Entfernung. */
export type KurzkartenHof = {
  slug: string
  name: string
  postalCode: string
  city: string
  isPaused: boolean
  kategorien: ProductCategoryValue[]
  abholfenster?: readonly AbholFenster[]
  angebot: readonly unknown[]
  fotos: string[]
  entfernungKm: number | null
}

/** Breite der Vorschau in Pixeln — die Karte rechnet damit ihre Lage am Pin. */
export const KURZKARTE_BREITE = 288

/**
 * Die Pin-Vorschau am Computer (Register N22, Board system-k1-entdecken-v2
 * „Pins und Vorschau"): Bildfläche oder erstes Foto, Name, Entfernung, Ort,
 * die Abholzeile, zwei Produktzeilen mit 40er-Bildern und „Zum Hof ›". Sie
 * erscheint beim Darüberfahren und bei Tab-Fokus am Pin (hoefe-karte.tsx
 * steuert Öffnen und Schließen) und ist ein `role="tooltip"`: Der Pin
 * verweist mit aria-describedby auf sie. „Zum Hof" ist für den Zeiger da und
 * nicht im Tab-Weg — mit der Tastatur wählt Enter am Pin den Hof, und seine
 * Hofkarte in der Liste trägt denselben Weg. Region bindet sie in Lauf 19 ein.
 */
export function HofKurzkarte({
  hof,
  bereich,
  schaufenster,
  jetzt,
  id,
}: {
  hof: KurzkartenHof
  bereich: AnzeigeBereich
  /** Die Schaufenster-Auswahl (waehleVorschauImBereich, zwei Zeilen). */
  schaufenster: { produkte: VorschauProdukt[] }
  /** Der Zeitpunkt des Servers beim Bauen der Seite (ISO-Text) — für die Abholzeile. */
  jetzt: string
  id: string
}): React.JSX.Element {
  const foto = hof.fotos[0] ?? null
  return (
    <div
      id={id}
      role="tooltip"
      style={{ width: KURZKARTE_BREITE }}
      className="overflow-hidden rounded-2xl border border-border bg-card text-left shadow-lg"
    >
      {foto ? (
        <span className={cn('relative block h-[104px] w-full', hof.isPaused && 'opacity-60 grayscale')}>
          <Image src={foto} alt="" fill sizes={`${KURZKARTE_BREITE}px`} className="object-cover" />
        </span>
      ) : (
        <HofBildflaeche bilder={hofIllustrationen(hof.kategorien)} sizes="104px" gedaempft={hof.isPaused} className="h-[104px] w-full" />
      )}
      <div className="flex flex-col gap-1 p-3.5">
        <div className="flex items-start gap-2">
          <p className="line-clamp-2 min-w-0 flex-1 font-heading text-[17px] leading-snug font-semibold break-words text-foreground">
            {hof.name}
          </p>
          {hof.entfernungKm !== null && (
            <span className="shrink-0 pt-0.5 text-[13px] text-muted-foreground">{formatiereEntfernung(hof.entfernungKm)}</span>
          )}
        </div>
        <p className="truncate text-[13px] text-muted-foreground">
          {hof.postalCode} {hof.city}
        </p>
        <Abholzeile fenster={hof.abholfenster} isPaused={hof.isPaused} bestellbar={istBestellbar(hof)} jetzt={jetzt} />
        <HoefeProduktzeilen produkte={schaufenster.produkte} weitere={0} bildKante={40} />
        <Link
          href={hofseitenLink(hof.slug, bereich)}
          tabIndex={-1}
          className={cn(
            'mt-1 inline-flex min-h-11 items-center gap-0.5 self-start rounded-lg text-[13.5px] font-semibold text-status-fertig hover:underline',
            FOKUS_RAHMEN
          )}
        >
          Zum Hof
          <ChevronRight className="size-4" strokeWidth={1.7} aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}
