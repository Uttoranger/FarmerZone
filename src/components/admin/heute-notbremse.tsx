'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { gibBestellungenFrei, halteBestellungenAn } from '@/server/actions/notbremse'
import { aktionOhneWurf } from '@/components/mein-hof/abschnitt-speichern'
import { useFrischBestaetigt } from '@/components/admin/frisch-bestaetigen'
import { BestellDialog, DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { FELD, FELD_LABEL, KARTE, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import {
  NOTBREMSE_ADMIN_TEXT as T,
  NOTBREMSE_GRUENDE,
  NOTBREMSE_SATZ_MAX,
  NOTBREMSE_SATZ_VORGABE,
  notbremseBisGrenzen,
  notbremseBisVorgabe,
  notbremseEingabe,
  zeitpunktLokal,
  type NotbremseGrund,
} from '@/lib/notbremse'
import { cn } from '@/lib/utils'

/*
 * Die Notbremse in Admin › Heute (Register N34, Nr. 189 Punkt 4; Mockups
 * admin-heute, mobil-admin-heute, mobil-admin-notbremse): „Bestellungen
 * anhalten …“ öffnet ab 768 px einen Dialog, darunter ein Blatt (BestellDialog);
 * „Freigeben“ steht an der Aufgabe „Notbremse aktiv“. Beide gehen über die
 * vorhandenen Actions mit Passkey-Bestätigung (useFrischBestaetigt) wie die
 * übrigen frischen Admin-Aktionen. Die Oberfläche prüft nur vor — Recht,
 * Frische, Grund, Satz und „bis“ entscheidet der Server.
 */

/** Zerstörend: Orange-Umriss und orange Schrift (Mockup; Register O1: kein Fehler-Token) — nie Grün. */
const KNOPF_ANHALTEN = cn(KNOPF_RAHMEN, 'border-primary/60 font-semibold text-status-offen')

type FormularProps = {
  grund: NotbremseGrund
  satz: string
  bis: string
  min: string
  max: string
  setGrund: (g: NotbremseGrund) => void
  setSatz: (s: string) => void
  setBis: (b: string) => void
}

/** Die Felder des Blatts — ohne Zustand, damit sie sich ohne DOM prüfen lassen (tests/notbremse.test.ts). */
export function NotbremseFormular({ grund, satz, bis, min, max, setGrund, setSatz, setBis }: FormularProps): React.JSX.Element {
  const id = useId()
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor={`${id}-grund`} className={FELD_LABEL}>
          {T.grund}
        </label>
        <select id={`${id}-grund`} value={grund} onChange={(e) => setGrund(e.target.value as NotbremseGrund)} className={cn(FELD, 'min-h-12')}>
          {NOTBREMSE_GRUENDE.map((g) => (
            <option key={g.wert} value={g.wert}>
              {g.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-satz`} className={FELD_LABEL}>
          {T.kundschaft}
        </label>
        <textarea
          id={`${id}-satz`}
          rows={2}
          value={satz}
          maxLength={NOTBREMSE_SATZ_MAX}
          onChange={(e) => setSatz(e.target.value)}
          className={cn(FELD, 'min-h-[72px] resize-y')}
        />
      </div>
      <p className="rounded-xl border border-border bg-muted px-3 py-2.5 text-[12.5px] leading-relaxed text-foreground">
        <b className="font-semibold">{T.soSiehtEs}</b> {T.soSiehtEsSatz}
      </p>
      <div>
        <label htmlFor={`${id}-bis`} className={FELD_LABEL}>
          {T.bis}
        </label>
        <input
          id={`${id}-bis`}
          type="datetime-local"
          required
          value={bis}
          min={min}
          max={max}
          aria-describedby={`${id}-bis-hinweis`}
          onChange={(e) => setBis(e.target.value)}
          className={cn(FELD, 'min-h-12')}
        />
        <p id={`${id}-bis-hinweis`} className={cn('mt-1 text-[12.5px]', LEISE)}>
          {T.bisHinweis}
        </p>
      </div>
    </div>
  )
}

/**
 * „Bestellungen anhalten …“ mit Blatt bzw. Dialog. `art`: „kopf“ = der Knopf
 * neben dem Stand (ab 768 px, Mockup admin-heute), „karte“ = die Karte
 * „Notfall“ unten (am Handy, Mockup mobil-admin-heute).
 */
export function NotbremseAnhalten({ art, className }: { art: 'kopf' | 'karte'; className?: string }): React.JSX.Element {
  const router = useRouter()
  const [offen, setOffen] = useState(false)
  const [grund, setGrund] = useState<NotbremseGrund>(NOTBREMSE_GRUENDE[0].wert)
  const [satz, setSatz] = useState<string>(NOTBREMSE_SATZ_VORGABE)
  // Leer bis zum Öffnen: Die Uhr des Servers und des Browsers wichen sonst beim Hydrieren ab.
  const [bis, setBis] = useState('')
  const [grenzen, setGrenzen] = useState({ min: '', max: '' })
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, starte] = useTransition()
  const frisch = useFrischBestaetigt(halteBestellungenAn)

  function oeffne(): void {
    const jetzt = new Date()
    setGrund(NOTBREMSE_GRUENDE[0].wert)
    setSatz(NOTBREMSE_SATZ_VORGABE)
    setBis(zeitpunktLokal(notbremseBisVorgabe(jetzt)))
    setGrenzen(notbremseBisGrenzen(jetzt))
    setFehler(null)
    setOffen(true)
  }

  function anhalten(): void {
    const geprueft = notbremseEingabe({ grund, satz, bisLokal: bis }, new Date())
    if ('fehler' in geprueft) return setFehler(geprueft.fehler)
    setFehler(null)
    starte(async () => {
      // unsicher: Am Netz kann der Server schon angehalten haben — der Satz sagt das.
      const ergebnis = await aktionOhneWurf(() => frisch.ausfuehren(geprueft.eingabe), { unsicher: true })
      if ('error' in ergebnis) return setFehler(ergebnis.error)
      setOffen(false)
      toast.success(T.angehalten)
      router.refresh()
    })
  }

  const knopf = (
    <button type="button" onClick={oeffne} className={cn(KNOPF_ANHALTEN, art === 'kopf' && className)}>
      {T.knopf}
    </button>
  )

  return (
    <>
      {art === 'kopf' ? (
        knopf
      ) : (
        <section aria-label={T.notfall} className={cn(KARTE, 'flex flex-col gap-2.5 px-4 py-3.5', className)}>
          <h2 className="text-[14px] font-semibold text-foreground">{T.notfall}</h2>
          <p className={cn('text-[12.5px] leading-relaxed', LEISE)}>{T.notfallSatz}</p>
          <div>{knopf}</div>
        </section>
      )}
      <BestellDialog
        offen={offen}
        onOffenChange={(o) => {
          if (!o) setOffen(false)
        }}
        titel={T.titel}
        unterzeile={T.satz}
        hauptaktion={{ text: T.anhalten, onClick: anhalten, ton: 'orange', laeuft, gesperrt: satz.trim() === '' || bis === '' }}
      >
        {frisch.dialog}
        <NotbremseFormular grund={grund} satz={satz} bis={bis} min={grenzen.min} max={grenzen.max} setGrund={setGrund} setSatz={setSatz} setBis={setBis} />
        <DialogFehler text={fehler} />
        <p className={cn('text-[12px]', LEISE)}>{T.danach}</p>
      </BestellDialog>
    </>
  )
}

/** „Freigeben“ an der Aufgabe „Notbremse aktiv“ — sofort, mit Passkey; Fehler als Meldung. */
export function NotbremseFreigeben({ text, className }: { text: string; className?: string }): React.JSX.Element {
  const router = useRouter()
  const [laeuft, starte] = useTransition()
  const frisch = useFrischBestaetigt(gibBestellungenFrei)

  function freigeben(): void {
    starte(async () => {
      const ergebnis = await aktionOhneWurf(() => frisch.ausfuehren(), { unsicher: true })
      if ('error' in ergebnis) {
        toast.error(ergebnis.error)
        return
      }
      toast.success(T.freigegeben)
      router.refresh()
    })
  }

  return (
    <>
      <button type="button" onClick={freigeben} disabled={laeuft} aria-busy={laeuft || undefined} className={cn(KNOPF_RAHMEN, 'font-semibold', className)}>
        {laeuft ? 'Einen Moment …' : text}
      </button>
      {frisch.dialog}
    </>
  )
}
