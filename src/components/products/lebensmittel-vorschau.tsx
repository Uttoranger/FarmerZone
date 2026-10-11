'use client'

import { KAEUFER_VORSCHAU } from '@/lib/hofseite-kunde'
import type { ProductCategoryValue } from '@/lib/taxonomie'
import { ProduktKarte } from '@/components/hofseite/produkt-karte'
import { kaeuferVorschau } from './produkt-preis'

/**
 * „So sehen Käufer dein Produkt" im Produktdialog für Lebensmittel (Nr. 51,
 * freigabe.md §13): die ECHTE Produktkarte der Hofseite in ihrer
 * Vorschau-Variante — ohne Link, ohne Korb —, live aus den Formularwerten.
 * Am Handy steht sie als Zeile, ab 768 px als Kachel, so wie Käufer sie auf
 * demselben Gerät sehen.
 *
 * Gestalt wie die Vorschau im Futter-Formular (Fläche bg-muted/40, leise
 * Überschrift in Großbuchstaben, Mockup web-h2-neues-futter); Futter (mit dem
 * Schild nach E9) und Brennmaterial behalten ihre eigene Vorschau.
 */
export function LebensmittelVorschau({
  name,
  price,
  unit,
  unitSize,
  foto,
  kategorie,
}: {
  name: string
  /** Der Wert des Preisfelds — NaN, solange es leer oder unlesbar ist. */
  price: number
  unit: string
  unitSize: number | null | undefined
  /** Das gewählte Foto (Vorschau-Adresse) oder das gespeicherte; null ohne Foto. */
  foto: string | null
  kategorie: ProductCategoryValue | null
}): React.JSX.Element {
  const karte = kaeuferVorschau({ name, price, unit, unitSize }, { foto, kategorie })
  return (
    <section aria-labelledby="lebensmittel-vorschau" className="mt-4 flex flex-col gap-2.5 rounded-2xl border border-border bg-muted/40 p-4">
      <h3 id="lebensmittel-vorschau" className="text-[11px] font-semibold tracking-[1px] text-muted-foreground uppercase">
        {KAEUFER_VORSCHAU.titel}
      </h3>
      {/* Ab 768 px eine Kachel in der Breite wie auf der Hofseite, nicht über den ganzen Dialog. */}
      <div className="md:max-w-[260px]">
        <ProduktKarte variante="muster" produkt={karte} />
      </div>
    </section>
  )
}
