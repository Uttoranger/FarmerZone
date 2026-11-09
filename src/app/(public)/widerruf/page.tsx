import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { widerrufLinkGilt } from '@/lib/bestell-link'
import { hofSichtbar } from '@/lib/hof-sichtbar'
import { formatPosition } from '@/lib/format'
import { MARKE } from '@/lib/marke'
import { HOF_KONTAKT_FELDER, hofKontaktEmail } from '@/lib/hof-kontakt'
import { formatiereTelefon, telefonLink } from '@/lib/telefon-anzeige'
import { WIDERRUF_TEXT, ausnahmeHinweis, belehrungHof, belehrungMitHof, widerrufMoeglich, type BelehrungHof } from '@/lib/widerruf'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { cn } from '@/lib/utils'
import { RUNDUNG } from '@/components/ui/rundung'
import { WiderrufFormular, type WiderrufBestellAnsicht } from './widerruf-formular'

// Private Seite (signierter Link) — nie in Suchmaschinen, und die Adresse mit
// der Signatur geht nie als Referrer an fremde Seiten (Freigabe 200 Punkt 1).
export const metadata: Metadata = {
  title: `${WIDERRUF_TEXT.titel} — ${MARKE}`,
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export const dynamic = 'force-dynamic'

/** Wen die Kundin anrufen kann, wenn der Rücktritt hier nicht mehr geht — nur mit gültigem Link und sichtbarem Hof. */
type HofAnruf = { name: string; telefon: string; href: string | null }

/*
 * /widerruf (Nr. 200, Register N39, § 13a FAGG): der Rücktritt online, ohne
 * Anmeldung, in zwei Schritten („Vertrag widerrufen“ → Zusammenfassung →
 * „Widerruf bestätigen“). Seit Nr. 231 nach den Boards s3/w3-widerruf: Titel
 * „Rücktrittsrecht“, Sätze mit „Rücktritt“ (N43); die zwei Knöpfe und der
 * Einstieg bleiben wörtlich nach N39, ebenso die Belehrung (N43 (1), (2)).
 *  - Mit signiertem Link (?bestellung=…&sig=…, Zweck `widerruf`): die
 *    Bestellung gekürzt, die Positionen zum Ankreuzen mit dem Hinweis je
 *    Kategorie bzw. — hat der Hof „verdirbt schnell“ angegeben — mit dieser
 *    Angabe (Nr. 214). Eine falsche Signatur ergibt 404 — vor jeder Abfrage.
 *  - Ohne Link (Fuß, direkt): Name, E-Mail, Bestellnummer, „ganze Bestellung“
 *    oder Freitext. Die Seite verrät nie, ob es eine Bestellung gibt.
 * Darunter die Belehrung nach Anhang I FAGG (Nr. 207, src/lib/widerruf.ts):
 * Mit gültigem Link stehen Name, Anschrift, Telefon und E-Mail des Hofs der
 * Bestellung an den Platzhaltern, ohne Link der Hinweis „… – stehen in deiner
 * Bestellung“ — ohne Link verrät die Seite keinen Hof.
 * Keine Mockups in Lauf 27: Aufbau nach DESIGN_SYSTEM (Karte, Felder 16 px,
 * Knöpfe 44 px), in der KundeShell mit Seitenfuß.
 */
export default async function WiderrufPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const bestellung = typeof params.bestellung === 'string' ? params.bestellung : null
  const sig = typeof params.sig === 'string' ? params.sig : null

  let ansicht: WiderrufBestellAnsicht | null = null
  let hofAngaben: BelehrungHof | null = null
  let nichtMehr = false
  let anruf: HofAnruf | null = null
  if (bestellung !== null || sig !== null) {
    // Signatur ZUERST — eine falsche löst keine Abfrage aus.
    if (!bestellung || !sig || !widerrufLinkGilt(bestellung, sig)) notFound()
    const order = await prisma.order.findUnique({
      where: { id: bestellung },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        kaeuferArt: true,
        status: true,
        pickedUpAt: true,
        farm: {
          select: {
            name: true,
            ownerName: true,
            address: true,
            postalCode: true,
            city: true,
            phone: true,
            archivedAt: true,
            geschlossenAm: true,
            // Die E-Mail für die Belehrung: die Adresse, unter der der Hof erreichbar ist (hofKontaktEmail).
            ...HOF_KONTAKT_FELDER,
          },
        },
        items: {
          select: {
            id: true,
            productName: true,
            quantity: true,
            fehltSeit: true,
            // keinRuecktritt (Nr. 214): die Angabe des Hofs hat Vorrang vor dem Satz je Kategorie.
            product: { select: { category: true, unit: true, unitSize: true, keinRuecktritt: true } },
          },
        },
      },
    })
    if (!order) notFound()
    nichtMehr = !widerrufMoeglich(order, new Date())
    const telefon = order.farm.phone.trim()
    if (nichtMehr && telefon && hofSichtbar(order.farm)) {
      anruf = { name: order.farm.name, telefon: formatiereTelefon(telefon), href: telefonLink(telefon) }
    }
    // Nur mit gültigem Link (oben geprüft): die Angaben des Hofs DIESER Bestellung.
    hofAngaben = belehrungHof(order.farm, hofKontaktEmail(order.farm), hofSichtbar(order.farm))
    ansicht = {
      bestellung,
      sig,
      bestellnummer: order.orderNumber,
      name: order.customerName,
      // Der Vertragspartner: der Hof, bei dem bestellt wurde (Name und Anschrift).
      hof: hofSichtbar(order.farm) ? `${order.farm.name}, ${order.farm.address}, ${order.farm.postalCode} ${order.farm.city}` : order.farm.name,
      positionen: order.items
        .filter((i) => !i.fehltSeit)
        .map((i) => ({
          id: i.id,
          text: formatPosition({ name: i.productName, quantity: i.quantity, unit: i.product?.unit ?? null, unitSize: i.product?.unitSize ?? null }),
          hinweis: ausnahmeHinweis(i.product?.category ?? 'SONSTIGES', i.product?.keinRuecktritt ?? false),
        })),
    }
  }

  return (
    <KundeShellMitSitzung>
      {/* Im Web 16 px unter dem Kopf wie die Spalte des Boards (pruefer-ui Lauf 33: h1 25 px zu tief, Nr. 279).
          Karten höchstens 600 px (Board w3-widerruf). Nach dem Absenden stehen Titel und Einleitung nicht mehr über
          der Bestätigung (Board Bild 4): Der Eingang trägt `data-widerruf-eingegangen`, die Gruppe blendet den Kopf aus. */}
      <div className="group/widerruf mx-auto flex w-full max-w-[1032px] flex-col gap-4 px-4 pt-8 pb-12 *:max-w-[600px] md:pt-4 print:pt-0">
        <div className="flex flex-col gap-1.5 group-has-[[data-widerruf-eingegangen]]/widerruf:hidden print:hidden">
          <h1 className="font-heading text-[26px] leading-tight font-semibold text-foreground md:text-[28px]">{WIDERRUF_TEXT.titel}</h1>
          <p className="text-[14.5px] leading-normal text-muted-foreground">{WIDERRUF_TEXT.einleitung}</p>
        </div>

        {nichtMehr ? (
          <NichtMehrKarte anruf={anruf} />
        ) : (
          <WiderrufFormular bestellung={ansicht} />
        )}

        <BelehrungAbschnitt hof={hofAngaben} />
      </div>
    </KundeShellMitSitzung>
  )
}

