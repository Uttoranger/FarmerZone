'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'
import type { MeinHofReiterAlleId } from '@/lib/bauern-navigation'
import {
  MEIN_HOF_ANSICHT_OPTIONEN,
  MEIN_HOF_ANSICHT_TEXT,
  UMSCHALTER_AB_PX,
  ansichtAdresse,
  kundenAnsichtAdresse,
  meinHofAnsichtAus,
  umschalterBis,
  type MeinHofAnsichtId,
} from '@/lib/mein-hof-ansicht'
import { MEIN_HOF_ANSICHT_PARAMETER } from '@/schemas/mein-hof-ansicht'
import type { HofseiteZeileId } from '@/schemas/hofseite-vorschau'
import { Segment } from '@/components/ui/segment'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { useVorschauMarkierung } from '@/components/farmer/use-vorschau-markierung'
import { meldeGespeichertAnsehen } from '@/components/mein-hof/gespeichert-ansehen'
import { cn } from '@/lib/utils'

/*
 * Der Umschalter von „Mein Hof" unter lg (Nachtlauf Nr. 49, Register N4):
 * „Bearbeiten · So sieht’s die Kundin" ganz oben unter dem Kopf, klebt beim
 * Scrollen. Ein Baustein für alle drei Reiter — Produkte (nur unter md, N3),
 * Hofseite und Beiträge; der Inhalt „Bearbeiten" hängt als Kind darunter
 * (Nr. 50 hängt dort die Liste der Abschnitte ein).
 *
 * „So sieht’s die Kundin" ist das bestehende iframe der echten Hofseite
 * (kundenAnsichtAdresse → vorschauLink, volle Breite, Maßstab 1, keine zweite
 * Darstellung), auf dem passenden Reiter der Hofseite. Die Wahl steht in der
 * Adresse (?ansicht=kundin, geschrieben per replaceState wie die Filter) —
 * so führt „Ansehen" nach dem Veröffentlichen eines Beitrags von /status/new
 * direkt hierher. Ab der Grenze des Reiters (md bzw. lg) gibt es weder
 * Umschalter noch Rahmen; der Inhalt steht dort immer.
 *
 * Kopf und Inhalt hängen im Kontext: Der Knopf „Kundenansicht" im Kopf
 * (kundenansicht-knopf.tsx) und „Gespeichert · Ansehen" nach dem Speichern
 * schalten über useMeinHofAnsicht um.
 */

export type MeinHofAnsichtSteuerung = {
  /** Schaltet auf „So sieht’s die Kundin" und springt hin; mit Abschnitt umrandet die Hofseite ihn kurz. */
  zeigeKundin: (abschnitt?: HofseiteZeileId | null) => void
  /** „Gespeichert · Ansehen" nach einem Speichern; „Ansehen" springt zum Abschnitt. */
  gespeichert: (abschnitt?: HofseiteZeileId | null) => void
}

const Steuerung = createContext<MeinHofAnsichtSteuerung | null>(null)

/** Die Steuerung des Umschalters — null außerhalb von MeinHofAnsicht. */
export function useMeinHofAnsicht(): MeinHofAnsichtSteuerung | null {
  return useContext(Steuerung)
}

/** Die Klassen je Grenze — als ganze Wörter, damit Tailwind sie findet. */
const GRENZE = {
  md: { nurDarunter: 'md:hidden', abDort: 'hidden md:block' },
  lg: { nurDarunter: 'lg:hidden', abDort: 'hidden lg:block' },
} as const

