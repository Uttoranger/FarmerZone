'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BellOff, CheckCircle, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { unsubscribeWithToken } from '@/server/actions/subscriptions'
import { KNOPF_GRUEN, KNOPF_RAHMEN } from '@/components/bestaetigung/bestaetigung-teile'
import { AbmeldenKarte, TEXTLINK } from './abmelden-karte'

// Seit Nr. 14 im neuen Design; Ablauf und Texte unverändert.
export function UnsubscribeClient({ token }: { token: string }): React.JSX.Element {
  const [state, setState] = useState<'confirm' | 'done' | 'error'>('confirm')
  const [loading, setLoading] = useState(false)

  async function handleUnsubscribe() {
    setLoading(true)
    const result = await unsubscribeWithToken(token)
    setLoading(false)
    if (result.error) {
      setState('error')
    } else {
      setState('done')
    }
  }

  if (state === 'done') {
    return (
      <AbmeldenKarte symbol={CheckCircle} ton="gruen" titel="Erfolgreich abgemeldet">
        <p className="text-[13.5px] leading-normal text-muted-foreground">Du erhältst keine Neuigkeiten mehr von diesem Hof.</p>
        <Link href="/account/profile" className={TEXTLINK}>
          Alle Abonnements verwalten
        </Link>
      </AbmeldenKarte>
    )
  }

  if (state === 'error') {
    return (
      <AbmeldenKarte symbol={TriangleAlert} ton="orange" titel="Link ungültig">
        <p className="text-[13.5px] leading-normal text-muted-foreground">Dieser Abmelde-Link ist nicht mehr gültig.</p>
        <Link href="/account/profile" className={TEXTLINK}>
          Abonnements selbst verwalten
        </Link>
      </AbmeldenKarte>
    )
  }

  return (
    <AbmeldenKarte symbol={BellOff} titel="Abmelden?">
      <p className="text-[13.5px] leading-relaxed text-muted-foreground">
        Möchtest du dich von den Benachrichtigungen dieses Hofes abmelden? Du kannst dich jederzeit wieder anmelden.
      </p>
      <div className="mt-2 flex w-full flex-col gap-2">
        <button type="button" onClick={handleUnsubscribe} disabled={loading} className={cn(KNOPF_GRUEN, 'w-full disabled:opacity-60')}>
          {loading ? 'Abmelden…' : 'Ja, abmelden'}
        </button>
        <Link href="/" className={cn(KNOPF_RAHMEN, 'w-full border-transparent')}>
          Abbrechen
        </Link>
      </div>
    </AbmeldenKarte>
  )
}