/** Die Karte „Von dieser Bestellung kannst du hier nicht mehr zurücktreten.“ (Board w3-widerruf Bild 5). */
function NichtMehrKarte({ anruf }: { anruf: HofAnruf | null }): React.JSX.Element {
  return (
    <section aria-labelledby="nicht-mehr-titel" className="flex flex-col gap-2.5 rounded-[16px] border border-border bg-card px-4 py-4 md:px-[18px]">
      {/* Orange als Zustand „offen“ (text-status-offen hält 4,5:1 in beiden Themes), kein Fehler der Kundin. */}
      <h2 id="nicht-mehr-titel" className="font-heading text-[18px] leading-snug font-semibold text-status-offen">
        {WIDERRUF_TEXT.nichtMehrTitel}
      </h2>
      <p className="text-[14.5px] leading-normal text-foreground">{WIDERRUF_TEXT.nichtMehrSatz(anruf)}</p>
      {anruf?.href && (
        <a href={anruf.href} className={cn(KNOPF_RAHMEN, 'w-full border-[1.5px] border-accent font-semibold')}>
          {WIDERRUF_TEXT.anrufen(anruf.name)}
        </a>
      )}
    </section>
  )
}

/** Teil A, Teil B und der Hinweis zur Rückgabe am Hof — Wortlaut aus BELEHRUNG, nur die Hofangaben eingesetzt. */
function BelehrungAbschnitt({ hof }: { hof: BelehrungHof | null }): React.JSX.Element {
  const b = belehrungMitHof(hof)
  return (
    <section aria-labelledby="belehrung-titel" className="flex flex-col gap-2 rounded-[16px] border border-border bg-card px-4 py-4 md:px-[18px] print:border-0 print:px-0">
      <h2 id="belehrung-titel" className="font-heading text-[18px] font-semibold text-foreground">
        {b.teilA.titel}
      </h2>
      {b.teilA.abschnitte.map((a) => (
        <div key={a.titel} className="flex flex-col gap-2">
          <h3 className="mt-2 text-[15px] font-semibold text-foreground">{a.titel}</h3>
          {a.absaetze.map((absatz) => (
            <p key={absatz} className="text-[14px] leading-normal text-foreground [overflow-wrap:anywhere]">
              {absatz}
            </p>
          ))}
        </div>
      ))}
      <h2 className="mt-4 font-heading text-[18px] font-semibold text-foreground">{b.teilB.titel}</h2>
      <p className="text-[14px] leading-normal text-muted-foreground">{b.teilB.einleitung}</p>
      <ul className="flex flex-col gap-1.5">
        {b.teilB.zeilen.map((zeile) => (
          <li key={zeile} className="text-[14px] leading-normal text-foreground [overflow-wrap:anywhere]">
            {zeile}
          </li>
        ))}
      </ul>
      <p className="text-[14px] leading-normal text-muted-foreground">{b.teilB.fussnote}</p>
      {/* Getrennt vom Muster und als Hinweis gekennzeichnet (Auftrag 207). */}
      <aside aria-label={b.hinweisTitel} className={cn(RUNDUNG.hinweis, 'mt-3 border border-border bg-muted px-3.5 py-3 text-[14px] leading-normal text-foreground')}>
        <span className="font-semibold">{b.hinweisTitel}: </span>
        {b.hinweis}
      </aside>
    </section>
  )
}
