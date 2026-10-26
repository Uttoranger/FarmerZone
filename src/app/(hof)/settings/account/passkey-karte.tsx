'use client'

import { useId, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fingerprint, KeyRound, Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ADMIN_PFAD, FRISCH_FEHLER, FRISCH_TEXT } from '@/lib/admin-anmeldung'
import { HOF_PASSKEY_TEXT, PASSKEY_NAME_MAX, hofPasskeyFehlerText } from '@/lib/hof-passkey'
import { hofAnmeldeAdresse } from '@/lib/anmeldecode'
import { fuehreAbmeldenAus } from '@/lib/abmelden'
import { NETZ_SATZ, istNetzFehler } from '@/lib/netz'
import { signOut } from '@/lib/auth-client'
import { benenneHofPasskeyUm, entferneHofPasskey, pruefeFrischFuerHofPasskey } from '@/server/actions/hof-passkey'
import { aktionOhneWurf } from '@/components/mein-hof/abschnitt-speichern'
import { useFrischBestaetigt } from '@/components/admin/frisch-bestaetigen'
import { BestellDialog, DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { FELD, FELD_LABEL, KNOPF_ORANGE, KNOPF_RAHMEN, TEXT_GRUEN } from '@/components/hof-bestellungen/stil'

/** Eine Zeile der Liste — Name und Anzeige („Gerät · Datum, Uhrzeit") rechnet der Server. */
export type HofPasskeyZeile = { id: string; name: string; anzeige: string }

const KNOPF_KLEIN = cn(KNOPF_RAHMEN, 'min-h-11 shrink-0 px-4 text-[13px] font-semibold')

/**
 * Karte „Anmelden mit Fingerabdruck oder Gesicht" auf Konto und Sicherheit
 * (Register E7, Ergänzung; Nr. 179; Board system-sterne-sicherheit, linkes
 * Handy). Vor dem Einrichten: Symbol, Titel, Satz und EIN oranger Knopf. Mit
 * Passkeys: die Liste („Gerät · Datum, Uhrzeit") mit Umbenennen und Entfernen
 * (Rückfrage) und „Weiteren Passkey hinzufügen". Einrichten und Entfernen
 * gehen nur frisch angemeldet (hofFrisch): Mit Passkey öffnet sich der Dialog
 * „Bitte bestätige mit deinem Passkey", ohne Passkey (oder abgebrochen) steht
 * „Kurz neu anmelden" mit dem Weg zurück hierher. Ein Hof mit Admin-Recht sieht
 * nur den Weg zur Anmeldung im Admin-Bereich (N20).
 */
export function PasskeyKarte({ passkeys, fuerAdmin = false }: { passkeys: readonly HofPasskeyZeile[]; fuerAdmin?: boolean }): React.JSX.Element {
  const router = useRouter()
  const titelId = useId()
  const nameId = useId()
  const [laeuft, starte] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)
  const [erfolg, setErfolg] = useState(false)
  const [neuAnmelden, setNeuAnmelden] = useState(false)
  const [entfernen, setEntfernen] = useState<HofPasskeyZeile | null>(null)
  const [umbenennen, setUmbenennen] = useState<HofPasskeyZeile | null>(null)
  const [neuerName, setNeuerName] = useState('')
  const [dialogFehler, setDialogFehler] = useState<string | null>(null)
  const frischEinrichten = useFrischBestaetigt(pruefeFrischFuerHofPasskey, HOF_PASSKEY_TEXT.frischMitPasskey)
  const frischEntfernen = useFrischBestaetigt(entferneHofPasskey, HOF_PASSKEY_TEXT.frischMitPasskey)
  const T = HOF_PASSKEY_TEXT

  /** Nicht frisch und keine Bestätigung: der Weg über die Anmeldung, statt eines Satzes ohne Ausweg. */
  function nichtFrisch(antwort: { error: string }): boolean {
    if (antwort.error !== FRISCH_FEHLER && antwort.error !== FRISCH_TEXT.nichtBestaetigt) return false
    setNeuAnmelden(true)
    return true
  }

  function einrichten(): void {
    setFehler(null)
    setErfolg(false)
    setNeuAnmelden(false)
    starte(async () => {
      try {
        // Ohne Passkey gibt es nichts zu bestätigen — dann gleich der Weg über die Anmeldung.
        const frisch = passkeys.length > 0 ? await frischEinrichten.ausfuehren() : await aktionOhneWurf(pruefeFrischFuerHofPasskey)
        if ('error' in frisch) {
          if (!nichtFrisch(frisch)) setFehler(frisch.error)
          return
        }
        // Der Passkey-Client erst beim Klick: @simplewebauthn/browser gehört nicht in jede Hof-Seite.
        const { passkeyEinrichten } = await import('@/lib/auth-client-passkey')
        const { error } = await passkeyEinrichten.addPasskey()
        if (error) {
          setFehler(hofPasskeyFehlerText(error))
          return
        }
        setErfolg(true)
        router.refresh()
      } catch (err) {
        setFehler(istNetzFehler(err) ? NETZ_SATZ : hofPasskeyFehlerText(null))
      }
    })
  }

  function entfernenBestaetigt(): void {
    if (!entfernen) return
    const id = entfernen.id
    setDialogFehler(null)
    starte(async () => {
      try {
        const antwort = await frischEntfernen.ausfuehren({ id })
        if ('error' in antwort) {
          if (nichtFrisch(antwort)) setEntfernen(null)
          else setDialogFehler(antwort.error)
          return
        }
        setEntfernen(null)
        router.refresh()
      } catch (err) {
        setDialogFehler(istNetzFehler(err) ? NETZ_SATZ : hofPasskeyFehlerText(null))
      }
    })
  }

  function umbenennenSpeichern(e?: React.FormEvent): void {
    e?.preventDefault()
    if (!umbenennen) return
    const id = umbenennen.id
    setDialogFehler(null)
    starte(async () => {
      const antwort = await aktionOhneWurf(() => benenneHofPasskeyUm({ id, name: neuerName }))
      if ('error' in antwort) {
        setDialogFehler(antwort.error)
        return
      }
      setUmbenennen(null)
      router.refresh()
    })
  }

  function meldeNeuAn(): void {
    void fuehreAbmeldenAus({
      abmelden: () => signOut(),
      beiFehler: setFehler,
      // Voller Seitenwechsel: Die Anmeldung soll keinen Stand dieser Sitzung mehr sehen.
      danach: () => window.location.assign(hofAnmeldeAdresse('/settings/account')),
    })
  }

  const kopf = (
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-status-fertig/12 text-status-fertig">
        <Fingerprint className="size-[22px]" strokeWidth={1.7} />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 id={titelId} className="text-[15px] leading-snug font-semibold text-foreground">
          {T.titel}
        </h2>
        <p className="text-[13px] leading-snug text-muted-foreground">{fuerAdmin ? T.adminSatz : T.satz}</p>
      </div>
    </div>
  )

  if (fuerAdmin) {
    return (
      <section aria-labelledby={titelId} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        {kopf}
        <Link href={ADMIN_PFAD.anmeldung} className={cn(TEXT_GRUEN, 'self-start')}>
          {T.adminLink}
        </Link>
      </section>
    )
  }

  return (
    <section aria-labelledby={titelId} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      {kopf}

      {passkeys.length === 0 ? (
        <button type="button" onClick={einrichten} disabled={laeuft} aria-busy={laeuft || undefined} className={cn(KNOPF_ORANGE, 'h-[46px] w-full rounded-xl text-[15px] font-semibold')}>
          {laeuft ? <Loader2 className="size-4 animate-spin" strokeWidth={1.8} aria-hidden="true" /> : null}
          {laeuft ? (
            T.laeuft
          ) : (
            <>
              <span className="md:hidden">{T.einrichtenHandy}</span>
              <span className="hidden md:inline">{T.einrichtenGeraet}</span>
            </>
          )}
        </button>
      ) : (
        <>
          <h3 className="sr-only">{T.liste}</h3>
          <ul className="flex flex-col">
            {passkeys.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 border-t border-border py-3 first:border-t-0 first:pt-0">
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-muted text-foreground">
                  <KeyRound className="size-4" strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1 text-[14px] font-semibold break-words text-foreground">{p.anzeige}</span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDialogFehler(null)
                      setNeuerName(p.name)
                      setUmbenennen(p)
                    }}
                    disabled={laeuft}
                    aria-label={`${T.umbenennen}: ${p.anzeige}`}
                    className={KNOPF_KLEIN}
                  >
                    {T.umbenennen}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDialogFehler(null)
                      setEntfernen(p)
                    }}
                    disabled={laeuft}
                    aria-label={`${T.entfernen}: ${p.anzeige}`}
                    className={KNOPF_KLEIN}
                  >
                    {T.entfernen}
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={einrichten} disabled={laeuft} className={cn(TEXT_GRUEN, 'self-start')}>
            {laeuft ? <Loader2 className="size-4 animate-spin" strokeWidth={1.8} aria-hidden="true" /> : <Plus className="size-4" strokeWidth={1.8} aria-hidden="true" />}
            {laeuft ? T.laeuft : T.weiterer}
          </button>
        </>
      )}

      {erfolg && (
        <p role="status" className="text-[13px] leading-snug text-status-fertig">
          {T.eingerichtet}
        </p>
      )}
      <DialogFehler text={fehler} />

      {neuAnmelden && (
        <div role="status" className="flex flex-col gap-2 rounded-xl border border-border bg-muted p-3">
          <p className="text-[13.5px] font-semibold text-foreground">{T.frischTitel}</p>
          <p className="text-[13px] leading-snug text-muted-foreground">{T.frischSatz}</p>
          <button type="button" onClick={meldeNeuAn} className={cn(KNOPF_KLEIN, 'self-start')}>
            {T.neuAnmelden}
          </button>
        </div>
      )}

      <BestellDialog
        offen={entfernen !== null}
        onOffenChange={(o) => {
          if (!o) setEntfernen(null)
        }}
        titel={T.entfernenFrage}
        unterzeile={entfernen?.anzeige}
        hauptaktion={{ text: T.entfernen, onClick: entfernenBestaetigt, ton: 'orange', laeuft }}
      >
        <p className="text-[13.5px] leading-relaxed text-muted-foreground">{T.entfernenSatz}</p>
        <DialogFehler text={dialogFehler} />
        {frischEntfernen.dialog}
      </BestellDialog>

      <BestellDialog
        offen={umbenennen !== null}
        onOffenChange={(o) => {
          if (!o) setUmbenennen(null)
        }}
        titel={T.umbenennenTitel}
        unterzeile={umbenennen?.anzeige}
        hauptaktion={{ text: T.speichern, onClick: () => umbenennenSpeichern(), ton: 'gruen', laeuft }}
      >
        <form onSubmit={umbenennenSpeichern} className="flex flex-col gap-1.5">
          <label htmlFor={nameId} className={FELD_LABEL}>
            {T.nameFeld}
          </label>
          <input
            id={nameId}
            value={neuerName}
            onChange={(e) => setNeuerName(e.target.value)}
            maxLength={PASSKEY_NAME_MAX}
            required
            autoComplete="off"
            aria-invalid={dialogFehler ? true : undefined}
            className={FELD}
          />
          <DialogFehler text={dialogFehler} />
        </form>
      </BestellDialog>

      {frischEinrichten.dialog}
    </section>
  )
}
