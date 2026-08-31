import Image from 'next/image'
import { formatPrice } from '@/lib/preis-format'
import { produktInitiale, type VorschauProdukt } from '@/lib/hofuebersicht'

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
 * Fehlt ein Produktbild, steht dort der Anfangsbuchstabe auf Sandfläche —
 * dasselbe Prinzip wie die Hof-Initialen (src/lib/hof-initialen.ts): eine
 * Entscheidung statt eines gebrochenen Bild-Symbols. Die Ableitung ist
 * produktInitiale in src/lib/hofuebersicht.ts, damit sie ohne Browser
 * prüfbar bleibt.
 *
 * AUSVERKAUFT wird gedämpft, aber NICHT verblasst: Ein `opacity` über die
 * ganze Zeile zöge den ohnehin gedeckten Preis auf rund 2,6:1 Kontrast — er
 * soll IMMER lesbar bleiben. Gedämpft wird deshalb nur der Name (auf die
 * Muted-Farbe), entsättigt nur das Bild.
 */

/** Kantenlänge des quadratischen Vorschaubildes, in Pixeln. */
const BILD_KANTE = 48

export function HoefeProduktzeilen({
  produkte,
  weitere,
}: {
  produkte: VorschauProdukt[]
  /** Zahl der nicht gezeigten Produkte — 0 blendet die Zeile aus. */
  weitere: number
}) {
  if (produkte.length === 0) return null

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
              {formatPrice(produkt.price, produkt.unit, produkt.unitSize)}
            </p>
          </div>

          {produkt.imageUrl ? (
            <Image
              src={produkt.imageUrl}
              alt=""
              width={BILD_KANTE}
              height={BILD_KANTE}
              loading="lazy"
              className={`size-12 shrink-0 rounded-lg object-cover ${
                produkt.verfuegbar ? '' : 'grayscale opacity-70'
              }`}
            />
          ) : (
            <span
              aria-hidden="true"
              className={`flex size-12 shrink-0 items-center justify-center rounded-lg font-heading text-sm font-semibold ${
                produkt.verfuegbar ? '' : 'grayscale opacity-70'
              }`}
              style={{ background: '#F3EFE6', color: '#2D5F3F' }}
            >
              {produktInitiale(produkt.name)}
            </span>
          )}
        </div>
      ))}

      {weitere > 0 && (
        <p className="text-xs text-muted-foreground">
          + {weitere} {weitere === 1 ? 'weiteres Produkt' : 'weitere Produkte'}
        </p>
      )}
    </div>
  )
}
