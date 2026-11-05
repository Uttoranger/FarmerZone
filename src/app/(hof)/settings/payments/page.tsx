import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import * as Sentry from '@sentry/nextjs'
import { CircleAlert, CircleCheck, Clock } from 'lucide-react'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import { prisma } from '@/lib/prisma'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { StatusBadge } from '@/components/ui/status-badge'
import { KARTE, KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { UnterseitenKopf } from '@/components/hofbereich/unterseiten-kopf'
import { UNTERSEITE_RAHMEN } from '@/components/hof-einstellungen/einstellungen-laden'
import { cn } from '@/lib/utils'
import { ONLINE_ZAHLUNG_EINRICHTEN_SATZ, ONLINE_ZAHLUNG_EINRICHTEN_TITEL } from '@/lib/konditionen'
import { BAR_KARTE_TEXT, ONLINE_AUS_SATZ, ONLINE_AUS_TITEL, barKarte, zahlungHinweis, type BarKarte } from '@/lib/hof-einstellungen'
import { HOF_FUER_GEBUEHR_LAGE, ladeGebuehrLage } from '@/server/queries/plattform-einstellung'
import { NEU_EINRICHTEN_MARKE, NEU_EINRICHTEN_TITEL, neuEinrichtenSatz } from '@/lib/stripe-konto'
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
      stripeAccountId: true,
      stripeAccountReady: true,
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
  const hinweis = zahlungHinweis({
    rueckmeldung: stripeStatus,
    stripeBereit: farm.stripeAccountReady,
    onlineAn: farm.acceptsOnline,
    stripeKontoDa: farm.stripeAccountId !== null,
  })
  const neuEinrichten = hinweis === 'neu-einrichten'
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
      <UnterseitenKopf titel="Zahlung" satz="Verwalte, wie Kundinnen bezahlen können." />

      <div className="flex flex-col gap-4">
        {hinweis === 'geschafft' && (
          <Hinweiskarte ton="gruen" symbol={CircleCheck}>
            Dein Stripe-Konto ist eingerichtet. Online-Zahlung ist jetzt aktiv.
          </Hinweiskarte>
        )}
        {hinweis === 'fortsetzen' && (
          <Hinweiskarte ton="orange" symbol={Clock}>
            Die Einrichtung bei Stripe ist noch nicht ganz fertig. Bitte setz sie fort.
          </Hinweiskarte>
        )}
        {hinweis === 'fehler' && (
          <Hinweiskarte ton="orange" symbol={CircleAlert}>
            Wir konnten den Stand bei Stripe gerade nicht prüfen. Versuch es bitte noch einmal.
          </Hinweiskarte>
        )}
        {hinweis === 'einrichten' && (
          <Hinweiskarte ton="orange" symbol={CircleAlert} titel={ONLINE_ZAHLUNG_EINRICHTEN_TITEL}>
            {ONLINE_ZAHLUNG_EINRICHTEN_SATZ}
          </Hinweiskarte>
        )}
        {hinweis === 'einschalten' && (
          <Hinweiskarte ton="orange" symbol={CircleAlert} titel={ONLINE_AUS_TITEL}>
            {ONLINE_AUS_SATZ}
          </Hinweiskarte>
        )}
        {neuEinrichten && (
          <Hinweiskarte ton="orange" symbol={CircleAlert} titel={NEU_EINRICHTEN_TITEL}>
            {neuEinrichtenSatz(farm.acceptsOnsite)}
          </Hinweiskarte>
        )}

        <section aria-labelledby="online-titel" className={cn(KARTE, 'p-5')}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 id="online-titel" className="text-[15.5px] font-semibold text-foreground">
                Online-Zahlung (Stripe)
              </h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Kundinnen zahlen online mit Karte und weiteren Zahlungsarten.
              </p>
            </div>
            <StripeStatus
              accountId={farm.stripeAccountId}
              ready={farm.stripeAccountReady}
              onlineAn={farm.acceptsOnline}
              neuEinrichten={neuEinrichten}
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
            />
          </div>
        </section>

        <section aria-labelledby="bar-titel" className={cn(KARTE, 'p-5')}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 id="bar-titel" className="text-[15.5px] font-semibold text-foreground">
                {BAR_KARTE_TEXT.titel}
              </h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">{BAR_KARTE_TEXT.beschreibung}</p>
            </div>
            {bar && <StatusBadge status={bar.ton}>{bar.marke}</StatusBadge>}
          </div>
          {bar?.satz && <p className="mt-3 text-[13.5px] leading-snug text-foreground">{bar.satz}</p>}
          {bar?.lastschrift && (
            <div className="mt-4">
              <Link href={BAR_KARTE_TEXT.einrichtenHref} className={KNOPF_RAHMEN}>
                {BAR_KARTE_TEXT.einrichten}
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
}: {
  accountId: string | null
  ready: boolean
  onlineAn: boolean
  neuEinrichten: boolean
}): React.JSX.Element {
  // Orange statt grau: Ohne Stripe fehlt etwas, das jeder Hof braucht (Z1).
  if (!accountId) return <StatusBadge status="offen">Noch nicht verbunden</StatusBadge>
  // Stripe kennt das gespeicherte Konto nicht (Register Z2).
  if (neuEinrichten) return <StatusBadge status="offen">{NEU_EINRICHTEN_MARKE}</StatusBadge>
  if (!ready) return <StatusBadge status="offen">Einrichtung nicht fertig</StatusBadge>
  // Stripe fertig, Online aber aus (Bestandshof vor Z1): nicht „aktiv" nennen — der Checkout bietet online dann nicht an.
  if (!onlineAn) return <StatusBadge status="offen">Online-Zahlung aus</StatusBadge>
  return <StatusBadge status="fertig">Verbunden und aktiv</StatusBadge>
}
