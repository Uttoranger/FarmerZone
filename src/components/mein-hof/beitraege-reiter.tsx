import Link from 'next/link'
import { ArrowRight, Megaphone, Plus } from 'lucide-react'
import type { BeitraegeUebersicht } from '@/lib/mein-hof-beitraege'
import { EmptyState } from '@/components/ui/empty-state'
import { ListGruppe, ListRow } from '@/components/ui/list-row'
import { StatusBadge } from '@/components/ui/status-badge'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

/*
 * Der Reiter „Beiträge" in Mein Hof (E12, Nachtlauf Nr. 16): eine Übersicht
 * der Beiträge, kein neuer Editor. Schreiben führt nach /status/new,
 * Deaktivieren, Löschen, „Als Vorlage" und „WhatsApp fortsetzen" stehen auf
 * der bestehenden Seite /status — sie bleibt als Route und wird von hier
 * verlinkt. Was die Übersicht sagt, entscheidet src/lib/mein-hof-beitraege.ts.
 *
 * Genau ein orange gefüllter Knopf (Hof-Aktion „erstellen"), der Rest Umriss.
 */

const HAUPTKNOPF = cn(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors duration-[250ms] hover:bg-primary/90',
  FOKUS_RAHMEN
)

const UMRISS = cn(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-semibold text-foreground transition-colors duration-[250ms] hover:bg-muted',
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
                <ListRow
                  key={eintrag.id}
                  titel={eintrag.titel}
                  untertitel={eintrag.zeile}
                  ende={<StatusBadge status={eintrag.marke.ton}>{eintrag.marke.text}</StatusBadge>}
                />
              ))}
            </ListGruppe>
          </section>
        ))}
      </div>

      <div className="mt-6">
        <Link href="/status" className={UMRISS}>
          Beiträge bearbeiten
          <ArrowRight className="size-4" strokeWidth={1.7} aria-hidden="true" />
        </Link>
        <p className="mt-2 text-xs text-muted-foreground">Deaktivieren, löschen, als Vorlage verwenden oder WhatsApp fortsetzen.</p>
      </div>
    </div>
  )
}
