'use client'

import Image from 'next/image'
import type { PublicFarmPhoto } from '@/server/queries/farm'
import { bildStil } from '@/lib/bild-ausschnitt'
import {
  HOFSEITE_FOTOS_TEXT,
  MOSAIK_KACHELN,
  alleFotosLabel,
  deckelText,
  fotoForm,
  fotoListeLabel,
  fotoOeffnenLabel,
  fotosHinweis,
  type FotoFormArt,
} from '@/lib/hofseite-fotos'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { BildansichtEbene, fotoAlt, useBildansicht } from '@/components/hofseite/bildansicht'

/** So viele Kacheln zeigt das Raster ab lg; auf der letzten steht „+N", die Bildansicht blättert durch alle. */
const SICHTBAR_AB_LG = 6

/*
 * Das Mosaik unter lg (Register N5, Änderung Nr. 107; Mockups
 * mobil-k2-hofseite-fotos-mosaik, system-k2-hofseite-fotos-varianten): die
 * Form kommt aus EINER Regel (fotoForm). Kein seitliches Scrollen, kein
 * overflow-x — der Streifen zeigte am Computer in schmaler Ansicht einen
 * Rollbalken. Das Mosaik ist 358 × 212 px am 390er-Schirm (links 62 % der
 * Breite) und wächst mit der Breite bis 260 px Höhe; die Höhe folgt aus dem
 * Seitenverhältnis, nichts wird im Browser gemessen. `sizes` je Kachel nach
 * ihrem Anteil an der Breite.
 */
const MOSAIK: Record<Exclude<FotoFormArt, 'leer'>, { liste: string; eintrag: (i: number) => string; sizes: (i: number) => string }> = {
  eins: { liste: 'grid', eintrag: () => 'aspect-[16/10]', sizes: () => '100vw' },
  zwei: { liste: 'grid grid-cols-2 gap-1.5', eintrag: () => 'aspect-square', sizes: () => '50vw' },
  mosaik: {
    liste: 'grid aspect-[358/212] max-h-[260px] w-full grid-cols-[62%_minmax(0,1fr)] grid-rows-2 gap-1.5',
    eintrag: (i) => (i === 0 ? 'row-span-2 min-h-0' : 'min-h-0'),
    sizes: (i) => (i === 0 ? '62vw' : '38vw'),
  },
}

/** Ab lg das Raster wie bisher: drei Spalten, 140 px hoch. */
const RASTER_AB_LG = 'hidden lg:grid lg:grid-cols-3 lg:gap-3.5'

/**
 * Der Schleier unter „+n": theme-fest dunkel, helle Schrift (DESIGN_SYSTEM,
 * „Bild-Overlays"). 65 % statt der 55 % aus dem Mockup — erst damit steht die
 * kleine Schrift auch auf einem fast weißen Foto bei mindestens 4,5:1.
 */
const DECKEL_SCHLEIER = 'bg-primary-foreground/65 text-accent-foreground'

const KACHEL = cn('relative block size-full touch-manipulation overflow-hidden rounded-[14px] bg-muted', FOKUS_RAHMEN)

/**
 * „Fotos" in der Übersicht der Hofseite (Mockups web-k2-hofseite,
 * mobil-k2-hofseite-fotos-mosaik): Kacheln, jede ein Knopf, der die
 * Bildansicht öffnet — kein Bild liegt in einem Link (sonst sprang ein Tipp
 * auf ein Bild auf eine andere Seite, Meldung cmua8bof). touch-action:
 * manipulation nimmt dem Browser das Warten auf einen Doppeltipp.
 *
 * Zwei Listen derselben Fotos: unter lg das Mosaik, ab lg das Raster. Die
 * jeweils andere ist `display: none` und damit weder zu sehen noch für
 * Screenreader da; ihre Bilder lädt der Browser nicht (lazy). Zwei Listen,
 * weil die dritte Kachel unter lg der Deckel „Alle 8 Fotos ansehen" ist, ab
 * lg aber ein Foto — ein Name je Knopf, keine Breiten-Abfrage im Browser.
 * EINE Bildansicht für beide; der Fokus kehrt an die Kachel zurück, aus der
 * sie geöffnet wurde.
 *
 * `schaufenster`: Unter lg steht die Überschrift dann nur für Screenreader
 * (Register N5, Nr. 51) — die Fotos stehen ganz oben im Schaufenster.
 */
