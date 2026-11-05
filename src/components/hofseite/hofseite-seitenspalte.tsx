'use client'

import type { ReactNode } from 'react'
import { usePreisAnzeige } from '@/components/shared/preis-anzeige'
import { mitEndpreis } from '@/lib/plattformgebuehr'
import { useMemo } from 'react'
import Link from 'next/link'
import { Info } from 'lucide-react'
import type { PublicPickupSlot } from '@/server/queries/farm'
import { abholtagZeile, abholzeitenJeWochentag, nextPickupDays } from '@/lib/pickup-days'
import { buildMapsUrl } from '@/lib/customer-links'
import { formatEuro, mitAnzahl } from '@/lib/format'
import { warenkorbAnzahl } from '@/lib/warenkorb-speicher'
import { useWarenkorbVomHof } from '@/lib/use-warenkorb-kopf'
import { useKorbHinweis } from '@/lib/use-cart'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { korbBetraege, type Zahlungsart } from '@/lib/hofseite-kunde'
import { centsAlsEuro } from '@/lib/servicegebuehr'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { FutterVerantwortung } from '@/components/shared/futter-verantwortung'
import { futterVerantwortungImKorb, type FutterAbgabe } from '@/lib/futter-registrierung'
import type { KaufSperre } from '@/lib/bereiche-anzeige'
import { KaufGrund } from '@/components/hofseite/kauf-grund'
import { useBestellstopp } from '@/components/notbremse-band'

/*
 * Die rechte Spalte der Hofseite — EINE Komponente (Gate 4, Kernpunkt; Aufbau
 * seit Nr. 235 nach den Boards w1-/s1-hofseite und w1-/s1-produkt): Mini-Warenkorb,
 * Nächste Abholung, Abholzeiten, Zahlung & Kontakt und Anfahrt als ruhige Karten
 * mit leiser Überzeile in Großbuchstaben, ohne Symbole. Ab 1024 px steht die
 * Spalte rechts neben dem Inhalt, ab dem Titelbild, und bleibt beim Scrollen
 * stehen (`sticky`). Am Handy steht sie in der Übersicht nach dem Schaufenster
 * und vor „Über uns“ (Register N5), ohne den Mini-Warenkorb — dort trägt die
 * Korb-Leiste den Korb.
 *
 * Alles aus den echten Hofdaten; was entschieden wird (Zahlungsarten, Satz
 * der Gebühr, Abholzeiten), steht in src/lib/. `data-abschnitt` sind die
 * Ziele der Markierung aus dem Editor (vorschau-im-rahmen.tsx sucht das
 * sichtbare davon).
 */

export type SeitenspalteHof = {
  id: string
  slug: string
  /** Für den Hinweis zur Kaufsperre im Mini-Warenkorb. */
  name: string
  address: string
  postalCode: string
  city: string
  /** Die Nachricht des Hofs zur Pause — der Hinweis im Mini-Warenkorb nennt sie wie die Seite. */
  pauseMessage: string | null
  pickupSlots: PublicPickupSlot[]
}

/** Die Karte der Boards: Fläche, Rand, Radius 16, Polster 12/14 px. */
export const SPALTEN_KARTE = 'flex flex-col gap-2 rounded-2xl border border-border bg-card px-3.5 py-3'
/** Die leise Überzeile in Großbuchstaben (13 px fett) — Überschrift jeder Karte und der Abschnitte der Hofseite. */
export const UEBERZEILE = 'text-[13px] font-bold tracking-[0.04em] text-muted-foreground uppercase'
/** Grüner Textlink mit 44 px Höhe („Route planen →", „Alle ansehen →"). */
export const GRUENER_TEXTLINK = cn(
  'inline-flex min-h-11 w-fit items-center rounded-md text-[15px] font-semibold text-brand-text underline underline-offset-4',
  FOKUS_RAHMEN
)

/** Steht in „Zahlung & Kontakt“ statt der Nummer (Nr. 60): Telefon und E-Mail kommen mit der Bestellung. */
export const TELEFON_IN_DER_BESTAETIGUNG = 'Die Telefonnummer des Hofs steht in deiner Bestellbestätigung.'

/** „Online bezahlen oder bar bei Abholung." — die Zahlarten des Hofs als ein Satz (Board w1-hofseite). */
export function zahlungsSatz(zahlungsarten: readonly Zahlungsart[]): string | null {
  const online = zahlungsarten.some((z) => z.art === 'online')
  const bar = zahlungsarten.some((z) => z.art === 'bar')
  if (online && bar) return 'Online bezahlen oder bar bei Abholung.'
  if (online) return 'Online bezahlen.'
  if (bar) return 'Bar bei Abholung.'
  return null
}

