'use client'

import { useState, useTransition, useOptimistic } from 'react'
import { toast } from 'sonner'
import { Package, Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { updateStock, setzeKategorie } from '@/server/actions/products'
import { deleteProduct } from '@/server/actions/products'
import type { ProductData } from '@/server/queries/products'
import type { KategorieVorschlag } from '@/lib/taxonomie'
import { formatGrundpreis, formatKategorie } from '@/lib/format'
import { produktHinweise } from './produkt-hinweise'
import { GrundpreisZeile } from '@/components/shared/grundpreis-zeile'
import { ProductDialog } from './product-dialog'
import { StockDialog } from './stock-dialog'
import { PageHeader } from '@/components/farmer/page-header'
import { ImShopSchalter } from '@/components/products/im-shop-schalter'
import {
  BestandStepper,
  ProduktBild,
  UEBER_ZEILE,
  ZeilenChips,
  ZeilenMenue,
  ZeilenName,
} from '@/components/products/produkt-zeile-teile'
import { kopfzeileProdukte } from '@/lib/produkt-sichtbarkeit'
import { PRODUKT_FILTER, bestandNach, passtZuFilter, zaehleFilter, type ProduktFilter } from '@/lib/produkt-zeile'
import { useUrlAuftrag } from '@/lib/use-url-auftrag'
import { cn } from '@/lib/utils'

type Props = {
  products: ProductData[]
  /** Betriebsnummer aus den Hof-Einstellungen — Anzeige in der Futter-Kennzeichnung. */
  hofBetriebsnummer: string | null
}

/*
 * Die Produktliste unter „Mein Hof". Am Handy Karten, ab lg eine Tabelle über
 * die volle Inhaltsbreite mit Filter-Chips darüber. Beide zeigen dieselben
 * Teile (produkt-zeile-teile.tsx); was eine Zeile sagt, entscheidet
 * src/lib/produkt-zeile.ts.
 */
export function ProductList({ products: initialProducts, hofBetriebsnummer }: Props) {
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()
  const [filter, setFilter] = useState<ProduktFilter>('alle')

  // Dialog state
  const [editDialog, setEditDialog] = useState<{ open: boolean; product: ProductData | null }>({
    open: false,
    product: null,
  })

  // ?neu=1 (Plus der Navigation) und ?edit=<id> (Hofseite, „Braucht dich")
  // öffnen den vorhandenen Dialog einmal; danach verschwindet der Parameter
  // aus der Adresse, Neuladen öffnet ihn nicht wieder.
  useUrlAuftrag((auftrag) => {
    if (auftrag.art === 'neu') {
      setEditDialog({ open: true, product: null })
      return
    }
    const product = initialProducts.find((p) => p.id === auftrag.id)
    if (product) setEditDialog({ open: true, product })
  })
  const [stockDialogProduct, setStockDialogProduct] = useState<ProductData | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<ProductData | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Sprint Sichtbarkeits-Schalter: der vorgezogene Sichtbarkeitsstand. Leerer
  // Grundzustand — nach der Transition sind die Props die Wahrheit, und
  // scheitert die Aktion, fällt React von selbst dorthin zurück.
  const [vorgezogen, setzeVorgezogen] = useOptimistic<
    Record<string, boolean>,
    { id: string; imShop: boolean }
  >({}, (stand, aenderung) => ({ ...stand, [aenderung.id]: aenderung.imShop }))

  // Derselbe Weg für den Bestand. Vorher hielt ein useState den Bestand ALLER
  // Produkte ab dem ersten Laden fest — eine Änderung im Bearbeiten-Dialog
  // erschien in der Liste erst nach Neuladen.
  const [bestandVorgezogen, setzeBestandVorgezogen] = useOptimistic<
    Record<string, number>,
    { id: string; bestand: number }
  >({}, (stand, aenderung) => ({ ...stand, [aenderung.id]: aenderung.bestand }))

  // Neuester Server-Stand, aber mit optimistischem Bestand UND optimistischer
  // Sichtbarkeit — beides muss die Kopfzeile sofort mitzählen.
  const products = initialProducts.map((p) => {
    const sichtbar = vorgezogen[p.id]
    return {
      ...p,
      stock: bestandVorgezogen[p.id] ?? p.stock,
      isAvailable: sichtbar === undefined ? p.isAvailable : sichtbar,
    }
  })
  const zahlen = zaehleFilter(products)
  const gefiltert = products.filter((p) => passtZuFilter(p, filter))

  function setzeLaeuft(id: string, laeuft: boolean) {
    setPendingIds((prev) => {
      const s = new Set(prev)
      if (laeuft) s.add(id)
      else s.delete(id)
      return s
    })
  }

  /** ±1 über die bestehende Aktion; der Server klemmt ebenso auf 0. */
  function bestandSchritt(product: ProductData, delta: 1 | -1) {
    const neu = bestandNach(product.stock, delta)
    if (neu === product.stock) return
    setzeLaeuft(product.id, true)

    startTransition(async () => {
      setzeBestandVorgezogen({ id: product.id, bestand: neu })
      try {
        await updateStock(product.id, delta)
      } catch {
        // Kein Zurücksetzen von Hand: useOptimistic fällt mit dem Ende der
        // Transition auf den Serverstand zurück.
        toast.error('Wir konnten den Bestand nicht speichern. Bitte versuch es noch einmal.')
      } finally {
        setzeLaeuft(product.id, false)
      }
    })
  }

  /** Chip „… übernehmen": setzt nur die Kategorie, nie das ganze Produkt (setzeKategorie). */
  const [uebernimmt, setUebernimmt] = useState<string | null>(null)
  async function kategorieUebernehmen(product: ProductData, vorschlag: KategorieVorschlag) {
    setUebernimmt(product.id)
    try {
      const ergebnis = await setzeKategorie({ productId: product.id, ...vorschlag })
      if ('error' in ergebnis) toast.error(ergebnis.error)
      else toast.success(`${product.name}: ${formatKategorie(vorschlag.category, vorschlag.subcategory)}`)
    } catch {
      toast.error('Wir konnten die Kategorie nicht speichern. Bitte versuch es noch einmal.')
    } finally {
      setUebernimmt(null)
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return
    setIsDeleting(true)
    try {
      await deleteProduct(deleteConfirm.id)
      toast.success('Produkt gelöscht')
      setDeleteConfirm(null)
    } catch {
      toast.error('Wir konnten das Produkt nicht löschen. Bitte versuch es noch einmal.')
    } finally {
      setIsDeleting(false)
    }
  }

  const oeffnen = (product: ProductData) => () => setEditDialog({ open: true, product })

  /**
   * Hinweise mit Handlung, keine Fehler: Produkte ohne Kategorie stehen
   * öffentlich unter Sonstiges; Futtermittel mit alter Gebindegröße rechnen
   * den Kilopreis falsch (Rückfrage F1).
   */
  function hinweiseFuer(product: ProductData) {
    const hinweise = produktHinweise(product)
    if (hinweise.length === 0) return null
    const klasse =
      'inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed px-2.5 text-xs font-medium transition-colors disabled:opacity-50'
    return (
      <div className={cn(UEBER_ZEILE, 'pointer-events-none mt-1.5 flex flex-wrap gap-1.5 [&>button]:pointer-events-auto')}>
        {hinweise.map((h) => {
          if (h.art === 'kategorie-uebernehmen') {
            return (
              <button
                key={h.art}
                type="button"
                disabled={uebernimmt === product.id}
                onClick={() => kategorieUebernehmen(product, h.vorschlag)}
                className={`${klasse} border-primary/60 bg-primary/5 text-foreground hover:bg-primary/10`}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-text" aria-hidden />
                {formatKategorie(h.vorschlag.category, h.vorschlag.subcategory)} übernehmen
              </button>
            )
          }
          // Dezenter Hinweis, kein Fehler: Bestandsprodukte haben noch keine
          // Unterkategorie (Sprint Taxonomie 1).
          if (h.art === 'unterkategorie-ergaenzen') {
            return (
              <span key={h.art} className={`${klasse} min-h-0 py-0.5 border-border text-app-ink-soft`}>
                Unterkategorie ergänzen
              </span>
            )
          }
          return (
            <button
              key={h.art}
              type="button"
              onClick={oeffnen(product)}
              className={`${klasse} border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/40`}
            >
              {h.art === 'kategorie-ergaenzen' ? 'Kategorie ergänzen' : 'Einheit prüfen'}
            </button>
          )
        })}
      </div>
    )
  }

  function preisFuer(product: ProductData, className?: string) {
    return (
      <div className={className}>
        <p className="text-[13px] text-app-ink-soft">
          {formatGrundpreis(product.price, product.unit, product.unitSize)}
        </p>
        <GrundpreisZeile
          price={product.price}
          unit={product.unit}
          unitSize={product.unitSize}
          className="text-[11px] text-app-ink-soft"
        />
      </div>
    )
  }

  function schalterFuer(product: ProductData, variante: 'zeile' | 'kompakt') {
    return (
      <ImShopSchalter
        productId={product.id}
        name={product.name}
        imShop={product.isAvailable}
        setzeOptimistisch={(imShop) => setzeVorgezogen({ id: product.id, imShop })}
        variante={variante}
        // Die Zeilen-Variante ist sonst so breit wie ihr Platz; hier steht sie
        // rechts neben dem Bestand und nimmt nur, was „Im Shop" und die Schiene brauchen.
        className={cn(UEBER_ZEILE, variante === 'zeile' && 'w-auto')}
      />
    )
  }

  function stepperFuer(product: ProductData) {
    return (
      <BestandStepper
        name={product.name}
        bestand={product.stock}
        laeuft={pendingIds.has(product.id)}
        onSchritt={(delta) => bestandSchritt(product, delta)}
        onEintippen={() => setStockDialogProduct(product)}
      />
    )
  }

  function menueFuer(product: ProductData) {
    return (
      <ZeilenMenue
        name={product.name}
        onBestand={() => setStockDialogProduct(product)}
        onLoeschen={() => setDeleteConfirm(product)}
      />
    )
  }

  const neuKnopf = (
    <Button
      onClick={() => setEditDialog({ open: true, product: null })}
      className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent-hover"
    >
      <Plus className="w-4 h-4" />
      Produkt
    </Button>
  )

  return (
    <>
      <PageHeader title="Produkte" subtitle={kopfzeileProdukte(products)} action={neuKnopf} />

      {/* Empty state */}
      {products.length === 0 && (
        <div className="text-center py-16">
          <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="font-medium text-foreground mb-1">Noch keine Produkte</p>
          <p className="text-sm text-app-ink-soft mb-6">Leg dein erstes Produkt an, um loszulegen.</p>
          <Button
            onClick={() => setEditDialog({ open: true, product: null })}
            className="bg-accent text-accent-foreground hover:bg-accent-hover"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Erstes Produkt anlegen
          </Button>
        </div>
      )}

      {/* ── Handy und Tablet: Karten ───────────────────────────────────── */}
      {products.length > 0 && (
        <ul className="space-y-3 lg:hidden">
          {products.map((product) => (
            <li
              key={product.id}
              className="relative rounded-xl bg-card ring-1 ring-border/60 shadow-[0_1px_4px_oklch(0.18_0.03_150_/_0.04)] transition-colors hover:bg-muted/20 dark:ring-border"
            >
              <div className="flex gap-3 p-3 pb-2">
                <ProduktBild product={product} className="size-16 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <ZeilenName name={product.name} onOeffnen={oeffnen(product)} className="text-sm" />
                  {preisFuer(product, 'mt-0.5')}
                  <ZeilenChips product={product} className="mt-1.5" />
                  {hinweiseFuer(product)}
                </div>
                <div className="-mr-1 -mt-1 self-start">
                  {menueFuer(product)}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-1.5">
                {stepperFuer(product)}
                {schalterFuer(product, 'zeile')}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ── Browser ab lg: Tabelle mit Filtern ─────────────────────────── */}
      {products.length > 0 && (
        <div className="hidden lg:block">
          <div role="group" aria-label="Produkte filtern" className="mb-3 flex flex-wrap gap-2">
            {PRODUKT_FILTER.map((f) => {
              const aktiv = filter === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={aktiv}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                    aktiv
                      ? 'border-transparent bg-primary font-semibold text-primary-foreground'
                      : 'border-border bg-card text-app-ink hover:bg-muted/60'
                  )}
                >
                  {f.label}
                  <span className={cn('tabular-nums', aktiv ? 'opacity-80' : 'text-app-ink-soft')}>
                    · {zahlen[f.id]}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="overflow-hidden rounded-xl bg-card ring-1 ring-border/60 shadow-[0_1px_4px_oklch(0.18_0.03_150_/_0.04)] dark:ring-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold text-app-ink-soft">
                  <th scope="col" className="px-4 py-2.5 font-semibold">Produkt</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Preis</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Bestand</th>
                  <th scope="col" className="px-4 py-2.5 text-center font-semibold">Im Shop</th>
                  <th scope="col" className="w-14 px-2 py-2.5">
                    <span className="sr-only">Aktionen</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {gefiltert.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-app-ink-soft">
                      In diesem Filter ist gerade kein Produkt.
                    </td>
                  </tr>
                )}
                {gefiltert.map((product) => (
                  // Kein ::after-Trick wie bei den Karten: Ob ein <tr> als
                  // Bezugsrahmen für position:absolute taugt, ist in WebKit
                  // nicht verlässlich. Der Klick an der Zeile übergeht deshalb
                  // alles Bedienbare und alles aus dem Menü-Portal (React reicht
                  // Portal-Klicks durch, das DOM enthält sie aber nicht). Die
                  // Tastatur nimmt den Namensknopf.
                  <tr
                    key={product.id}
                    onClick={(e) => {
                      if (!(e.target instanceof Element) || !e.currentTarget.contains(e.target)) return
                      if (e.target.closest('button, a, input')) return
                      setEditDialog({ open: true, product })
                    }}
                    className="cursor-pointer align-middle transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ProduktBild product={product} className="size-12 rounded-lg" />
                        <div className="min-w-0">
                          <ZeilenName name={product.name} onOeffnen={oeffnen(product)} ueberdeckt={false} />
                          <ZeilenChips product={product} className="mt-1" />
                          {hinweiseFuer(product)}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {preisFuer(product)}
                    </td>
                    <td className="px-4 py-3">
                      {stepperFuer(product)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        {schalterFuer(product, 'kompakt')}
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      {menueFuer(product)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Product create/edit dialog */}
      <ProductDialog
        open={editDialog.open}
        product={editDialog.product}
        onClose={() => setEditDialog({ open: false, product: null })}
        hofBetriebsnummer={hofBetriebsnummer}
      />

      {/* Bestand eintippen, mit +5/+10/+20 — Tipp auf die Zahl oder „⋯" */}
      <StockDialog
        product={stockDialogProduct}
        currentStock={
          stockDialogProduct
            ? (products.find((p) => p.id === stockDialogProduct.id)?.stock ?? stockDialogProduct.stock)
            : 0
        }
        onClose={() => setStockDialogProduct(null)}
        onOptimisticUpdate={(id, bestand) => setzeBestandVorgezogen({ id, bestand })}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirm !== null} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Produkt löschen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">{deleteConfirm?.name}</span> wird dauerhaft gelöscht.
            Vergangene Bestellungen bleiben erhalten.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)} disabled={isDeleting}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Löschen…' : 'Löschen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
