import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { alsCents } from '@/lib/order-totals'
import { bestellLinkGilt, bestellungPfad, kalenderPfad } from '@/lib/bestell-link'
import { widerrufPfad } from '@/lib/bestell-link'
import { widerrufMoeglich } from '@/lib/widerruf'
import { WiderrufLink } from '@/components/bestaetigung/widerruf-link'
import {
  abholTerminZeile,
  bestaetigungsBloecke,
  bestaetigungsKopf,
  bestaetigungsZustand,
  bestaetigungZeigtPerson,
  bestellSchritte,
  fristHinweisTitel,
  korbLeeren,
  neuigkeitenErlaubt,
} from '@/lib/bestaetigung'
import { positionMengeVorn, zahlungFortsetzenPfad } from '@/lib/kasse'
import { zahlungsAnzeige } from '@/lib/bestellstatus'
import { buildMapsUrl } from '@/lib/customer-links'
import { bestaetigungsParameterSchema } from '@/schemas/bestaetigung'
import { ClearCartOnMount } from '@/components/checkout/clear-cart-on-mount'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import {
  AbholKarte,
  BestaetigungKopf,
  BestellPositionen,
  FristHinweis,
  Hauptaktion,
  KARTE,
  KNOPF_BREIT_RAHMEN,
  StatusSchritte,
} from '@/components/bestaetigung/bestaetigung-teile'
import { HofErreichen } from '@/components/bestaetigung/hof-erreichen'
import { HofTeilenKarte } from '@/components/bestaetigung/hof-teilen-karte'
import { NeuigkeitenKarte } from '@/components/bestaetigung/neuigkeiten-karte'
import { BarLinkErneutSenden } from '@/components/bestaetigung/bar-link-erneut-senden'
import { barLinkErneutMoeglich } from '@/lib/bar-bestaetigung'
import { fristVon } from '@/lib/fristen'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'
import { LAUFENDE_STATUS } from '@/lib/bestellungen-finden'
import { hofSichtbar } from '@/lib/hof-sichtbar'

