'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format, addDays } from 'date-fns'
import { de } from 'date-fns/locale'
import { ShoppingCart, ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import Image from 'next/image'
import { checkoutFormSchema, type CheckoutFormData } from '@/schemas/checkout'
import type { PublicFarm } from '@/server/queries/farm'
import type { CartItem } from '@/lib/use-cart'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { StripePaymentStep } from './stripe-payment'

const CART_KEY = 'bauernshop_cart'
const SESSION_KEY = 'bauernshop_sid'

const UNIT_LABELS: Record<string, string> = {
  STUECK: 'Stk.',
  KG: 'kg',
  G: 'g',
  LITER: 'l',
  ML: 'ml',
  M3: 'm³',
  PAKET: 'Pak.',
}

const PAYMENT_LABELS: Record<string, string> = {
  ONLINE: '💳 Online (Karte / Überweisung)',
  ONSITE_CASH: '💵 Bar bei Abholung',
  ONSITE_CARD: '💳 Karte bei Abholung',
}

type PickupOption = {
  key: string // "YYYY-MM-DD|HH:MM|HH:MM"
  label: string
  date: string
  timeStart: string
  timeEnd: string
}

function generatePickupOptions(
  slots: PublicFarm['pickupSlots']
): PickupOption[] {
  const options: PickupOption[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 1; i <= 14; i++) {
    const d = addDays(today, i)
    const dow = d.getDay()
    const matching = slots.filter((s) => s.dayOfWeek === dow)
    for (const slot of matching) {
      const dateStr = format(d, 'yyyy-MM-dd')
      const label = `${format(d, 'EEEE, d. MMMM', { locale: de })}, ${slot.startTime}–${slot.endTime} Uhr`
      options.push({
        key: `${dateStr}|${slot.startTime}|${slot.endTime}`,
        label,
        date: dateStr,
        timeStart: slot.startTime,
        timeEnd: slot.endTime,
      })
    }
  }
  return options
}

function formatEuro(n: number) {
  return `€ ${n.toFixed(2).replace('.', ',')}`
}

export function CheckoutForm({ farm }: { farm: PublicFarm }) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [sessionId, setSessionId] = useState('')
  const [isHydrated, setIsHydrated] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [paymentStep, setPaymentStep] = useState<{
    clientSecret: string
    orderId: string
  } | null>(null)

  const router = useRouter()

  useEffect(() => {
    const sid = localStorage.getItem(SESSION_KEY) ?? ''
    setSessionId(sid)
    try {
      const raw = localStorage.getItem(CART_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        if (data.farmId === farm.id) setCart(data.items ?? [])
      }
    } catch {}
    setIsHydrated(true)
  }, [farm.id])

  const pickupOptions = generatePickupOptions(farm.pickupSlots)

  // Build available payment methods
  const paymentMethods: Array<{ value: string; label: string }> = []
  if (farm.acceptsOnline && farm.stripeAccountReady) {
    paymentMethods.push({ value: 'ONLINE', label: PAYMENT_LABELS.ONLINE })
  }
  if (farm.acceptsOnsite) {
    paymentMethods.push({ value: 'ONSITE_CASH', label: PAYMENT_LABELS.ONSITE_CASH })
    paymentMethods.push({ value: 'ONSITE_CARD', label: PAYMENT_LABELS.ONSITE_CARD })
  }

  const defaultPayment = paymentMethods[0]?.value ?? 'ONSITE_CASH'

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutFormSchema) as Resolver<CheckoutFormData>,
    defaultValues: {
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      customerNote: '',
      pickupSlotKey: '',
      paymentMethod: defaultPayment as CheckoutFormData['paymentMethod'],
      onsiteConfirmed: false,
    },
  })

  const paymentMethod = form.watch('paymentMethod')
  const customerPhone = form.watch('customerPhone')
  const isOnsite = paymentMethod === 'ONSITE_CASH' || paymentMethod === 'ONSITE_CARD'
  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0)

  async function onSubmit(data: CheckoutFormData) {
    if (cart.length === 0) {
      toast.error('Dein Warenkorb ist leer')
      return
    }

    if (isOnsite && !data.onsiteConfirmed) {
      form.setError('onsiteConfirmed', { message: 'Bitte bestätige die verbindliche Abholung' })
      return
    }

    const [pickupDate, pickupTimeStart, pickupTimeEnd] = data.pickupSlotKey.split('|')

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmId: farm.id,
          farmSlug: farm.slug,
          sessionId,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          customerPhone: data.customerPhone,
          customerNote: data.customerNote ?? '',
          pickupDate,
          pickupTimeStart,
          pickupTimeEnd,
          paymentMethod: data.paymentMethod,
          optInEmail: data.optInEmail ?? false,
          optInWhatsApp: data.optInWhatsApp ?? false,
          items: cart.map((i) => ({
            productId: i.productId,
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.price,
          })),
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Fehler beim Checkout')
      }

      const result = await res.json()

      if (data.paymentMethod === 'ONLINE') {
        setPaymentStep({ clientSecret: result.clientSecret, orderId: result.orderId })
      } else {
        localStorage.removeItem(CART_KEY)
        router.push(`/${farm.slug}/confirm/${result.orderId}`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Checkout')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Stripe payment step
  if (paymentStep) {
    return (
      <StripePaymentStep
        clientSecret={paymentStep.clientSecret}
        orderId={paymentStep.orderId}
        farmSlug={farm.slug}
        onClearCart={() => localStorage.removeItem(CART_KEY)}
        onBack={() => setPaymentStep(null)}
      />
    )
  }

  // Loading state
  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Empty cart
  if (cart.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <ShoppingCart className="size-12 text-muted-foreground/40 mx-auto mb-4" />
        <h2 className="text-lg font-medium text-foreground mb-2">Dein Warenkorb ist leer</h2>
        <Link href={`/${farm.slug}`}>
          <Button className="mt-4 bg-primary text-primary-foreground hover:opacity-90">
            Zurück zum Hof
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Back link */}
      <Link
        href={`/${farm.slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" />
        Zurück zu {farm.name}
      </Link>

      <h1 className="font-heading text-xl font-semibold text-foreground mb-6">Bestellung abschließen</h1>

      {/* Order summary */}
      <div className="bg-card rounded-xl border border-border p-4 mb-6">
        <h2 className="font-medium text-foreground mb-3">Bestellübersicht</h2>
        <div className="space-y-3">
          {cart.map((item) => (
            <div key={item.productId} className="flex items-center gap-3">
              {item.imageUrl && (
                <Image
                  src={item.imageUrl}
                  alt={item.name}
                  width={40}
                  height={40}
                  className="rounded-md object-cover shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.quantity} {UNIT_LABELS[item.unit] ?? item.unit} × {formatEuro(item.price)}
                </p>
              </div>
              <span className="text-sm font-medium text-foreground shrink-0">
                {formatEuro(item.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-border flex justify-between items-center">
          <span className="font-semibold text-foreground">Gesamt</span>
          <span className="text-lg font-bold text-primary">{formatEuro(total)}</span>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Pickup slot */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h2 className="font-medium text-foreground mb-3">Abholtermin</h2>
          {pickupOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aktuell sind keine Abholtermine verfügbar. Bitte kontaktiere den Hof direkt.
            </p>
          ) : (
            <div className="space-y-2">
              {pickupOptions.map((opt) => (
                <label
                  key={opt.key}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/8 transition-colors"
                >
                  <input
                    type="radio"
                    value={opt.key}
                    {...form.register('pickupSlotKey')}
                    className="accent-primary"
                  />
                  <span className="text-sm text-foreground">{opt.label}</span>
                </label>
              ))}
            </div>
          )}
          {form.formState.errors.pickupSlotKey && (
            <p className="text-xs text-destructive mt-2">
              {form.formState.errors.pickupSlotKey.message}
            </p>
          )}
        </div>

        {/* Customer data */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-4">
          <h2 className="font-medium text-foreground">Deine Daten</h2>
          <div>
            <Label htmlFor="customerName" className="text-sm text-muted-foreground mb-1 block">
              Name *
            </Label>
            <Input
              id="customerName"
              {...form.register('customerName')}
              placeholder="Maria Muster"
              className={form.formState.errors.customerName ? 'border-red-400' : ''}
            />
            {form.formState.errors.customerName && (
              <p className="text-xs text-destructive mt-1">
                {form.formState.errors.customerName.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="customerEmail" className="text-sm text-muted-foreground mb-1 block">
              E-Mail *
            </Label>
            <Input
              id="customerEmail"
              type="email"
              {...form.register('customerEmail')}
              placeholder="maria@beispiel.at"
              className={form.formState.errors.customerEmail ? 'border-red-400' : ''}
            />
            {form.formState.errors.customerEmail && (
              <p className="text-xs text-destructive mt-1">
                {form.formState.errors.customerEmail.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="customerPhone" className="text-sm text-muted-foreground mb-1 block">
              Telefon *
            </Label>
            <Input
              id="customerPhone"
              type="tel"
              {...form.register('customerPhone')}
              placeholder="+43 664 123 4567"
              className={form.formState.errors.customerPhone ? 'border-red-400' : ''}
            />
            {form.formState.errors.customerPhone && (
              <p className="text-xs text-destructive mt-1">
                {form.formState.errors.customerPhone.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="customerNote" className="text-sm text-muted-foreground mb-1 block">
              Notiz an den Hof (optional)
            </Label>
            <Textarea
              id="customerNote"
              {...form.register('customerNote')}
              placeholder="z.B. Bitte läuten, wenn ich nicht vor Ort bin"
              rows={2}
            />
          </div>
        </div>

        {/* Newsletter opt-in */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h2 className="font-medium text-foreground mb-1">Neuigkeiten vom Hof</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Standardmäßig nicht angehakt — nur wenn du möchtest.
          </p>
          <div className="space-y-2.5">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...form.register('optInEmail')}
                className="mt-0.5 accent-primary w-4 h-4"
              />
              <span className="text-sm text-foreground">
                Per E-Mail über frische Produkte und Aktionen von{' '}
                <strong>{farm.name}</strong> informiert werden
              </span>
            </label>
            <label
              className={`flex items-start gap-3 ${customerPhone?.length >= 4 ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
            >
              <input
                type="checkbox"
                {...form.register('optInWhatsApp')}
                disabled={!customerPhone || customerPhone.length < 4}
                className="mt-0.5 accent-primary w-4 h-4"
              />
              <span className="text-sm text-foreground">
                Per WhatsApp informiert werden
                {(!customerPhone || customerPhone.length < 4) && (
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    Telefonnummer erforderlich
                  </span>
                )}
              </span>
            </label>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Du kannst dich jederzeit abmelden — über den Link in jeder Nachricht oder in deinem{' '}
            <a href="/account/profile" className="underline hover:text-foreground">
              Kunden-Profil
            </a>
            . Mehr Infos in unserer{' '}
            <a href="/datenschutz" className="underline hover:text-foreground">
              Datenschutzerklärung
            </a>
            .
          </p>
        </div>

        {/* Payment method */}
        {paymentMethods.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-4">
            <h2 className="font-medium text-foreground mb-3">Zahlungsart</h2>
            <div className="space-y-2">
              {paymentMethods.map((pm) => (
                <label
                  key={pm.value}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/8 transition-colors"
                >
                  <input
                    type="radio"
                    value={pm.value}
                    {...form.register('paymentMethod')}
                    className="accent-primary"
                  />
                  <span className="text-sm text-foreground">{pm.label}</span>
                </label>
              ))}
            </div>

            {isOnsite && (
              <div className="mt-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    {...form.register('onsiteConfirmed')}
                    className="mt-0.5 accent-primary"
                  />
                  <span className="text-sm text-foreground">
                    Ich verpflichte mich, meine Bestellung zum gewählten Abholtermin abzuholen
                    und vor Ort zu bezahlen.
                  </span>
                </label>
                {form.formState.errors.onsiteConfirmed && (
                  <p className="text-xs text-destructive mt-1">
                    {form.formState.errors.onsiteConfirmed.message}
                  </p>
                )}
              </div>
            )}

            {paymentMethod === 'ONLINE' && (
              <p className="mt-3 text-xs text-muted-foreground">
                Du wirst nach dem Klick auf &quot;Weiter zur Zahlung&quot; zu Stripe weitergeleitet, um sicher zu bezahlen.
              </p>
            )}
          </div>
        )}

        <Button
          type="submit"
          disabled={isSubmitting || pickupOptions.length === 0}
          className="w-full h-12 bg-accent text-accent-foreground hover:bg-accent-hover text-base font-semibold"
        >
          {isSubmitting ? (
            <Loader2 className="size-5 animate-spin" />
          ) : paymentMethod === 'ONLINE' ? (
            `Weiter zur Zahlung — ${formatEuro(total)}`
          ) : (
            `Bestellung verbindlich aufgeben — ${formatEuro(total)}`
          )}
        </Button>
      </form>
    </div>
  )
}
