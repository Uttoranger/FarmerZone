'use client'

import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { useSearchParams } from 'next/navigation'
import { Eye } from 'lucide-react'
import type { HofseiteZeileId } from '@/schemas/hofseite-vorschau'
import { MEIN_HOF_ANSICHT_PARAMETER } from '@/schemas/mein-hof-ansicht'
import { MEIN_HOF_ANSICHT_TEXT, ansichtAdresse, meinHofAnsichtAus } from '@/lib/mein-hof-ansicht'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { useVorschauMarkierung } from '@/components/farmer/use-vorschau-markierung'
import { cn } from '@/lib/utils'

/*
 * Die Kundenansicht von Mein Hof am Handy als Vollbild (Register N4,
 * Ergänzung Nr. 107; Mockup system-h1-kundenansicht-handy). Vorher stand die
 * Hofseite im Rahmen unter der Leiste des Hofs — zwei Leisten übereinander,
 * „welche gilt?". Jetzt deckt ein Blatt von unten den ganzen Schirm ab, auch
 * die Leiste des Hofs (Ebene 70 wie die Bildansicht: über der Unterleiste
 * 50/60 und der Kopfzeile 40); zu sehen bleibt nur die Leiste der Kundschaft
 * in der Seite, blass und ohne Wirkung (kunde-shell.tsx).
 *
 * Offen ist es, wenn die Adresse `?ansicht=kundin` trägt und man unter der
 * Grenze des Reiters ist — die Adresse bleibt die eine Quelle. Öffnen legt
 * GENAU einen Eintrag im Verlauf an (pushState): Die Zurück-Geste schließt
 * das Blatt, statt Mein Hof zu verlassen. „Fertig" und Escape nehmen diesen
 * Eintrag mit history.back zurück; kam man direkt über die Adresse, gibt es
 * keinen eigenen Eintrag — dann ersetzt „Fertig" nur die Adresse, sonst
 * führte es aus Mein Hof hinaus. Fokus, Scroll-Sperre (Mein Hof steht danach
 * an derselben Stelle) und das Abdecken der Seite dahinter kommen von Base UI
 * (Sheet).
 */

export type KundenansichtZustand = {
  offen: boolean
  oeffne: () => void
  schliesse: () => void
}

/**
 * Zustand und Verlauf des Vollbilds. `erlaubt`: ob man unter der Grenze des
 * Reiters ist (useSchmalerAls) — darüber öffnet nichts, auch mit der Adresse.
 */
export function useKundenansicht(erlaubt: boolean): KundenansichtZustand {
  const ansicht = meinHofAnsichtAus(useSearchParams().get(MEIN_HOF_ANSICHT_PARAMETER))
  // Ob der offene Eintrag im Verlauf von uns stammt — nur dann darf „Fertig" zurückgehen.
  const eigenerEintrag = useRef(false)

  // Die Zurück-Geste (oder ein anderer Weg) hat die Adresse ohne Ansicht hergestellt: kein eigener Eintrag mehr offen.
  useEffect(() => {
    if (ansicht !== 'kundin') eigenerEintrag.current = false
  }, [ansicht])

  // Gelesen wird die Adresse, nicht der Wert aus dem Render: Zwei Aufrufe
  // hintereinander legen sonst zwei Einträge an.
  const oeffne = useCallback(() => {
    const { pathname, search, hash } = window.location
    if (meinHofAnsichtAus(new URLSearchParams(search).get(MEIN_HOF_ANSICHT_PARAMETER)) === 'kundin') return
    // null als Zustand: Next gleicht useSearchParams ab (ARCHITECTURE §4, State-Regeln).
    window.history.pushState(null, '', ansichtAdresse(pathname, search, 'kundin') + hash)
    eigenerEintrag.current = true
  }, [])

  const schliesse = useCallback(() => {
    if (eigenerEintrag.current) {
      eigenerEintrag.current = false
      window.history.back()
      return
    }
    const { pathname, search, hash } = window.location
    window.history.replaceState(null, '', ansichtAdresse(pathname, search, 'bearbeiten') + hash)
  }, [])

  return { offen: ansicht === 'kundin' && erlaubt, oeffne, schliesse }
}

/** Kennungen für Titel und Beschreibung des Blatts — der Band trägt beide sichtbar. */
const TITEL_ID = 'kundenansicht-titel'
const BESCHREIBUNG_ID = 'kundenansicht-beschreibung'

