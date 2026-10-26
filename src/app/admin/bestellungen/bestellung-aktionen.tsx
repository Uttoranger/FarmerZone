'use client'

import { useId, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ADMIN_BESTELLUNG_TEXT as T } from '@/lib/admin-bestellung'
import { ADMIN_GRUND_MAX } from '@/schemas/admin-aktion'
import { markiereErstattungErledigt, notfallStorno, zeigeKundinAdresse } from '@/server/actions/admin-bestellung'
import { aktionOhneWurf } from '@/components/mein-hof/abschnitt-speichern'
import { useFrischBestaetigt } from '@/components/admin/frisch-bestaetigen'
import { BestellDialog, DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { FELD, FELD_LABEL, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { ZeichenZaehler } from '@/components/shared/zeichen-zaehler'
import { cn } from '@/lib/utils'

/** Das Grund-Feld jeder Aktion (N34: Pflicht) — 16 px, mit Zähler. */
function GrundFeld({ id, wert, setWert }: { id: string; wert: string; setWert: (w: string) => void }): React.JSX.Element {
  return (
    <div>
      <label htmlFor={id} className={FELD_LABEL}>
        {T.grund}
      </label>
      <textarea
        id={id}
        rows={2}
        value={wert}
        onChange={(e) => setWert(e.target.value)}
        aria-describedby={`${id}-hilfe`}
        className={cn(FELD, 'min-h-[72px] resize-none')}
      />
      <p id={`${id}-hilfe`} className={cn('mt-1 text-[12.5px]', LEISE)}>
        {T.grundHilfe}
      </p>
      <ZeichenZaehler laenge={[...wert.trim()].length} max={ADMIN_GRUND_MAX} />
    </div>
  )
}

type Dialog = 'ausserhalb' | 'kundin' | 'storno' | null

/**
 * Die Aktionen einer Bestellung im Admin (Register N34; Mockup
 * admin-bestellungen): „Außerhalb erstattet …“ (nur bei offener Erstattung),
 * „Kundin schreiben …“, „Hof schreiben“ und „Notfall-Storno …“ — je eine
 * Rückfrage mit Grund (Pflicht), dann die Bestätigung mit Passkey
 * (useFrischBestaetigt). Die Prüfungen macht der Server; die Oberfläche
 * bietet nur nicht an, was er ablehnen würde, und sagt am gesperrten Knopf,
 * warum (`aria-describedby`). Der Storno zeigt am Netz den Satz für
 * Aktionen, die der Server schon ausgeführt haben kann (N29-Ergänzung).
 */
export function BestellungAktionen({
  orderId,
  nummer,
  ausserhalbMoeglich,
  storno,
  hofFadenHref,
}: {
  orderId: string
  nummer: string
  ausserhalbMoeglich: boolean
  storno: { moeglich: true } | { moeglich: false; grund: string }
  hofFadenHref: string | null
}): React.JSX.Element {
  const router = useRouter()
  const id = useId()
  const [offen, setOffen] = useState<Dialog>(null)
  const [grund, setGrund] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [adresse, setAdresse] = useState<string | null>(null)
  const [laeuft, starte] = useTransition()
  const frischErledigt = useFrischBestaetigt(markiereErstattungErledigt)
  const frischAdresse = useFrischBestaetigt(zeigeKundinAdresse)
  const frischStorno = useFrischBestaetigt(notfallStorno)
  const ohneGrund = grund.trim() === '' || [...grund.trim()].length > ADMIN_GRUND_MAX

  function oeffne(d: Exclude<Dialog, null>): void {
    setGrund('')
    setFehler(null)
    setAdresse(null)
    setOffen(d)
  }

  function ausserhalb(): void {
    setFehler(null)
    starte(async () => {
      const ergebnis = await aktionOhneWurf(() => frischErledigt.ausfuehren({ orderId, grund }))
      if ('error' in ergebnis) return setFehler(ergebnis.error)
      setOffen(null)
      toast.success(T.ausserhalbFertig)
      router.refresh()
    })
  }

  function kundin(): void {
    setFehler(null)
    starte(async () => {
      const ergebnis = await aktionOhneWurf(() => frischAdresse.ausfuehren({ orderId, grund }))
      if ('error' in ergebnis) return setFehler(ergebnis.error)
      setAdresse(ergebnis.adresse)
    })
  }

  function stornieren(): void {
    setFehler(null)
    starte(async () => {
      const ergebnis = await aktionOhneWurf(() => frischStorno.ausfuehren({ orderId, grund }), { unsicher: true })
      if ('erstattungOffen' in ergebnis && ergebnis.erstattungOffen) {
        setOffen(null)
        toast.warning(T.notfallErstattungOffen, { duration: 10000 })
        router.refresh()
        return
      }
      if ('error' in ergebnis && ergebnis.error) return setFehler(ergebnis.error)
      setOffen(null)
      toast.success(T.notfallFertig)
      router.refresh()
    })
  }

  const schliessen = (o: boolean): void => {
    if (!o) setOffen(null)
  }
  const stornoGrundId = `${id}-storno-gesperrt`
  const hofGrundId = `${id}-hof-ohne-faden`

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-2.5">
        {ausserhalbMoeglich && (
          <button type="button" onClick={() => oeffne('ausserhalb')} className={cn(KNOPF_RAHMEN, 'font-semibold')}>
            {T.ausserhalbErstattet}
          </button>
        )}
        <button type="button" onClick={() => oeffne('kundin')} className={KNOPF_RAHMEN}>
          {T.kundinSchreiben}
        </button>
        {hofFadenHref ? (
          <Link href={hofFadenHref} className={KNOPF_RAHMEN}>
            {T.hofSchreiben}
          </Link>
        ) : (
          <button type="button" disabled aria-describedby={hofGrundId} className={cn(KNOPF_RAHMEN, 'opacity-60')}>
            {T.hofSchreiben}
          </button>
        )}
        <button
          type="button"
          onClick={() => oeffne('storno')}
          disabled={!storno.moeglich}
          aria-describedby={storno.moeglich ? undefined : stornoGrundId}
          className={cn(KNOPF_RAHMEN, !storno.moeglich && 'opacity-60')}
        >
          {T.notfallStorno}
        </button>
      </div>
      {!storno.moeglich && (
        <p id={stornoGrundId} className={cn('text-[12.5px] leading-relaxed', LEISE)}>
          {storno.grund}
        </p>
      )}
      {!hofFadenHref && (
        <p id={hofGrundId} className={cn('text-[12.5px] leading-relaxed', LEISE)}>
          {T.hofOhneFaden}
        </p>
      )}
      <p className={cn('text-[12.5px]', LEISE)}>{T.passkeyHinweis}</p>

      <BestellDialog
        offen={offen === 'ausserhalb'}
        onOffenChange={schliessen}
        titel={T.ausserhalbTitel}
        unterzeile={nummer}
        hauptaktion={{ text: T.ausserhalbKnopf, onClick: ausserhalb, ton: 'gruen', laeuft, gesperrt: ohneGrund }}
      >
        {frischErledigt.dialog}
        <p className="text-[14px] leading-relaxed text-muted-foreground">{T.ausserhalbSatz}</p>
        <GrundFeld id={`${id}-grund-ausserhalb`} wert={grund} setWert={setGrund} />
        <DialogFehler text={fehler} />
      </BestellDialog>

      <BestellDialog
        offen={offen === 'kundin'}
        onOffenChange={schliessen}
        titel={T.kundinTitel}
        unterzeile={nummer}
        hauptaktion={{ text: T.kundinKnopf, onClick: kundin, ton: 'gruen', laeuft, gesperrt: ohneGrund || adresse !== null }}
      >
        {frischAdresse.dialog}
        {adresse === null ? (
          <>
            <p className="text-[14px] leading-relaxed text-muted-foreground">{T.kundinSatz}</p>
            <GrundFeld id={`${id}-grund-kundin`} wert={grund} setWert={setGrund} />
          </>
        ) : (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-background px-4 py-3.5">
            <p className={cn('text-[12.5px]', LEISE)}>{T.kundinAdresse}</p>
            <p className="text-[15px] font-semibold break-all text-foreground">{adresse}</p>
            <a href={`mailto:${adresse}`} className={cn(KNOPF_RAHMEN, 'self-start')}>
              {T.kundinMail}
            </a>
          </div>
        )}
        <DialogFehler text={fehler} />
      </BestellDialog>

      <BestellDialog
        offen={offen === 'storno'}
        onOffenChange={schliessen}
        titel={T.notfallTitel(nummer)}
        hauptaktion={{ text: T.notfallKnopf, onClick: stornieren, ton: 'orange', laeuft, gesperrt: ohneGrund }}
      >
        {frischStorno.dialog}
        <p className="text-[14px] leading-relaxed text-muted-foreground">{T.notfallSatz}</p>
        <GrundFeld id={`${id}-grund-storno`} wert={grund} setWert={setGrund} />
        <DialogFehler text={fehler} />
      </BestellDialog>
    </div>
  )
}
