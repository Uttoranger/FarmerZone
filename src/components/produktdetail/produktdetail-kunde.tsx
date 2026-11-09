'use client'

import { useEffect, useMemo, useState } from 'react'
import { PreisAnzeigeRahmen } from '@/components/shared/preis-anzeige'
import { mitEndpreis } from '@/lib/plattformgebuehr'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, Handbag, Leaf } from 'lucide-react'
import { toast } from 'sonner'
import type { PublicProduct } from '@/server/queries/farm'
import type { SeitenAnsicht } from '@/lib/ansichts-modus'
import { formatEuro } from '@/lib/format'
import { kartenZustand, knappText, ruhenderKnopfText, type KaufSperre } from '@/lib/bereiche-anzeige'
import { gebuehrHinweisFuerHof, mengeAbgelehntText, zahlungsarten } from '@/lib/hofseite-kunde'
import { VORSCHAU_KAUF_HINWEIS, korbErlaubt } from '@/lib/hofseite-vorschau'
import {
  alleProdukteLink,
  brennmaterialZeilen,
  futterSchild,
  gemeinsamerAnfang,
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
} from '@/lib/produktdetail'
import { produktInitiale } from '@/lib/hofuebersicht'
import { centsAlsEuro } from '@/lib/servicegebuehr'
import { SIEGEL } from '@/lib/taxonomie'
import type { KundenSeite } from '@/lib/kunden-kopf'
import { useCart } from '@/lib/use-cart'
import { bildStil } from '@/lib/bild-ausschnitt'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { GroessenWahl, Groessenkachel } from '@/components/ui/groessenkachel'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { AUSVERKAUFT_WORT, Marke } from '@/components/ui/marke'
import { Zaehler } from '@/components/ui/zaehler'
import { useWarenkorbKopf } from '@/lib/use-warenkorb-kopf'
import { RUNDUNG } from '@/components/ui/rundung'
import { Stepper } from '@/components/ui/stepper'
import { useRueckwegKlick } from '@/components/shared/kunden-kopf'
import { CartSheet } from '@/components/farm/cart-sheet'
import type { HofseiteHof } from '@/components/hofseite/hofseite-kunde'
import { HofseiteSeitenspalte, SPALTEN_KARTE } from '@/components/hofseite/hofseite-seitenspalte'
import { preisZeilen } from '@/components/hofseite/preis-zeilen'
import { KaufSperreHinweis } from '@/components/hofseite/kauf-sperre-hinweis'
import { BestellstoppHinweis, useBestellstopp } from '@/components/notbremse-band'
import { sperreMitBestellstopp } from '@/lib/notbremse'
import { GleichMitAbholen, Kennzeichnung } from '@/components/produktdetail/produktdetail-teile'
import { FOTO_HUELLE, ILLUSTRATION_BILD, ILLUSTRATION_HUELLE, PLATZHALTER_FLAECHE } from '@/components/ui/bild-dunkel'
import { mengeLabelTipp } from '@/components/produktdetail/menge-label'
import { ausverkauftSatz, groessenAufsteigend, groessenVorrat, preisJeRaummass, raummassZeile } from '@/components/produktdetail/groessen-anzeige'
import { futterVerantwortung, futterVerantwortungImKorb } from '@/lib/futter-registrierung'
import { FutterVerantwortung } from '@/components/shared/futter-verantwortung'
import { FutterSchild } from '@/components/produkte/futter-schild'
import { AbholhinweisZeile } from '@/components/region/futter-abholhinweise'
import { RuecktrittHinweis } from '@/components/shared/ruecktritt-hinweis'
import { kassenAdresse } from '@/lib/kasse'
import { mitKaeuferVorbelegung, type KaeuferVorbelegung } from '@/schemas/kaeufer-vorbelegung'