export function HofseiteSeitenspalte({
  hof,
  sperre,
  zahlungsarten,
  gebuehrHinweis,
  gebuehrKorb,
  mitKorb,
  jetzt,
  produkte = [],
  kasseHref,
  kasseUmriss = false,
  className,
}: {
  hof: SeitenspalteHof
  /** Die Kaufsperre der Seite (kaufSperre, Register N24) — einmal auf dem Server gerechnet. */
  sperre: KaufSperre
  zahlungsarten: readonly Zahlungsart[]
  /** „Preise inkl. Plattformgebühr (6 %) – online und bar gleich." — null, wenn der Hof gerade gebührenfrei ist. */
  gebuehrHinweis: string | null
  /** „inkl. Plattformgebühr" bzw. „zzgl. Servicegebühr" neben der Korbsumme — null ohne Gebühr. */
  gebuehrKorb: string | null
  /** Ob die Seite einen Korb führt (korbErlaubt) — in der Vorschau des Hofs nie. */
  mitKorb: boolean
  /** Zeitpunkt der Anfrage (ISO) vom Server — die Abholtage rechnen davon, nicht von der Uhr beim Rendern. */
  jetzt: string
  /** Die Produkte des Hofs — nur für den Futter-Hinweis im Mini-Warenkorb (E10a). */
  produkte?: readonly (FutterAbgabe & { id: string })[]
  /** Adresse von „Zur Kasse" — die Produktseite gibt `?kaeufer=betrieb` mit (Nr. 29); sonst die Kasse des Hofs. */
  kasseHref?: string
  /**
   * „Zur Kasse" als Umriss statt grün — auf der Produktseite ist „In den Korb · €"
   * die eine Hauptaktion (Boards s1/w1-produkt); auf der Hofseite bleibt „Zur Kasse" grün.
   */
  kasseUmriss?: boolean
  className?: string
}): React.JSX.Element {
  const tage = useMemo(() => nextPickupDays(hof.pickupSlots, 2, new Date(jetzt)), [hof.pickupSlots, jetzt])
  const zeiten = useMemo(() => abholzeitenJeWochentag(hof.pickupSlots), [hof.pickupSlots])

  return (
    <aside
      aria-label="Abholung, Zahlung und Anfahrt"
      // Bleibt beim Scrollen stehen (Board w1-produkt Bild 2); ist sie höher als das Fenster, scrollt sie selbst.
      className={cn('flex flex-col gap-3 lg:sticky lg:top-[5.25rem] lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto', className)}
    >
      {mitKorb && <MiniWarenkorb hof={hof} sperre={sperre} gebuehrKorb={gebuehrKorb} produkte={produkte} kasseHref={kasseHref} kasseUmriss={kasseUmriss} />}

      {/* Mit Kaufsperre (Pause, keine Abholzeit, ausgebucht) keine Termine: Ankündigen, was man nicht
          buchen kann, wäre ein leeres Versprechen — auch ein heute noch laufendes Fenster nicht. */}
      {sperre === null && tage.length > 0 && (
        <section aria-labelledby="naechste-abholung" className={SPALTEN_KARTE}>
          <h2 id="naechste-abholung" className={UEBERZEILE}>
            Nächste Abholung
          </h2>
          {/* Klar als Text (Nr. 46, Register N2): Zeilen, keine Kacheln, die wie wählbare Knöpfe aussehen.
              Gewählt wird das Zeitfenster in der Kasse — dort mit demselben Datum. */}
          <ul className="flex flex-col text-[15px] text-foreground">
            {tage.map((tag, i) => (
              <li key={tag.kalendertag} className={cn('break-words', i === 0 && 'font-semibold')}>
                {abholtagZeile(tag)} <span className="tabular-nums">{tag.times}</span>
              </li>
            ))}
          </ul>
          <p className="text-[14px] text-muted-foreground">Deinen Abholtermin wählst du beim Bestellen.</p>
        </section>
      )}

      {zeiten.length > 0 && (
        <section data-abschnitt="abholung" aria-labelledby="abholzeiten" className={SPALTEN_KARTE}>
          <h2 id="abholzeiten" className={UEBERZEILE}>
            Abholzeiten
          </h2>
          <ul className="flex flex-col text-[15px] text-foreground">
            {zeiten.map((zeile) => (
              <li key={zeile}>{zeile}</li>
            ))}
          </ul>
        </section>
      )}

      <ZahlungKarte zahlungsarten={zahlungsarten} gebuehrHinweis={gebuehrHinweis} kennung="zahlung-kontakt" />
      <AnfahrtKarte hof={hof} kennung="anfahrt" />
    </aside>
  )
}

/**
 * „Zahlung & Kontakt": die Zahlarten als ein Satz, statt der Nummer der Hinweis auf die
 * Bestellbestätigung (Nr. 60 — kein Anruf vor dem Kauf), darunter leise der Gebührensatz.
 */
function ZahlungKarte({
  zahlungsarten,
  gebuehrHinweis,
  kennung,
  className,
}: {
  zahlungsarten: readonly Zahlungsart[]
  gebuehrHinweis: string | null
  kennung: string
  className?: string
}): React.JSX.Element {
  const satz = zahlungsSatz(zahlungsarten)
  return (
    <section data-abschnitt="kontakt" aria-labelledby={kennung} className={cn(SPALTEN_KARTE, className)}>
      <h2 id={kennung} className={UEBERZEILE}>
        Zahlung &amp; Kontakt
      </h2>
      <p className="text-[14px] text-foreground">
        {satz && <>{satz} </>}
        {TELEFON_IN_DER_BESTAETIGUNG}
      </p>
      {gebuehrHinweis && <p className="text-[13px] text-muted-foreground">{gebuehrHinweis}</p>}
    </section>
  )
}

