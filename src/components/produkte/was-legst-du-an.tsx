'use client'

import Link from 'next/link'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetBlatt, SheetClose, SheetTitle } from '@/components/ui/sheet'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { NEU_SYMBOL } from '@/components/hofbereich/neu-symbol'
import { HOF_NEU, HOF_NEU_ANDERES_TITEL, HOF_NEU_TITEL, type HofNeuPunkt } from '@/lib/bauern-navigation'
import { useMindestbreite } from '@/lib/use-mindestbreite'
import { cn } from '@/lib/utils'

/*
 * „Was legst du an?" hinter „+ Neues Produkt" (Mockups web-h2-neu-was-legst-
 * du-an, mobil-h2-neu-was-legst-du-an; Nachtlauf Nr. 18). Dieselbe Liste wie
 * das Neu-Menü der Shell (HOF_NEU) — die Wahl ist ein echter Link mit dem
 * Bereich in der Adresse, die Produktansicht öffnet daraufhin den Dialog
 * (useUrlAuftrag). Web: Dialog mit drei Karten, darunter „Oder etwas
 * anderes"; Handy: Blatt von unten mit Zeilen (DESIGN_SYSTEM „Dialoge und Blätter").
 */
export function WasLegstDuAn({ offen, onOffenChange }: { offen: boolean; onOffenChange: (offen: boolean) => void }): React.JSX.Element {
  const breit = useMindestbreite(768)
  const anlegen = HOF_NEU.filter((p) => p.gruppe === 'anlegen')
  const anderes = HOF_NEU.filter((p) => p.gruppe === 'anderes')
  const schliessen = () => onOffenChange(false)

  if (breit) {
    return (
      <Dialog open={offen} onOpenChange={onOffenChange}>
        <DialogContent className="gap-4 p-[26px] sm:max-w-[820px]">
          <DialogTitle className="font-heading text-2xl font-semibold">{HOF_NEU_TITEL}</DialogTitle>
          <ul className="grid grid-cols-3 gap-3.5">
            {anlegen.map((punkt) => (
              <li key={punkt.id}>
                <BereichKarte punkt={punkt} onNavigate={schliessen} />
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3.5">
            <span className="text-[13.5px] text-muted-foreground">{HOF_NEU_ANDERES_TITEL}:</span>
            {anderes.map((punkt) => (
              <Link
                key={punkt.id}
                href={punkt.href}
                onClick={schliessen}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-full border border-border px-[18px] text-sm font-medium text-foreground transition-colors duration-[250ms] hover:bg-muted',
                  FOKUS_RAHMEN
                )}
              >
                {punkt.label}
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={offen} onOpenChange={onOffenChange}>
      <SheetBlatt>
        <SheetTitle className="font-heading text-xl font-semibold">{HOF_NEU_TITEL}</SheetTitle>
        {[anlegen, anderes].map((gruppe, i) => (
          <ul
            key={i}
            aria-label={i === 0 ? HOF_NEU_TITEL : HOF_NEU_ANDERES_TITEL}
            className={cn('flex flex-col gap-1', i > 0 && 'border-t border-border pt-2')}
          >
            {gruppe.map((punkt) => (
              <li key={punkt.id}>
                <BereichZeile punkt={punkt} onNavigate={schliessen} />
              </li>
            ))}
          </ul>
        ))}
        <SheetClose className={cn('mx-auto min-h-11 rounded-full px-5 text-sm font-semibold text-brand-text hover:bg-muted', FOKUS_RAHMEN)}>
          Abbrechen
        </SheetClose>
      </SheetBlatt>
    </Sheet>
  )
}

/** Web: Karte mit Bildfläche, Titel und Satz — die ganze Karte ist der Link. */
function BereichKarte({ punkt, onNavigate }: { punkt: HofNeuPunkt; onNavigate: () => void }): React.JSX.Element {
  const Symbol = NEU_SYMBOL[punkt.id]
  return (
    <Link
      href={punkt.href}
      onClick={onNavigate}
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-[18px] border border-border bg-background transition-colors duration-[250ms] hover:bg-muted',
        FOKUS_RAHMEN
      )}
    >
      <span className="flex h-24 items-center justify-center bg-accent/15 text-status-fertig">
        <Symbol className="size-9" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <span className="flex flex-col gap-1 px-4 py-3.5">
        <span className="text-base font-semibold text-foreground">{punkt.label}</span>
        <span className="text-[12.5px] text-muted-foreground">{punkt.satz}</span>
      </span>
    </Link>
  )
}

/** Handy: Zeile mit Symbol, Titel und Satz. */
function BereichZeile({ punkt, onNavigate }: { punkt: HofNeuPunkt; onNavigate: () => void }): React.JSX.Element {
  const Symbol = NEU_SYMBOL[punkt.id]
  return (
    <Link href={punkt.href} onClick={onNavigate} className={cn('flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted', FOKUS_RAHMEN)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/14 text-status-offen">
        <Symbol className="size-[18px]" strokeWidth={1.7} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[14.5px] font-semibold text-foreground">{punkt.label}</span>
        <span className="block text-[12.5px] text-muted-foreground">{punkt.satz}</span>
      </span>
    </Link>
  )
}
