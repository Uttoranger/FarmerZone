'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BellOff, CheckCircle } from 'lucide-react'
import { unsubscribeWithToken } from '@/server/actions/subscriptions'
import { Button } from '@/components/ui/button'

export function UnsubscribeClient({ token }: { token: string }) {
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-sm w-full">
        {state === 'confirm' && (
          <>
            <BellOff className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="font-heading text-xl font-semibold text-foreground mb-2">
              Abmelden?
            </h1>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Möchtest du dich von den Benachrichtigungen dieses Hofes abmelden?
              Du kannst dich jederzeit wieder anmelden.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={handleUnsubscribe} disabled={loading} variant="destructive">
                {loading ? 'Abmelden…' : 'Ja, abmelden'}
              </Button>
              <Link href="/">
                <Button variant="ghost" className="w-full">
                  Abbrechen
                </Button>
              </Link>
            </div>
          </>
        )}

        {state === 'done' && (
          <>
            <CheckCircle className="w-12 h-12 text-primary mx-auto mb-4" />
            <h1 className="font-heading text-xl font-semibold text-foreground mb-2">
              Erfolgreich abgemeldet
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              Du erhältst keine Neuigkeiten mehr von diesem Hof.
            </p>
            <Link href="/account/profile" className="text-sm text-primary underline underline-offset-2">
              Alle Abonnements verwalten →
            </Link>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="text-4xl mb-4">⚠️</div>
            <h1 className="font-heading text-xl font-semibold text-foreground mb-2">
              Link ungültig
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              Dieser Abmelde-Link ist nicht mehr gültig.
            </p>
            <Link href="/account/profile" className="text-sm text-primary underline underline-offset-2">
              Abonnements selbst verwalten →
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
