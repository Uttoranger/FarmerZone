'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { klaereRueckbuchung } from '@/server/actions/admin-plattformgebuehr'
import { RUECKBUCHUNG_TEXT, SPERRE_TEXT } from '@/lib/admin-hof-akte'
import { ADMIN_GRUND_MAX } from '@/schemas/admin-aktion'
import { BestellDialog, DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { FELD, FELD_LABEL } from '@/components/hof-bestellungen/stil'
import { useFrischBestaetigt } from '@/components/admin/frisch-bestaetigen'

/** Welche zurückgebuchte Abrechnung geklärt wird — Kennung und Monat als Wort. */
export type RueckbuchungWahl = { abrechnungId: string; monatText: string }

/**
 * „Sperre nach Rückbuchung aufheben“ (Notweg, Nr. 290, A007) — gebaut wie
 * `HofSperreDialog`: ab 768 px der zentrierte Dialog, am Handy ein Blatt
 * (BestellDialog mit `mitte`), Grund Pflicht (steht im Protokoll), frisch mit
 * Passkey. Ob die Person das Recht „Geld“ hat, prüft der Server.
 */
export function RueckbuchungKlaerenDialog({ wahl, onClose }: { wahl: RueckbuchungWahl | null; onClose: () => void }): React.JSX.Element {
  // Grund und Fehler starten bei jedem Öffnen frisch.
  return <Inhalt key={wahl?.abrechnungId ?? 'zu'} wahl={wahl} onClose={onClose} />
}

function Inhalt({ wahl, onClose }: { wahl: RueckbuchungWahl | null; onClose: () => void }): React.JSX.Element {
  const router = useRouter()
  const [laeuft, startTransition] = useTransition()
  const [grund, setGrund] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const frisch = useFrischBestaetigt(klaereRueckbuchung)

  function bestaetigen(): void {
    if (!wahl) return
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await frisch.ausfuehren({ abrechnungId: wahl.abrechnungId, grund })
      if ('error' in ergebnis) {
        setFehler(ergebnis.error)
        return
      }
      toast.success(RUECKBUCHUNG_TEXT.erledigt)
      onClose()
      router.refresh()
    })
  }

  return (
    <>
      {/* Der Passkey-Dialog neben, nicht in dem Dialog: Er muss auch erscheinen, wenn dieser sich schließt (wie HofSperreDialog). */}
      {frisch.dialog}
      <BestellDialog
        mitte
        offen={wahl !== null}
        onOffenChange={(offen) => {
          if (!offen) onClose()
        }}
        titel={RUECKBUCHUNG_TEXT.titel}
        unterzeile={wahl?.monatText}
        hauptaktion={{ text: RUECKBUCHUNG_TEXT.bestaetigen, onClick: bestaetigen, ton: 'gruen', laeuft, gesperrt: grund.trim() === '' }}
      >
        <div className="flex flex-col gap-3.5">
          <p className="text-[14px] leading-relaxed text-foreground">{RUECKBUCHUNG_TEXT.erklaerung}</p>
          <div>
            <label htmlFor="rueckbuchung-grund" className={FELD_LABEL}>
              {RUECKBUCHUNG_TEXT.grundLabel}
            </label>
            <textarea
              id="rueckbuchung-grund"
              value={grund}
              maxLength={ADMIN_GRUND_MAX}
              rows={3}
              aria-describedby="rueckbuchung-grund-hilfe"
              aria-invalid={fehler !== null || undefined}
              onChange={(e) => {
                setGrund(e.target.value)
                setFehler(null)
              }}
              className={FELD}
            />
            <p id="rueckbuchung-grund-hilfe" className="mt-1 text-[12.5px] text-muted-foreground">
              {SPERRE_TEXT.grundHilfe}
            </p>
          </div>
          <DialogFehler text={fehler} />
        </div>
      </BestellDialog>
    </>
  )
}
