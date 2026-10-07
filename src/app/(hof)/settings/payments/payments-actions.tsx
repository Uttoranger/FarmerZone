'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { KNOPF_ORANGE, KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import {
  createConnectAccount,
  createOnboardingLink,
  checkConnectStatus,
  schalteOnlineZahlungEin,
} from '@/server/actions/stripe-connect'

interface PaymentsActionsProps {
  hasAccount: boolean
  isReady: boolean
  /** Farm.acceptsOnline — false nur bei Bestandshöfen vor Register Z1. */
  onlineAn: boolean
}

/** Während eine Action läuft: Kreisel für das Auge, Satz für den Screenreader. */
function Warten(): React.JSX.Element {
  return (
    <>
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      <span className="sr-only">Einen Moment …</span>
    </>
  )
}

/*
 * Die Knöpfe der Zahlungs-Einstellungen (Nachtlauf Nr. 22d neu gezeichnet).
 * Ablauf unverändert: ohne Konto erst createConnectAccount, dann der Link zu
 * Stripe (createOnboardingLink); „Status prüfen" fragt checkConnectStatus.
 * Genau ein orange Knopf (Hof-Aktion), Prüfen als Umriss.
 */
export function PaymentsActions({ hasAccount, isReady, onlineAn }: PaymentsActionsProps): React.JSX.Element {
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
      toast.error('Wir konnten Stripe gerade nicht erreichen. Versuch es bitte noch einmal.')
      setLoading(false)
    }
  }

  async function handleRefresh() {
    setLoading(true)
    try {
      const res = await checkConnectStatus()
      if (res.ready) {
        toast.success('Dein Stripe-Konto ist bestätigt.')
      } else {
        toast.info('Die Einrichtung bei Stripe ist noch nicht fertig.')
      }
      router.refresh()
    } catch {
      toast.error('Wir konnten den Stand gerade nicht prüfen. Versuch es bitte noch einmal.')
    } finally {
      setLoading(false)
    }
  }

  // Stripe fertig, Online aber aus (Bestandshof vor Z1): Einschalten ist hier
  // die eine Hof-Aktion, „Status prüfen" bleibt als Umriss daneben.
  async function handleEinschalten() {
    setLoading(true)
    try {
      const res = await schalteOnlineZahlungEin({ einschalten: true })
      if ('error' in res) {
        toast.error(res.error)
      } else {
        toast.success('Online-Zahlung ist eingeschaltet.')
        router.refresh()
      }
    } catch {
      toast.error('Wir konnten die Online-Zahlung gerade nicht einschalten. Versuch es bitte noch einmal.')
    } finally {
      setLoading(false)
    }
  }

  if (isReady && !onlineAn) {
    return (
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={handleEinschalten} disabled={loading} className={KNOPF_ORANGE}>
          {loading ? <Warten /> : 'Online-Zahlung einschalten'}
        </button>
        <button type="button" onClick={handleRefresh} disabled={loading} className={KNOPF_RAHMEN}>
          Status prüfen
        </button>
      </div>
    )
  }

  if (isReady) {
    return (
      <button type="button" onClick={handleRefresh} disabled={loading} className={KNOPF_RAHMEN}>
        {loading ? <Warten /> : 'Status prüfen'}
      </button>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={handleSetup} disabled={loading} className={KNOPF_ORANGE}>
        {loading ? (
          <Warten />
        ) : (
          <>
            <ExternalLink className="size-4" strokeWidth={1.7} aria-hidden="true" />
            {hasAccount ? 'Einrichtung fortsetzen' : 'Mit Stripe einrichten'}
          </>
        )}
      </button>
      {hasAccount && (
        <button type="button" onClick={handleRefresh} disabled={loading} className={KNOPF_RAHMEN}>
          Status prüfen
        </button>
      )}
    </div>
  )
}
