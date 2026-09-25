'use client'

import { useState } from 'react'
import { Check, Carrot, Wheat } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  FORMULAR_KACHELN,
  KATEGORIE_LABEL,
  UNTERKATEGORIE_LABEL,
  kachelVon,
  unterkategorienVon,
  gehoertZu,
  istAltlastKategorie,
  istAltlastUnterkategorie,
  type FormularKachel,
  type ProductCategoryValue,
  type ProductSubcategoryValue,
} from '@/lib/taxonomie'
import { cn } from '@/lib/utils'

/**
 * Kategorie wählen (Sprint Bereiche 1, Konzept 6.1): zuerst der Bereich als
 * zwei Kacheln, dann die Kategorien des Bereichs, dann die Sorte als Chips.
 * Die Wahl wird erst mit „Übernehmen" ins Formular geschrieben — bis dahin
 * ist sie ein Entwurf, den „Schließen" verwirft.
 *
 * Der Bereich wird hier NICHT entschieden, nur angezeigt: kachelVon leitet
 * ihn aus der Kategorie ab (taxonomie.ts). Die Kachel ist eine Navigation.
 */

type Wahl = { category: ProductCategoryValue | null; subcategory: ProductSubcategoryValue | null }

const KACHEL_ICON: Record<FormularKachel, typeof Carrot> = {
  LEBENSMITTEL: Carrot,
  FUTTERMITTEL: Wheat,
}

/** Abschnittsüberschrift in Kapitälchen-Optik — BEREICH, KATEGORIE, UNTERKATEGORIE. */
function Abschnitt({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titel}</h3>
      {children}
    </section>
  )
}

/** Eine Wahl, die die Altlast nicht weiterträgt: Altwerte starten leer. */
function bereinigt(wahl: Wahl): Wahl {
  const category = istAltlastKategorie(wahl.category) ? null : wahl.category
  const subcategory =
    wahl.subcategory && !istAltlastUnterkategorie(wahl.subcategory) && gehoertZu(category, wahl.subcategory)
      ? wahl.subcategory
      : null
  return { category, subcategory }
}

export function KategorieSheet({
  open,
  onOpenChange,
  wert,
  keineAngabeErlaubt,
  onUebernehmen,
}: {
  open: boolean
  onOpenChange: (offen: boolean) => void
  wert: Wahl
  /**
   * Darf „Keine Angabe" gewählt werden? Nur beim Bearbeiten — Bestandsprodukte
   * ohne Kategorie bleiben speicherbar. Beim Anlegen ist die Kategorie Pflicht.
   */
  keineAngabeErlaubt: boolean
  onUebernehmen: (wahl: Wahl) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92dvh] gap-0 p-0 sm:mx-auto sm:max-w-lg sm:rounded-t-2xl"
      >
        {/* Der Inhalt wird bei jedem Öffnen neu aufgebaut — so startet der
            Entwurf immer beim gespeicherten Wert, ohne Effekt zum Zurücksetzen. */}
        {open && <SheetInhalt wert={wert} keineAngabeErlaubt={keineAngabeErlaubt} onUebernehmen={onUebernehmen} />}
      </SheetContent>
    </Sheet>
  )
}

