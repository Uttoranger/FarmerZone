'use client'

import { useState } from 'react'
import { FarmPageView } from '@/components/farm/farm-page-view'
import { vorschauLink } from '@/lib/hofseite-vorschau'
import type { PublicFarm } from '@/server/queries/farm'
import type { ActiveStatusPost } from '@/server/queries/status-posts'
import { Segment } from '@/components/ui/segment'

type Mode = 'edit' | 'preview'

const MODI = [
  { wert: 'edit', label: 'Bearbeiten' },
  { wert: 'preview', label: 'Kundenansicht' },
] as const

interface Props {
  farm: PublicFarm
  activeStatus: ActiveStatusPost | null
  pastStatusCount: number
}

/*
 * Mein Hof unter lg: die Hofseite mit Stiften (Bearbeiten) oder die echte
 * Hofseite im Rahmen (Kundenansicht). Seit Nachtlauf Nr. 16 in der HofShell;
 * der Umschalter ist der Segment-Baustein. Adresse, Kopieren und Teilen
 * standen hier ein zweites Mal — sie sitzen im Kopf von Mein Hof
 * (components/mein-hof/seitenkopf.tsx), und dort nur, solange die Hofseite
 * öffentlich ist; hier kopierte die Leiste auch einen Link ins Leere.
 */
export function FarmPageClient({ farm, activeStatus, pastStatusCount }: Props): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('edit')

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-y border-border bg-card px-4 py-2.5 md:px-8">
        <p className="text-[13px] text-muted-foreground">
          {mode === 'edit' ? 'Tippe auf einen Stift, um etwas zu ändern.' : 'So sehen Kunden deine Hofseite.'}
        </p>
        <Segment
          beschriftung="Ansicht der Hofseite"
          optionen={MODI}
          wert={mode}
          onWertChange={(wert) => setMode(wert === 'preview' ? 'preview' : 'edit')}
          className="shrink-0"
        />
      </div>

      {mode === 'preview' ? (
        // Die Kundenansicht ist die echte Hofseite (?vorschau=1, dieselbe
        // Route wie für Kundinnen, samt Navigation im neuen Design) — kein
        // Nachbau (ARCHITECTURE §4, „Die Hofseite gibt es genau einmal").
        // Einbetten ist nur für diese Adresse und nur für uns selbst erlaubt
        // (next.config.ts, frame-ancestors 'self'); Kaufen wirkt dort nicht.
        // Höhe: ein Bildschirm abzüglich der Unterleiste der HofShell.
        <iframe
          src={vorschauLink(farm.slug)}
          title="So sehen Kunden deine Hofseite"
          className="block h-[calc(100dvh-9.5rem)] w-full border-0 bg-background"
        />
      ) : (
        // Die Bestandsfarben der Hofseite (--app-*) nehmen hier die Werte des
        // Design-Systems an (data-app-palette, globals.css).
        <div data-app-palette="neu">
          <FarmPageView
            farm={farm}
            activeStatus={activeStatus}
            ownerMode={true}
            mode={mode}
            pastStatusCount={pastStatusCount}
            onVorschau={() => setMode('preview')}
          />
        </div>
      )}
    </>
  )
}
