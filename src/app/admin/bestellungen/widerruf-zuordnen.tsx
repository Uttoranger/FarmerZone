'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ADMIN_BESTELLUNG_TEXT as T } from '@/lib/admin-bestellung'
import { WIDERRUF_ADMIN_TEXT as W, WIDERRUF_GRENZEN } from '@/lib/widerruf'
import { ADMIN_GRUND_MAX } from '@/schemas/admin-aktion'
import { ordneWiderrufZu } from '@/server/actions/admin-bestellung'
import { aktionOhneWurf } from '@/components/mein-hof/abschnitt-speichern'
import { useFrischBestaetigt } from '@/components/admin/frisch-bestaetigen'
import { BestellDialog, DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { FELD, FELD_LABEL, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { ZeichenZaehler } from '@/components/shared/zeichen-zaehler'
import { cn } from '@/lib/utils'

/**
 * „Zuordnen …“ eines Widerrufs ohne Bestellung (Nachbesserung Runde 2 zu
 * Nr. 200): Rückfrage mit dem Text der Kundin (nur hier, im Dialog für
 * Admins), Bestellnummer und Grund (Pflicht), dann die Bestätigung mit
 * Passkey (useFrischBestaetigt) — wie die übrigen Aktionen der Seite. Das
 * Zuordnen kann vor der Abholung einen Storno mit Erstattung auslösen; am
 * Netz gilt deshalb der Satz für Aktionen, die der Server schon ausgeführt
 * haben kann (N29-Ergänzung).
 */
export function WiderrufZuordnen({ widerrufId, name, nachricht }: { widerrufId: string; name: string; nachricht: string | null }): React.JSX.Element {
  const router = useRouter()
  const id = useId()
  const [offen, setOffen] = useState(false)
  const [nummer, setNummer] = useState('')
  const [grund, setGrund] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, starte] = useTransition()
  const frisch = useFrischBestaetigt(ordneWiderrufZu)
  const gesperrt = nummer.trim() === '' || grund.trim() === '' || [...grund.trim()].length > ADMIN_GRUND_MAX

  function oeffne(): void {
    setNummer('')
    setGrund('')
    setFehler(null)
    setOffen(true)
  }

  function zuordnen(): void {
    setFehler(null)
    starte(async () => {
      const ergebnis = await aktionOhneWurf(() => frisch.ausfuehren({ widerrufId, bestellnummer: nummer, grund }), { unsicher: true })
      if ('error' in ergebnis) return setFehler(ergebnis.error)
      setOffen(false)
      toast.success(ergebnis.weiter === 'erstattet' ? W.fertigErstattet : W.fertigHof)
      router.refresh()
    })
  }

  return (
    <>
      <button type="button" onClick={oeffne} className={cn(KNOPF_RAHMEN, 'font-semibold')}>
        {W.zuordnen}
      </button>
      <BestellDialog
        offen={offen}
        onOffenChange={(o) => {
          if (!o) setOffen(false)
        }}
        titel={W.zuordnenTitel}
        unterzeile={name}
        hauptaktion={{ text: W.zuordnenKnopf, onClick: zuordnen, ton: 'orange', laeuft, gesperrt }}
      >
        {frisch.dialog}
        <p className="text-[14px] leading-relaxed text-muted-foreground">{W.zuordnenSatz}</p>
        {nachricht && (
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <p className={cn('text-[12.5px]', LEISE)}>{W.nachricht}</p>
            <p className="mt-1 text-[14px] leading-relaxed break-words whitespace-pre-line text-foreground">{nachricht}</p>
          </div>
        )}
        <div>
          <label htmlFor={`${id}-nummer`} className={FELD_LABEL}>
            {W.bestellnummer}
          </label>
          <input
            id={`${id}-nummer`}
            value={nummer}
            onChange={(e) => setNummer(e.target.value)}
            maxLength={WIDERRUF_GRENZEN.bestellnummer}
            autoComplete="off"
            spellCheck={false}
            className={cn(FELD, 'min-h-11 uppercase')}
          />
        </div>
        <div>
          <label htmlFor={`${id}-grund`} className={FELD_LABEL}>
            {T.grund}
          </label>
          <textarea
            id={`${id}-grund`}
            rows={2}
            value={grund}
            onChange={(e) => setGrund(e.target.value)}
            aria-describedby={`${id}-grund-hilfe`}
            className={cn(FELD, 'min-h-[72px] resize-none')}
          />
          <p id={`${id}-grund-hilfe`} className={cn('mt-1 text-[12.5px]', LEISE)}>
            {T.grundHilfe}
          </p>
          <ZeichenZaehler laenge={[...grund.trim()].length} max={ADMIN_GRUND_MAX} />
        </div>
        <DialogFehler text={fehler} />
      </BestellDialog>
    </>
  )
}
