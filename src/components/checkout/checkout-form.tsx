'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type FieldErrors, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format, addDays } from 'date-fns'
import { de } from 'date-fns/locale'
import { ShoppingCart, ArrowLeft, Loader2, Info } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import Image from 'next/image'
import {
  checkoutFormSchema,
  CHECKOUT_FELD_REIHENFOLGE,
  type CheckoutFormData,
} from '@/schemas/checkout'
import { formatEuro, formatMenge } from '@/lib/format'
import { GrundpreisZeile } from '@/components/shared/grundpreis-zeile'
import { CODE_RESERVIERUNG_ABGELAUFEN } from '@/lib/reservierung'
import type { PublicFarm } from '@/server/queries/farm'
import type { CartItem } from '@/lib/use-cart'
import { eurosToCents } from '@/lib/order-totals'
import {
  SERVICEGEBUEHR_BEZEICHNUNG,
  SERVICEGEBUEHR_HINWEIS,
  berechneServicegebuehr,
  centsAlsEuro,
} from '@/lib/servicegebuehr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { StripePaymentStep } from './stripe-payment'

const CART_KEY = 'bauernshop_cart'
const SESSION_KEY = 'bauernshop_sid'

/**
 * Den Warenkorb auf den vom Server berichtigten Stand bringen: gekürzte Mengen
 * übernehmen, entfallene Positionen entfernen — und den Browser-Speicher
 * mitziehen, damit der nächste Seitenaufruf denselben Stand zeigt.
 */
function uebernehmeBerichtigung(
  vorher: CartItem[],
  berichtigt: Array<{ productId: string; quantity: number }>,
  farmId: string,
  setCart: (items: CartItem[]) => void
): CartItem[] {
  const mengen = new Map(berichtigt.map((b) => [b.productId, b.quantity]))
  const nachher = vorher
    .filter((i) => (mengen.get(i.productId) ?? 0) > 0)
    .map((i) => ({ ...i, quantity: mengen.get(i.productId) ?? i.quantity }))
  setCart(nachher)
  try {
    localStorage.setItem(CART_KEY, JSON.stringify({ farmId, items: nachher }))
  } catch {
    // Kein Schreibzugriff auf den Speicher (privates Fenster): die Anzeige
    // stimmt trotzdem, und der Checkout prüft serverseitig erneut.
  }
  return nachher
}

// Einheiten und Preise kommen aus src/lib/format.ts — EINE Schreibweise für
// Warenkorb, Checkout, Bestätigung, E-Mail und Bauern-Backend (Befund 13).

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


