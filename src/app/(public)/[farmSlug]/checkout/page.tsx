import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { getPublicFarmGeteilt, type PublicFarm } from '@/server/queries/farm'
import { getBetriebsVorbelegung, getNurBetriebeProduktIds } from '@/server/queries/products'
import { CheckoutForm, KassePausiert, ZahlungFortsetzen, type Zahlung } from '@/components/checkout/checkout-form'
import type { KorbPosition } from '@/components/checkout/kasse-teile'
import { alsAbholFenster, ausgebuchteSchluessel, ausgebuchteTage } from '@/server/abholfenster'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'
import { FORTSETZEN_PARAMETER, fortsetzungsZiel, kassenVorbelegung, zahlungsGebuehrText, zielNachIntent } from '@/lib/kasse'
import { bestaetigungsParameterSchema } from '@/schemas/bestaetigung'
import { bestaetigungsPfad, bestellLinkGilt } from '@/lib/bestell-link'
import { abholZeitText } from '@/lib/bestaetigung'
import { fristVon } from '@/lib/fristen'
import { alsCents } from '@/lib/order-totals'
import { centsAlsEuro, gebindeGroesse } from '@/lib/format'
import { kaufSperre } from '@/lib/bereiche-anzeige'
import { KAEUFER_PARAMETER, leseKaeuferVorbelegung } from '@/schemas/kaeufer-vorbelegung'
import { TESTBETRIEB } from '@/lib/umgebung-server'
import { prisma } from '@/lib/prisma'
import { HOF_FUER_GEBUEHR_LAGE, ladeBarMoeglich } from '@/server/queries/plattform-einstellung'

interface Props {
  params: Promise<{ farmSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { farmSlug } = await params
  // Dieselbe Abfrage wie die Seite, einmal je Anfrage (Nr. 47): Zwei getrennte
  // Aufrufe liefen in einer Prisma-Transaktion gleichzeitig über eine Verbindung.
  const farm = await getPublicFarmGeteilt(farmSlug)
  return { title: farm ? `Bestellen — ${farm.name}` : 'Bestellen' }
}

type Fortsetzung =
  | { art: 'kasse' }
  | { art: 'bestaetigung'; pfad: string }
  | { art: 'zahlung'; zahlung: Zahlung; positionen: KorbPosition[] }

const KASSE: Fortsetzung = { art: 'kasse' }

/**
 * „Erneut versuchen" nach gescheiterter Zahlung (Audit A3, Nr. 202):
 * `?zahlung={id}&sig={signatur}` führt in die Zahlung DERSELBEN Bestellung —
 * ihr gespeicherter PaymentIntent, keine zweite Bestellung, keine zweite
 * Reservierung. Wie die Wiederholung in /api/checkout
 * (antwortFuerBestehendeBestellung) wird der Zahlungsvorgang gelesen, nie
 * neu angelegt. Ohne gültige Signatur keine Abfrage und dieselbe Kasse wie
 * ohne Parameter — ob es die Bestellung gibt, verrät die Seite nicht.
 * Storniert oder nach der Frist: die Kasse mit dem Korb, den die
 * Bestätigungsseite nicht geleert hat (korbLeeren).
 */
async function ladeFortsetzung(farm: PublicFarm, suche: Record<string, string | string[] | undefined>, jetzt: Date): Promise<Fortsetzung> {
  const orderId = suche[FORTSETZEN_PARAMETER]
  if (typeof orderId !== 'string') return KASSE
  const { sig } = bestaetigungsParameterSchema.parse(suche)
  if (!sig || !bestellLinkGilt(orderId, sig)) return KASSE

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      farmId: true,
      status: true,
      paymentMethod: true,
      paymentStatus: true,
      stripePaymentIntentId: true,
      serviceFeeCents: true,
      createdAt: true,
      pickupDate: true,
      pickupTimeStart: true,
      pickupTimeEnd: true,
      // Die Adresse zeigt auch die Bestätigungsseite, solange die Bestellung läuft; den Namen nie (Nr. 153).
      customerEmail: true,
      items: {
        select: {
          productId: true,
          productName: true,
          quantity: true,
          unitPrice: true,
          product: { select: { unit: true, unitSize: true, imageUrl: true } },
        },
      },
    },
  })
  if (!order || order.farmId !== farm.id) return KASSE

  const pfad = bestaetigungsPfad(farm.slug, order.id)
  const ziel = fortsetzungsZiel(order, jetzt)
  if (ziel === 'kasse') return KASSE
  if (ziel === 'bestaetigung' || !order.stripePaymentIntentId) return { art: 'bestaetigung', pfad }

  // Kein try: Scheitert Stripe, zeigt Next die Fehlerseite — eine Kasse daneben führte in eine zweite Bestellung.
  // Dynamisch: Die Kasse ohne Parameter lädt das Stripe-Paket nie (tests/schwere-module.test.ts).
  const { stripe } = await import('@/lib/stripe')
  const intent = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId)
  const nachIntent = zielNachIntent(intent.status)
  if (nachIntent === 'kasse') return KASSE
  if (nachIntent === 'bestaetigung' || !intent.client_secret) {
    // Unterwegs oder durch, der Webhook fehlt noch: dort „Zahlung wird geprüft".
    return { art: 'bestaetigung', pfad: `${pfad}&redirect_status=${intent.status === 'succeeded' ? 'succeeded' : 'processing'}` }
  }

  // Nur Anzeige: der Betrag des Zahlungsvorgangs, wie Stripe ihn führt (wie in antwortFuerBestehendeBestellung).
  const betrag = { amountCents: intent.amount, serviceFeeCents: order.serviceFeeCents }
  return {
    art: 'zahlung',
    zahlung: {
      clientSecret: intent.client_secret,
      bestaetigung: pfad,
      reserviertBis: fristVon(order).toISOString(),
      betrag,
      gebuehrText: zahlungsGebuehrText(farm, jetzt, betrag),
      abholung: abholZeitText(order, jetzt),
      name: '',
      email: order.customerEmail,
    },
    positionen: order.items.map((item) => ({
      productId: item.productId,
      name: item.productName,
      imageUrl: item.product?.imageUrl ?? null,
      quantity: item.quantity,
      unit: item.product?.unit ?? '',
      unitSize: gebindeGroesse(item.product?.unitSize),
      // Decimal → Cent → Euro an der Servergrenze (CODING_STANDARDS §2): so führt der Korb im Browser den Preis.
      price: centsAlsEuro(alsCents(item.unitPrice)),
    })),
  }
}

