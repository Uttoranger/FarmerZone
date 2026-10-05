'use client'

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import type { KategorieAbschnitt } from '@/lib/bereiche-anzeige'
import { mitAnzahl } from '@/lib/format'
import { naechsterAktiverReiter } from '@/lib/hofseite-sektionen'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'

/** Das Sprungziel „Alle" — der Anfang der Produkte. */
const ALLE_ANKER = 'produkte-alle'

/**
 * Wie weit ein Sprungziel unter dem oberen Rand stehen bleibt: unter der
 * Kopfzeile der Shell (56 px, ab md 64 px) und der klebenden Reiterleiste.
 */
export const SPRUNGZIEL_UNTER_LEISTE = 'scroll-mt-28 md:scroll-mt-32'

/** Erkennungsstreifen des Beobachters: zwischen 30 % und 40 % der Fensterhöhe (wie bisher auf der Hofseite). */
const SPY_STREIFEN = '-30% 0px -60% 0px'

/** Wie lange nach einem angetippten Chip sein Ziel gilt — das Ende eines weichen Scrollens lässt sich nicht überall abfragen. */
const SPRUNG_SPERRE_MS = 1000

const CHIP = cn(
  "relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[13.5px] whitespace-nowrap transition-colors duration-[250ms] before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
  FOKUS_RAHMEN
)

/**
 * Der Reiter „Produkte": Kategorie-Chips als Sprungmarken, der Hinweis auf die
 * Servicegebühr und die Abschnitte je Kategorie (E1, kategorieAbschnitte).
 * Mockups web-k2-alle-produkte-nach-kategorie, mobil-k2-produkte.
 *
 * Die Chips sind echte Links auf ihren Abschnitt (#kategorie-…): Mittelklick
 * und Teilen funktionieren. Ein gewöhnlicher Klick scrollt weich und schreibt
 * den Anker per replaceState — ohne Eintrag im Verlauf. Welcher Chip
 * markiert ist, entscheidet naechsterAktiverReiter (dieselbe Regel wie die
 * frühere Sektionsleiste): Ein angetippter Sprung gewinnt, bis er steht,
 * sonst der unterste sichtbare Abschnitt — der Beobachter überschreibt nie
 * unterwegs den Chip, den jemand gedrückt hat (Meldung cmua8bof).
 *
 * `springeZu`: ein Abschnitt, zu dem die Seite beim Öffnen springt — der
 * Futter-Abschnitt für `?bereich=futter`. Einmal; danach meldet
 * `onGesprungen`, damit ein späterer Reiterwechsel nicht wieder springt.
 */
export function ProduktAbschnitte<P extends { id: string }>({
  abschnitte,
  gebuehrHinweis,
  springeZu,
  onGesprungen,
  renderKarte,
}: {
  abschnitte: readonly KategorieAbschnitt<P>[]
  gebuehrHinweis: string | null
  springeZu?: string | null
  onGesprungen?: () => void
  renderKarte: (p: P) => ReactNode
}): React.JSX.Element {
  const gesamt = abschnitte.reduce((n, a) => n + a.produkte.length, 0)
  const reihenfolge = [ALLE_ANKER, ...abschnitte.map((a) => a.anker)]
  const reihenfolgeText = reihenfolge.join(' ')
  const [aktiv, setAktiv] = useState(() => springeZu ?? ALLE_ANKER)
  const sprungZiel = useRef<string | null>(null)
  const sprungTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function sperreAuf(anker: string) {
    sprungZiel.current = anker
    if (sprungTimer.current) clearTimeout(sprungTimer.current)
    sprungTimer.current = setTimeout(() => {
      sprungZiel.current = null
    }, SPRUNG_SPERRE_MS)
  }

  useEffect(
    () => () => {
      if (sprungTimer.current) clearTimeout(sprungTimer.current)
    },
    []
  )

  // Beim Öffnen einmal zum gewünschten Abschnitt (Futter aus ?bereich=futter).
  useEffect(() => {
    if (!springeZu) return
    const ziel = document.getElementById(springeZu)
    if (ziel) {
      sperreAuf(springeZu)
      ziel.scrollIntoView({ block: 'start' })
    }
    onGesprungen?.()
    // Nur beim Öffnen: Ein neuer Wunsch kommt mit einem neuen Aufruf der Seite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Den markierten Chip beim Scrollen nachführen.
  useEffect(() => {
    const ids = reihenfolgeText.split(' ')
    const sichtbare = new Set<string>()
    const beobachter = new IntersectionObserver(
      (eintraege) => {
        for (const e of eintraege) {
          if (e.isIntersecting) sichtbare.add(e.target.id)
          else sichtbare.delete(e.target.id)
        }
        setAktiv((bisher) =>
          naechsterAktiverReiter({ sichtbare: [...sichtbare], reihenfolge: ids, bisher, gesperrtAuf: sprungZiel.current })
        )
      },
      { rootMargin: SPY_STREIFEN }
    )
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) beobachter.observe(el)
    }
    return () => beobachter.disconnect()
  }, [reihenfolgeText])

  function beimChip(e: MouseEvent<HTMLAnchorElement>, anker: string) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    setAktiv(anker)
    sperreAuf(anker)
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${anker}`)
    document.getElementById(anker)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const chips = [
    { anker: ALLE_ANKER, titel: 'Alle', anzahl: gesamt },
    ...abschnitte.map((a) => ({ anker: a.anker, titel: a.titel, anzahl: a.produkte.length })),
  ]

  return (
    <div id={ALLE_ANKER} className={cn('flex flex-col gap-5', SPRUNGZIEL_UNTER_LEISTE)}>
      {abschnitte.length > 1 && (
        <nav aria-label="Zu einer Kategorie springen" className="-mx-4 overflow-x-auto px-4 py-1 md:mx-0 md:px-0">
          <ul className="flex gap-2 md:flex-wrap">
            {chips.map((chip) => {
              const gewaehlt = aktiv === chip.anker
              return (
                <li key={chip.anker}>
                  <a
                    href={`#${chip.anker}`}
                    onClick={(e) => beimChip(e, chip.anker)}
                    aria-current={gewaehlt ? 'true' : undefined}
                    className={cn(
                      CHIP,
                      gewaehlt
                        ? 'border-foreground bg-foreground font-semibold text-background'
                        : 'border-border bg-card font-medium text-foreground hover:bg-muted'
                    )}
                  >
                    {chip.titel}
                    <span className={cn('tabular-nums', gewaehlt ? 'text-background' : 'text-muted-foreground')}>
                      · {chip.anzahl}
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>
      )}

      {gebuehrHinweis && (
        <Hinweiskarte symbol={Info} className="py-3">
          {gebuehrHinweis}
        </Hinweiskarte>
      )}

      {abschnitte.map((a) => (
        <section key={a.anker} id={a.anker} aria-labelledby={`${a.anker}-titel`} className={cn('flex flex-col gap-3', SPRUNGZIEL_UNTER_LEISTE)}>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <h2 id={`${a.anker}-titel`} className="font-heading text-xl font-semibold text-foreground">
              {a.titel}
            </h2>
            <p className="text-[13px] text-muted-foreground">{mitAnzahl(a.produkte.length, 'Produkt', 'Produkte')}</p>
          </div>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {a.produkte.map((p) => (
              <li key={p.id}>{renderKarte(p)}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
