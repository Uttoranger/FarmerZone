'use client'

import { useState, useTransition } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { getStripePromise } from '@/lib/stripe-client'
import { LASTSCHRIFT_TEXT } from '@/lib/konditionen'
import { abrechnungStandWort } from '@/lib/plattformgebuehr'
import { centsAlsEuro, formatEuro } from '@/lib/format'
import { starteLastschrift, oeffneRechnung } from '@/server/actions/lastschrift'
import { cn } from '@/lib/utils'
import { StatusBadge, type StatusTon } from '@/components/ui/status-badge'
import { KARTE, KICKER, KNOPF_GRUEN, KNOPF_RAHMEN, LEISE, TEXT_GRUEN } from '@/components/hof-bestellungen/stil'

const T = LASTSCHRIFT_TEXT

/** Was die Seite vom Server bekommt — nur Text, Wahrheitswerte und Cent (kein Date, keine IBAN). */
export type BarzahlungAnzeige = {
  satzText: string
  einzugAbText: string
  einzugBegonnen: boolean
  mandat: boolean
  mandatPflicht: boolean
  bank: string | null
  letzte4: string | null
  abrechnungen: Array<{ id: string; monatText: string; barCents: number; onlineCents: number; stand: string; rechnungBar: boolean; rechnungOnline: boolean }>
}

/** Der Ton des Stands — das Wort steht immer daneben, nie nur die Farbe. */
function standTon(stand: string): StatusTon {
  if (stand === 'bezahlt' || stand === 'nichts') return 'fertig'
  if (stand === 'offen' || stand === 'gescheitert' || stand === 'zurueckgebucht') return 'offen'
  return 'neutral'
}

const euro = (cents: number): string => formatEuro(centsAlsEuro(cents))

/**
 * Hof › Deine Konditionen › „Barzahlung“ und „Monatsabrechnungen“ (Register
 * N38, Nr. 198). Die Lastschrift richtet Stripes Formular ein (Payment
 * Element über `@stripe/stripe-js/pure`, erst nach dem Klick geladen); gültig
 * wird sie erst über den Webhook — darum sagt die Seite danach „die Bank
 * bestätigt …“ und zeigt das Mandat nach dem Neuladen. Die Rechnung als PDF
 * holt der Server erst beim Klick bei Stripe.
 */
export function Barzahlung({ daten }: { daten: BarzahlungAnzeige }): React.JSX.Element {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [fertig, setFertig] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, starte] = useTransition()

  function einrichten(): void {
    setFehler(null)
    starte(async () => {
      const antwort = await starteLastschrift()
      if ('error' in antwort) setFehler(antwort.error)
      else setClientSecret(antwort.clientSecret)
    })
  }

  return (
    <>
      <section id="barzahlung" aria-labelledby="barzahlung-titel" className={cn(KARTE, 'flex scroll-mt-24 flex-col gap-3 p-5 md:p-6')}>
        <h2 id="barzahlung-titel" className="font-heading text-lg font-semibold text-foreground">
          {T.titel}
        </h2>
        <ul className="flex flex-col gap-1.5 text-[14px] leading-snug text-foreground md:text-[13.5px]">
          <li>{T.satz(daten.satzText)}</li>
          <li>{daten.einzugBegonnen ? T.einzugAb(daten.einzugAbText) : `${T.einzugAb(daten.einzugAbText)} · ${T.erlassen(daten.einzugAbText)}`}</li>
          <li className="flex flex-wrap items-center gap-2">
            <StatusBadge status={daten.mandat ? 'fertig' : 'neutral'}>{daten.mandat ? 'eingerichtet' : 'fehlt'}</StatusBadge>
            <span>{daten.mandat ? T.mandatDa(daten.bank, daten.letzte4) : T.mandatFehlt}</span>
          </li>
        </ul>
        {!daten.mandat && <p className={cn('text-[13px] leading-snug', LEISE)}>{daten.mandatPflicht ? T.mandatPflicht : T.mandatFrei}</p>}

        {fertig ? (
          <p role="status" className="text-[14px] leading-snug text-foreground">
            {T.wartet}
          </p>
        ) : clientSecret ? (
          <Elements stripe={getStripePromise()} options={{ clientSecret, locale: 'de', appearance: { theme: 'stripe' } }}>
            {/* Stripes Formular bleibt hell (eigenes iframe) — eine helle Fläche in beiden Modi (CODING_STANDARDS §7). */}
            <div className="rounded-xl bg-accent-foreground p-3">
              <LastschriftFormular onFertig={() => setFertig(true)} onFehler={setFehler} />
            </div>
          </Elements>
        ) : (
          <div>
            <button type="button" onClick={einrichten} disabled={laeuft} aria-busy={laeuft || undefined} className={daten.mandat ? KNOPF_RAHMEN : KNOPF_GRUEN}>
              {daten.mandat ? T.aendern : T.einrichten}
            </button>
          </div>
        )}
        {fehler && (
          <p role="alert" className="text-[13px] leading-snug text-destructive">
            {fehler}
          </p>
        )}
      </section>

      <Monatsabrechnungen zeilen={daten.abrechnungen} />
    </>
  )
}

