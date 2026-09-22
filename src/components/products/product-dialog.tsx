'use client'

import { useState, useEffect, useRef } from 'react'
import { useForm, type FieldErrors, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ImagePlus, X, Leaf, Thermometer, Snowflake } from 'lucide-react'
import { ladeFotoHoch, stufenText, type UploadStufe } from '@/components/shared/image-upload'
import { useFotoQuellen } from '@/components/shared/foto-quellen'
import { bildFehlerMeldung } from '@/lib/upload-fehler'
import { meldeUploadFehler, type UploadWeg } from '@/lib/upload-meldung'
import { MAX_ORIGINAL_BYTES } from '@/lib/upload-pfade'
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionPanel,
} from '@/components/ui/accordion'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { DezimalFeld } from '@/components/shared/dezimal-feld'
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
  type FutterKennzeichnungFormData,
  ALLERGENS,
  UNIT_OPTIONS,
  MONTH_OPTIONS,
  CATEGORY_OPTIONS,
  MWST_STANDARD,
  seasonLabel,
} from '@/schemas/product'
import {
  hatUnterkategorien,
  unterkategorienVon,
  UNTERKATEGORIE_LABEL,
  PRODUCT_LABEL_VALUES,
  SIEGEL,
  TIERART_VALUES,
  TIERART_LABEL,
  type ProductCategoryValue,
} from '@/lib/taxonomie'
import {
  formatKategorie,
  formatGrundpreis,
  formatZahl,
  mitAnzahl,
  einheitLabel,
  bestandLabel,
  formatBestand,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  kundenVorschau,
  paketpreisFraglich,
  paketpreisAntworten,
  PAKETPREIS_FRAGE,
  preisFeldLabel,
} from './produkt-preis'
import {
  ABSCHNITT_TITEL,
  abschnitteMitFehlern,
  erstesFehlerfeld,
  saisonVorbelegung,
  type Abschnitt,
} from './produkt-abschnitte'

/**
 * Eine Zeile mit Schalter, Titel und Untertitel — drei davon im Formular
 * (feste Pakete, im Shop verfügbar, saisonal). Der ganze Kasten ist klickbar,
 * das Touch-Ziel damit deutlich über 44 px.
 */
function SchalterZeile({
  id,
  titel,
  untertitel,
  checked,
  onCheckedChange,
}: {
  id: string
  titel: string
  untertitel: string
  checked: boolean
  onCheckedChange: (an: boolean) => void
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border border-border p-3"
    >
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{titel}</span>
        <span className="text-xs text-muted-foreground">{untertitel}</span>
      </span>
    </label>
  )
}

type Props = {
  open: boolean
  product: ProductData | null
  onClose: () => void
}

/** Eine leere Kennzeichnung — sobald die Kategorie Futtermittel gewählt ist. */
const FUTTER_LEER: FutterKennzeichnungFormData = {
  zielTierarten: [],
  zusammensetzung: '',
  analytischeBestandteile: '',
  zusatzstoffe: '',
  registrierungsnummer: '',
  gebrauchshinweis: '',
  bestaetigt: false,
}

const EMPTY_DEFAULTS: ProductFormData = {
  name: '',
  description: '',
  imageUrl: '',
  category: null,
  subcategory: null,
  labels: [],
  // Leer ist null, nie undefined: react-hook-form liest undefined als
  // „Ausgangswert wiederherstellen" (docs/ai/CODING_STANDARDS.md, Formulare).
  futter: null,
  countsTowardLimit: true,
  // NaN statt 0: Das Preisfeld startet leer, und die Prüfung meldet „Bitte gib
  // einen Preis ein" statt „größer als 0" für eine Null, die niemand getippt hat.
  price: Number.NaN,
  vatRate: MWST_STANDARD,
  unit: 'STUECK',
  unitSize: null,
  stock: 0,
  isAvailable: true,
  allergens: [],
  requiresCool: false,
  requiresFreezer: false,
  seasonStart: null,
  seasonEnd: null,
  unavailableReason: '',
}

function toFormDefaults(p: ProductData): Partial<ProductFormData> {
  return {
    name: p.name,
    description: p.description ?? '',
    imageUrl: p.imageUrl ?? '',
    category: p.category ?? null,
    subcategory: p.subcategory ?? null,
    labels: p.labels,
    // Eine gespeicherte Kennzeichnung wurde schon einmal bestätigt — der Haken
    // ist deshalb gesetzt. Beim Speichern wird das Datum ohnehin neu gestempelt.
    futter: p.futter
      ? {
          zielTierarten: p.futter.zielTierarten,
          zusammensetzung: p.futter.zusammensetzung,
          analytischeBestandteile: p.futter.analytischeBestandteile,
          zusatzstoffe: p.futter.zusatzstoffe ?? '',
          registrierungsnummer: p.futter.registrierungsnummer ?? '',
          gebrauchshinweis: p.futter.gebrauchshinweis ?? '',
          bestaetigt: true,
        }
      : null,
    countsTowardLimit: p.countsTowardLimit,
    price: p.price,
    vatRate: p.vatRate,
    unit: p.unit as ProductFormData['unit'],
    unitSize: p.unitSize ?? null,
    stock: p.stock,
    isAvailable: p.isAvailable,
    allergens: p.allergens,
    requiresCool: p.requiresCool,
    requiresFreezer: p.requiresFreezer,
    seasonStart: p.seasonStart ?? null,
    seasonEnd: p.seasonEnd ?? null,
    unavailableReason: p.unavailableReason ?? '',
  }
}

