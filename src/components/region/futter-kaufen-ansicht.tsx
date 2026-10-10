import Link from 'next/link'
import { Plus, ShieldCheck, Wheat } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterChip, FilterChipReihe } from '@/components/ui/chip'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { KARTE, KNOPF_GRUEN, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { KmWahl } from '@/components/region/km-wahl'
import { FUTTER_ANLEGEN_HREF } from '@/lib/bauern-navigation'
import {
  FUTTER_KAUFEN_HINWEIS,
  FUTTER_SELBST_VERKAUFEN,
  type FutterAngebot,
  type FutterKaufenAnsicht as Ansicht,
} from '@/lib/futter-kaufen'
import { UMFELD_KM } from '@/lib/umfeld'
import { cn } from '@/lib/utils'
import { futterKaufenLink, type FutterKaufenFilter } from '@/schemas/region'

/*
 * Region › Futter kaufen (Nachtlauf Nr. 22c, Mockup web-h5-region-futter-
 * kaufen): Umkreis, Futterart und Menge als Links in der Adresse, darunter je
 * Familie eine Karte mit Hof, Entfernung, nächster Abholung, Schild (E9),
 * Grundpreis, den Größen und „Bestellen". Alles hat src/lib/futter-kaufen.ts
 * entschieden und formatiert; hier wird nur angeordnet. Kaufen geht über die
 * Produktseite des Hofs (dort wählt man die Größe und kauft als Betrieb).
 */
export function FutterKaufenAnsicht({ ansicht, filter }: { ansicht: Ansicht; filter: FutterKaufenFilter }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <KmWahl stufen={UMFELD_KM.map((km) => ({ km, href: futterKaufenLink({ ...filter, km }), aktiv: km === filter.km }))} />
        <FilterChipReihe beschriftung="Futterart">
          {ansicht.artChips.map((chip) => (
            <FilterChip key={chip.wert ?? 'alle'} href={futterKaufenLink({ ...filter, art: chip.wert })} aktiv={chip.aktiv}>
              {chip.label}
            </FilterChip>
          ))}
        </FilterChipReihe>
        {ansicht.mengeChips.length > 1 && (
          <FilterChipReihe beschriftung="Menge">
            {ansicht.mengeChips.map((chip) => (
              <FilterChip key={chip.wert ?? 'alle'} href={futterKaufenLink({ ...filter, menge: chip.wert })} aktiv={chip.aktiv}>
                {chip.label}
              </FilterChip>
            ))}
          </FilterChipReihe>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <p className={cn('text-[12.5px] leading-normal', LEISE)}>{FUTTER_KAUFEN_HINWEIS}</p>
        {ansicht.hinweise.map((hinweis) => (
          <p key={hinweis} className={cn('text-[12.5px] leading-normal', LEISE)}>
            {hinweis}
          </p>
        ))}
      </div>

      {ansicht.leer ? (
        <EmptyState
          symbol={Wheat}
          titel="Gerade kein Futter in der Nähe"
          satz={ansicht.leer.satz}
          aktion={
            ansicht.leer.auswahlZuruecksetzen ? (
              <Link href={futterKaufenLink({ km: filter.km, art: null, menge: null })} className={KNOPF_RAHMEN}>
                Alles Futter zeigen
              </Link>
            ) : ansicht.leer.weiterUmkreis ? (
              <Link href={futterKaufenLink({ ...filter, km: ansicht.leer.weiterUmkreis })} className={KNOPF_RAHMEN}>
                Umkreis auf {ansicht.leer.weiterUmkreis} km
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {ansicht.angebote.map((angebot) => (
            <li key={angebot.schluessel}>
              <FutterKarte angebot={angebot} />
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border px-4 py-3.5">
        <Plus className="mt-0.5 size-[17px] shrink-0 text-status-offen" strokeWidth={2} aria-hidden="true" />
        <div className="min-w-0 text-[12.5px] leading-normal text-muted-foreground">
          <p>{FUTTER_SELBST_VERKAUFEN}</p>
          <Link
            href={FUTTER_ANLEGEN_HREF}
            className={cn('mt-1 inline-flex min-h-11 items-center font-semibold text-brand-text underline-offset-4 hover:underline', FOKUS_RAHMEN)}
          >
            Futtermittel anlegen
          </Link>
        </div>
      </div>
    </div>
  )
}

function FutterKarte({ angebot }: { angebot: FutterAngebot }): React.JSX.Element {
  const unterzeile = [angebot.hofName, angebot.entfernung, angebot.abholung].filter(Boolean).join(' · ')
  return (
    <article aria-label={angebot.name} className={cn(KARTE, 'flex flex-col gap-3 px-4 py-3.5')}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 text-[14.5px] font-semibold break-words text-foreground" title={angebot.name}>
            {angebot.name}
          </h2>
          <p className={cn('mt-0.5 line-clamp-2 text-[12.5px] break-words', LEISE)} title={unterzeile}>
            {unterzeile}
          </p>
          {angebot.schild && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-status-fertig">
              <ShieldCheck className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
              <span className="min-w-0 break-words">{angebot.schild}</span>
            </p>
          )}
        </div>
        {angebot.grundpreis && (
          <div className="shrink-0 text-right">
            <p className={cn('text-[11px]', LEISE)}>Grundpreis</p>
            <p className="text-[13.5px] font-semibold text-foreground tabular-nums">{angebot.grundpreis}</p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <ul aria-label="Größen" className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {angebot.groessen.map((g) => (
            <li key={g.id} className="min-w-0 max-w-full">
              <Link
                href={g.href}
                title={g.name}
                className={cn(
                  'flex min-h-11 max-w-full flex-col justify-center rounded-[10px] border border-border bg-background px-3 py-1 text-left transition-colors duration-[250ms] hover:bg-muted',
                  FOKUS_RAHMEN
                )}
              >
                <span className="truncate text-xs font-semibold text-foreground">{g.name}</span>
                <span className={cn('text-[11.5px] tabular-nums', LEISE)}>{g.preis}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href={angebot.bestellenHref} className={cn(KNOPF_GRUEN, 'min-h-11 px-4 text-[12.5px]')}>
          Bestellen<span className="sr-only">: {angebot.name}</span>
        </Link>
      </div>
    </article>
  )
}
