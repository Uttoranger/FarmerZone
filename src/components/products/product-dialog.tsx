'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useForm, type FieldErrors, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Camera, X, Leaf, Thermometer, Snowflake, ChevronRight, Info, Sparkles } from 'lucide-react'
import { ladeFotoHoch, stufenText, type UploadStufe } from '@/components/shared/image-upload'
import { useFotoQuellen } from '@/components/shared/foto-quellen'
import type { UploadDiagnose } from '@/lib/upload-diagnose'
import { bildFehlerMeldung } from '@/lib/upload-fehler'
import { IM_SHOP, NICHT_IM_SHOP } from '@/lib/produkt-sichtbarkeit'
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
import { createProduct, updateProduct, pruefeDualUse } from '@/server/actions/products'
import type { ProductData } from '@/server/queries/products'
import {
  productFormSchema,
  productAnlegenSchema,
  type ProductFormData,
  type FutterKennzeichnungFormData,
  ALLERGENS,
  MONTH_OPTIONS,
  UNIT_OPTIONS,
  unitOptionsFuer,
  seasonLabel,
} from '@/schemas/product'
import {
  hatUnterkategorien,
  PRODUCT_LABEL_VALUES,
  SIEGEL,
  TIERART_VALUES,
  TIERART_LABEL,
  FUTTERMITTELART_LABEL,
  FUTTERMITTELART_ERKLAERUNG,
  NETTO_EINHEIT_VALUES,
  NETTO_EINHEIT_LABEL,
  betriebsnummerFuerAnzeige,
  kategorieVorschlag,
  futtermittelartenFuer,
  futtermittelartSatz,
  grossgebindeEinheitenAngeboten,
  istFuttermittel,
  istGrossgebindeEinheit,
  type FuttermittelartValue,
  type ProductCategoryValue,
  type ProductSubcategoryValue,
} from '@/lib/taxonomie'
import { mwstStandard } from '@/lib/mwst'
import { DUAL_USE_MIN_ZEICHEN, DUAL_USE_VERZOEGERUNG_MS } from '@/lib/dual-use'
import {
  formatKategorie,
  formatGrundpreis,
  formatNettoBestand,
  formatZahl,
  mitAnzahl,
  einheitLabel,
  bestandLabel,
  formatBestand,
} from '@/lib/format'
import { KategorieSheet } from './kategorie-sheet'
import { cn } from '@/lib/utils'
import {
  gewichtFrage,
  inhaltZeile,
  kundenVorschau,
  nettoAutomatisch,
  nettoNachEinheitswechsel,
  paketpreisFraglich,
  paketpreisAntworten,
  PAKETPREIS_FRAGE,
  preisFeldLabel,
  vergleichsKilopreis,
} from './produkt-preis'
import {
  ABSCHNITT_TITEL,
  abschnitteMitFehlern,
  auswahlLabel,
  erstesFehlerfeld,
  fehlendeAngaben,
  saisonVorbelegung,
  speichernText,
  zusammensetzungVorbelegung,
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
  /** Betriebsnummer aus den Hof-Einstellungen — nur Anzeige in der Kennzeichnung (F6). */
  hofBetriebsnummer: string | null
}

/** Eine leere Kennzeichnung — sobald eine Futter-Kategorie gewählt ist. */
const FUTTER_LEER: FutterKennzeichnungFormData = {
  futtermittelart: null,
  zielTierarten: [],
  zusammensetzung: '',
  analytischeBestandteile: '',
  // NaN statt 0, wie beim Preis: Das Feld startet leer, und die Prüfung meldet
  // den Sackanhänger-Satz statt „größer als 0" für eine Null, die niemand tippte.
  nettoMenge: Number.NaN,
  nettoEinheit: 'KG',
  rohprotein: null,
  rohfaser: null,
  rohfett: null,
  rohasche: null,
  zusatzstoffe: '',
  gebrauchshinweis: '',
  bestaetigt: false,
}

/**
 * Die Futtermittelart, die zu einer Kategorie passt: bleibt, wenn sie erlaubt
 * ist; bei genau einem erlaubten Wert ist er gesetzt; sonst leer — dann wählt
 * der Hof (Ergänzungsfutter).
 */
