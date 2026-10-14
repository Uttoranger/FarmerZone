import Link from 'next/link'
import { MessagesSquare, CheckCheck } from 'lucide-react'
import { z } from 'zod'
import { ladeFadenAdmin, ladeUnterhaltungenAdmin, type AdminFaden, type AdminUnterhaltung } from '@/server/queries/postfach'
import {
  ADMIN_POSTFACH_TEXT,
  POSTFACH_ALLES_GELESEN,
  POSTFACH_TEXT,
  UNTERHALTUNGEN_LEER,
  adminPostfachAdresse,
  fadenEintraege,
  istNeuFuer,
  neuesteDerAnderenSeite,
  rundschreibenGelesen,
  wannText,
  type PostfachFilter,
} from '@/lib/postfach'
import { hofInitialen } from '@/lib/hof-initialen'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterChip, FilterChipReihe } from '@/components/ui/chip'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { FadenVerlauf } from '@/app/(hof)/postfach/teile'
import { TeamAntwort } from './team-antwort'
import { FadenGelesenTeam } from './faden-gelesen-team'

const KARTE = 'rounded-2xl border border-border bg-card dark:ring-1 dark:ring-border'

export type UnterhaltungenDaten = { liste: AdminUnterhaltung[]; faden: AdminFaden | null }

/**
 * Die Daten des Reiters — wirft bei einem Datenbankfehler; die Seite zeigt
 * dann AdminFehler. Der Faden kommt aus ?faden= (Zod: cuid), eine andere
 * Kennung öffnet nichts.
 */
export async function ladeUnterhaltungenReiter(fadenParameter: string | string[] | undefined): Promise<UnterhaltungenDaten> {
  const fadenId = z.cuid().safeParse(Array.isArray(fadenParameter) ? fadenParameter[0] : fadenParameter)
  const [liste, faden] = await Promise.all([ladeUnterhaltungenAdmin(), fadenId.success ? ladeFadenAdmin(fadenId.data) : Promise.resolve(null)])
  return { liste, faden }
}

/** Die Initialen eines Hofs als runde Plakette (Mockup admin-postfach) — Schmuck, der Name steht daneben. */
function HofPlakette({ name }: { name: string }): React.JSX.Element {
  return (
    <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-[13px] font-bold text-foreground">
      {hofInitialen(name)}
    </span>
  )
}

function Zeile({ u, aktiv, filter, jetzt }: { u: AdminUnterhaltung; aktiv: boolean; filter: PostfachFilter; jetzt: Date }): React.JSX.Element {
  return (
    <Link
      href={adminPostfachAdresse('unterhaltungen', { faden: u.id, filter: filter === 'ungelesen' ? 'ungelesen' : undefined })}
      aria-current={aktiv ? 'true' : undefined}
      scroll={false}
      className={cn('flex min-h-11 gap-3 px-3.5 py-3 transition-colors duration-[250ms] hover:bg-muted', aktiv && 'bg-muted', FOKUS_RAHMEN)}
    >
      <HofPlakette name={u.hofName} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={cn('truncate text-sm text-foreground', u.ungelesen ? 'font-bold' : 'font-medium')} title={u.hofName}>
            {u.hofName}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">{wannText(u.letzteAntwort.createdAt, jetzt)}</span>
        </span>
        <span className={cn('block truncate text-[13px]', u.ungelesen ? 'text-foreground' : 'text-muted-foreground')}>{u.letzteAntwort.text}</span>
        <span className="mt-1 flex max-w-full">
          <span className="truncate rounded-full border border-border bg-muted px-2 py-px text-[11px] text-foreground">
            {ADMIN_POSTFACH_TEXT.antwortAuf}: {u.titel ?? POSTFACH_TEXT.ohneTitel}
          </span>
        </span>
      </span>
      {u.ungelesen && (
        <span className="mt-1.5 size-[9px] shrink-0 rounded-full bg-primary">
          <span className="sr-only">{POSTFACH_TEXT.ungelesenSr}</span>
        </span>
      )}
    </Link>
  )
}

