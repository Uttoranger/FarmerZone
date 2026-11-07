import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Clock, LinkIcon, XCircle } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { formatEuro, positionMengeVorn } from '@/lib/format'
import { bestaetigungsPfad } from '@/lib/bestell-link'
import { LINK_UNGUELTIG_SATZ, LINK_UNGUELTIG_TITEL, barBestaetigungsAnsicht, tokenKandidaten } from '@/lib/bar-bestaetigung'
import { fristVon } from '@/lib/fristen'
import { abholTerminZeile, barBestaetigenSatz, barVerfallenSatz } from '@/lib/bestaetigung'
import { KARTE, KNOPF_BREIT_RAHMEN } from '@/components/bestaetigung/bestaetigung-stil'
import { zahlzeileFuer } from '@/lib/zahlzeile'
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
      paymentStatus: true,
      cancelReason: true,
      createdAt: true,
      pickupDate: true,
      pickupTimeStart: true,
      pickupTimeEnd: true,
      totalAmount: true,
      serviceFeeCents: true,
      serviceFeeRefundedAt: true,
      // N38 (Nr. 197): im Hofpreis-Modell heißt die Zeile „Plattformgebühr“.
      gebuehrModell: true,
      // Der angewendete Satz für die Zahlzeile („inkl. Plattformgebühr (6 %)“, Nr. 253) — Snapshot, nie die Hofeinstellung.
      serviceFeePercentApplied: true,
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
      // Board s1-bestellung-link Bild 3: am Handy ohne Pfeil (der Weg zurück steht in der Karte), die Karte 520 px.
      <Rahmen hofSlug={order.farm.slug} hofName={order.farm.name} ohnePfeilAmHandy schmal>
        <div className={cn(KARTE, 'flex flex-col gap-2.5')}>
          {ansicht === 'verfallen' ? (
            <Clock className="size-7 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
          ) : (
            <XCircle className="size-7 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
          )}
          <h2 className="font-heading text-[24px] leading-tight font-semibold text-foreground">
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
        <h2 className="font-heading text-[24px] leading-tight font-semibold break-words text-foreground">
          Bestellung bei {order.farm.name} bestätigen
        </h2>
        {/* Die Frist aus fristen.ts (V87: 2 Stunden ab Bestellung, spätestens Beginn des Abholfensters). */}
        <p className="text-[15px] leading-normal text-foreground">{barBestaetigenSatz(bis, jetzt)}</p>
      </div>

      {/* Board s1-/w1-bestellung-link Bild 2 (Lauf 31): einspaltig, je Position „3 × Bergkäse, 250 g · € 19,74“, darunter
          leise die Zahlart und „Gesamt € …“ fett in einer Zeile — wie die Positionen der Bestätigung. Die Gebühr bleibt eine
          eigene Zeile (DESIGN_SYSTEM „Bestellseite“): Die Zeilen tragen den Warenpreis aus dem Snapshot. */}
      <div className={cn(KARTE, 'flex flex-col')}>
        <ul className="flex flex-col">
          {order.items.map((item, i) => {
            const name = positionMengeVorn({
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
        </ul>
        {/* Dieselbe Zahlzeile wie Bestätigung und Bestellseite (zahlzeileFuer, Liste Lauf 32 bestellung-link Bild 2). */}
        <p className="mt-0.5 text-[15px] leading-normal text-muted-foreground">{zahlzeileFuer(order)}</p>
        <p className="mt-0.5 text-[17px] font-bold text-foreground">
          Gesamt <span className="whitespace-nowrap tabular-nums">{formatEuro(centsAlsEuro(summen.gesamtCents))}</span>
        </p>
      </div>
      {/* Mit Wochentag und Datum (V9). */}
      <p className="text-[14px] leading-normal break-words text-foreground">
        Abholung {abholTerminZeile(order, jetzt)} · {adresse}
      </p>
    </Rahmen>
  )
}

/** Eine Zeile der Karte: die Position, dahinter „· € …“ (Board s1-/w1-bestellung-link Bild 2). Lange Namen umbrechen. */
function Zeile({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <li className="text-[15px] leading-normal break-words text-foreground">
      {titel}
      {' · '}
      <span className="whitespace-nowrap tabular-nums">{children}</span>
    </li>
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
function Rahmen({
  hofSlug,
  hofName,
  aktion,
  ohnePfeilAmHandy = false,
  schmal = false,
  children,
}: {
  hofSlug: string
  hofName: string
  aktion?: ReactNode
  ohnePfeilAmHandy?: boolean
  /** Nur eine Karte (verfallen, storniert): 520 px wie im Board w1-bestellung-link Bild 3. */
  schmal?: boolean
  children: ReactNode
}) {
  return (
    <KundeFokusShell
      titel={TITEL}
      // Im Browser „← Zurück zum Hof“ wie im Board (w1-bestellung-link Bild 2 und 3); den Hof nennt am Handy die Unterzeile.
      zurueck={{ href: `/${hofSlug}`, label: 'Zurück zum Hof' }}
      // Board s1-bestellung-link Bild 2: unter „Bestätigen“ die Zeile mit dem Weg zurück; im Browser der Textlink rechts.
      unterzeile={ohnePfeilAmHandy ? undefined : `Zurück zu ${hofName}`}
      ohnePfeilAmHandy={ohnePfeilAmHandy}
      // Board w1-bestellung-link Bild 2: die Knöpfe unten am Fenster, über einer Linie in der Breite der Spalte.
      aktionKlebtImBrowser
      spalte={schmal ? 'max-w-[552px]' : 'max-w-[704px]'}
      // Die Leiste der Shell ist im Browser so breit wie ihr Kopf; die Knöpfe stehen in der Spalte der Seite.
      // Liste Lauf 32 (bestellung-link, 1440): die Linie über den Knöpfen so breit wie die Karte samt Rand (752 px).
      aktion={aktion && <div className="mx-auto w-full max-w-[672px] md:max-w-[752px] md:border-t md:border-border md:px-10 md:pt-4">{aktion}</div>}
    >
      <div className={cn(SPALTE, schmal && 'max-w-[552px]')}>{children}</div>
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
          <h2 className="font-heading text-[24px] leading-tight font-semibold text-foreground">{LINK_UNGUELTIG_TITEL}</h2>
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
