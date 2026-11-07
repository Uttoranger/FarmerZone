'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Phone, Printer } from 'lucide-react'
import {
  markAsNotPickedUp,
  markAsPickedUp,
  markAsPickedUpAndPaid,
  markAsReady,
  revertOrderStatus,
  revertPickedUp,
  revertReady,
} from '@/server/actions/orders'
import { aktionOhneWurf } from '@/components/mein-hof/abschnitt-speichern'
import type { HofBestellDetail } from '@/server/queries/orders'
import { StatusBadge } from '@/components/ui/status-badge'
import { Marke } from '@/components/ui/marke'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { textlinkKlassen } from '@/components/ui/textlink'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { centsAlsEuro } from '@/lib/servicegebuehr'
import { gebuehrBezeichnungFuer, gebuehrErstattungOffenHinweisFuer } from '@/lib/plattformgebuehr'
import { betragSatz, modellDerBestellung } from '@/lib/hof-bestellungen'
import { formatEuro } from '@/lib/format'
import { PROBLEM_MELDEN, PROBLEM_MELDEN_HOF } from '@/lib/fehlerseite'
import { formatiereTelefon, telefonLink } from '@/lib/telefon-anzeige'
import { cn } from '@/lib/utils'
import { BestellDialog, DialogFehler } from './bestell-dialog'
import { StornoDialog } from './storno-dialog'
import { ArtikelFehltDialog } from './artikel-fehlt-dialog'
import { WiderrufKarte } from './widerruf-karte'
import type { HofWiderruf } from '@/server/widerruf'
import { WerkzeugKopf } from '@/components/ui/werkzeug-kopf'
import { AbspracheKnoepfe, AbspracheMarke } from '@/components/heute/absprache'
import { RUNDUNG } from '@/components/ui/rundung'
import type { Positionszeile } from '@/lib/positionszeile'
import { KARTE, KICKER, KNOPF_ORANGE, KNOPF_RAHMEN, LEISE, TEXT_ORANGE } from './stil'

const euro = (cents: number): string => formatEuro(centsAlsEuro(cents))

type Offen = 'storno' | 'fehlt' | 'nichtAbgeholt' | 'dochNicht' | 'abholungZurueck' | null

/** Ein Knopf der festen Leiste bzw. ein Eintrag unter „Weitere Aktionen …“. */
type Aktion = { schluessel: string; text: string; onClick: () => void }

// Die feste Leiste unten (Boards s1-/w1-bestellung): Hauptaktion orange, die anderen als Umriss, 52 bzw. 48 px.
const LEISTE_HAUPT = cn(KNOPF_ORANGE, 'min-h-[52px] w-full rounded-[14px] text-[15px] font-bold md:w-auto md:min-w-[196px] md:px-5')
const LEISTE_NEBEN = cn(KNOPF_RAHMEN, 'min-h-12 w-full rounded-[14px] border-foreground/60 bg-card px-3 font-semibold md:w-auto md:min-w-[172px]')
// „Abholung rückgängig“ ist eine Nebenaktion (N1: eine Hauptaktion je Ansicht) — Textknopf statt orangem Knopf
// (Liste Lauf 32, bestellung Bild 4) — in Textfarbe wie im Board, nicht orange (Nr. 249b).
const LEISTE_TEXT = cn(TEXT_ORANGE, 'min-h-12 w-full px-5 text-[16px] font-semibold text-foreground md:w-auto')

/**
 * Die Bestellung (Boards s1-/w1-bestellung, Lauf 31). Zwei Ansichten aus
 * derselben Quelle, damit Knöpfe und Rückmeldungen nur einmal geschrieben sind:
 *
 * - `voll` (/orders/[orderId], jede Breite): Name und Marke, Abholung, der
 *   Satz zur Bestellnummer, darunter links Betrag und Packliste (Kästchen je
 *   Position, „Packliste · 1 von 3“), rechts ab 1024 px die Kundin; unten
 *   eine feste Leiste mit der Hauptaktion, einem zweiten Knopf und „Weitere
 *   Aktionen …“ (Menü mit dem Rest).
 * - `kompakt` (/orders ab 1024 px rechts neben der Liste, Board w1-
 *   bestellungen): Name, Marke, Nummer und Abholung, der Betrag in einer
 *   Zeile, der Satz dazu, die Artikel, die Hauptaktion über die volle Breite
 *   und „Ganze Bestellung öffnen →“.
 *
 * Welche Knöpfe es gibt, entscheidet der Server (bestellAktionen); Beträge
 * kommen in Cent. Das Abhaken der Packliste ist eine Hilfe beim Packen und
 * lebt nur in diesem Fenster — gespeichert wird „gepackt" mit „Als gepackt
 * markieren".
 */