/** Die Zeile unter dem Abschnittstitel, wenn er zugeklappt ist. */
function zusammenfassung(abschnitt: Abschnitt, w: ProductFormData): string {
  switch (abschnitt) {
    case 'grunddaten':
      return w.category ? formatKategorie(w.category, w.subcategory) : 'Noch keine Kategorie'
    case 'preis': {
      const preis = Number.isFinite(w.price) ? w.price : 0
      const teile = [formatGrundpreis(preis, w.unit, w.unitSize), `${Number.isFinite(w.stock) ? w.stock : 0} auf Lager`]
      if (!w.isAvailable) teile.push('ausgeblendet')
      return teile.join(' · ')
    }
    case 'details': {
      const teile: string[] = []
      teile.push(w.labels.length > 0 ? w.labels.map((l) => SIEGEL[l].name).join(', ') : 'Keine Siegel')
      if (w.allergens.length > 0) teile.push(mitAnzahl(w.allergens.length, 'Allergen', 'Allergene'))
      // Der MwSt-Satz steht nur da, wenn er vom Standard abweicht.
      if (Number.isFinite(w.vatRate) && w.vatRate !== MWST_STANDARD) {
        teile.push(`MwSt ${formatZahl(w.vatRate)} %`)
      }
      return teile.join(' · ')
    }
    case 'kennzeichnung': {
      const tiere = w.futter?.zielTierarten ?? []
      return tiere.length > 0 ? `Für ${tiere.map((t) => TIERART_LABEL[t]).join(', ')}` : 'Noch nicht ausgefüllt'
    }
  }
}

/** Auswahl-Chip, Touch-Ziel 44 px — dieselbe Gestalt wie die Filterchips auf /hoefe. */
function chipKlasse(aktiv: boolean): string {
  return cn(
    'min-h-11 rounded-full border px-4 text-sm font-medium transition-colors',
    aktiv
      ? 'border-primary bg-primary text-primary-foreground'
      : 'border-border bg-card text-foreground hover:bg-muted/40'
  )
}

