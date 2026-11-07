import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { bestellLinkGilt, bestellSignatur, widerrufPfad } from '@/lib/bestell-link'
import { widerrufMoeglich } from '@/lib/widerruf'
import { WiderrufLink } from '@/components/bestaetigung/widerruf-link'
import { bestellStatusAnzeige, formatiereAbholtermin } from '@/lib/bestellstatus'
import { positionMengeVorn } from '@/lib/format'
import { alsCents } from '@/lib/order-totals'
import { cn } from '@/lib/utils'
import { Marke } from '@/components/ui/marke'
import { Textlink } from '@/components/ui/textlink'
import { AbholKarte, BestellPositionen, KARTE, KNOPF_BREIT_RAHMEN } from '@/components/bestaetigung/bestaetigung-teile'
import { abholTerminZeile, BESTELLSEITE_LINK_UNGUELTIG, BESTELLSEITE_OHNE_STORNO, kalenderTerminGilt } from '@/lib/bestaetigung'
import { buildMapsUrl } from '@/lib/customer-links'
import { HofErreichen } from '@/components/bestaetigung/hof-erreichen'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { hofSichtbar } from '@/lib/hof-sichtbar'

/**
 * Die Bestellseite der Kundin — erreichbar NUR über den signierten Link aus
 * der Bestätigungs- bzw. Abholbereit-Mail (?s=HMAC über die Bestell-ID,
 * src/lib/bestell-link.ts). Die Seite LIEST nur: kein Konto, keine
 * Stornierung, keine Bestell-Historie — bewusste Grenzen dieses Sprints.
 *
 * Ohne gültige Signatur erscheint für JEDEN Fall dieselbe ruhige Seite —
 * auch für eine Bestell-ID, die es gar nicht gibt, einen fremden Hof-Slug
 * oder einen stillgelegten Hof. Wer Links durchprobiert, erfährt so nicht
 * einmal, OB eine Bestellung existiert.
 *
 * Neues Design seit Nr. 54, seit Lauf 31 nach dem Board s1-/w1-bestellung-link: KundeShell OHNE Unterleiste, am
 * Handy mit der Titelzeile „Deine Bestellung“ — keine feste Aktionsleiste; von hier geht es über die Links im Inhalt
 * zum Hof. Die Bausteine (Karte, Positionen, Knöpfe) sind die der Bestätigungsseite: dieselbe Bestellung sieht an
 * beiden Stellen gleich aus. Zugang, Abfrage und ICS-Link sind unverändert.
 */

interface Props {
  params: Promise<{ farmSlug: string; orderId: string }>
  searchParams: Promise<{ s?: string }>
}

// Eine private Seite mit Kundendaten hat in Suchmaschinen nichts verloren —
// egal, wo der Link später landet.
export const metadata = {
  robots: { index: false, follow: false },
}

/**
 * Die Spalte der Seite: wie die Bestätigungsseite (Board w1-bestellung-link), am Handy mit 16 px Rand. Im Browser kein
 * Polster unten: Bis zur Linie des Seitenfußes bleiben so rund 20 px wie im Board (UI-Runde 3), der Fuß bringt sein
 * eigenes Polster mit. Die Abstände zwischen den Karten bleiben 16 px wie im Skeleton (loading.tsx, Nr. 227).
 */
const SPALTE = 'mx-auto flex w-full max-w-[928px] flex-col gap-4 px-4 pt-6 pb-12 md:pt-8 md:pb-0'

/** Zwei Karten nebeneinander ab 768 px (Abholung · Hof erreichen). */
const PAAR = 'grid items-start gap-4 md:grid-cols-2'

/**
 * Lauf 31 (Board s1-bestellung-link): am Handy die Titelzeile „Deine Bestellung“ und keine Unterleiste — die Seite
 * kommt aus einer Mail, ihre Wege hinaus sind die Links im Inhalt. Im Browser der Seitenfuß in der Spalte der Seite.
 */
const HANDY_TITEL = 'Deine Bestellung'