export default async function CheckoutPage({ params, searchParams }: Props) {
  const { farmSlug } = await params
  // `?kaeufer=betrieb` aus „Region › Futter kaufen" (Nr. 29): nur der Startwert
  // des Hakens „Betrieb" — Ungültiges fällt im Schema still weg.
  const suche = await searchParams
  const kaeufer = leseKaeuferVorbelegung(suche[KAEUFER_PARAMETER])
  const farm = await getPublicFarmGeteilt(farmSlug)

  if (!farm) notFound()

  // Abschnitt „Betrieb" (Sprint Bereiche 1): welche Produkte nur an Betriebe
  // gehen, und — ist der Besteller selbst ein Hof — die Vorbelegung. Die
  // Session wird hier auf dem Server gelesen wie im Bauern-Bereich; kein
  // zusätzlicher Request aus dem Browser. Gast bleibt Gast.
  const session = await auth.api.getSession({ headers: await headers() })
  // Frist gilt beim Lesen (src/lib/fristen.ts): Verwaiste Bestellungen geben
  // ihren Platz im Abholfenster frei, BEVOR gezählt wird — sonst stünde ein
  // Fenster als „ausgebucht" da, das /api/checkout annehmen würde.
  await gibVerwaisteFreiOhneRisiko(farm.id)

  // Volle Abholfenster (maxOrders erreicht) zeigt das Formular ausgegraut —
  // dieselbe Zählung, mit der /api/checkout ablehnt (src/server/abholfenster.ts).
  const jetzt = new Date()

  // Vor der Kaufsperre: Eine Pause hält neue Bestellungen an, nicht die Zahlung einer bestehenden.
  const fortsetzung = await ladeFortsetzung(farm, suche, jetzt)
  if (fortsetzung.art === 'bestaetigung') redirect(fortsetzung.pfad)
  if (fortsetzung.art === 'zahlung') {
    return <ZahlungFortsetzen farm={farm} zahlung={fortsetzung.zahlung} positionen={fortsetzung.positionen} jetztIso={jetzt.toISOString()} />
  }

  const [nurBetriebeIds, ausHof, volleTage] = await Promise.all([
    getNurBetriebeProduktIds(farm.id),
    session?.user ? getBetriebsVorbelegung(session.user.id) : Promise.resolve(null),
    ausgebuchteTage([farm.id], jetzt),
  ])
  const voll = volleTage.get(farm.id)
  // N38 (Nr. 197): Bar nur, wenn die Plattformgebühr einen Weg zur Plattform hat (barMoeglich) —
  // dieselbe Lage wie /api/checkout; sonst bietet die Kasse nur online an. Ohne Zeile: wie bisher.
  const gebuehrHof = await prisma.farm.findUnique({ where: { id: farm.id }, select: HOF_FUER_GEBUEHR_LAGE })
  const barMoeglich = gebuehrHof ? await ladeBarMoeglich(gebuehrHof, jetzt) : true
  // Die Kaufsperre (Register N24) einmal hier, aus derselben Zählung wie die ausgegrauten Termine —
  // das Formular rechnet sie nicht selbst. Verbindlich bleibt /api/checkout.
  const sperre = kaufSperre({ isPaused: farm.isPaused, adminGesperrt: farm.adminGesperrt, pickupSlots: farm.pickupSlots.map((s) => alsAbholFenster(s, voll)) }, jetzt)
  // Pause: keine Kasse, aber auch kein 404 — Macht der Hof während des Einkaufs Pause, sieht die Kundin die
  // Pausen-Karte mit Wegen (Nr. 176). Ein unbekannter Hof ist oben schon beim 404 gelandet.
  if (sperre === 'pause') return <KassePausiert farm={farm} />

  // Die Fokus-Shell (Nachtlauf Nr. 12) rendert CheckoutForm selbst: Ihr
  // „Zurück" hängt am Zustand im Browser — hinaus zum Hof nur, solange keine
  // Bestellung steht (kassenZurueck, src/lib/kasse.ts).
  // Testbetrieb (Register Z2): nur der Wahrheitswert geht in den Browser.
  return (
    <CheckoutForm
      farm={farm}
      nurBetriebeIds={nurBetriebeIds}
      vorbelegung={kassenVorbelegung(ausHof, kaeufer)}
      ausgebuchteAbholfenster={ausgebuchteSchluessel(voll)}
      sperre={sperre}
      testbetrieb={TESTBETRIEB}
      barMoeglich={barMoeglich}
    />
  )
}
