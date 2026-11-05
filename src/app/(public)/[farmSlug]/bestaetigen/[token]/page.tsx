import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Clock, LinkIcon, XCircle } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { formatEuro, formatPosition } from '@/lib/format'
import { bestaetigungsPfad } from '@/lib/bestell-link'
import { LINK_UNGUELTIG_SATZ, LINK_UNGUELTIG_TITEL, barBestaetigungsAnsicht, tokenKandidaten } from '@/lib/bar-bestaetigung'
import { fristVon } from '@/lib/fristen'
import { abholTerminZeile, barBestaetigenSatz, barVerfallenSatz } from '@/lib/bestaetigung'
import { KARTE, KNOPF_BREIT_RAHMEN } from '@/components/bestaetigung/bestaetigung-stil'
import { zahlungsAnzeige } from '@/lib/bestellstatus'
import { bestellSummen, centsAlsEuro } from '@/lib/servicegebuehr'
import { gebuehrBezeichnungFuer } from '@/lib/plattformgebuehr'
import { barBestaetigungsTokenSchema } from '@/schemas/bar-bestaetigung'
import { cn } from '@/lib/utils'
import { KundeFokusShell } from '@/components/shells/kunde-shell'
import { BarBestaetigenKnoepfe } from '@/components/checkout/bar-bestaetigen-knoepfe'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'
import { hofSichtbar } from '@/lib/hof-sichtbar'

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
 * mobil-k3-bar-bestaetigen.html. Fokus-Seite: keine Navigation unten; seit
 * Nr. 54 trägt sie die KundeFokusShell (Kopf „Bestätigen" wie im Mockup
 * mobil; dazu der Zurück-Pfeil, den die Shell immer hat). Die Shell setzt
 * die h1, die Überschriften der Seite sind darum h2.
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

  // Gespeichert ist nur der Hash des Tokens (Nr. 151); ein Klartext-Wert
  // findet nichts mehr (Nr. 164) — `tokenKandidaten` liefert nur den Hash.
  const gesucht = { confirmationToken: { in: tokenKandidaten(token) } }

  // Frist gilt beim Lesen (src/lib/fristen.ts): erst freigeben, dann lesen.
  const vorab = await prisma.order.findFirst({ where: gesucht, select: { farmId: true } })
  if (!vorab) return <LinkUngueltig />
  await gibVerwaisteFreiOhneRisiko(vorab.farmId)

  const order = await prisma.order.findFirst({
    where: gesucht,
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
      // N38 (Nr. 197): im Hofpreis-Modell heißt die Zeile „Plattformgebühr“.
      gebuehrModell: true,
      farm: { select: { slug: true, name: true, address: true, postalCode: true, city: true, archivedAt: true, geschlossenAm: true } },
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
  if (!order || order.farm.slug !== farmSlug || !hofSichtbar(order.farm)) return <LinkUngueltig />

  const jetzt = new Date()
  const ansicht = barBestaetigungsAnsicht(order, jetzt)
  if (ansicht === 'ungueltig') return <LinkUngueltig />
  // Schon bestätigt: Die signierte Bestätigungsseite zeigt den Stand aus der Datenbank.
  if (ansicht === 'erledigt') redirect(bestaetigungsPfad(order.farm.slug, order.id))

  if (ansicht === 'verfallen' || ansicht === 'storniert') {
    // Board s1-/w1-bestellung-link Bild 3: eine Karte mit Uhr, Überschrift, Satz (die Frist aus fristVon) und dem
    // Weg zurück zum Hof als Knopf mit Rand — die Seite hat dann keine Hauptaktion mehr.
    return (
      <Rahmen hofSlug={order.farm.slug} hofName={order.farm.name}>
        <div className={cn(KARTE, 'flex flex-col gap-2.5')}>
          {ansicht === 'verfallen' ? (
            <Clock className="size-7 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
          ) : (
            <XCircle className="size-7 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
          )}
          <h2 className="font-heading text-[24px] leading-tight font-semibold text-foreground md:text-[26px]">
            {ansicht === 'verfallen' ? 'Bestellung verfallen' : 'Bestellung storniert'}
          </h2>
          <p className="text-[15px] leading-normal text-muted-foreground">
            {ansicht === 'verfallen'
              ? barVerfallenSatz(fristVon(order))
              : 'Die Bestellung ist storniert. Die Ware ist wieder frei – dir entstehen keine Kosten.'}
          </p>
          <Link href={`/${order.farm.slug}`} className={cn(KNOPF_BREIT_RAHMEN, 'mt-1')}>
            <span className="min-w-0 truncate">Zurück zu {order.farm.name}</span>
          </Link>
        </div>
      </Rahmen>
    )
  }

  const bis = fristVon(order)
  const summen = bestellSummen(order)
  const adresse = `${order.farm.address}, ${order.farm.postalCode} ${order.farm.city}`

  return (
    // Board s1-/w1-bestellung-link Bild 2: genau eine Hauptaktion — am Handy die feste Leiste der Fokus-Shell.
    <Rahmen hofSlug={order.farm.slug} hofName={order.farm.name} aktion={<BarBestaetigenKnoepfe token={token} />}>
      <div className="flex flex-col gap-1.5">
        <h2 className="font-heading text-[24px] leading-tight font-semibold break-words text-foreground md:text-[26px]">
          Bestellung bei {order.farm.name} bestätigen
        </h2>
        {/* Die Frist aus fristen.ts (V87: 2 Stunden ab Bestellung, spätestens Beginn des Abholfensters). */}
        <p className="text-[15px] leading-normal text-foreground">{barBestaetigenSatz(bis, jetzt)}</p>
      </div>

      <div className={cn(KARTE, 'flex flex-col gap-1.5')}>
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
          <Zeile titel={gebuehrBezeichnungFuer(order)}>{formatEuro(centsAlsEuro(summen.gebuehrCents))}</Zeile>
        )}
        <p className="text-[13px] leading-normal text-muted-foreground">{zahlungsAnzeige(order.paymentMethod, 'PENDING').art}</p>
        <div className="flex items-baseline gap-2 text-[16px] font-bold text-foreground">
          <span>Gesamt</span>
          <span className="grow" />
          <span className="tabular-nums">{formatEuro(centsAlsEuro(summen.gesamtCents))}</span>
        </div>
      </div>
      {/* Mit Wochentag und Datum (V9). */}
      <p className="text-[14px] leading-normal break-words text-foreground">
        Abholung {abholTerminZeile(order, jetzt)} · {adresse}
      </p>
    </Rahmen>
  )
}