function Faden({ faden, jetzt }: { faden: AdminFaden; jetzt: Date }): React.JSX.Element {
  const eintraege = fadenEintraege(faden.nachrichten, 'TEAM', faden.gelesenBisAndere, jetzt)
  const neueste = neuesteDerAnderenSeite(faden.nachrichten, 'TEAM')
  const fuss = faden.rundschreiben
    ? [
        ADMIN_POSTFACH_TEXT.rundschreiben,
        faden.rundschreiben.wichtig ? POSTFACH_TEXT.wichtig : null,
        rundschreibenGelesen(faden.gelesenBisAndere, faden.rundschreiben.gesendetAm) ? ADMIN_POSTFACH_TEXT.gelesenVomHof : ADMIN_POSTFACH_TEXT.nochNichtGelesen,
      ]
        .filter((teil) => teil !== null)
        .join(' · ')
    : null
  return (
    <>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 md:px-5">
        <HofPlakette name={faden.hof.name} />
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-foreground" title={faden.hof.name}>
            {faden.hof.name}
          </h2>
          <p className="truncate text-[12.5px] text-muted-foreground">{faden.hof.ort}</p>
        </div>
      </div>
      <div className="flex flex-col gap-3 px-4 py-4 md:px-5">
        {faden.rundschreiben && (
          <p className="self-center text-[11.5px] text-muted-foreground">
            {wannText(faden.rundschreiben.gesendetAm, jetzt)} · {ADMIN_POSTFACH_TEXT.rundschreibenAn(faden.rundschreiben.empfaenger)}
          </p>
        )}
        <FadenVerlauf eintraege={eintraege} seite="TEAM" fussErste={fuss} nameAndereSeite={null} />
      </div>
      <div className="border-t border-border px-4 py-3 md:px-5">
        <TeamAntwort unterhaltungId={faden.id} hofName={faden.hof.name} />
      </div>
      <FadenGelesenTeam
        unterhaltungId={faden.id}
        nachrichtId={neueste?.id ?? null}
        ungelesen={neueste !== null && istNeuFuer('TEAM', neueste, faden.gelesenBisEigene)}
      />
    </>
  )
}

/*
 * Der Reiter „Unterhaltungen" (Register N12, Nr. 87; Mockup admin-postfach):
 * links die Fäden, in denen ein Hof geantwortet hat (Alle/Ungelesen, Zeile =
 * Hof, letzte Antwort, „Antwort auf: <Titel>"), rechts der gewählte Faden
 * mit Antwortfeld. Gewählt wird über ?faden= (Zod: cuid) — abweichend vom
 * Mockup öffnet nichts von selbst: Öffnen setzt den Lesestand des Teams, und
 * eine Antwort soll nicht als gelesen gelten, nur weil sie oben stand.
 * Ohne „Hof öffnen" und ohne Namen der Person, Tarif und Bestellzahl im Kopf
 * (Bericht 87): Es gibt keine Admin-Seite eines einzelnen Hofs.
 */
export function UnterhaltungenReiter({
  filter,
  daten: { liste, faden },
  jetzt,
}: {
  filter: PostfachFilter
  daten: UnterhaltungenDaten
  jetzt: Date
}): React.JSX.Element {
  const ungelesen = liste.filter((u) => u.ungelesen)
  const zeilen = filter === 'ungelesen' ? ungelesen : liste

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-[18px]">
      <section aria-label={ADMIN_POSTFACH_TEXT.listeBeschriftung} className={cn(KARTE, 'flex min-w-0 flex-col overflow-hidden')}>
        {liste.length === 0 ? (
          <EmptyState
            symbol={MessagesSquare}
            titel={UNTERHALTUNGEN_LEER.titel}
            satz={UNTERHALTUNGEN_LEER.satz}
            className="rounded-none border-0 py-8"
            aktion={
              <Link
                href={adminPostfachAdresse('rundschreiben')}
                className={cn('inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-semibold hover:bg-muted', FOKUS_RAHMEN)}
              >
                {ADMIN_POSTFACH_TEXT.neuesRundschreiben}
              </Link>
            }
          />
        ) : (
          <>
            <FilterChipReihe beschriftung={POSTFACH_TEXT.filterBeschriftung} className="px-3.5 pt-3 pb-2 md:px-3.5">
              <FilterChip href={adminPostfachAdresse('unterhaltungen')} aktiv={filter === 'alle'}>
                {POSTFACH_TEXT.alle} · {liste.length}
              </FilterChip>
              <FilterChip href={adminPostfachAdresse('unterhaltungen', { filter: 'ungelesen' })} aktiv={filter === 'ungelesen'}>
                {POSTFACH_TEXT.ungelesen} · {ungelesen.length}
              </FilterChip>
            </FilterChipReihe>
            {zeilen.length === 0 ? (
              <EmptyState
                symbol={CheckCheck}
                titel={POSTFACH_ALLES_GELESEN.titel}
                className="rounded-none border-0 py-8"
                aktion={
                  <Link
                    href={adminPostfachAdresse('unterhaltungen')}
                    className={cn('inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-semibold hover:bg-muted', FOKUS_RAHMEN)}
                  >
                    {POSTFACH_ALLES_GELESEN.ausweg}
                  </Link>
                }
              />
            ) : (
              <ul>
                {zeilen.map((u) => (
                  <li key={u.id} className="border-t border-border">
                    <Zeile u={u} aktiv={faden?.id === u.id} filter={filter} jetzt={jetzt} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <p className="mt-auto border-t border-border px-3.5 py-2.5 text-xs text-muted-foreground">{ADMIN_POSTFACH_TEXT.unterhaltungenHinweis}</p>
      </section>

      <section aria-label={ADMIN_POSTFACH_TEXT.fadenBeschriftung} className={cn(KARTE, 'flex min-w-0 flex-col overflow-hidden')}>
        {faden ? <Faden faden={faden} jetzt={jetzt} /> : <p className="px-5 py-10 text-center text-sm text-muted-foreground">{ADMIN_POSTFACH_TEXT.waehlen}</p>}
      </section>
    </div>
  )
}
