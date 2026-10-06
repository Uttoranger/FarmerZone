'use client'

import { useCallback, useOptimistic, useState, useTransition } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Package, Plus, Search, Sparkles } from 'lucide-react'
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
import { WasLegstDuAn } from '@/components/produkte/was-legst-du-an'
import { WiederDaMoment } from '@/components/produkte/wieder-da-moment'
import { deleteProduct, setzeKategorie } from '@/server/actions/products'
import type { ProductData } from '@/server/queries/products'
import {
  PRODUKTE_FILTER_LABEL,
  VORRAT_HINWEIS,
  filterAdresse,
  filtereProdukte,
  produktStatus,
  produkteKopfzeile,
  sichtbareProdukteFilter,
  wiederDaMomentMoeglich,
  wiederDaTexte,
  zaehleProdukteFilter,
  type WiederDaTexte,
} from '@/lib/produkte-hof'
import { browserSpeicher, leseWiederDaGezeigt, merkeWiederDaGezeigt, wiederDaOeffnen } from '@/lib/wieder-da-moment'
import { produkteAnsichtAus } from '@/schemas/produkte-filter'
import type { NeuBereich } from '@/schemas/url-auftrag'
import { formatEuro, formatGebinde, formatKategorie } from '@/lib/format'
import { wienWochenMontag } from '@/lib/kalender'
import { PRODUKTNAME_MAX } from '@/lib/eingabegrenzen'
import type { KategorieVorschlag } from '@/lib/taxonomie'
import type { NaechstesFenster } from '@/lib/heute'
import { useUrlAuftrag } from '@/lib/use-url-auftrag'
import { cn } from '@/lib/utils'

type Props = {
  products: ProductData[]
  /** Betriebsnummer aus den Hof-Einstellungen — Anzeige in der Futter-Kennzeichnung. */
  hofBetriebsnummer: string | null
  hof: { name: string; slug: string; sichtbar: boolean }
  naechstesFenster: NaechstesFenster | null
}

type DialogZustand = { open: boolean; product: ProductData | null; vorwahl: NeuBereich | null }

/*
 * Produkte im neuen Design (Gate 5, Nachtlauf Nr. 18; Mockups web-h2-produkte,
 * mobil-h2-produkte). Ab 1024 px eine Tabelle (Produkt · Einheit · Preis ·
 * Vorrat · Status · Sichtbar), darunter Karten-Zeilen wie im Handy-Mockup.
 * Was eine Zeile sagt, entscheidet src/lib/produkte-hof.ts; hier wird nur
 * angeordnet.
 *
 * Filter und Suche stehen in der Adresse (?filter=, ?suche=) und werden im
 * Browser angewandt (replaceState, kein Server-Aufruf je Tipp). Den Dialog
 * öffnen ?neu=1 (mit ?bereich= aus „Was legst du an?") und ?edit=<id>.
 * Bearbeiten öffnet der Name; Löschen steht im Bearbeiten-Dialog.
 */