function SheetInhalt({
  wert,
  keineAngabeErlaubt,
  onUebernehmen,
}: {
  wert: Wahl
  keineAngabeErlaubt: boolean
  onUebernehmen: (wahl: Wahl) => void
}) {
  const start = bereinigt(wert)
  // Die Altlast FUTTERMITTEL öffnet die Futter-Kachel, auch wenn sie leer startet.
  const [kachel, setKachel] = useState<FormularKachel>(kachelVon(wert.category))
  const [entwurf, setEntwurf] = useState<Wahl>(start)

  const kategorien = FORMULAR_KACHELN[kachel].kategorien as readonly ProductCategoryValue[]
  const sorten = entwurf.category ? unterkategorienVon(entwurf.category) : []
  const istFutterKachel = kachel === 'FUTTERMITTEL'

  function kachelWaehlen(neu: FormularKachel) {
    if (neu === kachel) return
    setKachel(neu)
    // Eine Kategorie aus dem anderen Bereich passt nicht mehr — neu wählen.
    setEntwurf({ category: null, subcategory: null })
  }

  function kategorieWaehlen(neu: ProductCategoryValue | null) {
    setEntwurf((w) => (w.category === neu ? w : { category: neu, subcategory: null }))
  }

  // Futtermittel brauchen immer eine Kategorie; bei Lebensmitteln ist „Keine
  // Angabe" nur beim Bearbeiten erlaubt (Bestandsprodukte).
  const keineAngabeWaehlbar = keineAngabeErlaubt && !istFutterKachel
  const kannUebernehmen = keineAngabeWaehlbar || entwurf.category !== null
  const zusammenfassung = [
    entwurf.category ? KATEGORIE_LABEL[entwurf.category] : 'Keine Angabe',
    entwurf.subcategory ? UNTERKATEGORIE_LABEL[entwurf.subcategory] : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <>
      <SheetHeader className="shrink-0 px-5 pt-5 pb-3">
        <SheetTitle className="text-lg">Kategorie wählen</SheetTitle>
      </SheetHeader>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-4">
        <Abschnitt titel="Bereich">
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Bereich">
            {(Object.keys(FORMULAR_KACHELN) as FormularKachel[]).map((k) => {
              const aktiv = kachel === k
              const Icon = KACHEL_ICON[k]
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={aktiv}
                  onClick={() => kachelWaehlen(k)}
                  className={cn(
                    'relative flex min-h-24 flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-colors',
                    aktiv ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-muted/40'
                  )}
                >
                  <Icon className="h-6 w-6 text-brand-text" aria-hidden />
                  <span className="text-sm font-semibold text-foreground">{FORMULAR_KACHELN[k].titel}</span>
                  <span className="text-xs text-muted-foreground">{FORMULAR_KACHELN[k].untertitel}</span>
                  {aktiv && (
                    <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </Abschnitt>

        <Abschnitt titel="Kategorie">
          <ul className="overflow-hidden rounded-xl border border-border" role="listbox" aria-label="Kategorie">
            {kategorien.map((l1) => (
              <KategorieZeile
                key={l1}
                label={KATEGORIE_LABEL[l1]}
                aktiv={entwurf.category === l1}
                onClick={() => kategorieWaehlen(l1)}
              />
            ))}
            {keineAngabeWaehlbar && (
              <KategorieZeile
                label="Keine Angabe"
                aktiv={entwurf.category === null}
                onClick={() => kategorieWaehlen(null)}
                leise
              />
            )}
          </ul>
        </Abschnitt>

        {sorten.length > 0 && (
          <Abschnitt titel="Unterkategorie">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Unterkategorie">
              {sorten.map((l2) => {
                const aktiv = entwurf.subcategory === l2
                return (
                  <button
                    key={l2}
                    type="button"
                    aria-pressed={aktiv}
                    onClick={() => setEntwurf((w) => ({ ...w, subcategory: aktiv ? null : l2 }))}
                    className={cn(
                      'min-h-11 rounded-full border px-4 text-sm font-medium transition-colors',
                      aktiv
                        ? 'border-primary bg-primary/15 text-foreground'
                        : 'border-border bg-card text-foreground hover:bg-muted/40'
                    )}
                  >
                    {UNTERKATEGORIE_LABEL[l2]}
                  </button>
                )
              })}
            </div>
          </Abschnitt>
        )}

        {istFutterKachel && (
          <p className="text-xs text-muted-foreground">
            Ob es ein Einzel-, Allein- oder Ergänzungsfuttermittel ist, gibst du gleich in der Kennzeichnung an.
          </p>
        )}
      </div>

      <SheetFooter className="shrink-0 border-t border-border bg-popover px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Button
          type="button"
          className="min-h-12 w-full"
          disabled={!kannUebernehmen}
          onClick={() => onUebernehmen(entwurf)}
        >
          <span className="truncate">Übernehmen · {zusammenfassung}</span>
        </Button>
      </SheetFooter>
    </>
  )
}

function KategorieZeile({
  label,
  aktiv,
  onClick,
  leise = false,
}: {
  label: string
  aktiv: boolean
  onClick: () => void
  leise?: boolean
}) {
  return (
    <li className="border-b border-border last:border-b-0">
      <button
        type="button"
        role="option"
        aria-selected={aktiv}
        onClick={onClick}
        className={cn(
          'flex h-13 w-full items-center justify-between px-4 text-left text-sm transition-colors',
          aktiv ? 'bg-primary/10 font-medium text-foreground' : 'bg-card hover:bg-muted/40',
          leise && !aktiv && 'text-muted-foreground'
        )}
      >
        {label}
        {aktiv && <Check className="h-4 w-4 text-brand-text" aria-hidden />}
      </button>
    </li>
  )
}
