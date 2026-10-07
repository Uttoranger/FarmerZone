'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Building2, ChevronLeft, Leaf, PauseCircle, ShieldCheck, ShoppingBasket } from 'lucide-react'
import { toast } from 'sonner'
import type { PublicFarm, PublicProduct } from '@/server/queries/farm'
import type { SeitenAnsicht } from '@/lib/ansichts-modus'
import { formatEuro, formatGrundpreis, formatKategorie } from '@/lib/format'
import { kartenZustand, knappText } from '@/lib/bereiche-anzeige'
import { gebuehrHinweisFuerHof, mengeAbgelehntText, zahlungsarten } from '@/lib/hofseite-kunde'
import { VORSCHAU_KAUF_HINWEIS, korbErlaubt } from '@/lib/hofseite-vorschau'
import {
  alleProdukteLink,
  brennmaterialZeilen,
  futterSchild,
  gewaehlteGroesse,
  gleichMitAbholen,
  groesseAdresse,
  groessenKacheln,
  kaufBetragCents,
  mengeNochMoeglich,
  produktAngaben,
  produktFamilie,
  produktLink,
  sichtbaresProdukt,
  vorratText,
  zweitePreiszeile,
} from '@/lib/produktdetail'
import { produktInitiale } from '@/lib/hofuebersicht'
import { centsAlsEuro } from '@/lib/servicegebuehr'
import { SHOP_PAUSED_BUTTON_LABEL, kundenPausenText } from '@/lib/shop-pause'
import { SIEGEL } from '@/lib/taxonomie'
import type { KundenSeite } from '@/lib/kunden-kopf'
import { useCart } from '@/lib/use-cart'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { GroessenWahl, Groessenkachel } from '@/components/ui/groessenkachel'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { StatusBadge } from '@/components/ui/status-badge'
import { Stepper } from '@/components/ui/stepper'
import { useRueckwegKlick } from '@/components/shared/kunden-kopf'
import { CartSheet } from '@/components/farm/cart-sheet'
import { HofseiteSeitenspalte } from '@/components/hofseite/hofseite-seitenspalte'
import { GleichMitAbholen, Kennzeichnung } from '@/components/produktdetail/produktdetail-teile'
import { RaummassErklaerung } from '@/components/shared/raummass-erklaerung'
import { raummassErklaeren } from '@/lib/verkaufsgroessen'
import { futterVerantwortung, futterVerantwortungImKorb } from '@/lib/futter-registrierung'
import { FutterVerantwortung } from '@/components/shared/futter-verantwortung'
import { kassenAdresse } from '@/lib/kasse'
import { mitKaeuferVorbelegung, type KaeuferVorbelegung } from '@/schemas/kaeufer-vorbelegung'

/*
 * Die Produktseite /[farmSlug]/produkt/[id] (Nachtlauf Nr. 11, Gate 4).
 * Mockups: web-k2-futter-groesse-waehlen, web-k2-brennmaterial-brennholz,
 * mobil-k2-futter-groesse-waehlen, mobil-k2-brennmaterial-brennholz — für ein
 * Lebensmittel dieselbe Seite ohne Größen und Brennmaterial-Angaben.
 *
 * DIE Darstellung der Produktdetails: Die Karten der Hofseite verlinken
 * hierher, das Blatt von früher gibt es nicht mehr. Aufbau: Bild, Name,
 * Marken, Schild (E9), Beschreibung; die Kaufkarte mit Größenkacheln der
 * Familie (E3), Menge und „In den Korb" — am Handy als EINE feste Leiste
 * unten (Fokus-Seite, keine Unterleiste); die Kennzeichnung zugeklappt;
 * „Gleich mit abholen"; ab 1024 px rechts die Spalte der Hofseite
 * (EINE Komponente, hofseite-seitenspalte.tsx) mit dem Mini-Warenkorb.
 *
 * Gekauft wird über den bestehenden Korb (useCart → /api/reserve); was
 * entschieden wird (Sichtbarkeit, Familie, Vorrat, Grenzen, Beträge), steht
 * in src/lib/produktdetail.ts. Die Vorschau des Hofs (?vorschau=1) zeigt die
 * Seite ohne Korb (korbErlaubt), Links bleiben in der Vorschau.
 */

const KARTE = 'rounded-2xl border border-border bg-card'

