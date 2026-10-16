'use client'

import { useState } from 'react'
import { Check, Eye, History, Undo2 } from 'lucide-react'
import {
  ENTWURF_TEXT as E,
  abstandText,
  angelegtText,
  beschreibeFassung,
  planungKurz,
  standardFassung,
  terminTextMitJahr,
  verlaufZeitraum,
  vonText,
} from '@/lib/startseite-fassung'
import { cn } from '@/lib/utils'
import type { AdminFassung, AdminStartseite } from '@/server/queries/startseite'
import { Marke } from '@/components/ui/marke'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { KARTE, KNOPF_ORANGE_RAHMEN, KNOPF_RAHMEN, LEISE, TEXT_GRUEN } from '@/components/hof-bestellungen/stil'
import { UEBERSCHRIFT } from './startseite-block-formular'

/*
 * Zeitplan und Verlauf von Admin › Startseite (Register N16, Änderung Nr. 99;
 * Mockup admin-startseite-zeitplan): links eine Zeitleiste — geplante
 * Fassungen (Termin, wie weit weg, wer, was sie ändern, „Vorschau“,
 * „Zurückziehen“), die Live-Fassung („Ansehen“) und darunter der Verlauf
 * („Als Entwurf übernehmen“) —, rechts die Regel-Karte „So funktioniert’s“
 * wörtlich aus dem Mockup. „Verlauf“ zeigt nur den Verlauf. Zurückziehen und
 * Übernehmen fragen in der Zeile nach, kein Dialog.
 */

export type ZeitplanAktion =
  | { art: 'vorschau'; fassung: AdminFassung; geplant: boolean }
  | { art: 'ansehen-live' }
  | { art: 'zurueckziehen'; id: string }
  | { art: 'uebernehmen'; id: string }

const KICKER = 'mb-2 ml-8 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase'

function Punkt({ ton }: { ton: 'tun' | 'laeuft' | 'leise' }): React.JSX.Element {
  return (
    <span className="flex w-[18px] shrink-0 flex-col items-center" aria-hidden="true">
      <span
        className={cn(
          'mt-[18px] size-3.5 rounded-full',
          ton === 'tun' ? 'bg-status-offen' : ton === 'laeuft' ? 'bg-status-fertig' : 'bg-muted-foreground/45'
        )}
      />
      <span className="mt-1 w-0.5 flex-1 bg-border" />
    </span>
  )
}

function Nachfrage({
  frage,
  ja,
  laeuft,
  onJa,
  onNein,
}: {
  frage: string
  ja: string
  laeuft: boolean
  onJa: () => void
  onNein: () => void
}): React.JSX.Element {
  return (
    <div role="group" aria-label={frage} className="flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
      <p className="min-w-0 flex-1 text-[13px] font-medium text-foreground">{frage}</p>
      <button type="button" className={KNOPF_ORANGE_RAHMEN} disabled={laeuft} aria-busy={laeuft || undefined} onClick={onJa}>
        {laeuft ? 'Einen Moment …' : ja}
      </button>
      <button type="button" className={KNOPF_RAHMEN} disabled={laeuft} onClick={onNein}>
        {E.abbrechen}
      </button>
    </div>
  )
}

