'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { setServiceFeeAction } from '@/server/actions/admin'
import { SERVICEGEBUEHR_ADMIN_ERKLAERUNG, centsAlsEuro } from '@/lib/servicegebuehr'
import { MINDESTGEBUEHR_UNGUELTIG, SERVICEGEBUEHR_NUR_NEUE, mindestgebuehrCent, type AdminHofZeile } from '@/lib/admin-hoefe'
import { formatEuro } from '@/lib/format'
import { BestellDialog, DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { FELD, FELD_LABEL, TEXT_GRUEN } from '@/components/hof-bestellungen/stil'

/**
 * Die Servicegebühr eines Hofs einstellen (Sprint servicegebuehr, Teil E; im
 * neuen Design seit Nr. 22f): Prozentsatz, Mindestgebühr und „gilt ab" oder
 * leer = gebührenfrei. Gespeichert wird über die bestehende
 * setServiceFeeAction, die alles prüft; sie wirkt nur auf neue Bestellungen —
 * jede Bestellung friert ihre Gebühr zur Bestellzeit ein.
 *
 * Darüber stehen die Monatsspalten des Hofs (Bestellungen, online
 * einbehalten, bar offen, entfallen) wie vorher in der Liste.
 */
export function ServicegebuehrDialog({ hof, onClose }: { hof: AdminHofZeile | null; onClose: () => void }): React.JSX.Element {
  // Die Felder starten bei jedem Hof frisch — deshalb hängt der Schlüssel am Hof.
  return <Formular key={hof?.id ?? 'zu'} hof={hof} onClose={onClose} />
}

function Formular({ hof, onClose }: { hof: AdminHofZeile | null; onClose: () => void }): React.JSX.Element {
  const [laeuft, startTransition] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)
  // Formularzustand als Text — <input type="number"> liefert Text, und der
  // Server prüft ohnehin (servicegebuehrEinstellungSchema).
  const [prozent, setProzent] = useState(hof?.gebuehr.prozent ?? '')
  const [mindestEuro, setMindestEuro] = useState(hof ? (hof.gebuehr.mindestCents / 100).toFixed(2) : '')
  const [giltAb, setGiltAb] = useState(hof?.gebuehr.giltAbTag ?? '')

  function speichern() {
    if (!hof) return
    setFehler(null)
    // Euro-Text → ganze Cent über die Ziffern, nie über Number (Nr. 32). Kein
    // Betrag → Satz hier; Rohtext geht nie an den Server, der nur Cent nimmt.
    const mindest = mindestgebuehrCent(mindestEuro)
    if (mindest === null) {
      setFehler(MINDESTGEBUEHR_UNGUELTIG)
      return
    }
    startTransition(async () => {
      const ergebnis = await setServiceFeeAction(hof.id, {
        percent: prozent.replace(',', '.'),
        minCents: mindest,
        activeFrom: giltAb,
      })
      if (ergebnis.error) {
        setFehler(ergebnis.error)
        return
      }
      toast.success(giltAb ? 'Servicegebühr gespeichert' : 'Hof ist gebührenfrei')
      onClose()
    })
  }

  return (
    <BestellDialog
      offen={hof !== null}
      onOffenChange={(offen) => {
        if (!offen) onClose()
      }}
      titel="Servicegebühr"
      unterzeile={hof?.name}
      breite="breit"
      hauptaktion={{ text: 'Speichern', onClick: speichern, ton: 'gruen', laeuft }}
    >
      {hof && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            speichern()
          }}
        >
          <p className="text-[13.5px] text-muted-foreground">
            Jetzt: <span className="text-foreground">{hof.satzLang}</span>
          </p>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-border bg-background px-3.5 py-3 text-[13px] sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">{hof.monatBezeichnung}</dt>
              <dd className="font-semibold text-foreground tabular-nums">
                {hof.monat.bestellungen} {hof.monat.bestellungen === 1 ? 'Bestellung' : 'Bestellungen'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">online einbehalten</dt>
              <dd className="font-semibold text-foreground tabular-nums">{formatEuro(centsAlsEuro(hof.monat.gebuehrOnlineCents))}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">bar offen</dt>
              <dd className="font-semibold text-foreground tabular-nums">{formatEuro(centsAlsEuro(hof.monat.gebuehrBarCents))}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">entfallen</dt>
              <dd className="font-semibold text-foreground tabular-nums">{formatEuro(centsAlsEuro(hof.monat.gebuehrEntfallenCents))}</dd>
            </div>
          </dl>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className={FELD_LABEL}>Prozentsatz (%)</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                max="100"
                value={prozent}
                onChange={(e) => setProzent(e.target.value)}
                className={FELD}
              />
            </label>
            <label className="block">
              <span className={FELD_LABEL}>Mindestgebühr (€)</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={mindestEuro}
                onChange={(e) => setMindestEuro(e.target.value)}
                className={FELD}
              />
            </label>
            <label className="block">
              <span className={FELD_LABEL}>Gebühr gilt ab</span>
              <input type="date" value={giltAb} onChange={(e) => setGiltAb(e.target.value)} className={FELD} />
              <span className="mt-1 block text-[12px] text-muted-foreground">Leer = gebührenfrei</span>
            </label>
          </div>

          {giltAb !== '' && (
            <button type="button" onClick={() => setGiltAb('')} disabled={laeuft} className={`${TEXT_GRUEN} self-start`}>
              Gebührenfrei stellen
            </button>
          )}

          <p className="text-[12.5px] text-muted-foreground">
            {SERVICEGEBUEHR_NUR_NEUE} {SERVICEGEBUEHR_ADMIN_ERKLAERUNG}
          </p>
          <DialogFehler text={fehler} />
        </form>
      )}
    </BestellDialog>
  )
}
