'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { CalendarDays, Check, ChevronDown } from 'lucide-react'
import { KANAL_SYMBOL } from '@/components/sales/kanal-symbol'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DezimalFeld } from '@/components/shared/dezimal-feld'
import { createManualSale, updateManualSale } from '@/server/actions/manual-sales'
import type { ManualSaleData } from '@/server/queries/manual-sales'
import type { ProductData } from '@/server/queries/products'
import { manualSaleFormSchema } from '@/schemas/manual-sale'
import { UNIT_LABELS } from '@/schemas/product'
import { verkaufskanalSchema, type Verkaufskanal } from '@/schemas/verkaufskanal'
import { wienKalendertag } from '@/lib/kalender'
import { cn } from '@/lib/utils'
import { STANDARD_KANAL, kanalSpeicher, kanalVorauswahl, merkeKanal } from '@/lib/verkaufskanal-speicher'
import { HAUPTKANAELE, datumKurz, istOhneProdukt, knopfText, produktChips } from '@/lib/verkauf-eintragen'

/**
 * „Verkauf eintragen" — Betrag zuerst (Vorbild GoPay, Expensify, KOHO): Oben
 * groß der Betrag, darunter der Weg, alles andere freiwillig und klein. Der
 * Knopf nennt den Betrag, damit vor dem Tippen klar ist, was gespeichert wird.
 */

type FormWerte = {
  totalAmount: number | null
  channel: Verkaufskanal
  productId: string | null
  /** Freier Name — nur, wenn „Anderes" statt eines Produkts gewählt ist. */
  freierName: boolean
  productName: string
  quantity: number | null
  unit: string | null
  saleDate: string
  note: string
}

type Props = {
  open: boolean
  editingSale: ManualSaleData | null
  prefillSale: ManualSaleData | null
  products: ProductData[]
  /** Die meistverkauften Produkte des Hofs, meistverkauft zuerst (getMeistverkaufteProduktIds). */
  topProduktIds: string[]
  onClose: () => void
}

function startWerte(sale: ManualSaleData | null, prefill: ManualSaleData | null): FormWerte {
  const heute = wienKalendertag(new Date())
  const quelle = sale ?? prefill
  if (!quelle) {
    return {
      totalAmount: null,
      channel: kanalVorauswahl(kanalSpeicher()),
      productId: null,
      freierName: false,
      productName: '',
      quantity: null,
      unit: null,
      saleDate: heute,
      note: '',
    }
  }
  const ohne = istOhneProdukt(quelle)
  return {
    totalAmount: quelle.totalAmount,
    // PLATFORM oder ein unbekannter Wert kommt aus der Liste nie — sonst gilt der Standard.
    channel: verkaufskanalSchema.catch(STANDARD_KANAL).parse(quelle.channel),
    productId: quelle.productId,
    freierName: quelle.productId === null && !ohne,
    productName: ohne ? '' : quelle.productName,
    // „1" ist bei einem Verkauf ohne Produkt nur der Platzhalter der Datenbank.
    quantity: ohne && quelle.quantity === 1 ? null : quelle.quantity,
    unit: quelle.unit,
    saleDate: sale ? wienKalendertag(sale.saleDate) : heute,
    note: quelle.note ?? '',
  }
}

