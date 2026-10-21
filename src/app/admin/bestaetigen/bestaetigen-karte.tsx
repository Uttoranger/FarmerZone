'use client'

import { useEffect, useState } from 'react'
import { Download, KeyRound, Loader2 } from 'lucide-react'
import { DOWNLOAD_SPERRE_MS, FRISCH_TEXT, passkeyFehlerText } from '@/lib/admin-anmeldung'
import { passkeySignIn } from '@/lib/auth-client-passkey'
import { cn } from '@/lib/utils'
import { Marke } from '@/components/ui/marke'
import { DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { KNOPF_GRUEN } from '@/components/hof-bestellungen/stil'

/**
 * Die Karte auf /admin/bestaetigen (Register N20): „Mit Passkey bestätigen",
 * danach weiter zu `weiter` — vom Server schon auf einen Pfad unter /admin
 * beschränkt (sichererWeiterPfad). Für die CSV-Exporte: Der Download startet
 * danach im selben Fenster; die Seite bleibt stehen, darum sagt ein Hinweis
 * (role="status") „Der Download startet …“, und der Knopf bleibt
 * `DOWNLOAD_SPERRE_MS` gesperrt — ein zweiter Klick finge eine zweite
 * Bestätigung und einen zweiten Download an (Nr. 126).
 */
export function BestaetigenKarte({ weiter }: { weiter: string }): React.JSX.Element {
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [gestartet, setGestartet] = useState(false)

  useEffect(() => {
    if (!gestartet) return
    const timer = setTimeout(() => setGestartet(false), DOWNLOAD_SPERRE_MS)
    return () => clearTimeout(timer)
  }, [gestartet])

  async function bestaetigen(): Promise<void> {
    setLaeuft(true)
    setFehler(null)
    try {
      const { error } = await passkeySignIn.passkey()
      if (error) {
        setFehler(passkeyFehlerText(error))
        return
      }
      setGestartet(true)
      window.location.assign(weiter)
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <section aria-labelledby="bestaetigen-titel" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <Marke art="tun" symbol={KeyRound} className="self-start">
        {FRISCH_TEXT.marke}
      </Marke>
      <h2 id="bestaetigen-titel" className="font-heading text-xl font-semibold text-foreground">
        {FRISCH_TEXT.titel}
      </h2>
      <p className="text-[14px] leading-normal text-muted-foreground">{FRISCH_TEXT.seitenSatz}</p>
      <button
        type="button"
        onClick={() => void bestaetigen()}
        disabled={laeuft || gestartet}
        aria-busy={laeuft || undefined}
        className={cn(KNOPF_GRUEN, 'self-start')}
      >
        {laeuft ? <Loader2 className="size-4 animate-spin" strokeWidth={1.8} aria-hidden="true" /> : <KeyRound className="size-4" strokeWidth={1.8} aria-hidden="true" />}
        {laeuft ? FRISCH_TEXT.knopfLaeuft : FRISCH_TEXT.knopf}
      </button>
      {/* Der Bereich steht schon da, bevor etwas drinsteht: Nur so sagt ihn ein Screenreader an. */}
      <p role="status" className="flex items-center gap-2 text-[14px] font-medium text-foreground empty:hidden">
        {gestartet && (
          <>
            <Download className="size-4 shrink-0 text-status-fertig" strokeWidth={1.8} aria-hidden="true" />
            {FRISCH_TEXT.downloadStartet}
          </>
        )}
      </p>
      <p className="text-[12.5px] leading-snug text-muted-foreground">{FRISCH_TEXT.hinweis}</p>
      <DialogFehler text={fehler} />
    </section>
  )
}
