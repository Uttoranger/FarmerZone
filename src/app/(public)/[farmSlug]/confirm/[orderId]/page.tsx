import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { formatPosition } from '@/lib/format'
import { alsCents } from '@/lib/order-totals'
import { bestellLinkGilt, bestellungPfad, kalenderPfad } from '@/lib/bestell-link'
import {
  abholZeitText,
  bestaetigungsBloecke,
  bestaetigungsKopf,
  bestaetigungsZustand,
  bestellSchritte,
  neuigkeitenErlaubt,
} from '@/lib/bestaetigung'
import { zahlungsAnzeige } from '@/lib/bestellstatus'
import { buildMapsUrl } from '@/lib/customer-links'
import { bestaetigungsParameterSchema } from '@/schemas/bestaetigung'
import { ClearCartOnMount } from '@/components/checkout/clear-cart-on-mount'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import {
  AbholKarte,
  Aktionen,
  AktionsLink,
  BestaetigungKopf,
  BestellPositionen,
  FristHinweis,
  StatusSchritte,
} from '@/components/bestaetigung/bestaetigung-teile'
import { HofTeilenKarte } from '@/components/bestaetigung/hof-teilen-karte'
import { NeuigkeitenKarte } from '@/components/bestaetigung/neuigkeiten-karte'
import { fristVon, tagInWorten, uhrzeitInWien } from '@/lib/fristen'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'

interface Props {
  params: Promise<{ farmSlug: string; orderId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

// Eine Seite mit Name, E-Mail und Bestellung: nie in einen Suchindex, und die
// signierte Adresse geht beim Klick auf einen Link nicht als Referrer mit
// (dazu der Header in next.config.ts).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

/** Die Spalte der Seite: 640 px wie im Mockup, am Handy mit 16 px Rand. */
const SPALTE = 'mx-auto flex w-full max-w-[640px] flex-col gap-4 px-4 pt-8 pb-12 md:pt-10'

/*
 * Neues Design (Nr. 13): KundeShell ohne Unterleiste — eine Fokus-Seite mit
 * Kopf wie die Produktseite (DESIGN_SYSTEM, „Fokus-Seiten ohne Unterleiste").
 * Einen Rückweg durch den Verlauf gibt es nicht: Davor stehen Stripe und die
 * Bank (ARCHITECTURE §4). Die Wege hinaus sind echte Links (Hof, Bestellung).
 */

/**
 * Ohne gültige Signatur: nur „eingegangen" — kein Name, keine E-Mail, keine
 * Artikel, keine Beträge, und keine Datenbankabfrage (auch nicht, ob es die
 * Bestellung gibt). Die Bestell-ID im Pfad ist ratbar und steht u. a. in den
 * Stripe-Metadaten; den signierten Link haben nur die Kundin und ihre Mails.
 * Ohne Signatur ist nicht einmal der Hof aus der Adresse bestätigt — der
 * Ausweg führt zur Hofübersicht, nicht zu einem beliebigen Pfad.
 */
function BestellungEingegangen() {
  return (
    <KundeShellMitSitzung unterleiste={false}>
      <ClearCartOnMount />
      <div className={SPALTE}>
        <BestaetigungKopf
          kopf={{
            ton: 'gruen',
            symbol: 'haken',
            titel: 'Deine Bestellung ist eingegangen',
            satz: 'Danke – alle Details stehen in deiner E-Mail.',
          }}
        />
        <Aktionen>
          <AktionsLink href="/hoefe">Höfe entdecken</AktionsLink>
        </Aktionen>
      </div>
    </KundeShellMitSitzung>
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
          // „Artikel fehlt" (E14): die Position steht da, ist aber nicht mehr im Betrag.
          fehltSeit: true,
          // Einheit nur zur Anzeige gejoint — kein Schema-Change
          product: { select: { unit: true, unitSize: true } },
        },
      },
    },
  })
}

