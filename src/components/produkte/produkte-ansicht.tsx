'use client'

import { useCallback, useId, useOptimistic, useRef, useState, useTransition } from 'react'
import { flushSync } from 'react-dom'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronRight, Lock, Package, Plus, Search, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterChip, FilterChipReihe } from '@/components/ui/chip'
import { StatusBadge } from '@/components/ui/status-badge'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { GrundpreisZeile } from '@/components/shared/grundpreis-zeile'
import { ImShopSchalter } from '@/components/products/im-shop-schalter'
import { ProductDialog } from '@/components/products/product-dialog'
import { produktHinweise } from '@/components/products/produkt-hinweise'
import { VorratFeld } from '@/components/produkte/vorrat-feld'
import { VorratBlatt } from '@/components/produkte/vorrat-blatt'
import { WasLegstDuAn } from '@/components/produkte/was-legst-du-an'
import { FutterFormular } from '@/components/produkte/futter-formular'
import { BrennmaterialFormular } from '@/components/produkte/brennmaterial-formular'
import { WiederDaMoment } from '@/components/produkte/wieder-da-moment'
import { deleteProduct, setzeKategorie } from '@/server/actions/products'
import type { ProductData } from '@/server/queries/products'
import {
  PRODUKTE_FILTER_LABEL,
  VORRAT_HINWEIS,
  VORRAT_HINWEIS_ZEILEN,
  filterAdresse,
  filtereProdukte,
  produktStatus,
  produkteAbschnitte,
  PRODUKTE_LEER,
  produkteKopfzeile,
  sichtbareProdukteFilter,
  wiederDaMomentMoeglich,
  wiederDaTexte,
  gespeichertMomentMoeglich,
  gespeichertTexte,
  zaehleProdukteFilter,
  type ProdukteAbschnitte,
  type ProduktAngelegt,
  type WiederDaTexte,
} from '@/lib/produkte-hof'
import { IM_SHOP, NICHT_IM_SHOP, produktZustand } from '@/lib/produkt-sichtbarkeit'
import { browserSpeicher, leseWiederDaGezeigt, merkeWiederDaGezeigt, wiederDaOeffnen } from '@/lib/wieder-da-moment'
import { gespeichertOeffnen, leseGespeichertGezeigt, merkeGespeichertGezeigt } from '@/lib/gespeichert-moment'
import { GESPEICHERT_HINWEIS } from '@/lib/teilen-momente'
import { produkteAnsichtAus } from '@/schemas/produkte-filter'
import type { NeuBereich } from '@/schemas/url-auftrag'
import { formatEuro, formatGebinde, formatKategorie, formatZahl, hofVorratText } from '@/lib/format'
import { wienWochenMontag } from '@/lib/kalender'
import { PRODUKTNAME_MAX } from '@/lib/eingabegrenzen'
import type { KategorieVorschlag } from '@/lib/taxonomie'
import type { NaechstesFenster } from '@/lib/heute'
import type { HofRegistrierung } from '@/lib/futter-registrierung'
import { useUrlAuftrag } from '@/lib/use-url-auftrag'
import { bildStil } from '@/lib/bild-ausschnitt'
import { cn } from '@/lib/utils'

type Props = {
  products: ProductData[]
  /** Betriebsnummer aus den Hof-Einstellungen — Anzeige in der Futter-Kennzeichnung. */
  hofBetriebsnummer: string | null
  /** Nummer und Status des Hofs — „Deine Futtermittel-Registrierungen" im Futter-Formular (Nr. 20). */
  registrierung: HofRegistrierung
  /** teilenMomenteAus: Farm.teilenMomenteAus (Nr. 30) — dann fragt kein Moment. */
  hof: { name: string; slug: string; sichtbar: boolean; teilenMomenteAus: boolean }
  naechstesFenster: NaechstesFenster | null
}

type DialogZustand = { open: boolean; product: ProductData | null; vorwahl: NeuBereich | null }

/** Das Vorrat-Blatt: welches Produkt, ob offen; `runde` zählt je Öffnen, damit jedes Öffnen frisch beginnt. */
type VorratBlattZustand = { id: string; offen: boolean; runde: number }

