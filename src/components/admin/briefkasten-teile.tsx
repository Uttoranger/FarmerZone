import Link from 'next/link'
import { ChevronRight, Inbox } from 'lucide-react'
import type { MeldungTon } from '@/lib/meldung'
import { WUNSCHLISTE_SATZ } from '@/lib/admin-briefkasten'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { KARTE, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'

/*
 * Die Teile des Briefkastens im Admin (Nachtlauf Nr. 22f, Mockup
 * admin-briefkasten): die Liste der Meldungen und die gebündelte Wunschliste.
 * Meldungstexte sind Fremdtext — sie stehen als Text da, gekürzt, mit dem
 * vollen Wortlaut im `title`; nie als Markup.
 */

export type BriefkastenZeile = {
  id: string
  art: string
  artTon: MeldungTon
  titel: string
  herkunft: string
  datum: string
  status: string
  statusTon: MeldungTon
}

export function MeldungListe({
  zeilen,
  leer,
}: {
  zeilen: BriefkastenZeile[]
  /** Leer-Zustand: Titel, Satz und ein Ausweg. */
  leer: { titel: string; satz: string; ausweg?: { text: string; href: string } }
}): React.JSX.Element {
  if (zeilen.length === 0) {
    return (
      <EmptyState
        symbol={Inbox}
        titel={leer.titel}
        satz={leer.satz}
        aktion={
          leer.ausweg ? (
            <Link href={leer.ausweg.href} className={KNOPF_RAHMEN}>
              {leer.ausweg.text}
            </Link>
          ) : undefined
        }
      />
    )
  }
  return (
    <ul aria-label="Meldungen" className={cn(KARTE, 'overflow-hidden [&>li+li]:border-t [&>li+li]:border-border')}>
      {zeilen.map((z) => (
        <li key={z.id}>
          <Link
            href={`/admin/meldungen/${z.id}`}
            className={cn(
              'grid min-h-[60px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-muted md:grid-cols-[76px_minmax(0,1fr)_96px_auto_auto]',
              FOKUS_RAHMEN_INNEN
            )}
          >
            <StatusBadge status={z.artTon} className="justify-self-start">
              {z.art}
            </StatusBadge>
            <span className="min-w-0">
              <span className="block truncate text-[14.5px] font-semibold text-foreground" title={z.titel}>
                {z.titel}
              </span>
              <span className={cn('block truncate text-[12.5px]', LEISE)} title={z.herkunft}>
                {z.herkunft}
              </span>
            </span>
            <span className={cn('hidden text-[13px] whitespace-nowrap md:block', LEISE)}>{z.datum}</span>
            <span className="col-start-2 flex flex-wrap items-center gap-2 md:col-start-auto">
              <span className={cn('text-[12.5px] whitespace-nowrap md:hidden', LEISE)}>{z.datum}</span>
              <StatusBadge status={z.statusTon}>{z.status}</StatusBadge>
            </span>
            <ChevronRight
              className="col-start-3 row-span-2 row-start-1 size-4 text-muted-foreground md:col-start-auto md:row-span-1"
              strokeWidth={1.7}
              aria-hidden="true"
            />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export type WunschBuendel = {
  schluessel: string
  name: string
  anzahl: number
  beispiele: Array<{ id: string; text: string }>
  weitere: number
}

/** Die Wunschliste, gebündelt nach Bündel (clusterKey) — größte zuerst (getWunschCluster). */
export function Wunschliste({ buendel }: { buendel: WunschBuendel[] }): React.JSX.Element {
  return (
    <section aria-labelledby="wunschliste-titel" className={cn(KARTE, 'flex flex-col gap-1 p-4 md:p-[18px]')}>
      <h2 id="wunschliste-titel" className="font-heading text-[17px] font-semibold text-foreground">
        Wunschliste gebündelt
      </h2>
      {buendel.length === 0 ? (
        <p className={cn('py-2 text-[13.5px]', LEISE)}>Noch keine Wünsche.</p>
      ) : (
        <ul className="[&>li]:border-t [&>li]:border-border">
          {buendel.map((b) => (
            <li key={b.schluessel} className="py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg bg-accent/18 px-1.5 text-[13px] font-semibold text-status-fertig tabular-nums">
                  {b.anzahl}
                  <span className="sr-only">{b.anzahl === 1 ? ' Wunsch' : ' Wünsche'}</span>
                </span>
                <span className="min-w-0 truncate text-[14.5px] text-foreground" title={b.name}>
                  {b.name}
                </span>
              </div>
              <ul className="mt-1.5 pl-10">
                {b.beispiele.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/admin/meldungen/${e.id}`}
                      className={cn('flex min-h-11 items-center rounded text-[12.5px] text-muted-foreground hover:text-foreground hover:underline', FOKUS_RAHMEN_INNEN)}
                      title={e.text}
                    >
                      <span className="min-w-0 truncate">{e.text}</span>
                    </Link>
                  </li>
                ))}
                {b.weitere > 0 && <li className={cn('text-[12.5px]', LEISE)}>… und {b.weitere} weitere</li>}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <p className={cn('pt-1 text-[12.5px] leading-relaxed', LEISE)}>{WUNSCHLISTE_SATZ}</p>
    </section>
  )
}
