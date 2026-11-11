import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import * as Sentry from '@sentry/nextjs'
import { CircleAlert, CircleCheck } from 'lucide-react'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import { prisma } from '@/lib/prisma'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { StatusBadge } from '@/components/ui/status-badge'
import { KARTE } from '@/components/hof-bestellungen/stil'
import { Hinweiskasten } from '@/components/ui/hinweiskasten'
import { HELLER_KNOPF } from '@/components/hof-einstellungen/knopf'
import { WerkzeugKopf } from '@/components/ui/werkzeug-kopf'
import { HofUnterzeile } from '@/components/mein-hof/hof-unterzeile'
import { UNTERSEITE_RAHMEN, UNTERSEITE_SATZ } from '@/components/hof-einstellungen/einstellungen-laden'
import { cn } from '@/lib/utils'
import { ONLINE_ZAHLUNG_EINRICHTEN_SATZ, ONLINE_ZAHLUNG_EINRICHTEN_TITEL } from '@/lib/konditionen'
import { BAR_KARTE_TEXT, ONLINE_AUS_SATZ, ONLINE_AUS_TITEL, barKarte, zahlungHinweis, type BarKarte } from '@/lib/hof-einstellungen'
import { HOF_FUER_GEBUEHR_LAGE, ladeGebuehrLage } from '@/server/queries/plattform-einstellung'
import {
  NEU_EINRICHTEN_MARKE,
  NEU_EINRICHTEN_TITEL,
  ZAHLUNG_STUFE_TEXT,
  hofStufe,
  istHofWarteStufe,
  neuEinrichtenSatz,
  stripeAnzeige,
  type HofStripeStufe,
} from '@/lib/stripe-konto'
import { TESTBETRIEB_TEXT } from '@/lib/stripe-modus'
import { TESTBETRIEB } from '@/lib/umgebung-server'
import { alsLand, stripeLandSatz } from '@/lib/laender'
import { PaymentsActions } from './payments-actions'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = { title: `Zahlung — ${MARKE}` }

async function getFarmPaymentData(userId: string) {
  return prisma.farm.findUnique({
    where: { ownerId: userId },
    select: {
      // Der Hofname der Unterzeile im Werkzeug-Kopf (G1, Nr. 250).
      name: true,
      stripeAccountId: true,
      stripeAccountReady: true,
      // Der grobe Stand des Stripe-Kontos (Register N49) für Kasten, Marke und Knöpfe.
      stripeKontoStand: true,
      acceptsOnline: true,
      // Nur für den Satz „neu einrichten": Barzahlung versprechen, wo es sie gibt.
      acceptsOnsite: true,
      // Nur für den Satz vor „Mit Stripe einrichten".
      country: true,
      // Die Gebührenlage (N38) für die Karte „Bar bei Abholung“ — dieselben Spalten wie Kasse und /api/checkout.
      ...HOF_FUER_GEBUEHR_LAGE,
    },
  })
}

