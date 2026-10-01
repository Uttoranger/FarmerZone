'use client'

import { useState } from 'react'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { ArrowLeft, Loader2, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { getStripePromise } from '@/lib/stripe-client'
import { uhrzeitInWien } from '@/lib/fristen'

const stripePromise = getStripePromise()

interface StripePaymentStepProps {
  clientSecret: string
  orderId: string
  farmSlug: string
  /** Bis dahin hält die Bestellung ihre Ware (ISO, aus /api/checkout; src/lib/fristen.ts). */
  reserviertBis: string | null
  onClearCart: () => void
  onBack: () => void
}

export function StripePaymentStep({
  clientSecret,
  orderId,
  farmSlug,
  reserviertBis,
  onClearCart,
  onBack,
}: StripePaymentStepProps) {
  // Wurde eine Zahlung abgelehnt, sagen wir, dass nichts abgebucht wurde und
  // wie lange die Ware noch wartet — die Kundin kann es gleich erneut versuchen.
  const [abgelehnt, setAbgelehnt] = useState(false)
  const bisUhrzeit = reserviertBis ? uhrzeitInWien(new Date(reserviertBis)) : null

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" />
        Zurück
      </button>

      <h1 className="text-xl font-semibold text-foreground mb-2">Zahlung</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {bisUhrzeit ? (
          <>
            Deine Ware ist bis <strong className="text-foreground">{bisUhrzeit} Uhr</strong> für dich
            reserviert. Bitte gib jetzt deine Zahlungsdaten ein.
          </>
        ) : (
          'Deine Bestellung ist reserviert. Bitte gib jetzt deine Zahlungsdaten ein.'
        )}
      </p>

      {/* Bewusst WEISS in beiden Modi: Darin steckt Stripes eigenes
          Eingabefeld als iframe, das mit theme: 'stripe' hell bleibt. Ein
          dunkler Rahmen um eine helle Maske sähe aus wie ein Fehler — und
          die Stripe-Maske umzustellen ist eine Änderung am Zahlungsweg,
          nicht am Anstrich. */}
      <div className="bg-white rounded-xl border border-border p-4">
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: 'stripe',
              variables: {
                colorPrimary: '#15803d',
                borderRadius: '8px',
              },
            },
            locale: 'de',
          }}
        >
          <PaymentForm
            orderId={orderId}
            farmSlug={farmSlug}
            onClearCart={onClearCart}
            onAbgelehnt={() => setAbgelehnt(true)}
          />
        </Elements>
      </div>

      {/* Außerhalb des weißen Kastens: Dort drin hätte gedämpfter Text im
          dunklen Modus keinen Kontrast. */}
      {abgelehnt && (
        <p role="status" className="mt-4 text-sm text-foreground">
          Es wurde nichts abgebucht. Versuch es noch einmal oder nimm eine andere Zahlungsart
          {bisUhrzeit ? ` – deine Ware bleibt bis ${bisUhrzeit} Uhr reserviert.` : '.'}
        </p>
      )}

      <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground/60">
        <Lock className="size-3" />
        Sichere Zahlung über Stripe
      </div>
    </div>
  )
}

function PaymentForm({
  orderId,
  farmSlug,
  onClearCart,
  onAbgelehnt,
}: {
  orderId: string
  farmSlug: string
  onClearCart: () => void
  onAbgelehnt: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)

  async function handlePay() {
    if (!stripe || !elements) return

    setIsProcessing(true)

    const returnUrl = `${window.location.origin}/${farmSlug}/confirm/${orderId}`

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    })

    // If we get here, payment failed (redirect didn't happen)
    if (error) {
      toast.error(error.message ?? 'Zahlung fehlgeschlagen')
      // Unvollständige Eingaben zeigt Stripe am Feld — das ist keine Ablehnung.
      if (error.type !== 'validation_error') onAbgelehnt()
      setIsProcessing(false)
    }
    // On success Stripe redirects — no else branch needed
  }

  return (
    <div className="space-y-4">
      <PaymentElement
        options={{
          layout: { type: 'tabs', defaultCollapsed: false },
        }}
      />
      <Button
        type="button"
        onClick={handlePay}
        disabled={!stripe || isProcessing}
        className="w-full h-12 bg-primary text-primary-foreground hover:opacity-90 text-base font-semibold"
      >
        {isProcessing ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          'Jetzt bezahlen'
        )}
      </Button>
    </div>
  )
}

