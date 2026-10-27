import Link from 'next/link'
import { Info } from 'lucide-react'
import { type AdminFaden } from '@/server/queries/postfach'
import {
  ADMIN_POSTFACH_TEXT,
  POSTFACH_TEXT,
  fadenEintraege,
  istNeuFuer,
  neuesteDerAnderenSeite,
  rundschreibenGelesen,
  wannText,
} from '@/lib/postfach'
import { hofInitialen } from '@/lib/hof-initialen'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { FadenVerlauf } from '@/app/(hof)/postfach/teile'
import { TeamAntwort } from './team-antwort'
import { FadenGelesenTeam } from './faden-gelesen-team'

/** Die Initialen eines Hofs als runde Plakette (Mockup admin-postfach) — Schmuck, der Name steht daneben. */
export function HofPlakette({ name }: { name: string }): React.JSX.Element {
  return (
    <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-[13px] font-bold text-foreground">
      {hofInitialen(name)}
    </span>
  )
}

/** Hat der Hof ein Signal (hofSignale), steht es als Hinweis aus der Akte im Faden (N32, Nr. 193). */
export type AkteHinweis = { signale: string[]; href: string }

/** „Hinweis aus der Akte: Hof Muster – ohne Abholzeit.“ — Text und Link zur Akte (Mockup admin-postfach-gespraeche). */
export function akteHinweisText(hofName: string, signale: readonly string[]): string {
  return `Hinweis aus der Akte: ${hofName} – ${signale.join(', ')}.`
}

export const AKTE_OEFFNEN = 'Akte öffnen'

/*
 * Der Faden einer Antwort im Eingang (Register N12, Nr. 87; seit Nr. 95 die
 * rechte Spalte des Eingangs, Mockup admin-postfach-unterhaltungen): Kopf mit
 * Hof und Ort, der Verlauf, das Antwortfeld. Öffnen setzt den Lesestand des
 * Teams (FadenGelesenTeam, nach dem Rendern über die Action) — deshalb öffnet
 * nichts von selbst. Ohne „Hof öffnen" und ohne Namen der Person (Bericht 87).
 * Seit Nr. 193 über dem Antwortfeld der Hinweis aus der Akte, wenn der Hof ein
 * Signal hat — als Satz mit Symbol, nie nur als Farbe.
 */
export function FadenSpalte({ faden, akte = null, jetzt }: { faden: AdminFaden; akte?: AkteHinweis | null; jetzt: Date }): React.JSX.Element {
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
            {faden.hof.name} · {faden.titel ?? POSTFACH_TEXT.ohneTitel}
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
        {akte && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-primary/45 bg-primary/12 px-3.5 py-2 text-[13px] leading-snug text-foreground">
            <span className="flex min-w-0 flex-1 items-start gap-2">
              <Info className="mt-0.5 size-4 shrink-0 text-status-offen" strokeWidth={1.8} aria-hidden="true" />
              <span className="min-w-0 break-words">{akteHinweisText(faden.hof.name, akte.signale)}</span>
            </span>
            <Link href={akte.href} className={cn('inline-flex min-h-11 items-center rounded-md font-semibold text-status-fertig underline underline-offset-2', FOKUS_RAHMEN)}>
              {AKTE_OEFFNEN}
            </Link>
          </p>
        )}
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
