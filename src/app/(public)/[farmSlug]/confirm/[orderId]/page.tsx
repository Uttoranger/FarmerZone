import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, Clock, XCircle, MapPin, Calendar, Package } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { formatEuro, formatPosition } from '@/lib/format'
import { bestellLinkGilt, bestellungPfad } from '@/lib/bestell-link'
import { bestaetigungsZustand } from '@/lib/bestaetigung'
import { ClearCartOnMount } from '@/components/checkout/clear-cart-on-mount'
import { BestellSummenZeilen } from '@/components/checkout/bestell-summen'
import { KundenKopf } from '@/components/shared/kunden-kopf'
import { fristVon, tagInWorten, uhrzeitInWien } from '@/lib/fristen'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'

interface Props {
  params: Promise<{ farmSlug: string; orderId: string }>
  searchParams: Promise<{ sig?: string; redirect_status?: string }>
}

// Eine Seite mit Name, E-Mail und Bestellung: nie in einen Suchindex, und die
// signierte Adresse geht beim Klick auf einen Link nicht als Referrer mit
// (dazu der Header in next.config.ts).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

/**
 * Ohne gültige Signatur: nur „eingegangen" — kein Name, keine E-Mail, keine
 * Artikel, keine Beträge, und keine Datenbankabfrage (auch nicht, ob es die
 * Bestellung gibt). Die Bestell-ID im Pfad ist ratbar und steht u. a. in den
 * Stripe-Metadaten; den signierten Link haben nur die Kundin und ihre Mails.
 */
function BestellungEingegangen({ farmSlug }: { farmSlug: string }) {
  return (
    <div className="min-h-screen bg-background">
      <KundenKopf seite={{ art: 'bestaetigung', hofSlug: farmSlug }} />
      <ClearCartOnMount />
      <div className="max-w-lg mx-auto px-4 py-10 flex flex-col items-center text-center">
        <CheckCircle className="size-14 text-green-600 dark:text-green-400 mb-3" />
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Deine Bestellung ist eingegangen
        </h1>
        <p className="text-muted-foreground mt-1">– alle Details stehen in deiner E-Mail.</p>
      </div>
    </div>
  )
}

async function getOrder(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentMethod: true,
      paymentStatus: true,
      totalAmount: true,
      serviceFeeCents: true,
      serviceFeeRefundedAt: true,
      customerName: true,
      customerEmail: true,
      createdAt: true,
      cancelReason: true,
      pickupDate: true,
      pickupTimeStart: true,
      pickupTimeEnd: true,
      farm: {
        select: {
          slug: true,
          name: true,
          address: true,
          city: true,
          postalCode: true,
          archivedAt: true,
        },
      },
      items: {
        select: {
          productName: true,
          quantity: true,
          unitPrice: true,
          totalPrice: true,
          // Einheit nur zur Anzeige gejoint — kein Schema-Change
          product: { select: { unit: true, unitSize: true } },
        },
      },
    },
  })
}