/** Eine Zeile der Karte: leiser Name links, Betrag rechts. Lange Namen höchstens zwei Zeilen. */
function Zeile({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 text-[15px] text-foreground">
      <span className="line-clamp-2 min-w-0 break-words" title={titel}>
        {titel}
      </span>
      <span className="grow" />
      <span className="shrink-0 tabular-nums">{children}</span>
    </div>
  )
}

/** Der Kopf der Seite heißt wie im Mockup mobil — die Shell setzt ihn als h1. */
const TITEL = 'Bestätigen'

/** Die Spalte der Seite (Board w1-bestellung-link: 672 px, links bündig). */
const SPALTE = 'mx-auto flex w-full max-w-[704px] flex-col gap-3 px-4 pt-5 pb-8 md:gap-4 md:pt-8'

/**
 * Kopf und Spalte der Seite: die Fokus-Shell (`data-design="neu"`). Zurück
 * führt NIE durch den Verlauf — davor steht das Mailprogramm —, sondern als
 * Link zum Hof.
 */
function Rahmen({ hofSlug, hofName, aktion, children }: { hofSlug: string; hofName: string; aktion?: ReactNode; children: ReactNode }) {
  return (
    <KundeFokusShell
      titel={TITEL}
      zurueck={{ href: `/${hofSlug}`, label: `Zurück zu ${hofName}` }}
      // Die Leiste der Shell ist im Browser so breit wie ihr Kopf; die Knöpfe stehen in der Spalte der Seite.
      aktion={aktion && <div className="mx-auto w-full max-w-[672px]">{aktion}</div>}
    >
      <div className={SPALTE}>{children}</div>
    </KundeFokusShell>
  )
}

/**
 * Token unbekannt (schon benutzt, durch einen neuen ersetzt, abgetippt), falsch geformt oder unter
 * fremder Hofadresse: kein Hof, keine Bestellung — nicht einmal, ob es sie
 * gibt. Der Kopf führt zur Hofübersicht.
 */
function LinkUngueltig() {
  return (
    <KundeFokusShell titel={TITEL} zurueck={{ href: '/hoefe', label: 'Zurück zu den Höfen' }}>
      {/* Wie „Dieser Link ist nicht gültig“ der Bestellseite (Board s1-/w1-bestellung-link Bild 4): eine Karte. */}
      <div className="mx-auto w-full max-w-[592px] px-4 pt-6 pb-8 md:pt-10">
        <div className={cn(KARTE, 'flex flex-col gap-2.5')}>
          <LinkIcon className="size-7 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
          <h2 className="font-heading text-[24px] leading-tight font-semibold text-foreground md:text-[26px]">{LINK_UNGUELTIG_TITEL}</h2>
          {/* Derselbe Satz wie in den Knöpfen — seit Nr. 151 ersetzt ein neu angeforderter Link den alten. */}
          <p className="text-[15px] leading-normal text-muted-foreground">{LINK_UNGUELTIG_SATZ}</p>
          <Link href="/hoefe" className={cn(KNOPF_BREIT_RAHMEN, 'mt-1')}>
            Höfe entdecken
          </Link>
        </div>
      </div>
    </KundeFokusShell>
  )
}
