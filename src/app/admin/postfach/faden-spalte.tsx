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

/*
 * Der Faden einer Antwort im Eingang (Register N12, Nr. 87; seit Nr. 95 die
 * rechte Spalte des Eingangs, Mockup admin-postfach-unterhaltungen): Kopf mit
 * Hof und Ort, der Verlauf, das Antwortfeld. Öffnen setzt den Lesestand des
 * Teams (FadenGelesenTeam, nach dem Rendern über die Action) — deshalb öffnet
 * nichts von selbst. Ohne „Hof öffnen" und ohne Namen der Person (Bericht 87).
 */
export function FadenSpalte({ faden, jetzt }: { faden: AdminFaden; jetzt: Date }): React.JSX.Element {
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