export default async function ConfirmPage({ params, searchParams }: Props) {
  const { farmSlug, orderId } = await params
  const { sig, redirect_status } = await searchParams

  if (!sig || !bestellLinkGilt(orderId, sig)) return <BestellungEingegangen farmSlug={farmSlug} />

  // Frist gilt beim Lesen (src/lib/fristen.ts): Ist die Bestätigungsfrist
  // vorbei, verfällt die Bestellung, bevor die Seite „Fast geschafft" zeigt.
  const vorab = await prisma.order.findUnique({ where: { id: orderId }, select: { farmId: true } })
  if (vorab) await gibVerwaisteFreiOhneRisiko(vorab.farmId)

  const order = await getOrder(orderId)

  // Stillgelegter Hof: auch diese Unterseite verhält sich wie eine unbekannte
  // Farm. Die Stilllegung setzt voraus, dass keine offene Bestellung mehr
  // existiert (Guard in src/server/actions/farm-archive.ts), hier hängt also
  // kein laufender Bestätigungs-Ablauf dran.
  if (!order || order.farm.slug !== farmSlug || order.farm.archivedAt) notFound()

  // „Bezahlt" und „bestätigt" nur aus der Datenbank; redirect_status ist
  // höchstens ein Hinweis (src/lib/bestaetigung.ts).
  const zustand = bestaetigungsZustand(order, redirect_status)

  const jetzt = new Date()
  const bestaetigenBis = fristVon(order)

  const pickupDate = order.pickupDate.toLocaleDateString('de-AT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Zurück führt hier NIE durch den Verlauf — davor stehen Stripe und die Bank (kunden-kopf.ts). */}
      <KundenKopf seite={{ art: 'bestaetigung', hofSlug: order.farm.slug }} hofName={order.farm.name} />
      {/* Always clear the cart when reaching the confirm page — the order has been submitted */}
      <ClearCartOnMount />
      <div className="max-w-lg mx-auto px-4 py-10">
        {zustand === 'bezahlt' && (
          <div className="flex flex-col items-center text-center mb-8">
            <CheckCircle className="size-14 text-green-600 dark:text-green-400 mb-3" />
            <h1 className="font-heading text-2xl font-semibold text-foreground">Zahlung erfolgreich!</h1>
            <p className="text-muted-foreground mt-1">
              Deine Bestellung wurde bestätigt. Du erhältst eine E-Mail-Bestätigung.
            </p>
          </div>
        )}

        {zustand === 'zahlung-wird-geprueft' && (
          <div className="flex flex-col items-center text-center mb-8">
            <Clock className="size-14 text-amber-500 mb-3" />
            <h1 className="font-heading text-2xl font-semibold text-foreground">Zahlung wird geprüft</h1>
            <p className="text-muted-foreground mt-1">
              Das dauert meist nur ein paar Sekunden. Lade die Seite gleich neu – sobald die
              Zahlung bestätigt ist, siehst du es hier und bekommst eine E-Mail.
            </p>
          </div>
        )}

        {zustand === 'bestaetigt' && (
          <div className="flex flex-col items-center text-center mb-8">
            <CheckCircle className="size-14 text-green-600 dark:text-green-400 mb-3" />
            <h1 className="font-heading text-2xl font-semibold text-foreground">Bestellung bestätigt!</h1>
            <p className="text-muted-foreground mt-1">
              Deine Bestellung wurde verbindlich bestätigt. Bitte hole sie zum gewählten
              Termin ab und zahle vor Ort.
            </p>
          </div>
        )}

        {zustand === 'bestaetigung-offen' && (
          <div className="flex flex-col items-center text-center mb-8">
            <Clock className="size-14 text-amber-500 mb-3" />
            <h1 className="font-heading text-2xl font-semibold text-foreground">
              Fast geschafft – bitte bestätige per E-Mail
            </h1>
            <p className="text-muted-foreground mt-1">
              Den Link haben wir an <strong>{order.customerEmail}</strong> geschickt.
            </p>
            <p className="text-foreground mt-3">
              <strong>
                Bestätigen bis {tagInWorten(bestaetigenBis, jetzt)}, {uhrzeitInWien(bestaetigenBis)} Uhr.
              </strong>{' '}
              Danach geben wir die Ware wieder frei – ohne Kosten für dich.
            </p>
          </div>
        )}

        {zustand === 'verfallen' && (
          <div className="flex flex-col items-center text-center mb-8">
            <Clock className="size-14 text-muted-foreground mb-3" />
            <h1 className="font-heading text-2xl font-semibold text-foreground">Bestellung verfallen</h1>
            <p className="text-muted-foreground mt-1">
              Die Bestellung wurde nicht rechtzeitig bestätigt. Wir haben die Ware wieder
              freigegeben – dir entstehen keine Kosten.
            </p>
            <Link
              href={`/${farmSlug}`}
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
            >
              Neu bestellen
            </Link>
          </div>
        )}

        {zustand === 'zahlung-fehlgeschlagen' && (
          <div className="flex flex-col items-center text-center mb-8">
            <XCircle className="size-14 text-red-500 mb-3" />
            <h1 className="font-heading text-2xl font-semibold text-foreground">Zahlung fehlgeschlagen</h1>
            <p className="text-muted-foreground mt-1">
              Bitte versuche es erneut oder wähle eine andere Zahlungsart.
            </p>
            <Link
              href={`/${farmSlug}/checkout`}
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
            >
              Erneut versuchen
            </Link>
          </div>
        )}

        <div className="bg-card rounded-xl border border-border p-4 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Bestellnummer</span>
            <span className="font-mono font-bold text-foreground">{order.orderNumber}</span>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4 mb-4 space-y-3">
          <h2 className="font-medium text-foreground flex items-center gap-2">
            <Calendar className="size-4 text-primary" />
            Abholtermin
          </h2>
          <p className="text-sm text-foreground">
            {pickupDate}
            <br />
            <span className="text-muted-foreground">
              {order.pickupTimeStart} – {order.pickupTimeEnd} Uhr
            </span>
          </p>
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="size-4 text-muted-foreground/60 mt-0.5 shrink-0" />
            <span>
              {order.farm.name}
              <br />
              {order.farm.address}, {order.farm.postalCode} {order.farm.city}
            </span>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4 mb-6">
          <h2 className="font-medium text-foreground mb-3 flex items-center gap-2">
            <Package className="size-4 text-primary" />
            Bestellübersicht
          </h2>
          <div className="space-y-2">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-foreground">
                  {formatPosition({ name: item.productName, quantity: item.quantity, unit: item.product?.unit ?? null, unitSize: item.product?.unitSize ?? null })}
                </span>
                <span className="text-foreground">{formatEuro(Number(item.totalPrice))}</span>
              </div>
            ))}
          </div>
          {/* Dieselben Zeilen wie im Checkout — aus dem Snapshot der Bestellung */}
          <BestellSummenZeilen order={order} />
          <p className="text-xs text-muted-foreground mt-2">
            {order.paymentMethod === 'ONLINE'
              ? 'Online bezahlt'
              : order.paymentMethod === 'ONSITE_CASH'
              ? 'Bar bei Abholung'
              : 'Karte bei Abholung'}
          </p>
        </div>

        {/* Der signierte Weg zurück zur Bestellung (Sprint Bestellverfolgung):
            dieselbe Adresse steht als Knopf in der Bestätigungs-Mail — hier
            zusätzlich, damit die Kundin sie sich gleich merken kann. */}
        <Link
          href={bestellungPfad(farmSlug, order.id)}
          className="mb-4 flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Bestellung ansehen &amp; Link merken
        </Link>
        {/* Der Rückweg zum Hof steht in der Kopfzeile. */}
      </div>
    </div>
  )
}