export default async function ConfirmPage({ params, searchParams }: Props) {
  const { farmSlug, orderId } = await params
  const { sig, redirect_status } = bestaetigungsParameterSchema.parse(await searchParams)

  if (!sig || !bestellLinkGilt(orderId, sig)) return <BestellungEingegangen />

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
  const zahlung = zahlungsAnzeige(order.paymentMethod, order.paymentStatus)
  const bloecke = bestaetigungsBloecke(zustand, order.status)

  // Einmal je Anfrage bestimmt — Server-Komponente, kein Hydration-Abgleich.
  const jetzt = new Date()
  // Dieselbe Regel wie in der Action (Nr. 46, Runde 1): Die Karte steht nur,
  // wo die Anmeldung auch angenommen wird — aus der Datenbank, mit der Frist.
  const neuigkeiten = neuigkeitenErlaubt(order, jetzt)
  const kopf = bestaetigungsKopf(zustand, {
    status: order.status,
    paymentMethod: order.paymentMethod,
    customerEmail: order.customerEmail,
    hofName: order.farm.name,
  })
  const schritte = bestellSchritte(order, jetzt)
  const frist = fristVon(order)
  const abholZeit = abholZeitText(order, jetzt)
  const adresse = `${order.farm.address}, ${order.farm.postalCode} ${order.farm.city}`
  // Der signierte Weg zurück zur Bestellung (Sprint Bestellverfolgung):
  // dieselbe Adresse steht als Knopf in der Bestätigungs-Mail.
  const bestellungHref = bestellungPfad(farmSlug, order.id)

  const positionen = order.items.map((item) => ({
    text: formatPosition({
      name: item.productName,
      quantity: item.quantity,
      unit: item.product?.unit ?? null,
      unitSize: item.product?.unitSize ?? null,
    }),
    // Decimal → Cent an der Servergrenze (CODING_STANDARDS §2, Geld).
    betragCents: alsCents(item.totalPrice),
    fehlt: Boolean(item.fehltSeit),
  }))

  return (
    <KundeShellMitSitzung unterleiste={false}>
      {/* Die Bestellung ist abgeschickt — der Korb ist ab hier leer, in jedem Zustand. */}
      <ClearCartOnMount />
      <div className={SPALTE}>
        <BestaetigungKopf kopf={kopf} />

        {bloecke.fristHinweis && <FristHinweis bis={`${tagInWorten(frist, jetzt)}, ${uhrzeitInWien(frist)} Uhr`} />}

        {bloecke.abholkarte && (
          <AbholKarte
            bestellnummer={order.orderNumber}
            abholZeit={abholZeit}
            hofName={order.farm.name}
            adresse={adresse}
            routeHref={buildMapsUrl(order.farm.address, order.farm.postalCode, order.farm.city)}
            kalenderHref={bloecke.kalender ? kalenderPfad(farmSlug, order.id) : null}
          />
        )}

        {schritte && <StatusSchritte schritte={schritte} />}

        <BestellPositionen
          positionen={positionen}
          summen={order}
          zahlung={`${zahlung.art} · ${zahlung.zustand}`}
          fuss={
            !bloecke.abholkarte && (
              <p className="text-[12px] leading-normal break-words text-muted-foreground">
                Bestellnummer {order.orderNumber} · Abholung: {abholZeit} · {adresse}
              </p>
            )
          }
        />

        {/* Nur Name und Slug: geteilt wird die öffentliche Hofseite, nie diese signierte Adresse. */}
        {bloecke.teilen && <HofTeilenKarte hofName={order.farm.name} hofSlug={order.farm.slug} />}

        {/* Register N2 (Nr. 46): die Neuigkeiten-Anmeldung, vorher ein Haken in der Kasse.
            Kennung und Signatur stehen ohnehin in der Adresse dieser Seite; welche
            Adresse angemeldet wird, nimmt der Server aus der Bestellung. */}
        {neuigkeiten && (
          <NeuigkeitenKarte orderId={order.id} sig={sig} hofName={order.farm.name} email={order.customerEmail} />
        )}

        <Aktionen>
          {bloecke.aktion === 'bestellung' && (
            <>
              <AktionsLink href={bestellungHref} haupt>
                Bestellung ansehen
              </AktionsLink>
              <AktionsLink href={`/${farmSlug}`}>Weiter einkaufen</AktionsLink>
            </>
          )}
          {bloecke.aktion === 'neu-bestellen' && (
            <AktionsLink href={`/${farmSlug}`} haupt>
              Neu bestellen
            </AktionsLink>
          )}
          {bloecke.aktion === 'erneut-versuchen' && (
            <AktionsLink href={`/${farmSlug}/checkout`} haupt>
              Erneut versuchen
            </AktionsLink>
          )}
          {bloecke.aktion === 'keine' && (
            <>
              <AktionsLink href={bestellungHref}>Bestellung ansehen</AktionsLink>
              <AktionsLink href={`/${farmSlug}`}>Zum Hof</AktionsLink>
            </>
          )}
        </Aktionen>
      </div>
    </KundeShellMitSitzung>
  )
}