export function HofseiteFotos({
  fotos,
  hofName,
  schaufenster = false,
  className,
}: {
  fotos: readonly PublicFarmPhoto[]
  hofName: string
  schaufenster?: boolean
  className?: string
}): React.JSX.Element | null {
  const bild = useBildansicht(fotos.length)
  const { form, weitere } = fotoForm(fotos.length)
  if (form === 'leer') return null
  const mosaik = MOSAIK[form]
  const listenName = fotoListeLabel(hofName, fotos.length)
  const hinweis = fotosHinweis(fotos.length)
  const rasterRest = fotos.length - SICHTBAR_AB_LG

  return (
    <section id="fotos" data-abschnitt="fotos" aria-labelledby="fotos-titel" className={cn('flex flex-col gap-3', className)}>
      <h2 id="fotos-titel" className={cn('font-heading text-xl font-semibold text-foreground', schaufenster && 'max-lg:sr-only')}>
        {HOFSEITE_FOTOS_TEXT.ueberschrift}
      </h2>

      {/* Unter lg: das Mosaik. Die Kachel mit Deckel öffnet bei ihrem eigenen Foto (Foto 3). */}
      <div className="flex flex-col gap-2 lg:hidden">
        <ul aria-label={listenName} className={mosaik.liste}>
          {fotos.slice(0, MOSAIK_KACHELN).map((foto, i) => {
            const deckel = i === MOSAIK_KACHELN - 1 && weitere > 0 ? deckelText(weitere, fotos.length) : null
            return (
              <li key={foto.id} className={mosaik.eintrag(i)}>
                <button
                  type="button"
                  onClick={(e) => bild.oeffne(i, e.currentTarget)}
                  aria-label={deckel ? alleFotosLabel(fotos.length) : fotoOeffnenLabel(i, fotos.length)}
                  className={KACHEL}
                >
                  {/* Die Kachel mit Ausschnitt und Filter des Hofs (Register N17, Nr. 98); die Bildansicht zeigt das ganze Foto. */}
                  <Image src={foto.url} alt={fotoAlt(foto, hofName)} fill sizes={mosaik.sizes(i)} className="object-cover" style={bildStil(foto.ausschnitt)} />
                  {deckel && (
                    <span aria-hidden="true" className={cn('absolute inset-0 flex flex-col items-center justify-center gap-0.5', DECKEL_SCHLEIER)}>
                      <span className="font-heading text-[22px] leading-none font-semibold">{deckel.plus}</span>
                      <span className="text-xs font-semibold">{deckel.alle}</span>
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
        {hinweis && <p className="text-xs text-muted-foreground">{hinweis}</p>}
      </div>

      {/* Ab lg: das Raster wie bisher, bis zu sechs Kacheln, auf der letzten „+N". */}
      <ul aria-label={listenName} className={RASTER_AB_LG}>
        {fotos.slice(0, SICHTBAR_AB_LG).map((foto, i) => {
          const letzte = i === SICHTBAR_AB_LG - 1 && rasterRest > 0
          return (
            <li key={foto.id}>
              <button
                type="button"
                onClick={(e) => bild.oeffne(i, e.currentTarget)}
                aria-label={letzte ? alleFotosLabel(fotos.length) : fotoOeffnenLabel(i, fotos.length)}
                className={cn(KACHEL, 'h-[140px]')}
              >
                <Image src={foto.url} alt={fotoAlt(foto, hofName)} fill sizes="260px" className="object-cover" style={bildStil(foto.ausschnitt)} />
                {letzte && (
                  <span aria-hidden="true" className={cn('absolute inset-0 flex items-center justify-center text-[15px] font-semibold', DECKEL_SCHLEIER)}>
                    +{rasterRest}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      <BildansichtEbene fotos={fotos} bild={bild} titel={HOFSEITE_FOTOS_TEXT.bildansicht} hofName={hofName} />
    </section>
  )
}
