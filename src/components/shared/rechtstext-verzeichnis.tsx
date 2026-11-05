'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

/** Ein Sprung im Verzeichnis: Sprungmarke, Text und — bei nummerierten Punkten — die Nummer. */
export type VerzeichnisEintrag = { anker: string; text: string; nummer?: number }

/** Eine Gruppe von Sprüngen, mit Überschrift (ein Teil der AGB) oder ohne. */
export type VerzeichnisGruppe = { titel?: string; eintraege: readonly VerzeichnisEintrag[]; betont?: boolean }

const LINK = cn(
  'flex min-h-11 items-baseline gap-2 rounded-md px-1 py-2.5 text-[13.5px] leading-snug text-foreground hover:text-brand-text',
  'aria-[current=location]:font-semibold aria-[current=location]:text-brand-text',
  FOKUS_RAHMEN
)

/**
 * Die Sprünge des Inhaltsverzeichnisses einer Rechtsseite (Vorlage
 * `RechtstextVorlage`, Boards s3/w3-rechtstexte). Der gewählte Sprung ist grün
 * und fett (`aria-current="location"`): Er folgt der Sprungmarke der Adresse —
 * beim Laden und bei jedem Sprung —, ohne mitzulesen, wohin gescrollt wird.
 */
export function RechtstextVerzeichnis({ gruppen }: { gruppen: readonly VerzeichnisGruppe[] }): React.JSX.Element {
  const [aktiv, setAktiv] = useState<string | null>(null)

  useEffect(() => {
    const lies = (): void => setAktiv(decodeURIComponent(window.location.hash.slice(1)) || null)
    lies()
    window.addEventListener('hashchange', lies)
    return () => window.removeEventListener('hashchange', lies)
  }, [])

  return (
    <div className="flex flex-col gap-3">
      {gruppen.map((gruppe, i) => (
        <div key={gruppe.titel ?? `gruppe-${i}`}>
          {gruppe.titel && <p className="px-1 pt-1 text-[12.5px] font-semibold text-muted-foreground">{gruppe.titel}</p>}
          <ol role="list" className="list-none">
            {gruppe.eintraege.map((eintrag) => (
              <li key={eintrag.anker}>
                <a
                  href={`#${eintrag.anker}`}
                  aria-current={aktiv === eintrag.anker ? 'location' : undefined}
                  className={cn(LINK, gruppe.betont && 'font-semibold')}
                >
                  {eintrag.nummer !== undefined && <span className="w-6 shrink-0 text-right text-muted-foreground tabular-nums">{eintrag.nummer}.</span>}
                  <span>{eintrag.text}</span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}
