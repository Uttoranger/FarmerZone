'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

/*
 * Das Inhaltsverzeichnis der Rechtsseiten (Nr. 231): die Sprünge, gruppiert,
 * mit dem gewählten Sprung grün und fett. Gezeichnet in der Vorlage
 * (rechtstext-vorlage.tsx) zweimal — am Handy im aufklappbaren „Inhalt“, ab
 * 1024 px in der Spalte.
 *
 * Seit Nr. 254 (Liste Lauf 32, rechtstexte Z. 847/854): Der hervorgehobene
 * Eintrag folgt dem Abschnitt, den man gerade liest — nicht nur der
 * Sprungmarke der Adresse —, und die Spalte holt ihn ins Bild. Teile stehen
 * in Eintragsgröße, die Punkte darunter eingerückt (Board w3).
 */

/** Ein Sprung im Verzeichnis: Sprungmarke, Text und — bei nummerierten Punkten — die Nummer. */
export type VerzeichnisEintrag = { anker: string; text: string; nummer?: number }

/**
 * Eine Gruppe von Sprüngen, mit Überschrift (ein Teil der AGB) oder ohne. Die Überschrift steht in
 * Eintragsgröße, ohne eigenen Sprung (die Sprünge zählt tests/agb-seite.test.ts je Punkt).
 */
export type VerzeichnisGruppe = { titel?: string; eintraege: readonly VerzeichnisEintrag[] }

const LINK = cn(
  'flex min-h-11 items-center rounded-md px-1 py-2 text-[14px] leading-snug text-foreground hover:text-brand-text',
  'aria-[current=location]:font-semibold aria-[current=location]:text-brand-text',
  FOKUS_RAHMEN
)

/**
 * Wie weit unter dem oberen Fensterrand eine Überschrift stehen darf, damit
 * ihr Abschnitt als „gelesen“ gilt: Kopf der Shell (65 px) plus gut eine
 * Absatzhöhe — nach einem Sprung steht die Überschrift nicht immer genau an
 * ihrer scroll-margin (Schriften laden nach, die Seite verschiebt sich).
 */
export const VERZEICHNIS_LESELINIE_PX = 200

/** Die Sprungmarke, deren Überschrift zuletzt über der Leselinie steht — oder keine. */
export function abschnittAnDerLeselinie(
  anker: readonly string[],
  obenVon: (anker: string) => number | null,
  linie: number = VERZEICHNIS_LESELINIE_PX
): string | null {
  let treffer: string | null = null
  for (const a of anker) {
    const oben = obenVon(a)
    if (oben === null) continue
    if (oben <= linie) treffer = a
  }
  return treffer
}

function alleAnker(gruppen: readonly VerzeichnisGruppe[]): string[] {
  return gruppen.flatMap((g) => g.eintraege.map((e) => e.anker))
}

/** Schiebt nur die eigene Spalte (nicht die Seite), bis der Eintrag ganz im Bild ist — rollt keine (Karte seit Nr. 279 ohne Innenrollen), tut es nichts. */
function insBild(link: HTMLElement): void {
  let rahmen = link.parentElement
  while (rahmen && rahmen.scrollHeight <= rahmen.clientHeight + 1) rahmen = rahmen.parentElement
  if (!rahmen || rahmen === document.body || rahmen === document.documentElement) return
  const r = rahmen.getBoundingClientRect()
  const l = link.getBoundingClientRect()
  if (l.top < r.top) rahmen.scrollTop -= r.top - l.top + 8
  else if (l.bottom > r.bottom) rahmen.scrollTop += l.bottom - r.bottom + 8
}

/**
 * Die Sprünge des Inhaltsverzeichnisses einer Rechtsseite (Vorlage
 * `RechtstextVorlage`, Boards s3/w3-rechtstexte). Der gewählte Sprung ist grün
 * und fett (`aria-current="location"`): beim Laden und bei jedem Sprung die
 * Sprungmarke der Adresse, beim Lesen der Abschnitt an der Leselinie.
 */
export function RechtstextVerzeichnis({ gruppen }: { gruppen: readonly VerzeichnisGruppe[] }): React.JSX.Element {
  const [aktiv, setAktiv] = useState<string | null>(null)
  const wurzel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const anker = alleAnker(gruppen)
    let rahmen = 0
    const lies = (): void => {
      rahmen = 0
      const gelesen = abschnittAnDerLeselinie(anker, (a) => document.getElementById(a)?.getBoundingClientRect().top ?? null)
      setAktiv(gelesen ?? (decodeURIComponent(window.location.hash.slice(1)) || null))
    }
    const beimScrollen = (): void => {
      if (!rahmen) rahmen = window.requestAnimationFrame(lies)
    }
    lies()
    window.addEventListener('hashchange', lies)
    window.addEventListener('scroll', beimScrollen, { passive: true })
    return () => {
      window.removeEventListener('hashchange', lies)
      window.removeEventListener('scroll', beimScrollen)
      if (rahmen) window.cancelAnimationFrame(rahmen)
    }
  }, [gruppen])

  useEffect(() => {
    if (!aktiv || !wurzel.current) return
    const link = wurzel.current.querySelector<HTMLElement>('[aria-current="location"]')
    // Nur sichtbare Spalten schieben: Das zugeklappte „Inhalt“ am Handy hat keine Fläche.
    if (link && link.offsetParent !== null) insBild(link)
  }, [aktiv])

  return (
    <div ref={wurzel} className="flex flex-col">
      {gruppen.map((gruppe, i) => (
        <div key={gruppe.titel ?? `gruppe-${i}`}>
          {gruppe.titel && <p className="flex min-h-11 items-center px-1 text-[14px] leading-snug text-foreground">{gruppe.titel}</p>}
          <ol role="list" className="list-none">
            {gruppe.eintraege.map((eintrag) => (
              <li key={eintrag.anker}>
                <a
                  href={`#${eintrag.anker}`}
                  aria-current={aktiv === eintrag.anker ? 'location' : undefined}
                  className={cn(LINK, gruppe.titel && 'pl-5')}
                >
                  <span>
                    {eintrag.nummer !== undefined && <span className="tabular-nums">{eintrag.nummer}. </span>}
                    {eintrag.text}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}
