import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Clock, LinkIcon, XCircle } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { formatEuro, formatPosition } from '@/lib/format'
import { bestaetigungsPfad } from '@/lib/bestell-link'
import { barBestaetigungsAnsicht } from '@/lib/bar-bestaetigung'
import { fristVon, tagInWorten, uhrzeitInWien } from '@/lib/fristen'
import { zahlungsAnzeige } from '@/lib/bestellstatus'
import { SERVICEGEBUEHR_BEZEICHNUNG, bestellSummen, centsAlsEuro } from '@/lib/servicegebuehr'
import { barBestaetigungsTokenSchema } from '@/schemas/bar-bestaetigung'
import { KundenKopf } from '@/components/shared/kunden-kopf'
import { BarBestaetigenKnoepfe } from '@/components/checkout/bar-bestaetigen-knoepfe'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'

interface Props {
  params: Promise<{ farmSlug: string; token: string }>
}

// Ohne Anmeldung erreichbar, mit Hof, Positionen und Betrag (S1): nie in einen
// Suchindex, und der Token in der Adresse geht beim Klick auf einen Link
// nicht als Referrer mit (dazu der Header in next.config.ts).
export const metadata: Metadata = {
  title: 'Bestellung bestätigen',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

/**
 * Bar-Bestätigung per Knopf (H3) — Mockups
 * web-k3-bar-bestellung-bestaetigen-link-aus-mail.html und
 * mobil-k3-bar-bestaetigen.html. Fokus-Seite: keine Navigation unten.
 *
 * Der Aufruf ändert NICHTS: Link-Scanner und Vorschauen der Mailprogramme
 * rufen die Adresse ungefragt auf. Bestätigt wird erst mit dem Knopf
 * (src/server/actions/bar-bestaetigung.ts); was gezeigt wird, entscheidet
 * `barBestaetigungsAnsicht`. Name und E-Mail der Kundin stehen hier nie —
 * der Link kann weitergeleitet worden sein.
 */
export default async function BarBestaetigenSeite({ params }: Props) {
  const { farmSlug, token: roh } = await params
  const eingabe = barBestaetigungsTokenSchema.safeParse(roh)
  if (!eingabe.success) return <LinkUngueltig />
  const token = eingabe.data

  // Frist gilt beim Lesen (src/lib/fristen.ts): erst freigeben, dann lesen.
  const vorab = await prisma.order.findUnique({ where: { confirmationToken: token }, select: { farmId: true } })
  if (!vorab) return <LinkUngueltig />
  await gibVerwaisteFreiOhneRisiko(vorab.farmId)

  const order = await prisma.order.findUnique({
    where: { confirmationToken: token },
    select: {
      id: true,
      status: true,
      paymentMethod: true,
      cancelReason: true,
      createdAt: true,
      pickupDate: true,
      pickupTimeStart: true,
      pickupTimeEnd: true,
      totalAmount: true,
      serviceFeeCents: true,
      farm: { select: { slug: true, name: true, address: true, postalCode: true, city: true, archivedAt: true } },
      items: {
        select: {
          productName: true,
          quantity: true,
          totalPrice: true,
          // Einheit nur zur Anzeige gejoint
          product: { select: { unit: true, unitSize: true } },
        },
      },
    },
  })
  // Fremde Hofadresse oder stillgelegter Hof: wie ein unbekannter Token —
  // die Seite verrät nicht, ob es die Bestellung gibt.
  if (!order || order.farm.slug !== farmSlug || order.farm.archivedAt) return <LinkUngueltig />

  const jetzt = new Date()
  const ansicht = barBestaetigungsAnsicht(order, jetzt)
  if (ansicht === 'ungueltig') return <LinkUngueltig />
  // Schon bestätigt: Die signierte Bestätigungsseite zeigt den Stand aus der Datenbank.
  if (ansicht === 'erledigt') redirect(bestaetigungsPfad(order.farm.slug, order.id))

  if (ansicht === 'verfallen' || ansicht === 'storniert') {
    return (
      <Rahmen hofSlug={order.farm.slug} hofName={order.farm.name}>
        <div className="flex flex-col items-center gap-2.5 text-center">
          {ansicht === 'verfallen' ? (
            <Clock className="size-12 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <XCircle className="size-12 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
          )}
          <h1 className="font-heading text-[22px] font-semibold text-foreground md:text-[28px]">
            {ansicht === 'verfallen' ? 'Bestellung verfallen' : 'Bestellung storniert'}
          </h1>
          <p className="text-[15px] leading-normal text-muted-foreground">
            {ansicht === 'verfallen'
              ? 'Die Bestellung wurde nicht rechtzeitig bestätigt. Wir haben die Ware wieder freigegeben – dir entstehen keine Kosten.'
              : 'Die Bestellung ist storniert. Die Ware ist wieder frei – dir entstehen keine Kosten.'}
          </p>
        </div>
        <Link
          href={`/${order.farm.slug}`}
          className="flex h-[54px] w-full items-center justify-center rounded-full bg-accent px-[18px] text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
        >
          Neu bestellen
        </Link>
      </Rahmen>
    )
  }

  const bis = fristVon(order)
  const summen = bestellSummen(order)
  const adresse = `${order.farm.address}, ${order.farm.postalCode} ${order.farm.city}`

  return (
    <Rahmen hofSlug={order.farm.slug} hofName={order.farm.name}>
      <div className="flex flex-col items-center gap-2.5 text-center">
        <h1 className="font-heading text-[22px] font-semibold break-words text-foreground md:text-[28px]">
          Bestellung bei {order.farm.name} bestätigen
        </h1>
        <p className="text-[15px] leading-normal text-muted-foreground">
          Bitte bestätige bis {tagInWorten(bis, jetzt)}, {uhrzeitInWien(bis)} Uhr – erst dann packt der Hof für dich.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-[18px] py-4">
        {order.items.map((item, i) => {
          const name = formatPosition({
            name: item.productName,
            quantity: item.quantity,
            unit: item.product?.unit ?? null,
            unitSize: item.product?.unitSize ?? null,
          })
          return (
            <Zeile key={i} titel={name}>
              {/* Nur Anzeige eines gespeicherten Betrags — gerechnet wird damit nicht. */}
              {formatEuro(Number(item.totalPrice))}
            </Zeile>
          )
        })}
        {summen.gebuehrCents > 0 && (
          <Zeile titel={SERVICEGEBUEHR_BEZEICHNUNG}>{formatEuro(centsAlsEuro(summen.gebuehrCents))}</Zeile>
        )}
        <div className="h-px bg-border" />
        <div className="flex items-baseline gap-2 text-[15px] font-semibold text-foreground">
          <span>{zahlungsAnzeige(order.paymentMethod, 'PENDING').art}</span>
          <span className="grow" />
          <span>{formatEuro(centsAlsEuro(summen.gesamtCents))}</span>
        </div>
        <p className="text-[12.5px] leading-normal break-words text-muted-foreground">
          Abholung {tagInWorten(order.pickupDate, jetzt)}, {order.pickupTimeStart}–{order.pickupTimeEnd} Uhr · {adresse}
        </p>
      </div>

      <BarBestaetigenKnoepfe token={token} />
    </Rahmen>
  )
}

/** Eine Zeile der Karte: leiser Name links, Betrag rechts. Lange Namen höchstens zwei Zeilen. */
function Zeile({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 text-[13.5px]">
      <span className="line-clamp-2 min-w-0 break-words text-muted-foreground" title={titel}>
        {titel}
      </span>
      <span className="grow" />
      <span className="shrink-0 text-foreground">{children}</span>
    </div>
  )
}

/** Kopf und Spalte der Seite. `data-design="neu"`: Die Seite ist nach den neuen Mockups gebaut. */
function Rahmen({ hofSlug, hofName, children }: { hofSlug: string; hofName: string; children: ReactNode }) {
  return (
    <div data-design="neu" className="min-h-screen bg-background">
      {/* Zurück führt NIE durch den Verlauf — davor steht das Mailprogramm (kunden-kopf.ts). */}
      <KundenKopf seite={{ art: 'bestaetigung', hofSlug }} hofName={hofName} />
      <main className="mx-auto flex w-full max-w-[560px] flex-col gap-3 px-4 pt-3.5 pb-8 md:gap-[18px] md:pt-[60px]">
        {children}
      </main>
    </div>
  )
}

/**
 * Token unbekannt (schon benutzt, abgetippt), falsch geformt oder unter
 * fremder Hofadresse: kein Hof, keine Bestellung — nicht einmal, ob es sie
 * gibt. Der Kopf führt zur Hofübersicht.
 */
function LinkUngueltig() {
  return (
    <div data-design="neu" className="min-h-screen bg-background">
      <KundenKopf seite={{ art: 'bestellung-ungueltig' }} />
      <main className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-2.5 px-4 pt-10 text-center md:pt-[60px]">
        <LinkIcon className="size-12 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        <h1 className="font-heading text-[22px] font-semibold text-foreground md:text-[28px]">Dieser Link gilt nicht mehr</h1>
        <p className="text-[15px] leading-normal text-muted-foreground">
          Hast du schon bestätigt? Dann findest du deine Bestellung in der Bestätigungsmail. Sonst bestell einfach neu.
        </p>
        <Link
          href="/hoefe"
          className="mt-2 inline-flex h-11 items-center justify-center rounded-full border border-border px-[18px] text-sm font-medium text-foreground hover:bg-muted"
        >
          Höfe entdecken
        </Link>
      </main>
    </div>
  )
}
