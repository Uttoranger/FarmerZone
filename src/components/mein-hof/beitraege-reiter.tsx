import Link from 'next/link'
import { Megaphone, Plus } from 'lucide-react'
import type { BeitraegeUebersicht } from '@/lib/mein-hof-beitraege'
import { EmptyState } from '@/components/ui/empty-state'
import { ListGruppe } from '@/components/ui/list-row'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { BeitragZeile } from '@/components/mein-hof/beitrag-zeile'
import { cn } from '@/lib/utils'

/*
 * Der Reiter „Beiträge" in Mein Hof (E12; Nachtlauf Nr. 16 als Übersicht,
 * seit Nr. 22e mit allem, was /status konnte): je Beitrag Deaktivieren,
 * Löschen, „Als Vorlage verwenden" und „WhatsApp fortsetzen"
 * (components/mein-hof/beitrag-zeile.tsx). /status leitet hierher um.
 * Geschrieben wird im bestehenden Ablauf /status/new — kein zweiter Editor.
 * Was angeboten wird, entscheidet src/lib/mein-hof-beitraege.ts.
 *
 * Genau ein orange gefüllter Knopf (Hof-Aktion „erstellen"), der Rest Umriss.
 */

const HAUPTKNOPF = cn(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors duration-[250ms] hover:bg-primary/90',
  FOKUS_RAHMEN
)

export function BeitraegeReiter({ uebersicht }: { uebersicht: BeitraegeUebersicht }): React.JSX.Element {
  if (uebersicht.anzahl === 0) {
    return (
      <EmptyState
        className="max-w-3xl"
        symbol={Megaphone}
        titel="Noch kein Beitrag"
        satz="Mit einem Beitrag erzählst du deinen Kunden, was es gerade gibt — er steht auf deiner Hofseite."
        aktion={
          <Link href="/status/new" className={HAUPTKNOPF}>
            <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
            Ersten Beitrag schreiben
          </Link>
        }
      />
    )
  }

  return (
    <div className="max-w-3xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Was du deinen Kunden erzählst — auf der Hofseite und auf Wunsch per E-Mail oder WhatsApp.</p>
        <Link href="/status/new" className={cn(HAUPTKNOPF, 'shrink-0 self-start sm:self-auto')}>
          <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
          Neuer Beitrag
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-6">
        {uebersicht.gruppen.map((gruppe) => (
          <section key={gruppe.id} aria-labelledby={`beitraege-${gruppe.id}`}>
            <h2 id={`beitraege-${gruppe.id}`} className="px-1 text-[11px] font-semibold tracking-[1.1px] text-muted-foreground uppercase">
              {gruppe.titel}
            </h2>
            <ListGruppe className="mt-2">
              {gruppe.eintraege.map((eintrag) => (
                <BeitragZeile key={eintrag.id} eintrag={eintrag} />
              ))}
            </ListGruppe>
          </section>
        ))}
      </div>
    </div>
  )
}
