import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { BeitraegeUebersicht } from '@/lib/mein-hof-beitraege'
import { EmptyState } from '@/components/ui/empty-state'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { RUNDUNG } from '@/components/ui/rundung'
import { BeitragZeile } from '@/components/mein-hof/beitrag-zeile'
import { MEIN_HOF_GRUPPE_TITEL } from '@/components/mein-hof/zeilen-stil'
import { cn } from '@/lib/utils'

/*
 * Der Reiter „Beiträge" in Mein Hof (E12; Nachtlauf Nr. 16 als Übersicht,
 * seit Nr. 22e mit allem, was /status konnte; Mockup
 * mobil-h4-beitraege-teilen-je-beitrag): je Beitrag „Teilen" (Teilen-Fenster
 * im Beitrag-Modus, T5), „WhatsApp · n von m" (W1), Deaktivieren, „Als
 * Vorlage verwenden" und Löschen (components/mein-hof/beitrag-zeile.tsx).
 * /status leitet hierher um.
 * Geschrieben wird im bestehenden Ablauf /status/new — kein zweiter Editor.
 * Was angeboten wird, entscheidet src/lib/mein-hof-beitraege.ts.
 *
 * Genau ein orange gefüllter Knopf (Hof-Aktion „erstellen"), der Rest Umriss.
 *
 * Seit Nr. 274 nach Board s1-/w1-mein-hof Bild 5: Einleitungssatz und „Neuer
 * Beitrag“ (volle Breite) in einer Karte, Gruppen „Läuft · n“ / „Früher · n“, je
 * Beitrag eine Zeile mit „›“; die Handlungen klappen in der Zeile auf (E12: alles,
 * was /status konnte, bleibt).
 */

const HAUPTKNOPF = cn(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors duration-[250ms] hover:bg-primary/90',
  FOKUS_RAHMEN
)

/** „Neuer Beitrag“ in der Karte: über die volle Breite, 52 px, 16 px fett (Board s1-/w1-mein-hof Bild 5). */
const NEU_KNOPF = cn(
  'inline-flex min-h-[52px] w-full items-center justify-center bg-primary px-3 text-[16px] font-bold text-primary-foreground transition-colors duration-[250ms] hover:bg-primary/90',
  RUNDUNG.feld,
  FOKUS_RAHMEN
)

export function BeitraegeReiter({ uebersicht }: { uebersicht: BeitraegeUebersicht }): React.JSX.Element {
  if (uebersicht.anzahl === 0) {
    return (
      <EmptyState
        className="max-w-3xl"
        titel="Noch kein Beitrag"
        satz="Mit einem Beitrag erzählst du deinen Kunden, was es gerade gibt – er steht auf deiner Hofseite."
        ausweg={
          <Link href="/status/new" className={HAUPTKNOPF}>
            <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
            Ersten Beitrag schreiben
          </Link>
        }
      />
    )
  }

  return (
    <div className="flex max-w-3xl flex-col gap-2.5">
      <div className={cn('flex flex-col gap-2 border border-border bg-card px-3.5 py-3', RUNDUNG.blatt)}>
        <p className="text-[15px] text-muted-foreground">Was du deinen Kunden erzählst – auf der Hofseite und auf Wunsch per E-Mail oder WhatsApp.</p>
        <Link href="/status/new" className={NEU_KNOPF}>
          Neuer Beitrag
        </Link>
      </div>

      {uebersicht.gruppen.map((gruppe) => (
        <section key={gruppe.id} aria-labelledby={`beitraege-${gruppe.id}`} className="flex flex-col">
          <h2 id={`beitraege-${gruppe.id}`} className={MEIN_HOF_GRUPPE_TITEL}>
            {gruppe.titel} · {gruppe.eintraege.length}
          </h2>
          <ul className={cn('overflow-hidden border border-border bg-card', RUNDUNG.karte)}>
            {gruppe.eintraege.map((eintrag) => (
              <BeitragZeile key={eintrag.id} eintrag={eintrag} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