/** „Anfahrt": die Anschrift und „Route planen →" zum Kartendienst — kein Kartenbild (Board w1-hofseite). */
function AnfahrtKarte({
  hof,
  kennung,
  className,
}: {
  hof: Pick<SeitenspalteHof, 'address' | 'postalCode' | 'city'>
  kennung: string
  className?: string
}): React.JSX.Element {
  return (
    <section aria-labelledby={kennung} className={cn(SPALTEN_KARTE, className)}>
      <h2 id={kennung} className={UEBERZEILE}>
        Anfahrt
      </h2>
      <p className="text-[14px] break-words text-foreground">
        {hof.address}, {hof.postalCode} {hof.city}
      </p>
      <a
        href={buildMapsUrl(hof.address, hof.postalCode, hof.city)}
        target="_blank"
        rel="noopener noreferrer"
        className={GRUENER_TEXTLINK}
      >
        Route planen <span aria-hidden="true">&nbsp;→</span>
      </a>
    </section>
  )
}

/**
 * Der Mini-Warenkorb (Board w1-hofseite): sobald etwas im Korb dieses Hofs liegt, oben
 * in der rechten Spalte — „3 Produkte · € … · inkl. Plattformgebühr" und „Zur Kasse".
 * Liest den Korb aus dem Speicher (useWarenkorbVomHof) — geschrieben wird nur über
 * useCart im Produktraster, das danach WARENKORB_EREIGNIS meldet. Mit Kaufsperre
 * (Register N24) steht statt „Zur Kasse“ der Grund (nur der Titel, `kurz`): Die Kasse
 * nähme die Bestellung ohnehin nicht an, und den Satz trägt die Karte auf der Seite.
 */
function MiniWarenkorb({
  hof,
  sperre,
  gebuehrKorb,
  produkte,
  kasseHref,
  kasseUmriss,
}: {
  hof: SeitenspalteHof
  sperre: KaufSperre
  gebuehrKorb: string | null
  produkte: readonly (FutterAbgabe & { id: string })[]
  kasseHref?: string
  kasseUmriss: boolean
}): ReactNode {
  const { id: farmId, slug } = hof
  const imKorb = useWarenkorbVomHof(farmId)
  // Im Hofpreis-Modell (N38) Endpreise je Stück — die Summe wie in der Kasse.
  const anzeige = usePreisAnzeige()
  const positionen = imKorb.map((p) => mitEndpreis(p, anzeige))
  // Der Satz nach dem Abgleich der Hofseite (Register N28) — auch wenn danach nichts mehr im Korb liegt:
  // Dann steht er allein unter dem Titel, damit die Kundin erfährt, wohin ihr Korb ist.
  const hinweis = useKorbHinweis(farmId)
  // Notbremse (N34): wie eine Sperre — statt „Zur Kasse“ der Satz (KaufGrund, wie im Korb-Blatt).
  const stopp = useBestellstopp()
  if (positionen.length === 0 && !hinweis) return null
  const anzahl = warenkorbAnzahl(positionen)
  // In ganzen Cent auf dem Weg des Checkouts (korbBetraege), nie price × Menge
  // in Fließkomma — verbindlich rechnet der Checkout mit den Preisen aus der Datenbank.
  const { summeCents } = korbBetraege(positionen)

  return (
    <section aria-labelledby="mini-warenkorb" className={cn(SPALTEN_KARTE, 'hidden lg:flex')}>
      <h2 id="mini-warenkorb" className={UEBERZEILE}>
        Dein Warenkorb
      </h2>
      {hinweis && (
        <div role="status">
          <Hinweiskarte ton="orange" symbol={Info}>
            {hinweis}
          </Hinweiskarte>
        </div>
      )}
      {positionen.length > 0 && (
        <>
          <p className="text-[15px] text-foreground">
            {mitAnzahl(anzahl, 'Produkt', 'Produkte')} · <span className="tabular-nums">{formatEuro(centsAlsEuro(summeCents))}</span>
            {gebuehrKorb && <> · {gebuehrKorb}</>}
          </p>
          <FutterVerantwortung saetze={futterVerantwortungImKorb(positionen, produkte)} />
          {sperre !== null || stopp !== null ? (
            <KaufGrund sperre={sperre} hofName={hof.name} pauseMessage={hof.pauseMessage} stopp={stopp} kurz />
          ) : (
            <Link
              href={kasseHref ?? `/${slug}/checkout`}
              data-kasse={kasseUmriss ? 'umriss' : 'gruen'}
              className={cn(
                'flex min-h-[52px] items-center justify-center rounded-[14px] px-3 text-[16px] font-bold transition-opacity duration-[250ms] hover:opacity-90',
                kasseUmriss ? 'border border-input bg-card text-foreground' : 'bg-accent text-accent-foreground',
                FOKUS_RAHMEN
              )}
            >
              Zur Kasse
            </Link>
          )}
        </>
      )}
    </section>
  )
}
