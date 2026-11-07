import Link from 'next/link'
import { ChevronRight, Plus } from 'lucide-react'
import { NEUE_MELDUNG_HREF, MEINE_MELDUNGEN_HREF, type MeldungZeile } from '@/lib/hof-hilfe'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { RUNDUNG } from '@/components/ui/rundung'
import { WerkzeugKopf } from '@/components/ui/werkzeug-kopf'
import { FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { LadeFehlerKasten } from '@/components/hof-hilfe/lade-fehler-kasten'
import { cn } from '@/lib/utils'

/*
 * „Meine Meldungen" in der HofShell (Nachtlauf Nr. 22e; seit Nr. 251 nach Board
 * s2-/w2-meldungen Bild 4–6): nur die eigenen Meldungen des Hofs, nur die
 * Felder der Sichtbarkeitsregel (fuerHof). EINE Liste, je Meldung eine Zeile
 * mit Art und Tag, dem Titel (mit Kurznummer, G14) und dem Stand; eine
 * Antwort des Betreibers klappt in der Zeile auf („Antwort lesen“).
 *
 * Meldungstext und Antwort sind Fremdtext: React setzt sie als Text, nie als
 * Markup. „+ Neue Meldung" bleibt über der Liste (Liste Lauf 32: C, sonst kein
 * Weg zur neuen Meldung); im Leerzustand nur „Meldung schreiben“.
 */

export function MeineMeldungen({ zeilen, unterzeile }: { zeilen: MeldungZeile[] | null; unterzeile?: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3.5">
      <WerkzeugKopf titel="Meine Meldungen" unterzeile={unterzeile} />
      <p className="text-[13.5px] leading-normal text-muted-foreground">Hier siehst du, was aus deinen Meldungen geworden ist.</p>
      {zeilen !== null && zeilen.length > 0 && (
        // Board s2/w2-meldungen: Umriss mit Feldrand (V51: im Hofbereich kein grüner Knopf).
        <Link href={NEUE_MELDUNG_HREF} className={cn(KNOPF_RAHMEN, 'w-full rounded-[10px] border-input bg-card font-semibold sm:w-auto sm:self-start')}>
          <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
          Neue Meldung
        </Link>
      )}

      {zeilen === null ? (
        <LadeFehlerKasten titel="Wir konnten deine Meldungen gerade nicht laden." nochmal={MEINE_MELDUNGEN_HREF} />
      ) : zeilen.length === 0 ? (
        <EmptyState
          titel="Noch keine Meldungen"
          satz="Wenn etwas klemmt oder dir etwas fehlt, schreib uns – hier siehst du dann, was daraus geworden ist."
          ausweg={
            <Link href={NEUE_MELDUNG_HREF} className={cn(KNOPF_RAHMEN, 'w-full justify-center rounded-[10px] border-primary text-status-offen')}>
              Meldung schreiben
            </Link>
          }
        />
      ) : (
        <ul className={cn('overflow-hidden border border-border bg-card', RUNDUNG.karte)} aria-label="Deine Meldungen">
          {zeilen.map((z) => (
            <li key={z.id} className="border-t border-border first:border-t-0">
              <MeldungInhalt z={z} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function MeldungInhalt({ z }: { z: MeldungZeile }): React.JSX.Element {
  const kopf = (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <p className="text-[13px] text-muted-foreground">
        <span className="font-semibold text-foreground">{z.art}</span> · {z.datum}
      </p>
      <p className="line-clamp-2 text-[15px] font-semibold break-words text-foreground" title={z.titel}>
        {z.titel} <span className="font-mono text-[13px] font-normal text-muted-foreground">· {z.kurznummer}</span>
      </p>
      <span>
        <StatusBadge status={z.statusTon}>{z.status}</StatusBadge>
        {z.antwort && <span className="ml-2 text-[13px] font-semibold text-status-offen">Antwort lesen</span>}
      </span>
    </div>
  )
  if (!z.antwort) return <div className="px-4 py-3.5">{kopf}</div>
  // Die Antwort klappt in der Zeile auf (Board s2-/w2-meldungen Bild 4); <details> geht ohne JavaScript.
  return (
    <details className="group">
      <summary className={cn('flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden', FOKUS_RAHMEN_INNEN)}>
        {kopf}
        <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform duration-[250ms] group-open:rotate-90" strokeWidth={1.7} aria-hidden="true" />
      </summary>
      <p className="mx-4 mb-3.5 border-l-[3px] border-primary bg-background px-3 py-2.5 text-[13.5px] leading-normal break-words text-foreground">
        <span className="font-semibold">Antwort:</span> {z.antwort}
      </p>
    </details>
  )
}