/*
 * Zahlung in der HofShell (Nachtlauf Nr. 22d). Gleiches Verhalten wie vorher:
 * Einrichten, Fortsetzen und Prüfen laufen nur über die bestehenden Actions
 * (stripe-connect.ts); die Seite ruft Stripe nicht selbst auf. Neu gezeichnet
 * mit Hinweiskarte und StatusBadge; ?stripe=error (Rückweg von Stripe) steht
 * jetzt inline da, statt still zu bleiben.
 *
 * Register Z1: Stripe ist Pflicht, eine Wahl „nur bar" gibt es nicht. Ohne
 * fertiges Konto steht oben der Hinweis „Online-Zahlung einrichten" — auch
 * für einen Bestandshof mit acceptsOnline false (nur der Hinweis, keine
 * Datenänderung). Barzahlung durch Kundinnen bleibt (B1). Ist Stripe fertig,
 * Online aber aus, schaltet der Hof es hier selbst ein (schalteOnlineZahlungEin).
 * Oben steht immer höchstens EINE Karte (zahlungHinweis).
 *
 * Register Z2 (Nr. 42): Im Testbetrieb (Produktion mit Test-Schlüssel) sagt
 * die Karte „Online-Zahlung (Stripe)" das in einem Satz. Kennt Stripe das
 * gespeicherte Konto nicht (`?stripe=neu`, gesetzt von den Actions und der
 * Rückkehr aus dem Onboarding), heißt die Karte oben „Online-Zahlung neu
 * einrichten" und der orange Knopf richtet über den vorhandenen Weg neu ein.
 *
 * Register N49: Prüft Stripe, gibt noch nicht frei oder hat gesperrt, sagt der
 * Kasten das, die Marke nennt den Stand, und der Weg ins Stripe-Formular
 * entfällt („Status prüfen“ bleibt). Der Stand geht vor ?stripe=pending.
 */
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ stripe?: string }>
}): Promise<React.JSX.Element> {
  const { stripe: stripeStatus } = await searchParams
  const { userId } = await verlangeHofDerSitzung()
  // Nie mehr eine leere Seite (Nr. 156): ohne Hof wie jede Hof-Seite nach Einrichten.
  const farm = await getFarmPaymentData(userId)
  if (!farm) redirect('/onboarding')
  // Was der Hof über sein Stripe-Konto sieht (Register N49) — die Kennung bleibt auf dem Server.
  const stufe = hofStufe(
    stripeAnzeige({ stripeKontoDa: farm.stripeAccountId !== null, stripeAccountReady: farm.stripeAccountReady, stripeKontoStand: farm.stripeKontoStand })
  )
  const hinweis = zahlungHinweis({
    rueckmeldung: stripeStatus,
    stripeBereit: farm.stripeAccountReady,
    onlineAn: farm.acceptsOnline,
    stripeKontoDa: farm.stripeAccountId !== null,
    stufe,
  })
  const neuEinrichten = hinweis === 'neu-einrichten'
  // Der Weg ins Stripe-Formular nur, wo der Hof dort etwas tun kann (Register N49):
  // kein Konto, Angaben fehlen, neu einrichten. Prüft Stripe oder wartet der Hof, nicht.
  const formularOffen = neuEinrichten || stufe === 'kein_konto' || stufe === 'angaben_fehlen'
  // Ob bar geht, sagt barMoeglich (keine neue Regel); der Tag im Satz kommt aus derselben Lage (einzugAb).
  // Scheitert das Lesen, steht die Karte ohne Marke da (kein falsches „Aktiv“), der Rest der Seite bleibt.
  const jetzt = new Date()
  let bar: BarKarte | null = null
  try {
    bar = barKarte(await ladeGebuehrLage(farm, jetzt), jetzt, farm)
  } catch (err) {
    Sentry.captureException(err, { tags: { bereich: 'einstellungen', seite: 'zahlung', teil: 'bar' } })
  }

  return (
    <div className={UNTERSEITE_RAHMEN}>
      {/* Werkzeug-Kopf (G1, Nr. 250) mit Hof-Unterzeile, der Satz darunter (Boards s2-/w2-hofdaten-zahlung). */}
      <WerkzeugKopf titel="Zahlung" unterzeile={<HofUnterzeile hofName={farm.name} jetzt={jetzt} />} />
      <p className={UNTERSEITE_SATZ}>Verwalte, wie Kundinnen bezahlen können.</p>

      <div className="flex flex-col gap-4">
        {hinweis === 'geschafft' && (
          <Hinweiskarte ton="gruen" symbol={CircleCheck}>
            Dein Stripe-Konto ist eingerichtet. Online-Zahlung ist jetzt aktiv.
          </Hinweiskarte>
        )}
        {/* Offenes als Hinweiskasten (G3): Titel und Satz im Warnton, ohne Symbol (Board s2-/w2-hofdaten-zahlung
            Bild 5; Abnahme 269 „Hinweis Online-Zahlung mit ⓘ neutral und runder“). Die Sätze bleiben wörtlich. */}
        {hinweis === 'fortsetzen' && (
          <Hinweiskasten titel="Die Einrichtung bei Stripe ist noch nicht ganz fertig.">Bitte setz sie fort.</Hinweiskasten>
        )}
        {hinweis === 'fehler' && (
          <Hinweiskasten titel="Wir konnten den Stand bei Stripe gerade nicht prüfen.">Versuch es bitte noch einmal.</Hinweiskasten>
        )}
        {hinweis === 'einrichten' && <Hinweiskasten titel={ONLINE_ZAHLUNG_EINRICHTEN_TITEL}>{ONLINE_ZAHLUNG_EINRICHTEN_SATZ}</Hinweiskasten>}
        {hinweis === 'einschalten' && <Hinweiskasten titel={ONLINE_AUS_TITEL}>{ONLINE_AUS_SATZ}</Hinweiskasten>}
        {neuEinrichten && <Hinweiskasten titel={NEU_EINRICHTEN_TITEL}>{neuEinrichtenSatz(farm.acceptsOnsite)}</Hinweiskasten>}
        {/* Der Hof wartet auf Stripe (Register N49): sagen, dass er nichts tun muss bzw. wohin er sich wendet. */}
        {hinweis === 'pruefung' && <Hinweiskasten titel={ZAHLUNG_STUFE_TEXT.pruefung.titel}>{ZAHLUNG_STUFE_TEXT.pruefung.text}</Hinweiskasten>}
        {hinweis === 'noch-nicht' && (
          <Hinweiskasten titel={ZAHLUNG_STUFE_TEXT.noch_nicht.titel}>{ZAHLUNG_STUFE_TEXT.noch_nicht.text}</Hinweiskasten>
        )}
        {hinweis === 'gesperrt' && <Hinweiskasten titel={ZAHLUNG_STUFE_TEXT.gesperrt.titel}>{ZAHLUNG_STUFE_TEXT.gesperrt.text}</Hinweiskasten>}

        <section aria-labelledby="online-titel" className={cn(KARTE, 'p-5')}>
          {/* Titel in der Serifenschrift, die Marke rechts daneben statt darunter (Liste Lauf 32, hofdaten-zahlung). */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="online-titel" className="font-heading text-[18px] font-semibold text-foreground">
                Online-Zahlung (Stripe)
              </h2>
              <p className="mt-0.5 text-[14px] text-muted-foreground">
                Kundinnen zahlen online mit Karte, Apple Pay, Google Pay oder EPS.
              </p>
            </div>
            <StripeStatus
              accountId={farm.stripeAccountId}
              ready={farm.stripeAccountReady}
              onlineAn={farm.acceptsOnline}
              neuEinrichten={neuEinrichten}
              stufe={stufe}
            />
          </div>
          {/* Testbetrieb (Register Z2): mit Live-Schlüssel verschwindet der Satz von selbst. */}
          {TESTBETRIEB && (
            <p className="mt-3 flex items-start gap-1.5 text-[13px] leading-snug font-medium text-status-offen">
              <CircleAlert className="mt-px size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
              <span>{TESTBETRIEB_TEXT.zahlung}</span>
            </p>
          )}
          {/* Solange es kein Konto gibt oder es neu eingerichtet wird (Stripe legt dann ein neues an):
              Das Land lässt sich bei Stripe danach nicht mehr ändern. */}
          {(!farm.stripeAccountId || neuEinrichten) && (
            <p className="mt-4 text-[13px] leading-snug text-muted-foreground">
              {stripeLandSatz(alsLand(farm.country))}{' '}
              <Link href="/settings/profile" className="font-semibold text-status-fertig hover:underline">
                Hofdaten öffnen
              </Link>
            </p>
          )}
          <div className="mt-4">
            <PaymentsActions
              hasAccount={!!farm.stripeAccountId}
              isReady={farm.stripeAccountReady}
              onlineAn={farm.acceptsOnline}
              neuEinrichten={neuEinrichten}
              formularOffen={formularOffen}
            />
          </div>
        </section>

        <section aria-labelledby="bar-titel" className={cn(KARTE, 'p-5')}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="bar-titel" className="font-heading text-[18px] font-semibold text-foreground">
                {BAR_KARTE_TEXT.titel}
              </h2>
              <p className="mt-0.5 text-[14px] text-muted-foreground">{BAR_KARTE_TEXT.beschreibung}</p>
            </div>
            {bar && <StatusBadge status={bar.ton} className="shrink-0">{bar.marke}</StatusBadge>}
          </div>
          {bar?.satz && <p className="mt-3 text-[14px] leading-snug text-foreground">{bar.satz}</p>}
          {(bar?.lastschrift || bar?.zuKonditionen) && (
            <div className="mt-4">
              {/* Heller Knopf mit kräftigem Rand, fett (Abnahme Lauf 32 „Lastschrift einrichten nicht fett/blasser Rand“). */}
              <Link href={BAR_KARTE_TEXT.einrichtenHref} className={HELLER_KNOPF}>
                {bar.lastschrift ? BAR_KARTE_TEXT.einrichten : BAR_KARTE_TEXT.zuKonditionen}
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function StripeStatus({
  accountId,
  ready,
  onlineAn,
  neuEinrichten,
  stufe,
}: {
  accountId: string | null
  ready: boolean
  onlineAn: boolean
  neuEinrichten: boolean
  stufe: HofStripeStufe
}): React.JSX.Element {
  // Orange statt grau: Ohne Stripe fehlt etwas, das jeder Hof braucht (Z1).
  if (!accountId) return <StatusBadge status="offen">Noch nicht verbunden</StatusBadge>
  // Stripe kennt das gespeicherte Konto nicht (Register Z2).
  if (neuEinrichten) return <StatusBadge status="offen">{NEU_EINRICHTEN_MARKE}</StatusBadge>
  // Der Hof wartet auf Stripe (Register N49): die Marke sagt, warum.
  if (!ready && istHofWarteStufe(stufe)) return <StatusBadge status="offen">{ZAHLUNG_STUFE_TEXT[stufe].marke}</StatusBadge>
  if (!ready) return <StatusBadge status="offen">Einrichtung nicht fertig</StatusBadge>
  // Stripe fertig, Online aber aus (Bestandshof vor Z1): nicht „aktiv" nennen — der Checkout bietet online dann nicht an.
  if (!onlineAn) return <StatusBadge status="offen">Online-Zahlung aus</StatusBadge>
  return <StatusBadge status="fertig">Verbunden und aktiv</StatusBadge>
}