export function BestellDetail({
  bestellung,
  zurueckSuche,
  widerrufe = [],
  barFrist = null,
  geldsatz = null,
  ansicht = 'voll',
}: {
  bestellung: HofBestellDetail
  /** Der Geldsatz nach V1 unter dem Betrag (ladeBestellGeldsatz) — null: der Satz der Seite (betragSatz). */
  geldsatz?: string | null
  /** Bar-Bestellung mit „Bestätigung offen“: bis wann die Kundin bestätigt (bestaetigungOffenSatz, aus fristVon). */
  barFrist?: string | null
  /** Offene Widerrufe dieser Bestellung (Nr. 200) — Knöpfe „Rückgabe erhalten – erstatten …“ und „Ablehnen …“. */
  widerrufe?: readonly HofWiderruf[]
  /** Der gewählte Filter der Liste (`?filter=…` oder leer) — der Rückweg führt mit ihm zurück. */
  zurueckSuche: string
  /** voll = eigene Seite der Bestellung; kompakt = Vorschau neben der Liste (/orders ab 1024 px). */
  ansicht?: 'voll' | 'kompakt'
}): React.JSX.Element {
  // Gepackt oder abgeholt: alles ist schon in der Tasche (Board s1-bestellung Bild 2 und 4: „Packliste · 3 von 3“).
  const schonGepackt = bestellung.status === 'READY' || bestellung.status === 'PICKED_UP'
  const [abgehakt, setAbgehakt] = useState<ReadonlySet<string>>(() =>
    schonGepackt ? new Set(bestellung.positionen.filter((p) => !p.fehlt).map((p) => p.id)) : new Set()
  )
  const [offen, setOffen] = useState<Offen>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [kundinInformieren, setKundinInformieren] = useState(true)
  const router = useRouter()
  const [laeuft, starte] = useTransition()
  const { aktionen, betrag, kunde } = bestellung
  const anrufen = telefonLink(kunde.telefon)

  const vorhanden = bestellung.positionen.filter((p) => !p.fehlt)
  const zumPacken = aktionen.packen || aktionen.abgeholt || aktionen.abgeholtBezahlt
  const erledigtZahl = vorhanden.filter((p) => abgehakt.has(p.id)).length

  function hakeUm(id: string) {
    setAbgehakt((alt) => {
      const neu = new Set(alt)
      if (neu.has(id)) neu.delete(id)
      else neu.add(id)
      return neu
    })
  }

  /** Statuswechsel mit „Rückgängig" im Hinweis (Haus-Muster bestellungen-undo). */
  function wechsle(aktion: (id: string) => Promise<{ error?: string }>, erfolg: string) {
    setFehler(null)
    const vorher = bestellung.status
    starte(async () => {
      // Ohne Wurf (Register N29): Ohne Netz steht der Netzsatz am Knopf, nicht die Fehlerseite.
      const ergebnis = await aktionOhneWurf(() => aktion(bestellung.id), { unsicher: true })
      if (ergebnis.error) {
        setFehler(ergebnis.error)
        return
      }
      // Board s1-bestellung Bild 2: ein ruhiger Balken „Als gepackt markiert · Rückgängig“ — kein grüner Erfolgskasten.
      toast(erfolg, {
        duration: 6000,
        action: {
          label: 'Rückgängig',
          onClick: () => {
            void aktionOhneWurf(() => revertOrderStatus(bestellung.id, vorher), { unsicher: true }).then((r) => {
              if (r.error) toast.error(r.error)
              else toast('Zurückgesetzt')
            })
          },
        },
      })
    })
  }

  function nichtAbgeholt() {
    setFehler(null)
    starte(async () => {
      const ergebnis = await aktionOhneWurf(() => markAsNotPickedUp(bestellung.id), { unsicher: true })
      if (ergebnis.error) {
        setFehler(ergebnis.error)
        return
      }
      setOffen(null)
      if (ergebnis.gebuehrErstattungOffen) {
        // Der Weg steht am Toast: „bitte den Betreiber informieren" sagte nicht, wie.
        toast.warning(`Als nicht abgeholt gespeichert. Die Erstattung der ${gebuehrWortFuer(bestellung.betrag)} hat nicht geklappt.`, {
          duration: 10000,
          action: { label: PROBLEM_MELDEN, onClick: () => router.push(PROBLEM_MELDEN_HOF) },
        })
      } else {
        toast('Als nicht abgeholt gespeichert')
      }
    })
  }

  function rueckweg(art: 'dochNicht' | 'abholungZurueck') {
    setFehler(null)
    starte(async () => {
      const ergebnis = await aktionOhneWurf(() => (art === 'dochNicht' ? revertReady(bestellung.id, kundinInformieren) : revertPickedUp(bestellung.id)), { unsicher: true })
      if (ergebnis.error) {
        setFehler(ergebnis.error)
        return
      }
      setOffen(null)
      toast(art === 'dochNicht' ? 'Zurück zum Packen' : 'Zurück zu Gepackt')
    })
  }

  function oeffneRueckweg(art: 'dochNicht' | 'abholungZurueck') {
    setKundinInformieren(true)
    setOffen(art)
  }

  const hauptaktion = aktionen.packen
    ? { text: 'Als gepackt markieren', onClick: () => wechsle(markAsReady, 'Als gepackt markiert') }
    : aktionen.abgeholt
      ? { text: 'Abgeholt', onClick: () => wechsle(markAsPickedUp, 'Als abgeholt gespeichert') }
      : aktionen.abgeholtBezahlt
        ? { text: `Abgeholt und ${euro(betrag.gesamtCents)} kassiert`, onClick: () => wechsle(markAsPickedUpAndPaid, 'Als abgeholt und bezahlt gespeichert') }
        : null

  // Was es außer der Hauptaktion gibt, in der Reihenfolge der Boards: beim Packen zuerst „Artikel fehlt“,
  // nach dem Packen zuerst „Nicht abgeholt“ (die Kundin ist da oder kommt nicht); der Rest unter „Weitere Aktionen …“.
  const neben: Aktion[] = []
  const fehltAktion: Aktion = { schluessel: 'fehlt', text: 'Artikel fehlt', onClick: () => setOffen('fehlt') }
  const nichtAbgeholtAktion: Aktion = { schluessel: 'nicht-abgeholt', text: 'Nicht abgeholt', onClick: () => setOffen('nichtAbgeholt') }
  if (aktionen.packen) {
    if (aktionen.artikelFehlt) neben.push(fehltAktion)
    if (aktionen.nichtAbgeholt) neben.push(nichtAbgeholtAktion)
  } else {
    if (aktionen.nichtAbgeholt) neben.push(nichtAbgeholtAktion)
    if (aktionen.artikelFehlt) neben.push(fehltAktion)
  }
  if (aktionen.dochNichtGepackt) neben.push({ schluessel: 'doch-nicht', text: 'Doch nicht gepackt', onClick: () => oeffneRueckweg('dochNicht') })
  if (aktionen.stornieren) neben.push({ schluessel: 'storno', text: 'Stornieren …', onClick: () => setOffen('storno') })
  // Ohne Hauptaktion (abgeholt) steht der Rückweg selbst in der Leiste (Board Bild 4: „Abholung rückgängig“).
  const leisteHaupt = hauptaktion ?? null
  const leisteRueckweg = !hauptaktion && aktionen.abholungZurueck ? { text: 'Abholung rückgängig', onClick: () => oeffneRueckweg('abholungZurueck') } : null
  const [zweite, ...weitere] = neben
  // „Nicht abgeholt kostet dich nichts.“ steht dort, wo der Knopf sichtbar ist — in der Leiste oder sonst bei der Kundin.
  const nichtAbgeholtInLeiste = zweite?.schluessel === 'nicht-abgeholt'

  if (ansicht === 'kompakt') {
    return (
      <article aria-labelledby={`bestellung-${bestellung.id}`} className={cn(KARTE, 'flex flex-col gap-3 p-4 md:px-[18px]', RUNDUNG.karte)}>
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 id={`bestellung-${bestellung.id}`} className="line-clamp-2 min-w-0 font-heading text-[24px] leading-tight font-semibold break-words" title={kunde.name}>
              {kunde.name}
            </h2>
            <Marke art={bestellung.marke.art} form="schild">
              {bestellung.marke.text}
            </Marke>
            {bestellung.absprache && <AbspracheMarke />}
          </div>
          <p className={cn('text-[13.5px]', LEISE)}>
            Bestellnummer {bestellung.nummer} · {bestellung.abholung}
          </p>
        </div>
        <Betrag bestellung={bestellung} geldsatz={geldsatz} kompakt />
        {barFrist && <p className="text-[13.5px]">{barFrist}</p>}
        {bestellung.positionen.length > 0 && (
          <p className="text-[14px] break-words">{bestellung.positionen.filter((p) => !p.fehlt).map((p) => p.zeile).join(' · ')}</p>
        )}
        {hauptaktion && (
          <button type="button" onClick={hauptaktion.onClick} disabled={laeuft} aria-busy={laeuft || undefined} className={cn(LEISTE_HAUPT, 'md:w-full')}>
            {hauptaktion.text}
          </button>
        )}
        <div aria-live="polite">
          <DialogFehler text={fehler} />
        </div>
        <Link href={`/orders/${bestellung.id}${zurueckSuche}`} className={cn(textlinkKlassen({ ton: 'gruen' }), 'self-start underline underline-offset-2')}>
          Ganze Bestellung öffnen →
        </Link>
      </article>
    )
  }

  return (
    <>
      {/*
        Werkzeug-Kopf (G1, seit Nr. 249): am Handy feste Leiste mit „‹“, h1 „Bestellung <Nummer>“, Unterzeile
        „Bestellungen“ und rechts Anrufen; im Web der grüne Textlink „‹ Bestellungen“ (Boards s1-/w1-bestellung).
      */}
      <WerkzeugKopf
        titel={`Bestellung ${bestellung.nummer}`}
        unterzeile={<p className={cn('truncate text-[13px] md:text-sm', LEISE)}>Bestellungen</p>}
        suche={zurueckSuche}
        aktion={
          anrufen ? (
            <a href={anrufen} aria-label={`${kunde.name} anrufen`} className={cn('inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-muted md:hidden', FOKUS_RAHMEN)}>
              <Phone className="size-5" strokeWidth={1.7} aria-hidden="true" />
            </a>
          ) : undefined
        }
      />
      <article aria-labelledby={`bestellung-${bestellung.id}`} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 id={`bestellung-${bestellung.id}`} className="line-clamp-2 min-w-0 font-heading text-[26px] leading-tight font-semibold break-words md:text-[28px]" title={kunde.name}>
              {kunde.name}
            </h2>
            <Marke art={bestellung.marke.art} form="schild">
              {bestellung.marke.text}
            </Marke>
            {bestellung.absprache && <AbspracheMarke />}
          </div>
          <p className="text-[15px]">
            {bestellung.abholung}
            {bestellung.abgeholtUm && <> · abgeholt um {bestellung.abgeholtUm}</>}
          </p>
          <p className={cn('text-[13.5px]', LEISE)}>Bestellnummer {bestellung.nummer} – nur zum Abgleich, prüf bei der Abholung den Namen.</p>
          {/* N47 (Nr. 257): offene Bestellung mit „Abholung nach Absprache“ — die Wege zur Kundin gleich unter dem Kopf. */}
          {bestellung.absprache && (
            <div className="mt-2">
              <AbspracheKnoepfe anrufen={anrufen} email={kunde.email} name={kunde.name} />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-5">
          <div className="flex min-w-0 flex-col gap-4">
            <Betrag bestellung={bestellung} geldsatz={geldsatz} />
            {barFrist && <p className={cn(RUNDUNG.karte, 'border border-border bg-card px-3.5 py-2.5 text-[13.5px]')}>{barFrist}</p>}

            {/* Die Packliste als gerahmte Gruppe mit dem Titel auf dem Rand (Board: „Packliste · 1 von 3“). */}
            <fieldset className={cn(RUNDUNG.karte, 'min-w-0 border border-border bg-card')}>
              <legend className={cn('ml-3.5 px-1.5 text-[14px] font-bold', LEISE)}>
                Packliste
                {(zumPacken || schonGepackt) && vorhanden.length > 0 && (
                  <span aria-live="polite">
                    {' '}
                    · {erledigtZahl} von {vorhanden.length}
                  </span>
                )}
              </legend>
              <ul>
                {bestellung.positionen.map((p) => (
                  <li key={p.id} className="border-t border-border first:border-t-0">
                    {zumPacken && !p.fehlt ? (
                      <button
                        type="button"
                        aria-pressed={abgehakt.has(p.id)}
                        onClick={() => hakeUm(p.id)}
                        className={cn('flex min-h-14 w-full items-center gap-3.5 px-3.5 py-2 text-left md:px-4', FOKUS_RAHMEN_INNEN)}
                      >
                        <Kaestchen an={abgehakt.has(p.id)} />
                        <span className="min-w-0 flex-1 text-[15px] break-words">
                          <PositionsText zeile={p.zeile} teile={p.teile} />
                        </span>
                        <span className={cn('shrink-0 text-[14px] tabular-nums', LEISE)}>{euro(p.betragCents)}</span>
                      </button>
                    ) : (
                      <div className="flex min-h-14 items-center gap-3.5 px-3.5 py-2 md:px-4">
                        {/* Abgeholt: alle Positionen gehakt (Board Bild 4), fehlende durchgestrichen mit Marke. */}
                        {!p.fehlt && <Kaestchen an={bestellung.status === 'PICKED_UP'} />}
                        <span className={cn('min-w-0 flex-1 text-[15px] break-words', p.fehlt && 'text-muted-foreground line-through')}>
                          <PositionsText zeile={p.zeile} teile={p.teile} />
                        </span>
                        {p.fehlt && <StatusBadge status="offen">fehlt</StatusBadge>}
                        <span className={cn('shrink-0 text-[14px] tabular-nums', LEISE, p.fehlt && 'line-through')}>{euro(p.betragCents)}</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </fieldset>

            <WiderrufKarte widerrufe={widerrufe} />
          </div>

          <Kundin bestellung={bestellung} nichtAbgeholtSatz={aktionen.nichtAbgeholt && !nichtAbgeholtInLeiste} />
        </div>

        <div aria-live="polite">
          <DialogFehler text={offen ? null : fehler} />
        </div>

        {(leisteHaupt || leisteRueckweg || zweite) && (
          <>
            {/* Platz für die feste Leiste, damit sie das Ende der Seite nicht verdeckt. */}
            <div aria-hidden="true" className={cn(nichtAbgeholtInLeiste ? 'h-40' : 'h-32', 'md:h-24')} />
            {/* data-unten-fest: Der Cookie-Hinweis misst die Leiste und steht darüber (src/lib/cookie-hinweis.ts).
                Am Handy ganz unten: Das Detail ist eine Fokus-Seite ohne Unterleiste (HofShell, Liste Lauf 32). */}
            <div data-unten-fest="" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:left-[264px] md:pb-0 print:hidden">
              {/* Am Handy: Hauptaktion oben über die volle Breite, darunter die zwei Knöpfe, dann der Satz (so auch
                  die Reihenfolge beim Tabben). Ab 768 px eine Zeile rechtsbündig: Satz links, die zwei Knöpfe, die
                  Hauptaktion ganz rechts. */}
              <div className="flex w-full max-w-[976px] flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-end md:gap-3 md:px-8 xl:px-10">
                {leisteHaupt && (
                  <button type="button" onClick={leisteHaupt.onClick} disabled={laeuft} aria-busy={laeuft || undefined} className={cn(LEISTE_HAUPT, 'order-first md:order-last')}>
                    {leisteHaupt.text}
                  </button>
                )}
                {leisteRueckweg && (
                  <button type="button" onClick={leisteRueckweg.onClick} disabled={laeuft} aria-busy={laeuft || undefined} className={cn(LEISTE_TEXT, 'order-first md:order-last')}>
                    {leisteRueckweg.text}
                  </button>
                )}
                {(zweite || weitere.length > 0) && (
                  <div className="grid grid-cols-2 gap-2 md:flex md:gap-3">
                    {zweite && (
                      <button type="button" onClick={zweite.onClick} disabled={laeuft} className={cn(LEISTE_NEBEN, weitere.length === 0 && 'col-span-2')}>
                        {zweite.text}
                      </button>
                    )}
                    {weitere.length > 0 && <WeitereAktionen aktionen={weitere} laeuft={laeuft} />}
                  </div>
                )}
                {nichtAbgeholtInLeiste && <p className={cn('order-last text-center text-[13px] md:order-first md:mr-auto md:text-left', LEISE)}>„Nicht abgeholt“ kostet dich nichts.</p>}
              </div>
            </div>
          </>
        )}

        <StornoDialog bestellung={bestellung} offen={offen === 'storno'} onOffenChange={(o) => setOffen(o ? 'storno' : null)} />
        <ArtikelFehltDialog
          key={bestellung.positionen.map((p) => `${p.id}:${p.fehlt}`).join('|')}
          bestellung={bestellung}
          offen={offen === 'fehlt'}
          onOffenChange={(o) => setOffen(o ? 'fehlt' : null)}
          onStornoWaehlen={() => setOffen('storno')}
        />
        <BestellDialog
          mitte
          offen={offen === 'nichtAbgeholt'}
          onOffenChange={(o) => setOffen(o ? 'nichtAbgeholt' : null)}
          titel="Nicht abgeholt?"
          unterzeile={`${kunde.name} · ${bestellung.nummer}`}
          hauptaktion={{ text: 'Nicht abgeholt', onClick: nichtAbgeholt, ton: 'orange', laeuft }}
        >
          <div className="flex flex-col gap-2 text-[13.5px]">
            <p>{kunde.vorname} hat die Bestellung nicht abgeholt. Sie bekommt keine E-Mail.</p>
            <p>
              {betrag.gebuehrCents > 0
                ? bestellung.vorOrt
                  ? `Die ${gebuehrWortFuer(betrag)} von ${euro(betrag.gebuehrCents)} entfällt und wird nicht abgerechnet. Am Warenpreis ändert sich nichts.`
                  : `Die ${gebuehrWortFuer(betrag)} von ${euro(betrag.gebuehrCents)} bekommt ${kunde.vorname} zurück. Der Warenpreis bleibt bei dir.`
                : 'Am Warenpreis ändert sich nichts.'}
            </p>
            <p className={cn(RUNDUNG.karte, 'border border-border bg-background px-3.5 py-2.5')}>Das lässt sich nicht rückgängig machen.</p>
            <DialogFehler text={offen === 'nichtAbgeholt' ? fehler : null} />
          </div>
        </BestellDialog>
        <BestellDialog
          mitte
          offen={offen === 'dochNicht'}
          onOffenChange={(o) => setOffen(o ? 'dochNicht' : null)}
          titel="Doch nicht gepackt?"
          hauptaktion={{ text: 'Zurück zum Packen', onClick: () => rueckweg('dochNicht'), ton: 'haupt', laeuft }}
        >
          <p className="text-[13.5px]">{kunde.vorname} hat schon die E-Mail „bereit zur Abholung“ bekommen.</p>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px]">
            <input type="checkbox" checked={kundinInformieren} onChange={(e) => setKundinInformieren(e.target.checked)} className="size-5 accent-accent" />
            {kunde.vorname} per E-Mail Bescheid geben
          </label>
          <DialogFehler text={offen === 'dochNicht' ? fehler : null} />
        </BestellDialog>
        <BestellDialog
          mitte
          offen={offen === 'abholungZurueck'}
          onOffenChange={(o) => setOffen(o ? 'abholungZurueck' : null)}
          titel="Abholung rückgängig?"
          hauptaktion={{ text: 'Abholung rückgängig', onClick: () => rueckweg('abholungZurueck'), ton: 'haupt', laeuft }}
        >
          <p className="text-[13.5px]">Die Bestellung steht wieder auf „Gepackt“. Es geht keine E-Mail raus.</p>
          <DialogFehler text={offen === 'abholungZurueck' ? fehler : null} />
        </BestellDialog>
      </article>
    </>
  )
}

/** Eine Position nach G14: die Anzahl fett vorn („**4** × Heumilch frisch (1 L)“); ohne Teile die alte Zeile. */
function PositionsText({ zeile, teile }: { zeile: string; teile?: Positionszeile }): React.JSX.Element {
  if (!teile) return <>{zeile}</>
  return (
    <>
      <span className="font-bold">{teile.anzahl}</span> × {teile.name}
      {teile.gebinde && <> ({teile.gebinde})</>}
    </>
  )
}

/** Das eckige Kästchen der Packliste (Board): leer mit Feldrand, abgehakt grün mit Haken. */
function Kaestchen({ an }: { an: boolean }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-[6px]',
        an ? 'bg-accent text-accent-foreground' : 'border-2 border-input bg-card'
      )}
    >
      {an && <Check className="size-5" strokeWidth={2.4} />}
    </span>
  )
}

/** „Weitere Aktionen …“: was neben Hauptaktion und zweitem Knopf geht, als Menü (Boards s1-/w1-bestellung). */
function WeitereAktionen({ aktionen, laeuft }: { aktionen: readonly Aktion[]; laeuft: boolean }): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger disabled={laeuft} className={LEISTE_NEBEN}>
        Weitere Aktionen …
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="w-60">
        {aktionen.map((a) => (
          <DropdownMenuItem key={a.schluessel} onClick={a.onClick} className="text-[15px]">
            {a.text}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Das Wort der Gebühr dieser Bestellung (V62/V63) — über den Helfer je Modell, nie ein festes Wort. */
function gebuehrWortFuer(betrag: { hofpreis: boolean }): string {
  return gebuehrBezeichnungFuer(modellDerBestellung(betrag))
}

/**
 * Der Betrag (Boards s1-/w1-bestellung): „Bar zu kassieren“ bzw. „Online bezahlt“ in normaler
 * Schreibung links, der Betrag rechts daneben, darunter der Satz, was beim Hof bleibt —
 * vor Ort im Paar „tun“ (orange), online im Paar „läuft“ (grün), beide ≥ 4,5:1 in beiden Themes.
 * `kompakt` (Vorschau neben der Liste): nur die Zeile getönt, der Satz leise darunter.
 */
function Betrag({ bestellung, geldsatz = null, kompakt = false }: { bestellung: HofBestellDetail; geldsatz?: string | null; kompakt?: boolean }): React.JSX.Element {
  const { betrag, status, vorOrt } = bestellung
  const beendet = status === 'CANCELLED' || status === 'NOT_PICKED_UP'
  // Was beim Hof bleibt und wie sich der Betrag zusammensetzt: der Geldsatz nach V1 (geldsaetzeFuer, mit dem
  // Gründungsende bzw. dem Satz des Modells; Liste Lauf 32, bestellung), ohne ihn der Satz je Modell (betragSatz).
  const zusammensetzung = geldsatz ?? betragSatz(betrag, vorOrt)
  const gebuehrWort = gebuehrWortFuer(betrag)

  if (beendet) {
    return (
      <div className={cn(RUNDUNG.karte, 'border border-border bg-muted px-3.5 py-3')}>
        <p className="text-[15px] font-bold">{status === 'CANCELLED' ? 'Storniert' : 'Nicht abgeholt'}</p>
        <p className="mt-1 text-[13.5px]">
          {betrag.gebuehrCents > 0 ? `Warenpreis ${euro(betrag.warenCents)} · ${gebuehrWort} ${euro(betrag.gebuehrCents)} entfällt` : `Warenpreis ${euro(betrag.warenCents)}`}
        </p>
        {betrag.erstattetCents > 0 && <p className={cn('mt-1 text-[13px]', LEISE)}>Erstattet: {euro(betrag.erstattetCents)}</p>}
        {bestellung.stornoGrund && <p className="mt-1 text-[13px] break-words">Grund: {bestellung.stornoGrund}</p>}
        {betrag.gebuehrErstattungOffen && (
          <p className="mt-1.5 text-[13px] font-medium text-status-offen">
            {gebuehrErstattungOffenHinweisFuer(modellDerBestellung(betrag))}{' '}
            <Link href={PROBLEM_MELDEN_HOF} className={cn('inline-flex min-h-11 items-center underline underline-offset-2', FOKUS_RAHMEN)}>
              {PROBLEM_MELDEN}
            </Link>
          </p>
        )}
      </div>
    )
  }

  const titel = vorOrt ? (status === 'PICKED_UP' ? 'Bar kassiert' : 'Bar zu kassieren') : bestellung.zahlart
  const paar = vorOrt ? 'bg-zustand-tun-grund text-zustand-tun' : 'bg-zustand-laeuft-grund text-zustand-laeuft'
  const erstattet = betrag.erstattetCents > 0 && !vorOrt ? `Für fehlende Artikel schon erstattet: ${euro(betrag.erstattetCents)}` : null

  if (kompakt) {
    return (
      <div className="flex flex-col gap-2">
        <p className={cn(RUNDUNG.karte, 'flex items-baseline justify-between gap-3 px-3.5 py-2.5', paar)}>
          <span className="text-[15px] font-bold">{titel}</span>
          <span className="text-[20px] font-bold tabular-nums">{euro(betrag.gesamtCents)}</span>
        </p>
        <p className={cn('text-[13.5px]', LEISE)}>{zusammensetzung}</p>
        {erstattet && <p className={cn('text-[13.5px]', LEISE)}>{erstattet}</p>}
      </div>
    )
  }

  return (
    <div className={cn(RUNDUNG.karte, 'px-3.5 py-3', paar)}>
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-bold">{titel}</span>
        <span className="text-[26px] leading-tight font-bold tabular-nums">{euro(betrag.gesamtCents)}</span>
      </p>
      <p className="mt-0.5 text-[13.5px]">{zusammensetzung}</p>
      {erstattet && <p className="mt-1 text-[13.5px]">{erstattet}</p>}
    </div>
  )
}

/**
 * Die Kundin (Boards s1-/w1-bestellung): „Anrufen“ und „Per WhatsApp erinnern“ als Knöpfe, die
 * E-Mail als Link, „Notiz: „…““, Bestellzeit und der Abholzettel. Den Namen trägt der Kopf.
 */
function Kundin({ bestellung, nichtAbgeholtSatz }: { bestellung: HofBestellDetail; nichtAbgeholtSatz: boolean }): React.JSX.Element {
  const { kunde } = bestellung
  const anrufen = telefonLink(kunde.telefon)
  const knopf = cn(KNOPF_RAHMEN, 'min-h-11 border-foreground/60 bg-card font-semibold')
  return (
    <section aria-labelledby={`kundin-${bestellung.id}`} className={cn(KARTE, 'flex min-w-0 flex-col gap-2.5 p-4')}>
      <h3 id={`kundin-${bestellung.id}`} className={KICKER}>
        Kundin
      </h3>
      <div className="flex flex-wrap gap-2">
        {anrufen ? (
          <a href={anrufen} aria-label={`Anrufen: ${formatiereTelefon(kunde.telefon)}`} title={formatiereTelefon(kunde.telefon)} className={knopf}>
            <Phone className="size-4" strokeWidth={1.7} aria-hidden="true" />
            Anrufen
          </a>
        ) : (
          // Eine Nummer, die sich nicht lesen lässt (zwei Nummern, „ab 18 Uhr“), steht als Text da: Die Eingabe der Kundin soll der Hof sehen, auch ohne Link.
          kunde.telefon.trim() !== '' && (
            <span className="inline-flex min-h-11 min-w-0 items-center gap-1.5 text-[14px] font-medium">
              <Phone className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
              <span className="min-w-0 [overflow-wrap:anywhere]">{formatiereTelefon(kunde.telefon)}</span>
            </span>
          )
        )}
        {bestellung.erinnernUrl && (
          <a href={bestellung.erinnernUrl} target="_blank" rel="noopener noreferrer" className={knopf}>
            Per WhatsApp erinnern
          </a>
        )}
      </div>
      <a href={`mailto:${kunde.email}`} className={cn(textlinkKlassen({ ton: 'gruen' }), 'self-start underline underline-offset-2 [overflow-wrap:anywhere]')}>
        {kunde.email}
      </a>
      {kunde.notiz && <p className="text-[14px] break-words">Notiz: „{kunde.notiz}“</p>}
      <p className={cn('text-[13px]', LEISE)}>
        Bestellt: {bestellung.bestelltAm}
        {bestellung.bezahltAm ? ` · bezahlt: ${bestellung.bezahltAm}` : bestellung.zahlungBeiAbholung ? ` · ${bestellung.zahlungBeiAbholung}` : ''}
      </p>
      {nichtAbgeholtSatz && <p className={cn('text-[13px]', LEISE)}>„Nicht abgeholt“ kostet dich nichts.</p>}
      <Link
        href={`/orders/${bestellung.id}/print`}
        target="_blank"
        className={cn('inline-flex min-h-11 items-center gap-1.5 self-start rounded-md text-[13.5px] font-medium hover:underline', FOKUS_RAHMEN)}
      >
        <Printer className="size-4" strokeWidth={1.7} aria-hidden="true" />
        Abholzettel drucken
      </Link>
    </section>
  )
}
