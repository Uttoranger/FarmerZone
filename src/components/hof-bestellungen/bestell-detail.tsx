'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Check, MessageCircle, Phone, Printer } from 'lucide-react'
import {
  markAsNotPickedUp,
  markAsPickedUp,
  markAsPickedUpAndPaid,
  markAsReady,
  revertOrderStatus,
  revertPickedUp,
  revertReady,
} from '@/server/actions/orders'
import type { HofBestellDetail } from '@/server/queries/orders'
import { StatusBadge } from '@/components/ui/status-badge'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { GEBUEHR_ERSTATTUNG_OFFEN_HINWEIS, centsAlsEuro } from '@/lib/servicegebuehr'
import { formatEuro } from '@/lib/format'
import { cn } from '@/lib/utils'
import { BestellDialog, DialogFehler } from './bestell-dialog'
import { StornoDialog } from './storno-dialog'
import { ArtikelFehltDialog } from './artikel-fehlt-dialog'
import { UnterseitenKopf } from '@/components/hofbereich/unterseiten-kopf'
import { KARTE, KICKER, KNOPF_GRUEN, KNOPF_RAHMEN, LEISE, TEXT_GRUEN, TEXT_ORANGE } from './stil'

const euro = (cents: number): string => formatEuro(centsAlsEuro(cents))

type Offen = 'storno' | 'fehlt' | 'nichtAbgeholt' | 'dochNicht' | 'abholungZurueck' | null

/**
 * Die Bestellung im Detail (Mockups web-h3-bestellungen-packen-uebergeben,
 * mobil-h3-bestelldetail): Name und Marke, „Bar zu kassieren" groß, die
 * Packliste zum Abhaken, die Knöpfe Gepackt / Artikel fehlt / Nicht abgeholt
 * / Stornieren, darunter die Kundin. Welche Knöpfe es gibt, entscheidet der
 * Server (bestellAktionen); Beträge kommen in Cent.
 *
 * Das Abhaken der Packliste ist eine Hilfe beim Packen und lebt nur in diesem
 * Fenster — gespeichert wird „gepackt" mit „Als gepackt markieren".
 */