function LinkUngueltig() {
  return (
    <KundeShellMitSitzung unterleiste={false} handyTitel={HANDY_TITEL} fussSpalte="md:max-w-[600px]">
      {/* Ohne gültige Signatur ist nicht einmal der Hof bestätigt — der
          Ausweg führt deshalb zur Hofübersicht, nicht zu /{farmSlug}. */}
      {/* Board s1-/w1-bestellung-link Bild 4: eine Karte mit Überschrift, Satz und dem einen Weg zur Hofübersicht. */}
      <div className="mx-auto w-full max-w-[552px] px-4 pt-6 pb-12 md:pt-10">
        <div className={cn(KARTE, 'flex flex-col gap-2.5')}>
          <h1 className="font-heading text-[24px] leading-tight font-semibold text-foreground">
            {BESTELLSEITE_LINK_UNGUELTIG.titel}
          </h1>
          <p className="text-[15px] leading-normal text-muted-foreground">{BESTELLSEITE_LINK_UNGUELTIG.satz}</p>
          <Link href="/hoefe" className={cn(KNOPF_BREIT_RAHMEN, 'mt-1')}>
            Zur Hofübersicht
          </Link>
        </div>
      </div>
    </KundeShellMitSitzung>
  )
}

export default async function BestellungPage({ params, searchParams }: Props) {
  const { farmSlug, orderId } = await params
  const { s } = await searchParams

  // Signatur ZUERST — vor jedem Datenbank-Zugriff. Eine unsignierte Anfrage
  // löst nicht einmal eine Abfrage aus.
  if (!s || !bestellLinkGilt(orderId, s)) return <LinkUngueltig />

  const order = await prisma.order.findUnique({
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
      // Der angewendete Satz für die Zahlzeile („inkl. Plattformgebühr (6 %)“, Nr. 253) — Snapshot, nie die Hofeinstellung.
      serviceFeePercentApplied: true,
      pickupDate: true,
      pickupTimeStart: true,
      pickupTimeEnd: true,
      // Nr. 200 (N39): ob „Vertrag widerrufen“ erscheint (widerrufMoeglich).
      kaeuferArt: true,
      pickedUpAt: true,
      farm: {
        // Telefon und E-Mail für „Hof erreichen" (Nr. 60) — gelesen erst
        // hinter der Signatur oben, nie über die Bestellnummer.
        select: { slug: true, name: true, address: true, postalCode: true, city: true, phone: true, email: true, archivedAt: true, geschlossenAm: true },
      },
      items: {
        select: {
          productName: true,
          quantity: true,
          unitPrice: true,
          totalPrice: true,
          // „Artikel fehlt" (E14): die Position steht da, ist aber nicht mehr im Betrag.
          fehltSeit: true,
          // Einheit nur zur Anzeige gejoint — dieselbe Schreibweise wie auf
          // der Bestätigungsseite (positionMengeVorn, src/lib/format.ts).
          product: { select: { unit: true, unitSize: true } },
        },
      },
    },
  })

  // Dieselbe ruhige Seite wie bei falscher Signatur (siehe Kopfkommentar);
  // stillgelegte Höfe wie auf der Bestätigungsseite (confirm/[orderId]).
  if (!order || order.farm.slug !== farmSlug || !hofSichtbar(order.farm)) return <LinkUngueltig />

  const abholtermin = formatiereAbholtermin(
    order.pickupDate,
    order.pickupTimeStart,
    order.pickupTimeEnd
  )
  const status = bestellStatusAnzeige(order.status, abholtermin, order.paymentMethod)
  // Einmal je Anfrage bestimmt — Server-Komponente, kein Hydration-Abgleich.
  const jetzt = new Date()

  const storniert = order.status === 'CANCELLED'
  const adresse = `${order.farm.address}, ${order.farm.postalCode} ${order.farm.city}`

  const positionen = order.items.map((item) => ({
    // Menge vorn wie im Board („2 × Bergkäse, 250 g · € 13,16“, s1-/w1-bestellung-link Bild 1).
    text: positionMengeVorn({
      name: item.productName,
      quantity: item.quantity,
      unit: item.product?.unit ?? null,
      unitSize: item.product?.unitSize ?? null,
    }),
    // Decimal → Cent an der Servergrenze (CODING_STANDARDS §2, Geld).
    betragCents: alsCents(item.totalPrice),
    // „Artikel fehlt" (E14): die Position steht da, ist aber nicht mehr im Betrag.
    fehlt: Boolean(item.fehltSeit),
  }))

  return (
    <KundeShellMitSitzung unterleiste={false} handyTitel={HANDY_TITEL} fussSpalte="md:max-w-[944px]">
      {/* Zurück führt hier NIE durch den Verlauf — die Seite kommt aus einer
          Mail. Die Wege hinaus sind echte Links: zum Hof und über die Shell. */}
      <div className={SPALTE}>
        {/* Board s1-/w1-bestellung-link (Nr. 227): „Deine Bestellung bei <Hof>“ als grüner Link darüber, die
            Bestellnummer als h1 mit dem Schild des Status (Art aus bestellStatusAnzeige, Register G5 — dieselbe wie
            die Liste, storniert rot). Den Satz an die Kundin zeigt das Board hier nicht (Lauf 31): Termin und Stand stehen
            in Schild und Abholkarte. */}
        {/* Liste Lauf 32 (bestellung-link): Link 15 px wie der Textlink-Baustein, h1 24 px, 12 px Abstand darunter. */}
        <div className="flex flex-col gap-3">
          <Textlink href={`/${order.farm.slug}`} className="self-start break-words underline">
            Deine Bestellung bei {order.farm.name}
          </Textlink>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="min-w-0 font-heading text-[24px] leading-tight font-semibold break-words text-foreground">
              {order.orderNumber}
            </h1>
            <Marke art={status.art} form="schild">
              {status.marke}
            </Marke>
          </div>
        </div>

        {/* Abholung und „Hof erreichen“ — bei stornierten Bestellungen entfallen beide: ein Termin samt
            Kalender-Knopf wäre eine falsche Einladung. „In den Kalender“ ist hier die eine grüne Hauptaktion und
            steht nur, solange es den Termin gibt (kalenderTerminGilt — dieselbe Antwort wie die ICS-Route). */}
        {!storniert && (
          <div className={PAAR}>
            <AbholKarte
              bestellnummer={order.orderNumber}
              abholZeit={abholTerminZeile(order, jetzt)}
              hofName={order.farm.name}
              adresse={adresse}
              routeHref={buildMapsUrl(order.farm.address, order.farm.postalCode, order.farm.city)}
              // Ein LINK, kein Formular: die ICS-Antwort trägt denselben signierten Zugang wie diese Seite.
              kalenderHref={kalenderTerminGilt(order.status) ? `/${order.farm.slug}/bestellung/${order.id}/kalender?s=${bestellSignatur(order.id)}` : null}
              kalenderHaupt
            />
            {/* Nach dem Kauf: der Weg zum Hof, wenn etwas dazwischenkommt. */}
            <HofErreichen telefon={order.farm.phone} email={order.farm.email} />
          </div>
        )}

        {/* Dieselben Zeilen wie auf der Bestätigungsseite — aus dem Snapshot der Bestellung. Board s1-/w1-bestellung-link
            Bild 1: kein eigenes „Gesamt“, derselbe Betrag steht in der Zahlzeile („… · € 19,12 inkl. Plattformgebühr“). */}
        <BestellPositionen
          titel="Positionen"
          positionen={positionen}
          summen={order}
          summeInZahlzeile
        />

        <Link href={`/${order.farm.slug}`} className={KNOPF_BREIT_RAHMEN}>
          Zum Hof
        </Link>

        {/* Nr. 200 (N39, § 13a FAGG): der Weg zum Widerruf — nur solange er möglich ist. */}
        {widerrufMoeglich(order, jetzt) && <WiderrufLink href={widerrufPfad(order.id)} />}

        {/* Die Seite liest nur (Kopfkommentar): Stornieren gibt es hier nicht, für Änderungen ist der Hof da. */}
        <p className="text-[13px] leading-normal text-muted-foreground">{BESTELLSEITE_OHNE_STORNO}</p>
      </div>
    </KundeShellMitSitzung>
  )
}
