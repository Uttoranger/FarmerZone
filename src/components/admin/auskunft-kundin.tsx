'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { exportiereAuskunftKundin } from '@/server/actions/konto-anfragen'
import { KONTO_ANFRAGE_TEXT } from '@/lib/konto-anfragen'
import { ADMIN_GRUND_MAX } from '@/schemas/admin-aktion'
import { EMAIL_MAX } from '@/lib/eingabegrenzen'
import { cn } from '@/lib/utils'
import { BestellDialog, DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { FELD, FELD_LABEL, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { useFrischBestaetigt } from '@/components/admin/frisch-bestaetigen'
import { ladeHerunter } from '@/components/admin/hof-akte-konto'

const T = KONTO_ANFRAGE_TEXT.auskunftKundin

/**
 * „Auskunft für die Kundschaft …“ in Admin › Bestellungen (Register N36,
 * Nr. 190): genaue Adresse und Grund, frisch mit Passkey, dann lädt der
 * Browser die JSON-Datei — Bestellungen, Abos und Sitzungen ohne IP zu genau
 * dieser Adresse. Der Dateiname trägt weder Adresse noch Namen.
 */
export function AuskunftKundin(): React.JSX.Element {
  const [offen, setOffen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOffen(true)} className={KNOPF_RAHMEN}>
        {T.knopf}
      </button>
      <Inhalt key={String(offen)} offen={offen} onClose={() => setOffen(false)} />
    </>
  )
}

function Inhalt({ offen, onClose }: { offen: boolean; onClose: () => void }): React.JSX.Element {
  const [laeuft, startTransition] = useTransition()
  const [adresse, setAdresse] = useState('')
  const [grund, setGrund] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const frisch = useFrischBestaetigt(exportiereAuskunftKundin)

  function bestaetigen(): void {
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await frisch.ausfuehren({ adresse, grund })
      if ('error' in ergebnis) return setFehler(ergebnis.error)
      ladeHerunter(ergebnis.dateiname, ergebnis.inhalt)
      toast.success(T.erledigt)
      onClose()
    })
  }

  return (
    <>
      {frisch.dialog}
      <BestellDialog
        offen={offen}
        onOffenChange={(o) => !o && onClose()}
        titel={T.titel}
        hauptaktion={{ text: T.knopf2, onClick: bestaetigen, ton: 'gruen', laeuft, gesperrt: adresse.trim() === '' || grund.trim() === '' }}
      >
        <div className="flex flex-col gap-3.5">
          <p className="text-[14px] leading-relaxed text-foreground">{T.satz}</p>
          <div>
            <label htmlFor="auskunft-adresse" className={FELD_LABEL}>
              {T.feld}
            </label>
            <input
              id="auskunft-adresse"
              type="email"
              inputMode="email"
              autoComplete="off"
              spellCheck={false}
              maxLength={EMAIL_MAX}
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              className={cn(FELD, 'min-h-11')}
            />
          </div>
          <div>
            <label htmlFor="auskunft-grund" className={FELD_LABEL}>
              {KONTO_ANFRAGE_TEXT.grundLabel}
            </label>
            <textarea
              id="auskunft-grund"
              value={grund}
              maxLength={ADMIN_GRUND_MAX}
              rows={2}
              aria-describedby="auskunft-grund-hilfe"
              onChange={(e) => setGrund(e.target.value)}
              className={FELD}
            />
            <p id="auskunft-grund-hilfe" className={cn('mt-1 text-[12.5px]', LEISE)}>
              {KONTO_ANFRAGE_TEXT.grundHilfe}
            </p>
          </div>
          <DialogFehler text={fehler} />
        </div>
      </BestellDialog>
    </>
  )
}