export function BestellDetail({
  bestellung,
  zurueckSuche,
}: {
  bestellung: HofBestellDetail
  /** Der gewählte Filter der Liste (`?filter=…` oder leer) — der Rückweg führt mit ihm zurück. */
  zurueckSuche: string
}): React.JSX.Element {
  const [abgehakt, setAbgehakt] = useState<ReadonlySet<string>>(new Set())
  const [offen, setOffen] = useState<Offen>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [kundinInformieren, setKundinInformieren] = useState(true)
  const [laeuft, starte] = useTransition()
  const { aktionen, betrag, kunde } = bestellung

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
      const ergebnis = await aktion(bestellung.id)
      if (ergebnis.error) {
        setFehler(ergebnis.error)
        return
      }
      toast.success(erfolg, {
        duration: 6000,
        action: {
          label: 'Rückgängig',
          onClick: () => {
            void revertOrderStatus(bestellung.id, vorher).then((r) => {
              if (r.error) toast.error(r.error)
              else toast.success('Zurückgesetzt')
            })
          },
        },
      })
    })
  }

  function nichtAbgeholt() {
    setFehler(null)
    starte(async () => {
      const ergebnis = await markAsNotPickedUp(bestellung.id)
      if (ergebnis.error) {
        setFehler(ergebnis.error)
        return
      }
      setOffen(null)
      if (ergebnis.gebuehrErstattungOffen) {
        toast.warning('Als nicht abgeholt gespeichert. Die Servicegebühr-Erstattung hat nicht geklappt – bitte den Betreiber informieren.', { duration: 10000 })
      } else {
        toast.success('Als nicht abgeholt gespeichert')
      }
    })
  }

  function rueckweg(art: 'dochNicht' | 'abholungZurueck') {
    setFehler(null)
    starte(async () => {
      const ergebnis = art === 'dochNicht' ? await revertReady(bestellung.id, kundinInformieren) : await revertPickedUp(bestellung.id)
      if (ergebnis.error) {
        setFehler(ergebnis.error)
        return
      }
      setOffen(null)
      toast.success(art === 'dochNicht' ? 'Zurück zum Packen' : 'Zurück zu Gepackt')
    })
  }

  const hauptaktion = aktionen.packen
    ? { text: 'Als gepackt markieren', onClick: () => wechsle(markAsReady, `Gepackt – ${kunde.vorname} bekommt Bescheid`) }
    : aktionen.abgeholt
      ? { text: 'Abgeholt', onClick: () => wechsle(markAsPickedUp, 'Als abgeholt gespeichert') }
      : aktionen.abgeholtBezahlt
        ? { text: `Abgeholt und ${euro(betrag.gesamtCents)} kassiert`, onClick: () => wechsle(markAsPickedUpAndPaid, 'Als abgeholt und bezahlt gespeichert') }
        : null

  return (
    <>
      {/*
        Unter 1024 px: Rückweg „Bestellungen" (Nr. 44 — am Handy feste Leiste, darüber
        hinaus die Zeile „‹ …"), darunter Bestellnummer und Anrufen (Mockup
        mobil-h3-bestelldetail). Ab 1024 px steht die Liste daneben, dort entfällt beides.
      */}
      <UnterseitenKopf
        titel={`Bestellung ${bestellung.nummer}`}
        suche={zurueckSuche}
        listeDaneben
        aktion={
          kunde.telefon ? (
            <a href={`tel:${kunde.telefon}`} aria-label={`${kunde.name} anrufen`} className={cn('inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-muted', FOKUS_RAHMEN)}>
              <Phone className="size-5" strokeWidth={1.7} aria-hidden="true" />
            </a>
          ) : undefined
        }
      />
      <article aria-labelledby={`bestellung-${bestellung.id}`} className="flex flex-col gap-3">
        <div className={cn(KARTE, 'flex flex-col gap-3.5 p-4 md:px-[18px]')}>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 id={`bestellung-${bestellung.id}`} className="line-clamp-2 min-w-0 font-heading text-[22px] leading-tight font-semibold break-words" title={kunde.name}>
              {kunde.name}
            </h2>
            <StatusBadge status={bestellung.marke.ton}>{bestellung.marke.text}</StatusBadge>
            <span className={cn('basis-full text-[13px] xl:ml-auto xl:basis-auto', LEISE)}>
              {bestellung.nummer} · {bestellung.abholung}
            </span>
          </div>

          <Betrag bestellung={bestellung} />

          <section aria-labelledby={`packliste-${bestellung.id}`}>
            <div className="flex items-baseline gap-2">
              <h3 id={`packliste-${bestellung.id}`} className={KICKER}>
                Packliste
              </h3>
              {zumPacken && vorhanden.length > 0 && (
                <span className={cn('text-[12.5px]', LEISE)} aria-live="polite">
                  {erledigtZahl} von {vorhanden.length} erledigt
                </span>
              )}
            </div>
            <ul className="mt-1.5">
              {bestellung.positionen.map((p) => (
                <li key={p.id} className="border-t border-border">
                  {zumPacken && !p.fehlt ? (
                    <button
                      type="button"
                      aria-pressed={abgehakt.has(p.id)}
                      onClick={() => hakeUm(p.id)}
                      className={cn('flex min-h-12 w-full items-center gap-3 py-2 text-left', FOKUS_RAHMEN_INNEN)}
                    >
                      <Haken an={abgehakt.has(p.id)} />
                      <span className={cn('min-w-0 flex-1 text-[14.5px] break-words', abgehakt.has(p.id) && 'text-muted-foreground line-through')}>{p.zeile}</span>
                      <span className={cn('shrink-0 text-[13px] tabular-nums', LEISE)}>{euro(p.betragCents)}</span>
                    </button>
                  ) : (
                    <div className="flex min-h-12 items-center gap-3 py-2">
                      <span className={cn('min-w-0 flex-1 text-[14.5px] break-words', p.fehlt && 'text-muted-foreground line-through')}>{p.zeile}</span>
                      {p.fehlt && <StatusBadge status="offen">fehlt</StatusBadge>}
                      <span className={cn('shrink-0 text-[13px] tabular-nums', LEISE, p.fehlt && 'line-through')}>{euro(p.betragCents)}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {zumPacken && (
            <p className={cn('text-[12.5px]', LEISE)}>
              Bestellnummer {bestellung.nummer} nur zum Abgleich – bitte zusätzlich den Namen prüfen.
            </p>
          )}

          {(hauptaktion || aktionen.artikelFehlt || aktionen.nichtAbgeholt || aktionen.stornieren) && (
            <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
              {hauptaktion && (
                <button type="button" onClick={hauptaktion.onClick} disabled={laeuft} aria-busy={laeuft || undefined} className={cn(KNOPF_GRUEN, 'w-full rounded-[14px] sm:w-auto sm:rounded-full')}>
                  {hauptaktion.text}
                </button>
              )}
              {aktionen.artikelFehlt && (
                <button type="button" onClick={() => setOffen('fehlt')} disabled={laeuft} className={KNOPF_RAHMEN}>
                  Artikel fehlt
                </button>
              )}
              <span className="hidden flex-1 sm:block" aria-hidden="true" />
              <div className="flex flex-wrap justify-center gap-1 sm:justify-end">
                {aktionen.nichtAbgeholt && (
                  <button type="button" onClick={() => setOffen('nichtAbgeholt')} disabled={laeuft} className={TEXT_GRUEN}>
                    Nicht abgeholt
                  </button>
                )}
                {aktionen.stornieren && (
                  <button type="button" onClick={() => setOffen('storno')} disabled={laeuft} className={TEXT_ORANGE}>
                    Stornieren
                  </button>
                )}
              </div>
            </div>
          )}
          {(aktionen.dochNichtGepackt || aktionen.abholungZurueck) && (
            <button
              type="button"
              onClick={() => {
                setKundinInformieren(true)
                setOffen(aktionen.dochNichtGepackt ? 'dochNicht' : 'abholungZurueck')
              }}
              disabled={laeuft}
              className={cn(KNOPF_RAHMEN, 'self-start text-muted-foreground')}
            >
              {aktionen.dochNichtGepackt ? 'Doch nicht gepackt' : 'Abholung rückgängig'}
            </button>
          )}
          {aktionen.nichtAbgeholt && (
            <p className={cn('text-[12.5px]', LEISE)}>„Nicht abgeholt“ kostet dich nichts – die Gebühr entfällt automatisch.</p>
          )}
          <div aria-live="polite">
            <DialogFehler text={offen ? null : fehler} />
          </div>
        </div>

        <Kundin bestellung={bestellung} />

        <StornoDialog bestellung={bestellung} offen={offen === 'storno'} onOffenChange={(o) => setOffen(o ? 'storno' : null)} />
        <ArtikelFehltDialog
          key={bestellung.positionen.map((p) => `${p.id}:${p.fehlt}`).join('|')}
          bestellung={bestellung}
          offen={offen === 'fehlt'}
          onOffenChange={(o) => setOffen(o ? 'fehlt' : null)}
          onStornoWaehlen={() => setOffen('storno')}
        />
        <BestellDialog
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
                  ? `Die Servicegebühr von ${euro(betrag.gebuehrCents)} entfällt und wird nicht abgerechnet. Am Warenpreis ändert sich nichts.`
                  : `Die Servicegebühr von ${euro(betrag.gebuehrCents)} bekommt ${kunde.vorname} zurück. Der Warenpreis bleibt bei dir.`
                : 'Am Warenpreis ändert sich nichts.'}
            </p>
            <p className="rounded-xl border border-border bg-background px-3.5 py-2.5">Das lässt sich nicht rückgängig machen.</p>
            <DialogFehler text={offen === 'nichtAbgeholt' ? fehler : null} />
          </div>
        </BestellDialog>
        <BestellDialog
          offen={offen === 'dochNicht'}
          onOffenChange={(o) => setOffen(o ? 'dochNicht' : null)}
          titel="Doch nicht gepackt?"
          hauptaktion={{ text: 'Zurück zum Packen', onClick: () => rueckweg('dochNicht'), ton: 'gruen', laeuft }}
        >
          <p className="text-[13.5px]">{kunde.vorname} hat schon die E-Mail „bereit zur Abholung“ bekommen.</p>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px]">
            <input type="checkbox" checked={kundinInformieren} onChange={(e) => setKundinInformieren(e.target.checked)} className="size-5 accent-accent" />
            {kunde.vorname} per E-Mail Bescheid geben
          </label>
          <DialogFehler text={offen === 'dochNicht' ? fehler : null} />
        </BestellDialog>
        <BestellDialog
          offen={offen === 'abholungZurueck'}
          onOffenChange={(o) => setOffen(o ? 'abholungZurueck' : null)}
          titel="Abholung rückgängig?"
          hauptaktion={{ text: 'Abholung rückgängig', onClick: () => rueckweg('abholungZurueck'), ton: 'gruen', laeuft }}
        >
          <p className="text-[13.5px]">Die Bestellung steht wieder auf „Gepackt“. Es geht keine E-Mail raus.</p>
          <DialogFehler text={offen === 'abholungZurueck' ? fehler : null} />
        </BestellDialog>
      </article>
    </>
  )
}

function Haken({ an }: { an: boolean }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-full',
        an ? 'bg-accent text-accent-foreground' : 'border-2 border-border'
      )}
    >
      {an && <Check className="size-4" strokeWidth={2.2} />}
    </span>
  )
}

