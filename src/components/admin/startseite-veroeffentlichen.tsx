'use client'

import { useId, useState } from 'react'
import { CalendarDays, Clock, Info } from 'lucide-react'
import { tagVersetzt } from '@/lib/kalender'
import { kalendertagInWien } from '@/lib/wiener-tag'
import { zeitpunktAusEingabe } from '@/lib/startseite-gestalten'
import { STARTSEITE_SAETZE } from '@/schemas/startseite'
import {
  AENDERUNG_TEXT,
  ENTWURF_TEXT as E,
  TERMIN_HOECHSTENS_TAGE,
  aenderungSatz,
  blockHinweise,
  veroeffentlichenKnopf,
  zurueckziehenBisText,
  type Aenderung,
} from '@/lib/startseite-fassung'
import type { FassungInhalt, VeroeffentlichenEingabe } from '@/schemas/startseite-fassung'
import { cn } from '@/lib/utils'
import { BestellDialog, DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { KARTE, LEISE, FELD, FELD_LABEL } from '@/components/hof-bestellungen/stil'

/*
 * „Entwurf veröffentlichen" (Register N16, Änderung Nr. 99; Mockup
 * admin-startseite-veroeffentlichen): ab 768 px ein Dialog, am Handy ein Blatt
 * (BestellDialog). Die Änderungen gegenüber live, „Wann?" als Radiogruppe
 * Jetzt · Zu einem Zeitpunkt mit Datum und Uhrzeit (Schritt 5 Minuten, Wiener
 * Zeit) und die Hinweise auf Blöcke mit eigenem Zeitraum. Der Knopf nennt den
 * Termin. Umrechnung und Prüfung macht der Server noch einmal
 * (veroeffentlicheStartseite) — hier nur, damit Knopf und Hinweise stimmen.
 */

export function AenderungsListe({ aenderungen }: { aenderungen: readonly Aenderung[] }): React.JSX.Element {
  return (
    <div className={cn(KARTE, 'flex flex-col gap-2 px-4 py-3.5')}>
      <h3 className="text-[14px] font-semibold text-foreground">{E.aenderungenTitel}</h3>
      {aenderungen.length === 0 ? (
        <p className={cn('text-[13px]', LEISE)}>{E.keineAenderungen}</p>
      ) : (
        <dl className="flex flex-col gap-1.5">
          {aenderungen.map((a, i) => (
            <div key={`${a.art}-${a.schluessel}-${i}`} className="flex gap-2.5 text-[13px] leading-[1.45]">
              <dt className="w-[92px] shrink-0 font-semibold text-status-offen">{AENDERUNG_TEXT[a.art]}</dt>
              <dd className="min-w-0 break-words text-foreground">{aenderungSatz(a)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

function Wahl({
  name,
  wert,
  gewaehlt,
  titel,
  satz,
  onWahl,
}: {
  name: string
  wert: 'jetzt' | 'termin'
  gewaehlt: boolean
  titel: string
  satz: string
  onWahl: () => void
}): React.JSX.Element {
  return (
    <label
      className={cn(
        'flex min-h-11 cursor-pointer gap-3 rounded-xl border px-3.5 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
        gewaehlt ? 'border-accent bg-accent/10' : 'border-border hover:bg-muted'
      )}
    >
      <input type="radio" name={name} value={wert} checked={gewaehlt} onChange={onWahl} className="mt-0.5 size-5 shrink-0 accent-accent" />
      <span className="min-w-0">
        <span className="block text-[14.5px] font-semibold text-foreground">{titel}</span>
        <span className={cn('mt-0.5 block text-[12.5px]', LEISE)}>{satz}</span>
      </span>
    </label>
  )
}

export function VeroeffentlichenDialog({
  offen,
  onOffenChange,
  aenderungen,
  entwurf,
  jetzt,
  laeuft,
  fehler,
  onVeroeffentlichen,
}: {
  offen: boolean
  onOffenChange: (offen: boolean) => void
  aenderungen: readonly Aenderung[]
  entwurf: FassungInhalt
  /** Der Zeitpunkt der Seite (ISO) — kein Date.now() beim Rendern. */
  jetzt: string
  laeuft: boolean
  fehler: string | null
  onVeroeffentlichen: (eingabe: VeroeffentlichenEingabe) => void
}): React.JSX.Element {
  const id = useId()
  const heute = kalendertagInWien(new Date(jetzt))
  const [wann, setWann] = useState<'jetzt' | 'termin'>('jetzt')
  // Vorschlag: morgen um 9 Uhr Wiener Zeit.
  const [datum, setDatum] = useState(() => tagVersetzt(heute, 1))
  const [uhrzeit, setUhrzeit] = useState('09:00')
  const termin = wann === 'termin' ? zeitpunktAusEingabe(datum, uhrzeit) : null
  const terminFehlt = wann === 'termin' && termin === null
  const hinweise = termin ? blockHinweise(entwurf, termin) : []

  return (
    <BestellDialog
      offen={offen}
      onOffenChange={onOffenChange}
      titel={E.dialogTitel}
      unterzeile={E.dialogSatz}
      breite="breit"
      hauptaktion={{
        text: veroeffentlichenKnopf(termin),
        ton: 'gruen',
        laeuft,
        gesperrt: terminFehlt || aenderungen.length === 0,
        onClick: () => onVeroeffentlichen(wann === 'jetzt' ? { wann: 'jetzt' } : { wann: 'termin', datum, uhrzeit }),
      }}
    >
      <AenderungsListe aenderungen={aenderungen} />
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-2 text-[13px] font-semibold text-muted-foreground">{E.wann}</legend>
        <Wahl name={`${id}-wann`} wert="jetzt" gewaehlt={wann === 'jetzt'} titel={E.jetzt} satz={E.jetztSatz} onWahl={() => setWann('jetzt')} />
        <Wahl name={`${id}-wann`} wert="termin" gewaehlt={wann === 'termin'} titel={E.termin} satz={E.terminSatz} onWahl={() => setWann('termin')} />
        {wann === 'termin' && (
          <div className="flex flex-wrap items-end gap-3 pt-1 sm:pl-[46px]">
            <div className="flex w-[190px] max-w-full flex-col">
              <label htmlFor={`${id}-datum`} className={cn(FELD_LABEL, 'flex items-center gap-1.5')}>
                <CalendarDays className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                {E.datum}
              </label>
              <input
                id={`${id}-datum`}
                type="date"
                className={cn(FELD, 'min-h-11')}
                value={datum}
                min={heute}
                max={tagVersetzt(heute, TERMIN_HOECHSTENS_TAGE)}
                onChange={(e) => setDatum(e.target.value)}
              />
            </div>
            <div className="flex w-[130px] flex-col">
              <label htmlFor={`${id}-uhrzeit`} className={cn(FELD_LABEL, 'flex items-center gap-1.5')}>
                <Clock className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                {E.uhrzeit}
              </label>
              <input
                id={`${id}-uhrzeit`}
                type="time"
                step={300}
                className={cn(FELD, 'min-h-11')}
                value={uhrzeit}
                aria-describedby={`${id}-zone`}
                onChange={(e) => setUhrzeit(e.target.value)}
              />
            </div>
            <span id={`${id}-zone`} className={cn('pb-3 text-[12px]', LEISE)}>
              {E.wienerZeit}
            </span>
          </div>
        )}
        {terminFehlt && (
          <p role="alert" className="text-[13px] font-medium text-destructive">
            {STARTSEITE_SAETZE.umstellung}
          </p>
        )}
      </fieldset>
      {hinweise.map((hinweis) => (
        <p key={hinweis} className="flex gap-2.5 rounded-xl border border-primary/35 bg-primary/10 px-3.5 py-3 text-[12.5px] leading-normal text-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-status-offen" strokeWidth={1.8} aria-hidden="true" />
          {hinweis}
        </p>
      ))}
      <DialogFehler text={fehler} />
      {termin && <p className={cn('text-right text-[12px]', LEISE)}>{zurueckziehenBisText(termin)}</p>}
    </BestellDialog>
  )
}