/**
 * Das Band oben (Mockup system-h1-kundenansicht-handy): Hofwelt-Orange als
 * Tönung wie die Hinweise des Hofbereichs (primary 12 %, Rand 45 %), Schrift
 * in `status-offen` — in beiden Themes ≥ 4,5:1 auf der Tönung. „Fertig" ist
 * eine Pille in der Textfarbe, 44 px hoch.
 */
export function KundenansichtBand({
  onFertig,
  fertigRef,
}: {
  onFertig: () => void
  fertigRef?: RefObject<HTMLButtonElement | null>
}): React.JSX.Element {
  return (
    <div className="shrink-0 border-b border-primary/45 bg-primary/12 pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 items-center gap-2.5 pr-2 pl-4">
        <Eye className="size-5 shrink-0 text-status-offen" strokeWidth={1.8} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 id={TITEL_ID} className="truncate text-[14px] leading-tight font-bold text-status-offen">
            {MEIN_HOF_ANSICHT_TEXT.kundenansicht}
          </h2>
          <p id={BESCHREIBUNG_ID} className="truncate text-xs text-foreground">
            {MEIN_HOF_ANSICHT_TEXT.kundschaft}
          </p>
        </div>
        <button
          ref={fertigRef}
          type="button"
          onClick={onFertig}
          className={cn(
            'inline-flex h-11 shrink-0 items-center rounded-full bg-foreground px-4 text-[14px] font-bold text-background transition-opacity duration-[250ms] hover:opacity-90',
            FOKUS_RAHMEN
          )}
        >
          {MEIN_HOF_ANSICHT_TEXT.fertig}
        </button>
      </div>
    </div>
  )
}

/** Was im offenen Blatt steht: Band und die echte Hofseite im Rahmen, in voller Höhe. */
function VollbildInhalt({
  adresse,
  markiert,
  onSchliessen,
  fertigRef,
}: {
  adresse: string
  markiert: HofseiteZeileId | null
  onSchliessen: () => void
  fertigRef: RefObject<HTMLButtonElement | null>
}): React.JSX.Element {
  const rahmen = useRef<HTMLIFrameElement>(null)
  // „Gespeichert · Ansehen" mit Abschnitt: die Hofseite im Rahmen umrandet ihn kurz.
  useVorschauMarkierung(rahmen, markiert)

  return (
    <>
      <KundenansichtBand onFertig={onSchliessen} fertigRef={fertigRef} />
      {/* Einbetten ist nur für diese Adresse und nur für uns selbst erlaubt (next.config.ts, frame-ancestors 'self'); Kaufen wirkt in der Vorschau nicht. */}
      <iframe ref={rahmen} src={adresse} title={MEIN_HOF_ANSICHT_TEXT.rahmenTitel} className="block min-h-0 w-full flex-1 border-0 bg-background" />
    </>
  )
}

export function KundenansichtVollbild({
  offen,
  adresse,
  markiert,
  onSchliessen,
}: {
  offen: boolean
  /** Die echte Hofseite in der Vorschau (kundenAnsichtAdresse → vorschauLink). */
  adresse: string
  markiert: HofseiteZeileId | null
  onSchliessen: () => void
}): React.JSX.Element {
  const fertig = useRef<HTMLButtonElement>(null)
  return (
    <Sheet
      open={offen}
      onOpenChange={(auf) => {
        if (!auf) onSchliessen()
      }}
    >
      <SheetContent
        side="bottom"
        showCloseButton={false}
        initialFocus={fertig}
        // Base UI setzt aria-modal nicht selbst; die Seite dahinter macht es inert.
        aria-modal="true"
        aria-labelledby={TITEL_ID}
        aria-describedby={BESCHREIBUNG_ID}
        // Volle Höhe statt Blatt mit Griff; der Home-Indicator bekommt seinen Platz unter der Seite im Rahmen.
        className="z-[70] gap-0 bg-background pb-[env(safe-area-inset-bottom)] text-foreground shadow-none data-[side=bottom]:h-dvh data-[side=bottom]:border-t-0"
      >
        <VollbildInhalt adresse={adresse} markiert={markiert} onSchliessen={onSchliessen} fertigRef={fertig} />
      </SheetContent>
    </Sheet>
  )
}
