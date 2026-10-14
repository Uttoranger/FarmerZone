import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { INFOSEITE_ABSCHNITT, INFOSEITE_LINK } from '@/components/shared/infoseite-stil'
import { AgbStuecke } from '@/components/rechtstexte/agb-stuecke'
import {
  AGB_ANHANG,
  AGB_ANHANG_ANKER,
  AGB_KURZ_ERKLAERT,
  AGB_TEILE,
  agbAnker,
  agbTeilAnker,
  type AgbBlock,
  type AgbPunkt,
  type AgbTeil,
} from '@/lib/rechtstexte/agb'
import { AGB_SEITE_TEXT } from '@/lib/rechtstexte/agb-einbindung'

/*
 * Die Teile der Seite /agb (Register O4), gezeichnet aus den Daten in
 * src/lib/rechtstexte/agb.ts. Formen der Infoseiten (infoseite-stil.ts):
 * Fließtext leise, Überschriften in Fraunces, Links grün und unterstrichen.
 * Jede Überschrift trägt eine Sprungmarke und einen Abstand nach oben
 * (scroll-mt), damit die klebende Kopfzeile sie beim Springen nicht verdeckt.
 */

const STUECKE = { linkKlasse: INFOSEITE_LINK } as const

function Block({ block }: { block: AgbBlock }): React.JSX.Element {
  switch (block.art) {
    case 'absatz':
      return (
        <p>
          {block.nummer && (
            <>
              <span className="font-semibold text-foreground tabular-nums">{block.nummer}</span>{' '}
            </>
          )}
          <AgbStuecke stuecke={block.stuecke} {...STUECKE} />
        </p>
      )
    case 'liste':
      return (
        <ul className="list-disc space-y-1.5 pl-5 marker:text-muted-foreground">
          {block.eintraege.map((eintrag, i) => (
            <li key={i}>
              <AgbStuecke stuecke={eintrag} {...STUECKE} />
            </li>
          ))}
        </ul>
      )
    case 'tabelle':
      return (
        <Table className="text-[14px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {block.kopf.map((spalte, i) => (
                <TableHead key={i} className="h-auto px-0 py-2 pr-4 align-bottom whitespace-normal">
                  {spalte}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {block.zeilen.map((zeile, i) => (
              <TableRow key={i} className="hover:bg-transparent">
                {zeile.map((zelle, j) => (
                  <TableCell key={j} className="px-0 py-2.5 pr-4 align-top whitespace-normal">
                    {zelle}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )
    case 'zeilen':
      return (
        <p>
          {block.zeilen.map((zeile, i) => (
            <span key={i} className="block">
              <AgbStuecke stuecke={zeile} {...STUECKE} />
            </span>
          ))}
        </p>
      )
  }
}

function Punkt({ punkt }: { punkt: AgbPunkt }): React.JSX.Element {
  const anker = agbAnker(punkt.nummer)
  return (
    <section aria-labelledby={anker}>
      <h3 id={anker} className="mb-2 scroll-mt-20 font-heading text-[16px] leading-snug font-semibold text-foreground">
        {punkt.nummer}. {punkt.titel}
      </h3>
      <div className="flex flex-col gap-3">
        {punkt.bloecke.map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </div>
    </section>
  )
}

/** Ein Teil (A bis D) mit seinen Punkten. */
export function TeilAbschnitt({ teil }: { teil: AgbTeil }): React.JSX.Element {
  const anker = agbTeilAnker(teil.id)
  return (
    <section aria-labelledby={anker} className="border-t border-border pt-8">
      <h2 id={anker} className={cn(INFOSEITE_ABSCHNITT, 'scroll-mt-20 text-[20px]')}>
        {teil.titel}
      </h2>
      <div className="flex flex-col gap-8">
        {teil.punkte.map((punkt) => (
          <Punkt key={punkt.nummer} punkt={punkt} />
        ))}
      </div>
    </section>
  )
}

/** Der Anhang: das Muster-Rücktrittsformular, beim Drucken auf einer eigenen Seite. */
export function AnhangAbschnitt(): React.JSX.Element {
  return (
    <section aria-labelledby={AGB_ANHANG_ANKER} className="border-t border-border pt-8 print:break-before-page">
      <h2 id={AGB_ANHANG_ANKER} className={cn(INFOSEITE_ABSCHNITT, 'scroll-mt-20 text-[20px]')}>
        {AGB_ANHANG.titel}
      </h2>
      <div className="flex flex-col gap-3">
        {AGB_ANHANG.bloecke.map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </div>
    </section>
  )
}

/**
 * „Kurz erklärt": die Einleitung über den AGB, ausdrücklich kein Teil von
 * ihnen. Eine grüne Hinweiskarte, damit sie sich vom Vertragstext abhebt.
 */
export function KurzErklaert(): React.JSX.Element {
  return (
    <section aria-labelledby="kurz-erklaert">
      <Hinweiskarte ton="gruen" symbol={Info}>
        <h2 id="kurz-erklaert" className="scroll-mt-20 font-heading text-[16px] font-semibold">
          {AGB_KURZ_ERKLAERT.titel} <span className="font-sans text-[13.5px] font-normal">({AGB_KURZ_ERKLAERT.zusatz})</span>
        </h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 marker:text-muted-foreground">
          {AGB_KURZ_ERKLAERT.punkte.map((stuecke, i) => (
            <li key={i}>
              <AgbStuecke stuecke={stuecke} {...STUECKE} />
            </li>
          ))}
        </ul>
      </Hinweiskarte>
    </section>
  )
}

const VERZEICHNIS_LINK = cn(
  'flex min-h-11 items-baseline gap-2 rounded-md py-2.5 text-[14px] leading-snug text-foreground hover:text-brand-text',
  FOKUS_RAHMEN
)

/**
 * Das Inhaltsverzeichnis: ein Sprung je Punkt, nach Teilen gruppiert, und der
 * Anhang. Auf dem Papier fehlt es (print:hidden) — dort steht der Text fortlaufend.
 */
export function InhaltsVerzeichnis(): React.JSX.Element {
  return (
    <nav aria-labelledby="agb-inhalt" className="print:hidden">
      <h2 id="agb-inhalt" className={INFOSEITE_ABSCHNITT}>
        {AGB_SEITE_TEXT.inhalt}
      </h2>
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card px-4 py-3.5">
        {AGB_TEILE.map((teil) => (
          <div key={teil.id}>
            <p className="text-[13px] font-semibold text-foreground">{teil.titel}</p>
            <ol role="list" className="list-none sm:columns-2 sm:gap-x-8">
              {teil.punkte.map((punkt) => (
                <li key={punkt.nummer} className="break-inside-avoid">
                  <a href={`#${agbAnker(punkt.nummer)}`} className={VERZEICHNIS_LINK}>
                    <span className="w-6 shrink-0 text-right text-muted-foreground tabular-nums">{punkt.nummer}.</span>
                    <span>{punkt.titel}</span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        ))}
        <a href={`#${AGB_ANHANG_ANKER}`} className={cn(VERZEICHNIS_LINK, 'font-semibold')}>
          {AGB_ANHANG.titel}
        </a>
      </div>
    </nav>
  )
}