/** Hinweise mit Handlung stellen ein Produkt unter „Braucht dich" — „Unterkategorie ergänzen" ist nur ein leiser Hinweis. */
const hatHandlung = (product: ProductData): boolean => produktHinweise(product).some((h) => h.art !== 'unterkategorie-ergaenzen')

/** Der Vorrat-Knopf eines Produkts in den Karten-Zeilen — gesucht, wenn das Blatt schließt. */
function vorratKnopf(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-vorrat-knopf="${CSS.escape(id)}"]`)
}

/*
 * Produkte im neuen Design (Gate 5, Nachtlauf Nr. 18; Mockups web-h2-produkte,
 * mobil-h2-produkte). Ab 1024 px eine Tabelle (Produkt · Einheit · Preis ·
 * Vorrat · Status · Sichtbar), darunter Karten-Zeilen nach dem Board
 * system-h1-mein-hof-v3 (Register N25): „Braucht dich" zuerst, Schilder nur
 * bei Ausnahmen, der Vorrat als Knopf, geändert im Vorrat-Blatt.
 * Was eine Zeile sagt, entscheidet src/lib/produkte-hof.ts; hier wird nur
 * angeordnet.
 *
 * Filter und Suche stehen in der Adresse (?filter=, ?suche=) und werden im
 * Browser angewandt (replaceState, kein Server-Aufruf je Tipp). Den Dialog
 * öffnen ?neu=1 (mit ?bereich= aus „Was legst du an?") und ?edit=<id>.
 * Bearbeiten öffnet der Name; Löschen steht im Bearbeiten-Dialog.
 */
export function ProdukteAnsicht({ products: serverProdukte, hofBetriebsnummer, registrierung, hof, naechstesFenster }: Props): React.JSX.Element {
  const ansicht = produkteAnsichtAus(useSearchParams())
  // Die Suche tippt lokal (Leerzeichen am Ende bleiben stehen); die Adresse bekommt sie bereinigt mit.
  const [suche, setSuche] = useState(ansicht.suche)
  const [dialog, setDialog] = useState<DialogZustand>({ open: false, product: null, vorwahl: null })
  const [waehlerOffen, setWaehlerOffen] = useState(false)
  const [loeschen, setLoeschen] = useState<ProductData | null>(null)
  const [loeschtGerade, setLoeschtGerade] = useState(false)
  // Ein Moment zur Zeit: „wieder da" (Vorrat 0 → mehr) oder „gespeichert" (neu angelegt, Nr. 30).
  const [moment, setMoment] = useState<{ art: 'wieder-da' | 'gespeichert'; texte: WiederDaTexte } | null>(null)
  const [vorratBlatt, setVorratBlatt] = useState<VorratBlattZustand | null>(null)
  // Unter md ist die Suche eine Lupe; steht schon eine Suche in der Adresse, ist das Feld offen.
  const [sucheOffen, setSucheOffen] = useState(ansicht.suche !== '')
  const sucheFeld = useRef<HTMLInputElement>(null)
  const sucheId = useId()

  useUrlAuftrag((auftrag) => {
    setWaehlerOffen(false)
    if (auftrag.art === 'neu') {
      setDialog({ open: true, product: null, vorwahl: auftrag.bereich ?? null })
      return
    }
    const product = serverProdukte.find((p) => p.id === auftrag.id)
    if (product) setDialog({ open: true, product, vorwahl: null })
  })

  // Sichtbarkeit vorgezogen (Schalter „Sichtbar"): Kopfzeile, Status und
  // Filter zählen sofort mit; scheitert die Aktion, fällt React von selbst zurück.
  const [vorgezogen, setzeVorgezogen] = useOptimistic<Record<string, boolean>, { id: string; imShop: boolean }>(
    {},
    (stand, aenderung) => ({ ...stand, [aenderung.id]: aenderung.imShop })
  )
  const products = serverProdukte.map((p) => (vorgezogen[p.id] === undefined ? p : { ...p, isAvailable: vorgezogen[p.id] }))
  const zahlen = zaehleProdukteFilter(products)
  const gefiltert = filtereProdukte(products, { filter: ansicht.filter, suche })
  const abschnitte = produkteAbschnitte(products, { filter: ansicht.filter, suche }, hatHandlung)
  const blattProdukt = vorratBlatt ? products.find((p) => p.id === vorratBlatt.id) : undefined

  function schreibeAdresse(adresse: string) {
    // null als Zustand: Next gleicht useSearchParams ab (ARCHITECTURE §4, State-Regeln).
    window.history.replaceState(null, '', adresse)
  }

  const momentPruefen = useCallback(
    (product: ProductData, vorrat: number) => {
      // product trägt schon die vorgezogene Sichtbarkeit (die Zeilen kommen aus `products`).
      if (
        !wiederDaMomentMoeglich({
          hofSichtbar: hof.sichtbar,
          produktSichtbar: product.isAvailable,
          wiederDa: true,
          teilenMomenteAus: hof.teilenMomenteAus,
        })
      )
        return
      const speicher = browserSpeicher()
      // Im Handler, nicht beim Rendern: Die Woche des Klicks, in Wiener Zeit.
      const woche = wienWochenMontag(new Date())
      if (!wiederDaOeffnen(leseWiederDaGezeigt(speicher, product.id, woche))) return
      merkeWiederDaGezeigt(speicher, product.id, woche)
      setMoment({
        art: 'wieder-da',
        texte: wiederDaTexte({ name: product.name, vorrat, unit: product.unit, unitSize: product.unitSize }, naechstesFenster),
      })
    },
    [hof.sichtbar, hof.teilenMomenteAus, naechstesFenster]
  )
  // Moment „gespeichert" (Nr. 30): nach dem Anlegen, einmal je Produkt bzw. Familie und Gerät.
  const angelegtPruefen = useCallback(
    (angelegt: ProduktAngelegt) => {
      if (!gespeichertMomentMoeglich({ hofSichtbar: hof.sichtbar, kaufbar: angelegt.kaufbar, teilenMomenteAus: hof.teilenMomenteAus })) return
      const speicher = browserSpeicher()
      if (!gespeichertOeffnen(leseGespeichertGezeigt(speicher, angelegt.anlass))) return
      merkeGespeichertGezeigt(speicher, angelegt.anlass)
      setMoment({ art: 'gespeichert', texte: gespeichertTexte(angelegt.name, naechstesFenster) })
    },
    [hof.sichtbar, hof.teilenMomenteAus, naechstesFenster]
  )
  const momentSchliessen = useCallback(() => setMoment(null), [])

  async function handleDelete() {
    if (!loeschen) return
    setLoeschtGerade(true)
    try {
      await deleteProduct(loeschen.id)
      toast.success('Produkt gelöscht')
      setLoeschen(null)
    } catch {
      toast.error('Wir konnten das Produkt nicht löschen. Bitte versuch es noch einmal.')
    } finally {
      setLoeschtGerade(false)
    }
  }

  function lupe() {
    if (sucheOffen) {
      // Zu heißt ohne Suche — sonst filterte ein Wort, das niemand mehr sieht.
      setSucheOffen(false)
      setSuche('')
      schreibeAdresse(filterAdresse(ansicht.filter, ''))
      return
    }
    // Erst sichtbar machen, dann fokussieren: Ein verstecktes Feld nimmt keinen Fokus.
    flushSync(() => setSucheOffen(true))
    sucheFeld.current?.focus()
  }

  const vorratOeffnen = (product: ProductData) => setVorratBlatt((b) => ({ id: product.id, offen: true, runde: (b?.runde ?? 0) + 1 }))
  const oeffnen = (product: ProductData) => () => setDialog({ open: true, product, vorwahl: null })
  const dialogSchliessen = () => setDialog({ open: false, product: null, vorwahl: null })
  // Futter und Brennmaterial legt man mit Verkaufsgrößen an (Nr. 20, eigene
  // Formulare); Bearbeiten einer einzelnen Größe bleibt im Produktdialog.
  const familienFormular =
    dialog.open && dialog.product === null && (dialog.vorwahl === 'futter' || dialog.vorwahl === 'brennmaterial') ? dialog.vorwahl : null

  const neuKnopf = (klassen?: string) => (
    <button
      type="button"
      onClick={() => setWaehlerOffen(true)}
      className={cn(
        'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-primary-foreground/25 bg-primary px-[18px] text-sm font-semibold text-primary-foreground transition-opacity duration-[250ms] hover:opacity-90',
        FOKUS_RAHMEN,
        klassen
      )}
    >
      <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
      Neues Produkt
    </button>
  )

  const kopfzeile = produkteKopfzeile(products)
  return (
    <div className="flex flex-col gap-4 md:gap-[18px]">
      {/* Unter md sagt es der Reiter: Die Überschrift hört nur der Screenreader, die Zahl steht im Filter „Alle · n" (N25). */}
      <header className="flex items-end gap-3 max-md:sr-only">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold text-foreground md:text-[26px]">Produkte</h1>
          {kopfzeile && <p className="text-[13px] leading-normal text-muted-foreground max-md:hidden">{kopfzeile}</p>}
        </div>
        {/* Am Handy legt das Plus der Unterleiste an (Mockup mobil-h2-produkte). */}
        {products.length > 0 && neuKnopf('ml-auto hidden md:inline-flex')}
      </header>

      {products.length === 0 ? (
        <EmptyState
          symbol={Package}
          titel={PRODUKTE_LEER.titel}
          satz={PRODUKTE_LEER.satz}
          ausweg={neuKnopf()}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="-mx-4 flex items-center gap-2 pr-4 md:mx-0 md:min-w-0 md:flex-1 md:pr-0">
              <FilterChipReihe beschriftung="Produkte filtern" className="mx-0 min-w-0 flex-1">
                {sichtbareProdukteFilter(zahlen, ansicht.filter).map((f) => {
                  const adresse = filterAdresse(f, suche)
                  const mitZahl = f === 'alle' || f === 'entwuerfe'
                  return (
                    <FilterChip
                      key={f}
                      href={adresse}
                      aktiv={ansicht.filter === f}
                      onNavigate={(e) => {
                        e.preventDefault()
                        schreibeAdresse(adresse)
                      }}
                    >
                      {PRODUKTE_FILTER_LABEL[f]}
                      {mitZahl && <span className="ml-1 tabular-nums">· {zahlen[f]}</span>}
                    </FilterChip>
                  )
                })}
              </FilterChipReihe>
              {/* Unter md die Lupe am Ende der Filter (Board, Bildschirm A); ab md steht das Feld. */}
              <button
                type="button"
                onClick={lupe}
                aria-label="Produkt suchen"
                aria-expanded={sucheOffen}
                aria-controls={sucheId}
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-full border border-border text-foreground hover:bg-muted md:hidden',
                  FOKUS_RAHMEN
                )}
              >
                <Search className="size-4" strokeWidth={1.7} aria-hidden="true" />
              </button>
            </div>
            {/* Im DOM hinter den Filtern (ab md rechts, wie vorher); unter md sichtbar darüber — der Fokus folgt auf die Lupe. */}
            <label className={cn('relative max-md:order-first md:block md:w-[260px]', sucheOffen ? 'block' : 'hidden')}>
              <span className="sr-only">Produkt suchen</span>
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
              <input
                ref={sucheFeld}
                id={sucheId}
                type="search"
                value={suche}
                onChange={(e) => {
                  // Länger als ein Produktname kann kein Treffer sein — die Adresse bleibt kurz.
                  const wert = e.target.value.slice(0, PRODUKTNAME_MAX)
                  setSuche(wert)
                  schreibeAdresse(filterAdresse(ansicht.filter, wert))
                }}
                placeholder="Produkt suchen …"
                className={cn(
                  'h-11 w-full rounded-full border border-border bg-card pr-4 pl-10 text-base text-foreground placeholder:text-muted-foreground md:h-9 md:text-[13px]',
                  FOKUS_RAHMEN
                )}
              />
            </label>
          </div>

          {gefiltert.length === 0 ? (
            <EmptyState
              symbol={Search}
              titel="Kein Produkt passt"
              satz={suche.trim() ? `Nichts gefunden für „${suche.trim()}“.` : 'In diesem Filter ist gerade kein Produkt.'}
              ausweg={
                <Link
                  href="/products"
                  prefetch={false}
                  onNavigate={(e) => {
                    e.preventDefault()
                    setSuche('')
                    schreibeAdresse('/products')
                  }}
                  className={cn('inline-flex min-h-11 items-center rounded-full border border-border px-5 text-sm font-semibold text-foreground hover:bg-muted', FOKUS_RAHMEN)}
                >
                  Alle Produkte zeigen
                </Link>
              }
            />
          ) : (
            <>
              <Tabelle
                produkte={gefiltert}
                oeffnen={oeffnen}
                setzeVorgezogen={setzeVorgezogen}
                onWiederDa={momentPruefen}
              />
              <Zeilen
                abschnitte={abschnitte}
                oeffnen={oeffnen}
                onVorrat={vorratOeffnen}
                nichtImShopAdresse={filterAdresse('entwuerfe', '')}
                zuAdresse={schreibeAdresse}
              />
            </>
          )}
          <p className="text-[12.5px] leading-normal text-muted-foreground max-lg:hidden">{VORRAT_HINWEIS}</p>
          <p className="text-[12.5px] leading-normal text-muted-foreground lg:hidden">{VORRAT_HINWEIS_ZEILEN}</p>
        </>
      )}

      <WasLegstDuAn offen={waehlerOffen} onOffenChange={setWaehlerOffen} />

      {familienFormular === 'futter' && (
        <FutterFormular onClose={dialogSchliessen} registrierung={registrierung} onAngelegt={angelegtPruefen} />
      )}
      {familienFormular === 'brennmaterial' && <BrennmaterialFormular onClose={dialogSchliessen} onAngelegt={angelegtPruefen} />}

      <ProductDialog
        open={dialog.open && familienFormular === null}
        product={dialog.product}
        vorwahl={dialog.vorwahl}
        onClose={dialogSchliessen}
        onAngelegt={angelegtPruefen}
        onLoeschen={(product) => {
          setDialog({ open: false, product: null, vorwahl: null })
          setLoeschen(product)
        }}
        hofBetriebsnummer={hofBetriebsnummer}
      />

      <Dialog open={loeschen !== null} onOpenChange={(o) => !o && setLoeschen(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogTitle className="font-heading text-xl font-semibold">Produkt löschen?</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            <span className="font-medium break-words text-foreground">{loeschen?.name}</span> wird dauerhaft gelöscht. Vergangene
            Bestellungen bleiben erhalten. Nur ausblenden geht mit dem Schalter „Sichtbar“.
          </DialogDescription>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLoeschen(null)} disabled={loeschtGerade}>
              Abbrechen
            </Button>
            {/* Zerstörend: Orange-Umriss, nie Grün (DESIGN_SYSTEM „Dialoge und Blätter"). */}
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={loeschtGerade}
              className="border-status-offen text-status-offen hover:bg-primary/10"
            >
              {loeschtGerade ? 'Löschen …' : 'Löschen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EINMAL hier, nicht in der Zeile: Wechselt das Produkt beim Speichern den Abschnitt, bleiben Fokus, Satz und Moment. */}
      {vorratBlatt && blattProdukt && (
        <VorratBlatt
          key={`${blattProdukt.id}-${vorratBlatt.runde}`}
          produkt={blattProdukt}
          offen={vorratBlatt.offen}
          bild={<ProduktBild product={blattProdukt} className="size-11 rounded-[10px]" />}
          onSchliessen={() => setVorratBlatt((b) => (b ? { ...b, offen: false } : null))}
          onWiederDa={(vorrat) => momentPruefen(blattProdukt, vorrat)}
          fokusZiel={() => vorratKnopf(blattProdukt.id)}
        />
      )}

      {moment?.art === 'wieder-da' && <WiederDaMoment texte={moment.texte} hof={hof} onSchliessen={momentSchliessen} />}
      {moment?.art === 'gespeichert' && (
        <WiederDaMoment
          texte={moment.texte}
          hof={hof}
          onSchliessen={momentSchliessen}
          teilenLabel="Jetzt teilen"
          schliessenLabel="Später"
          hinweis={GESPEICHERT_HINWEIS}
        />
      )}
    </div>
  )
}

type ZeilenProps = {
  produkte: ProductData[]
  oeffnen: (product: ProductData) => () => void
  onWiederDa: (product: ProductData, vorrat: number) => void
}

/** Ab 1024 px: die Tabelle des Mockups; „Einheit" als eigene Spalte erst ab 1280 px. */
function Tabelle({
  produkte,
  oeffnen,
  setzeVorgezogen,
  onWiederDa,
}: ZeilenProps & { setzeVorgezogen: (a: { id: string; imShop: boolean }) => void }): React.JSX.Element {
  return (
    <div className="hidden overflow-hidden rounded-2xl border border-border bg-card lg:block">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] font-semibold tracking-[1px] text-muted-foreground uppercase">
            <th scope="col" className="w-[70px] py-2.5 pl-3.5">
              <span className="sr-only">Bild</span>
            </th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Produkt</th>
            <th scope="col" className="hidden px-3 py-2.5 font-semibold xl:table-cell">Einheit</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Preis</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Vorrat</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Status</th>
            <th scope="col" className="py-2.5 pr-3.5 pl-1 font-semibold">Sichtbar</th>
          </tr>
        </thead>
        <tbody>
          {produkte.map((product) => {
            const status = produktStatus(product)
            return (
              <tr key={product.id} className="border-t border-border align-middle">
                <td className="py-2.5 pl-3.5">
                  <ProduktBild product={product} className="size-11 rounded-xl" />
                </td>
                <td className="px-3 py-2.5">
                  <NamenKnopf product={product} onOeffnen={oeffnen(product)} />
                  <p className="text-[12.5px] text-muted-foreground xl:hidden">{formatGebinde(product.unit, product.unitSize)}</p>
                  <Hinweise product={product} onOeffnen={oeffnen(product)} />
                </td>
                <td className="hidden px-3 py-2.5 text-[12.5px] whitespace-nowrap text-muted-foreground xl:table-cell">{formatGebinde(product.unit, product.unitSize)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <p className="font-semibold text-foreground">{formatEuro(product.price)}</p>
                  <GrundpreisZeile price={product.price} unit={product.unit} unitSize={product.unitSize} className="text-[11.5px]" />
                </td>
                <td className="px-3 py-1.5">
                  <VorratFeld productId={product.id} name={product.name} stock={product.stock} onWiederDa={(v) => onWiederDa(product, v)} />
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={status.ton} className="whitespace-nowrap">
                    {status.text}
                  </StatusBadge>
                </td>
                <td className="py-1.5 pr-3.5">
                  <ImShopSchalter
                    variante="neu"
                    productId={product.id}
                    name={product.name}
                    imShop={product.isAvailable}
                    setzeOptimistisch={(imShop) => setzeVorgezogen({ id: product.id, imShop })}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Unter 1024 px: Karten-Zeilen nach dem Board (Register N25) — „Braucht dich",
 * „Im Shop" und am Ende „Nicht im Shop"; mit Suche und im Filter „Nicht im
 * Shop" eine einfache Liste (`produkteAbschnitte`). Leere Abschnitte entfallen.
 */
function Zeilen({
  abschnitte,
  oeffnen,
  onVorrat,
  nichtImShopAdresse,
  zuAdresse,
}: {
  abschnitte: ProdukteAbschnitte<ProductData>
  oeffnen: (product: ProductData) => () => void
  onVorrat: (product: ProductData) => void
  nichtImShopAdresse: string
  zuAdresse: (adresse: string) => void
}): React.JSX.Element {
  const id = useId()
  const zeilen = (produkte: ProductData[], ueberschrift?: string) => (
    <ul aria-labelledby={ueberschrift} className="overflow-hidden rounded-2xl border border-border bg-card">
      {produkte.map((product) => (
        <ProduktZeile key={product.id} product={product} onOeffnen={oeffnen(product)} onVorrat={() => onVorrat(product)} />
      ))}
    </ul>
  )
  if (abschnitte.art === 'liste') return <div className="lg:hidden">{zeilen(abschnitte.produkte)}</div>

  const { brauchtDich, imShop, nichtImShop } = abschnitte
  const kopf = (kennung: string, titel: string, zusatz: string, ton?: 'offen') => (
    <div className="flex items-baseline gap-2 px-1 pb-2">
      <h2 id={kennung} className={cn('text-xs font-bold tracking-[1px] uppercase', ton === 'offen' ? 'text-status-offen' : 'text-muted-foreground')}>
        {titel}
      </h2>
      <span className="text-[12.5px] text-muted-foreground">{zusatz}</span>
    </div>
  )
  return (
    <div className="flex flex-col gap-4 lg:hidden">
      {brauchtDich.length > 0 && (
        <section>
          {kopf(`${id}-braucht`, 'Braucht dich', formatZahl(brauchtDich.length), 'offen')}
          {zeilen(brauchtDich, `${id}-braucht`)}
        </section>
      )}
      {imShop.length > 0 && (
        <section>
          {kopf(`${id}-shop`, IM_SHOP, `${formatZahl(imShop.length)} · deine Reihenfolge`)}
          {zeilen(imShop, `${id}-shop`)}
        </section>
      )}
      {nichtImShop?.art === 'zeilen' && (
        <section>
          {kopf(`${id}-nicht`, NICHT_IM_SHOP, formatZahl(nichtImShop.produkte.length))}
          {zeilen(nichtImShop.produkte, `${id}-nicht`)}
        </section>
      )}
      {nichtImShop?.art === 'zeile' && (
        // Ein Link auf den bestehenden Filter, im Browser angewandt wie die Chips.
        <Link
          href={nichtImShopAdresse}
          prefetch={false}
          onNavigate={(e) => {
            e.preventDefault()
            zuAdresse(nichtImShopAdresse)
          }}
          className={cn('flex min-h-12 items-center gap-2.5 rounded-[14px] border border-dashed border-border px-3.5 text-sm text-foreground hover:bg-muted', FOKUS_RAHMEN)}
        >
          {`${NICHT_IM_SHOP} · ${formatZahl(nichtImShop.zahl)}`}
          <span className="flex-1" />
          <ChevronRight className="size-4 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

/**
 * Eine Karten-Zeile: Bild, Name (bis zwei Zeilen), Gebinde · Preis, ein Schild
 * nur bei einer Ausnahme (ausverkauft, wenig, nicht im Shop — kein „Sichtbar"),
 * die Hinweise; rechts der Vorrat als Knopf mit Zahl und Einheit.
 */
function ProduktZeile({ product, onOeffnen, onVorrat }: { product: ProductData; onOeffnen: () => void; onVorrat: () => void }): React.JSX.Element {
  const status = produktStatus(product)
  const ausnahme = produktZustand(product).art !== 'im-shop'
  const vorrat = hofVorratText(product.stock, product.unit, product.unitSize)
  return (
    <li className="flex items-center gap-3 border-t border-border py-2.5 pr-2.5 pl-3 first:border-t-0">
      <ProduktBild product={product} className="size-12 rounded-[10px]" />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-[3px]">
        <NamenKnopf product={product} onOeffnen={onOeffnen} />
        <p className="max-w-full truncate text-[12.5px] text-muted-foreground">
          {formatGebinde(product.unit, product.unitSize)} · {formatEuro(product.price)}
        </p>
        {ausnahme && (
          <StatusBadge status={status.ton} className="whitespace-nowrap">
            {status.text}
          </StatusBadge>
        )}
        <Hinweise product={product} onOeffnen={onOeffnen} />
      </div>
      <button
        type="button"
        data-vorrat-knopf={product.id}
        onClick={onVorrat}
        aria-label={`Vorrat ${product.name}: ${vorrat}. Ändern`}
        className={cn(
          'flex min-h-12 min-w-20 shrink-0 flex-col items-center justify-center gap-px rounded-xl border bg-background px-2.5 text-foreground hover:bg-muted',
          // Bei 0 trägt der Rahmen den Ton „offen" (Board: Ausverkauft, Rahmen orange).
          product.stock <= 0 ? 'border-status-offen' : 'border-border',
          FOKUS_RAHMEN
        )}
      >
        <span className="text-[15px] font-bold whitespace-nowrap">{vorrat}</span>
        <span className="text-[10.5px] font-medium text-muted-foreground">Vorrat</span>
      </button>
    </li>
  )
}

/** Der Name öffnet die Bearbeitung — höchstens zwei Zeilen, der volle Name im title. */
function NamenKnopf({ product, onOeffnen }: { product: ProductData; onOeffnen: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onOeffnen}
      title={product.name}
      className={cn('line-clamp-2 rounded-sm text-left text-sm font-semibold break-words text-foreground hover:underline', FOKUS_RAHMEN)}
    >
      {product.name}
      <span className="sr-only"> bearbeiten</span>
    </button>
  )
}

/**
 * Hinweise mit Handlung, keine Fehler (produktHinweise): Produkte ohne
 * Kategorie stehen öffentlich unter Sonstiges; Futtermittel mit alter
 * Gebindegröße rechnen den Kilopreis falsch (Rückfrage F1). Übernommen aus der
 * Bestandsliste, in den Tokens des Design-Systems.
 */
function Hinweise({ product, onOeffnen }: { product: ProductData; onOeffnen: () => void }): React.JSX.Element | null {
  const [uebernimmt, startTransition] = useTransition()
  const hinweise = produktHinweise(product)
  if (hinweise.length === 0 && !product.sperre) return null

  function uebernehmen(vorschlag: KategorieVorschlag) {
    startTransition(async () => {
      try {
        const ergebnis = await setzeKategorie({ productId: product.id, ...vorschlag })
        if ('error' in ergebnis) toast.error(ergebnis.error)
        else toast.success(`${product.name}: ${formatKategorie(vorschlag.category, vorschlag.subcategory)}`)
      } catch {
        toast.error('Wir konnten die Kategorie nicht speichern. Bitte versuch es noch einmal.')
      }
    })
  }

  const chip = 'inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed px-2.5 text-xs font-medium transition-colors disabled:opacity-50'
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {/* Sperre je Gebinde (S7, Nr. 20): Warum diese Größe nicht in den Shop darf — ein Hinweis, kein Knopf. */}
      {product.sperre && (
        <span className={cn(chip, 'min-h-0 border-status-offen/60 py-0.5 text-status-offen')}>
          <Lock className="size-3.5 shrink-0" strokeWidth={1.7} aria-hidden="true" />
          {product.sperre}
        </span>
      )}
      {hinweise.map((h) => {
        if (h.art === 'kategorie-uebernehmen') {
          return (
            <button
              key={h.art}
              type="button"
              disabled={uebernimmt}
              onClick={() => uebernehmen(h.vorschlag)}
              className={cn(chip, 'border-primary/60 bg-primary/5 text-foreground hover:bg-primary/10', FOKUS_RAHMEN)}
            >
              <Sparkles className="size-3.5 shrink-0 text-status-offen" strokeWidth={1.7} aria-hidden="true" />
              {formatKategorie(h.vorschlag.category, h.vorschlag.subcategory)} übernehmen
            </button>
          )
        }
        // Dezenter Hinweis ohne Handlung: Bestandsprodukte haben noch keine Unterkategorie.
        if (h.art === 'unterkategorie-ergaenzen') {
          return (
            <span key={h.art} className={cn(chip, 'min-h-0 border-border py-0.5 text-muted-foreground')}>
              Unterkategorie ergänzen
            </span>
          )
        }
        return (
          <button
            key={h.art}
            type="button"
            onClick={onOeffnen}
            className={cn(chip, 'border-status-offen/60 bg-primary/10 text-status-offen hover:bg-primary/15', FOKUS_RAHMEN)}
          >
            {h.art === 'kategorie-ergaenzen' ? 'Kategorie ergänzen' : 'Einheit prüfen'}
          </button>
        )
      })}
    </div>
  )
}

// 44 px, wie freigegeben (Nr. 180): Next wählt daraus dieselbe Breite (48 bzw. 96 px) wie für den 48-px-Rahmen,
// scharf bleibt das Bild trotzdem — die kleinste Stufe über 44 px ist 48.
const PRODUKT_BILD_SIZES = '44px'

/** Foto des Hofs, sonst die Kategorie-Illustration (im Dunkeln gedämpft), sonst ein Symbol. */
function ProduktBild({ product, className }: { product: ProductData; className?: string }): React.JSX.Element {
  return (
    <div className={cn('relative flex shrink-0 items-center justify-center overflow-hidden border border-border bg-muted', className)}>
      {product.imageUrl ? (
        // Die Rahmen sind 44 bis 48 px breit — `sizes` sagt das dem Browser.
        <Image src={product.imageUrl} alt="" fill sizes={PRODUKT_BILD_SIZES} className="object-cover" style={bildStil(product.bildAusschnitt)} />
      ) : product.categoryImageUrl ? (
        <Image src={product.categoryImageUrl} alt="" fill sizes={PRODUKT_BILD_SIZES} className="object-contain dark:brightness-[0.85] dark:saturate-[0.9]" />
      ) : (
        <Package className="size-5 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
      )}
    </div>
  )
}
