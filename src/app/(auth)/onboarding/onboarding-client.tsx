'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Plus, Trash2, Check, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createFarm,
  createOnboardingProducts,
  createOnboardingSlots,
  checkSlugAvailability,
} from '@/server/actions/onboarding'
import { generateSlug } from '@/lib/slug'

type Step = 1 | 2 | 3 | 4
type ProductRow = { name: string; price: string; unit: string; stock: string }
type SlotRow = { dayOfWeek: string; startTime: string; endTime: string }

// ─── Tiny label helpers ──────────────────────────────────────────────────────
function Req() {
  return <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>
}
function Opt() {
  return <span className="text-xs text-muted-foreground font-normal ml-1">(optional)</span>
}
function FieldErr({ id, msg }: { id: string; msg: string }) {
  return (
    <p id={id} role="alert" aria-live="polite" className="text-xs text-destructive mt-0.5">
      {msg}
    </p>
  )
}

// ─── Constants ───────────────────────────────────────────────────────────────
const UNIT_OPTIONS = [
  { value: 'STUECK', label: 'Stück' },
  { value: 'KG', label: 'kg' },
  { value: 'G', label: 'g' },
  { value: 'LITER', label: 'Liter' },
  { value: 'ML', label: 'ml' },
  { value: 'PAKET', label: 'Paket' },
]

const DAY_OPTIONS = [
  { value: '1', label: 'Montag' },
  { value: '2', label: 'Dienstag' },
  { value: '3', label: 'Mittwoch' },
  { value: '4', label: 'Donnerstag' },
  { value: '5', label: 'Freitag' },
  { value: '6', label: 'Samstag' },
  { value: '0', label: 'Sonntag' },
]

const STEP_LABELS = ['Hof-Daten', 'Produkte', 'Abholzeiten', 'Fertig!']

function emptyProduct(): ProductRow {
  return { name: '', price: '', unit: 'KG', stock: '50' }
}

function emptySlot(): SlotRow {
  return { dayOfWeek: '5', startTime: '14:00', endTime: '17:00' }
}

