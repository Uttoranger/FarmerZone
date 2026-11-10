'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { unsubscribeWithToken } from '@/server/actions/subscriptions'
import { KNOPF_GRUEN, KNOPF_RAHMEN } from '@/components/bestaetigung/bestaetigung-teile'
import { AbmeldenKarte, KARTEN_TEXT } from './abmelden-karte'
import { TEXTLINK } from '@/components/anmelden/stil'

// Seit Nr. 14 im neuen Design; Ablauf unverändert. Texte seit Lauf 30 nach Board s2/w2-abmelden
// („Neuigkeiten“ statt „Benachrichtigungen“, Wortliste N42 c). Der Name des Hofs fehlt: Die Seite
// kennt nur den Token, eine Abfrage dafür wäre eine neue Server-Funktion.
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
      <AbmeldenKarte ton="gruen" titel="Erfolgreich abgemeldet">
        {/* Auf der grünen Fläche in deren Schrift (Paar „läuft“, ErfolgKasten), nicht in KARTEN_TEXT. */}
        <p>Du erhältst keine Neuigkeiten mehr von diesem Hof.</p>
        <Link href="/account/profile" className={TEXTLINK}>
          Abonnements verwalten
        </Link>
      </AbmeldenKarte>
    )
  }

  if (state === 'error') {
    return (
      <AbmeldenKarte ton="orange" titel="Link ungültig">
        <p className={KARTEN_TEXT}>Dieser Abmelde-Link ist nicht mehr gültig oder wurde bereits verwendet.</p>
        <Link href="/account/profile" className={TEXTLINK}>
          Abonnements verwalten
        </Link>
      </AbmeldenKarte>
    )
  }

  return (
    <AbmeldenKarte titel="Abmelden?">
      <p className={KARTEN_TEXT}>
        Möchtest du dich von den Neuigkeiten dieses Hofs abmelden? Du kannst dich jederzeit wieder anmelden.
      </p>
      <div className="mt-1 flex w-full flex-col gap-1">
        <button type="button" onClick={handleUnsubscribe} disabled={loading} className={cn(KNOPF_GRUEN, 'h-[50px] w-full rounded-[14px] text-[15px] font-bold disabled:opacity-60')}>
          {loading ? 'Abmelden…' : 'Ja, abmelden'}
        </button>
        <Link href="/" className={cn(KNOPF_RAHMEN, 'w-full border-transparent text-[15px] font-bold')}>
          Zur Startseite
        </Link>
      </div>
    </AbmeldenKarte>
  )
}
