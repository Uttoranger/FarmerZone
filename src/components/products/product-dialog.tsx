'use client'

import { useState, useEffect, useRef } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ImagePlus, X, Leaf, Thermometer, Snowflake } from 'lucide-react'
import { resizeToWebP } from '@/components/shared/image-upload'
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
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createProduct, updateProduct } from '@/server/actions/products'
import type { ProductData } from '@/server/queries/products'
import {
  productFormSchema,
  type ProductFormData,
  ALLERGENS,
  UNIT_OPTIONS,
  MONTH_OPTIONS,
  CATEGORY_OPTIONS,
  seasonLabel,
} from '@/schemas/product'

type Props = {
  open: boolean
  product: ProductData | null
  onClose: () => void
}

const EMPTY_DEFAULTS: ProductFormData = {
  name: '',
  description: '',
  imageUrl: '',
  category: null,
  countsTowardLimit: true,
  price: 0,
  vatRate: 10,
  unit: 'STUECK',
  unitSize: undefined,
  stock: 0,
  isAvailable: true,
  allergens: [],
  isOrganic: false,
  requiresCool: false,
  requiresFreezer: false,
  seasonStart: undefined,
  seasonEnd: undefined,
  unavailableReason: '',
}

function toFormDefaults(p: ProductData): Partial<ProductFormData> {
  return {
    name: p.name,
    description: p.description ?? '',
    imageUrl: p.imageUrl ?? '',
    category: p.category ?? null,
    countsTowardLimit: p.countsTowardLimit,
    price: p.price,
    vatRate: p.vatRate,
    unit: p.unit as ProductFormData['unit'],
    unitSize: p.unitSize ?? undefined,
    stock: p.stock,
    isAvailable: p.isAvailable,
    allergens: p.allergens,
    isOrganic: p.isOrganic,
    requiresCool: p.requiresCool,
    requiresFreezer: p.requiresFreezer,
    seasonStart: p.seasonStart ?? undefined,
    seasonEnd: p.seasonEnd ?? undefined,
    unavailableReason: p.unavailableReason ?? '',
  }
}