/*
 * Die Produktseite /[farmSlug]/produkt/[id] (Nachtlauf Nr. 11, Gate 4; Aufbau
 * seit Nr. 235 nach den Boards w1-/s1-produkt).
 * Mockups: web-k2-futter-groesse-waehlen, web-k2-brennmaterial-brennholz,
 * mobil-k2-futter-groesse-waehlen, mobil-k2-brennmaterial-brennholz — für ein
 * Lebensmittel dieselbe Seite ohne Größen und Brennmaterial-Angaben.
 *
 * DIE Darstellung der Produktdetails: Die Karten der Hofseite verlinken
 * hierher, das Blatt von früher gibt es nicht mehr. Aufbau: Bild, Name,
 * Marken, Schild (E9), Beschreibung; die Kaufkarte mit Größenkacheln der
 * Familie (E3), Menge und „In den Korb" — als EINE Leiste, am Handy fest
 * unten (Fokus-Seite, keine Unterleiste), ab 768 px am Ende der Inhaltsspalte
 * klebend; die Kennzeichnung als offene Karte;
 * „Gleich mit abholen"; ab 1024 px rechts die Spalte der Hofseite
 * (EINE Komponente, hofseite-seitenspalte.tsx) mit dem Mini-Warenkorb.
 *
 * Gekauft wird über den bestehenden Korb (useCart → /api/reserve); was
 * entschieden wird (Sichtbarkeit, Familie, Vorrat, Grenzen, Beträge), steht
 * in src/lib/produktdetail.ts. Die Vorschau des Hofs (?vorschau=1) zeigt die
 * Seite ohne Korb (korbErlaubt), Links bleiben in der Vorschau.
 */

