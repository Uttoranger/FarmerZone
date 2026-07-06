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

const stripePromise = getStripePromise()

interface StripePaymentStepProps {
  clientSecret: string
  orderId: string
  farmSlug: string
  onClearCart: () => void
  onBack: () => void
}

export function StripePaymentStep({
  clientSecret,
  orderId,
  farmSlug,
  onClearCart,
  onBack,
}: StripePaymentStepProps) {
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
        Deine Bestellung ist reserviert. Bitte gib jetzt deine Zahlungsdaten ein.
      </p>

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
          />
        </Elements>
      </div>

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
}: {
  orderId: string
  farmSlug: string
  onClearCart: () => void
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