export function ProductDialog({ open, product, onClose }: Props) {
  const isEdit = product !== null
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema) as Resolver<ProductFormData>,
    defaultValues: isEdit ? toFormDefaults(product) : EMPTY_DEFAULTS,
  })

  const isAvailable = form.watch('isAvailable')
  const watchedSeasonStart = form.watch('seasonStart')
  const watchedSeasonEnd = form.watch('seasonEnd')

  // Reset form when dialog opens/switches product
  useEffect(() => {
    if (open) {
      form.reset(isEdit ? toFormDefaults(product) : EMPTY_DEFAULTS)
      setSelectedFile(null)
      setPreviewUrl(isEdit ? (product.imageUrl ?? null) : null)
    }
  }, [open, product?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Revoke object URLs on cleanup
  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  function handleRemoveImage() {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    setSelectedFile(null)
    setPreviewUrl(null)
    form.setValue('imageUrl', '')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function toggleAllergen(id: string) {
    const current = form.getValues('allergens')
    form.setValue(
      'allergens',
      current.includes(id) ? current.filter((a) => a !== id) : [...current, id],
      { shouldDirty: true }
    )
  }

  async function onSubmit(data: ProductFormData) {
    setIsSubmitting(true)
    try {
      let imageUrl = data.imageUrl ?? ''

      if (selectedFile) {
        const resized = await resizeToWebP(selectedFile, 2400).catch(() => selectedFile)
        const fd = new FormData()
        fd.append('file', resized)
        fd.append('target', 'product')
        if (isEdit) fd.append('id', product.id)
        const existingUrl = isEdit ? (product.imageUrl ?? '') : ''
        if (existingUrl) fd.append('oldUrl', existingUrl)
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        if (res.ok) {
          const json = await res.json()
          imageUrl = json.url
        } else {
          const err = await res.json()
          if (err.error === 'Upload nicht konfiguriert') {
            toast.info('Foto-Upload noch nicht aktiviert (Vercel Blob fehlt)')
            // proceed without image
          } else {
            toast.error(err.error ?? 'Foto-Upload fehlgeschlagen')
            return
          }
        }
      }

      const payload: ProductFormData = { ...data, imageUrl }

      if (isEdit) {
        await updateProduct(product.id, payload)
        toast.success('Produkt gespeichert')
      } else {
        await createProduct(payload)
        toast.success('Produkt angelegt')
      }
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler beim Speichern')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[92dvh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
          <DialogTitle>{isEdit ? 'Produkt bearbeiten' : 'Neues Produkt'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col flex-1 min-h-0"
          >
            {/* Scrollable form body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

              {/* === FOTO === */}
              <section>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Foto</p>
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0 w-24 h-24 rounded-xl border-2 border-dashed border-border overflow-hidden bg-muted/30 flex items-center justify-center">
                    {previewUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewUrl}
                          alt="Vorschau"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <ImagePlus className="w-6 h-6 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id="product-image-input"
                      onChange={handleImageChange}
                    />
                    <label
                      htmlFor="product-image-input"
                      className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' cursor-pointer'}
                    >
                      {previewUrl ? 'Foto ersetzen' : 'Foto wählen'}
                    </label>
                    <p className="text-xs text-muted-foreground/60 mt-1.5">
                      JPEG, PNG oder WebP · max. 10 MB
                    </p>
                  </div>
                </div>
              </section>

              {/* === GRUNDDATEN === */}
              <section className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Grunddaten</p>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="z. B. Heumilch frisch" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Beschreibung</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Kurze Produktbeschreibung für den Shop…"
                          rows={3}
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kategorie</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === 'NONE' ? null : v)}
                        value={field.value ?? 'NONE'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Keine Angabe" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="NONE">Keine Angabe</SelectItem>
                          {CATEGORY_OPTIONS.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="countsTowardLimit"
                  render={({ field }) => (
                    <div>
                      <label className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="w-4 h-4 rounded accent-green-600"
                        />
                        <span className="text-sm text-foreground">
                          Zählt zur 55.000-€-Grenze (Be- &amp; Verarbeitung)
                        </span>
                      </label>
                      <p className="text-xs text-muted-foreground pl-[42px]">
                        Reine Urproduktion zählt meist nicht — im Zweifel mit dem Steuerberater klären.
                      </p>
                    </div>
                  )}
                />
              </section>

              {/* === PREIS & EINHEIT === */}
              <section className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Preis & Einheit</p>

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preis (€) *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0,00"
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
                    name="vatRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>MwSt. (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="1"
                            min="0"
                            max="100"
                            {...field}
                            onChange={(e) => field.onChange(e.target.valueAsNumber)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Einheit *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Wählen…" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {UNIT_OPTIONS.map((u) => (
                              <SelectItem key={u.value} value={u.value}>
                                {u.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="unitSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Menge / Größe</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.001"
                            min="0"
                            placeholder="z. B. 0.5"
                            value={field.value ?? ''}
                            onChange={(e) =>
                              field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </section>

              {/* === BESTAND & VERFÜGBARKEIT === */}
              <section className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bestand & Verfügbarkeit</p>

                <FormField
                  control={form.control}
                  name="stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Aktueller Bestand</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="1"
                          min="0"
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
                  name="isAvailable"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={field.value}
                          onClick={() => field.onChange(!field.value)}
                          className={`relative w-10 h-6 rounded-full transition-colors ${
                            field.value ? 'bg-green-600' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                              field.value ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <div>
                          <FormLabel className="font-medium cursor-pointer" onClick={() => field.onChange(!field.value)}>
                            Im Shop verfügbar
                          </FormLabel>
                          <p className="text-xs text-muted-foreground/60">
                            {field.value ? 'Sichtbar und bestellbar' : 'Ausgeblendet im Shop'}
                          </p>
                        </div>
                      </div>
                    </FormItem>
                  )}
                />

                {!isAvailable && (
                  <FormField
                    control={form.control}
                    name="unavailableReason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grund (optional, für dich)</FormLabel>
                        <FormControl>
                          <Input placeholder="z. B. Saison vorbei, wieder ab November" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </section>

              {/* === EIGENSCHAFTEN === */}
              <section className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Eigenschaften</p>
                <div className="space-y-2">
                  {(
                    [
                      { name: 'isOrganic', label: 'Bio-zertifiziert', icon: <Leaf className="w-4 h-4 text-green-600" /> },
                      { name: 'requiresCool', label: 'Kühlung nötig (+2–8 °C)', icon: <Thermometer className="w-4 h-4 text-blue-500" /> },
                      { name: 'requiresFreezer', label: 'Tiefkühlung nötig (−18 °C)', icon: <Snowflake className="w-4 h-4 text-sky-500" /> },
                    ] as const
                  ).map(({ name, label, icon }) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name}
                      render={({ field }) => (
                        <label className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={(e) => field.onChange(e.target.checked)}
                            className="w-4 h-4 rounded accent-green-600"
                          />
                          {icon}
                          <span className="text-sm text-foreground">{label}</span>
                        </label>
                      )}
                    />
                  ))}
                </div>
              </section>

              {/* === ALLERGENE === */}
              <section className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Allergene (EU 14)</p>
                <FormField
                  control={form.control}
                  name="allergens"
                  render={({ field }) => (
                    <div className="flex flex-wrap gap-1.5">
                      {ALLERGENS.map(({ id, label }) => {
                        const active = field.value.includes(id)
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => toggleAllergen(id)}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                              active
                                ? 'bg-amber-100 border-amber-400 text-amber-800'
                                : 'bg-white border-border text-muted-foreground hover:border-border'
                            }`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                />
              </section>

              {/* === SAISONALITÄT === */}
              <section className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Saisonalität (optional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="seasonStart"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Saison von</FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(v === '0' ? undefined : Number(v))}
                          value={field.value?.toString() ?? '0'}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Monat…" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="0">— keiner —</SelectItem>
                            {MONTH_OPTIONS.map((m) => (
                              <SelectItem key={m.value} value={m.value.toString()}>
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="seasonEnd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Saison bis</FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(v === '0' ? undefined : Number(v))}
                          value={field.value?.toString() ?? '0'}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Monat…" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="0">— keiner —</SelectItem>
                            {MONTH_OPTIONS.map((m) => (
                              <SelectItem key={m.value} value={m.value.toString()}>
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {watchedSeasonStart && watchedSeasonEnd && (
                  <p className="text-xs text-muted-foreground">
                    {seasonLabel(watchedSeasonStart, watchedSeasonEnd)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground/60">
                  Saison kann über den Jahreswechsel gehen (z. B. Okt → März)
                </p>
              </section>

            </div>

            {/* Fixed footer with action buttons */}
            <DialogFooter className="px-6 py-4 border-t border-border/50 shrink-0">
              <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSubmitting} className="min-w-[100px]">
                {isSubmitting ? 'Speichere…' : isEdit ? 'Speichern' : 'Anlegen'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