function passendeFuttermittelart(
  category: ProductCategoryValue | null,
  bisher: FuttermittelartValue | null
): FuttermittelartValue | null {
  const erlaubt = futtermittelartenFuer(category)
  if (bisher && erlaubt.includes(bisher)) return bisher
  return erlaubt.length === 1 ? erlaubt[0] : null
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
  abgabe: 'ALLE',
  countsTowardLimit: true,
  // NaN statt 0: Das Preisfeld startet leer, und die Prüfung meldet „Bitte gib
  // einen Preis ein" statt „größer als 0" für eine Null, die niemand getippt hat.
  price: Number.NaN,
  vatRate: mwstStandard(null),
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
          futtermittelart: p.futter.futtermittelart,
          zielTierarten: p.futter.zielTierarten,
          zusammensetzung: p.futter.zusammensetzung,
          analytischeBestandteile: p.futter.analytischeBestandteile,
          nettoMenge: p.futter.nettoMenge,
          nettoEinheit: p.futter.nettoEinheit,
          rohprotein: p.futter.rohprotein,
          rohfaser: p.futter.rohfaser,
          rohfett: p.futter.rohfett,
          rohasche: p.futter.rohasche,
          zusatzstoffe: p.futter.zusatzstoffe ?? '',
          gebrauchshinweis: p.futter.gebrauchshinweis ?? '',
          bestaetigt: true,
        }
      : null,
    abgabe: p.abgabe,
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
      // Der MwSt-Satz steht nur da, wenn er vom Standard der Kategorie abweicht.
      if (Number.isFinite(w.vatRate) && w.vatRate !== mwstStandard(w.category)) {
        teile.push(`MwSt ${formatZahl(w.vatRate)} %`)
      }
      return teile.join(' · ')
    }
    case 'kennzeichnung': {
      const tiere = w.futter?.zielTierarten ?? []
      if (tiere.length === 0) return 'Noch nicht ausgefüllt'
      const teile = [`Für ${tiere.map((t) => TIERART_LABEL[t]).join(', ')}`]
      if (w.abgabe === 'NUR_BETRIEBE') teile.push('nur an Betriebe')
      return teile.join(' · ')
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

export function ProductDialog({ open, product, onClose, hofBetriebsnummer }: Props) {
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
  // Kategoriewechsel weg von den Futtermitteln wartet auf Bestätigung — die
  // Kennzeichnung würde beim Speichern gelöscht.
  const [kategorieWechsel, setKategorieWechsel] = useState<{
    neu: ProductCategoryValue | null
    sorte: ProductSubcategoryValue | null
  } | null>(null)
  const [kategorieSheetOffen, setKategorieSheetOffen] = useState(false)
  // Dual-Use-Hinweis unter dem Namen (Konzept 6.1) — ein Hinweis, kein Fehler.
  const [dualUseHinweis, setDualUseHinweis] = useState<string | null>(null)
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

  // Anlegen ist strenger als Bearbeiten (Kategorie Pflicht, Futter ohne
  // Gebindegröße). Der Dialog bleibt zwischen Anlegen und Bearbeiten
  // derselbe — der Resolver liest das passende Schema deshalb erst beim Prüfen.
  const schema = isEdit ? productFormSchema : productAnlegenSchema
  const schemaRef = useRef(schema)
  useEffect(() => {
    schemaRef.current = schema
  }, [schema])
  const form = useForm<ProductFormData>({
    // Beide Schemas liefern denselben Datentyp (ProductFormData) — der Cast
    // gleicht nur ab, dass TypeScript die Eingabetypen der Pipes nicht vereint.
    resolver: ((werte, kontext, optionen) =>
      (zodResolver(schemaRef.current as typeof productFormSchema) as Resolver<ProductFormData>)(
        werte,
        kontext,
        optionen
      )) as Resolver<ProductFormData>,
    defaultValues: isEdit ? toFormDefaults(product) : EMPTY_DEFAULTS,
  })

  const werte = form.watch()
  const category = werte.category
  const isAvailable = werte.isAvailable
  const watchedSeasonStart = werte.seasonStart
  const watchedSeasonEnd = werte.seasonEnd
  // Der Bereich entscheidet, nicht der Vergleich mit einer Kategorie (ARCHITECTURE.md §5).
  const futterBereich = istFuttermittel(category)
  const grossgebinde = istGrossgebindeEinheit(werte.unit)
  const fehlerhafteAbschnitte = abschnitteMitFehlern(form.formState.errors)
  const preisVorschau = kundenVorschau(werte.price, werte.unit, werte.unitSize)
  const preisFraglich = paketpreisFraglich({
    price: werte.price,
    unitSize: werte.unitSize,
    referenzPreis,
  })
  const preisAntworten = paketpreisAntworten(werte.price, werte.unit, werte.unitSize)
  // Futtermittel: Das Gewicht je Gebinde wird direkt unter der Einheit
  // gefragt (Ballen, Big Bag, Paket, Stück); bei kg und Liter steht es fest.
  const gewichtGefragt = futterBereich ? gewichtFrage(werte.unit) : null
  // Altfall (Rückfrage F1): ein Futtermittel, das noch eine Gebindegröße trägt.
  // Es bleibt speicherbar; das Formular zeigt das Feld mit einem Hinweis.
  const altesGebinde = futterBereich && werte.unitSize != null
  // Bestand × Gewicht je Gebinde, wo gefragt; sonst wie bisher aus der Gebindegröße.
  const bestandGesamt =
    gewichtGefragt && !altesGebinde
      ? formatNettoBestand(werte.stock, werte.futter?.nettoMenge, werte.futter?.nettoEinheit ?? 'KG')
      : grossgebinde
        ? null
        : formatBestand(werte.stock, werte.unit, werte.unitSize)
  const mwstVorschlag = mwstStandard(category)
  const kilopreisVergleich =
    werte.futter && !altesGebinde
      ? vergleichsKilopreis(werte.price, werte.unit, werte.futter.nettoMenge, werte.futter.nettoEinheit)
      : null
  // Nur ein Vorschlag, nie eine Wahl — und nur, solange keine Kategorie gewählt ist.
  const vorschlag = category == null ? kategorieVorschlag(werte.name) : null
  const fehlend = fehlendeAngaben(werte, schema)
  const erlaubteArten = futtermittelartenFuer(category)
  const betriebsnummer = betriebsnummerFuerAnzeige(
    { betriebsnummer: hofBetriebsnummer },
    isEdit ? product.futter : null
  )

  // Reset form when dialog opens/switches product
  useEffect(() => {
    if (open) {
      form.reset(isEdit ? toFormDefaults(product) : EMPTY_DEFAULTS)
      setSelectedFile(null)
      setPreviewUrl(isEdit ? (product.imageUrl ?? null) : null)
      setOffen(isEdit ? [] : ['grunddaten'])
      setKategorieWechsel(null)
      setKategorieSheetOffen(false)
      setDualUseHinweis(null)
      setReferenzPreis(null)
      // Beim Bearbeiten stehen die Schalter so, wie das Produkt gespeichert ist.
      setFestePakete(isEdit && product.unitSize != null)
      setSaisonal(isEdit && product.seasonStart != null && product.seasonEnd != null)
    }
  }, [open, product?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Dual-Use-Hinweis: erst fragen, wenn der Hof kurz aufgehört hat zu tippen —
  // keine Abfrage je Tastendruck. Eine überholte Antwort wird verworfen.
  const dualUseAnfrage = useRef(0)
  const produktId = isEdit ? product.id : undefined
  useEffect(() => {
    if (!open) return
    const nummer = ++dualUseAnfrage.current
    // Ohne Kategorie oder mit zu kurzem Namen kann es keinen Hinweis geben —
    // dann gar nicht erst fragen.
    if (category == null || werte.name.trim().length < DUAL_USE_MIN_ZEICHEN) {
      setDualUseHinweis(null)
      return
    }
    const zeitgeber = window.setTimeout(async () => {
      try {
        const ergebnis = await pruefeDualUse({ name: werte.name, category, productId: produktId })
        if (nummer !== dualUseAnfrage.current) return
        setDualUseHinweis('hinweis' in ergebnis ? ergebnis.hinweis : null)
      } catch {
        // Nur ein Hinweis: Scheitert die Abfrage, fehlt er eben — kein Fehler für den Hof.
        if (nummer === dualUseAnfrage.current) setDualUseHinweis(null)
      }
    }, DUAL_USE_VERZOEGERUNG_MS)
    return () => window.clearTimeout(zeitgeber)
  }, [open, werte.name, category, produktId])

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
   * Einheit wechseln: Ballen und Big Bags haben keine Gebindegröße (P12). Bei
   * Futtermitteln folgt das Gewicht je Gebinde der Einheit (kg → 1 kg).
   */
  function einheitSetzen(unit: ProductFormData['unit']) {
    const alt = form.getValues('unit')
    form.setValue('unit', unit, { shouldDirty: true })
    if (istGrossgebindeEinheit(unit)) festePaketeUmschalten(false)
    const futter = form.getValues('futter')
    if (futter != null) {
      const netto = nettoNachEinheitswechsel(futter, alt, unit)
      form.setValue('futter.nettoMenge', netto.nettoMenge, { shouldDirty: true })
      form.setValue('futter.nettoEinheit', netto.nettoEinheit, { shouldDirty: true })
      if (nettoAutomatisch(unit)) form.clearErrors('futter.nettoMenge')
    }
  }

  /**
   * Die Wahl aus dem Kategorie-Sheet übernehmen. Weg aus den Futtermitteln mit
   * vorhandener Kennzeichnung: erst fragen — sie würde beim Speichern gelöscht.
   */
  function kategorieUebernehmen(neu: ProductCategoryValue | null, sorte: ProductSubcategoryValue | null) {
    setKategorieSheetOffen(false)
    const alt = form.getValues('category')
    if (neu === alt && sorte === form.getValues('subcategory')) return
    if (istFuttermittel(alt) && !istFuttermittel(neu) && form.getValues('futter') != null) {
      setKategorieWechsel({ neu, sorte })
      return
    }
    kategorieSetzen(neu, sorte)
  }

  function kategorieSetzen(neu: ProductCategoryValue | null, sorte: ProductSubcategoryValue | null) {
    const alt = form.getValues('category')
    const alteSorte = form.getValues('subcategory')
    form.setValue('category', neu, { shouldDirty: true })
    form.setValue('subcategory', sorte, { shouldDirty: true })
    form.clearErrors(['category', 'subcategory'])

    // MwSt: Stand noch der Vorschlag der alten Kategorie da, gilt jetzt der
    // der neuen. Einen selbst getippten Satz fasst der Wechsel nicht an.
    if (form.getValues('vatRate') === mwstStandard(alt)) {
      form.setValue('vatRate', mwstStandard(neu), { shouldDirty: true })
    }
    // Ballen und Big Bags gibt es bei Lebensmitteln nicht (F7).
    if (!grossgebindeEinheitenAngeboten(neu) && istGrossgebindeEinheit(form.getValues('unit'))) {
      einheitSetzen('STUECK')
    }

    if (istFuttermittel(neu)) {
      // Futtermittel gibt es nicht in g, ml oder m³ (Rückfrage F2).
      if (!unitOptionsFuer(neu).some((u) => u.value === form.getValues('unit'))) {
        form.setValue('unit', 'KG', { shouldDirty: true })
      }
      const bisher = form.getValues('futter')
      if (bisher == null) {
        // Neu im Bereich Futtermittel: Das Gewicht übernimmt die Rolle der
        // Gebindegröße — die festen Pakete entfallen.
        festePaketeUmschalten(false)
      }
      const futter = bisher ?? { ...FUTTER_LEER, ...nettoAutomatisch(form.getValues('unit')) }
      form.setValue(
        'futter',
        {
          ...futter,
          futtermittelart: passendeFuttermittelart(neu, futter.futtermittelart),
          zusammensetzung: zusammensetzungVorbelegung(futter.zusammensetzung, alteSorte, sorte),
        },
        { shouldDirty: true }
      )
      // Beim Anlegen eines Futtermittels ist die Kennzeichnung Pflicht — gleich zeigen.
      abschnittOeffnen('kennzeichnung')
    } else {
      form.setValue('futter', null, { shouldDirty: true })
      form.setValue('abgabe', 'ALLE', { shouldDirty: true })
      form.clearErrors(['futter', 'abgabe'])
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
        let diagnose: UploadDiagnose | undefined
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
            onDiagnose: (d) => {
              diagnose = d
            },
          })
        } catch (e) {
          // Zusätzlich zur Anzeige nach Sentry (Ursache/Kennung/Größe/Typ/
          // Weg/Versuche/Originalfehler, kein Dateiname — upload-meldung.ts).
          meldeUploadFehler(e, {
            datei: selectedFile,
            weg: gewaehlterWeg.current,
            versuche,
            diagnose,
          })
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
                      {/* Foto zuerst (Vorbild Depop, Shopify, Nextdoor): der schnellste
                          Einstieg, aber freiwillig — ohne Foto zeigt die Hofseite die
                          Illustration der Kategorie. Hochgeladen wird unverändert erst
                          beim Absenden. */}
                      <div data-feld="imageUrl">
                        {fotoQuellen.elemente}
                        {previewUrl ? (
                          <div className="relative overflow-hidden rounded-xl border border-border bg-muted/30">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={previewUrl}
                              alt="Vorschau"
                              className="h-44 w-full object-cover"
                              // Ersatz für die entfallene Format-Probe: Kann der
                              // Browser das Foto nicht zeichnen (HEIC auf Android),
                              // verschwindet die Vorschau still, statt ein kaputtes
                              // Bildsymbol zu zeigen. Die Datei BLEIBT ausgewählt —
                              // ob sie taugt, entscheidet beim Absenden der Server.
                              onError={() => setPreviewUrl(null)}
                            />
                            {/* Weiß auf dunklem Schleier über dem Foto — folgt dem Modus
                                bewusst nicht (CODING_STANDARDS §7). */}
                            <button
                              type="button"
                              onClick={handleRemoveImage}
                              aria-label="Foto entfernen"
                              className="absolute top-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white"
                            >
                              <X className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={fotoQuellen.oeffnen}
                              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'absolute right-2 bottom-2 bg-card')}
                            >
                              Foto ersetzen
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={fotoQuellen.oeffnen}
                            className="flex min-h-[120px] w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-5 text-center transition-colors hover:bg-muted/50"
                          >
                            <Camera className="h-7 w-7 text-brand-text" aria-hidden />
                            <span className="text-sm font-medium text-foreground">
                              {selectedFile ? 'Foto ausgewählt — tippen zum Ersetzen' : 'Foto hinzufügen'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Freiwillig — ohne Foto zeigen wir ein Bild zur Kategorie.
                            </span>
                          </button>
                        )}
                      </div>

                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Was verkaufst du? *</FormLabel>
                            <FormControl>
                              <Input placeholder="z. B. Lammfleisch oder Wiesenheu" {...field} />
                            </FormControl>
                            <FormMessage />
                            {/* Vorschlag aus dem Namen (Vorbild Shopee „Recommend
                                Category"): nur ein Angebot — übernommen wird erst mit
                                einem Tipp, ohne Tipp passiert nichts. */}
                            {vorschlag && (
                              <button
                                type="button"
                                onClick={() => kategorieUebernehmen(vorschlag.category, vorschlag.subcategory)}
                                className="flex min-h-11 w-full items-center gap-2 rounded-full border border-dashed border-primary/60 bg-primary/5 px-3 text-left text-sm text-foreground transition-colors hover:bg-primary/10"
                              >
                                <Sparkles className="h-4 w-4 shrink-0 text-brand-text" aria-hidden />
                                <span className="min-w-0">
                                  Passt das?{' '}
                                  <span className="font-medium">
                                    {formatKategorie(vorschlag.category, vorschlag.subcategory)}
                                  </span>
                                </span>
                              </button>
                            )}
                            {/* Hinweis, kein Fehler, keine Sperre (Konzept 6.1). */}
                            {dualUseHinweis && (
                              <p
                                className="flex items-start gap-2 rounded-lg border border-notice-line bg-notice p-2.5 text-xs text-notice-ink"
                                aria-live="polite"
                              >
                                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-notice-icon" aria-hidden />
                                {dualUseHinweis}
                              </p>
                            )}
                          </FormItem>
                        )}
                      />

                      {/* Kategorie und Sorte in EINEM Sheet: Bereich → Kategorie → Sorte.
                          Hier steht nur die Wahl und ihre Fehlermeldungen. Beim Anlegen
                          Pflicht — ohne Kategorie landet das Produkt im Bereich Sonstiges,
                          zwischen den Lebensmitteln. */}
                      <FormField
                        control={form.control}
                        name="category"
                        render={() => (
                          <FormItem data-feld="category">
                            <FormLabel>Kategorie{(!isEdit || futterBereich) && ' *'}</FormLabel>
                            <button
                              type="button"
                              data-feld="subcategory"
                              onClick={() => setKategorieSheetOffen(true)}
                              className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-left text-sm"
                            >
                              <span className={cn(!category && 'text-muted-foreground')}>
                                {category ? formatKategorie(category, werte.subcategory) : 'Keine Angabe'}
                              </span>
                              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                            </button>
                            <FormMessage />
                            {form.formState.errors.subcategory?.message && (
                              <p className="text-sm text-destructive">{form.formState.errors.subcategory.message}</p>
                            )}
                            {category && hatUnterkategorien(category) && !werte.subcategory && !futterBereich && (
                              <FormDescription className="text-xs">
                                Eine Unterkategorie hilft Kundinnen beim Finden — du kannst sie auch später ergänzen.
                              </FormDescription>
                            )}
                          </FormItem>
                        )}
                      />

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
                            <Select
                              onValueChange={(v) => einheitSetzen(v as ProductFormData['unit'])}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  {/* Base UI zeigt ohne Formatierer den ROHWERT („KG") —
                                      die Kinder-Funktion macht daraus das Label. */}
                                  <SelectValue placeholder="Wählen…">
                                    {(v: string | null) => auswahlLabel(UNIT_OPTIONS, v) ?? 'Wählen…'}
                                  </SelectValue>
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {unitOptionsFuer(category).map((u) => (
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

                      {/* Futtermittel: Das Gewicht je Gebinde steht direkt unter der Einheit
                          und übernimmt die Rolle der festen Pakete — es sind dieselben
                          Felder wie in der Kennzeichnung (futter.nettoMenge/-Einheit).
                          Bei kg und Liter steht es fest (1 kg / 1 L), die Frage entfällt. */}
                      {futterBereich ? (
                        gewichtGefragt && (
                          <FormField
                            control={form.control}
                            name="futter.nettoMenge"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{gewichtGefragt} *</FormLabel>
                                <div className="flex gap-2">
                                  <FormControl>
                                    <DezimalFeld
                                      name={field.name}
                                      value={field.value}
                                      placeholder="z. B. 300"
                                      onBlur={field.onBlur}
                                      onChange={(neu) => field.onChange(neu ?? Number.NaN)}
                                    />
                                  </FormControl>
                                  <FormField
                                    control={form.control}
                                    name="futter.nettoEinheit"
                                    render={({ field: einheit }) => (
                                      <div className="flex shrink-0 gap-1" role="radiogroup" aria-label="Gewicht in">
                                        {NETTO_EINHEIT_VALUES.map((e) => (
                                          <button
                                            key={e}
                                            type="button"
                                            role="radio"
                                            aria-checked={einheit.value === e}
                                            onClick={() => einheit.onChange(e)}
                                            className={cn(chipKlasse(einheit.value === e), 'px-3')}
                                          >
                                            {NETTO_EINHEIT_LABEL[e]}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  />
                                </div>
                                <FormDescription className="text-xs">
                                  Durchschnittsgewicht, wie auf dem Sackanhänger oder Lieferschein.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )
                      ) : grossgebinde ? (
                        <p className="text-xs text-muted-foreground">
                          Ballen und Big Bags verkaufst du einzeln — ohne feste Pakete.
                        </p>
                      ) : (
                        /* Gebinde hinter einem Schalter: Aus = Kunden bestellen einzeln
                           (unitSize leer), An = feste Pakete mit Größe. */
                        <SchalterZeile
                          id="feste-pakete"
                          titel="Ich verkaufe in festen Paketen"
                          untertitel="z. B. ein 2-kg-Paket oder eine 0,5-L-Flasche"
                          checked={festePakete}
                          onCheckedChange={festePaketeUmschalten}
                        />
                      )}

                      {/* Bei Futtermitteln nur noch der Altfall (Rückfrage F1): Das Feld
                          bleibt, damit das Produkt ohne Umbau speicherbar ist. */}
                      {((festePakete && !futterBereich) || altesGebinde) && !grossgebinde && (
                        <FormField
                          control={form.control}
                          name="unitSize"
                          render={({ field }) => (
                            <FormItem>
                              {altesGebinde && (
                                <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                                  Dieses Produkt nutzt noch die alte Gebindegröße. Verkaufst du einzelne Ballen
                                  oder Pakete aus mehreren? Stell bitte die Einheit um — dann stimmt der Kilopreis.
                                </p>
                              )}
                              <FormLabel>Gebindegröße{!altesGebinde && ' *'}</FormLabel>
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
                      {/* Nur für den Hof: Kunden sehen den Kilopreis eines
                          Futtermittels erst mit Bereiche 2 — deshalb nicht „Kunden sehen". */}
                      {kilopreisVergleich && (
                        <p className="text-xs text-foreground" aria-live="polite">
                          {kilopreisVergleich}
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
                              titel={IM_SHOP}
                              untertitel={field.value ? 'Sichtbar und bestellbar' : NICHT_IM_SHOP}
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
                                        <SelectValue placeholder="Monat…">
                                          {(v: string | null) => auswahlLabel(MONTH_OPTIONS, v) ?? 'Monat…'}
                                        </SelectValue>
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
                                        <SelectValue placeholder="Monat…">
                                          {(v: string | null) => auswahlLabel(MONTH_OPTIONS, v) ?? 'Monat…'}
                                        </SelectValue>
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
                                placeholder={String(mwstVorschlag)}
                                suffix="%"
                                onBlur={field.onBlur}
                                onChange={(neu) => field.onChange(neu ?? mwstVorschlag)}
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              Standard für diese Kategorie: {formatZahl(mwstVorschlag)} %
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </AccordionPanel>
                </AccordionItem>

                {/* === 4. KENNZEICHNUNG — nur bei Futtermitteln === */}
                {futterBereich && (
                  <AccordionItem value="kennzeichnung">
                    <AccordionTrigger>{abschnittTitel('kennzeichnung', true)}</AccordionTrigger>
                    <AccordionPanel>
                      <div className="space-y-4">
                        <p className="text-xs text-muted-foreground">
                          Alle Angaben findest du auf dem Sackanhänger oder Lieferschein deines Futters.
                        </p>

                        {/* Futtermittelart: nur die nach Tabelle 2.4 erlaubten Werte. Bei
                            genau einem steht er schon fest — und das Feld sagt, warum. */}
                        <FormField
                          control={form.control}
                          name="futter.futtermittelart"
                          render={({ field }) => (
                            <FormItem data-feld="futter.futtermittelart" tabIndex={-1} className="outline-none">
                              <FormLabel>Futtermittelart *</FormLabel>
                              {erlaubteArten.length === 1 ? (
                                <div className="rounded-lg border border-border bg-muted/30 p-3">
                                  <p className="text-sm font-medium text-foreground">
                                    {FUTTERMITTELART_LABEL[erlaubteArten[0]]}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{futtermittelartSatz(category)}</p>
                                </div>
                              ) : (
                                <>
                                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Futtermittelart">
                                    {erlaubteArten.map((art) => {
                                      const aktiv = field.value === art
                                      return (
                                        <button
                                          key={art}
                                          type="button"
                                          role="radio"
                                          aria-checked={aktiv}
                                          onClick={() => field.onChange(art)}
                                          className={chipKlasse(aktiv)}
                                        >
                                          {FUTTERMITTELART_LABEL[art]}
                                        </button>
                                      )
                                    })}
                                  </div>
                                  <FormDescription className="text-xs">
                                    {field.value
                                      ? FUTTERMITTELART_ERKLAERUNG[field.value]
                                      : 'Steht auf dem Sackanhänger, meist direkt über der Zusammensetzung.'}
                                  </FormDescription>
                                </>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Die Nettomenge gehört zur Kennzeichnung, wird aber beim Preis
                            eingegeben — dort denkt der Hof über das Gebinde nach. */}
                        <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground">
                          {inhaltZeile(werte.futter?.nettoMenge, werte.futter?.nettoEinheit ?? 'KG')}
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

                        {/* Rohwerte optional, als Zahl — für späteren Vergleich. Die
                            Pflichtangabe bleibt der Freitext darüber. */}
                        <div className="space-y-1.5">
                          <p className="text-sm font-medium text-foreground">Rohwerte in % (freiwillig)</p>
                          <div className="grid grid-cols-2 gap-3">
                            {(
                              [
                                ['futter.rohprotein', 'Rohprotein'],
                                ['futter.rohfaser', 'Rohfaser'],
                                ['futter.rohfett', 'Rohfett'],
                                ['futter.rohasche', 'Rohasche'],
                              ] as const
                            ).map(([name, label]) => (
                              <FormField
                                key={name}
                                control={form.control}
                                name={name}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs font-normal">{label}</FormLabel>
                                    <FormControl>
                                      <DezimalFeld
                                        name={field.name}
                                        value={field.value}
                                        suffix="%"
                                        onBlur={field.onBlur}
                                        onChange={(neu) => field.onChange(neu)}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Dieselben Zahlen wie oben, nur einzeln. Die Pflichtangabe bleibt der Text darüber.
                          </p>
                        </div>

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

                        {/* Die Nummer gehört dem Hof, nicht dem Produkt (Rückfrage F6):
                            hier nur Anzeige, geändert wird sie in den Hof-Einstellungen. */}
                        <div className="rounded-lg border border-border p-3">
                          <p className="text-sm font-medium text-foreground">Betriebsnummer</p>
                          <p className="text-sm text-foreground">
                            {betriebsnummer ?? (
                              <span className="text-muted-foreground">Noch keine hinterlegt.</span>
                            )}
                          </p>
                          <Link
                            href="/settings/profile"
                            className="mt-1 inline-flex min-h-9 items-center text-xs font-medium text-brand-text underline underline-offset-2"
                          >
                            In den Hof-Einstellungen ändern
                          </Link>
                        </div>

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
                          name="abgabe"
                          render={({ field }) => (
                            <FormItem data-feld="abgabe">
                              <SchalterZeile
                                id="nur-betriebe"
                                titel="Nur an landwirtschaftliche Betriebe"
                                untertitel="Wer bestellt, muss im Checkout eine Betriebsnummer angeben."
                                checked={field.value === 'NUR_BETRIEBE'}
                                onCheckedChange={(an) => field.onChange(an ? 'NUR_BETRIEBE' : 'ALLE')}
                              />
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
              {/* Fehlt noch etwas, sagt der Knopf wie viel; ein Tipp prüft trotzdem
                  und springt zum ersten fehlenden Feld (onInvalid). */}
              <Button type="submit" disabled={isSubmitting} className="min-w-[100px]">
                {isSubmitting
                  ? uploadFortschritt
                    ? stufenText(uploadFortschritt)
                    : 'Speichere…'
                  : speichernText(fehlend, isEdit)}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    <KategorieSheet
      open={kategorieSheetOffen}
      onOpenChange={setKategorieSheetOffen}
      wert={{ category, subcategory: werte.subcategory }}
      keineAngabeErlaubt={isEdit}
      onUebernehmen={({ category: neu, subcategory: sorte }) => kategorieUebernehmen(neu, sorte)}
    />

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
              if (kategorieWechsel) kategorieSetzen(kategorieWechsel.neu, kategorieWechsel.sorte)
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