export function CheckoutForm({ farm }: { farm: PublicFarm }) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [sessionId, setSessionId] = useState('')
  const [isHydrated, setIsHydrated] = useState(false)
  // useTransition statt eigenem Flag: React setzt isPending zurück, auch wenn
  // der Vorgang mit einem Fehler endet — ein selbst gepflegter Ladezustand
  // blieb im Fehlerfall hängen und sperrte den Knopf für immer (Befund 4).
  const [isPending, startTransition] = useTransition()
  const [paymentStep, setPaymentStep] = useState<{
    clientSecret: string
    orderId: string
  } | null>(null)

  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)

  /**
   * Idempotenz-Schlüssel (Befund 4): EINMAL beim Öffnen des Checkouts erzeugt
   * und über alle Versuche hinweg mitgeschickt. Ein zweiter Request mit
   * demselben Schlüssel liefert die bestehende Bestellung, statt eine zweite
   * anzulegen — das gilt auch für Doppelklick, Zurück-Taste und erneut
   * gesendetes Formular, die ein deaktivierter Knopf nicht abfängt.
   */
  const idempotencyKeyRef = useRef<string>('')
  if (!idempotencyKeyRef.current && typeof crypto !== 'undefined') {
    idempotencyKeyRef.current = crypto.randomUUID()
  }

  useEffect(() => {
    const sid = localStorage.getItem(SESSION_KEY) ?? ''
    setSessionId(sid)

    let geladen: CartItem[] = []
    try {
      const raw = localStorage.getItem(CART_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        if (data.farmId === farm.id) geladen = data.items ?? []
      }
    } catch (err) {
      // Beschädigter oder nicht lesbarer Warenkorb im Browser-Speicher: ein
      // leerer Warenkorb ist hier das korrekte Ergebnis, nicht ein Fehler.
      // Die Kundin soll deswegen nichts sehen — sie hat nichts falsch
      // gemacht, und ein Hinweis wäre nur Rauschen.
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Warenkorb] Gespeicherter Warenkorb nicht lesbar:', err)
      }
    }
    setCart(geladen)
    setIsHydrated(true)

    // Beim ÖFFNEN des Checkouts die Reservierungen gegen die Frist prüfen
    // (Befund 3). Der Warenkorb bleibt sichtbar; was nicht mehr gilt, wird
    // berichtigt, und die Kundin erfährt den Grund.
    if (!sid || geladen.length === 0) return
    let abgebrochen = false
    void (async () => {
      try {
        const res = await fetch('/api/warenkorb/pruefen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sid,
            items: geladen.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          }),
        })
        if (!res.ok || abgebrochen) return
        const befund = await res.json()
        if (!befund.meldung) return
        uebernehmeBerichtigung(geladen, befund.items ?? [], farm.id, setCart)
        toast.info(befund.meldung)
      } catch {
        // Kein Netz oder Serverfehler: Der Warenkorb bleibt, wie er ist.
        // Der Checkout prüft ohnehin noch einmal verbindlich.
      }
    })()
    return () => {
      abgebrochen = true
    }
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
  // Servicegebühr — dieselbe Rechnung wie der Server (/api/checkout rechnet
  // verbindlich, mit der Hofeinstellung zum Bestellzeitpunkt). Bei Online-
  // UND Barzahlung gleich; ist sie 0, entfällt die Zeile ersatzlos.
  const gebuehr = berechneServicegebuehr(eurosToCents(total), farm, new Date())
  const gesamt = centsAlsEuro(eurosToCents(total) + gebuehr.gebuehrCents)

  /**
   * Nach einer fehlgeschlagenen Prüfung zum ERSTEN Fehlerfeld springen und es
   * fokussieren (Befund 6). Vorher sprang die Seite an den Anfang, und bei
   * einem Fehler weiter unten war nicht zu sehen, woran es lag.
   */
  function onInvalid(errors: FieldErrors<CheckoutFormData>) {
    const erstes = CHECKOUT_FELD_REIHENFOLGE.find((feld) => errors[feld])
    if (!erstes) return
    const el =
      formRef.current?.querySelector<HTMLElement>(`[name="${erstes}"]`) ??
      formRef.current?.querySelector<HTMLElement>(`#${erstes}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // focus() nach dem Scrollen, sonst springt der Browser noch einmal.
    window.setTimeout(() => el.focus({ preventScroll: true }), 120)
  }

  async function onSubmit(data: CheckoutFormData) {
    if (cart.length === 0) {
      toast.error('Dein Warenkorb ist leer')
      return
    }

    const [pickupDate, pickupTimeStart, pickupTimeEnd] = data.pickupSlotKey.split('|')

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmId: farm.id,
          farmSlug: farm.slug,
          sessionId,
          idempotencyKey: idempotencyKeyRef.current || undefined,
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
        // Abgelaufene Reservierung oder geänderter Bestand: Der Warenkorb wird
        // auf den geprüften Stand gebracht und bleibt SICHTBAR — die Kundin
        // sieht, was noch gilt, statt vor einer leeren Seite zu stehen
        // (Befund 3). Der Grund steht im Text der Antwort.
        if (err.code === CODE_RESERVIERUNG_ABGELAUFEN || err.code === 'WARENKORB_GEAENDERT') {
          if (Array.isArray(err.items)) {
            uebernehmeBerichtigung(cart, err.items, farm.id, setCart)
          }
          toast.error(err.error ?? 'Dein Warenkorb hat sich geändert.')
          return
        }
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
                  {/* Eine Schreibweise, identisch mit Warenkorb, Bestätigung
                      und E-Mail (Befund 13) — inklusive Plural bei Paketen. */}
                  {formatMenge(item.quantity, item.unit, item.unitSize)} × {formatEuro(item.price)}
                </p>
                <GrundpreisZeile
                  price={item.price}
                  unit={item.unit}
                  unitSize={item.unitSize}
                  className="text-[11px]"
                />
              </div>
              <span className="text-sm font-medium text-foreground shrink-0">
                {formatEuro(item.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-border space-y-1.5">
          {gebuehr.gebuehrCents > 0 && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Zwischensumme</span>
                <span className="text-foreground">{formatEuro(total)}</span>
              </div>
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{SERVICEGEBUEHR_BEZEICHNUNG}</span>
                <span className="text-foreground">{formatEuro(centsAlsEuro(gebuehr.gebuehrCents))}</span>
              </div>
              {/* Der Hinweis klappt auf, statt bei 375 px als Fließtext
                  zwischen den Zahlen umzubrechen. */}
              <details className="text-xs text-muted-foreground">
                <summary className="inline-flex cursor-pointer select-none items-center gap-1 min-h-6">
                  <Info className="size-3.5" aria-hidden="true" />
                  Was ist die Servicegebühr?
                </summary>
                <p className="mt-1 leading-relaxed">{SERVICEGEBUEHR_HINWEIS}</p>
              </details>
            </>
          )}
          <div className="flex justify-between items-center">
            <span className="font-semibold text-foreground">Gesamt</span>
            <span className="text-lg font-bold text-primary">{formatEuro(gesamt)}</span>
          </div>
        </div>
      </div>

      <form
        ref={formRef}
        onSubmit={form.handleSubmit(
          (daten) => startTransition(async () => { await onSubmit(daten) }),
          onInvalid
        )}
        noValidate
        className="space-y-6"
      >
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
              // required/autoComplete für Browser-Ausfüllhilfen, aria-* für
              // Screenreader (Befund 25). noValidate am Formular verhindert,
              // dass die Browser-Blase die eigenen Meldungen verdeckt.
              required
              autoComplete="name"
              aria-invalid={form.formState.errors.customerName ? true : undefined}
              aria-describedby={form.formState.errors.customerName ? 'customerName-fehler' : undefined}
              placeholder="Maria Muster"
              className={form.formState.errors.customerName ? 'border-destructive' : ''}
            />
            {form.formState.errors.customerName && (
              <p id="customerName-fehler" className="text-xs text-destructive mt-1">
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
              required
              autoComplete="email"
              inputMode="email"
              aria-invalid={form.formState.errors.customerEmail ? true : undefined}
              aria-describedby={form.formState.errors.customerEmail ? 'customerEmail-fehler' : undefined}
              placeholder="maria@beispiel.at"
              className={form.formState.errors.customerEmail ? 'border-destructive' : ''}
            />
            {form.formState.errors.customerEmail && (
              <p id="customerEmail-fehler" className="text-xs text-destructive mt-1">
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
              required
              autoComplete="tel"
              inputMode="tel"
              aria-invalid={form.formState.errors.customerPhone ? true : undefined}
              aria-describedby={form.formState.errors.customerPhone ? 'customerPhone-fehler' : undefined}
              placeholder="+43 664 123 4567"
              className={form.formState.errors.customerPhone ? 'border-destructive' : ''}
            />
            {form.formState.errors.customerPhone && (
              <p id="customerPhone-fehler" className="text-xs text-destructive mt-1">
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
              placeholder="z. B. Ich komme erst gegen 17:30"
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
                    aria-invalid={form.formState.errors.onsiteConfirmed ? true : undefined}
                    aria-describedby={
                      form.formState.errors.onsiteConfirmed ? 'onsiteConfirmed-fehler' : undefined
                    }
                    className="mt-0.5 accent-primary size-4"
                  />
                  <span className="text-sm text-foreground">
                    Ich verpflichte mich, meine Bestellung zum gewählten Abholtermin abzuholen
                    und vor Ort zu bezahlen.
                  </span>
                </label>
                {form.formState.errors.onsiteConfirmed && (
                  <p id="onsiteConfirmed-fehler" className="text-xs text-destructive mt-1">
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
          disabled={isPending || pickupOptions.length === 0}
          aria-busy={isPending}
          className="w-full h-12 bg-accent text-accent-foreground hover:bg-accent-hover text-base font-semibold"
        >
          {isPending ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              Wird gesendet …
            </span>
          ) : paymentMethod === 'ONLINE' ? (
            `Weiter zur Zahlung — ${formatEuro(gesamt)}`
          ) : (
            `Bestellung verbindlich aufgeben — ${formatEuro(gesamt)}`
          )}
        </Button>
      </form>
    </div>
  )
}