function LastschriftFormular({ onFertig, onFehler }: { onFertig: () => void; onFehler: (text: string) => void }): React.JSX.Element {
  const stripe = useStripe()
  const elements = useElements()
  const [laeuft, setLaeuft] = useState(false)

  async function bestaetigen(): Promise<void> {
    if (!stripe || !elements) return
    setLaeuft(true)
    const { error } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: `${window.location.origin}/settings/konditionen#barzahlung` },
      redirect: 'if_required',
    })
    setLaeuft(false)
    // Nichts wird hier gespeichert: Das Mandat gilt erst mit dem Webhook `setup_intent.succeeded`.
    if (error) onFehler(error.message ?? T.fehler)
    else onFertig()
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        void bestaetigen()
      }}
    >
      <PaymentElement />
      <div>
        <button type="submit" disabled={!stripe || laeuft} aria-busy={laeuft || undefined} className={KNOPF_GRUEN}>
          {T.einrichten}
        </button>
      </div>
    </form>
  )
}

function RechnungKnopf({ abrechnungId, art }: { abrechnungId: string; art: 'bar' | 'online' }): React.JSX.Element {
  const [laeuft, starte] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={laeuft}
        aria-busy={laeuft || undefined}
        className={TEXT_GRUEN}
        onClick={() =>
          starte(async () => {
            setFehler(null)
            const antwort = await oeffneRechnung({ abrechnungId, art, ziel: 'pdf' })
            if ('error' in antwort) setFehler(antwort.error)
            else window.location.assign(antwort.url)
          })
        }
      >
        {T.rechnung} {art}
      </button>
      {fehler && (
        <span role="alert" className="text-[12.5px] text-destructive">
          {fehler}
        </span>
      )}
    </span>
  )
}

function Monatsabrechnungen({ zeilen }: { zeilen: BarzahlungAnzeige['abrechnungen'] }): React.JSX.Element {
  return (
    <section aria-labelledby="abrechnungen-titel" className="flex flex-col gap-2.5">
      <h2 id="abrechnungen-titel" className={KICKER}>
        {T.abrechnungen}
      </h2>
      {zeilen.length === 0 ? (
        <p className={cn('text-[14px] leading-snug md:text-[13.5px]', LEISE)}>{T.abrechnungenLeer}</p>
      ) : (
        <ul className={cn(KARTE, '[&>li+li]:border-t [&>li+li]:border-border')}>
          {zeilen.map((z) => (
            <li key={z.id} className="flex flex-col gap-1.5 px-4 py-3 md:flex-row md:items-center md:gap-4">
              <span className="min-w-0 flex-1 text-[15px] font-semibold text-foreground">{z.monatText}</span>
              <span className="text-[14px] tabular-nums text-foreground">
                {T.spalten.bar} {euro(z.barCents)} · {T.spalten.online} {euro(z.onlineCents)}
              </span>
              <StatusBadge status={standTon(z.stand)} className="self-start md:self-auto">
                {abrechnungStandWort(z.stand)}
              </StatusBadge>
              <span className="flex flex-wrap gap-1">
                {z.rechnungBar && <RechnungKnopf abrechnungId={z.id} art="bar" />}
                {z.rechnungOnline && <RechnungKnopf abrechnungId={z.id} art="online" />}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
