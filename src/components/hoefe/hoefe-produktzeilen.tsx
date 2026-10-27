import Image from 'next/image'
import { bildStil } from '@/lib/bild-ausschnitt'
import { formatGrundpreis, formatGrundpreisZeile } from '@/lib/format'
import { PREISE_INKL_PLATTFORMGEBUEHR } from '@/lib/konditionen'
import type { VorschauProdukt } from '@/lib/hofuebersicht'
import { illustrationPfad } from '@/lib/taxonomie'
import { cn } from '@/lib/utils'
import { HofBildflaeche } from '@/components/hoefe/hof-bildflaeche'

/** „€ 50,00 für 2 kg · € 25,00 / kg" — in EINER Zeile, die Hofkarte hat keinen Platz für zwei. */
function preisZeile(p: VorschauProdukt): string {
  const gebinde = formatGrundpreis(p.price, p.unit, p.unitSize)
  const grundpreis = formatGrundpreisZeile(p.price, p.unit, p.unitSize)
  return grundpreis ? `${gebinde} · ${grundpreis}` : gebinde
}

/**
 * Die Produktvorschau einer Hofkarte: je Produkt eine kompakte Zeile mit
 * Name, Preis und kleinem quadratischem Vorschaubild — das Muster der
 * Restaurantkarten von Lieferdiensten. Bewusst KEINE Bildkachel-Reihe: Die
 * lebt vom Foto und wirkt lückenhaft, sobald eines fehlt.
 *
 * KEINE eigenen Links, KEINE Schaltflächen: Die Zeilen erben das Verhalten
 * der Hofkarte, auf der sie liegen — im Splitscreen wählt ein Klick den Hof
 * aus, in der schmalen Liste führt er zur Hofseite. Ein Produkt anzutippen
 * darf die Auswahl-Grammatik aus #82 nicht durchbrechen; deshalb liegt hier
 * nichts, was Klicks abfängt (auch das Bild nicht — `pointer-events-none`
 * für den ganzen Block wäre falsch, denn dann käme der Klick zwar durch,
 * aber der gestreckte Link/Knopf der Karte fängt ihn ohnehin ab).
 *
 * Fehlt ein Produktbild, steht seit Nr. 120 die Illustration der Kategorie da
 * (illustrationPfad mit Kategorie UND Unterkategorie, dieselbe Quelle wie
 * Produktseite und Teilen-Bild, Register N22; Unterkategorie seit Nr. 127) — vorher der Anfangsbuchstabe auf Sandfläche.
 *
 * AUSVERKAUFT wird gedämpft, aber NICHT verblasst: Ein `opacity` über die
 * ganze Zeile zöge den ohnehin gedeckten Preis auf rund 2,6:1 Kontrast — er
 * soll IMMER lesbar bleiben. Gedämpft wird deshalb nur der Name (auf die
 * Muted-Farbe), entsättigt nur das Bild.
 */

/** Kantenlänge des quadratischen Vorschaubildes: 48 in Liste und Karussell, 40 in der Pin-Vorschau (Board). */
export type ProduktBildKante = 48 | 40

const BILD_KLASSE: Record<ProduktBildKante, string> = { 48: 'size-12', 40: 'size-10' }

export function HoefeProduktzeilen({
  produkte,
  weitere,
  bildKante = 48,
}: {
  produkte: VorschauProdukt[]
  /** Zahl der nicht gezeigten Produkte — 0 blendet die Zeile aus. */
  weitere: number
  bildKante?: ProduktBildKante
}) {
  if (produkte.length === 0) return null
  const bild = BILD_KLASSE[bildKante]

  return (
    <div className="mt-2 space-y-1.5">
      {produkte.map((produkt) => (
        <div key={produkt.id} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            {/* „derzeit aus" steht NEBEN dem gekürzten Namen, nicht in ihm:
                Innerhalb des truncate-Absatzes elidierte ein langer
                Produktname genau die Kennzeichnung weg, auf die es ankommt. */}
            <div className="flex items-baseline gap-1.5">
              <p
                className={`min-w-0 truncate text-sm ${
                  produkt.verfuegbar ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {produkt.name}
              </p>
              {!produkt.verfuegbar && (
                <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                  derzeit aus
                </span>
              )}
            </div>
            {/* Der Preis bleibt IMMER sichtbar — er darf nie der Kürzung
                des Namens zum Opfer fallen, deshalb eine eigene Zeile. */}
            <p className="text-xs text-muted-foreground">
              {preisZeile(produkt)}
            </p>
          </div>

          {produkt.imageUrl ? (
            // Der Kasten schneidet ab: Mit Zoom ragte das Foto sonst über die Kante (Register N17, Nr. 98).
            <span className={cn('block shrink-0 overflow-hidden rounded-lg', bild)}>
              <Image
                src={produkt.imageUrl}
                alt=""
                width={bildKante}
                height={bildKante}
                loading="lazy"
                className={`size-full object-cover ${
                  produkt.verfuegbar ? '' : 'grayscale opacity-70'
                }`}
                // „derzeit aus" ohne Filter des Hofs: Ein Inline-Filter überschriebe sonst grayscale.
                style={bildStil(produkt.bildAusschnitt, { filter: produkt.verfuegbar })}
              />
            </span>
          ) : (
            <HofBildflaeche
              bilder={[illustrationPfad(produkt.category, produkt.subcategory)]}
              sizes={`${bildKante}px`}
              gedaempft={!produkt.verfuegbar}
              fuellen
              className={cn('shrink-0 rounded-lg', bild)}
            />
          )}
        </div>
      ))}

      {weitere > 0 && (
        <p className="text-xs text-muted-foreground">
          + {weitere} {weitere === 1 ? 'weiteres Produkt' : 'weitere Produkte'}
        </p>
      )}
      {/* N38: Endpreise — einmal unter den Zeilen gesagt, nicht an jedem Preis. */}
      {produkte.some((p) => p.inklPlattformgebuehr) && <p className="text-xs text-muted-foreground">{PREISE_INKL_PLATTFORMGEBUEHR}</p>}
    </div>
  )
}