interface Props {
  params: Promise<{ farmSlug: string; orderId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

// Eine Seite mit E-Mail (solange offen) und Bestellung: nie in einen Suchindex, und die
// signierte Adresse geht beim Klick auf einen Link nicht als Referrer mit
// (dazu der Header in next.config.ts).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

/** Die Spalte der Seite: 896 px wie im Board w1-bestaetigung (ab 768 px Karten paarweise), am Handy mit 16 px Rand. */
const SPALTE = 'mx-auto flex w-full max-w-[928px] flex-col gap-4 px-4 pt-6 pb-12 md:px-4 md:pt-8'

/** Zwei Karten nebeneinander ab 768 px (Abholung · Hof erreichen, Erzähl's weiter · Neuigkeiten). */
const PAAR = 'grid items-start gap-4 md:grid-cols-2'

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
  // Kein ClearCartOnMount (Nr. 202, Audit Phase 3 Punkt 12): Ohne Signatur kennt die
  // Seite den Stand nicht — ein alter Link oder ein Lesezeichen leert keinen neuen Korb.
  return (
    // Board s1-bestaetigung Bild 4: am Handy die Titelzeile „Bestellung“ statt Marke und Knopf.
    <KundeShellMitSitzung unterleiste={false} handyTitel="Bestellung" fussSpalte="md:max-w-[608px]">
      {/* Board s1-/w1-bestaetigung Bild 4: eine Karte mit Überschrift, Satz und dem einen Weg zu den Höfen. */}
      <div className={cn(SPALTE, 'max-w-[592px]')}>
        <div className={cn(KARTE, 'flex flex-col gap-3')}>
          <BestaetigungKopf
            kopf={{
              ton: 'gruen',
              symbol: 'haken',
              titel: 'Deine Bestellung ist eingegangen',
              satz: 'Danke – alle Details stehen in deiner E-Mail.',
            }}
            satzLeise
          />
          <Link href="/hoefe" className={KNOPF_BREIT_RAHMEN}>
            Höfe entdecken
          </Link>
        </div>
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
      // N38 (Nr. 197): im Hofpreis-Modell heißt die Zeile „Plattformgebühr“.
      gebuehrModell: true,
      // Keine Personendaten hier (Nr. 153): Den Namen zeigt die Seite nie, die
      // E-Mail holt `adresseSolangeOffen` nur für eine laufende Bestellung.
      createdAt: true,
      cancelReason: true,
      // Nr. 200 (N39): ob „Vertrag widerrufen“ erscheint (widerrufMoeglich).
      kaeuferArt: true,
      pickedUpAt: true,
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
          // Für „Hof erreichen" (Nr. 60) — getOrder läuft erst nach der Signaturprüfung.
          phone: true,
          email: true,
          archivedAt: true,
          geschlossenAm: true,
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

/**
 * Die E-Mail der Kundin, nur solange die Bestellung läuft (Register S17
 * Punkt 3, Nr. 153). Der Status-Filter steht in der Abfrage selbst: Schließt
 * der Hof die Bestellung zwischen beiden Abfragen ab, kommt keine Adresse.
 */
async function adresseSolangeOffen(orderId: string, status: Parameters<typeof bestaetigungZeigtPerson>[0]) {
  if (!bestaetigungZeigtPerson(status)) return null
  const person = await prisma.order.findUnique({
    where: { id: orderId, status: { in: [...LAUFENDE_STATUS] } },
    select: { customerEmail: true },
  })
  return person?.customerEmail ?? null
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
  if (!order || order.farm.slug !== farmSlug || !hofSichtbar(order.farm)) notFound()

  // Erst nach gibVerwaisteFreiOhneRisiko: Eine verfallene Barbestellung ist
  // dann schon storniert und bekommt keine Adresse mehr.
  const customerEmail = await adresseSolangeOffen(order.id, order.status)

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
    customerEmail,
    hofName: order.farm.name,
  })
  const schritte = bestellSchritte(order, jetzt)
  const frist = fristVon(order)
  // Mit Wochentag und Datum (V9): „heute, Mi, 3. März, 15:00–18:00 Uhr“.
  const abholZeit = abholTerminZeile(order, jetzt)
  const adresse = `${order.farm.address}, ${order.farm.postalCode} ${order.farm.city}`
  // Der signierte Weg zurück zur Bestellung (Sprint Bestellverfolgung):
  // dieselbe Adresse steht als Knopf in der Bestätigungs-Mail.
  const bestellungHref = bestellungPfad(farmSlug, order.id)

  const positionen = order.items.map((item) => ({
    // Menge vorn wie im Board („2 × Bergkäse, 250 g · € 13,16“, s1-/w1-bestaetigung).
    text: positionMengeVorn({
      name: item.productName,
      quantity: item.quantity,
      unit: item.product?.unit ?? null,
      unitSize: item.product?.unitSize ?? null,
    }),
    // Decimal → Cent an der Servergrenze (CODING_STANDARDS §2, Geld).
    betragCents: alsCents(item.totalPrice),
    fehlt: Boolean(item.fehltSeit),
  }))

  // Die eine Hauptaktion unten (Board): „Bestellung ansehen“, daneben leise „Weiter einkaufen“ — auch bar offen
  // (Board Bild 3). Neu bestellen nach Verfall, die Zahlung derselben Bestellung nach einem Fehlschlag.
  const hauptaktion =
    bloecke.aktion === 'neu-bestellen'
      ? { haupt: { href: `/${farmSlug}`, text: 'Neu bestellen' } }
      : bloecke.aktion === 'erneut-versuchen'
        ? // Die Zahlung DERSELBEN Bestellung (Nr. 202); ob sie noch geht, prüft die Kasse beim Laden.
          { haupt: { href: zahlungFortsetzenPfad(farmSlug, order.id, sig), text: 'Erneut versuchen' } }
        : { haupt: { href: bestellungHref, text: 'Bestellung ansehen' }, neben: { href: `/${farmSlug}`, text: 'Weiter einkaufen' } }

  return (
    // Boards s1-/w1-bestaetigung (Lauf 31): am Handy die Titelzeile „Bestellung bei <Hof>“, im Browser der Seitenfuß in
    // der Spalte der Seite (896 px Inhalt).
    // Ab 768 px steht die Hauptaktion fest unten (w1-bestaetigung, Runde 2): Der Seitenfuß hält darunter Platz frei.
    <KundeShellMitSitzung unterleiste={false} handyTitel={`Bestellung bei ${order.farm.name}`} fussSpalte="md:max-w-[944px]" platzFuerLeiste>
      {/* Nur, wenn die Bestellung steht oder bar wartet (korbLeeren, Nr. 202): Nach gescheiterter Zahlung bleibt der Korb. */}
      {korbLeeren(zustand) && <ClearCartOnMount />}
      <div className={SPALTE}>
        {/* Je Zustand ein klarer Kopf (Board): „Bestellung bei <Hof>“ nur als Kicker darüber. Bar offen steht der Satz
            in der Karte mit der Frist. */}
        <BestaetigungKopf kopf={kopf} kicker={`Bestellung bei ${order.farm.name}`} ohneSatz={bloecke.fristHinweis} />

        {/* Bar offen (V87): die Frist aus fristVon, der Satz an die Kundin, der Termin — und Nr. 151: die Mail mit dem
            Bestätigungslink neu anfordern, solange die Barbestellung offen ist. Keine Abholkarte (bestaetigungsBloecke). */}
        {bloecke.fristHinweis ? (
          <FristHinweis titel={fristHinweisTitel(frist, jetzt)} satz={`${kopf.satz} Abholung: ${abholZeit}.`}>
            {barLinkErneutMoeglich(order, jetzt) && <BarLinkErneutSenden orderId={order.id} sig={sig} />}
          </FristHinweis>
        ) : (
          barLinkErneutMoeglich(order, jetzt) && <BarLinkErneutSenden orderId={order.id} sig={sig} />
        )}

        {schritte && <StatusSchritte schritte={schritte} />}

        {bloecke.abholkarte && (
          <div className={PAAR}>
            <AbholKarte
              bestellnummer={order.orderNumber}
              abholZeit={abholZeit}
              hofName={order.farm.name}
              adresse={adresse}
              routeHref={buildMapsUrl(order.farm.address, order.farm.postalCode, order.farm.city)}
              kalenderHref={bloecke.kalender ? kalenderPfad(farmSlug, order.id) : null}
            />
            {/* Telefon und E-Mail des Hofs erst nach dem Kauf (Nr. 60): mit der Abholkarte, also wenn die Bestellung läuft. */}
            <HofErreichen telefon={order.farm.phone} email={order.farm.email} />
          </div>
        )}

        <BestellPositionen
          positionen={positionen}
          summen={order}
          zahlung={`${zahlung.art} · ${zahlung.zustand}`}
          // Bar offen nennt die Karte mit der Frist Termin und Adresse schon (Board Bild 3: keine Zeile darunter).
          fuss={
            !bloecke.abholkarte &&
            !bloecke.fristHinweis && (
              <p className="text-[12px] leading-normal break-words text-muted-foreground">
                Bestellnummer {order.orderNumber} · Abholung: {abholZeit} · {adresse}
              </p>
            )
          }
        />

        {/* Bar offen zeigt das Board nach der Bestellung nichts mehr (s1-/w1-bestaetigung Bild 3, Lauf 31): Die Karte
            der Neuigkeiten kommt, sobald die Bestellung bestätigt ist — die Seite, auf die der Link der Mail führt. */}
        {(bloecke.teilen || (neuigkeiten && !bloecke.fristHinweis)) && (
          <div className={PAAR}>
            {/* Nur Name und Slug: geteilt wird die öffentliche Hofseite, nie diese signierte Adresse. */}
            {bloecke.teilen && <HofTeilenKarte hofName={order.farm.name} hofSlug={order.farm.slug} />}
            {/* Register N2 (Nr. 46): die Neuigkeiten-Anmeldung, vorher ein Haken in der Kasse.
                Kennung und Signatur stehen ohnehin in der Adresse dieser Seite; welche
                Adresse angemeldet wird, nimmt der Server aus der Bestellung. */}
            {neuigkeiten && !bloecke.fristHinweis && (
              <NeuigkeitenKarte orderId={order.id} sig={sig} hofName={order.farm.name} email={customerEmail ?? undefined} />
            )}
          </div>
        )}

        {/* Nr. 200 (N39, § 13a FAGG): der Weg zum Widerruf — nur wenn widerrufen werden kann, auch nach der Abholung in der
            14-Tage-Frist. Die Beschriftung bleibt „Vertrag widerrufen“ bis zur Entscheidung der Anwältin (N43 (1), V88). */}
        {widerrufMoeglich(order, jetzt) && <WiderrufLink href={widerrufPfad(order.id)} />}

        <Hauptaktion {...hauptaktion} />
      </div>
    </KundeShellMitSitzung>
  )
}
