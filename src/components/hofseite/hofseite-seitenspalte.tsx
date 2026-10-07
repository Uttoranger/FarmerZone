'use client'

import type { ReactNode } from 'react'
import { useMemo } from 'react'
import Link from 'next/link'
import { Banknote, CalendarDays, CreditCard, MapPin, Phone, ShoppingBasket } from 'lucide-react'
import type { PublicPickupSlot } from '@/server/queries/farm'
import { abholzeitenJeWochentag, nextPickupDays } from '@/lib/pickup-days'
import { buildMapsUrl } from '@/lib/customer-links'
import { formatEuro, mitAnzahl } from '@/lib/format'
import { warenkorbAnzahl } from '@/lib/warenkorb-speicher'
import { useWarenkorbVomHof } from '@/lib/use-warenkorb-kopf'
import { korbBetraege, type Zahlungsart } from '@/lib/hofseite-kunde'
import { centsAlsEuro } from '@/lib/servicegebuehr'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { FutterVerantwortung } from '@/components/shared/futter-verantwortung'
import { futterVerantwortungImKorb, type FutterAbgabe } from '@/lib/futter-registrierung'

/*
 * Die rechte Spalte der Hofseite — EINE Komponente (Gate 4, Kernpunkt):
 * Mini-Warenkorb, Nächste Abholung, Abholzeiten, Zahlung & Kontakt mit dem
 * Gebührenhinweis und Anfahrt. Mockups web-k2-hofseite und
 * web-k2-alle-produkte-nach-kategorie (rechts), mobil-k2-hofseite (oben in
 * der Übersicht). Ab 1024 px steht sie rechts neben dem Inhalt, darunter in
 * der Übersicht vor ihm; der Mini-Warenkorb nur ab 1024 px — am Handy trägt
 * die Leiste über der Unterleiste den Korb (product-grid.tsx).
 *
 * Alles aus den echten Hofdaten; was entschieden wird (Zahlungsarten, Satz
 * der Gebühr, Abholzeiten), steht in src/lib/. `data-abschnitt` sind die
 * Ziele der Markierung aus dem Editor (vorschau-im-rahmen.tsx).
 */

export type SeitenspalteHof = {
  id: string
  slug: string
  phone: string
  address: string
  postalCode: string
  city: string
  isPaused: boolean
  pickupSlots: PublicPickupSlot[]
}

const KARTE = 'flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-[18px]'
const KARTEN_TITEL = 'text-[15px] font-semibold text-foreground'
const ZEILE = 'flex items-center gap-2.5 text-[13.5px] text-foreground'
const SYMBOL = 'size-4 shrink-0 text-muted-foreground'
const TEXTLINK = cn(
  'inline-flex min-h-11 w-fit items-center rounded-md text-[13.5px] font-semibold text-brand-text underline-offset-4 hover:underline',
  FOKUS_RAHMEN
)

