'use client'

import { useState, type ReactNode } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { Loader2, Lock } from 'lucide-react'
import { getStripePromise } from '@/lib/stripe-client'
import { formatEuro } from '@/lib/format'
import { centsAlsEuro } from '@/lib/servicegebuehr'
import { reservierungsStand, zahlungsFehlerArt, type KassenBetraege, type ReservierungsStand } from '@/lib/kasse'
import {
  AktionsLeiste,
  HINWEIS,
  KARTE,
  KARTEN_TITEL,
  KNOPF_GRUEN,
  KassenRaster,
  ReservierungsHinweis,
  UebersichtKarte,
  ZahlungAbgelehnt,
} from './kasse-teile'

const stripePromise = getStripePromise()

/*
 * Der Zahlungsschritt der Kasse (Nachtlauf Nr. 12; Mockups
 * web-k3-zahlung-abgelehnt, mobil-k3-zahlung-abgelehnt). Er erscheint, wenn
 * /api/checkout die Bestellung samt Zahlungsvorgang angelegt hat — der
 * Geldweg ist unverändert: Betrag und Zahlungsvorgang kommen vom Server, hier
 * wird nur Stripes Zahlungsfeld gezeigt und bestätigt.
 *
 * Welche Wege das Feld anbietet (Karte, EPS, Apple/Google Pay), entscheiden
 * die Einstellungen im Stripe-Dashboard und das Gerät — nicht dieser Code.
 */

export type StripeZahlungProps = {
  clientSecret: string
  /** Signierter Pfad der Bestätigungsseite (aus /api/checkout; src/lib/bestell-link.ts). */
  bestaetigung: string
  farmSlug: string
  /** Bis dahin hält die Bestellung ihre Ware (ISO, aus /api/checkout; src/lib/fristen.ts). */
  reserviertBis: string | null
  /** Der Stand dieser Frist — die Kasse zählt mit einer Uhr herunter. */
  stand: ReservierungsStand
  /** Nur Anzeige; der Betrag des Zahlungsvorgangs steht beim Server fest. */
  betraege: Pick<KassenBetraege, 'warenCents' | 'gebuehrCents' | 'gesamtCents'>
  gebuehrText: string
  /** Korb (ohne „ändern") und die festen Angaben zur Abholung — vom Formular gebaut. */
  korb: ReactNode
  angaben: ReactNode
  fussnote: string
}

export function StripeZahlung(props: StripeZahlungProps): React.JSX.Element {
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: props.clientSecret,
        // Stripes Zahlungsfeld läuft in einem eigenen iframe und kennt unsere
        // CSS-Variablen nicht: Es bleibt hell (theme 'stripe') und sitzt auf
        // einer Fläche, die in beiden Themes hell ist (accent-foreground,
        // Crème im neuen Design) — CODING_STANDARDS §7, „Was dem Modus NICHT folgt".
        appearance: {
          theme: 'stripe',
          variables: {
            // eslint-disable-next-line no-restricted-syntax -- Stripe-iframe kennt keine CSS-Variablen; Wert = --fz-accent (in beiden Themes gleich)
            colorPrimary: '#2E6B45',
            borderRadius: '10px',
          },
        },
        locale: 'de',
      }}
    >
      <ZahlungsInhalt {...props} />
    </Elements>
  )
}

