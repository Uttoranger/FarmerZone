import Link from 'next/link'
import { CalendarPlus, LinkIcon, MapPin } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { bestellLinkGilt, bestellSignatur } from '@/lib/bestell-link'
import { bestellStatusAnzeige, formatiereAbholtermin, zahlungsAnzeige } from '@/lib/bestellstatus'
import { bestellTon } from '@/lib/bestellungen-finden'
import { formatPosition } from '@/lib/format'
import { alsCents } from '@/lib/order-totals'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Aktionen,
  AktionsLink,
  BestellPositionen,
  KARTE,
  KNOPF_GRUEN,
  KNOPF_RAHMEN,
} from '@/components/bestaetigung/bestaetigung-teile'
import { HofErreichen } from '@/components/bestaetigung/hof-erreichen'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'

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
 * Neues Design seit Nr. 54: KundeShell MIT Unterleiste — die Bestellseite ist
 * keine Fokus-Seite (DESIGN_SYSTEM „Fokus-Seiten ohne Unterleiste" nennt sie
 * nicht), sie hat keine feste Aktionsleiste, und von hier geht es zu den
 * Höfen oder zu „Meine Bestellungen" weiter. Die Bausteine (Karte,
 * Positionen, Knöpfe) sind die der Bestätigungsseite: dieselbe Bestellung
 * sieht an beiden Stellen gleich aus. Zugang, Abfrage und ICS-Link sind
 * unverändert.
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

/** Die Spalte der Seite: 640 px wie die Bestätigungsseite, am Handy mit 16 px Rand. */
const SPALTE = 'mx-auto flex w-full max-w-[640px] flex-col gap-4 px-4 pt-8 pb-12 md:pt-10'

/** Kleine Überschrift einer Karte in Großbuchstaben (wie „Abholung" auf der Bestätigungsseite). */
const ETIKETT = 'text-[11px] font-semibold tracking-[1.1px] text-muted-foreground uppercase'

function LinkUngueltig() {
  return (
    <KundeShellMitSitzung>
      {/* Ohne gültige Signatur ist nicht einmal der Hof bestätigt — der
          Ausweg führt deshalb zur Hofübersicht, nicht zu /{farmSlug}. */}
      <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-2.5 px-4 pt-10 pb-12 text-center md:pt-[60px]">
        <LinkIcon className="size-12 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        <h1 className="font-heading text-[22px] font-semibold text-foreground md:text-[28px]">
          Dieser Link ist nicht gültig
        </h1>
        <p className="text-[15px] leading-normal text-muted-foreground">
          Bitte öffne den Link genau so, wie er in deiner E-Mail steht — am
          einfachsten, indem du ihn direkt in der E-Mail antippst.
        </p>
        <Link href="/hoefe" className={cn(KNOPF_RAHMEN, 'mt-2')}>
          Zur Hofübersicht
        </Link>
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
      pickupDate: true,
      pickupTimeStart: true,
      pickupTimeEnd: true,
      farm: {
        // Telefon und E-Mail für „Hof erreichen" (Nr. 60) — gelesen erst
        // hinter der Signatur oben, nie über die Bestellnummer.
        select: { slug: true, name: true, address: true, postalCode: true, city: true, phone: true, email: true, archivedAt: true },
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
          // der Bestätigungsseite (formatPosition, src/lib/format.ts).
          product: { select: { unit: true, unitSize: true } },
        },
      },
    },
  })

  // Dieselbe ruhige Seite wie bei falscher Signatur (siehe Kopfkommentar);
  // stillgelegte Höfe wie auf der Bestätigungsseite (confirm/[orderId]).
  if (!order || order.farm.slug !== farmSlug || order.farm.archivedAt) return <LinkUngueltig />

  const abholtermin = formatiereAbholtermin(
    order.pickupDate,
    order.pickupTimeStart,
    order.pickupTimeEnd
  )
  const status = bestellStatusAnzeige(order.status, abholtermin, order.paymentMethod)
  const zahlung = zahlungsAnzeige(order.paymentMethod, order.paymentStatus)

  const pickupDatum = order.pickupDate.toLocaleDateString('de-AT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Vienna',
  })

  const storniert = order.status === 'CANCELLED'

  const positionen = order.items.map((item) => ({
    text: formatPosition({
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
    <KundeShellMitSitzung>
      {/* Zurück führt hier NIE durch den Verlauf — die Seite kommt aus einer
          Mail. Die Wege hinaus sind echte Links: zum Hof und über die Shell. */}
      <div className={SPALTE}>
        {/* Kopf als Karte wie in „Meine Bestellungen" und im Bestelldetail des
            Hofs: Die grüne StatusBadge erreicht auf dem hellen Seitengrund
            nur 4,37 : 1 (Axe), auf der Karte mindestens 4,5 : 1. */}
        <div className={cn(KARTE, 'flex flex-col gap-2')}>
          <p className="text-[13.5px] text-muted-foreground">
            Deine Bestellung bei{' '}
            <Link
              href={`/${order.farm.slug}`}
              className={cn('rounded-sm font-semibold break-words text-brand-text underline-offset-2 hover:underline', FOKUS_RAHMEN)}
            >
              {order.farm.name}
            </Link>
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="min-w-0 font-heading text-[26px] leading-tight font-semibold break-words text-foreground md:text-[28px]">
              {order.orderNumber}
            </h1>
            <StatusBadge status={bestellTon(order.status)}>{status.marke}</StatusBadge>
          </div>
          <p className="text-[14px] leading-normal text-foreground">{status.satz}</p>
        </div>

        {/* Abholung — bei stornierten Bestellungen entfällt der Block: ein
            Termin samt Kalender-Knopf wäre eine falsche Einladung. */}
        {!storniert && (
          <section aria-labelledby="abholung-titel" className={cn(KARTE, 'flex flex-col gap-1.5')}>
            <h2 id="abholung-titel" className={ETIKETT}>
              Abholung
            </h2>
            <p className="text-[17px] font-semibold text-foreground">{pickupDatum}</p>
            <p className="text-[14px] text-muted-foreground">
              {order.pickupTimeStart} – {order.pickupTimeEnd} Uhr
            </p>
            <p className="mt-1 flex items-start gap-2 text-[13px] leading-normal break-words text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
              <span className="min-w-0">
                {order.farm.name}
                <br />
                {order.farm.address}, {order.farm.postalCode} {order.farm.city}
              </span>
            </p>
            {/* Ein LINK, kein Formular: die ICS-Antwort trägt denselben
                signierten Zugang wie diese Seite. */}
            <a
              href={`/${order.farm.slug}/bestellung/${order.id}/kalender?s=${bestellSignatur(order.id)}`}
              className={cn(KNOPF_GRUEN, 'mt-2 gap-2 self-start')}
            >
              <CalendarPlus className="size-4" strokeWidth={1.7} aria-hidden="true" />
              Termin in den Kalender
            </a>
          </section>
        )}

        {/* Nach dem Kauf: der Weg zum Hof, wenn etwas dazwischenkommt — wie die Abholung nicht bei storniert. */}
        {!storniert && <HofErreichen telefon={order.farm.phone} email={order.farm.email} />}

        {/* Dieselben Zeilen wie auf der Bestätigungsseite — aus dem Snapshot der Bestellung. */}
        <BestellPositionen positionen={positionen} summen={order} zahlung={`${zahlung.art} · ${zahlung.zustand}`} />

        <Aktionen>
          <AktionsLink href={`/${order.farm.slug}`}>Zum Hof</AktionsLink>
        </Aktionen>
      </div>
    </KundeShellMitSitzung>
  )
}