export function ProduktdetailKunde({
  farm,
  produktId,
  gewaehltId,
  ansicht,
  kaeufer = null,
  jetzt,
  sperre,
}: {
  /** Der Hof ohne Telefon und E-Mail (Nr. 70): Die Seite entfernt sie auf dem Server, wie bei der Hofseite. */
  farm: HofseiteHof
  /** Das Produkt aus dem Pfad — die Seite hat geprüft, dass es zu diesem Hof gehört und sichtbar ist. */
  produktId: string
  /** Die gewählte Größe (aus ?groesse=, geprüft) — sonst gleich produktId. */
  gewaehltId: string
  ansicht: Pick<SeitenAnsicht, 'art' | 'kaufen'>
  /** `?kaeufer=betrieb` aus „Region › Futter kaufen" (Nr. 29, geprüft) — reist mit zur Kasse und in die Links dieses Hofs. */
  kaeufer?: KaeuferVorbelegung | null
  /** Zeitpunkt der Anfrage (ISO) vom Server — Gebührensatz und Abholtage rechnen davon (Hydration). */
  jetzt: string
  /** Die Kaufsperre (Register N24), einmal auf dem Server mit `jetzt` gerechnet (kaufSperre in page.tsx). */
  sperre: KaufSperre
}): React.JSX.Element | null {
  const produkte = farm.products
  const einstieg = useMemo(() => sichtbaresProdukt(produkte, produktId), [produkte, produktId])
  // Klein nach groß (Board s1-/w1-produkt Bild 1, Nr. 252) — die Reihenfolge der Kacheln und der Familie sind eine.
  const familie = useMemo(() => (einstieg ? groessenAufsteigend(produktFamilie(produkte, einstieg)) : []), [produkte, einstieg])
  const [gewaehlt, setGewaehlt] = useState(gewaehltId)
  const [menge, setMenge] = useState(1)
  const [fehler, setFehler] = useState<string | null>(null)
  const [wirdHinzugefuegt, setWirdHinzugefuegt] = useState<string | null>(null)
  const [korbOffen, setKorbOffen] = useState(false)

  const alsVorschau = ansicht.art === 'vorschau'
  const mitKorb = korbErlaubt({ isEditMode: false, kaufen: ansicht.kaufen })
  const { items, total, addItem, updateQuantity, removeItem } = useCart(farm.id, farm.slug)
  // Notbremse (Register N34, Nr. 189): Der Kaufknopf ruht wie bei einer Kaufsperre;
  // den Grund sagt der Hinweis über „Kaufen“ (und das Band unter dem Kopf).
  const stopp = useBestellstopp()
  const kaufSperre = sperreMitBestellstopp(sperre, stopp)

  const kundenSeite: KundenSeite = { art: 'produkt', hofSlug: farm.slug }
  const zurueck = alleProdukteLink(farm.slug, alsVorschau)
  const beimZurueckZeile = useRueckwegKlick(kundenSeite, 'zeile')
  // G9 (Nr. 252): Am Handy scrollt der Kopf der Shell hier weg, es klebt nur die Hofzeile — mit dem Warenkorb,
  // damit der Weg zum Korb bleibt (vorher stand er im Kopf der Shell).
  const korbKopf = useWarenkorbKopf()
  const [klebeZeile, setKlebeZeile] = useState<HTMLDivElement | null>(null)
  // Der Fokus scrollt nie unter die klebende Zeile (WCAG 2.4.11): Die Shell setzt am Handy scroll-padding-top 0
  // (data-kopf-scrollt), die Höhe der Zeile kennt nur die Seite — sie steht deshalb als Stil an der Wurzel.
  useEffect(() => {
    if (!klebeZeile || typeof ResizeObserver === 'undefined' || typeof window.matchMedia !== 'function') return
    const wurzel = document.documentElement
    const handy = window.matchMedia('(max-width: 767px)')
    const setze = () => {
      if (handy.matches) wurzel.style.scrollPaddingTop = `${klebeZeile.offsetHeight}px`
      else wurzel.style.removeProperty('scroll-padding-top')
    }
    const beobachter = new ResizeObserver(setze)
    beobachter.observe(klebeZeile)
    handy.addEventListener('change', setze)
    return () => {
      beobachter.disconnect()
      handy.removeEventListener('change', setze)
      wurzel.style.removeProperty('scroll-padding-top')
    }
  }, [klebeZeile])

  // EIN Warenkorb-Symbol am Handy (Abnahme Lauf 32, produkt 9): Solange der Kopf der Shell zu sehen ist, trägt er
  // den Korb; erst wenn er weggescrollt ist (die Marke über der Zeile ist aus dem Bild), zeigt ihn die klebende Zeile.
  const [kopfMarke, setKopfMarke] = useState<HTMLSpanElement | null>(null)
  const [kopfWeg, setKopfWeg] = useState(false)
  useEffect(() => {
    if (!kopfMarke || typeof IntersectionObserver === 'undefined') return
    const beobachter = new IntersectionObserver(([eintrag]) => setKopfWeg(eintrag ? !eintrag.isIntersecting : false))
    beobachter.observe(kopfMarke)
    return () => beobachter.disconnect()
  }, [kopfMarke])

  // Die Seite prüft vorher (notFound); hier nur die Absicherung für den Typ.
  if (!einstieg) return null

  const produkt = gewaehlteGroesse(familie, einstieg, gewaehlt)
  const zustand = kartenZustand(produkt, kaufSperre)
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
  // Im Hofpreis-Modell (N38) der Endpreis — nur Anzeige; in den Korb geht weiter der Warenpreis.
  const preisProdukt = mitEndpreis(produkt, farm.preisAnzeige)
  const betrag = formatEuro(centsAlsEuro(kaufBetragCents(preisProdukt.price, mengeJetzt)))

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
      toast.success(`${p.name} liegt im Warenkorb`, { duration: 2000 })
      setMenge(1)
      setKorbOffen(true)
    } else {
      // Inline an der Kaufkarte statt eines Toasts (DESIGN_SYSTEM, „Zustände").
      setFehler(mengeAbgelehntText(ergebnis.error))
    }
  }

  const bild = produkt.imageUrl ?? produkt.categoryImageUrl
  const schild = futterSchild(produkt, farm.betriebsstatus)
  const brennmaterial = produkt.brennmaterial ? brennmaterialZeilen(produkt.brennmaterial) : []
  const beschreibung = produkt.description?.trim() ?? ''
  const einzelPreis = preisZeilen(preisProdukt)
  // Größen mit Endpreis (N38) — die Kacheln zeigen nur Text, gekauft wird über die Kennung.
  const kacheln = groessenKacheln(familie.map((p) => mitEndpreis(p, farm.preisAnzeige)), kaufSperre)
  const mitGrundpreis = kacheln.some((k) => k.grundpreis)
  const vorrat = vorratText(produkt, zustand)
  const mitnehmen = gleichMitAbholen(produkte, produkt, kaufSperre)
  // Raummeter und Schüttraummeter: eine Erklärzeile unter dem Preis (Board Bild 3, Nr. 252), Wortlaut aus RAUMMASS_ERKLAERUNG.
  const raummass = raummassZeile((familie.length > 0 ? familie : [produkt]).map((p) => p.unit))
  const preisJe = preisJeRaummass(preisProdukt.price, preisProdukt.unit, preisProdukt.unitSize)
  // Bei jedem Futter der Verantwortungs-Hinweis (E10a), bei „nur an Betriebe" mit Zusatz.
  // Über die ganze Familie: Die Abgabe kann je Größe abweichen, der Zusatz
  // „nur an Betriebe" darf auf der Seite nicht fehlen, wenn eine Größe ihn braucht.
  const verantwortung = futterVerantwortung(familie.length > 0 ? familie : [produkt])

  const ausverkauft = zustand.art === 'ausverkauft'
  // „Nur noch …" als leise Zeile statt als Marke — wie auf der Produktkarte (Freigabe Lauf 13, Nr. 85).
  const knapp = zustand.art === 'knapp' ? knappText(zustand.bestand, produkt.unit, produkt.unitSize) : null
  // Der Titel nennt bei Größen nur, was alle Größen teilen („Futterhafer“, Board w1-produkt Bild 1) — die
  // Größe steht in der Auswahl darunter. Dieselbe Regel wie die Namen der Kacheln (gemeinsamerAnfang).
  const titel = familienTitel(produkt.name, familie)
  // Der Satz unter der Auswahl bzw. dem Preis (Board): „Grundpreis zum Vergleichen · Preise inkl. …“.
  const preisSatz = [kacheln.length > 0 && mitGrundpreis ? 'Grundpreis zum Vergleichen' : null, gebuehr?.produkte ?? null].filter(Boolean).join(' · ')
  // Ausverkauft ohne andere Größe: statt Kaufknopf die Karte „Gerade ausverkauft“ mit dem Weg zum Angebot (Board Bild 3).
  const ausverkauftKarte = ausverkauft && kacheln.length === 0

  return (
    // Die Preisanzeige (N38, Nr. 197) für Preis, Korb und Seitenspalte dieser Seite.
    <PreisAnzeigeRahmen anzeige={farm.preisAnzeige}>
      <div className="mx-auto max-w-[1152px] px-4 pt-0 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:px-6 md:pt-4 md:pb-12 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-x-16">
        <div className="flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-1">
          {/* Rückweg (Board w1-/s1-produkt): am Handy „‹ Alle Produkte von <Hof>“, im Browser „‹ Zurück zu allen Produkten“.
              Am Handy klebt die Zeile oben (G9, Nr. 252: der Kopf der Shell scrollt weg) und trägt den Warenkorb. */}
          {/* Die Marke für „Kopf der Shell weggescrollt“ — ohne Höhe, direkt über der klebenden Zeile. */}
          <span ref={setKopfMarke} aria-hidden="true" className="-mb-3 block h-0 md:hidden" />
          <div
            ref={setKlebeZeile}
            data-klebe-zeile=""
            className="sticky top-0 z-30 -mx-4 flex items-center gap-2 bg-background px-4 max-md:border-b max-md:border-border md:static md:mx-0 md:px-0"
          >
          <Link
            href={zurueck}
            onClick={beimZurueckZeile}
            className={cn(
              'inline-flex min-h-11 min-w-0 w-fit items-center gap-1.5 rounded-md text-[16px] font-semibold text-foreground md:text-[15px] md:text-brand-text md:underline md:underline-offset-4',
              FOKUS_RAHMEN
            )}
          >
            <ChevronLeft className="size-5 md:hidden" strokeWidth={1.9} aria-hidden="true" />
            <span className="truncate md:hidden">Alle Produkte von {farm.name}</span>
            <span className="hidden md:inline">‹ Zurück zu allen Produkten</span>
          </Link>
          {/* An korbKopf allein (wie vorher die Shell: korb !== null): Wer einen Korb hat, behält am Handy den Weg dorthin,
              auch auf einer Seite ohne Kaufen (Runde 1 Nr. 252). */}
          {korbKopf && (
            <Link
              href={korbKopf.href}
              aria-label={`Warenkorb, ${korbKopf.anzahl} Artikel`}
              className={cn(
                'relative ml-auto flex size-11 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted md:hidden',
                !kopfWeg && 'hidden',
                FOKUS_RAHMEN
              )}
            >
              <Handbag className="size-5" strokeWidth={1.7} aria-hidden="true" />
              <Zaehler anzahl={korbKopf.anzahl} wofuer="Artikel im Warenkorb" ton="gruen" className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 text-[12px]" />
            </Link>
          )}
          </div>

          {/* ── Bild und Angaben ── */}
          <section aria-labelledby="produkt-titel" className="flex flex-col gap-3">
            {/* Das Bild als Band über der ganzen Spalte, Titel und Texte darunter (Board w1-/s1-produkt): am Handy
                390 : 200 wie die Vorschau „Auf der Produktseite“ (Bild-Baustein, Register N17), ab 768 px 160 px hoch.
                Im Dunkeln gedämpft wie ein Foto, auch die Illustration (F041), gerahmt. */}
            <div
              className={cn(
                'relative aspect-[390/200] w-full shrink-0 overflow-hidden border border-border md:aspect-auto md:h-[160px]',
                RUNDUNG.karte,
                PLATZHALTER_FLAECHE,
                bild && !produkt.imageUrl ? ILLUSTRATION_HUELLE : FOTO_HUELLE
              )}
            >
              {bild && produkt.imageUrl ? (
                <Image
                  src={bild}
                  alt={produkt.name}
                  fill
                  priority
                  sizes="(min-width: 1024px) 680px, 100vw"
                  className={cn('object-cover', ausverkauft && 'grayscale')}
                  // Ausschnitt nur am echten Foto (Register N17); ausverkauft ohne Filter des Hofs, sonst überschriebe er grayscale.
                  style={bildStil(produkt.bildAusschnitt, { filter: !ausverkauft })}
                />
              ) : bild ? (
                // Die Kategorie-Illustration als eigenes Quadrat mittig im Band, nachts wie ein Foto auf ihrem Grund
                // (gedämpft über die Hülle) und selbst gerahmt — kein schwebendes helles Quadrat (F041, §37.1 15.5.3).
                <span
                  data-slot="illustration"
                  className="absolute inset-y-6 left-1/2 aspect-square -translate-x-1/2 overflow-hidden rounded-[10px] dark:ring-1 dark:ring-border md:inset-y-4"
                >
                  <Image
                    src={bild}
                    alt=""
                    fill
                    priority
                    sizes="200px"
                    className={cn('object-cover', ILLUSTRATION_BILD, ausverkauft && 'grayscale')}
                  />
                </span>
              ) : (
                <span aria-hidden="true" className="flex h-full items-center justify-center font-heading text-5xl font-semibold text-muted-foreground">
                  {produktInitiale(produkt.name)}
                </span>
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 id="produkt-titel" className="font-heading text-[26px] leading-[1.1] font-semibold break-words text-foreground md:text-[28px]" title={produkt.name}>
                  {titel}
                </h1>
                {/* V19: neutrale graue Pille mit Fläche (Liste produkt, 1440 hell). */}
                {ausverkauft && (
                  <span className="inline-flex h-[22px] items-center rounded-full border border-border bg-muted px-2.5 text-[12px] font-bold whitespace-nowrap text-foreground">
                    {AUSVERKAUFT_WORT}
                  </span>
                )}
              </div>
              {/* Rücktritt je Produkt (Nr. 214): Angaben des Hofs unter dem Namen — nicht bei Ware nur für Betriebe (kein Rücktritt für Unternehmer). */}
              {produkt.abgabe !== 'NUR_BETRIEBE' && <RuecktrittHinweis angabe={produkt} className="text-[13px]" />}

              {(produkt.labels.length > 0 || produkt.abgabe === 'NUR_BETRIEBE' || produkt.brennmaterial || produkt.category === 'BRENNHOLZ') && (
                <ul className="flex flex-wrap gap-1.5">
                  {produkt.labels.map((l) => (
                    // Nicht die grüne StatusBadge: Grüne Schrift auf grüner Tönung erreicht auf dem
                    // hellen Seitengrund nur 4,37 : 1 (Axe) — wie die Hinweiskarte normale Schrift, grünes Symbol.
                    <li
                      key={l}
                      className="inline-flex h-[22px] items-center gap-1 rounded-full border border-accent/50 bg-accent/12 px-2 text-[12px] font-bold whitespace-nowrap text-foreground"
                    >
                      {l === 'BIO' && <Leaf className="size-3 shrink-0 text-status-fertig" strokeWidth={1.7} aria-hidden="true" />}
                      {SIEGEL[l].name}
                    </li>
                  ))}
                  {/* Register E9-Ergänzung: Ware nur für Betriebe ist gekennzeichnet (Register vor Board). */}
                  {produkt.abgabe === 'NUR_BETRIEBE' && (
                    <li>
                      <Marke art="tun" form="schild">
                        Nur an Betriebe
                      </Marke>
                    </li>
                  )}
                  {/* Brennmaterial gibt es nur zum Abholen (E11). */}
                  {(produkt.brennmaterial || produkt.category === 'BRENNHOLZ') && (
                    <li>
                      <Marke art="erledigt" form="schild">
                        Nur Abholung am Hof
                      </Marke>
                    </li>
                  )}
                </ul>
              )}

              {knapp && <p className="text-[13px] font-medium text-muted-foreground">{knapp}</p>}

              {schild && <FutterSchild text={schild} />}

              {/* Abholhinweise des Futters (N23, Nr. 123) — derselbe Baustein wie in „Futter kaufen". */}
              {produkt.abholhinweise.length > 0 && <AbholhinweisZeile hinweise={produkt.abholhinweise.map((hinweis) => ({ hinweis }))} />}

              {/* Holzart, Länge, Trocknung als drei Kacheln (Board w1-produkt Bild 3), nach Platz statt fester Spalten. */}
              {brennmaterial.length > 0 && (
                <dl className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2">
                  {brennmaterial.map((z) => (
                    <div key={z.titel} className={cn('border border-border bg-card px-2.5 py-2', RUNDUNG.karte)}>
                      <dt className="text-[13px] text-muted-foreground">{z.titel}</dt>
                      <dd className="text-[15px] font-bold break-words text-foreground">{z.wert}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {produkt.abgabe === 'NUR_BETRIEBE' && (
                <p className="text-[14px] text-foreground">
                  Dieses Futtermittel gibt der Hof nur an landwirtschaftliche Betriebe ab. Beim Bestellen fragen wir nach deiner Betriebsnummer.
                </p>
              )}

            </div>
          </section>

          {/* Kaufsperre (Pause, keine Abholzeit, ausgebucht — Register N24): Das Produkt bleibt sichtbar,
              nur gekauft wird nicht; dieselbe Karte wie auf der Hofseite. */}
          <KaufSperreHinweis sperre={sperre} hofName={farm.name} pauseMessage={farm.pauseMessage} hofseite />
          {/* Die Sperre des Hofs geht vor; sonst der Satz der Notbremse an derselben Stelle. */}
          {sperre === null && <BestellstoppHinweis stopp={stopp} />}

          {/* ── Kaufen: frei auf der Seite, ohne Karte (Board) ── */}
          <section aria-labelledby="kaufen-titel" className="flex flex-col gap-2.5">
            {kacheln.length > 0 ? (
              <>
                <h2 id="kaufen-titel" className="text-[16px] font-bold text-foreground">
                  Größe wählen
                </h2>
                {/* Untereinander über die volle Breite (Board w1-/s1-produkt Bild 1). */}
                <GroessenWahl beschriftung="Größe wählen" wert={produkt.id} onWertChange={waehleGroesse} form="zeile">
                  {kacheln.map((k) => (
                    <Groessenkachel
                      key={k.id}
                      wert={k.id}
                      name={k.name}
                      hinweis={k.hinweis ?? undefined}
                      preis={k.preis}
                      grundpreis={k.grundpreis ?? undefined}
                      vorrat={groessenVorrat(familie.find((p) => p.id === k.id)?.stock ?? 0, k.zustand, k.vorrat !== null)}
                      zustand={k.zustand}
                      form="zeile"
                    />
                  ))}
                </GroessenWahl>
                {raummass && <p className="text-[13px] text-muted-foreground">{raummass}</p>}
              </>
            ) : (
              <div className="flex flex-col gap-1">
                <h2 id="kaufen-titel" className="sr-only">
                  Preis und Menge
                </h2>
                {/* Preis fett, Grundpreis grau darunter — dieselbe Hilfe wie die Hofseite (preisZeilen, Nr. 252); Raummaße ausgeschrieben. */}
                <p className="text-[16px] font-bold text-foreground tabular-nums">{preisJe ?? einzelPreis.preis}</p>
                {!preisJe && einzelPreis.grundpreis && <p className="text-[13px] text-muted-foreground tabular-nums">{einzelPreis.grundpreis}</p>}
                {vorrat && zustand.art === 'kaufbar' && <p className="text-[13px] text-muted-foreground">Vorrat: {vorrat}</p>}
                {raummass && <p className="text-[13px] text-muted-foreground">{raummass}</p>}
              </div>
            )}

            {preisSatz && <p className="text-[13px] text-muted-foreground">{preisSatz}</p>}

            {kaufbar && nochMoeglich === 0 && (
              <p className="text-[13px] text-muted-foreground">Alles, was der Hof davon hat, liegt schon in deinem Warenkorb.</p>
            )}

            {fehler && (
              <div role="alert">
                <Hinweiskarte ton="orange">{fehler}</Hinweiskarte>
              </div>
            )}

            {ausverkauftKarte && (
              <div className={cn(SPALTEN_KARTE, 'gap-1.5')}>
                <p className="text-[15px] font-bold text-foreground">Gerade ausverkauft</p>
                <p className="text-[14px] break-words text-muted-foreground">
                  {ausverkauftSatz(produkt.name)}
                </p>
                <Link
                  href={zurueck}
                  className={cn(
                    'mt-1 flex min-h-[52px] items-center justify-center rounded-[14px] border border-input bg-card px-3 text-center text-[16px] font-bold text-foreground hover:bg-muted',
                    FOKUS_RAHMEN
                  )}
                >
                  Zum Angebot von {farm.name}
                </Link>
              </div>
            )}
          </section>

          {/* Ausverkauft ohne andere Größe zeigt das Board weder Kennzeichnung noch „Gleich mit abholen“ (Bild 3):
              Gekauft wird hier nichts, die Karte darüber führt zum Angebot. */}
          {/* Die Beschreibung unter den Größen, vor der Kennzeichnung (Board s1-/w1-produkt Bild 2, Nr. 252). */}
          {beschreibung && <p className="text-[15px] leading-relaxed break-words whitespace-pre-line text-foreground">{beschreibung}</p>}

          {!ausverkauftKarte && <Kennzeichnung zeilen={produktAngaben(produkt, farm)} bestaetigtAm={produkt.futter?.bestaetigtAm ?? null} />}
          {/* Bei jedem Futter der Verantwortungs-Hinweis (E10a) — unter der Kennzeichnung, wo das Board seinen Futter-Satz zeigt
              (w1-/s1-produkt Bild 2); der Wortlaut ist der aus E10a (futterVerantwortung, „Register vor Board“). */}
          {!ausverkauftKarte && <FutterVerantwortung saetze={verantwortung} className="text-[13px]" />}

          {!ausverkauftKarte && (
            <GleichMitAbholen
              produkte={mitnehmen}
              link={link}
              mitFamilie={(p) => produktFamilie(produkte, p).length > 0}
              imKorb={imKorb}
              wirdHinzugefuegt={wirdHinzugefuegt}
              onInDenKorb={(p) => void inDenKorb(p, 1)}
            />
          )}

          {/* Die EINE Leiste mit Menge und „In den Korb · €“ (Board): am Handy fest unten (Fokus-Seite,
              keine Unterleiste), ab 768 px am unteren Rand der Inhaltsspalte klebend, der Knopf links und breit.
              data-unten-fest: Der Cookie-Hinweis steht darüber (src/lib/cookie-hinweis.ts). Ausverkauft ohne
              Leiste — dort führt die Karte zum Angebot. */}
          {!ausverkauftKarte && (
            <div
              data-unten-fest=""
              className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] md:sticky md:inset-x-auto md:mt-6 md:bg-background md:px-0 md:pt-4 md:pb-4"
            >
              <div className="mx-auto flex max-w-[1152px] items-center gap-3 md:flex-row-reverse">
                {kaufbar ? (
                  <>
                    {/* Die Menge als gerahmte Pille „− n +“ (G13, form="pille", Nr. 252) mit sichtbarer Beschriftung „Menge“
                        und je Knopf und Feld 44 px Ziel (Abnahme Lauf 32, produkt 4: Knöpfe 42 px, Feld 36 px, Feld ohne
                        Beschriftung). Die Pille ist ein geteilter Baustein (ui/stepper.tsx) — die Höhe kommt hier über ihre
                        data-slot-Hülle, damit Hof-Seiten mit derselben Pille unverändert bleiben. Die Pille nimmt keine id an
                        (htmlFor ginge nicht), darum umschließt das Label sie; sein erstes beschriftbares Kind wäre aber der
                        Minus-Knopf — ein Tipp auf „Menge“ senkte die Menge (Runde 1). mengeLabelTipp setzt den Fokus statt
                        dessen ins Feld; Tipps auf −, Zahl und + wirken wie immer. */}
                    <label className="flex shrink-0 flex-col gap-0.5" onClick={mengeLabelTipp}>
                      <span className="text-[12px] leading-none font-semibold text-muted-foreground">Menge</span>
                      <Stepper
                        beschriftung={`Menge ${produkt.name}`}
                        wert={mengeJetzt}
                        min={1}
                        max={Math.max(1, nochMoeglich)}
                        disabled={nochMoeglich === 0}
                        onWertChange={setMenge}
                        eingabeClassName="h-11 w-11"
                        className="[&_[data-slot=stepper-pille]]:h-12"
                        form="pille"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void inDenKorb(produkt, mengeJetzt)}
                      disabled={wirdHinzugefuegt === produkt.id || nochMoeglich === 0}
                      className={cn(
                        'inline-flex min-h-[50px] min-w-0 flex-1 items-center justify-center rounded-[14px] bg-accent px-4 text-[16px] font-bold text-accent-foreground transition-opacity duration-[250ms] hover:opacity-90 disabled:opacity-60',
                        FOKUS_RAHMEN
                      )}
                    >
                      <span className="truncate">{wirdHinzugefuegt === produkt.id ? 'Einen Moment …' : `In den Korb · ${betrag}`}</span>
                    </button>
                  </>
                ) : (
                  <p className="flex min-h-[50px] flex-1 items-center justify-center rounded-[14px] bg-muted px-4 text-center text-[15px] text-muted-foreground">
                    {ruhenderKnopfText(zustand)}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Ab 1024 px die rechte Spalte der Hofseite — dieselbe Komponente, mit dem Mini-Warenkorb. */}
        <HofseiteSeitenspalte
          hof={farm}
          sperre={sperre}
          zahlungsarten={zahlungsarten(farm)}
          gebuehrHinweis={gebuehr?.produkte ?? null}
          gebuehrKorb={gebuehr?.korb ?? null}
          mitKorb={mitKorb}
          jetzt={jetzt}
          produkte={produkte}
          kasseHref={kasse}
          kasseUmriss
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
          kaufSperre={{ sperre, hofName: farm.name, pauseMessage: farm.pauseMessage }}
        />
      )}
    </PreisAnzeigeRahmen>
  )
}

/** „Futterhafer“ aus „Futterhafer, Big Bag 500 kg“ — die Wörter, die alle Größen teilen; ohne Familie der ganze Name. */
function familienTitel(name: string, familie: readonly { name: string }[]): string {
  const anfang = gemeinsamerAnfang(familie.map((p) => p.name))
  if (anfang === 0) return name
  return name.trim().split(/\s+/).slice(0, anfang).join(' ').replace(/[,;:–-]+$/, '')
}