/** „Bar zu kassieren" groß (vor Ort) bzw. „Online bezahlt" — dazu, wie sich der Betrag zusammensetzt. */
function Betrag({ bestellung }: { bestellung: HofBestellDetail }): React.JSX.Element {
  const { betrag, status, vorOrt } = bestellung
  const beendet = status === 'CANCELLED' || status === 'NOT_PICKED_UP'
  const zusammensetzung =
    betrag.gebuehrCents > 0 ? `Warenpreis ${euro(betrag.warenCents)} + Servicegebühr ${euro(betrag.gebuehrCents)}` : `Warenpreis ${euro(betrag.warenCents)}`

  if (beendet) {
    return (
      <div className="rounded-xl border border-border bg-muted px-3.5 py-3">
        <p className={cn('text-xs font-semibold tracking-wide uppercase', LEISE)}>{status === 'CANCELLED' ? 'Storniert' : 'Nicht abgeholt'}</p>
        <p className="mt-1 text-[13.5px]">
          {betrag.gebuehrCents > 0 ? `Warenpreis ${euro(betrag.warenCents)} · Servicegebühr ${euro(betrag.gebuehrCents)} entfällt` : `Warenpreis ${euro(betrag.warenCents)}`}
        </p>
        {betrag.erstattetCents > 0 && <p className={cn('mt-1 text-[12.5px]', LEISE)}>Erstattet: {euro(betrag.erstattetCents)}</p>}
        {bestellung.stornoGrund && <p className="mt-1 text-[12.5px] break-words">Grund: {bestellung.stornoGrund}</p>}
        {betrag.gebuehrErstattungOffen && <p className="mt-1.5 text-[12.5px] font-medium text-status-offen">{GEBUEHR_ERSTATTUNG_OFFEN_HINWEIS}</p>}
      </div>
    )
  }

  if (vorOrt) {
    const kassiert = status === 'PICKED_UP'
    return (
      <div className="rounded-xl border border-primary/45 bg-primary/10 px-3.5 py-3">
        <p className="text-xs font-semibold tracking-wide text-status-offen uppercase">{kassiert ? 'Bar kassiert' : 'Bar zu kassieren'}</p>
        <p className="font-heading text-[30px] leading-tight font-semibold tabular-nums">{euro(betrag.gesamtCents)}</p>
        <p className="text-[12.5px]">
          {zusammensetzung}
          {betrag.gebuehrFuerAbrechnung ? ' – die Gebühr holt die Monatsabrechnung.' : ''}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-accent/45 bg-accent/10 px-3.5 py-3">
      <p className="text-xs font-semibold tracking-wide text-status-fertig uppercase">{bestellung.zahlart}</p>
      <p className="font-heading text-[26px] leading-tight font-semibold tabular-nums">{euro(betrag.gesamtCents)}</p>
      <p className="text-[12.5px]">
        {zusammensetzung}
        {betrag.gebuehrCents > 0 ? ' – die Gebühr ist online einbehalten.' : ''}
      </p>
      {betrag.erstattetCents > 0 && (
        <p className="mt-1 text-[12.5px]">Für fehlende Artikel schon erstattet: {euro(betrag.erstattetCents)}</p>
      )}
    </div>
  )
}

/** Die Kundin: Name, Telefon, E-Mail, Notiz, Erinnern — dazu Bestellzeit und Drucken. */
function Kundin({ bestellung }: { bestellung: HofBestellDetail }): React.JSX.Element {
  const { kunde } = bestellung
  return (
    <section aria-labelledby={`kundin-${bestellung.id}`} className={cn(KARTE, 'flex flex-col gap-2 p-4 md:px-[18px]')}>
      <h3 id={`kundin-${bestellung.id}`} className={KICKER}>
        Kundin
      </h3>
      <p className="text-[14.5px] font-semibold break-words">{kunde.name}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px]">
        {kunde.telefon && (
          <a href={`tel:${kunde.telefon}`} className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-md font-medium text-status-fertig hover:underline', FOKUS_RAHMEN)}>
            <Phone className="size-4" strokeWidth={1.7} aria-hidden="true" />
            {kunde.telefon}
          </a>
        )}
        {bestellung.erinnernUrl && (
          <a
            href={bestellung.erinnernUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-md font-medium text-status-fertig hover:underline', FOKUS_RAHMEN)}
          >
            <MessageCircle className="size-4" strokeWidth={1.7} aria-hidden="true" />
            Per WhatsApp erinnern
          </a>
        )}
      </div>
      <p className={cn('text-[13px] break-all', LEISE)}>{kunde.email}</p>
      {kunde.notiz && <p className="rounded-xl bg-muted px-3 py-2 text-[13px] break-words">{kunde.notiz}</p>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-2">
        <p className={cn('text-[12.5px]', LEISE)}>
          Bestellt: {bestellung.bestelltAm}
          {bestellung.bezahltAm ? ` · bezahlt: ${bestellung.bezahltAm}` : ''}
        </p>
        <Link
          href={`/orders/${bestellung.id}/print`}
          target="_blank"
          className={cn('ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-md text-[13px] font-medium hover:underline', FOKUS_RAHMEN)}
        >
          <Printer className="size-4" strokeWidth={1.7} aria-hidden="true" />
          Drucken
        </Link>
      </div>
    </section>
  )
}
