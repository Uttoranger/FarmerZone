'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ChevronRight, ExternalLink, Pencil, Plus, ReceiptText, ShoppingCart, Trash2 } from 'lucide-react'
import { createStripeDashboardLinkAction } from '@/server/actions/stripe-connect'
import { deleteManualSale } from '@/server/actions/manual-sales'
import type { SalesOverview } from '@/server/queries/manual-sales'
import { JAHRESSUMME_TEXT, kanalText, wiederholVorlagen, type VerkaufDaten, type VerkaufProdukt, type VerkaufsZeile } from '@/lib/hof-verkaeufe'
import { centsAlsEuro, formatEuro } from '@/lib/format'
import { useUrlAuftrag } from '@/lib/use-url-auftrag'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { KanalSymbol } from '@/components/sales/kanal-symbol'
import { BestellDialog, DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { KARTE, KICKER, KNOPF_ORANGE, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { VerkaufDialog } from './verkauf-dialog'
import { cn } from '@/lib/utils'

/*
 * Verkäufe in der HofShell (Gate 8 „Code ohne Mockup", Nachtlauf Nr. 22b) —
 * gebaut nach docs/ai/DESIGN_SYSTEM.md, Abschnitt „Verkäufe", ohne neue
 * Funktion: Kennzahlen der Woche (Online/Bar mit Definition), Auszahlungen
 * bei Stripe, Wiederholen, die eine Liste aus abgeholten Bestellungen und
 * Direktverkäufen (Bearbeiten/Löschen) und „Verkauf eintragen" — auch aus dem
 * Neu-Menü (/sales?neu=1, Register E13). Was eine Zeile sagt, entscheidet
 * src/lib/hof-verkaeufe.ts; hier wird nur angeordnet.
 */

const euro = (cents: number) => formatEuro(centsAlsEuro(cents))

type Props = {
  overview: SalesOverview
  produkte: VerkaufProdukt[]
  topProduktIds: string[]
  stripeReady: boolean
}

type DialogZustand = { offen: boolean; verkauf: VerkaufDaten | null; vorlage: VerkaufDaten | null }

export function VerkaeufeAnsicht({ overview, produkte, topProduktIds, stripeReady }: Props): React.JSX.Element {
  const [dialog, setDialog] = useState<DialogZustand>({ offen: false, verkauf: null, vorlage: null })
  const [loeschen, setLoeschen] = useState<VerkaufDaten | null>(null)

  function neuerVerkauf() {
    setDialog({ offen: true, verkauf: null, vorlage: null })
  }

  // „Verkauf eintragen" aus dem Neu-Menü der Shell (/sales?neu=1): der Dialog,
  // einmal — danach ist der Parameter aus der Adresse.
  useUrlAuftrag((auftrag) => {
    if (auftrag.art === 'neu') neuerVerkauf()
  })

  const vorlagen = wiederholVorlagen(overview.zeilen)

  return (
    <div className="flex flex-col gap-4 md:gap-[18px]">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold text-foreground md:text-[26px]">Verkäufe</h1>
          <p className="text-[13px] leading-normal text-muted-foreground">Was du diese Woche eingenommen hast</p>
        </div>
        <button type="button" onClick={neuerVerkauf} className={KNOPF_ORANGE}>
          <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
          Verkauf eintragen
        </button>
      </header>

      <section aria-labelledby="verkaeufe-woche" className="grid gap-3 md:grid-cols-3">
        <h2 id="verkaeufe-woche" className="sr-only">
          Diese Woche
        </h2>
        <div className={cn(KARTE, 'p-4 md:p-5')}>
          <p className={cn('text-[13px]', LEISE)}>Diese Woche</p>
          <p className="mt-1 font-heading text-4xl font-semibold text-foreground tabular-nums md:text-[40px]">{formatEuro(overview.weekTotal)}</p>
          <p className={cn('mt-1 text-[13px]', LEISE)}>
            {`${JAHRESSUMME_TEXT}: ${formatEuro(overview.ytdTotal)}`}
          </p>
        </div>
        <Kennzahl titel="Online bezahlt" betrag={overview.weekOnline} satz="Über FarmerZone bezahlte, abgeholte Bestellungen." />
        <Kennzahl titel="Bar kassiert" betrag={overview.weekBar} satz="Vor Ort kassierte Abholungen plus deine Direktverkäufe." />
      </section>

      {/* Immer eingehängt, auch ohne fertiges Stripe: Meldet der Login-Link
          „Konto unbekannt", vermerkt die Action den Hof als nicht bereit und
          rendert die Seite neu (Register Z2). Mit `stripeReady && …` ginge die
          Meldung samt Komponente verloren. */}
      <StripeAuszahlungen bereit={stripeReady} />

      {vorlagen.length > 0 && (
        <section aria-labelledby="verkaeufe-wiederholen" className="flex flex-col gap-2.5">
          <h2 id="verkaeufe-wiederholen" className={KICKER}>
            Wiederholen
          </h2>
          <ul className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {vorlagen.map((v) => (
              <li key={v.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => setDialog({ offen: true, verkauf: null, vorlage: v })}
                  title={v.productName}
                  className={cn(KARTE, 'flex min-h-[60px] w-full items-start gap-2.5 p-3 text-left transition-colors duration-[250ms] hover:bg-muted', FOKUS_RAHMEN)}
                >
                  <KanalSymbol kanal={v.channel} className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="sr-only">Noch einmal eintragen: </span>
                    <span className="block truncate text-sm font-semibold text-foreground">{v.productName}</span>
                    <span className={cn('block truncate text-[12.5px]', LEISE)}>
                      {kanalText(v.channel)} · {formatEuro(v.totalAmount)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="verkaeufe-liste" className="flex flex-col gap-2.5">
        <h2 id="verkaeufe-liste" className={KICKER}>
          Letzte Verkäufe
        </h2>
        {overview.zeilen.length === 0 ? (
          <EmptyState
            symbol={ReceiptText}
            titel="Noch keine Verkäufe"
            satz="Abgeholte Bestellungen und eingetragene Direktverkäufe erscheinen hier."
            aktion={
              <button type="button" onClick={neuerVerkauf} className={KNOPF_RAHMEN}>
                Verkauf eintragen
              </button>
            }
          />
        ) : (
          <ul className={cn(KARTE, 'divide-y divide-border overflow-hidden')}>
            {overview.zeilen.map((zeile) => (
              <li key={zeile.schluessel}>
                <Zeile
                  zeile={zeile}
                  onBearbeiten={(v) => setDialog({ offen: true, verkauf: v, vorlage: null })}
                  onLoeschen={setLoeschen}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <VerkaufDialog
        offen={dialog.offen}
        verkauf={dialog.verkauf}
        vorlage={dialog.vorlage}
        produkte={produkte}
        topProduktIds={topProduktIds}
        onSchliessen={() => setDialog((d) => ({ ...d, offen: false }))}
      />
      <LoeschenDialog verkauf={loeschen} onSchliessen={() => setLoeschen(null)} />
    </div>
  )
}

function Kennzahl({ titel, betrag, satz }: { titel: string; betrag: number; satz: string }): React.JSX.Element {
  return (
    <div className={cn(KARTE, 'p-4 md:p-5')}>
      <p className={cn('text-[13px]', LEISE)}>{titel}</p>
      <p className="mt-1 font-heading text-[26px] font-semibold text-foreground tabular-nums">{formatEuro(betrag)}</p>
      <p className={cn('mt-1 text-[13px] leading-snug', LEISE)}>{satz}</p>
    </div>
  )
}

/** Eine Zeile: abgeholte Bestellung = Link in die Bestellung; Direktverkauf = Bearbeiten und Löschen daneben (nie ein Link im Link). */
function Zeile({
  zeile,
  onBearbeiten,
  onLoeschen,
}: {
  zeile: VerkaufsZeile
  onBearbeiten: (v: VerkaufDaten) => void
  onLoeschen: (v: VerkaufDaten) => void
}): React.JSX.Element {
  const symbol =
    zeile.art === 'bestellung' ? (
      <ShoppingCart className="size-[18px] text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
    ) : (
      <KanalSymbol kanal={zeile.kanal} className="size-[18px] text-muted-foreground" />
    )
  const inhalt = (
    <>
      <span className="hidden size-10 shrink-0 items-center justify-center rounded-full bg-muted sm:flex">{symbol}</span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate text-[14.5px] font-semibold text-foreground" title={zeile.titel}>
            {zeile.titel}
          </span>
          {zeile.art === 'bestellung' && <span className={cn('shrink-0 text-[12.5px]', LEISE)}>{zeile.nummer}</span>}
        </span>
        <span className={cn('block truncate text-[13px]', LEISE)}>
          {zeile.datum} · {zeile.unterzeile}
        </span>
        <span className="mt-1 flex">
          <StatusBadge status={zeile.marke.ton}>{zeile.marke.text}</StatusBadge>
        </span>
      </span>
      <span className="shrink-0 text-right text-[14.5px] font-semibold text-foreground tabular-nums">{euro(zeile.betragCent)}</span>
    </>
  )

  if (zeile.art === 'bestellung') {
    return (
      <Link href={zeile.href} className={cn('flex min-h-[72px] items-center gap-3 py-3 pr-1 pl-3.5 hover:bg-muted md:pl-[18px]', FOKUS_RAHMEN_INNEN)}>
        {inhalt}
        {/* Breite der beiden Knöpfe der Direktverkäufe — die Beträge fluchten. */}
        <span className="flex w-[88px] shrink-0 justify-end pr-3">
          <ChevronRight className="size-4 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
        </span>
      </Link>
    )
  }

  const v = zeile.verkauf
  return (
    <div className="flex min-h-[72px] items-center gap-3 py-3 pr-1 pl-3.5 md:pl-[18px]">
      {inhalt}
      <span className="flex w-[88px] shrink-0">
        <button
          type="button"
          onClick={() => onBearbeiten(v)}
          aria-label={`${zeile.titel} bearbeiten`}
          className={cn('flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground', FOKUS_RAHMEN_INNEN)}
        >
          <Pencil className="size-4" strokeWidth={1.7} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onLoeschen(v)}
          aria-label={`${zeile.titel} löschen`}
          className={cn('flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-status-offen', FOKUS_RAHMEN_INNEN)}
        >
          <Trash2 className="size-4" strokeWidth={1.7} aria-hidden="true" />
        </button>
      </span>
    </div>
  )
}

/** Rückfrage vor dem Löschen — Dialog bzw. Blatt wie die Rückfragen der Bestellungen, zerstörend als Orange-Umriss. */
function LoeschenDialog({ verkauf, onSchliessen }: { verkauf: VerkaufDaten | null; onSchliessen: () => void }): React.JSX.Element {
  const [laeuft, starte] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)
  // Den zuletzt gewählten Verkauf behalten, damit der Text beim Schließen nicht leer aufblitzt.
  const [zuletzt, setZuletzt] = useState<VerkaufDaten | null>(verkauf)
  if (verkauf && verkauf !== zuletzt) {
    setZuletzt(verkauf)
    setFehler(null)
  }
  const anzeige = verkauf ?? zuletzt

  function loeschen() {
    if (!verkauf) return
    starte(async () => {
      try {
        const antwort = await deleteManualSale(verkauf.id)
        if ('error' in antwort) {
          setFehler(antwort.error)
          return
        }
        toast.success('Verkauf gelöscht')
        onSchliessen()
      } catch {
        setFehler('Wir konnten den Verkauf nicht löschen. Bitte versuch es noch einmal.')
      }
    })
  }

  return (
    <BestellDialog
      offen={verkauf !== null}
      onOffenChange={(o) => !o && onSchliessen()}
      titel="Verkauf löschen?"
      hauptaktion={{ text: 'Löschen', onClick: loeschen, ton: 'orange', laeuft }}
    >
      <p className="text-sm break-words text-muted-foreground">
        <span className="font-semibold text-foreground">{anzeige?.productName}</span>
        {anzeige ? ` vom ${datumTag(anzeige.saleTag)} wird dauerhaft gelöscht.` : ''}
      </p>
      <DialogFehler text={fehler} />
    </BestellDialog>
  )
}

/** „25.09.2026" aus dem Wiener Kalendertag — ohne Zeitzonenfrage, der Tag steht schon fest. */
function datumTag(tag: string): string {
  const [j, m, t] = tag.split('-')
  return `${t}.${m}.${j}`
}

/**
 * Dezenter Weg zur Auszahlungs-Übersicht im Stripe-Express-Dashboard (Link
 * statt Zahl, Sprint 19). Ohne fertiges Stripe kein Knopf — nur eine Meldung,
 * die schon dasteht, bleibt sichtbar.
 */
function StripeAuszahlungen({ bereit }: { bereit: boolean }): React.JSX.Element | null {
  const [laeuft, starte] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)

  if (!bereit && !fehler) return null
  return (
    <div>
      {bereit && (
        <button
          type="button"
          disabled={laeuft}
          aria-busy={laeuft || undefined}
          onClick={() =>
            starte(async () => {
              setFehler(null)
              const ergebnis = await createStripeDashboardLinkAction()
              if (ergebnis.url) window.open(ergebnis.url, '_blank', 'noopener')
              else setFehler(ergebnis.error ?? 'Die Stripe-Übersicht ist gerade nicht erreichbar. Versuch es gleich noch einmal.')
            })
          }
          className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-full text-[13.5px] font-semibold text-status-fertig hover:underline disabled:opacity-60', FOKUS_RAHMEN)}
        >
          <ExternalLink className="size-4" strokeWidth={1.7} aria-hidden="true" />
          {laeuft ? 'Öffnet …' : 'Auszahlungen bei Stripe ansehen'}
        </button>
      )}
      {fehler && (
        <p role="alert" className="text-[13px] font-medium text-status-offen">
          {fehler}
        </p>
      )}
    </div>
  )
}