export function MeinHofAnsicht({
  reiter,
  slug,
  kopf,
  children,
}: {
  reiter: MeinHofReiterAlleId
  slug: string
  /** Was über dem Umschalter steht: der Kopf von Mein Hof mit den Reitern, auf /products nur die Reiter. */
  kopf: ReactNode
  /** „Bearbeiten" — der Inhalt des Reiters. */
  children: ReactNode
}): React.JSX.Element {
  const ansicht = meinHofAnsichtAus(useSearchParams().get(MEIN_HOF_ANSICHT_PARAMETER))
  const bis = umschalterBis(reiter)
  const [markiert, setMarkiert] = useState<HofseiteZeileId | null>(null)
  // Zählt jeden Wunsch nach der Kundenansicht — auch einen zweiten bei schon offener —, damit der Sprung jedes Mal kommt.
  const [sprung, setSprung] = useState(0)
  const anker = useRef<HTMLDivElement>(null)

  const schreibe = useCallback((neu: MeinHofAnsichtId) => {
    const { pathname, search, hash } = window.location
    // null als Zustand: Next gleicht useSearchParams ab (ARCHITECTURE §4, State-Regeln).
    window.history.replaceState(null, '', ansichtAdresse(pathname, search, neu) + hash)
  }, [])

  const zeigeKundin = useCallback(
    (abschnitt: HofseiteZeileId | null = null) => {
      setMarkiert(abschnitt)
      setSprung((n) => n + 1)
      schreibe('kundin')
    },
    [schreibe]
  )

  const steuerung = useMemo<MeinHofAnsichtSteuerung>(
    () => ({
      zeigeKundin,
      gespeichert: (abschnitt = null) => meldeGespeichertAnsehen({ onAnsehen: () => zeigeKundin(abschnitt) }),
    }),
    [zeigeKundin]
  )

  // Der Rahmen braucht den Bildschirm: Der Umschalter rückt nach oben, der
  // Rahmen füllt den Rest bis zur Unterleiste. Ab der Grenze nie — dort steht
  // der Inhalt, und die Seite bleibt, wo sie ist.
  useEffect(() => {
    if (ansicht !== 'kundin') return
    if (window.matchMedia(`(min-width: ${UMSCHALTER_AB_PX[bis]}px)`).matches) return
    const oben = anker.current?.getBoundingClientRect().top
    if (oben !== undefined) window.scrollTo({ top: oben + window.scrollY })
  }, [ansicht, sprung, bis])

  return (
    <Steuerung.Provider value={steuerung}>
      {kopf}
      {/* Wo der Umschalter ohne Kleben stünde — das Ziel des Sprungs. */}
      <div ref={anker} />
      <div
        data-umschalter=""
        className={cn(
          'sticky top-0 z-30 flex h-14 items-center justify-center border-b border-border bg-background px-4 md:px-8 print:hidden',
          GRENZE[bis].nurDarunter
        )}
      >
        <Segment
          beschriftung={MEIN_HOF_ANSICHT_TEXT.beschriftung}
          optionen={MEIN_HOF_ANSICHT_OPTIONEN}
          wert={ansicht}
          onWertChange={(wert) => {
            if (wert === 'kundin') {
              zeigeKundin(null)
              return
            }
            setMarkiert(null)
            schreibe('bearbeiten')
          }}
        />
      </div>
      {ansicht === 'kundin' && (
        <KundenRahmen adresse={kundenAnsichtAdresse(slug, reiter)} markiert={markiert} className={GRENZE[bis].nurDarunter} />
      )}
      <div className={cn(ansicht === 'kundin' && GRENZE[bis].abDort)}>{children}</div>
    </Steuerung.Provider>
  )
}

/**
 * Die echte Hofseite im Rahmen. Einbetten ist nur für diese Adresse und nur
 * für uns selbst erlaubt (next.config.ts, frame-ancestors 'self'); Kaufen
 * wirkt in der Vorschau nicht. Höhe: der Bildschirm abzüglich Umschalter
 * (56 px), der Zeile „In neuem Tab öffnen" (44 px) und unter md der
 * Unterleiste der HofShell (68 px und ihr Rand, dazu der Home-Indicator).
 */
function KundenRahmen({
  adresse,
  markiert,
  className,
}: {
  adresse: string
  markiert: HofseiteZeileId | null
  className: string
}): React.JSX.Element {
  const rahmen = useRef<HTMLIFrameElement>(null)
  useVorschauMarkierung(rahmen, markiert)

  return (
    <div className={className}>
      {/* Der bearbeitete Inhalt mit seiner Überschrift ist ausgeblendet — die Seite behält eine. */}
      <h1 className="sr-only">{MEIN_HOF_ANSICHT_TEXT.kundin}</h1>
      <div className="flex min-h-11 items-center justify-end px-4 md:px-8">
        <a
          href={adresse}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'inline-flex min-h-11 items-center gap-1.5 rounded-full px-1 text-[13px] font-medium text-muted-foreground transition-colors duration-[250ms] hover:text-foreground',
            FOKUS_RAHMEN
          )}
        >
          {MEIN_HOF_ANSICHT_TEXT.neuerTab}
          <ArrowUpRight className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
          <span className="sr-only"> (öffnet in neuem Tab)</span>
        </a>
      </div>
      <iframe
        ref={rahmen}
        src={adresse}
        title={MEIN_HOF_ANSICHT_TEXT.rahmenTitel}
        className="block h-[calc(100dvh-169px-env(safe-area-inset-bottom))] w-full border-0 bg-background md:h-[calc(100dvh-100px)]"
      />
    </div>
  )
}