export function ProdukteAnsicht({ products: serverProdukte, hofBetriebsnummer, hof, naechstesFenster }: Props): React.JSX.Element {
  const ansicht = produkteAnsichtAus(useSearchParams())
  // Die Suche tippt lokal (Leerzeichen am Ende bleiben stehen); die Adresse bekommt sie bereinigt mit.
  const [suche, setSuche] = useState(ansicht.suche)
  const [dialog, setDialog] = useState<DialogZustand>({ open: false, product: null, vorwahl: null })
  const [waehlerOffen, setWaehlerOffen] = useState(false)
  const [loeschen, setLoeschen] = useState<ProductData | null>(null)
  const [loeschtGerade, setLoeschtGerade] = useState(false)
  const [moment, setMoment] = useState<WiederDaTexte | null>(null)

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

  function schreibeAdresse(adresse: string) {
    // null als Zustand: Next gleicht useSearchParams ab (ARCHITECTURE §4, State-Regeln).
    window.history.replaceState(null, '', adresse)
  }

  const momentPruefen = useCallback(
    (product: ProductData, vorrat: number) => {
      // product trägt schon die vorgezogene Sichtbarkeit (die Zeilen kommen aus `products`).
      if (!wiederDaMomentMoeglich({ hofSichtbar: hof.sichtbar, produktSichtbar: product.isAvailable, wiederDa: true })) return
      const speicher = browserSpeicher()
      // Im Handler, nicht beim Rendern: Die Woche des Klicks, in Wiener Zeit.
      const woche = wienWochenMontag(new Date())
      if (!wiederDaOeffnen(leseWiederDaGezeigt(speicher, product.id, woche))) return
      merkeWiederDaGezeigt(speicher, product.id, woche)
      setMoment(wiederDaTexte({ name: product.name, vorrat, unit: product.unit, unitSize: product.unitSize }, naechstesFenster))
    },
    [hof.sichtbar, naechstesFenster]
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

  const oeffnen = (product: ProductData) => () => setDialog({ open: true, product, vorwahl: null })

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

  return (
    <div className="flex flex-col gap-4 md:gap-[18px]">
      <header className="flex items-end gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold text-foreground md:text-[26px]">Produkte</h1>
          <p className="text-[13px] leading-normal text-muted-foreground">{produkteKopfzeile(products)}</p>
        </div>
        {/* Am Handy legt das Plus der Unterleiste an (Mockup mobil-h2-produkte). */}
        {products.length > 0 && neuKnopf('ml-auto hidden md:inline-flex')}
      </header>

      {products.length === 0 ? (
        <EmptyState
          symbol={Package}
          titel="Noch keine Produkte"
          satz="Leg dein erstes Produkt an – Kunden sehen es sofort auf deiner Hofseite."
          aktion={neuKnopf()}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <FilterChipReihe beschriftung="Produkte filtern" className="min-w-0 md:flex-1">
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
            <label className="relative block md:w-[260px]">
              <span className="sr-only">Produkt suchen</span>
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
              <input
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
              aktion={
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
              <Zeilen produkte={gefiltert} oeffnen={oeffnen} onWiederDa={momentPruefen} />
            </>
          )}
          <p className="text-[12.5px] leading-normal text-muted-foreground">{VORRAT_HINWEIS}</p>
        </>
      )}

      <WasLegstDuAn offen={waehlerOffen} onOffenChange={setWaehlerOffen} />

      <ProductDialog
        open={dialog.open}
        product={dialog.product}
        vorwahl={dialog.vorwahl}
        onClose={() => setDialog({ open: false, product: null, vorwahl: null })}
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

      {moment && <WiederDaMoment texte={moment} hof={hof} onSchliessen={momentSchliessen} />}
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

/** Unter 1024 px: Karten-Zeilen wie im Handy-Mockup — Bild, Name, Einheit · Preis, Status, Vorrat. */
function Zeilen({ produkte, oeffnen, onWiederDa }: ZeilenProps): React.JSX.Element {
  return (
    <ul className="flex flex-col gap-2.5 lg:hidden">
      {produkte.map((product) => {
        const status = produktStatus(product)
        return (
          <li key={product.id} className="flex items-center gap-2.5 rounded-[13px] border border-border bg-card p-2.5">
            <ProduktBild product={product} className="size-[46px] rounded-xl" />
            <div className="min-w-0 flex-1">
              <NamenKnopf product={product} onOeffnen={oeffnen(product)} />
              <p className="truncate text-xs text-muted-foreground">
                {formatGebinde(product.unit, product.unitSize)} · {formatEuro(product.price)}
              </p>
              <StatusBadge status={status.ton} className="mt-1 whitespace-nowrap">
                {status.text}
              </StatusBadge>
              <Hinweise product={product} onOeffnen={oeffnen(product)} />
            </div>
            <VorratFeld productId={product.id} name={product.name} stock={product.stock} onWiederDa={(v) => onWiederDa(product, v)} />
          </li>
        )
      })}
    </ul>
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
  if (hinweise.length === 0) return null

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

/** Foto des Hofs, sonst die Kategorie-Illustration (im Dunkeln gedämpft), sonst ein Symbol. */
function ProduktBild({ product, className }: { product: ProductData; className?: string }): React.JSX.Element {
  return (
    <div className={cn('flex shrink-0 items-center justify-center overflow-hidden border border-border bg-muted', className)}>
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
      ) : product.categoryImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.categoryImageUrl} alt="" className="h-full w-full object-contain dark:brightness-[0.85] dark:saturate-[0.9]" />
      ) : (
        <Package className="size-5 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
      )}
    </div>
  )
}