export function ProduktdetailKunde({
  farm,
  produktId,
  gewaehltId,
  ansicht,
  kaeufer = null,
  jetzt,
}: {
  farm: PublicFarm
  /** Das Produkt aus dem Pfad — die Seite hat geprüft, dass es zu diesem Hof gehört und sichtbar ist. */
  produktId: string
  /** Die gewählte Größe (aus ?groesse=, geprüft) — sonst gleich produktId. */
  gewaehltId: string
  ansicht: Pick<SeitenAnsicht, 'art' | 'kaufen'>
  /** `?kaeufer=betrieb` aus „Region › Futter kaufen" (Nr. 29, geprüft) — reist mit zur Kasse und in die Links dieses Hofs. */
  kaeufer?: KaeuferVorbelegung | null
  /** Zeitpunkt der Anfrage (ISO) vom Server — Gebührensatz und Abholtage rechnen davon (Hydration). */
  jetzt: string
}): React.JSX.Element | null {
  const produkte = farm.products
  const einstieg = useMemo(() => sichtbaresProdukt(produkte, produktId), [produkte, produktId])
  const familie = useMemo(() => (einstieg ? produktFamilie(produkte, einstieg) : []), [produkte, einstieg])
  const [gewaehlt, setGewaehlt] = useState(gewaehltId)
  const [menge, setMenge] = useState(1)
  const [fehler, setFehler] = useState<string | null>(null)
  const [wirdHinzugefuegt, setWirdHinzugefuegt] = useState<string | null>(null)
  const [korbOffen, setKorbOffen] = useState(false)

  const alsVorschau = ansicht.art === 'vorschau'
  const mitKorb = korbErlaubt({ isEditMode: false, kaufen: ansicht.kaufen })
  const { items, total, addItem, updateQuantity, removeItem } = useCart(farm.id, farm.slug)

  const kundenSeite: KundenSeite = { art: 'produkt', hofSlug: farm.slug }
  const zurueck = alleProdukteLink(farm.slug, alsVorschau)
  const beimZurueckZeile = useRueckwegKlick(kundenSeite, 'zeile')
  const beimZurueckKnopf = useRueckwegKlick(kundenSeite, 'knopf')

  // Die Seite prüft vorher (notFound); hier nur die Absicherung für den Typ.
  if (!einstieg) return null

  const produkt = gewaehlteGroesse(familie, einstieg, gewaehlt)
  const zustand = kartenZustand(produkt, farm.isPaused)
  const kaufbar = zustand.art === 'kaufbar' || zustand.art === 'knapp'
  // Mit den Zahlarten des Hofs und der Bar-Ausnahme bis zum SEPA-Start (B1).
  const gebuehr = gebuehrHinweisFuerHof(farm, new Date(jetzt))
  const link = (id: string) => mitKaeuferVorbelegung(produktLink(farm.slug, id, alsVorschau), kaeufer)
  // Nur die Adresse trägt die Vorbelegung weiter (Nr. 29) — kein Speicher im Browser.
  const kasse = kassenAdresse(farm.slug, kaeufer)

  function imKorb(id: string): number {
    if (!mitKorb) return 0
    return items.find((i) => i.productId === id)?.quantity ?? 0
  }
  const nochMoeglich = mengeNochMoeglich(produkt.stock, imKorb(produkt.id))
  // Nach dem Hydrieren kann der Korb schon etwas enthalten — die Menge rückt dann an die Grenze.
  const mengeJetzt = Math.max(1, Math.min(menge, nochMoeglich))
  const betrag = formatEuro(centsAlsEuro(kaufBetragCents(produkt.price, mengeJetzt)))

  function waehleGroesse(id: string) {
    setGewaehlt(id)
    setMenge(1)
    setFehler(null)
    // Wie die Reiter der Hofseite: Adresse schreiben, ohne Server-Aufruf und
    // ohne Verlaufseintrag — Zustand null, sonst gleicht Next nicht ab.
    window.history.replaceState(null, '', groesseAdresse(window.location.pathname, window.location.search, id, produktId))
  }

  async function inDenKorb(p: PublicProduct, anzahl: number) {
    // Vorschau des Hofs: kein Korb, keine Reservierung — nur der Hinweis.
    if (!mitKorb) {
      toast.info(VORSCHAU_KAUF_HINWEIS)
      return
    }
    setFehler(null)
    setWirdHinzugefuegt(p.id)
    const ergebnis = await addItem(
      { productId: p.id, name: p.name, price: p.price, unit: p.unit, unitSize: p.unitSize, imageUrl: p.imageUrl },
      anzahl
    )
    setWirdHinzugefuegt(null)
    if (ergebnis.ok) {
      toast.success(`${p.name} liegt im Korb`, { duration: 2000 })
      setMenge(1)
      setKorbOffen(true)
    } else {
      // Inline an der Kaufkarte statt eines Toasts (DESIGN_SYSTEM, „Zustände").
      setFehler(mengeAbgelehntText(ergebnis.error))
    }
  }

  const bild = produkt.imageUrl ?? produkt.categoryImageUrl
  const kicker = [produkt.category ? formatKategorie(produkt.category, produkt.subcategory) : null, farm.name]
    .filter(Boolean)
    .join(' · ')
  const schild = futterSchild(produkt, farm.betriebsstatus)
  const brennmaterial = produkt.brennmaterial ? brennmaterialZeilen(produkt.brennmaterial) : []
  const beschreibung = produkt.description?.trim() ?? ''
  const zweite = zweitePreiszeile(produkt)
  const kacheln = groessenKacheln(familie, farm.isPaused)
  const mitGrundpreis = kacheln.some((k) => k.grundpreis)
  const vorrat = vorratText(produkt, zustand)
  const mitnehmen = gleichMitAbholen(produkte, produkt, farm.isPaused)
  // Raummeter und Schüttraummeter erklärt die Seite beim ersten Vorkommen (DESIGN_SYSTEM, Nr. 20).
  const raummass = raummassErklaeren((familie.length > 0 ? familie : [produkt]).map((p) => p.unit))
  // Bei jedem Futter der Verantwortungs-Hinweis (E10a), bei „nur an Betriebe" mit Zusatz.
  // Über die ganze Familie: Die Abgabe kann je Größe abweichen, der Zusatz
  // „nur an Betriebe" darf auf der Seite nicht fehlen, wenn eine Größe ihn braucht.
  const verantwortung = futterVerantwortung(familie.length > 0 ? familie : [produkt])

  const marke =
    zustand.art === 'knapp' ? (
      <StatusBadge status="offen">{knappText(zustand.bestand, produkt.unit, produkt.unitSize)}</StatusBadge>
    ) : zustand.art === 'ausverkauft' ? (
      <StatusBadge status="neutral">Ausverkauft</StatusBadge>
    ) : null

  return (
    <>
      {/* Rückweg ab 768 px als Zeile (Mockup „‹ Alle Produkte"); am Handy sitzt er als runder Knopf auf dem Bild. */}
      <div className="mx-auto hidden max-w-[1200px] px-6 pt-3 md:block">
        <Link
          href={zurueck}
          onClick={beimZurueckZeile}
          className={cn('inline-flex min-h-11 items-center rounded-md text-[13.5px] font-medium text-brand-text underline-offset-4 hover:underline', FOKUS_RAHMEN)}
        >
          ‹ Alle Produkte
        </Link>
      </div>

      <div className="mx-auto max-w-[1200px] px-4 pb-12 md:px-6 md:pt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-[22px] lg:col-start-1 lg:row-start-1">
          {/* ── Bild und Angaben ── */}
          <section aria-labelledby="produkt-titel" className="flex flex-col md:flex-row md:items-start md:gap-[26px]">
            <div className="relative -mx-4 h-[200px] shrink-0 overflow-hidden bg-muted md:mx-0 md:size-[300px] md:rounded-[18px] md:border md:border-border">
              {bild ? (
                <Image
                  src={bild}
                  alt={produkt.imageUrl ? produkt.name : ''}
                  fill
                  priority
                  sizes="(min-width: 768px) 300px, 100vw"
                  // Nur die Kategorie-Illustration wird nachts gedämpft (CODING_STANDARDS §7); Fotos bleiben.
                  className={cn(
                    produkt.imageUrl ? 'object-cover' : 'object-contain p-6 dark:brightness-[0.85] dark:saturate-[0.9]',
                    zustand.art === 'ausverkauft' && 'grayscale'
                  )}
                />
              ) : (
                <span aria-hidden="true" className="flex h-full items-center justify-center font-heading text-5xl font-semibold text-brand-text">
                  {produktInitiale(produkt.name)}
                </span>
              )}
              {/* Am Handy: Zurück auf dem Bild (Mockup), dunkler Kreis theme-fest (DESIGN_SYSTEM, Bild-Overlays). */}
              <Link
                href={zurueck}
                onClick={beimZurueckKnopf}
                aria-label="Zurück zu allen Produkten"
                className={cn(
                  'absolute top-3.5 left-3.5 flex size-11 items-center justify-center rounded-full bg-primary-foreground/55 text-accent-foreground transition-colors hover:bg-primary-foreground/70 md:hidden',
                  FOKUS_RAHMEN
                )}
              >
                <ChevronLeft className="size-[22px]" strokeWidth={1.7} aria-hidden="true" />
              </Link>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-3 pt-4 md:pt-0">
              <p className="text-[11px] font-semibold tracking-[1.1px] break-words text-muted-foreground uppercase md:text-xs">{kicker}</p>
              <h1 id="produkt-titel" className="font-heading text-2xl leading-[1.1] font-semibold break-words text-foreground md:text-[30px]">
                {produkt.name}
              </h1>

              {(marke || produkt.labels.length > 0 || produkt.abgabe === 'NUR_BETRIEBE' || produkt.brennmaterial || produkt.category === 'BRENNHOLZ') && (
                <ul className="flex flex-wrap gap-1.5">
                  {marke && <li>{marke}</li>}
                  {produkt.labels.map((l) => (
                    // Nicht die grüne StatusBadge: Grüne Schrift auf grüner Tönung erreicht auf dem
                    // hellen Seitengrund nur 4,37 : 1 (Axe) — wie die Hinweiskarte normale Schrift, grünes Symbol.
                    <li
                      key={l}
                      className="inline-flex items-center gap-1 rounded-full border border-accent/50 bg-accent/12 px-2.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap text-foreground"
                    >
                      {l === 'BIO' && <Leaf className="size-3 shrink-0 text-status-fertig" strokeWidth={1.7} aria-hidden="true" />}
                      {SIEGEL[l].name}
                    </li>
                  ))}
                  {produkt.abgabe === 'NUR_BETRIEBE' && (
                    <li>
                      <StatusBadge status="offen">
                        <Building2 className="mr-1 inline-block size-3 align-[-2px]" strokeWidth={1.7} aria-hidden="true" />
                        Nur an Betriebe
                      </StatusBadge>
                    </li>
                  )}
                  {/* Brennmaterial gibt es nur zum Abholen (E11). */}
                  {(produkt.brennmaterial || produkt.category === 'BRENNHOLZ') && (
                    <li>
                      <StatusBadge status="neutral">Nur Abholung am Hof</StatusBadge>
                    </li>
                  )}
                </ul>
              )}

              {schild && (
                <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-status-fertig">
                  <ShieldCheck className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
                  {schild}
                </p>
              )}

              {/* Kacheln nach Platz statt fester Spalten: In der schmalen Textspalte ab 1024 px brach „Ofenfertig“ sonst mitten im Wort. */}
              {brennmaterial.length > 0 && (
                <dl className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2">
                  {brennmaterial.map((z) => (
                    <div key={z.titel} className="rounded-xl border border-border bg-card px-3 py-2">
                      <dt className="text-[11.5px] text-muted-foreground">{z.titel}</dt>
                      <dd className="text-[13.5px] font-semibold break-words text-foreground">{z.wert}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {produkt.abgabe === 'NUR_BETRIEBE' && (
                <p className="text-[13.5px] text-muted-foreground">
                  Dieses Futtermittel gibt der Hof nur an landwirtschaftliche Betriebe ab. Beim Bestellen fragen wir nach deiner Betriebsnummer.
                </p>
              )}

              {beschreibung && (
                <p className="text-[14px] leading-relaxed break-words whitespace-pre-line text-muted-foreground">{beschreibung}</p>
              )}
            </div>
          </section>

          {/* Pause: Der Hof bleibt sichtbar, nur gekauft wird nicht. */}
          {farm.isPaused && (
            <Hinweiskarte ton="orange" symbol={PauseCircle} titel={`${farm.name} pausiert gerade.`}>
              <span className="break-words">{kundenPausenText(farm.pauseMessage)}</span>
            </Hinweiskarte>
          )}

          {/* ── Kaufen ── */}
          <section aria-labelledby="kaufen-titel" className={cn(KARTE, 'flex flex-col gap-3.5 p-4 md:px-5 md:py-[18px]')}>
            {kacheln.length > 0 ? (
              <>
                <div className="flex flex-wrap items-baseline gap-x-2.5">
                  <h2 id="kaufen-titel" className="text-[15.5px] font-semibold text-foreground">
                    Größe wählen
                  </h2>
                  <span className="flex-1" />
                  {mitGrundpreis && <p className="text-[12.5px] text-muted-foreground">Grundpreis zum Vergleichen</p>}
                </div>
                <GroessenWahl beschriftung="Größe wählen" wert={produkt.id} onWertChange={waehleGroesse} className="md:grid-cols-4">
                  {kacheln.map((k) => (
                    <Groessenkachel
                      key={k.id}
                      wert={k.id}
                      name={k.name}
                      hinweis={k.hinweis ?? undefined}
                      preis={k.preis}
                      grundpreis={k.grundpreis ?? undefined}
                      vorrat={k.vorrat ?? undefined}
                      zustand={k.zustand}
                    />
                  ))}
                </GroessenWahl>
                {raummass && <RaummassErklaerung />}
              </>
            ) : (
              <div className="flex flex-col gap-0.5">
                <h2 id="kaufen-titel" className="sr-only">
                  Preis und Menge
                </h2>
                <p className="text-xl font-semibold text-foreground tabular-nums">{formatGrundpreis(produkt.price, produkt.unit, produkt.unitSize)}</p>
                {zweite && <p className="text-[13px] text-muted-foreground tabular-nums">{zweite}</p>}
                {vorrat && zustand.art === 'kaufbar' && <p className="text-[13px] text-muted-foreground">Vorrat: {vorrat}</p>}
                {raummass && <RaummassErklaerung className="mt-2" />}
              </div>
            )}

            <FutterVerantwortung saetze={verantwortung} />

            {/* Am Handy die EINE feste Leiste unten (Fokus-Seite), ab 768 px in der Karte. */}
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] md:static md:z-auto md:border-0 md:bg-transparent md:p-0">
              <div className="mx-auto flex max-w-[1200px] items-center gap-2.5 md:gap-3.5">
                {kaufbar ? (
                  <>
                    <Stepper
                      beschriftung={`Menge ${produkt.name}`}
                      wert={mengeJetzt}
                      min={1}
                      max={Math.max(1, nochMoeglich)}
                      disabled={nochMoeglich === 0}
                      onWertChange={setMenge}
                    />
                    <button
                      type="button"
                      onClick={() => void inDenKorb(produkt, mengeJetzt)}
                      disabled={wirdHinzugefuegt === produkt.id || nochMoeglich === 0}
                      className={cn(
                        'inline-flex h-[46px] min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-accent px-5 text-[14.5px] font-semibold text-accent-foreground transition-opacity duration-[250ms] hover:opacity-90 disabled:opacity-60 md:flex-none md:px-6',
                        FOKUS_RAHMEN
                      )}
                    >
                      <ShoppingBasket className="size-[17px] shrink-0" strokeWidth={1.7} aria-hidden="true" />
                      <span className="truncate">{wirdHinzugefuegt === produkt.id ? 'Einen Moment …' : `In den Korb · ${betrag}`}</span>
                    </button>
                  </>
                ) : (
                  <p className="flex min-h-[46px] flex-1 items-center justify-center rounded-full bg-muted px-4 text-center text-sm text-muted-foreground md:flex-none">
                    {zustand.art === 'pausiert' ? SHOP_PAUSED_BUTTON_LABEL : zustand.art === 'nicht-verfuegbar' ? zustand.grund : 'Ausverkauft'}
                  </p>
                )}
                {gebuehr && kaufbar && <p className="hidden max-w-60 text-xs leading-snug text-muted-foreground md:block">{gebuehr.produkte}</p>}
              </div>
            </div>

            {kaufbar && nochMoeglich === 0 && (
              <p className="text-[13px] text-muted-foreground">Alles, was der Hof davon hat, liegt schon in deinem Korb.</p>
            )}

            {fehler && (
              <div role="alert">
                <Hinweiskarte ton="orange">{fehler}</Hinweiskarte>
              </div>
            )}
          </section>

          <Kennzeichnung zeilen={produktAngaben(produkt, farm)} bestaetigtAm={produkt.futter?.bestaetigtAm ?? null} />

          <GleichMitAbholen
            produkte={mitnehmen}
            link={link}
            mitFamilie={(p) => produktFamilie(produkte, p).length > 0}
            imKorb={imKorb}
            wirdHinzugefuegt={wirdHinzugefuegt}
            onInDenKorb={(p) => void inDenKorb(p, 1)}
          />
        </div>

        {/* Ab 1024 px die rechte Spalte der Hofseite — dieselbe Komponente, mit dem Mini-Warenkorb. */}
        <HofseiteSeitenspalte
          hof={farm}
          zahlungsarten={zahlungsarten(farm)}
          gebuehrKurz={gebuehr?.kurz ?? null}
          gebuehrKorb={gebuehr?.korb ?? null}
          mitKorb={mitKorb}
          jetzt={jetzt}
          produkte={produkte}
          kasseHref={kasse}
          className="hidden lg:col-start-2 lg:row-start-1 lg:flex"
        />
      </div>

      {mitKorb && (
        <CartSheet
          open={korbOffen}
          onOpenChange={setKorbOffen}
          items={items}
          total={total}
          farmSlug={farm.slug}
          kasseHref={kasse}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeItem}
          gebuehrKorb={gebuehr?.korb ?? null}
          futterHinweis={futterVerantwortungImKorb(items, produkte)}
        />
      )}
    </>
  )
}
