'use client'

import { useCallback, useRef, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { FRISCH_FEHLER, FRISCH_TEXT, passkeyFehlerText } from '@/lib/admin-anmeldung'
import { passkeySignIn } from '@/lib/auth-client-passkey'
import { BestellDialog, DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { Marke } from '@/components/ui/marke'

/** Antwortet eine Admin-Aktion mit `{ error: 'frisch' }` (verlangeFrischeBestaetigung)? */
function verlangtFrische(ergebnis: unknown): boolean {
  return typeof ergebnis === 'object' && ergebnis !== null && 'error' in ergebnis && (ergebnis as { error: unknown }).error === FRISCH_FEHLER
}

/**
 * Der Dialog „Bitte bestätige mit deinem Passkey" (Register N20; Mockup
 * system-admin-anmeldung-passkey, Schritt 3) — ab 768 px Dialog, darunter
 * Blatt (BestellDialog). Der Knopf meldet mit Passkey neu an
 * (`signIn.passkey()`): Der Server lässt nur einen Passkey DIESES Kontos zu
 * und ersetzt dessen Sitzung (src/lib/auth.ts) — ein fremder bricht mit
 * „Dieser Passkey gehört zu einem anderen Konto." ab, die Sitzung bleibt.
 */
function FrischBestaetigenDialog({
  offen,
  laeuft,
  fehler,
  satz,
  onBestaetigen,
  onOffenChange,
}: {
  offen: boolean
  laeuft: boolean
  fehler: string | null
  satz: string
  onBestaetigen: () => void
  onOffenChange: (offen: boolean) => void
}): React.JSX.Element {
  return (
    <BestellDialog
      offen={offen}
      onOffenChange={onOffenChange}
      titel={FRISCH_TEXT.titel}
      unterzeile={satz}
      hauptaktion={{ text: FRISCH_TEXT.knopf, onClick: onBestaetigen, ton: 'gruen', laeuft }}
    >
      <div className="flex flex-col gap-3">
        <Marke art="tun" symbol={KeyRound} className="self-start">
          {FRISCH_TEXT.marke}
        </Marke>
        <p className="text-[13px] leading-relaxed text-muted-foreground">{FRISCH_TEXT.hinweis}</p>
        <DialogFehler text={fehler} />
      </div>
    </BestellDialog>
  )
}

/**
 * Umhüllt den Aufruf einer heiklen Admin-Aktion (N20): Antwortet sie mit
 * `{ error: 'frisch' }`, öffnet der Dialog; nach der Bestätigung mit Passkey
 * läuft die Aktion genau EINMAL erneut, ihr Ergebnis geht an den Aufrufer.
 * Abgebrochen → `{ error: FRISCH_TEXT.nichtBestaetigt }`. Kommen zwei Aufrufe
 * zugleich (zwei Klicks aus demselben Render), teilen sie sich EINEN Dialog,
 * und jeder läuft nach der Bestätigung einmal. `dialog` gehört in den Baum
 * des Aufrufers — in einem Dialog am besten in dessen Inhalt (verschachtelt).
 */
export function useFrischBestaetigt<A extends unknown[], R>(
  aktion: (...args: A) => Promise<R>,
  satz: string = FRISCH_TEXT.satz
): { ausfuehren: (...args: A) => Promise<R | { error: string }>; dialog: React.JSX.Element } {
  const [offen, setOffen] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  // Alle Aufrufe, die auf die Bestätigung warten — eine Liste, nicht ein Platz:
  // Ein zweiter Aufruf darf den ersten nicht verwaisen lassen.
  const wartend = useRef<Array<(bestaetigt: boolean) => void>>([])

  const beende = useCallback((bestaetigt: boolean): void => {
    const alle = wartend.current
    wartend.current = []
    setOffen(false)
    for (const weiter of alle) weiter(bestaetigt)
  }, [])

  const ausfuehren = useCallback(
    async (...args: A): Promise<R | { error: string }> => {
      const erst = await aktion(...args)
      if (!verlangtFrische(erst)) return erst
      const bestaetigt = await new Promise<boolean>((weiter) => {
        wartend.current.push(weiter)
        setFehler(null)
        setOffen(true)
      })
      if (!bestaetigt) return { error: FRISCH_TEXT.nichtBestaetigt }
      const zweit = await aktion(...args)
      return verlangtFrische(zweit) ? { error: FRISCH_TEXT.nichtBestaetigt } : zweit
    },
    [aktion]
  )

  async function bestaetigen(): Promise<void> {
    setLaeuft(true)
    setFehler(null)
    try {
      const { error } = await passkeySignIn.passkey()
      if (error) {
        setFehler(passkeyFehlerText(error))
        return
      }
      beende(true)
    } finally {
      setLaeuft(false)
    }
  }

  const dialog = (
    <FrischBestaetigenDialog
      offen={offen}
      laeuft={laeuft}
      fehler={fehler}
      satz={satz}
      onBestaetigen={() => void bestaetigen()}
      onOffenChange={(o) => {
        if (!o) beende(false)
      }}
    />
  )
  return { ausfuehren, dialog }
}
