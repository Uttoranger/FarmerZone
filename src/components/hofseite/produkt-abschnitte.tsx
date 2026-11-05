'use client'

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import type { KategorieAbschnitt } from '@/lib/bereiche-anzeige'
import { mitAnzahl } from '@/lib/format'
import { naechsterAktiverReiter } from '@/lib/hofseite-sektionen'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { PRODUKT_LISTE } from '@/components/hofseite/produkt-karte'
import { UEBERZEILE } from '@/components/hofseite/hofseite-seitenspalte'

/** Das Sprungziel „Alle" — der Anfang der Produkte. */
const ALLE_ANKER = 'produkte-alle'

/**
 * Wie weit ein Sprungziel unter dem klebenden Block stehen bleibt. Kopf und
 * Block (Hofzeile, Reiter, Chips — Nr. 177) hält schon das scroll-padding der
 * Hofseite frei (globals.css, gemessene Blockhöhe); der Browser zählt
 * scroll-margin dazu. Hier nur noch etwas Luft, sonst stünde der Abschnitt
 * nach einem Chip einen halben Bildschirm tief.
 */
export const SPRUNGZIEL_UNTER_LEISTE = 'scroll-mt-3'

/** Erkennungsstreifen des Beobachters: zwischen 30 % und 40 % der Fensterhöhe (wie bisher auf der Hofseite). */
const SPY_STREIFEN = '-30% 0px -60% 0px'

/** Wie lange nach einem angetippten Chip sein Ziel gilt — das Ende eines weichen Scrollens lässt sich nicht überall abfragen. */
const SPRUNG_SPERRE_MS = 1000

const CHIP = cn(
  "relative inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[15px] whitespace-nowrap transition-colors duration-[250ms]",
  FOKUS_RAHMEN
)

/**
 * Der Reiter „Produkte" (Boards s1-/w1-hofseite Bild 3): Kategorie-Chips als Sprungmarken,
 * die Abschnitte je Kategorie (E1, kategorieAbschnitte) mit leiser Überzeile
 * „MILCH & EIER · 3 PRODUKTE" und darunter der Satz zur Gebühr — als leise Zeile am Ende,
 * nicht als Kasten über der Liste.
 *
 * Die Chips sind echte Links auf ihren Abschnitt (#kategorie-…): Mittelklick
 * und Teilen funktionieren. Ein gewöhnlicher Klick scrollt weich und schreibt
 * den Anker per replaceState — ohne Eintrag im Verlauf. Welcher Chip
 * markiert ist, entscheidet naechsterAktiverReiter (dieselbe Regel wie die
 * frühere Sektionsleiste): Ein angetippter Sprung gewinnt, bis er steht,
 * sonst der unterste sichtbare Abschnitt — der Beobachter überschreibt nie
 * unterwegs den Chip, den jemand gedrückt hat (Meldung cmua8bof). Die Reihe steht
 * im Fluss (seit Nr. 235: am Handy klebt nur die Hofzeile, Board s1-hofseite) und
 * scrollt am Handy seitlich; der markierte Chip rückt dort in Sicht.
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
  const chipReihe = useRef<HTMLUListElement>(null)

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

  // Am Handy scrollt die Reihe seitlich: Der markierte Chip rückt in den sichtbaren Teil,
  // sonst stünde „Honig" gewählt, aber außer Sicht. Nur die Reihe scrollt (scrollTo), nie das Fenster.
  useEffect(() => {
    const reihe = chipReihe.current
    const chip = reihe?.querySelector<HTMLElement>(`[data-chip="${aktiv}"]`)
    if (!reihe || !chip) return
    const links = chip.offsetLeft - reihe.offsetLeft
    if (links < reihe.scrollLeft || links + chip.offsetWidth > reihe.scrollLeft + reihe.clientWidth) {
      reihe.scrollTo({ left: Math.max(0, links - 16) })
    }
  }, [aktiv])

  function beimChip(e: MouseEvent<HTMLAnchorElement>, anker: string) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    setAktiv(anker)
    sperreAuf(anker)
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${anker}`)
    document.getElementById(anker)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Die Zahl nur an „Alle" (Board w1-hofseite Bild 3) — die Abschnitte nennen ihre Zahl in der Überzeile.
  const chips = [
    { anker: ALLE_ANKER, titel: 'Alle', anzahl: gesamt as number | null },
    ...abschnitte.map((a) => ({ anker: a.anker, titel: a.titel, anzahl: null as number | null })),
  ]

  return (
    <div id={ALLE_ANKER} className={cn('flex flex-col gap-3', SPRUNGZIEL_UNTER_LEISTE)}>
      {abschnitte.length > 1 && (
        <nav aria-label="Zu einer Kategorie springen" className="-mx-4 overflow-x-auto px-4 py-1 md:mx-0 md:px-0">
          <ul ref={chipReihe} className="flex gap-2 md:flex-wrap">
            {chips.map((chip) => {
              const gewaehlt = aktiv === chip.anker
              return (
                <li key={chip.anker}>
                  <a
                    href={`#${chip.anker}`}
                    data-chip={chip.anker}
                    onClick={(e) => beimChip(e, chip.anker)}
                    aria-current={gewaehlt ? 'true' : undefined}
                    className={cn(
                      CHIP,
                      gewaehlt
                        ? 'border-foreground bg-foreground font-bold text-background'
                        : 'border-input bg-card font-semibold text-foreground hover:bg-muted'
                    )}
                  >
                    {chip.titel}
                    {chip.anzahl !== null && <span className="tabular-nums">· {chip.anzahl}</span>}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>
      )}

      {abschnitte.map((a) => (
        <section key={a.anker} id={a.anker} aria-labelledby={`${a.anker}-titel`} className={cn('flex flex-col gap-2.5', SPRUNGZIEL_UNTER_LEISTE)}>
          <h2 id={`${a.anker}-titel`} className={cn(UEBERZEILE, 'mt-1')}>
            {a.titel} · {mitAnzahl(a.produkte.length, 'Produkt', 'Produkte')}
          </h2>
          <ul className={PRODUKT_LISTE}>
            {a.produkte.map((p) => (
              <li key={p.id}>{renderKarte(p)}</li>
            ))}
          </ul>
        </section>
      ))}

      {gebuehrHinweis && <p className="text-[13px] text-muted-foreground">{gebuehrHinweis}</p>}
    </div>
  )
}
