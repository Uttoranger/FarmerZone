'use client'

import { useState, useEffect, useImperativeHandle, type Ref } from 'react'
import { usePreisAnzeige } from '@/components/shared/preis-anzeige'
import { mitEndpreis } from '@/lib/plattformgebuehr'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { X, ChevronRight, Check, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { useCart, useKorbHinweis, zeigeKorbHinweis } from '@/lib/use-cart'
import { gleicheKorbMitHofseite } from '@/lib/reservierung'
import { entfernteNamen, korbHinweisMitNamen } from '@/lib/korb-hinweis'
import { WARENKORB_ANKER } from '@/lib/warenkorb-speicher'
import { centsAlsEuro, formatEuro, mitAnzahl } from '@/lib/format'
import { VORSCHAU_KAUF_HINWEIS, korbErlaubt } from '@/lib/hofseite-vorschau'
import { kartenZustand, kategorieAbschnitte, zeigeKaufknopf, type KaufSperre } from '@/lib/bereiche-anzeige'
import { sperreMitBestellstopp } from '@/lib/notbremse'
import { useBestellstopp } from '@/components/notbremse-band'
import { SCHAUFENSTER_PRODUKTE, korbBetraege, oeffnetKorbHier, stehtNurAmHandy, uebersichtProdukte } from '@/lib/hofseite-kunde'
import { BESTAETIGUNG_MS, RUECKGAENGIG, blattBeimErstenMal, imKorbText, korbFehlerText } from '@/lib/hofseite-orientierung'
import { NETZ_KNOPF } from '@/lib/netz'
import { bereichAusParameter } from '@/schemas/hoefe-filter'
import type { AnzeigeBereich } from '@/lib/taxonomie'
import type { PublicProduct } from '@/server/queries/farm'
import { CartSheet } from './cart-sheet'
import { futterVerantwortungImKorb } from '@/lib/futter-registrierung'
import { produktPfad } from '@/lib/produktdetail'
import { PRODUKT_LISTE, ProduktKarte } from '@/components/hofseite/produkt-karte'
import { ProduktAbschnitte } from '@/components/hofseite/produkt-abschnitte'
import { EmptyState } from '@/components/ui/empty-state'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

type ReorderItem = { productId: string; productName: string; quantity: number }

type Props = {
  products: PublicProduct[]
  farmId: string
  farmSlug: string
  initialReorderItems?: ReorderItem[]
  /**
   * Die Kaufsperre (Pause, keine Abholzeit, ausgebucht — kaufSperre, Register N24):
   * Kauf-Schaltflächen und der Nachbestell-Link sind tot (Durchsetzung liegt am Server).
   * Ohne Angabe keine Sperre.
   */
  sperre?: KaufSperre
  /** Hofname und Pausen-Nachricht (Farm.pauseMessage) für den Hinweis zur Kaufsperre im Korb-Blatt. */
  hofName: string
  pauseMessage: string | null
  /**
   * Ob Kaufen wirkt — entschieden von `ansichtsModus` (src/lib/ansichts-modus.ts).
   * In der Vorschau des Hofs (?vorschau=1) nicht: kein Korb, keine
   * Reservierung, nur der Hinweis. Ohne Angabe wirkt es.
   */
  kaufen?: boolean
  /**
   * Kundenansicht (Nr. 10): welcher Teil der Produkte im offenen Reiter steht
   * — die Auswahl der Übersicht, alle Abschnitte im Reiter Produkte oder
   * keiner (Beiträge). Das Raster bleibt in jedem Reiter eingehängt: Korb
   * und Nachbestell-Link leben hier und überstehen den Wechsel.
   */
  teil?: 'auswahl' | 'alle' | 'keins'
  /** „Preise zzgl. 5 % Servicegebühr … einmal pro Bestellung" über den Abschnitten — null ohne Gebühr. */
  gebuehrHinweis?: string | null
  /** „+ Gebühr" an der Korb-Leiste und im Korb — null ohne Gebühr. */
  gebuehrKorb?: string | null
  /** Abschnitt, zu dem der Reiter Produkte beim Öffnen springt (?bereich=futter). */
  springeZu?: string | null
  onGesprungen?: () => void
  /**
   * Wohin Bild und Name einer Produktkarte führen (Nr. 11: die Produktseite;
   * in der Vorschau des Hofs die Vorschau davon). Ohne Angabe die Produktseite.
   */
  produktLink?: (id: string) => string
  /**
   * Platz unter den Produkten, damit die Korb-Leiste unter lg das letzte
   * nicht verdeckt. Aus im Schaufenster der Übersicht (Register N5): Dort
   * folgen noch Abholung, Zahlung und Über uns — der Platz stünde mitten auf
   * der Seite; das Seitenende hält ihn über das Polster von Seite und Shell frei.
   */
  platzUnten?: boolean
  /**
   * Der Weg in den Korb nach außen (Nr. 128): „Dazu im Hofladen“ in „Aktuell
   * vom Hof“ legt über GENAU diese Funktion in den Korb — dieselbe, die die
   * Produktkarten bekommen (Vorschau-Hinweis, Reservierung, Toast, Korb öffnen).
   * Kein zweiter Warenkorb: Ein zweiter useCart führte seinen eigenen Korb.
   */
  inDenKorb?: Ref<InDenKorb>
}


// Produktpreise kommen aus src/lib/format.ts (formatGrundpreis + Grundpreis-
// Zeile), damit Hofübersicht, Warenkorb und Bauern-Bereich dieselbe Schreib-
// weise zeigen. Die Warenkorb-Summe nimmt formatEuro aus derselben Datei.

/**
 * Der gewünschte Bereich aus der URL (?bereich=futter) — null, wenn keiner
 * gewählt ist. Welcher dann wirklich angezeigt wird, entscheidet
 * teileHofseite; die Kopfzeile der Hofseite fragt dieselbe Stelle, damit ihr
 * Rückweg in den angezeigten Bereich führt (farm-page-view.tsx).
 */
export function useBereichWunsch(): AnzeigeBereich | null {
  const wert = useSearchParams().get('bereich')
  return wert === null ? null : bereichAusParameter(wert)
}

/** Ein Produkt in den Korb legen — so, wie es der Kaufknopf der Produktkarte tut (Nr. 128, `inDenKorb`). */
export type InDenKorb = (produkt: PublicProduct) => void

/**
 * Die kurze Zeile über der Korb-Leiste (Register N30, Nr. 177): nach jedem
 * „In den Korb" außer dem ersten einer Sitzung „… ist im Korb" mit
 * „Rückgängig" — oder, wenn der Griff in den Korb scheiterte, der Grund, am
 * Netz mit „Nochmal" (Register N29).
 */
type KorbZeile =
  | { art: 'im-korb'; nr: number; name: string; produktId: string; vorher: number }
  | { art: 'fehler'; nr: number; text: string; nochmal: (() => void) | null }

/** Der sessionStorage des Browsers — Zugriff kann werfen (gesperrter Speicher); blattBeimErstenMal fängt das. */
const sitzungsSpeicher = () => window.sessionStorage

export function ProductGrid({
  products,
  farmId,
  farmSlug,
  initialReorderItems,
  sperre: sperreDesHofs = null,
  hofName,
  pauseMessage,
  kaufen = true,
  teil = 'alle',
  gebuehrHinweis = null,
  gebuehrKorb = null,
  springeZu = null,
  onGesprungen,
  produktLink = (id) => produktPfad(farmSlug, id),
  platzUnten = true,
  inDenKorb,
}: Props) {
  // Notbremse (Register N34, Nr. 189): Kaufknöpfe und Nachbestell-Link ruhen wie
  // bei einer Kaufsperre, der Korb bleibt; den Grund sagt das Band unter dem Kopf.
  const sperre = sperreMitBestellstopp(sperreDesHofs, useBestellstopp())
  // EINE Regel für jeden Weg in den Korb (Kaufknopf, Nachbestell-Link,
  // #warenkorb-Anker, Korb-Knopf, Sheet) — src/lib/hofseite-vorschau.ts.
  const mitKorb = korbErlaubt({ isEditMode: false, kaufen })

  const [cartOpen, setCartOpen] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [showWelcomeBack, setShowWelcomeBack] = useState(false)
  const [korbZeile, setKorbZeile] = useState<KorbZeile | null>(null)

  // „… ist im Korb" steht 6 s (BESTAETIGUNG_MS); ein Fehler bleibt, bis die
  // Kundin wieder etwas tut — sein „Nochmal" soll nicht unter dem Finger verschwinden.
  const zeileNr = korbZeile?.art === 'im-korb' ? korbZeile.nr : null
  useEffect(() => {
    if (zeileNr === null) return
    const weg = setTimeout(() => setKorbZeile((z) => (z?.nr === zeileNr ? null : z)), BESTAETIGUNG_MS)
    return () => clearTimeout(weg)
  }, [zeileNr])

  const { items, count, total: warenSumme, isHydrated, addItem, updateQuantity, removeItem, ersetzeKorb } = useCart(farmId, farmSlug)
  // Im Hofpreis-Modell (N38) die Summe der Endpreise — dieselbe Zahl wie Korb und Kasse.
  const anzeige = usePreisAnzeige()
  const total = anzeige ? centsAlsEuro(korbBetraege(items.map((i) => mitEndpreis(i, anzeige))).summeCents) : warenSumme
  const korbHinweis = useKorbHinweis(farmId)

  // Warenkorb ehrlich (Register N28): Einmal nach dem Hydrieren gleicht die
  // Hofseite den gespeicherten Korb mit ihren Produkten ab — Fehlendes raus,
  // Mengen auf den Bestand, neue Preise mit einem Satz. Ohne Halt und ohne
  // Prüfung am Server: Wer nur schaut, blockiert nichts; verbindlich prüft die
  // Kasse. Nur wo es einen Korb gibt (nie in der Vorschau des Hofs); mit
  // Kaufsperre bleibt der Korb (gleicheKorbMitHofseite gibt dann null).
  useEffect(() => {
    if (!mitKorb || !isHydrated) return
    let satz = null as string | null
    ersetzeKorb((vorher) => {
      const abgleich = gleicheKorbMitHofseite(vorher, products, sperre)
      // Board s1-/w1-korb Bild 2 (Nr. 276): der Satz zu entfernten Positionen mit dem Produktnamen — die Quelle kennt
      // keine Namen, der Korb vorher schon. Alles andere im Satz bleibt wörtlich (korbHinweisMitNamen).
      satz = abgleich?.satz ? korbHinweisMitNamen(abgleich.satz, entfernteNamen(vorher, abgleich.positionen)) : null
      return abgleich?.positionen ?? vorher
    })
    if (satz) zeigeKorbHinweis(farmId, satz)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated])

  // Das Warenkorb-Symbol der Kopfzeile führt mit #warenkorb hierher: den
  // Korb gleich öffnen. Der Anker ist ein einmaliger Auftrag — weg damit,
  // sonst öffnete Neuladen oder Zurück den Korb wieder. Geöffnet wird nach
  // dem ersten Bild: Das Sheet gleitet sichtbar herein, statt beim Laden
  // schon offen dazustehen.
  useEffect(() => {
    if (!mitKorb || !isHydrated) return
    if (window.location.hash !== `#${WARENKORB_ANKER}`) return
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    if (count > 0) requestAnimationFrame(() => setCartOpen(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated])

  // Den Korb aus dem Nachbestell-Link füllen — nur, wo es einen Korb gibt.
  useEffect(() => {
    if (!mitKorb) return
    if (!isHydrated || !initialReorderItems || initialReorderItems.length === 0) return
    if (items.length > 0) return

    async function prefill() {
      let prefilled = false
      for (const ri of initialReorderItems!) {
        // Dieselbe Regel wie der Kaufknopf: Mit Kaufsperre (N24) legt auch der Link nichts in den Korb.
        const product = products.find(
          (p) => p.id === ri.productId && zeigeKaufknopf(p, sperre),
        )
        if (!product) continue
        const result = await addItem(
          {
            productId: product.id,
            name: product.name,
            price: product.price,
            unit: product.unit,
            unitSize: product.unitSize,
            imageUrl: product.imageUrl,
          },
          ri.quantity,
        )
        if (result.ok) prefilled = true
      }
      if (prefilled) {
        setShowWelcomeBack(true)
        setCartOpen(true)
      }
    }

    prefill()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated])

  async function handleAddToCart(product: PublicProduct) {
    // Vorschau des Hofs: kein Korb, keine Reservierung — nur der Hinweis,
    // und zwar VOR dem ersten Griff in den Korb.
    if (!mitKorb) {
      toast.info(VORSCHAU_KAUF_HINWEIS)
      return
    }
    setAddingId(product.id)
    setKorbZeile(null)
    // Die Menge davor — „Rückgängig" setzt genau sie wieder (0: heraus, Halt frei).
    const vorher = imKorb(product.id)
    const result = await addItem(
      {
        productId: product.id,
        name: product.name,
        price: product.price,
        unit: product.unit,
        unitSize: product.unitSize,
        imageUrl: product.imageUrl,
      },
      1,
    )
    setAddingId(null)

    if (!result.ok) {
      // Nie der rohe Text des Servers (korbFehlerText); am Netz mit „Nochmal" (N29).
      setKorbZeile({ art: 'fehler', nr: Date.now(), text: korbFehlerText(result, 'legen'), nochmal: result.nochmal ? () => void handleAddToCart(product) : null })
      return
    }
    // Register N30: Nur das erste „In den Korb" einer Sitzung öffnet das Blatt,
    // danach bestätigt die Zeile, und die Korb-Leiste zählt hoch.
    if (blattBeimErstenMal(sitzungsSpeicher)) setCartOpen(true)
    else setKorbZeile({ art: 'im-korb', nr: Date.now(), name: product.name, produktId: product.id, vorher })
  }

  /**
   * „Rückgängig": die Menge von vorher, über denselben Korb (useCart) — 0 nimmt
   * das Produkt heraus und gibt den Halt frei (ohne Server, scheitert nicht).
   * Scheitert das Zurücksetzen, sagt es die Zeile an der Aktion (N29), am Netz
   * mit „Nochmal" — sonst stünde die Menge still erhöht.
   */
  function rueckgaengig(zeile: Extract<KorbZeile, { art: 'im-korb' }>) {
    setKorbZeile(null)
    if (zeile.vorher === 0) {
      removeItem(zeile.produktId)
      return
    }
    void updateQuantity(zeile.produktId, zeile.vorher).then((ergebnis) => {
      if (ergebnis.ok) return
      setKorbZeile({ art: 'fehler', nr: Date.now(), text: korbFehlerText(ergebnis, 'menge'), nochmal: ergebnis.nochmal ? () => rueckgaengig(zeile) : null })
    })
  }

  // Ohne Abhängigkeiten nach jedem Rendern: Die Funktion schließt den Korb
  // dieses Renders ein, wie die Produktkarten sie bekommen.
  useImperativeHandle(inDenKorb, () => handleAddToCart)

  // Der Warenkorb der Shell (Kopf, Mittelknopf am Handy) zeigt auf
  // /{hof}#warenkorb. Steht man schon auf dieser Hofseite, lädt der Link
  // nichts neu und der Anker allein öffnete nichts — dann öffnet die Seite
  // den Korb selbst (oeffnetKorbHier). Abgefangen in der Einfangphase, vor
  // Nexts Link; Mittelklick und neuer Tab bleiben dem Link.
  useEffect(() => {
    if (!mitKorb) return
    function beiKlick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const link = e.target instanceof Element ? e.target.closest('a[href]') : null
      const href = link?.getAttribute('href')
      if (!href || !oeffnetKorbHier(href, window.location.href)) return
      e.preventDefault()
      setCartOpen(true)
    }
    document.addEventListener('click', beiKlick, true)
    return () => document.removeEventListener('click', beiKlick, true)
  }, [mitKorb])

  /** Menge eines Produkts im Korb — in der Vorschau gibt es keinen Korb, also nie eine. */
  function imKorb(produktId: string): number {
    if (!mitKorb) return 0
    return items.find((i) => i.productId === produktId)?.quantity ?? 0
  }

  function karte(p: PublicProduct) {
    return (
      <ProduktKarte
        produkt={p}
        zustand={kartenZustand(p, sperre)}
        imKorb={imKorb(p.id)}
        wirdHinzugefuegt={addingId === p.id}
        href={produktLink(p.id)}
        onInDenKorb={handleAddToCart}
      />
    )
  }

  // Bei Pause keine Korb-Leiste (Board s1-hofseite Bild 4): Bestellen geht nicht, der Korb bleibt
  // gespeichert und ist über den Warenkorb der Shell erreichbar. Nur Anzeige — die Sperre selbst bleibt.
  const korbLeiste = mitKorb && isHydrated && count > 0 && sperreDesHofs !== 'pause'

  return (
    <>
      {/* Willkommen-zurück-Hinweis — nur, wo es einen Korb gibt (der Nachbestell-Effekt setzt ihn ohnehin nur dann). */}
      {mitKorb && showWelcomeBack && (
        <div className="relative mb-4 rounded-2xl border border-accent/45 bg-accent/12 py-2 pr-12 pl-4 text-[13.5px] font-medium text-foreground">
          <p className="flex min-h-9 items-center">Willkommen zurück! Dein letzter Einkauf liegt wieder im Warenkorb.</p>
          <button
            type="button"
            onClick={() => setShowWelcomeBack(false)}
            className={cn('absolute top-1 right-1 flex size-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground', FOKUS_RAHMEN)}
            aria-label="Schließen"
          >
            <X className="size-4" strokeWidth={1.7} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Kundenansicht (und Vorschau des Hofs): Abschnitte je Kategorie (E1)
          bzw. die Auswahl der Übersicht. */}
      {teil === 'keins' ? null : products.length === 0 ? (
          // Leer, mit Ausweg (DESIGN_SYSTEM, „Zustände").
          <EmptyState
            titel="Gerade keine Produkte"
            satz="Dieser Hof hat im Moment nichts im Angebot. Schau bald wieder vorbei – oder such dir einen anderen Hof in der Nähe."
            ausweg={
              <Link
                href="/hoefe"
                className={cn('inline-flex min-h-11 items-center rounded-full border border-border px-4 text-[14px] font-semibold text-foreground hover:bg-muted', FOKUS_RAHMEN)}
              >
                Andere Höfe entdecken
              </Link>
            }
          />
        ) : teil === 'auswahl' ? (
          // Das Schaufenster (Register N5): am Handy bis zu vier Zeilen, ab md
          // eine Reihe aus drei Kacheln, ab lg wie bisher — die Anzahl je
          // Breite über Klassen (stehtNurAmHandy), nie gemessen.
          <ul className={PRODUKT_LISTE}>
            {uebersichtProdukte(products, sperre, SCHAUFENSTER_PRODUKTE).map((p, i) => (
              <li key={p.id} className={stehtNurAmHandy(i) ? 'md:hidden' : undefined}>
                {karte(p)}
              </li>
            ))}
          </ul>
        ) : (
          <ProduktAbschnitte
            abschnitte={kategorieAbschnitte(products)}
            gebuehrHinweis={gebuehrHinweis}
            springeZu={springeZu}
            onGesprungen={onGesprungen}
            renderKarte={karte}
          />
      )}

      {/* Die Korb-Leiste — nicht in der Vorschau des Hofs.
          Am Handy über der Unterleiste der Shell (68 px + Home-Balken), bis
          1024 px unten rechts; ab 1024 px trägt der Mini-Warenkorb der
          rechten Spalte den Korb (hofseite-seitenspalte.tsx). */}
      {/* Die Bestätigungszeile über der Korb-Leiste (Register N30) — role="status", damit
          Screenreader sie hören, ohne dass der Fokus springt. */}
      {mitKorb && korbZeile && (
        <div
          role="status"
          data-korb-zeile={korbZeile.art}
          // Der Cookie-Hinweis steht darüber, nie darauf (src/lib/cookie-hinweis.ts).
          data-unten-fest=""
          className={cn(
            'fixed inset-x-4 bottom-[calc(68px+env(safe-area-inset-bottom,0px)+5.5rem)] z-40 flex min-h-12 items-center gap-2.5 rounded-2xl border py-1 pr-1 pl-3.5 text-[13.5px] text-foreground shadow-lg md:inset-x-auto md:right-6 md:bottom-[5.25rem] md:w-[360px] lg:bottom-6',
            korbZeile.art === 'im-korb' ? 'border-zustand-erledigt bg-zustand-erledigt-grund' : 'border-zustand-tun bg-zustand-tun-grund'
          )}
        >
          {korbZeile.art === 'im-korb' ? (
            <>
              <Check className="size-[18px] shrink-0 text-zustand-erledigt" strokeWidth={2} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate" title={korbZeile.name}>
                {imKorbText(korbZeile.name)}
              </span>
              <button
                type="button"
                onClick={() => rueckgaengig(korbZeile)}
                className={cn('inline-flex min-h-11 shrink-0 items-center rounded-full px-3 font-semibold text-brand-text hover:bg-muted', FOKUS_RAHMEN)}
              >
                {RUECKGAENGIG}
              </button>
            </>
          ) : (
            <>
              {korbZeile.nochmal && <WifiOff className="size-[18px] shrink-0 text-zustand-tun" strokeWidth={1.7} aria-hidden="true" />}
              <span className="min-w-0 flex-1 py-2">{korbZeile.text}</span>
              {korbZeile.nochmal ? (
                <button
                  type="button"
                  onClick={korbZeile.nochmal}
                  className={cn('inline-flex min-h-11 shrink-0 items-center rounded-full px-3 font-semibold text-foreground hover:bg-muted', FOKUS_RAHMEN)}
                >
                  {NETZ_KNOPF}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setKorbZeile(null)}
                  aria-label="Hinweis schließen"
                  className={cn('flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground', FOKUS_RAHMEN)}
                >
                  <X className="size-4" strokeWidth={1.7} aria-hidden="true" />
                </button>
              )}
            </>
          )}
        </div>
      )}

      {korbLeiste && (
        <button
          type="button"
          onClick={() => {
            // Wer zum Korb tippt, braucht die Bestätigung nicht mehr (N30).
            setKorbZeile(null)
            setCartOpen(true)
          }}
          // Der Cookie-Hinweis steht über der Korb-Leiste, nie darauf (src/lib/cookie-hinweis.ts).
          data-unten-fest=""
          className={cn(
            'fixed inset-x-4 bottom-[calc(68px+env(safe-area-inset-bottom,0px)+1.75rem)] z-40 flex min-h-14 items-center gap-2.5 rounded-2xl bg-accent px-4 py-3 text-accent-foreground shadow-lg transition-transform duration-[250ms] active:scale-[0.98] md:inset-x-auto md:right-6 md:bottom-6 md:rounded-full md:px-5 lg:hidden',
            FOKUS_RAHMEN
          )}
        >
          <span className="min-w-0 truncate text-[16px] font-bold">
            {mitAnzahl(count, 'Produkt', 'Produkte')} · {formatEuro(total)}
            {gebuehrKorb && !anzeige && <span className="font-normal"> + Gebühr</span>}
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-0.5 text-[16px] font-bold">
            Zum Warenkorb
            <ChevronRight className="size-[18px]" strokeWidth={2} aria-hidden="true" />
          </span>
        </button>
      )}
      {/* Platz unter dem Inhalt, damit die Leiste das letzte Produkt nicht verdeckt. */}
      {korbLeiste && platzUnten && <div aria-hidden="true" className="h-24 lg:hidden" />}

      {/* Cart sheet — in der Vorschau des Hofs gibt es keinen Korb. */}
      {mitKorb && (
        <CartSheet
          open={cartOpen}
          onOpenChange={setCartOpen}
          items={items}
          total={total}
          farmSlug={farmSlug}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeItem}
          gebuehrKorb={gebuehrKorb}
          futterHinweis={futterVerantwortungImKorb(items, products)}
          kaufSperre={{ sperre: sperreDesHofs, hofName, pauseMessage }}
          hinweis={korbHinweis}
        />
      )}
    </>
  )
}
