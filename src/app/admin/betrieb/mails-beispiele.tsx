'use client'

import { useState, useTransition } from 'react'
import * as Sentry from '@sentry/nextjs'
import { zeigeMailBeispielAction } from '@/server/actions/betrieb'
import { istNetzfehler } from '@/lib/upload-diagnose'
import type { MailBeispielId } from '@/lib/betrieb-mails'
import { cn } from '@/lib/utils'
import { KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { VorschauRahmen } from './mails-nochmal'

/*
 * „Beispiele“ in Admin › Betrieb › Mails (Register N48, Nr. 270): je Mail-Art
 * „Beispiel ansehen“. Die Mail baut erst der Knopf (Action, nur lesend, feste
 * erfundene Daten); gezeigt wird sie im abgeschotteten Rahmen der Vorschau
 * (`VorschauRahmen`, ohne Skripte). Namen und Sätze kommen vom Server.
 */

/** `label` nennt die Art im Knopf für Screenreader („Beispiel ansehen: Anmeldecode“) — fertig vom Server, Funktionen gehen nicht an den Client. */
export type BeispielGruppeAnzeige = { id: string; name: string; beispiele: readonly { id: MailBeispielId; name: string; label: string }[] }
export type BeispieleTexte = { knopf: string; schliessen: string; betreff: string; fehler: string }

/** Fremde Fehler nach Sentry: nur die Klasse unter festem Satz, ein Netzabbruch nur als Brotkrume (Muster mails-nochmal). */
function meldeGescheitert(fehler: unknown): void {
  try {
    const klasse = fehler instanceof Error && /^[A-Za-z][A-Za-z0-9_]{0,59}$/.test(fehler.name) ? fehler.name : 'Unbekannt'
    if (istNetzfehler(fehler)) {
      Sentry.addBreadcrumb({ category: 'betrieb', level: 'warning', message: 'Beispiele: Verbindung abgebrochen', data: { klasse } })
    } else {
      const ereignis = new Error('Betrieb: Beispiel einer Mail gescheitert')
      ereignis.name = klasse
      Sentry.captureException(ereignis, { level: 'error', tags: { bereich: 'betrieb', klasse } })
    }
  } catch {
    // Telemetrie scheitert leise.
  }
}

type Offen = { id: MailBeispielId; titel: string; betreff: string; html: string }

export function MailBeispiele({ gruppen, texte }: { gruppen: readonly BeispielGruppeAnzeige[]; texte: BeispieleTexte }): React.JSX.Element {
  const [offen, setOffen] = useState<Offen | null>(null)
  const [fehler, setFehler] = useState<{ id: MailBeispielId; satz: string } | null>(null)
  const [laeuft, starte] = useTransition()

  const zeige = (id: MailBeispielId): void => {
    starte(async () => {
      try {
        const antwort = await zeigeMailBeispielAction({ beispiel: id })
        if ('error' in antwort) {
          setOffen(null)
          setFehler({ id, satz: antwort.error })
        } else {
          setFehler(null)
          setOffen({ id, titel: antwort.titel, betreff: antwort.betreff, html: antwort.html })
        }
      } catch (err) {
        setOffen(null)
        setFehler({ id, satz: texte.fehler })
        meldeGescheitert(err)
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {gruppen.map((g) => (
        <section key={g.id} aria-labelledby={`beispiele-${g.id}`} className="flex flex-col gap-1.5">
          <h3 id={`beispiele-${g.id}`} className="text-[14px] font-semibold text-foreground">
            {g.name}
          </h3>
          <ul className="flex flex-col divide-y divide-border">
            {g.beispiele.map((b) => (
              <li key={b.id} className="flex flex-col gap-2 py-2">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="min-w-0 flex-1 text-[13.5px] text-foreground">{b.name}</span>
                  {offen?.id === b.id ? (
                    <button type="button" onClick={() => setOffen(null)} className={cn(KNOPF_RAHMEN, 'font-semibold')}>
                      {texte.schliessen}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => zeige(b.id)}
                      disabled={laeuft}
                      aria-busy={laeuft}
                      aria-label={b.label}
                      className={cn(KNOPF_RAHMEN, 'font-semibold')}
                    >
                      {texte.knopf}
                    </button>
                  )}
                </div>
                {fehler?.id === b.id && (
                  <p role="status" className="text-[12.5px] leading-snug text-foreground">
                    {fehler.satz}
                  </p>
                )}
                {offen?.id === b.id && (
                  <div className="flex flex-col gap-2">
                    <p className="text-[13px] leading-snug break-words text-foreground">
                      <span className={LEISE}>{texte.betreff}: </span>
                      <span className="font-semibold">{offen.betreff}</span>
                    </p>
                    <VorschauRahmen titel={offen.titel} html={offen.html} className="h-[640px]" />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