export function HofseiteSeitenspalte({
  hof,
  zahlungsarten,
  gebuehrKurz,
  gebuehrKorb,
  mitKorb,
  jetzt,
  produkte = [],
  className,
}: {
  hof: SeitenspalteHof
  zahlungsarten: readonly Zahlungsart[]
  /** „Preise zzgl. 5 % Servicegebühr …" — null, wenn der Hof gerade gebührenfrei ist. */
  gebuehrKurz: string | null
  /** „zzgl. Servicegebühr" neben der Korbsumme — null ohne Gebühr. */
  gebuehrKorb: string | null
  /** Ob die Seite einen Korb führt (korbErlaubt) — in der Vorschau des Hofs nie. */
  mitKorb: boolean
  /** Zeitpunkt der Anfrage (ISO) vom Server — die Abholtage rechnen davon, nicht von der Uhr beim Rendern. */
  jetzt: string
  /** Die Produkte des Hofs — nur für den Futter-Hinweis im Mini-Warenkorb (E10a). */
  produkte?: readonly (FutterAbgabe & { id: string })[]
  className?: string
}): React.JSX.Element {
  const tage = useMemo(() => nextPickupDays(hof.pickupSlots, 3, new Date(jetzt)), [hof.pickupSlots, jetzt])
  const zeiten = useMemo(() => abholzeitenJeWochentag(hof.pickupSlots), [hof.pickupSlots])
  const kartenLink = buildMapsUrl(hof.address, hof.postalCode, hof.city)

  return (
    <aside aria-label="Abholung, Zahlung und Anfahrt" className={cn('flex flex-col gap-[18px]', className)}>
      {mitKorb && <MiniWarenkorb farmId={hof.id} slug={hof.slug} gebuehrKorb={gebuehrKorb} produkte={produkte} />}

      {/* Bei Pause keine Termine: Ankündigen, was man nicht buchen kann, wäre ein leeres Versprechen. */}
      {!hof.isPaused && tage.length > 0 && (
        <section aria-labelledby="naechste-abholung" className={KARTE}>
          <h2 id="naechste-abholung" className={KARTEN_TITEL}>
            Nächste Abholung
          </h2>
          <ul className="flex gap-2">
            {tage.map((tag, i) => (
              <li
                key={tag.date.toISOString()}
                className={cn(
                  'min-w-0 flex-1 rounded-xl px-1.5 py-3 text-center',
                  i === 0 ? 'border-[1.5px] border-accent bg-accent/12' : 'border border-border'
                )}
              >
                <span className="block text-[13px] leading-snug font-semibold break-words text-foreground">{tag.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{tag.times}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Dein Zeitfenster wählst du beim Bestellen.</p>
        </section>
      )}

      {zeiten.length > 0 && (
        <section data-abschnitt="abholung" aria-labelledby="abholzeiten" className={KARTE}>
          <h2 id="abholzeiten" className={KARTEN_TITEL}>
            Abholzeiten
          </h2>
          <ul className="flex flex-col gap-2">
            {zeiten.map((zeile) => (
              <li key={zeile} className={ZEILE}>
                <CalendarDays className={SYMBOL} strokeWidth={1.7} aria-hidden="true" />
                {zeile}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section data-abschnitt="kontakt" aria-labelledby="zahlung-kontakt" className={KARTE}>
        <h2 id="zahlung-kontakt" className={KARTEN_TITEL}>
          Zahlung &amp; Kontakt
        </h2>
        <ul className="flex flex-col gap-1">
          {zahlungsarten.map((z) => (
            <li key={z.art} className={cn(ZEILE, 'min-h-7')}>
              {z.art === 'online' ? (
                <CreditCard className={SYMBOL} strokeWidth={1.7} aria-hidden="true" />
              ) : (
                <Banknote className={SYMBOL} strokeWidth={1.7} aria-hidden="true" />
              )}
              {z.text}
            </li>
          ))}
          <li>
            <a href={`tel:${hof.phone}`} className={cn(ZEILE, 'min-h-11 w-fit rounded-md hover:underline', FOKUS_RAHMEN)}>
              <Phone className={SYMBOL} strokeWidth={1.7} aria-hidden="true" />
              <span className="sr-only">Anrufen: </span>
              {hof.phone}
            </a>
          </li>
        </ul>
        {gebuehrKurz && (
          <p className="border-t border-border pt-2.5 text-xs leading-normal text-muted-foreground">{gebuehrKurz}</p>
        )}
      </section>

      <section aria-labelledby="anfahrt" className={KARTE}>
        <h2 id="anfahrt" className={KARTEN_TITEL}>
          Anfahrt
        </h2>
        {/* Ein Bild der Gegend, kein Kartendienst — wie die Startseite: Leaflet
            und Kacheln bleiben der Hofübersicht vorbehalten. Wo der Hof liegt,
            zeigt der Kartendienst hinter dem Link. */}
        <a
          href={kartenLink}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Anfahrt zu ${hof.address}, ${hof.postalCode} ${hof.city} in Google Maps öffnen`}
          className={cn('relative block h-[150px] overflow-hidden rounded-xl border border-border bg-muted', FOKUS_RAHMEN)}
        >
          <span aria-hidden="true" className="absolute top-[52px] -left-6 h-0.5 w-[460px] rotate-[12deg] bg-border" />
          <span aria-hidden="true" className="absolute -top-10 left-[46%] h-[260px] w-0.5 rotate-[22deg] bg-border" />
          <span aria-hidden="true" className="absolute top-[104px] -left-6 h-px w-[460px] -rotate-[8deg] bg-border" />
          <span aria-hidden="true" className="absolute top-1/2 left-1/2 flex size-9 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full bg-accent text-accent-foreground ring-4 ring-card">
            <MapPin className="size-[18px]" strokeWidth={1.7} />
          </span>
        </a>
        <p className="text-[13px] break-words text-muted-foreground">
          {hof.address}, {hof.postalCode} {hof.city}
        </p>
        <a href={kartenLink} target="_blank" rel="noopener noreferrer" className={TEXTLINK}>
          Route planen <span aria-hidden="true">&nbsp;→</span>
        </a>
      </section>
    </aside>
  )
}

/**
 * Der Mini-Warenkorb (DESIGN_SYSTEM, „Kaufstrecke"): sobald etwas im Korb
 * dieses Hofs liegt, oben in der rechten Spalte, klebend. Liest den Korb aus
 * dem Speicher (useWarenkorbVomHof) — geschrieben wird nur über useCart im
 * Produktraster, das danach WARENKORB_EREIGNIS meldet.
 */
function MiniWarenkorb({
  farmId,
  slug,
  gebuehrKorb,
  produkte,
}: {
  farmId: string
  slug: string
  gebuehrKorb: string | null
  produkte: readonly (FutterAbgabe & { id: string })[]
}): ReactNode {
  const positionen = useWarenkorbVomHof(farmId)
  if (positionen.length === 0) return null
  const anzahl = warenkorbAnzahl(positionen)
  // In ganzen Cent auf dem Weg des Checkouts (korbBetraege), nie price × Menge
  // in Fließkomma — verbindlich rechnet der Checkout mit den Preisen aus der Datenbank.
  const { zeilenCents, summeCents } = korbBetraege(positionen)

  return (
    <section
      aria-labelledby="mini-warenkorb"
      className="sticky top-32 z-10 hidden flex-col gap-2.5 rounded-2xl border border-accent/45 bg-card p-[18px] shadow-lg lg:flex"
    >
      <h2 id="mini-warenkorb" className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
        <ShoppingBasket className="size-4 text-status-fertig" strokeWidth={1.7} aria-hidden="true" />
        Dein Korb
        <span className="flex-1" />
        <span className="text-[13px] font-normal text-muted-foreground">{mitAnzahl(anzahl, 'Artikel', 'Artikel')}</span>
      </h2>
      <ul className="flex flex-col gap-1.5">
        {positionen.map((p) => (
          <li key={p.productId} className="flex items-baseline gap-2 text-[13.5px]">
            <span className="min-w-0 flex-1 truncate text-foreground" title={p.name}>
              {p.quantity > 1 && <span className="tabular-nums">{p.quantity} × </span>}
              {p.name}
            </span>
            <span className="shrink-0 tabular-nums text-foreground">{formatEuro(centsAlsEuro(zeilenCents.get(p.productId) ?? 0))}</span>
          </li>
        ))}
      </ul>
      <p className="border-t border-border pt-2.5 text-[15px] font-semibold text-foreground">
        <span className="tabular-nums">{formatEuro(centsAlsEuro(summeCents))}</span>
        {gebuehrKorb && <span className="text-[13px] font-normal text-muted-foreground">&nbsp;{gebuehrKorb}</span>}
      </p>
      <FutterVerantwortung saetze={futterVerantwortungImKorb(positionen, produkte)} />
      <Link
        href={`/${slug}/checkout`}
        className={cn(
          'flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 text-[14.5px] font-semibold text-accent-foreground transition-opacity duration-[250ms] hover:opacity-90',
          FOKUS_RAHMEN
        )}
      >
        Zur Kasse
      </Link>
    </section>
  )
}