function Eintrag({
  ton,
  rahmen,
  kopf,
  zeilen,
  aktionen,
  nachfrage,
}: {
  ton: 'tun' | 'laeuft' | 'leise'
  rahmen: string
  kopf: React.ReactNode
  zeilen: readonly string[]
  aktionen: React.ReactNode
  nachfrage?: React.ReactNode
}): React.JSX.Element {
  return (
    <li className="flex gap-3.5">
      <Punkt ton={ton} />
      <div className={cn('mb-2.5 flex min-w-0 flex-1 flex-col gap-2.5 rounded-[14px] border bg-card px-4 py-3.5', rahmen)}>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">{kopf}</div>
            {zeilen.map((zeile, i) => (
              <p key={i} className={cn('mt-1 text-[13px] break-words', i === 0 ? 'text-[12.5px] text-muted-foreground' : 'text-foreground')}>
                {zeile}
              </p>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">{aktionen}</div>
        </div>
        {nachfrage}
      </div>
    </li>
  )
}

export function StartseiteZeitplan({
  daten,
  jetzt: jetztText,
  nurVerlauf,
  laeuft,
  fehler,
  onAktion,
}: {
  daten: AdminStartseite
  /** Der Zeitpunkt der Seite (ISO) — kein Date.now() beim Rendern. */
  jetzt: string
  nurVerlauf: boolean
  laeuft: boolean
  fehler: string | null
  onAktion: (aktion: ZeitplanAktion) => void
}): React.JSX.Element {
  const jetzt = new Date(jetztText)
  const [frage, setFrage] = useState<{ art: 'zurueckziehen' | 'uebernehmen'; id: string } | null>(null)
  const liveInhalt = daten.live?.inhalt ?? standardFassung()

  const verlauf = (
    <section aria-labelledby="verlauf-titel">
      <h2 id="verlauf-titel" className={cn(KICKER, !nurVerlauf && 'mt-2')}>
        {E.verlauf}
      </h2>
      {daten.frueher.length === 0 ? (
        <EmptyState symbol={History} titel={E.keinVerlauf} ausweg={{ ohne: 'Eine frühere Fassung entsteht erst, wenn eine neuere live geht.' }} />
      ) : (
        <ul>
          {daten.frueher.map((f) => (
            <Eintrag
              key={f.id}
              ton="leise"
              rahmen="border-border"
              kopf={
                <>
                  <StatusBadge status="neutral">{E.frueher}</StatusBadge>
                  <span className="text-[14.5px] font-semibold text-foreground">{verlaufZeitraum(f.liveAb, f.bis)}</span>
                </>
              }
              zeilen={[vonText(f), beschreibeFassung(f.inhalt)]}
              aktionen={
                <button type="button" className={TEXT_GRUEN} disabled={laeuft} onClick={() => setFrage({ art: 'uebernehmen', id: f.id })}>
                  <Undo2 className="size-4" strokeWidth={1.8} aria-hidden="true" />
                  {E.alsEntwurf}
                </button>
              }
              nachfrage={
                frage?.art === 'uebernehmen' && frage.id === f.id ? (
                  <Nachfrage
                    frage={E.alsEntwurfFrage}
                    ja={E.alsEntwurf}
                    laeuft={laeuft}
                    onJa={() => onAktion({ art: 'uebernehmen', id: f.id })}
                    onNein={() => setFrage(null)}
                  />
                ) : undefined
              }
            />
          ))}
        </ul>
      )}
    </section>
  )

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        {fehler && (
          <p role="alert" className="mb-3 rounded-xl border border-primary/45 bg-primary/12 px-3.5 py-2.5 text-[13px] font-medium text-foreground">
            {fehler}
          </p>
        )}
        {!nurVerlauf && (
          <section aria-labelledby="wann-live-titel">
            <h2 id="wann-live-titel" className={KICKER}>
              {E.wasWannLive}
            </h2>
            <ul>
              {[...daten.geplant].reverse().map((f) => {
                const index = daten.geplant.indexOf(f)
                const vorher = index > 0 ? daten.geplant[index - 1].inhalt : liveInhalt
                return (
                  <Eintrag
                    key={f.id}
                    ton="tun"
                    rahmen="border-primary/45"
                    kopf={
                      <>
                        <Marke art="tun">{E.geplant}</Marke>
                        <span className="text-[16px] font-semibold text-foreground">{terminTextMitJahr(new Date(f.liveAb))}</span>
                      </>
                    }
                    zeilen={[`${vonText(f)} · ${angelegtText(f.createdAt, jetzt)} · ${abstandText(new Date(f.liveAb), jetzt)}`, planungKurz(vorher, f.inhalt)]}
                    aktionen={
                      <>
                        <button type="button" className={TEXT_GRUEN} onClick={() => onAktion({ art: 'vorschau', fassung: f, geplant: true })}>
                          <Eye className="size-4" strokeWidth={1.8} aria-hidden="true" />
                          {E.vorschauKnopf}
                        </button>
                        <button type="button" className={KNOPF_RAHMEN} disabled={laeuft} onClick={() => setFrage({ art: 'zurueckziehen', id: f.id })}>
                          {E.zurueckziehen}
                        </button>
                      </>
                    }
                    nachfrage={
                      frage?.art === 'zurueckziehen' && frage.id === f.id ? (
                        <Nachfrage
                          frage={E.zurueckziehenFrage}
                          ja={E.zurueckziehen}
                          laeuft={laeuft}
                          onJa={() => onAktion({ art: 'zurueckziehen', id: f.id })}
                          onNein={() => setFrage(null)}
                        />
                      ) : undefined
                    }
                  />
                )
              })}
              <Eintrag
                ton="laeuft"
                rahmen="border-accent/60"
                kopf={
                  <>
                    <Marke art="laeuft">{E.live}</Marke>
                    <span className="text-[16px] font-semibold text-foreground">
                      {daten.live ? `seit ${terminTextMitJahr(new Date(daten.live.liveAb))}` : E.standard}
                    </span>
                  </>
                }
                zeilen={daten.live ? [vonText(daten.live), beschreibeFassung(daten.live.inhalt)] : [beschreibeFassung(liveInhalt)]}
                aktionen={
                  <button
                    type="button"
                    className={TEXT_GRUEN}
                    onClick={() => onAktion(daten.live ? { art: 'vorschau', fassung: daten.live, geplant: false } : { art: 'ansehen-live' })}
                  >
                    <Eye className="size-4" strokeWidth={1.8} aria-hidden="true" />
                    {E.ansehen}
                  </button>
                }
              />
            </ul>
          </section>
        )}
        {verlauf}
      </div>
      <aside aria-labelledby="regel-titel" className={cn(KARTE, 'flex w-full shrink-0 flex-col gap-2.5 p-[18px] lg:w-[400px]')}>
        <h2 id="regel-titel" className={UEBERSCHRIFT}>
          {E.regelTitel}
        </h2>
        <ul className="flex flex-col gap-2.5">
          {E.regeln.map((regel) => (
            <li key={regel} className="flex gap-2 text-[13px] leading-normal text-foreground">
              <Check className="mt-0.5 size-4 shrink-0 text-status-fertig" strokeWidth={1.8} aria-hidden="true" />
              <span className={cn('min-w-0', LEISE, 'text-foreground')}>{regel}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
