'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { aendereAnmeldeEmail, exportiereAuskunftHof, oeffneKontoWieder, schliesseKonto } from '@/server/actions/konto-anfragen'
import { KONTO_ANFRAGE_TEXT as T, hofnameBestaetigt } from '@/lib/konto-anfragen'
import { ADMIN_GRUND_MAX } from '@/schemas/admin-aktion'
import { EMAIL_MAX } from '@/lib/eingabegrenzen'
import { cn } from '@/lib/utils'
import { BestellDialog, DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { FELD, FELD_LABEL, KNOPF_ORANGE_RAHMEN, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { useFrischBestaetigt } from '@/components/admin/frisch-bestaetigen'

/** Was die Akte für die Konto-Anfragen mitgibt — alles fertig vom Server, kein Date. */
export type HofKontoDaten = {
  farmId: string
  name: string
  /** Die Anmelde-Adresse nur gekürzt (maskiereAdresse). */
  anmeldungGekuerzt: string
  /** null = offen; sonst „wieder öffnen bis …“ als Text bzw. endgültig. */
  geschlossen: { bis: string | null; wiederOeffnen: boolean; endgueltig: boolean } | null
  /** Warum Schließen gerade nicht geht (offene Bestellung oder Erstattung) — null = es geht. */
  schliessenSperre: string | null
}

type Wahl = 'email' | 'auskunft' | 'schliessen' | 'wieder' | null

/**
 * „Konto-Anfragen des Hofs“ in der Akte (Register N36, Nr. 190; Mockups
 * admin-konto-anfrage und admin-konto-schliessen): drei Knöpfe — Anmelde-E-Mail
 * ändern, Auskunft exportieren, Konto schließen (bzw. wieder öffnen). Jede
 * Aktion fragt frisch nach dem Passkey (useFrischBestaetigt); die
 * Passkey-Dialoge stehen neben den Dialogen, nicht darin (Nr. 188, Runde 2).
 */
export function HofAkteKonto({ konto }: { konto: HofKontoDaten }): React.JSX.Element {
  const [wahl, setWahl] = useState<Wahl>(null)
  const zu = () => setWahl(null)
  return (
    <>
      {konto.geschlossen && (
        <p role="status" className="text-[13.5px] font-medium text-foreground">
          {konto.geschlossen.endgueltig ? T.endgueltigZeile : T.geschlossenZeile(konto.geschlossen.bis ?? '–')}
        </p>
      )}
      <div className="flex flex-wrap gap-2.5">
        {!konto.geschlossen?.endgueltig && (
          <button type="button" onClick={() => setWahl('email')} className={KNOPF_RAHMEN}>
            {T.knopfEmail}
          </button>
        )}
        <button type="button" onClick={() => setWahl('auskunft')} className={KNOPF_RAHMEN}>
          {T.knopfAuskunft}
        </button>
        {!konto.geschlossen && (
          <button type="button" onClick={() => setWahl('schliessen')} className={KNOPF_ORANGE_RAHMEN}>
            {T.knopfSchliessen}
          </button>
        )}
        {konto.geschlossen?.wiederOeffnen && (
          <button type="button" onClick={() => setWahl('wieder')} className={KNOPF_RAHMEN}>
            {T.knopfWiederOeffnen}
          </button>
        )}
      </div>
      <p className={cn('text-[12.5px] leading-relaxed', LEISE)}>{T.erklaerung}</p>
      {/* key: Felder und Fehler starten bei jedem Öffnen frisch. */}
      <EmailDialog key={`email-${wahl === 'email'}`} offen={wahl === 'email'} konto={konto} onClose={zu} />
      <AuskunftDialog key={`auskunft-${wahl === 'auskunft'}`} offen={wahl === 'auskunft'} konto={konto} onClose={zu} />
      <SchliessenDialog key={`schliessen-${wahl === 'schliessen'}`} offen={wahl === 'schliessen'} konto={konto} onClose={zu} />
      <WiederDialog key={`wieder-${wahl === 'wieder'}`} offen={wahl === 'wieder'} konto={konto} onClose={zu} />
    </>
  )
}

type DialogProps = { offen: boolean; konto: HofKontoDaten; onClose: () => void }

/** Grund für das Protokoll — dieselbe Hilfe wie die Sperre (ohne Adresse, ohne Telefonnummer). */
function GrundFeld({ id, wert, setWert, fehler }: { id: string; wert: string; setWert: (w: string) => void; fehler: boolean }): React.JSX.Element {
  return (
    <div>
      <label htmlFor={id} className={FELD_LABEL}>
        {T.grundLabel}
      </label>
      <textarea
        id={id}
        value={wert}
        maxLength={ADMIN_GRUND_MAX}
        rows={2}
        aria-describedby={`${id}-hilfe`}
        aria-invalid={fehler || undefined}
        onChange={(e) => setWert(e.target.value)}
        className={FELD}
      />
      <p id={`${id}-hilfe`} className={cn('mt-1 text-[12.5px]', LEISE)}>
        {T.grundHilfe}
      </p>
    </div>
  )
}

function EmailDialog({ offen, konto, onClose }: DialogProps): React.JSX.Element {
  const [laeuft, startTransition] = useTransition()
  const [adresse, setAdresse] = useState('')
  const [grund, setGrund] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const frisch = useFrischBestaetigt(aendereAnmeldeEmail)

  function bestaetigen() {
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await frisch.ausfuehren({ farmId: konto.farmId, neueAdresse: adresse, grund })
      if ('error' in ergebnis) return setFehler(ergebnis.error)
      toast.success(T.email.erledigt)
      onClose()
    })
  }

  return (
    <>
      {frisch.dialog}
      <BestellDialog
        offen={offen}
        onOffenChange={(o) => !o && onClose()}
        titel={T.email.titel(konto.name)}
        unterzeile={T.email.heute(konto.anmeldungGekuerzt)}
        breite="breit"
        hauptaktion={{ text: T.email.knopf, onClick: bestaetigen, ton: 'gruen', laeuft, gesperrt: adresse.trim() === '' || grund.trim() === '' }}
      >
        <div className="flex flex-col gap-3.5">
          <div>
            <label htmlFor="konto-neue-adresse" className={FELD_LABEL}>
              {T.email.feld}
            </label>
            <input
              id="konto-neue-adresse"
              type="email"
              inputMode="email"
              autoComplete="off"
              spellCheck={false}
              maxLength={EMAIL_MAX}
              value={adresse}
              aria-invalid={fehler !== null || undefined}
              onChange={(e) => setAdresse(e.target.value)}
              className={cn(FELD, 'min-h-11')}
            />
          </div>
          <GrundFeld id="konto-email-grund" wert={grund} setWert={setGrund} fehler={fehler !== null} />
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-[13.5px] text-foreground">
            {T.email.schritte.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <DialogFehler text={fehler} />
        </div>
      </BestellDialog>
    </>
  )
}

/** Lädt den Inhalt als Datei herunter — im Browser, ohne Umweg über eine Adresse mit Kennung. */
export function ladeHerunter(dateiname: string, inhalt: string): void {
  const url = URL.createObjectURL(new Blob([inhalt], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = dateiname
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function AuskunftDialog({ offen, konto, onClose }: DialogProps): React.JSX.Element {
  const [laeuft, startTransition] = useTransition()
  const [grund, setGrund] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const frisch = useFrischBestaetigt(exportiereAuskunftHof)

  function bestaetigen() {
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await frisch.ausfuehren({ farmId: konto.farmId, grund })
      if ('error' in ergebnis) return setFehler(ergebnis.error)
      ladeHerunter(ergebnis.dateiname, ergebnis.inhalt)
      toast.success(T.auskunft.erledigt)
      onClose()
    })
  }

  return (
    <>
      {frisch.dialog}
      <BestellDialog
        offen={offen}
        onOffenChange={(o) => !o && onClose()}
        titel={T.auskunft.titel(konto.name)}
        hauptaktion={{ text: T.auskunft.knopf, onClick: bestaetigen, ton: 'gruen', laeuft, gesperrt: grund.trim() === '' }}
      >
        <div className="flex flex-col gap-3.5">
          <p className="text-[14px] leading-relaxed text-foreground">{T.auskunft.satz}</p>
          <GrundFeld id="konto-auskunft-grund" wert={grund} setWert={setGrund} fehler={fehler !== null} />
          <DialogFehler text={fehler} />
        </div>
      </BestellDialog>
    </>
  )
}

function Punkte({ titel, punkte }: { titel: string; punkte: readonly string[] }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-muted px-3.5 py-3">
      <p className="text-[12.5px] font-semibold text-muted-foreground">{titel}</p>
      <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-[13.5px] text-foreground">
        {punkte.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </div>
  )
}

function SchliessenDialog({ offen, konto, onClose }: DialogProps): React.JSX.Element {
  const [laeuft, startTransition] = useTransition()
  const [grund, setGrund] = useState('')
  const [hofname, setHofname] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const frisch = useFrischBestaetigt(schliesseKonto)
  const gesperrt = konto.schliessenSperre !== null

  function bestaetigen() {
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await frisch.ausfuehren({ farmId: konto.farmId, grund, hofname })
      if ('error' in ergebnis) return setFehler(ergebnis.error)
      toast.success(T.schliessen.erledigt)
      onClose()
    })
  }

  return (
    <>
      {frisch.dialog}
      <BestellDialog
        offen={offen}
        onOffenChange={(o) => !o && onClose()}
        titel={T.schliessen.titel(konto.name)}
        breite="breit"
        hauptaktion={{
          text: T.schliessen.knopf,
          onClick: bestaetigen,
          ton: 'orange',
          laeuft,
          gesperrt: gesperrt || grund.trim() === '' || !hofnameBestaetigt(hofname, konto.name),
        }}
      >
        <div className="flex flex-col gap-3.5">
          <Punkte titel={T.schliessen.sofort} punkte={T.schliessen.sofortPunkte} />
          <Punkte titel={T.schliessen.spaeter} punkte={T.schliessen.spaeterPunkte} />
          {gesperrt && (
            <p role="status" className="rounded-xl border border-status-offen/50 px-3.5 py-2.5 text-[13.5px] font-medium text-foreground">
              {konto.schliessenSperre}
            </p>
          )}
          <GrundFeld id="konto-schliessen-grund" wert={grund} setWert={setGrund} fehler={fehler !== null} />
          <div>
            <label htmlFor="konto-hofname" className={FELD_LABEL}>
              {T.schliessen.bestaetigenLabel}
            </label>
            <input
              id="konto-hofname"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={hofname}
              onChange={(e) => setHofname(e.target.value)}
              className={cn(FELD, 'min-h-11')}
            />
          </div>
          <DialogFehler text={fehler} />
        </div>
      </BestellDialog>
    </>
  )
}

function WiederDialog({ offen, konto, onClose }: DialogProps): React.JSX.Element {
  const [laeuft, startTransition] = useTransition()
  const [grund, setGrund] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const frisch = useFrischBestaetigt(oeffneKontoWieder)

  function bestaetigen() {
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await frisch.ausfuehren({ farmId: konto.farmId, grund })
      if ('error' in ergebnis) return setFehler(ergebnis.error)
      toast.success(T.wiederOeffnen.erledigt)
      onClose()
    })
  }

  return (
    <>
      {frisch.dialog}
      <BestellDialog
        offen={offen}
        onOffenChange={(o) => !o && onClose()}
        titel={T.wiederOeffnen.titel(konto.name)}
        hauptaktion={{ text: T.wiederOeffnen.knopf, onClick: bestaetigen, ton: 'gruen', laeuft, gesperrt: grund.trim() === '' }}
      >
        <div className="flex flex-col gap-3.5">
          <p className="text-[14px] leading-relaxed text-foreground">{T.wiederOeffnen.satz}</p>
          <GrundFeld id="konto-wieder-grund" wert={grund} setWert={setGrund} fehler={fehler !== null} />
          <DialogFehler text={fehler} />
        </div>
      </BestellDialog>
    </>
  )
}