// ─── Step indicator ──────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEP_LABELS.map((label, i) => {
        const stepNum = (i + 1) as Step
        const isDone = stepNum < current
        const isActive = stepNum === current
        return (
          <div key={i} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  isDone || isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isDone ? <Check className="size-4" /> : stepNum}
              </div>
              <span
                className={`text-[10px] font-medium hidden sm:block ${
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`w-8 h-0.5 mb-4 hidden sm:block rounded ${isDone ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export function OnboardingClient({ userEmail }: { userEmail: string }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [farmId, setFarmId] = useState<string | null>(null)
  const [farmSlug, setFarmSlug] = useState<string | null>(null)
  const [laedt, setLaedt] = useState(false)
  const [fehler, setFehler] = useState('')

  // ── Step 1 fields ──────────────────────────────────────────────
  const [farmName, setFarmName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [description, setDescription] = useState('')
  const [address, setAddress] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [phone, setPhone] = useState('')
  const [farmEmail, setFarmEmail] = useState(userEmail)
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)

  // ── Step 2 fields ──────────────────────────────────────────────
  const [products, setProducts] = useState<ProductRow[]>([emptyProduct()])
  const [productErrors, setProductErrors] = useState<Array<{ name?: string; price?: string }>>([])

  // ── Step 3 fields ──────────────────────────────────────────────
  const [slots, setSlots] = useState<SlotRow[]>([emptySlot()])

  // ── Validation state ───────────────────────────────────────────
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [showAllErrors, setShowAllErrors] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Slug preview: client-side, immediate on every keystroke
  const slugPreview = farmName.trim() ? generateSlug(farmName) : ''

  // Availability check: debounced server call (400 ms), resets on every keystroke
  useEffect(() => {
    setSlugAvailable(null)
    if (!farmName.trim()) return
    const timeout = setTimeout(async () => {
      const result = await checkSlugAvailability(farmName)
      setSlugAvailable(result.available)
    }, 400)
    return () => clearTimeout(timeout)
  }, [farmName])

  // ── Step 1 validation (pure, recomputed each render) ──────────
  const s1e = {
    farmName: !farmName.trim() ? 'Bitte gib den Namen deines Hofs an.' : '',
    ownerName: !ownerName.trim() ? 'Bitte gib deinen Vor- und Nachnamen an.' : '',
    address: !address.trim() ? 'Bitte gib die Straße und Hausnummer an.' : '',
    postalCode: !postalCode.trim()
      ? 'Bitte gib eine PLZ an.'
      : !/^\d{4}$/.test(postalCode.trim())
      ? 'Die PLZ muss genau 4 Ziffern haben.'
      : '',
    city: !city.trim() ? 'Bitte gib den Ort an.' : '',
    phone: !phone.trim()
      ? 'Bitte gib eine Telefonnummer an.'
      : phone.trim().length < 6
      ? 'Bitte gib eine gültige Telefonnummer an.'
      : '',
    // Slug error: triggered via farmName touch key (no separate slug input)
    slug: slugAvailable === false ? 'Diese Shop-Adresse ist bereits vergeben.' : '',
  }

  // Show error: only after onBlur OR after explicit showAllErrors (submit attempt)
  function se(field: keyof typeof s1e): boolean {
    const touchKey = field === 'slug' ? 'farmName' : field
    return (!!touched[touchKey] || showAllErrors) && !!s1e[field]
  }

  function touch(field: string) {
    setTouched((t) => ({ ...t, [field]: true }))
  }

  function fireToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // ── Handlers ───────────────────────────────────────────────────
  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    setFehler('')

    const hasErrors = Object.values(s1e).some(Boolean)
    if (hasErrors) {
      setShowAllErrors(true)
      fireToast('Bitte fülle die markierten Felder aus.')
      // Scroll to first error field
      const order = ['farmName', 'ownerName', 'address', 'postalCode', 'city', 'phone'] as const
      for (const field of order) {
        if (s1e[field]) {
          document.getElementById(field)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          break
        }
      }
      return
    }

    setLaedt(true)
    const result = await createFarm({ name: farmName, ownerName, description, address, postalCode, city, phone, email: farmEmail })
    setLaedt(false)

    if ('error' in result) {
      setFehler(result.error)
      return
    }

    setFarmId(result.farmId)
    setFarmSlug(result.farmSlug)
    setShowAllErrors(false)
    setTouched({})
    setStep(2)
  }

  async function handleStep2(skip = false) {
    if (!farmId) return
    setFehler('')

    if (!skip) {
      // Validate started product rows (any field has content = started)
      const errors = products.map((p) => {
        const isStarted = p.name.trim() || p.price
        const err: { name?: string; price?: string } = {}
        if (isStarted) {
          if (!p.name.trim()) err.name = 'Bitte gib den Produktnamen an.'
          if (!p.price || Number(p.price) <= 0) err.price = 'Bitte gib einen gültigen Preis an (z.B. 3.50).'
        }
        return err
      })
      const hasProductErrors = errors.some((e) => e.name || e.price)
      if (hasProductErrors) {
        setProductErrors(errors)
        fireToast('Bitte fülle die markierten Felder aus.')
        return
      }
      setProductErrors([])

      const valid = products.filter((p) => p.name.trim() && p.price && Number(p.price) > 0)
      if (valid.length === 0) {
        setFehler('Bitte füge mindestens ein Produkt hinzu oder überspringe diesen Schritt.')
        return
      }

      setLaedt(true)
      const result = await createOnboardingProducts(
        farmId,
        valid.map((p) => ({ name: p.name, price: Number(p.price), unit: p.unit, stock: Number(p.stock) || 50 }))
      )
      setLaedt(false)
      if ('error' in result) {
        setFehler(result.error)
        return
      }
    }

    setProductErrors([])
    setStep(3)
  }

  async function handleStep3(skip = false) {
    if (!farmId) return
    setFehler('')

    if (!skip) {
      const valid = slots.filter((s) => s.startTime && s.endTime)
      if (valid.length === 0) {
        setFehler('Bitte füge mindestens eine Abholzeit hinzu oder überspringe diesen Schritt.')
        return
      }
      setLaedt(true)
      const result = await createOnboardingSlots(
        farmId,
        valid.map((s) => ({ dayOfWeek: Number(s.dayOfWeek), startTime: s.startTime, endTime: s.endTime }))
      )
      setLaedt(false)
      if ('error' in result) {
        setFehler(result.error)
        return
      }
    }

    setStep(4)
  }

  const shopUrl = farmSlug ? `${appUrl}/${farmSlug}` : ''
  const whatsappText = farmSlug
    ? encodeURIComponent(`Hey! Ich habe meinen Bauernshop auf FarmerZone eingerichtet. Du kannst direkt online bestellen: ${shopUrl}`)
    : ''

  return (
    <div className="w-full max-w-lg mx-auto">
      <StepIndicator current={step} />

      {/* ── Toast (fixed, bottom-center, 3 s) ────────────────────── */}
      {toast && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-destructive text-destructive-foreground px-4 py-3 rounded-xl text-sm font-medium shadow-lg"
          role="alert"
          aria-live="assertive"
        >
          {toast}
        </div>
      )}

      {/* ── Step 1: Farm Info ─────────────────────────────────────── */}
      {step === 1 && (
        <div
          className="bg-card rounded-3xl p-6"
          style={{ boxShadow: '0 8px 24px oklch(0.18 0.03 150 / 0.08)' }}
        >
          <h2 className="font-heading text-xl font-semibold text-foreground mb-1">Dein Hof</h2>
          <p className="text-sm text-muted-foreground mb-1">
            Diese Infos erscheinen auf deiner öffentlichen Shop-Seite.
          </p>
          <p className="text-xs text-muted-foreground mb-5">
            <span className="text-red-500 mr-0.5" aria-hidden="true">*</span>Pflichtfelder
          </p>

          <form onSubmit={handleStep1} noValidate className="flex flex-col gap-4">

            {/* Hofname + Slug-Vorschau */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="farmName">Hofname <Req /></Label>
              <Input
                id="farmName"
                value={farmName}
                onChange={(e) => setFarmName(e.target.value)}
                onBlur={() => touch('farmName')}
                placeholder="Hof Müller"
                required
                aria-invalid={(se('farmName') || se('slug')) || undefined}
                aria-describedby={
                  [se('farmName') && 'farmName-error', se('slug') && 'slug-error']
                    .filter(Boolean).join(' ') || undefined
                }
                className="h-11"
              />
              {slugPreview && (
                <p
                  className={`text-xs mt-0.5 ${
                    slugAvailable === false
                      ? 'text-destructive'
                      : slugAvailable === true
                      ? 'text-emerald-600'
                      : 'text-muted-foreground'
                  }`}
                >
                  farmerzone.at/{slugPreview}
                  {slugAvailable === true && ' · verfügbar'}
                  {slugAvailable === null && ' · wird geprüft…'}
                </p>
              )}
              {se('farmName') && <FieldErr id="farmName-error" msg={s1e.farmName} />}
              {se('slug') && <FieldErr id="slug-error" msg={s1e.slug} />}
            </div>

            {/* Vor- und Nachname */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ownerName">Vor- und Nachname (Betreiber) <Req /></Label>
              <Input
                id="ownerName"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                onBlur={() => touch('ownerName')}
                placeholder="Franz Müller"
                required
                aria-invalid={se('ownerName') || undefined}
                aria-describedby={se('ownerName') ? 'ownerName-error' : undefined}
                className="h-11"
              />
              {se('ownerName') && <FieldErr id="ownerName-error" msg={s1e.ownerName} />}
            </div>

            {/* Kurzbeschreibung (optional) */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Kurzbeschreibung <Opt /></Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Wir sind ein kleiner Familienbetrieb in Niederösterreich…"
                rows={3}
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            {/* Adresse */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="address">Straße und Hausnummer <Req /></Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onBlur={() => touch('address')}
                placeholder="Dorfstraße 12"
                required
                aria-invalid={se('address') || undefined}
                aria-describedby={se('address') ? 'address-error' : undefined}
                className="h-11"
              />
              {se('address') && <FieldErr id="address-error" msg={s1e.address} />}
            </div>

            {/* PLZ + Ort */}
            <div className="grid grid-cols-[100px_1fr] gap-3 items-start">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="postalCode">PLZ <Req /></Label>
                <Input
                  id="postalCode"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  onBlur={() => touch('postalCode')}
                  placeholder="3100"
                  required
                  inputMode="numeric"
                  maxLength={4}
                  aria-invalid={se('postalCode') || undefined}
                  aria-describedby={se('postalCode') ? 'postalCode-error' : undefined}
                  className="h-11"
                />
                {se('postalCode') && <FieldErr id="postalCode-error" msg={s1e.postalCode} />}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="city">Ort <Req /></Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  onBlur={() => touch('city')}
                  placeholder="St. Pölten"
                  required
                  aria-invalid={se('city') || undefined}
                  aria-describedby={se('city') ? 'city-error' : undefined}
                  className="h-11"
                />
                {se('city') && <FieldErr id="city-error" msg={s1e.city} />}
              </div>
            </div>

            {/* Telefon + Hof-E-Mail */}
            <div className="grid grid-cols-2 gap-3 items-start">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="phone">Telefon <Req /></Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => touch('phone')}
                  placeholder="+43 664 123 456"
                  required
                  aria-invalid={se('phone') || undefined}
                  aria-describedby={se('phone') ? 'phone-error' : undefined}
                  className="h-11"
                />
                {se('phone') && <FieldErr id="phone-error" msg={s1e.phone} />}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="farmEmail">Hof-E-Mail <Opt /></Label>
                <Input
                  id="farmEmail"
                  type="email"
                  value={farmEmail}
                  onChange={(e) => setFarmEmail(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>

            {fehler && (
              <p className="text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-xl px-3 py-2.5">
                {fehler}
              </p>
            )}

            <Button type="submit" disabled={laedt} className="h-11 mt-1 bg-accent text-accent-foreground hover:bg-accent/90">
              {laedt ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Weiter →'}
            </Button>
          </form>
        </div>
      )}

      {/* ── Step 2: Products ──────────────────────────────────────── */}
      {step === 2 && (
        <div
          className="bg-card rounded-3xl p-6"
          style={{ boxShadow: '0 8px 24px oklch(0.18 0.03 150 / 0.08)' }}
        >
          <h2 className="font-heading text-xl font-semibold text-foreground mb-1">Deine Produkte</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Füge deine ersten Produkte hinzu. Du kannst später jederzeit mehr anlegen.
          </p>

          <div className="flex flex-col gap-4">
            {products.map((p, i) => {
              const pe = productErrors[i] ?? {}
              return (
                <div key={i} className="rounded-xl border border-border p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Produkt {i + 1}</span>
                    {products.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setProducts(products.filter((_, j) => j !== i))
                          setProductErrors(productErrors.filter((_, j) => j !== i))
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <Input
                      placeholder="Produktname (z. B. Erdäpfel)"
                      value={p.name}
                      onChange={(e) => {
                        const next = [...products]
                        next[i] = { ...next[i], name: e.target.value }
                        setProducts(next)
                        if (pe.name) {
                          const errs = [...productErrors]
                          errs[i] = { ...errs[i], name: undefined }
                          setProductErrors(errs)
                        }
                      }}
                      aria-invalid={pe.name ? true : undefined}
                      aria-describedby={pe.name ? `p${i}-name-error` : undefined}
                      className="h-10"
                    />
                    {pe.name && <FieldErr id={`p${i}-name-error`} msg={pe.name} />}
                  </div>

                  <div className="grid grid-cols-3 gap-2 items-start">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Preis (€) <span className="text-red-500" aria-hidden="true">*</span></span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="3.50"
                        value={p.price}
                        onChange={(e) => {
                          const next = [...products]
                          next[i] = { ...next[i], price: e.target.value }
                          setProducts(next)
                          if (pe.price) {
                            const errs = [...productErrors]
                            errs[i] = { ...errs[i], price: undefined }
                            setProductErrors(errs)
                          }
                        }}
                        aria-invalid={pe.price ? true : undefined}
                        aria-describedby={pe.price ? `p${i}-price-error` : undefined}
                        className="h-10"
                      />
                      {pe.price && <FieldErr id={`p${i}-price-error`} msg={pe.price} />}
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Einheit</span>
                      <select
                        value={p.unit}
                        onChange={(e) => {
                          const next = [...products]
                          next[i] = { ...next[i], unit: e.target.value }
                          setProducts(next)
                        }}
                        className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u.value} value={u.value}>{u.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Lagerbestand</span>
                      <Input
                        type="number"
                        min="0"
                        placeholder="50"
                        value={p.stock}
                        onChange={(e) => {
                          const next = [...products]
                          next[i] = { ...next[i], stock: e.target.value }
                          setProducts(next)
                        }}
                        className="h-10"
                      />
                    </div>
                  </div>
                </div>
              )
            })}

            {products.length < 5 && (
              <button
                type="button"
                onClick={() => setProducts([...products, emptyProduct()])}
                className="flex items-center justify-center gap-1.5 h-10 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
              >
                <Plus className="size-4" />
                Weiteres Produkt
              </button>
            )}

            {fehler && (
              <p className="text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-xl px-3 py-2.5">
                {fehler}
              </p>
            )}

            <div className="flex gap-3 mt-1">
              <Button
                variant="outline"
                onClick={() => { setFehler(''); setProductErrors([]); handleStep2(true) }}
                disabled={laedt}
                className="flex-1 h-11"
              >
                Überspringen
              </Button>
              <Button
                onClick={() => handleStep2(false)}
                disabled={laedt}
                className="flex-1 h-11 bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {laedt ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Weiter →'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Pickup Slots ──────────────────────────────────── */}
      {step === 3 && (
        <div
          className="bg-card rounded-3xl p-6"
          style={{ boxShadow: '0 8px 24px oklch(0.18 0.03 150 / 0.08)' }}
        >
          <h2 className="font-heading text-xl font-semibold text-foreground mb-1">Abholzeiten</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Wann können Kunden ihre Bestellungen abholen?
          </p>

          <div className="flex flex-col gap-4">
            {slots.map((s, i) => (
              <div key={i} className="rounded-xl border border-border p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Abholzeit {i + 1}</span>
                  {slots.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSlots(slots.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Wochentag</span>
                    <select
                      value={s.dayOfWeek}
                      onChange={(e) => {
                        const next = [...slots]
                        next[i] = { ...next[i], dayOfWeek: e.target.value }
                        setSlots(next)
                      }}
                      className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {DAY_OPTIONS.map((d) => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Von</span>
                    <Input
                      type="time"
                      value={s.startTime}
                      onChange={(e) => {
                        const next = [...slots]
                        next[i] = { ...next[i], startTime: e.target.value }
                        setSlots(next)
                      }}
                      className="h-10"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Bis</span>
                    <Input
                      type="time"
                      value={s.endTime}
                      onChange={(e) => {
                        const next = [...slots]
                        next[i] = { ...next[i], endTime: e.target.value }
                        setSlots(next)
                      }}
                      className="h-10"
                    />
                  </div>
                </div>
              </div>
            ))}

            {slots.length < 4 && (
              <button
                type="button"
                onClick={() => setSlots([...slots, emptySlot()])}
                className="flex items-center justify-center gap-1.5 h-10 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
              >
                <Plus className="size-4" />
                Weitere Abholzeit
              </button>
            )}

            {fehler && (
              <p className="text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-xl px-3 py-2.5">
                {fehler}
              </p>
            )}

            <div className="flex gap-3 mt-1">
              <Button
                variant="outline"
                onClick={() => { setFehler(''); handleStep3(true) }}
                disabled={laedt}
                className="flex-1 h-11"
              >
                Überspringen
              </Button>
              <Button
                onClick={() => handleStep3(false)}
                disabled={laedt}
                className="flex-1 h-11 bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {laedt ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Weiter →'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 4: Success ───────────────────────────────────────── */}
      {step === 4 && (
        <div
          className="bg-card rounded-3xl p-8 text-center"
          style={{ boxShadow: '0 8px 24px oklch(0.18 0.03 150 / 0.08)' }}
        >
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="font-heading text-2xl font-semibold text-foreground mb-2">
            Dein Hof ist online!
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Du kannst deinen Shop jetzt mit Kunden teilen und die ersten Bestellungen entgegennehmen.
          </p>

          {shopUrl && (
            <div className="bg-muted rounded-xl px-4 py-3 mb-6 flex items-center justify-between gap-2 text-left">
              <span className="text-sm font-mono text-foreground truncate">
                {shopUrl.replace('http://', '').replace('https://', '')}
              </span>
              <a
                href={shopUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary shrink-0 hover:opacity-80 transition-opacity"
              >
                <ExternalLink className="size-4" />
              </a>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {shopUrl && (
              <a
                href={`https://wa.me/?text=${whatsappText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 h-12 rounded-xl font-semibold text-sm transition-colors"
                style={{ backgroundColor: '#25D366', color: '#fff' }}
              >
                <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Per WhatsApp teilen
              </a>
            )}

            <Button onClick={() => router.push('/dashboard')} className="h-12 bg-accent text-accent-foreground hover:bg-accent/90">
              Zum Dashboard →
            </Button>

            {shopUrl && (
              <Link
                href={shopUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline underline-offset-2"
              >
                Shop ansehen
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
