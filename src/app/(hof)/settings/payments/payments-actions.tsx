'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { AKTIONSLEISTE_KNOPF } from '@/components/ui/feste-aktionsleiste'
import { HELLER_KNOPF } from '@/components/hof-einstellungen/knopf'

import { NEU_EINRICHTEN_TITEL } from '@/lib/stripe-konto'
import {
  createConnectAccount,
  createOnboardingLink,
  checkConnectStatus,
  schalteOnlineZahlungEin,
} from '@/server/actions/stripe-connect'
import { cn } from '@/lib/utils'

/**
 * Die Knöpfe der Karte „Online-Zahlung“ über die volle Kartenbreite, 52 px, 14 px rund — der Hauptknopf orange,
 * „Status prüfen“ hell mit Rand (Board s2-/w2-hofdaten-zahlung Bild 4/5; Abnahme Lauf 32 „Knöpfe … blasser Rand“).
 */
const HAUPT = cn(AKTIONSLEISTE_KNOPF, 'disabled:opacity-60')
const NEBEN = cn(HELLER_KNOPF, 'disabled:opacity-60')

interface PaymentsActionsProps {
  hasAccount: boolean
  isReady: boolean
  /** Farm.acceptsOnline — false nur bei Bestandshöfen vor Register Z1. */
  onlineAn: boolean
  /** Register Z2: Stripe kennt das gespeicherte Konto nicht (?stripe=neu, von der Seite entschieden). */
  neuEinrichten?: boolean
  /**
   * Register N49: Der Weg ins Stripe-Formular steht nur, wo der Hof dort etwas
   * tun kann — kein Konto, Angaben fehlen, neu einrichten. Prüft Stripe oder
   * wartet der Hof, bleibt nur „Status prüfen“. Fehlt der Wert, wie bisher.
   */
  formularOffen?: boolean
}

/** Die Zahlungs-Seite mit „Online-Zahlung neu einrichten" (zahlungHinweis, Register Z2). */
const NEU_EINRICHTEN_ADRESSE = '/settings/payments?stripe=neu'

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
 *
 * Register Z2 (Nr. 42): Melden Prüfen oder Fortsetzen, dass Stripe das Konto
 * nicht kennt, geht es zur Seite mit „Online-Zahlung neu einrichten". Dort
 * läuft derselbe Einrichten-Weg wie ohne Konto — createConnectAccount prüft
 * selbst bei Stripe, ob das alte Konto wirklich unbekannt ist, bevor es die
 * Kennung ersetzt.
 */
export function PaymentsActions({
  hasAccount,
  isReady,
  onlineAn,
  neuEinrichten = false,
  formularOffen = true,
}: PaymentsActionsProps): React.JSX.Element {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSetup() {
    setLoading(true)
    try {
      if (!hasAccount || neuEinrichten) {
        const res = await createConnectAccount()
        if (res.error) {
          toast.error(res.error)
          setLoading(false)
          return
        }
      }
      const link = await createOnboardingLink()
      if (link.kontoUnbekannt) {
        // Fortsetzen geht nicht, Stripe kennt das Konto nicht — die Seite
        // zeigt jetzt den Weg zum Neu-Einrichten.
        router.replace(NEU_EINRICHTEN_ADRESSE)
        setLoading(false)
        return
      }
      if (link.error || !link.url) {
        toast.error(link.error ?? 'Wir konnten Stripe gerade nicht erreichen. Versuch es bitte noch einmal.')
        setLoading(false)
        return
      }
      window.location.href = link.url
    } catch {
      toast.error('Wir konnten Stripe gerade nicht erreichen. Versuch es bitte noch einmal.')
      setLoading(false)
    }
  }

  async function handleRefresh() {
    setLoading(true)
    try {
      const res = await checkConnectStatus()
      if (res.kontoUnbekannt) {
        // Stripe kennt das Konto nicht (Register Z2): zur Karte „neu einrichten".
        router.replace(NEU_EINRICHTEN_ADRESSE)
        return
      }
      if (res.ready) {
        toast.success('Dein Stripe-Konto ist bestätigt.')
      } else if (res.stufe === undefined || res.stufe === 'angaben_fehlen') {
        // Nur wenn der Hof bei Stripe noch etwas tun muss; sonst sagt es der Kasten (Register N49).
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
      <div className="flex flex-col gap-2">
        <button type="button" onClick={handleEinschalten} disabled={loading} className={HAUPT}>
          {loading ? <Warten /> : 'Online-Zahlung einschalten'}
        </button>
        <button type="button" onClick={handleRefresh} disabled={loading} className={NEBEN}>
          Status prüfen
        </button>
      </div>
    )
  }

  if (isReady) {
    return (
      <button type="button" onClick={handleRefresh} disabled={loading} className={NEBEN}>
        {loading ? <Warten /> : 'Status prüfen'}
      </button>
    )
  }

  // Der Hof wartet auf Stripe (Register N49): kein Weg ins Formular, nur prüfen.
  if (hasAccount && !neuEinrichten && !formularOffen) {
    return (
      <button type="button" onClick={handleRefresh} disabled={loading} className={NEBEN}>
        {loading ? <Warten /> : 'Status prüfen'}
      </button>
    )
  }

  return (
    // Der Hauptknopf über die volle Kartenbreite (Liste Lauf 32, hofdaten-zahlung „Knöpfe schmal“, Nr. 250);
    // „Status prüfen“ (C-Zeile) darunter.
    <div className="flex flex-col gap-2">
      <button type="button" onClick={handleSetup} disabled={loading} className={cn(HAUPT, 'gap-2')}>
        {loading ? (
          <Warten />
        ) : (
          <>
            <ExternalLink className="size-4" strokeWidth={1.7} aria-hidden="true" />
            {neuEinrichten ? NEU_EINRICHTEN_TITEL : hasAccount ? 'Einrichtung fortsetzen' : 'Mit Stripe einrichten'}
          </>
        )}
      </button>
      {/* Beim Neu-Einrichten gibt es nichts zu prüfen: Stripe kennt das alte Konto nicht. */}
      {hasAccount && !neuEinrichten && (
        <button type="button" onClick={handleRefresh} disabled={loading} className={NEBEN}>
          Status prüfen
        </button>
      )}
    </div>
  )
}
