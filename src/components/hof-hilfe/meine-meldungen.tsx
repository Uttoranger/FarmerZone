import Link from 'next/link'
import { CircleAlert, LifeBuoy, Plus } from 'lucide-react'
import { MEINE_MELDUNGEN_HREF, NEUE_MELDUNG_HREF, type MeldungZeile } from '@/lib/hof-hilfe'
import { EmptyState } from '@/components/ui/empty-state'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { StatusBadge } from '@/components/ui/status-badge'
import { KARTE, KNOPF_GRUEN, KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { cn } from '@/lib/utils'

/*
 * „Meine Meldungen" in der HofShell (Nachtlauf Nr. 22e; Mockups
 * web-h6-meine-meldungen, mobil-h6-meine-meldungen): nur die eigenen
 * Meldungen des Hofs, nur die Felder der Sichtbarkeitsregel (fuerHof). Je
 * Meldung eine Karte mit Art, erster Zeile, Tag, öffentlichem Status und —
 * falls es eine gibt — der Antwort des Betreibers.
 *
 * Meldungstext und Antwort sind Fremdtext: React setzt sie als Text, nie als
 * Markup. Genau ein grüner Knopf „+ Neue Meldung" (Mockup); im Leerzustand
 * führt zusätzlich ein Umriss-Knopf dorthin.
 */

export function MeineMeldungen({ zeilen }: { zeilen: MeldungZeile[] | null }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="font-heading text-2xl font-semibold text-foreground md:text-[26px]">Meine Meldungen</h1>
        <Link href={NEUE_MELDUNG_HREF} className={cn(KNOPF_GRUEN, 'w-full rounded-[14px] sm:w-auto sm:rounded-full')}>
          <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
          Neue Meldung
        </Link>
      </div>
      <p className="text-[13.5px] leading-normal text-muted-foreground">Hier siehst du, was aus deinen Meldungen geworden ist.</p>

      {zeilen === null ? (
        <Hinweiskarte
          ton="orange"
          symbol={CircleAlert}
          titel="Wir konnten deine Meldungen gerade nicht laden."
          aktion={
            <a href={MEINE_MELDUNGEN_HREF} className={KNOPF_RAHMEN}>
              Noch einmal versuchen
            </a>
          }
        >
          Es ist nichts verloren gegangen. Versuch es bitte gleich noch einmal.
        </Hinweiskarte>
      ) : zeilen.length === 0 ? (
        <EmptyState
          symbol={LifeBuoy}
          titel="Noch keine Meldungen"
          satz="Wenn etwas klemmt oder dir etwas fehlt, schreib uns — hier siehst du dann, was daraus geworden ist."
          aktion={
            <Link href={NEUE_MELDUNG_HREF} className={KNOPF_RAHMEN}>
              Meldung schreiben
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Deine Meldungen">
          {zeilen.map((z) => (
            <li key={z.id} className={cn(KARTE, 'px-4 py-3.5')}>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <StatusBadge status={z.artTon}>{z.art}</StatusBadge>
                <p className="line-clamp-2 min-w-0 flex-1 basis-48 text-[14.5px] font-semibold break-words text-foreground" title={z.titel}>
                  {z.titel}
                </p>
                <span className="text-[12.5px] whitespace-nowrap text-muted-foreground">
                  {z.datum} · Nr. <span className="font-mono">{z.kurznummer}</span>
                </span>
                <StatusBadge status={z.statusTon}>{z.status}</StatusBadge>
              </div>
              {z.antwort && (
                <p className="mt-2.5 rounded-lg border-l-[3px] border-accent bg-background px-3 py-2.5 text-[13.5px] leading-normal break-words text-foreground">
                  <span className="font-semibold">Antwort:</span> {z.antwort}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
