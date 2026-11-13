'use client'

import { useState, type ReactNode } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { Loader2, Lock } from 'lucide-react'
import { getStripePromise } from '@/lib/stripe-client'
import { NETZ_SATZ_UNSICHER } from '@/lib/netz'
import { GEWAEHRLEISTUNG_MITTEILUNG } from '@/lib/rechtstexte/gewaehrleistung-mitteilung'
import { cn } from '@/lib/utils'
import {
  KASSE_ZAHLART_UEBERSCHRIFT,
  bestaetigungMitStatus,
  gesamtAnzeige,
  reservierungsStand,
  zahlungsBetraege,
  zahlungsFehlerArt,
  type ReservierungsStand,
  type ZahlungsBetrag,
} from '@/lib/kasse'
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

/*
 * Der Zahlungsschritt der Kasse (Nachtlauf Nr. 12; Mockups
 * web-k3-zahlung-abgelehnt, mobil-k3-zahlung-abgelehnt). Er erscheint, wenn
 * /api/checkout die Bestellung samt Zahlungsvorgang angelegt hat. Zahlungsvorgang
 * UND angezeigter Betrag kommen vom Server: Übersicht und Zusammenfassung zeigen
 * genau `amountCents` aus der Antwort — den Betrag, den Stripe abbucht (der Knopf
 * trägt seit Nr. 309 nur sein Wort, § 8 Abs. 2 FAGG). Hier wird
 * nichts gerechnet (keine Uhr, keine Hofeinstellung), nur Stripes Zahlungsfeld
 * gezeigt und bestätigt.
 *
 * Welche Wege das Feld anbietet, legt der PaymentIntent fest
 * (`KASSE_ZAHLARTEN` in src/lib/kasse.ts: Karte mit Apple/Google Pay, EPS) —
 * das Feld liest sie aus dem clientSecret; das Gerät entscheidet über die
 * Wallets. Im Stripe-Dashboard müssen diese Zahlarten nur aktiviert sein.
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
  /** Der Betrag, den /api/checkout an Stripe gab (amountCents, serviceFeeCents) — angezeigt wie geliefert. */
  betrag: ZahlungsBetrag
  /** Bezeichnung der Gebührenzeile, beim Anlegen festgehalten (zahlungsGebuehrText). */
  gebuehrText: string
  /** N38: Hofpreis-Modell — „Ware · Plattformgebühr · Gesamt“ wie vor dem Anlegen. */
  hofpreis?: boolean
  /** Korb (ohne „ändern") und die festen Angaben zur Abholung — vom Formular gebaut. */
  korb: ReactNode
  angaben: ReactNode
  /**
   * Ware, Gesamtpreis, Abholtermin und Vertragspartner unmittelbar über dem Knopf (§ 8 Abs. 1 FAGG, Nr. 210;
   * `KaufZusammenfassung`, vom Formular gebaut). Ersetzt die Fußzeile unter dem Knopf. Eine Funktion, weil der
   * Gesamtbetrag hier entsteht — aus `betrag`, dem Betrag bei Stripe (`gesamtAnzeige`, Nr. 309); das Formular
   * rechnet ihn nicht ein zweites Mal.
   */
  zusammenfassung: (gesamt: { betrag: string; zusatz: string | null }) => ReactNode
  /**
   * Verbraucherin (Käuferart PRIVAT): nur dann die Gewährleistungs-Mitteilung über dem Knopf
   * (Anhang II FAGG, Nr. 211) — bei „Betrieb“ entfällt sie. Pflicht, damit kein Einstieg sie vergisst.
   */
  privat: boolean
  /**
   * AGB- und (bei Privat) Rücktrittssatz unter dem Knopf (Register N2/O4, Nr. 215): „Jetzt bezahlen“
   * macht die Online-Bestellung verbindlich. Vom Formular gebaut (`KaufknopfSaetze`, dieselbe Quelle wie
   * unter „Weiter zur Zahlung“) — Pflicht, damit kein Einstieg sie vergisst.
   */
  kaufknopfSaetze: ReactNode
}

/**
 * Die harmonisierte Mitteilung über das gesetzliche Gewährleistungsrecht (§ 4 Abs. 1 Z 12 und
 * Anhang II FAGG, Nr. 211): über der Zusammenfassung, die unmittelbar über dem Kaufknopf steht (Nr. 309,
 * Register N2 mit der Ergänzung aus F027) — im Zahlungsschritt als Abschnitt der Übersicht, im Formular
 * (`KassenAbschluss`) als eigene Karte. Ob sie steht
 * (nur bei Privat), entscheidet der Aufrufer.
 *
 * Die amtliche Grafik bleibt, wie sie ist (DESIGN_SYSTEM, „Amtliche Grafiken“): ein schlichtes
 * `<img>` in voller Breite, nicht über `next/image` (keine Umrechnung), ohne `loading="lazy"`
 * (sie muss beim Bestellen schon da sein), ohne Zuklappen, ohne Filter. Ihr Grund ist
 * durchsichtig — darunter liegt deshalb eine Fläche, die in beiden Themes hell ist
 * (`bg-accent-foreground`, wie Stripes Zahlungsfeld): Schwarze Schrift auf dunkler Karte wäre
 * unlesbar, eine Umfärbung der Grafik verboten (DESIGN_SYSTEM, „Amtliche Grafiken: unverändert, farbig, nicht zuklappbar“).
 */
