'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Popover } from '@base-ui/react/popover'
import { Sprout } from 'lucide-react'
import { ABZEICHEN_TEXT, type AbzeichenBlatt } from '@/lib/gruendungshof'
import { useMindestbreite } from '@/lib/use-mindestbreite'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Sheet, SheetBlatt, SheetDescription, SheetTitle } from '@/components/ui/sheet'

export type AbzeichenGroesse = 'normal' | 'klein'

/**
 * Das Abzeichen „Gründungshof“ (Register K2, Änderung Nr. 116; Mockup
 * system-k2-gruendung-abzeichen, Variante A): ein eckiges Etikett mit 6 px
 * Rundung — bewusst eine eigene Gestalt, weder `Marke` (Zustände, G5) noch
 * `Chip` (rund). Spross (aria-hidden) und das Wort; Großbuchstaben nur per CSS,
 * Vorlesehilfen lesen „Gründungshof“. Größen `normal` (26 px, Hofseite) und
 * `klein` (21 px, Höfe-Liste, Startseite). Farben nur aus den Tokens
 * `--fz-abzeichen`/`--fz-abzeichen-grund` (hell Creme auf Markengrün, dunkel
 * Tannengrün auf Creme, beide ≥ 4,5:1). `aufBild`: ein Schatten, damit es auf
 * dem Titelbild steht. Keine Nummer — die sieht nur der Hof selbst.
 */
export function Abzeichen({
  groesse = 'normal',
  aufBild = false,
  className,
}: {
  groesse?: AbzeichenGroesse
  aufBild?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-[5px] rounded-[6px] bg-abzeichen-grund font-bold whitespace-nowrap text-abzeichen',
        groesse === 'normal' ? 'h-[26px] pr-2.5 pl-[9px] text-[11.5px]' : 'h-[21px] pr-2 pl-[7px] text-[10.5px]',
        aufBild && 'shadow-md',
        className
      )}
    >
      <Sprout className={groesse === 'normal' ? 'size-3.5' : 'size-3'} strokeWidth={2.1} aria-hidden="true" />
      <span className="tracking-[0.7px] uppercase">{ABZEICHEN_TEXT.wort}</span>
    </span>
  )
}

/** Der Inhalt von Blatt und Sprechblase — derselbe Text an beiden Orten. */
function Erklaerung({
  hofName,
  seit,
  blatt,
  Titel,
  Satz,
}: {
  hofName: string
  seit: string
  blatt: AbzeichenBlatt
  Titel: typeof SheetTitle | typeof Popover.Title
  Satz: typeof SheetDescription | typeof Popover.Description
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <Abzeichen className="self-start" />
      <Titel className="font-heading text-[19px] leading-snug font-semibold break-words text-foreground">{ABZEICHEN_TEXT.titel(hofName)}</Titel>
      <Satz className="text-[14px] leading-normal break-words text-muted-foreground">{ABZEICHEN_TEXT.satz(hofName, blatt.plaetze, seit)}</Satz>
      <p className="text-[13px] leading-normal text-muted-foreground">{ABZEICHEN_TEXT.keinSiegel}</p>
      {blatt.frei !== null && (
        <p className="border-t border-border pt-3 text-[13.5px] leading-normal text-foreground">
          <span className="font-semibold">{ABZEICHEN_TEXT.selbstHof}</span> {ABZEICHEN_TEXT.frei(blatt.frei, blatt.plaetze)}{' '}
          <Link
            href={ABZEICHEN_TEXT.mehrHref}
            className={cn('inline-flex min-h-11 items-center font-semibold text-brand-text underline-offset-4 hover:underline', FOKUS_RAHMEN)}
          >
            {ABZEICHEN_TEXT.mehr} ›
          </Link>
        </p>
      )}
    </div>
  )
}

/**
 * Das Abzeichen auf der Hofseite als Knopf (`aria-haspopup="dialog"`):
 * sichtbar 26 px, Trefferfläche 44 px über einen unsichtbaren Rand (::before,
 * wie bei `FilterChip`). Am Handy öffnet er ein Blatt von unten, am Computer
 * eine Sprechblase unter dem Etikett — beides mit der Tastatur bedienbar
 * (Base UI: Fokus hinein, Esc schließt, Fokus zurück zum Knopf).
 */
export function AbzeichenKnopf({ hofName, seit, blatt }: { hofName: string; seit: string; blatt: AbzeichenBlatt }): React.JSX.Element {
  const breit = useMindestbreite(768)
  const [offen, setOffen] = useState(false)
  const knopf = cn("relative inline-flex rounded-[6px] before:absolute before:inset-x-0 before:-inset-y-[9px] before:content-['']", FOKUS_RAHMEN)

  if (breit) {
    return (
      <Popover.Root open={offen} onOpenChange={setOffen}>
        <Popover.Trigger aria-label={ABZEICHEN_TEXT.knopf} className={knopf}>
          <Abzeichen aufBild />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="bottom" align="start" sideOffset={10} className="z-50">
            <Popover.Popup className="w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-popover p-[18px] text-popover-foreground shadow-lg outline-none">
              <Erklaerung hofName={hofName} seit={seit} blatt={blatt} Titel={Popover.Title} Satz={Popover.Description} />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    )
  }
  return (
    <>
      <button type="button" aria-haspopup="dialog" aria-label={ABZEICHEN_TEXT.knopf} onClick={() => setOffen(true)} className={knopf}>
        <Abzeichen aufBild />
      </button>
      <Sheet open={offen} onOpenChange={setOffen}>
        <SheetBlatt>
          <Erklaerung hofName={hofName} seit={seit} blatt={blatt} Titel={SheetTitle} Satz={SheetDescription} />
        </SheetBlatt>
      </Sheet>
    </>
  )
}
