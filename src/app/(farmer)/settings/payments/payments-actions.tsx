'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  createConnectAccount,
  createOnboardingLink,
  checkConnectStatus,
} from '@/server/actions/stripe-connect'

interface PaymentsActionsProps {
  hasAccount: boolean
  isReady: boolean
}

export function PaymentsActions({ hasAccount, isReady }: PaymentsActionsProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSetup() {
    setLoading(true)
    try {
      if (!hasAccount) {
        const res = await createConnectAccount()
        if (res.error) {
          toast.error(res.error)
          setLoading(false)
          return
        }
      }
      const link = await createOnboardingLink()
      if (link.error) {
        toast.error(link.error)
        setLoading(false)
        return
      }
      window.location.href = link.url!
    } catch {
      toast.error('Fehler beim Verbinden mit Stripe')
      setLoading(false)
    }
  }

  async function handleRefresh() {
    setLoading(true)
    try {
      const res = await checkConnectStatus()
      if (res.ready) {
        toast.success('Stripe-Konto bestätigt!')
      } else {
        toast.info('Onboarding noch nicht vollständig abgeschlossen')
      }
      router.refresh()
    } catch {
      toast.error('Fehler beim Prüfen des Status')
    } finally {
      setLoading(false)
    }
  }

  if (isReady) {
    return (
      <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : 'Status prüfen'}
      </Button>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={handleSetup} disabled={loading} className="bg-primary text-primary-foreground hover:opacity-90">
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <>
            <ExternalLink className="size-4" />
            {hasAccount ? 'Onboarding fortsetzen' : 'Stripe einrichten'}
          </>
        )}
      </Button>
      {hasAccount && (
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          Status prüfen
        </Button>
      )}
    </div>
  )
}