export function GewaehrleistungsMitteilung({ karte = false, className }: { karte?: boolean; className?: string }): React.JSX.Element {
  const g = GEWAEHRLEISTUNG_MITTEILUNG
  return (
    <section
      aria-label={g.ueberschrift}
      data-gewaehrleistung=""
      className={cn('flex flex-col gap-2', karte ? KARTE : 'border-t border-border pt-3', className)}
    >
      <h3 className="text-sm font-semibold text-foreground">{g.ueberschrift}</h3>
      {/* eslint-disable-next-line @next/next/no-img-element -- amtliche Grafik (Anhang II FAGG): unverändert ausliefern, keine Bildoptimierung */}
      <img src={g.svgPfad} alt={g.altText} width={g.breite} height={g.hoehe} className="h-auto w-full bg-accent-foreground" />
    </section>
  )
}

export function StripeZahlung(props: StripeZahlungProps): React.JSX.Element {
  return (
    <Elements
      // Erst hier, wenn die Zahlung online gewählt ist (diese Komponente erscheint erst nach /api/checkout):
      // Bar-Bestellungen und die Kasse davor laden Stripe.js nie. Ein Promise je Seite (Memo in stripe-client).
      stripe={getStripePromise()}
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
          // Zahlarten als Reiter: genug Fläche für den Finger (Symbol und Text untereinander,
          // 2 × 12 px Innenabstand → über 44 px) und ein sichtbarer Fokus in der Primärfarbe.
          rules: {
            '.Tab': { padding: '12px' },
            '.Tab:focus': { boxShadow: '0 0 0 3px var(--colorPrimary)', outline: 'none' },
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
  betrag,
  gebuehrText,
  hofpreis = false,
  korb,
  angaben,
  zusammenfassung,
  privat,
  kaufknopfSaetze,
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
  const betraege = zahlungsBetraege(betrag)
  // Derselbe Betrag wie in der Übersicht und bei Stripe; der Titel der Gebühr ist der beim Anlegen festgehaltene.
  const gesamt = gesamtAnzeige({ gesamtCents: betraege.gesamtCents, gebuehrCents: betraege.gebuehrCents, hofpreis, gebuehrTitel: gebuehrText })

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
      window.location.assign(bestaetigungMitStatus(bestaetigung, window.location.origin, error.payment_intent?.status ?? 'processing'))
      return
    }
    if (art === 'abgelaufen') setAbgebrochen(true)
    else if (art === 'abgelehnt') setAbgelehnt(true)
    // Kein Netz mitten im Bezahlen: Der Betrag kann schon abgebucht sein. Der Satz sagt das ehrlich
    // und schickt zum Neuladen statt zum zweiten Versuch (Register N29, Ergänzung 26.10.2026).
    else if (art === 'netz') setFehler(NETZ_SATZ_UNSICHER)
    // Unvollständige Eingaben zeigt Stripe selbst am Feld; alles andere
    // (Netz, Dienst) steht als Stripes eigener Satz an der Übersicht.
    else if (error.type !== 'validation_error') {
      setFehler(error.message ?? 'Die Zahlung hat nicht geklappt. Versuch es noch einmal.')
    }
    setVerarbeitet(false)
  }

  return (
    // uebersichtZuletzt (Nr. 210): Am Handy steht die Übersicht mit der Zusammenfassung nach „Bezahlen“,
    // also unmittelbar über der festen Leiste mit dem Knopf — wie im Formular.
    <KassenRaster
      uebersichtZuletzt
      korb={korb}
      uebersicht={
        // max-md:mb-12: Mit Knopf, AGB- und Rücktrittssatz (Nr. 215) ist die feste Leiste am Handy rund 205 px hoch
        // (je Satz drei Zeilen bei 390 px). Der Platz unten im Raster (pb-44, 176 px) reichte nur für den Knopf;
        // mit 48 px mehr scrollt die Unterkante der Übersicht über die Leiste, statt darunter zu bleiben.
        <div className="max-md:mb-12">
          <UebersichtKarte
            betraege={betraege}
            gebuehrText={gebuehrText}
            hofpreis={hofpreis}
            reservierung={
              <ReservierungsHinweis stand={abgelaufen ? { zustand: 'abgelaufen' } : stand} schritt="zahlung" farmSlug={farmSlug} />
            }
          >
            {/* Zwischen Gesamtbetrag der Übersicht und Knopf (Nr. 309, Register N2 mit der Ergänzung aus F027): bei Privat
                die Gewährleistungs-Mitteilung (Nr. 211), dann die Zusammenfassung mit Gesamt unmittelbar über dem Knopf —
                dazwischen höchstens ein Zahlungsfehler. */}
            {privat && <GewaehrleistungsMitteilung />}
            {zusammenfassung(gesamt)}
            {fehler && (
              <p role="alert" className="text-[13px] leading-snug font-medium text-status-offen">
                {fehler}
              </p>
            )}
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
                  // § 8 Abs. 2 FAGG: Der Knopf trägt nur sein Wort; der Gesamtpreis steht in der Zusammenfassung darüber (Nr. 309).
                  abgelehnt ? 'Erneut bezahlen' : 'Jetzt bezahlen'
                )}
              </button>
              {kaufknopfSaetze}
            </AktionsLeiste>
          </UebersichtKarte>
        </div>
      }
    >
      {angaben}
      <section aria-labelledby="kasse-bezahlen" className={`${KARTE} flex flex-col gap-3`}>
        <h2 id="kasse-bezahlen" className={KARTEN_TITEL}>
          Bezahlen
        </h2>
        {abgelehnt && <ZahlungAbgelehnt bisUhrzeit={bisUhrzeit} />}
        <h3 className="text-sm font-semibold leading-snug text-foreground">{KASSE_ZAHLART_UEBERSCHRIFT}</h3>
        <div className="rounded-xl border border-border bg-accent-foreground p-3 md:p-4">
          {/* Reiter statt Akkordeon: Karte und EPS sind eine Auswahl, darunter stehen nur die Felder der gewählten. */}
          <PaymentElement options={{ layout: { type: 'tabs', defaultCollapsed: false } }} />
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
