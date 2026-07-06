'use client'

import { useState, useEffect } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createManualSale, updateManualSale } from '@/server/actions/manual-sales'
import type { ManualSaleData } from '@/server/queries/manual-sales'
import type { ProductData } from '@/server/queries/products'
import {
  manualSaleFormSchema,
  type ManualSaleFormData,
  CHANNEL_OPTIONS,
  CHANNEL_LABELS,
} from '@/schemas/manual-sale'
import { UNIT_OPTIONS, UNIT_LABELS } from '@/schemas/product'

const SONSTIGES_ID = '__other__'

type Props = {
  open: boolean
  editingSale: ManualSaleData | null
  prefillSale: ManualSaleData | null
  products: ProductData[]
  onClose: () => void
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function toDefaults(
  sale: ManualSaleData | null,
  prefill: ManualSaleData | null
): Partial<ManualSaleFormData> {
  const source = sale ?? prefill
  if (!source) {
    return {
      channel: 'HOFLADEN',
      saleDate: todayStr(),
      quantity: 1,
    }
  }
  return {
    productId: source.productId ?? SONSTIGES_ID,
    productName: source.productName,
    quantity: source.quantity,
    unit: source.unit as ManualSaleFormData['unit'] ?? undefined,
    totalAmount: source.totalAmount,
    channel: source.channel as ManualSaleFormData['channel'],
    saleDate: sale ? source.saleDate.toISOString().split('T')[0] : todayStr(),
    note: source.note ?? '',
  }
}

export function SaleDialog({ open, editingSale, prefillSale, products, onClose }: Props) {
  const isEdit = editingSale !== null
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showOtherName, setShowOtherName] = useState(false)

  const form = useForm<ManualSaleFormData>({
    resolver: zodResolver(manualSaleFormSchema) as Resolver<ManualSaleFormData>,
    defaultValues: toDefaults(editingSale, prefillSale),
  })

  useEffect(() => {
    if (open) {
      const defaults = toDefaults(editingSale, prefillSale)
      form.reset(defaults)
      const pid = defaults.productId
      setShowOtherName(!pid || pid === SONSTIGES_ID)
    }
  }, [open, editingSale?.id, prefillSale?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleProductChange(productId: string) {
    if (productId === SONSTIGES_ID) {
      form.setValue('productId', null)
      form.setValue('productName', '')
      form.setValue('unit', undefined)
      setShowOtherName(true)
    } else {
      const p = products.find((pr) => pr.id === productId)
      if (p) {
        form.setValue('productId', p.id)
        form.setValue('productName', p.name)
        form.setValue('unit', p.unit as ManualSaleFormData['unit'])
        setShowOtherName(false)
      }
    }
  }

  async function onSubmit(data: ManualSaleFormData) {
    setIsSubmitting(true)
    try {
      // Strip internal SONSTIGES_ID before saving
      const payload: ManualSaleFormData = {
        ...data,
        productId: data.productId === SONSTIGES_ID ? null : (data.productId ?? null),
      }

      if (isEdit) {
        await updateManualSale(editingSale.id, payload)
        toast.success('Verkauf aktualisiert')
      } else {
        await createManualSale(payload)
        toast.success('Verkauf eingetragen')
      }
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler beim Speichern')
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedProductId = form.watch('productId')

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[92dvh] flex flex-col p-0">
        <DialogHeader className="px-5 pt-5 pb-0 shrink-0">
          <DialogTitle>{isEdit ? 'Verkauf bearbeiten' : 'Verkauf eintragen'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col flex-1 min-h-0"
          >
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

              {/* Produkt */}
              <div className="space-y-2">
                <FormLabel className="text-sm font-medium">Produkt</FormLabel>
                <Select
                  onValueChange={(v) => handleProductChange(v ?? SONSTIGES_ID)}
                  value={selectedProductId ?? SONSTIGES_ID}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Produkt wählen…" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={SONSTIGES_ID}>Sonstiges / freier Text</SelectItem>
                  </SelectContent>
                </Select>

                {showOtherName && (
                  <FormField
                    control={form.control}
                    name="productName"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="Produktname eingeben…" className="h-11" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Betrag + Menge */}
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="totalAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Betrag (€) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          className="h-11"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Menge{' '}
                        {form.watch('unit') && (
                          <span className="text-muted-foreground/60 font-normal">
                            ({UNIT_LABELS[form.watch('unit') ?? ''] ?? form.watch('unit')})
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          placeholder="1"
                          className="h-11"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {showOtherName && (
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Einheit (optional)</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === '0' ? undefined : v)}
                        value={field.value ?? '0'}
                      >
                        <FormControl>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0">— keine —</SelectItem>
                          {UNIT_OPTIONS.map((u) => (
                            <SelectItem key={u.value} value={u.value}>
                              {u.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              )}

              {/* Kanal */}
              <FormField
                control={form.control}
                name="channel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verkaufskanal *</FormLabel>
                    <div className="grid grid-cols-5 gap-1.5">
                      {CHANNEL_OPTIONS.map((ch) => {
                        const active = field.value === ch.value
                        return (
                          <button
                            key={ch.value}
                            type="button"
                            onClick={() => field.onChange(ch.value)}
                            className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-center transition-colors ${
                              active
                                ? 'bg-green-600 border-green-600 text-white'
                                : 'bg-white border-border text-muted-foreground hover:border-border'
                            }`}
                          >
                            <span className="text-base leading-none">{ch.icon}</span>
                            <span className="text-[10px] leading-tight font-medium">
                              {ch.label.split(' ')[0]}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Datum */}
              <FormField
                control={form.control}
                name="saleDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Datum</FormLabel>
                    <FormControl>
                      <Input type="date" className="h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Notiz */}
              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notiz (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="z. B. Stammkunde Maria, Rechnung folgt…"
                        rows={2}
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="px-5 py-4 border-t border-border/50 shrink-0">
              <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSubmitting} className="min-w-[100px]">
                {isSubmitting ? 'Speichere…' : isEdit ? 'Speichern' : 'Eintragen'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

