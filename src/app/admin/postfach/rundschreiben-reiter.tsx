import { Send } from 'lucide-react'
import { ladeEmpfaengerHoefe, ladeRundschreibenListe, type GesendetesRundschreiben } from '@/server/queries/postfach'
import {
  ADMIN_POSTFACH_TEXT,
  POSTFACH_TEXT,
  RUNDSCHREIBEN_LEER,
  antwortenText,
  empfaengerText,
  empfaengerZahlen,
  lesequoteText,
  wannText,
  type EmpfaengerHof,
} from '@/lib/postfach'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { Marke } from '@/components/ui/marke'
import { ProgressBar } from '@/components/ui/progress-bar'
import { RundschreibenFormular } from './rundschreiben-formular'

const KARTE = 'rounded-2xl border border-border bg-card dark:ring-1 dark:ring-border'
const UEBERSCHRIFT = 'font-heading text-lg font-semibold text-foreground'

export type RundschreibenDaten = { gesendet: GesendetesRundschreiben[]; hoefe: EmpfaengerHof[] }

/** Die Daten des Reiters — wirft bei einem Datenbankfehler; die Seite zeigt dann AdminFehler. */
export async function ladeRundschreibenReiter(): Promise<RundschreibenDaten> {
  const [gesendet, hoefe] = await Promise.all([ladeRundschreibenListe(), ladeEmpfaengerHoefe()])
  return { gesendet, hoefe }
}

/*
 * Der Reiter „Rundschreiben" (Register N12, Nr. 87; Mockup
 * admin-rundschreiben): links „Gesendet" mit Lesequote („n von m gelesen")
 * und die Regeln, rechts „Neues Rundschreiben". Die Höfe für das Formular
 * kommen ohne Person und ohne E-Mail (ladeEmpfaengerHoefe), die Zahlen je
 * Filter rechnet die Regel aus lib/postfach.ts auf dem Server; welche Höfe
 * ein Rundschreiben trifft, rechnet beim Senden noch einmal der Server.
 * Abweichend vom Mockup ohne „Entwurf speichern" (in der Freigabe nicht
 * vorgesehen) und ohne Pfeil je Zeile (es gibt keine Detailseite). Seit
 * Nr. 95 (N14) steht je Zeile die Zahl der Antworten bzw. „keine Antwort
 * möglich", und das Formular hat den Haken „Antwort möglich".
 */
export function RundschreibenReiter({ daten, jetzt }: { daten: RundschreibenDaten; jetzt: Date }): React.JSX.Element {
  const zahlen = empfaengerZahlen(daten.hoefe, [])

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted-foreground">{ADMIN_POSTFACH_TEXT.rundschreibenHinweis}</p>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:gap-[18px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section aria-labelledby="rundschreiben-gesendet" className={cn(KARTE, 'flex flex-col overflow-hidden')}>
            <h2 id="rundschreiben-gesendet" className={cn(UEBERSCHRIFT, 'px-4 pt-3.5 pb-2')}>
              {ADMIN_POSTFACH_TEXT.gesendet}
            </h2>
            {daten.gesendet.length === 0 ? (
              <EmptyState
                symbol={Send}
                titel={RUNDSCHREIBEN_LEER.titel}
                satz={RUNDSCHREIBEN_LEER.satz}
                className="rounded-none border-0 py-8"
                ausweg={{ ohne: 'Das Formular „Neues Rundschreiben“ steht auf derselben Seite, ab 1024 px daneben, schmaler darunter' }}
              />
            ) : (
              <ul>
                {daten.gesendet.map((r) => (
                  <li key={r.id} className="flex flex-col gap-2 border-t border-border px-4 py-3">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <Marke art={r.wichtig ? 'tun' : 'laeuft'} className="shrink-0">
                            {r.wichtig ? POSTFACH_TEXT.wichtig : ADMIN_POSTFACH_TEXT.info}
                          </Marke>
                          <span className="truncate text-sm font-semibold text-foreground" title={r.titel}>
                            {r.titel}
                          </span>
                        </span>
                        <span className="text-[12.5px] text-muted-foreground">
                          {empfaengerText(r.empfaengerArt, r.empfaenger)} · {antwortenText(r.antworten, r.antwortMoeglich)}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{wannText(r.gesendetAm, jetzt)}</span>
                    </div>
                    <ProgressBar wert={r.gelesen} max={Math.max(r.empfaenger, 1)} beschriftung={lesequoteText(r.gelesen, r.empfaenger)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="rundschreiben-regeln" className={cn(KARTE, 'px-4 py-3.5')}>
            <h2 id="rundschreiben-regeln" className={UEBERSCHRIFT}>
              {ADMIN_POSTFACH_TEXT.regeln}
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{ADMIN_POSTFACH_TEXT.regelnText}</p>
          </section>
        </div>
        <section aria-labelledby="rundschreiben-neu" className={cn(KARTE, 'px-4 py-4 md:px-5')}>
          <h2 id="rundschreiben-neu" className={UEBERSCHRIFT}>
            {ADMIN_POSTFACH_TEXT.neuesRundschreiben}
          </h2>
          <RundschreibenFormular hoefe={daten.hoefe.map((h) => ({ id: h.id, name: h.name, ort: h.ort }))} zahlen={zahlen} />
        </section>
      </div>
    </div>
  )
}