export function SaleDialog({ open, editingSale, prefillSale, products, topProduktIds, onClose }: Props) {
  const isEdit = editingSale !== null
  const [isSubmitting, setIsSubmitting] = useState(false)
  const betragRef = useRef<HTMLInputElement>(null)

  // Auf- und Zugeklapptes gehört zu EINEM Öffnen: Ändert sich die Öffnung,
  // gilt der Anfangszustand — beim Rendern angepasst, nicht in einem Effekt.
  const oeffnung = open ? `${editingSale?.id ?? ''}|${prefillSale?.id ?? ''}` : null
  const [klappen, setKlappen] = useState({ oeffnung, mehr: false, datum: false })
  if (klappen.oeffnung !== oeffnung) {
    const start = startWerte(editingSale, prefillSale)
    setKlappen({ oeffnung, mehr: start.note !== '' || (start.quantity !== null && start.quantity !== 1), datum: false })
  }
  const mehrOffen = klappen.mehr
  const datumOffen = klappen.datum
  const setMehrOffen = (wert: boolean | ((o: boolean) => boolean)) =>
    setKlappen((k) => ({ ...k, mehr: typeof wert === 'function' ? wert(k.mehr) : wert }))
  const setDatumOffen = (wert: (o: boolean) => boolean) => setKlappen((k) => ({ ...k, datum: wert(k.datum) }))

  const form = useForm<FormWerte>({ defaultValues: startWerte(editingSale, prefillSale) })

  // Beim Öffnen neu befüllen: Der gemerkte Kanal steht erst im Browser fest.
  useEffect(() => {
    if (open) form.reset(startWerte(editingSale, prefillSale))
  }, [open, editingSale?.id, prefillSale?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Alle Felder haben Startwerte (startWerte) — der Teil-Typ von useWatch trifft hier nie zu.
  const werte = useWatch({ control: form.control }) as FormWerte
  const heute = wienKalendertag(new Date())
  const chips = produktChips(topProduktIds, products, werte.productId)
  const knopf = knopfText(werte.totalAmount, isEdit)
  const fehler = form.formState.errors

  function waehleProdukt(produkt: ProductData | null) {
    const abwaehlen = produkt ? werte.productId === produkt.id : werte.freierName
    form.setValue('productId', abwaehlen || !produkt ? null : produkt.id)
    form.setValue('freierName', !abwaehlen && !produkt)
    form.setValue('productName', '')
    form.setValue('unit', abwaehlen || !produkt ? null : produkt.unit)
  }

  async function onSubmit(w: FormWerte) {
    const geprueft = manualSaleFormSchema.safeParse({
      productId: w.productId,
      productName: w.freierName ? w.productName : undefined,
      quantity: w.quantity,
      unit: w.unit,
      totalAmount: w.totalAmount,
      channel: w.channel,
      saleDate: w.saleDate,
      note: w.note,
    })
    if (!geprueft.success) {
      for (const issue of geprueft.error.issues) {
        const feld = issue.path[0]
        if (feld === 'totalAmount' || feld === 'quantity' || feld === 'productName' || feld === 'note') {
          form.setError(feld, { message: issue.message })
          if (feld !== 'totalAmount') setMehrOffen(true)
        } else {
          toast.error(issue.message)
        }
      }
      return
    }

    setIsSubmitting(true)
    try {
      const antwort = isEdit
        ? await updateManualSale(editingSale.id, geprueft.data)
        : await createManualSale(geprueft.data)
      if ('error' in antwort) {
        toast.error(antwort.error)
        return
      }
      if (!isEdit) merkeKanal(kanalSpeicher(), geprueft.data.channel)
      toast.success(isEdit ? 'Verkauf gespeichert' : 'Verkauf eingetragen')
      onClose()
    } catch {
      toast.error('Wir konnten den Verkauf nicht speichern. Bitte versuch es noch einmal.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const einheit = werte.unit ? (UNIT_LABELS[werte.unit] ?? werte.unit) : undefined

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        // Neuer Verkauf: Der Betrag ist das Erste, was getippt wird — am Handy
        // geht damit gleich die Zifferntastatur auf.
        initialFocus={isEdit ? undefined : betragRef}
        className="max-w-md sm:max-w-md max-h-[92dvh] flex flex-col gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="px-5 pt-5 pb-0 pr-14 shrink-0 flex-row items-center justify-between gap-3">
          <DialogTitle>{isEdit ? 'Verkauf bearbeiten' : 'Verkauf eintragen'}</DialogTitle>
          <button
            type="button"
            onClick={() => setDatumOffen((o) => !o)}
            aria-expanded={datumOffen}
            aria-label={`Datum: ${datumKurz(werte.saleDate, heute)} — ändern`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CalendarDays className="size-3.5" aria-hidden />
            {datumKurz(werte.saleDate, heute)}
            <ChevronDown className={cn('size-3.5 transition-transform', datumOffen && 'rotate-180')} aria-hidden />
          </button>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-auto min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5">
            {datumOffen && (
              <div className="space-y-1.5">
                <label htmlFor="verkauf-datum" className="text-xs font-medium text-muted-foreground">
                  An welchem Tag?
                </label>
                <Input
                  id="verkauf-datum"
                  type="date"
                  max={heute}
                  value={werte.saleDate}
                  onChange={(e) => e.target.value && form.setValue('saleDate', e.target.value)}
                  className="h-11 appearance-none [&::-webkit-date-and-time-value]:text-left"
                />
              </div>
            )}

            {/* Der Betrag — groß, mit Komma oder Punkt (DezimalFeld) */}
            <div>
              <label htmlFor="verkauf-betrag" className="sr-only">
                Betrag in Euro
              </label>
              <div className="flex items-center gap-2 border-b-2 border-border focus-within:border-brand-text transition-colors">
                <span aria-hidden className="font-heading text-3xl font-semibold text-muted-foreground">
                  €
                </span>
                <DezimalFeld
                  id="verkauf-betrag"
                  ref={betragRef}
                  value={werte.totalAmount}
                  onChange={(wert) => {
                    form.setValue('totalAmount', wert)
                    form.clearErrors('totalAmount')
                  }}
                  stellen={2}
                  placeholder="0,00"
                  aria-invalid={fehler.totalAmount ? true : undefined}
                  className="h-16 border-0 bg-transparent px-0 font-heading text-4xl font-bold tabular-nums shadow-none focus-visible:ring-0 dark:bg-transparent"
                />
              </div>
              {fehler.totalAmount && <p className="mt-1.5 text-sm text-destructive">{fehler.totalAmount.message}</p>}
            </div>

            {/* Wo verkauft? */}
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-foreground">Wo verkauft?</legend>
              <div className="grid grid-cols-4 gap-2">
                {HAUPTKANAELE.map((k) => {
                  const Symbol = KANAL_SYMBOL[k.value]
                  const aktiv = werte.channel === k.value
                  return (
                    <button
                      key={k.value}
                      type="button"
                      aria-pressed={aktiv}
                      onClick={() => form.setValue('channel', k.value)}
                      className={cn(
                        'flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border px-1 py-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        aktiv
                          ? 'border-app-bar bg-app-bar text-app-bar-ink'
                          : 'border-border bg-card text-app-ink-soft hover:border-brand-text/40'
                      )}
                    >
                      <Symbol className="size-5" strokeWidth={1.8} aria-hidden />
                      <span className="text-xs font-medium leading-tight">{k.label}</span>
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                aria-pressed={werte.channel === 'OTHER'}
                onClick={() => form.setValue('channel', 'OTHER')}
                className={cn(
                  'mt-2 inline-flex min-h-9 items-center gap-1 text-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded',
                  werte.channel === 'OTHER' ? 'font-semibold text-brand-text' : 'text-muted-foreground'
                )}
              >
                {/* Gewählt sagt aria-pressed — der Haken ist nur fürs Auge. */}
                {werte.channel === 'OTHER' && <Check className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />}
                Anderer Weg
              </button>
            </fieldset>

            {/* Was? — freiwillig */}
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-foreground">
                Was? <span className="font-normal text-muted-foreground">— freiwillig</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {chips.map((p) => {
                  const aktiv = werte.productId === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={aktiv}
                      onClick={() => waehleProdukt(p)}
                      className={cn(
                        'min-h-10 max-w-full truncate rounded-full border px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        aktiv ? 'border-app-bar bg-app-bar text-app-bar-ink' : 'border-border bg-card text-foreground hover:border-brand-text/40'
                      )}
                    >
                      {p.name}
                    </button>
                  )
                })}
                <button
                  type="button"
                  aria-pressed={werte.freierName}
                  onClick={() => waehleProdukt(null)}
                  className={cn(
                    'min-h-10 rounded-full border border-dashed px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    werte.freierName ? 'border-app-bar bg-app-bar text-app-bar-ink' : 'border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  Anderes
                </button>
              </div>
              {werte.freierName && (
                <div className="mt-2">
                  <label htmlFor="verkauf-name" className="sr-only">
                    Was hast du verkauft?
                  </label>
                  <Input
                    id="verkauf-name"
                    autoFocus
                    placeholder="Was hast du verkauft?"
                    className="h-11"
                    maxLength={100}
                    {...form.register('productName')}
                  />
                  {fehler.productName && <p className="mt-1.5 text-sm text-destructive">{fehler.productName.message}</p>}
                </div>
              )}
            </fieldset>

            {/* Menge oder Notiz — zugeklappt */}
            <div>
              <button
                type="button"
                aria-expanded={mehrOffen}
                onClick={() => setMehrOffen((o) => !o)}
                className="inline-flex min-h-9 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                <ChevronDown className={cn('size-4 transition-transform', mehrOffen && 'rotate-180')} aria-hidden />
                Menge oder Notiz ergänzen
              </button>
              {mehrOffen && (
                <div className="mt-3 space-y-3">
                  <div className="space-y-1.5">
                    <label htmlFor="verkauf-menge" className="text-sm font-medium">
                      Menge
                    </label>
                    <DezimalFeld
                      id="verkauf-menge"
                      value={werte.quantity}
                      onChange={(wert) => {
                        form.setValue('quantity', wert)
                        form.clearErrors('quantity')
                      }}
                      suffix={einheit}
                      placeholder="z. B. 2,5"
                      className="h-11"
                    />
                    {fehler.quantity && <p className="text-sm text-destructive">{fehler.quantity.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="verkauf-notiz" className="text-sm font-medium">
                      Notiz
                    </label>
                    <Textarea
                      id="verkauf-notiz"
                      placeholder="z. B. Stammkundin, Rechnung folgt"
                      rows={2}
                      maxLength={500}
                      className="resize-none"
                      {...form.register('note')}
                    />
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              Nur Verkäufe, die nicht über FarmerZone bestellt wurden. Bestellungen zählt die Auswertung von selbst —
              auch die mit &bdquo;Bar bei Abholung&ldquo;.
            </p>
          </div>

          {/* mx-0 mb-0: neutralisiert die -mx-6/-mb-6 des Bausteins (die das
              Standard-p-6 ausgleichen sollen — hier ist aber p-0) */}
          <DialogFooter className="mx-0 mb-0 px-5 py-4 border-t border-border/50 shrink-0">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting || !knopf.aktiv} className="min-w-[140px] tabular-nums">
              {isSubmitting ? 'Speichere…' : knopf.text}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