export function ProductDialog({ open, product, onClose }: Props) {
  const isEdit = product !== null
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Nur während des Foto-Uploads gesetzt — danach zeigt der Knopf wieder
  // „Speichere…". So nennt auch hier jeder Hänger seinen Ort.
  const [uploadFortschritt, setUploadFortschritt] = useState<{
    stufe: UploadStufe
    prozent: number
  } | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  // Welche Abschnitte aufgeklappt sind. Anlegen: nur Grunddaten; Bearbeiten:
  // alle zu, die Titel tragen dann eine Zusammenfassung.
  const [offen, setOffen] = useState<Abschnitt[]>([])
  // Kategoriewechsel weg von Futtermittel wartet auf Bestätigung — die
  // Kennzeichnung würde beim Speichern gelöscht.
  const [kategorieWechsel, setKategorieWechsel] = useState<{ neu: ProductCategoryValue | null } | null>(null)
  // Der Preis, der im Feld stand, bevor eine Gebindegröße über 1 gesetzt wurde —
  // mutmaßlich ein Preis je Einheit. Grundlage der Rückfrage „ganzes Paket?".
  const [referenzPreis, setReferenzPreis] = useState<number | null>(null)
  // Die beiden Schalter. Sie sind KEIN Formularwert: Aus bedeutet „Feld leer",
  // An zeigt das Feld — auch wenn noch nichts drinsteht.
  const [festePakete, setFestePakete] = useState(false)
  const [saisonal, setSaisonal] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  // Über welchen Weg das gewählte Foto kam — nur für die Sentry-Meldung;
  // der Upload läuft hier erst beim Absenden, also bis dahin merken.
  const gewaehlterWeg = useRef<UploadWeg>('galerie')
  // Drei Wege zum Produktfoto (Galerie, Dateien, Kamera) — derselbe
  // Quellen-Hook wie im Upload-Hook, damit es nur EIN Menü gibt.
  const fotoQuellen = useFotoQuellen({
    onFiles: ([datei], weg) => {
      gewaehlterWeg.current = weg
      uebernehmeFoto(datei)
    },
  })

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema) as Resolver<ProductFormData>,
    defaultValues: isEdit ? toFormDefaults(product) : EMPTY_DEFAULTS,
  })

  const werte = form.watch()
  const category = werte.category
  const isAvailable = werte.isAvailable
  const watchedSeasonStart = werte.seasonStart
  const watchedSeasonEnd = werte.seasonEnd
  const istFuttermittel = category === 'FUTTERMITTEL'
  const fehlerhafteAbschnitte = abschnitteMitFehlern(form.formState.errors)
  const preisVorschau = kundenVorschau(werte.price, werte.unit, werte.unitSize)
  const preisFraglich = paketpreisFraglich({
    price: werte.price,
    unitSize: werte.unitSize,
    referenzPreis,
  })
  const preisAntworten = paketpreisAntworten(werte.price, werte.unit, werte.unitSize)
  const bestandGesamt = formatBestand(werte.stock, werte.unit, werte.unitSize)
  const mwstStandard = MWST_STANDARD

  // Reset form when dialog opens/switches product
  useEffect(() => {
    if (open) {
      form.reset(isEdit ? toFormDefaults(product) : EMPTY_DEFAULTS)
      setSelectedFile(null)
      setPreviewUrl(isEdit ? (product.imageUrl ?? null) : null)
      setOffen(isEdit ? [] : ['grunddaten'])
      setKategorieWechsel(null)
      setReferenzPreis(null)
      // Beim Bearbeiten stehen die Schalter so, wie das Produkt gespeichert ist.
      setFestePakete(isEdit && product.unitSize != null)
      setSaisonal(isEdit && product.seasonStart != null && product.seasonEnd != null)
    }
  }, [open, product?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Revoke object URLs on cleanup
  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function abschnittOeffnen(abschnitt: Abschnitt) {
    setOffen((o) => (o.includes(abschnitt) ? o : [...o, abschnitt]))
  }

  /** Schalter „feste Pakete": Aus leert die Gebindegröße und die Rückfrage-Referenz. */
  function festePaketeUmschalten(an: boolean) {
    setFestePakete(an)
    if (!an) {
      form.setValue('unitSize', null, { shouldDirty: true })
      form.clearErrors('unitSize')
      setReferenzPreis(null)
    }
  }

  /** Schalter „saisonal": An belegt Von/Bis vor, Aus leert beide. */
  function saisonalUmschalten(an: boolean) {
    setSaisonal(an)
    if (an) {
      const { start, end } = saisonVorbelegung(new Date())
      form.setValue('seasonStart', start, { shouldDirty: true })
      form.setValue('seasonEnd', end, { shouldDirty: true })
    } else {
      form.setValue('seasonStart', null, { shouldDirty: true })
      form.setValue('seasonEnd', null, { shouldDirty: true })
    }
  }

  function uebernehmeFoto(file: File) {
    if (file.size > MAX_ORIGINAL_BYTES) {
      toast.error('Datei zu groß (max. 25 MB)')
      return
    }
    // KEINE clientseitige Format-Probe mehr: Sie hing am Canvas, und genau der
    // war das Problem. Das Urteil fällt jetzt beim Absenden auf dem Server, an
    // den Bytes statt an einer Browser-Fähigkeit. Die Vorschau ist bis dahin
    // nur eine Vorschau — kann der Browser sie nicht zeichnen, räumt onError
    // sie weg, statt ein kaputtes Bildsymbol stehen zu lassen.
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  function handleRemoveImage() {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    setSelectedFile(null)
    setPreviewUrl(null)
    form.setValue('imageUrl', '')
  }

  function toggleAllergen(id: string) {
    const current = form.getValues('allergens')
    form.setValue(
      'allergens',
      current.includes(id) ? current.filter((a) => a !== id) : [...current, id],
      { shouldDirty: true }
    )
  }

  /**
   * Kategorie wählen. Ein Wechsel setzt die Unterkategorie zurück (sie gehört
   * zur alten L1). Weg von Futtermittel mit vorhandener Kennzeichnung: erst
   * fragen — sie würde beim Speichern gelöscht.
   */
  function kategorieWaehlen(neu: ProductCategoryValue | null) {
    const alt = form.getValues('category')
    if (neu === alt) return
    if (alt === 'FUTTERMITTEL' && form.getValues('futter') != null) {
      setKategorieWechsel({ neu })
      return
    }
    kategorieSetzen(neu)
  }

  function kategorieSetzen(neu: ProductCategoryValue | null) {
    form.setValue('category', neu, { shouldDirty: true })
    form.setValue('subcategory', null, { shouldDirty: true })
    form.clearErrors('subcategory')
    if (neu === 'FUTTERMITTEL') {
      if (form.getValues('futter') == null) form.setValue('futter', { ...FUTTER_LEER })
      // Beim Anlegen eines Futtermittels ist die Kennzeichnung Pflicht — gleich zeigen.
      abschnittOeffnen('kennzeichnung')
    } else {
      form.setValue('futter', null, { shouldDirty: true })
      form.clearErrors('futter')
    }
  }

  /**
   * Nach einer fehlgeschlagenen Prüfung den betroffenen Abschnitt öffnen und
   * zum ERSTEN Fehlerfeld springen (Muster aus dem Checkout). Vorher blieb der
   * Fehler in einem zugeklappten Abschnitt unsichtbar.
   */
  function onInvalid(errors: FieldErrors<ProductFormData>) {
    const treffer = erstesFehlerfeld(errors)
    if (!treffer) return
    abschnittOeffnen(treffer.abschnitt)
    toast.error('Bitte prüfe die markierten Felder.')
    // Erst nach dem Aufklappen scrollen — ein zugeklappter Abschnitt hat keine
    // Höhe, und die Öffnung braucht eine Animation lang.
    window.setTimeout(() => {
      const el =
        formRef.current?.querySelector<HTMLElement>(`[name="${treffer.feld}"]`) ??
        formRef.current?.querySelector<HTMLElement>(`[data-feld="${treffer.feld}"]`)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // focus() nach dem Scrollen, sonst springt der Browser noch einmal.
      window.setTimeout(() => el.focus({ preventScroll: true }), 120)
    }, 250)
  }

  async function onSubmit(data: ProductFormData) {
    setIsSubmitting(true)
    try {
      let imageUrl = data.imageUrl ?? ''

      if (selectedFile) {
        // Derselbe Weg wie im Hook: Original in den Speicher, Server
        // verkleinert, fertige Adresse zurück. Der Dialog nutzt den Hook nicht
        // (er lädt erst beim Absenden), teilt sich mit ihm aber die Funktion —
        // damit gibt es keinen zweiten Upload-Weg, der auseinanderlaufen kann.
        // 0 = der Transfer hat nie begonnen — nur für die Sentry-Meldung.
        let versuche = 0
        try {
          imageUrl = await ladeFotoHoch(selectedFile, 'product', {
            altUrl: isEdit ? (product.imageUrl ?? undefined) : undefined,
            onStufe: (stufe) =>
              setUploadFortschritt((v) => ({ stufe, prozent: v?.prozent ?? 0 })),
            onFortschritt: (prozent) =>
              setUploadFortschritt((v) => ({ stufe: v?.stufe ?? 'hochladen', prozent })),
            onVersuch: (versuch) => {
              versuche = versuch
            },
          })
        } catch (e) {
          // Zusätzlich zur Anzeige nach Sentry (Ursache/Kennung/Größe/Typ/
          // Weg/Versuche, kein Dateiname — upload-meldung.ts).
          meldeUploadFehler(e, { datei: selectedFile, weg: gewaehlterWeg.current, versuche })
          const { text } = bildFehlerMeldung(e)
          toast.error(text)
          return
        } finally {
          setUploadFortschritt(null)
        }
      }

      const payload: ProductFormData = { ...data, imageUrl }

      const ergebnis = isEdit
        ? await updateProduct(product.id, payload)
        : await createProduct(payload)
      if ('error' in ergebnis) {
        toast.error(ergebnis.error)
        return
      }
      toast.success(isEdit ? 'Produkt gespeichert' : 'Produkt angelegt')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Wir konnten das Produkt nicht speichern. Bitte versuch es noch einmal.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function abschnittTitel(abschnitt: Abschnitt, pflicht = false) {
    const zu = !offen.includes(abschnitt)
    const fehler = fehlerhafteAbschnitte.has(abschnitt)
    return (
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={cn(fehler && 'text-destructive')}>
          {ABSCHNITT_TITEL[abschnitt]}
          {pflicht && ' *'}
        </span>
        {zu && (
          <span className={cn('truncate text-xs font-normal', fehler ? 'text-destructive' : 'text-muted-foreground')}>
            {fehler ? 'Bitte prüfen' : zusammenfassung(abschnitt, werte)}
          </span>
        )}
      </span>
    )
  }

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {/* Drei Zonen innerhalb der Dialogkante: Kopf fest, EIN scrollbarer
          Inhalt mit allen Abschnitten, Fuß fest. overflow-hidden hält alles im
          Radius; min-h-0 auf dem Inhalt ist die Bedingung dafür, dass er selbst
          scrollt statt den ganzen Dialog aufzublähen. */}
      <DialogContent className="max-w-lg max-h-[92dvh] flex flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>{isEdit ? 'Produkt bearbeiten' : 'Neues Produkt'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            ref={formRef}
            onSubmit={form.handleSubmit(onSubmit, onInvalid)}
            className="flex flex-col flex-1 min-h-0"
          >
            {/* Scrollbarer Inhalt — pb-8, damit die letzte Karte nie unter dem Fuß liegt */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-1 pb-8">
              <Accordion
                multiple
                value={offen}
                onValueChange={(v) => setOffen(v as Abschnitt[])}
              >
                {/* === 1. GRUNDDATEN === */}
                <AccordionItem value="grunddaten">
                  <AccordionTrigger>{abschnittTitel('grunddaten')}</AccordionTrigger>
                  <AccordionPanel>
                    <div className="space-y-3">
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
                        name="category"
                        render={({ field }) => (
                          <FormItem data-feld="category">
                            <FormLabel>Kategorie</FormLabel>
                            <Select
                              onValueChange={(v) =>
                                kategorieWaehlen(v === 'NONE' ? null : (v as ProductCategoryValue))
                              }
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

                      {/* Unterkategorie: erst nach der Kategorie, nur wo es welche gibt.
                          Chips statt Select — es sind höchstens neun. */}
                      {category && hatUnterkategorien(category) && (
                        <FormField
                          control={form.control}
                          name="subcategory"
                          render={({ field }) => (
                            <FormItem data-feld="subcategory" tabIndex={-1} className="outline-none">
                              <FormLabel>Unterkategorie{istFuttermittel && ' *'}</FormLabel>
                              <div className="flex flex-wrap gap-2" role="group" aria-label="Unterkategorie">
                                {unterkategorienVon(category).map((l2) => {
                                  const aktiv = field.value === l2
                                  return (
                                    <button
                                      key={l2}
                                      type="button"
                                      aria-pressed={aktiv}
                                      onClick={() => field.onChange(aktiv ? null : l2)}
                                      className={chipKlasse(aktiv)}
                                    >
                                      {UNTERKATEGORIE_LABEL[l2]}
                                    </button>
                                  )
                                })}
                              </div>
                              {!field.value && !istFuttermittel && (
                                <FormDescription className="text-xs">
                                  Hilft Kundinnen beim Finden — du kannst sie auch später ergänzen.
                                </FormDescription>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {/* Foto */}
                      <div data-feld="imageUrl">
                        <p className="text-sm font-medium text-foreground mb-2">Foto</p>
                        <div className="flex items-start gap-3">
                          <div className="relative shrink-0 w-24 h-24 rounded-xl border-2 border-dashed border-border overflow-hidden bg-muted/30 flex items-center justify-center">
                            {previewUrl ? (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={previewUrl}
                                  alt="Vorschau"
                                  className="w-full h-full object-cover"
                                  // Ersatz für die entfallene Format-Probe: Kann der
                                  // Browser das Foto nicht zeichnen (HEIC auf Android),
                                  // verschwindet die Vorschau still, statt ein kaputtes
                                  // Bildsymbol zu zeigen. Die Datei BLEIBT ausgewählt —
                                  // ob sie taugt, entscheidet beim Absenden der Server.
                                  onError={() => setPreviewUrl(null)}
                                />
                                <button
                                  type="button"
                                  onClick={handleRemoveImage}
                                  aria-label="Foto entfernen"
                                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </>
                            ) : (
                              <ImagePlus className="w-6 h-6 text-muted-foreground/50" />
                            )}
                          </div>
                          <div className="flex-1">
                            {fotoQuellen.elemente}
                            <button
                              type="button"
                              onClick={fotoQuellen.oeffnen}
                              className={buttonVariants({ variant: 'outline', size: 'sm' })}
                            >
                              {previewUrl ? 'Foto ersetzen' : 'Foto wählen'}
                            </button>
                            <p className="text-xs text-muted-foreground/60 mt-1.5">
                              JPEG, PNG oder WebP — wird automatisch verkleinert
                            </p>
                          </div>
                        </div>
                      </div>

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Kurzbeschreibung</FormLabel>
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
                    </div>
                  </AccordionPanel>
                </AccordionItem>

                {/* === 2. PREIS & VERFÜGBARKEIT === */}
                <AccordionItem value="preis">
                  <AccordionTrigger>{abschnittTitel('preis')}</AccordionTrigger>
                  <AccordionPanel>
                    <div className="space-y-3">
                      {/* Reihenfolge Einheit → Gebinde → Preis: Das Preisfeld heißt je
                          nach Gebinde anders („Preis je kg" / „Preis für das 2-kg-Paket"),
                          also stehen die beiden zuerst. */}
                      <FormField
                        control={form.control}
                        name="unit"
                        render={({ field }) => (
                          <FormItem data-feld="unit">
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

                      {/* Gebinde hinter einem Schalter: Aus = Kunden bestellen einzeln
                          (unitSize leer), An = feste Pakete mit Größe. */}
                      <SchalterZeile
                        id="feste-pakete"
                        titel="Ich verkaufe in festen Paketen"
                        untertitel="z. B. ein 2-kg-Paket oder eine 0,5-L-Flasche"
                        checked={festePakete}
                        onCheckedChange={festePaketeUmschalten}
                      />

                      {festePakete && (
                        <FormField
                          control={form.control}
                          name="unitSize"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Gebindegröße *</FormLabel>
                              <FormControl>
                                <DezimalFeld
                                  name={field.name}
                                  value={field.value}
                                  placeholder="z. B. 2"
                                  suffix={einheitLabel(werte.unit)}
                                  onBlur={field.onBlur}
                                  onChange={(neu) => {
                                    const alt = field.value
                                    // Wird das Gebinde gerade größer als 1, merken wir uns den
                                    // Preis, der bis eben galt — er war mutmaßlich je Einheit.
                                    if ((alt == null || alt <= 1) && neu != null && neu > 1) {
                                      setReferenzPreis(form.getValues('price'))
                                    } else if (neu == null || neu <= 1) {
                                      setReferenzPreis(null)
                                    }
                                    // null durchreichen, nie undefined — sonst holt
                                    // react-hook-form den Ausgangswert zurück.
                                    field.onChange(neu)
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={form.control}
                        name="price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{preisFeldLabel(werte.unit, werte.unitSize)} *</FormLabel>
                            <FormControl>
                              <DezimalFeld
                                name={field.name}
                                value={field.value}
                                placeholder="0,00"
                                praefix="€"
                                stellen={2}
                                onBlur={field.onBlur}
                                onChange={(neu) => field.onChange(neu ?? Number.NaN)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Live-Vorschau: was Kundinnen aus Preis und Gebinde lesen werden */}
                      {preisVorschau && (
                        <p className="text-xs text-muted-foreground -mt-1" aria-live="polite">
                          {preisVorschau}
                        </p>
                      )}
                      {preisFraglich && (
                        <div
                          className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-800 dark:text-amber-200"
                          aria-live="polite"
                        >
                          <p className="font-medium">{PAKETPREIS_FRAGE}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setReferenzPreis(null)}
                              className="min-h-9 rounded-full border border-current px-3 text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-900/40"
                            >
                              {preisAntworten.ja}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                form.setValue('price', preisAntworten.paketpreis, { shouldDirty: true })
                                setReferenzPreis(null)
                              }}
                              className="min-h-9 rounded-full border border-current px-3 text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-900/40"
                            >
                              {preisAntworten.nein}
                            </button>
                          </div>
                        </div>
                      )}

                      <FormField
                        control={form.control}
                        name="stock"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-baseline justify-between gap-2">
                              <FormLabel>{bestandLabel(werte.unit, werte.unitSize)}</FormLabel>
                              {bestandGesamt && (
                                <span className="text-xs text-muted-foreground">= {bestandGesamt}</span>
                              )}
                            </div>
                            <FormControl>
                              <Input
                                type="number"
                                inputMode="numeric"
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
                          <FormItem data-feld="isAvailable">
                            <SchalterZeile
                              id="im-shop-verfuegbar"
                              titel="Im Shop verfügbar"
                              untertitel={field.value ? 'Sichtbar und bestellbar' : 'Ausgeblendet im Shop'}
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
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

                      {/* Saison hinter einem Schalter: An = Von/Bis immer gesetzt, Aus = leer. */}
                      <SchalterZeile
                        id="nur-saisonal"
                        titel="Nur saisonal verfügbar"
                        untertitel="Kundinnen sehen, von wann bis wann es das Produkt gibt"
                        checked={saisonal}
                        onCheckedChange={saisonalUmschalten}
                      />

                      {saisonal && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-3">
                            <FormField
                              control={form.control}
                              name="seasonStart"
                              render={({ field }) => (
                                <FormItem data-feld="seasonStart">
                                  <FormLabel>Von</FormLabel>
                                  <Select
                                    onValueChange={(v) => field.onChange(Number(v))}
                                    value={String(field.value ?? '')}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Monat…" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
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
                                <FormItem data-feld="seasonEnd">
                                  <FormLabel>Bis</FormLabel>
                                  <Select
                                    onValueChange={(v) => field.onChange(Number(v))}
                                    value={String(field.value ?? '')}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Monat…" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
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
                        </div>
                      )}
                    </div>
                  </AccordionPanel>
                </AccordionItem>

                {/* === 3. DETAILS === */}
                <AccordionItem value="details">
                  <AccordionTrigger>{abschnittTitel('details')}</AccordionTrigger>
                  <AccordionPanel>
                    <div className="space-y-4">
                      {/* Siegel — drei Zeilen mit Erklärsatz */}
                      <FormField
                        control={form.control}
                        name="labels"
                        render={({ field }) => (
                          <FormItem data-feld="labels" tabIndex={-1} className="outline-none">
                            <FormLabel>Siegel</FormLabel>
                            <div className="space-y-1">
                              {PRODUCT_LABEL_VALUES.map((l) => {
                                const siegel = SIEGEL[l]
                                const aktiv = field.value.includes(l)
                                return (
                                  <label
                                    key={l}
                                    className="flex min-h-11 items-start gap-3 p-2.5 rounded-lg hover:bg-muted/30 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={aktiv}
                                      onChange={(e) =>
                                        field.onChange(
                                          e.target.checked
                                            ? [...field.value, l]
                                            : field.value.filter((x) => x !== l)
                                        )
                                      }
                                      className="mt-0.5 w-4 h-4 rounded accent-primary"
                                    />
                                    <span className="flex flex-col gap-0.5">
                                      <span className="flex items-center gap-1.5 text-sm text-foreground">
                                        {siegel.hatIcon && (
                                          <Leaf className="w-4 h-4 text-green-600 dark:text-green-400" />
                                        )}
                                        {siegel.name}
                                      </span>
                                      <span className="text-xs text-muted-foreground">{siegel.erklaerung}</span>
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Allergene */}
                      <FormField
                        control={form.control}
                        name="allergens"
                        render={({ field }) => (
                          <FormItem data-feld="allergens">
                            <FormLabel>Allergene (EU 14)</FormLabel>
                            <div className="flex flex-wrap gap-1.5">
                              {ALLERGENS.map(({ id, label }) => {
                                const active = field.value.includes(id)
                                return (
                                  <button
                                    key={id}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => toggleAllergen(id)}
                                    className={`min-h-9 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                                      active
                                        ? 'bg-amber-100 dark:bg-amber-950/50 border-amber-400 text-amber-800 dark:text-amber-200'
                                        : 'bg-card border-border text-muted-foreground hover:border-border'
                                    }`}
                                  >
                                    {label}
                                  </button>
                                )
                              })}
                            </div>
                          </FormItem>
                        )}
                      />

                      {/* Lagerung */}
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">Lagerung</p>
                        {(
                          [
                            { name: 'requiresCool', label: 'Kühlung nötig (+2–8 °C)', icon: <Thermometer className="w-4 h-4 text-blue-500" /> },
                            { name: 'requiresFreezer', label: 'Tiefkühlung nötig (−18 °C)', icon: <Snowflake className="w-4 h-4 text-sky-500" /> },
                          ] as const
                        ).map(({ name, label, icon }) => (
                          <FormField
                            key={name}
                            control={form.control}
                            name={name}
                            render={({ field }) => (
                              <label className="flex min-h-11 items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 cursor-pointer">
                                <input
                                  type="checkbox"
                                  name={field.name}
                                  checked={field.value}
                                  onChange={(e) => field.onChange(e.target.checked)}
                                  className="w-4 h-4 rounded accent-primary"
                                />
                                {icon}
                                <span className="text-sm text-foreground">{label}</span>
                              </label>
                            )}
                          />
                        ))}
                      </div>

                      <FormField
                        control={form.control}
                        name="countsTowardLimit"
                        render={({ field }) => (
                          <div>
                            <label className="flex min-h-11 items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 cursor-pointer">
                              <input
                                type="checkbox"
                                name={field.name}
                                checked={field.value}
                                onChange={(e) => field.onChange(e.target.checked)}
                                className="w-4 h-4 rounded accent-primary"
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

                      {/* MwSt: kein täglicher Handgriff, deshalb hier statt beim Preis */}
                      <FormField
                        control={form.control}
                        name="vatRate"
                        render={({ field }) => (
                          <FormItem className="max-w-[12rem]">
                            <FormLabel>MwSt.</FormLabel>
                            <FormControl>
                              <DezimalFeld
                                name={field.name}
                                value={field.value}
                                placeholder={String(mwstStandard)}
                                suffix="%"
                                onBlur={field.onBlur}
                                onChange={(neu) => field.onChange(neu ?? mwstStandard)}
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              Standard für diese Kategorie: {formatZahl(mwstStandard)} %
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </AccordionPanel>
                </AccordionItem>

                {/* === 4. KENNZEICHNUNG — nur bei Futtermitteln === */}
                {istFuttermittel && (
                  <AccordionItem value="kennzeichnung">
                    <AccordionTrigger>{abschnittTitel('kennzeichnung', true)}</AccordionTrigger>
                    <AccordionPanel>
                      <div className="space-y-4">
                        <p className="text-xs text-muted-foreground">
                          Alle Angaben findest du auf dem Sackanhänger oder Lieferschein deines Futters.
                        </p>

                        <FormField
                          control={form.control}
                          name="futter.zielTierarten"
                          render={({ field }) => (
                            <FormItem data-feld="futter.zielTierarten" tabIndex={-1} className="outline-none">
                              <FormLabel>Für welche Tiere? *</FormLabel>
                              <div className="flex flex-wrap gap-2" role="group" aria-label="Tierarten">
                                {TIERART_VALUES.map((t) => {
                                  const aktiv = (field.value ?? []).includes(t)
                                  return (
                                    <button
                                      key={t}
                                      type="button"
                                      aria-pressed={aktiv}
                                      onClick={() =>
                                        field.onChange(
                                          aktiv
                                            ? (field.value ?? []).filter((x) => x !== t)
                                            : [...(field.value ?? []), t]
                                        )
                                      }
                                      className={chipKlasse(aktiv)}
                                    >
                                      {TIERART_LABEL[t]}
                                    </button>
                                  )
                                })}
                              </div>
                              <FormDescription className="text-xs">
                                Steht als „Alleinfuttermittel für …" oder „Ergänzungsfuttermittel für …" auf dem Anhänger.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="futter.zusammensetzung"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Zusammensetzung *</FormLabel>
                              <FormControl>
                                <Textarea
                                  rows={3}
                                  placeholder="z. B. Heu vom ersten Schnitt, Wiesenmischung"
                                  {...field}
                                  value={field.value ?? ''}
                                />
                              </FormControl>
                              <FormDescription className="text-xs">
                                Steht auf dem Sackanhänger. Bei Mischfutter die Einzelfuttermittel in absteigender Reihenfolge.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="futter.analytischeBestandteile"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Analytische Bestandteile *</FormLabel>
                              <FormControl>
                                <Textarea
                                  rows={3}
                                  placeholder="z. B. Rohprotein 9 %, Rohfaser 28 %, Rohasche 7 %"
                                  {...field}
                                  value={field.value ?? ''}
                                />
                              </FormControl>
                              <FormDescription className="text-xs">
                                Steht auf dem Sackanhänger unter „Analytische Bestandteile" (Rohprotein, Rohfaser, Rohfett, Rohasche …).
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="futter.zusatzstoffe"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Zusatzstoffe</FormLabel>
                              <FormControl>
                                <Textarea
                                  rows={2}
                                  placeholder="z. B. Vitamin A 8.000 IE/kg, Selen 0,3 mg/kg"
                                  {...field}
                                  value={field.value ?? ''}
                                />
                              </FormControl>
                              <FormDescription className="text-xs">
                                Nur wenn auf dem Anhänger welche stehen — bei reinem Heu bleibt das leer.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="futter.registrierungsnummer"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Registrierungsnummer</FormLabel>
                              <FormControl>
                                <Input placeholder="z. B. AT 1234567" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormDescription className="text-xs">
                                BAES-Registrierung, oder deine LFBIS-Nummer, wenn du nur selbst erzeugtes Futter verkaufst.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="futter.gebrauchshinweis"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Gebrauchshinweis</FormLabel>
                              <FormControl>
                                <Textarea
                                  rows={2}
                                  placeholder="z. B. Trocken lagern, täglich 1–2 kg je Tier"
                                  {...field}
                                  value={field.value ?? ''}
                                />
                              </FormControl>
                              <FormDescription className="text-xs">
                                Fütterungsempfehlung oder Lagerhinweis vom Anhänger, falls vorhanden.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="futter.bestaetigt"
                          render={({ field }) => (
                            <FormItem data-feld="futter.bestaetigt">
                              <label className="flex min-h-11 items-start gap-3 rounded-lg border border-border p-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  name={field.name}
                                  checked={field.value ?? false}
                                  onChange={(e) => field.onChange(e.target.checked)}
                                  className="mt-0.5 w-4 h-4 rounded accent-primary"
                                />
                                <span className="text-sm text-foreground">
                                  Die Angaben entsprechen dem Sackanhänger bzw. Lieferschein. Ich bin für die Richtigkeit verantwortlich.
                                </span>
                              </label>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </AccordionPanel>
                  </AccordionItem>
                )}
              </Accordion>
            </div>

            {/* Fuß: fest am unteren Rand als eigene Flex-Zone — kein sticky, keine
                negativen Ränder (die von DialogFooter ragten bei p-0 über die
                Kante). Hintergrund card, feine Linie oben, Safe-Area-Abstand. */}
            <div className="flex shrink-0 flex-row justify-end gap-2 border-t border-border bg-card px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSubmitting} className="min-w-[100px]">
                {isSubmitting
                  ? uploadFortschritt
                    ? stufenText(uploadFortschritt)
                    : 'Speichere…'
                  : isEdit
                    ? 'Speichern'
                    : 'Anlegen'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    {/* Rückfrage: Kategoriewechsel weg von Futtermittel löscht die Kennzeichnung */}
    <Dialog open={kategorieWechsel !== null} onOpenChange={(o) => !o && setKategorieWechsel(null)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Kennzeichnung löschen?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Wenn das Produkt kein Futtermittel mehr ist, wird die Kennzeichnung beim Speichern
          gelöscht. Die Angaben musst du dann neu eintippen, falls du sie wieder brauchst.
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setKategorieWechsel(null)}>
            Abbrechen
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (kategorieWechsel) kategorieSetzen(kategorieWechsel.neu)
              setKategorieWechsel(null)
            }}
          >
            Kategorie wechseln
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