function ZahlungsInhalt({
  bestaetigung,
  farmSlug,
  reserviertBis,
  stand,
  betraege,
  gebuehrText,
  korb,
  angaben,
  fussnote,
}: StripeZahlungProps): React.JSX.Element {
  const stripe = useStripe()
  const elements = useElements()
  const [verarbeitet, setVerarbeitet] = useState(false)
  const [abgelehnt, setAbgelehnt] = useState(false)
  // Der Zahlungsvorgang wurde abgebrochen (Frist vorbei, src/server/verwaiste-bestellungen.ts),
  // auch wenn die Uhr im Browser noch läuft.
  const [abgebrochen, setAbgebrochen] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  const abgelaufen = abgebrochen || stand.zustand === 'abgelaufen'
  const bisUhrzeit = stand.zustand === 'laeuft' ? stand.uhrzeit : null
  const gesamt = formatEuro(centsAlsEuro(betraege.gesamtCents))

  async function bezahle() {
    if (!stripe || !elements || abgelaufen) return
    setVerarbeitet(true)
    setAbgelehnt(false)
    setFehler(null)

    // Signiert vom Server: Stripe hängt payment_intent und redirect_status
    // an, `sig` bleibt stehen — die Seite zeigt die Bestellung nur damit.
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}${bestaetigung}` },
    })
    // Ohne Fehler leitet Stripe weiter; hier geht es nur weiter, wenn nicht.
    if (!error) return

    const art = zahlungsFehlerArt({
      fehlerTyp: error.type,
      intentStatus: error.payment_intent?.status,
      fristUm: reservierungsStand(reserviertBis, new Date()).zustand === 'abgelaufen',
    })
    if (art === 'bezahlt') {
      // Wie Stripes eigene Rückleitung: Die Seite zeigt „Zahlung wird
      // geprüft", bis der Webhook den Stand in die Datenbank schreibt.
      window.location.assign(`${bestaetigung}&redirect_status=${error.payment_intent?.status ?? 'processing'}`)
      return
    }
    if (art === 'abgelaufen') setAbgebrochen(true)
    else if (art === 'abgelehnt') setAbgelehnt(true)
    // Unvollständige Eingaben zeigt Stripe selbst am Feld; alles andere
    // (Netz, Dienst) steht als Stripes eigener Satz an der Übersicht.
    else if (error.type !== 'validation_error') {
      setFehler(error.message ?? 'Die Zahlung hat nicht geklappt. Versuch es noch einmal.')
    }
    setVerarbeitet(false)
  }

  return (
    <KassenRaster
      korb={korb}
      uebersicht={
        <UebersichtKarte
          betraege={betraege}
          gebuehrText={gebuehrText}
          reservierung={
            <ReservierungsHinweis stand={abgelaufen ? { zustand: 'abgelaufen' } : stand} schritt="zahlung" farmSlug={farmSlug} />
          }
          fehler={
            fehler && (
              <p role="alert" className="text-[13px] leading-snug font-medium text-status-offen">
                {fehler}
              </p>
            )
          }
        >
          <AktionsLeiste>
            <button
              type="button"
              onClick={bezahle}
              disabled={!stripe || verarbeitet || abgelaufen}
              aria-busy={verarbeitet}
              className={KNOPF_GRUEN}
            >
              {verarbeitet ? (
                <>
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                  Wird bezahlt …
                </>
              ) : (
                `${abgelehnt ? 'Erneut bezahlen' : 'Jetzt bezahlen'} · ${gesamt}`
              )}
            </button>
            <p className={HINWEIS}>{fussnote}</p>
          </AktionsLeiste>
        </UebersichtKarte>
      }
    >
      {angaben}
      <section aria-labelledby="kasse-bezahlen" className={`${KARTE} flex flex-col gap-3`}>
        <h2 id="kasse-bezahlen" className={KARTEN_TITEL}>
          Bezahlen
        </h2>
        {abgelehnt && <ZahlungAbgelehnt bisUhrzeit={bisUhrzeit} />}
        <div className="rounded-xl border border-border bg-accent-foreground p-3 md:p-4">
          <PaymentElement options={{ layout: { type: 'accordion', defaultCollapsed: false, radios: 'always', spacedAccordionItems: false } }} />
        </div>
        <p className={HINWEIS}>Apple Pay bzw. Google Pay erscheint nur, wenn dein Gerät es unterstützt.</p>
        <p className={`${HINWEIS} flex items-center gap-1.5`}>
          <Lock className="size-3.5" strokeWidth={1.7} aria-hidden="true" />
          Sichere Zahlung über Stripe
        </p>
      </section>
    </KassenRaster>
  )
}
