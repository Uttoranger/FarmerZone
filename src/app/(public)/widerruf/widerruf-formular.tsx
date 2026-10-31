'use client'

import { useRef, useState, useTransition } from 'react'
import { CircleCheck, Loader2, Printer } from 'lucide-react'
import { WIDERRUF_GRENZEN, WIDERRUF_TEXT, eingangZeitpunkt, type WiderrufUmfang } from '@/lib/widerruf'
import { reicheWiderrufMitLinkEin, reicheWiderrufOhneLinkEin, type WiderrufAntwort } from '@/server/actions/widerruf'
import { FELD, FELD_LABEL, KICKER, KNOPF_GRUEN, KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

/** Was die Seite über eine Bestellung mit signiertem Link zeigt — gekürzt, ohne Beträge. */
export type WiderrufBestellAnsicht = {
  bestellung: string
  sig: string
  bestellnummer: string
  name: string
  hof: string
  positionen: { id: string; text: string; hinweis: string }[]
}

type Schritt = 'eingabe' | 'zusammenfassung' | 'eingegangen'

const KARTE = 'flex flex-col gap-3.5 rounded-2xl border border-border bg-card px-4 py-4 md:px-[18px]'
const AUSWAHL = cn(
  'flex min-h-11 cursor-pointer items-start gap-3 rounded-[12px] border border-border px-3.5 py-3 text-[14.5px] text-foreground has-[:checked]:border-accent has-[:checked]:bg-accent/10',
  FOKUS_RAHMEN
)

/**
 * Die zwei Schritte des Widerrufs (Freigabe 200, „Wege“): Eingabe mit dem
 * Knopf „Vertrag widerrufen“, dann die Zusammenfassung mit „Widerruf
 * bestätigen“, danach die Eingangsbestätigung zum Drucken oder Speichern.
 * Geprüft wird auf dem Server (src/schemas/widerruf.ts); hier nur, was der
 * Browser mit `required` und `maxLength` ohnehin kann.
 */
export function WiderrufFormular({ bestellung }: { bestellung: WiderrufBestellAnsicht | null }): React.JSX.Element {
  const [schritt, setSchritt] = useState<Schritt>('eingabe')
  const [umfang, setUmfang] = useState<WiderrufUmfang>('ganz')
  const [gewaehlt, setGewaehlt] = useState<string[]>([])
  const [name, setName] = useState(bestellung?.name ?? '')
  const [email, setEmail] = useState('')
  const [nummer, setNummer] = useState('')
  const [freitext, setFreitext] = useState('')
  const [nachricht, setNachricht] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [eingegangenAm, setEingegangenAm] = useState<string | null>(null)
  const [laeuft, starte] = useTransition()
  const kopfRef = useRef<HTMLHeadingElement>(null)

  const umfangZeilen =
    umfang === 'ganz'
      ? [WIDERRUF_TEXT.ganz]
      : bestellung
        ? bestellung.positionen.filter((p) => gewaehlt.includes(p.id)).map((p) => p.text)
        : [freitext]

  function weiter(e: React.FormEvent) {
    e.preventDefault()
    setFehler(null)
    if (bestellung && umfang === 'teil' && gewaehlt.length === 0) {
      setFehler('Bitte wähl mindestens einen Artikel.')
      return
    }
    setSchritt('zusammenfassung')
    requestAnimationFrame(() => kopfRef.current?.focus())
  }

  function bestaetigen() {
    setFehler(null)
    starte(async () => {
      let antwort: WiderrufAntwort
      try {
        antwort = bestellung
          ? await reicheWiderrufMitLinkEin({
              bestellung: bestellung.bestellung,
              sig: bestellung.sig,
              umfang,
              positionen: umfang === 'teil' ? gewaehlt : [],
              name,
              nachricht,
            })
          : await reicheWiderrufOhneLinkEin({
              name,
              email,
              bestellnummer: nummer,
              umfang,
              nachricht: umfang === 'teil' ? freitext : nachricht,
            })
      } catch {
        setFehler(WIDERRUF_TEXT.fehlerSpeichern)
        return
      }
      if ('error' in antwort) {
        setFehler(antwort.error)
        return
      }
      setEingegangenAm(eingangZeitpunkt(new Date(antwort.eingegangenAm)))
      setSchritt('eingegangen')
      requestAnimationFrame(() => kopfRef.current?.focus())
    })
  }

  if (schritt === 'eingegangen' && eingegangenAm) {
    return (
      <section aria-labelledby="widerruf-kopf" className={KARTE}>
        <div className="flex items-start gap-3">
          <CircleCheck className="mt-0.5 size-6 shrink-0 text-status-fertig" strokeWidth={1.7} aria-hidden="true" />
          <h2 id="widerruf-kopf" ref={kopfRef} tabIndex={-1} className="font-heading text-[20px] font-semibold text-foreground outline-none">
            {WIDERRUF_TEXT.eingangTitel}
          </h2>
        </div>
        <p className="text-[14.5px] text-foreground">{WIDERRUF_TEXT.eingangAm(eingegangenAm)}</p>
        <Zusammenfassung bestellung={bestellung} nummer={nummer} name={name} email={email} umfangZeilen={umfangZeilen} />
        <p className="text-[14px] text-muted-foreground">{WIDERRUF_TEXT.eingangMail}</p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[14px] leading-normal text-foreground">
          {WIDERRUF_TEXT.naechsteSchritte.map((satz) => (
            <li key={satz}>{satz}</li>
          ))}
        </ul>
        <button type="button" onClick={() => window.print()} className={cn(KNOPF_RAHMEN, 'self-start print:hidden')}>
          <Printer className="size-4" strokeWidth={1.7} aria-hidden="true" />
          {WIDERRUF_TEXT.speichern}
        </button>
      </section>
    )
  }

  if (schritt === 'zusammenfassung') {
    return (
      <section aria-labelledby="widerruf-kopf" className={KARTE}>
        <h2 id="widerruf-kopf" ref={kopfRef} tabIndex={-1} className="font-heading text-[20px] font-semibold text-foreground outline-none">
          {WIDERRUF_TEXT.zusammenfassung}
        </h2>
        <Zusammenfassung bestellung={bestellung} nummer={nummer} name={bestellung ? null : name} email={email} umfangZeilen={umfangZeilen} />
        {bestellung && (
          <Feld id="widerruf-name" label={WIDERRUF_TEXT.name}>
            <input id="widerruf-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={WIDERRUF_GRENZEN.name} required autoComplete="name" className={cn(FELD, 'min-h-11')} />
          </Feld>
        )}
        {(bestellung || umfang === 'ganz') && (
          <Feld id="widerruf-nachricht" label={WIDERRUF_TEXT.nachricht}>
            <textarea
              id="widerruf-nachricht"
              value={nachricht}
              onChange={(e) => setNachricht(e.target.value)}
              maxLength={WIDERRUF_GRENZEN.nachricht}
              rows={3}
              className={cn(FELD, 'min-h-[88px] resize-y leading-normal')}
            />
          </Feld>
        )}
        <p className="text-[13.5px] text-muted-foreground">{WIDERRUF_TEXT.zusammenfassungSatz}</p>
        <div aria-live="polite">{fehler && <Hinweiskarte ton="orange">{fehler}</Hinweiskarte>}</div>
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
          <button type="button" onClick={() => setSchritt('eingabe')} disabled={laeuft} className={KNOPF_RAHMEN}>
            {WIDERRUF_TEXT.zurueck}
          </button>
          <button type="button" onClick={bestaetigen} disabled={laeuft || name.trim() === ''} aria-busy={laeuft} className={KNOPF_GRUEN}>
            {laeuft && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {WIDERRUF_TEXT.knopfBestaetigen}
          </button>
        </div>
      </section>
    )
  }

  return (
    <form onSubmit={weiter} className={KARTE}>
      {bestellung ? (
        <div className="flex flex-col gap-1">
          <p className={KICKER}>{WIDERRUF_TEXT.bestellnummer}</p>
          <p className="text-[17px] font-semibold text-foreground">{bestellung.bestellnummer}</p>
          <p className="text-[13.5px] text-muted-foreground">{bestellung.hof}</p>
        </div>
      ) : (
        <>
          <Feld id="widerruf-name" label={WIDERRUF_TEXT.name}>
            <input id="widerruf-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={WIDERRUF_GRENZEN.name} required autoComplete="name" className={cn(FELD, 'min-h-11')} />
          </Feld>
          <Feld id="widerruf-email" label={WIDERRUF_TEXT.email} hinweis={WIDERRUF_TEXT.emailHinweis}>
            <input
              id="widerruf-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={WIDERRUF_GRENZEN.email}
              required
              autoComplete="email"
              aria-describedby="widerruf-email-hinweis"
              className={cn(FELD, 'min-h-11')}
            />
          </Feld>
          <Feld id="widerruf-nummer" label={WIDERRUF_TEXT.bestellnummer} hinweis={WIDERRUF_TEXT.bestellnummerHinweis}>
            <input
              id="widerruf-nummer"
              value={nummer}
              onChange={(e) => setNummer(e.target.value)}
              maxLength={WIDERRUF_GRENZEN.bestellnummer}
              required
              autoCapitalize="characters"
              aria-describedby="widerruf-nummer-hinweis"
              className={cn(FELD, 'min-h-11 sm:w-64')}
            />
          </Feld>
        </>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className={cn(KICKER, 'mb-2')}>{WIDERRUF_TEXT.positionenTitel}</legend>
        <label className={AUSWAHL}>
          <input type="radio" name="umfang" value="ganz" checked={umfang === 'ganz'} onChange={() => setUmfang('ganz')} className="mt-1 size-4 accent-accent" />
          <span>{WIDERRUF_TEXT.ganz}</span>
        </label>
        <label className={AUSWAHL}>
          <input type="radio" name="umfang" value="teil" checked={umfang === 'teil'} onChange={() => setUmfang('teil')} className="mt-1 size-4 accent-accent" />
          <span>{WIDERRUF_TEXT.teil}</span>
        </label>
      </fieldset>

      {umfang === 'teil' && bestellung && (
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">{WIDERRUF_TEXT.teil}</legend>
          {bestellung.positionen.map((p) => (
            <label key={p.id} className={AUSWAHL}>
              <input
                type="checkbox"
                checked={gewaehlt.includes(p.id)}
                onChange={(e) => setGewaehlt((alt) => (e.target.checked ? [...alt, p.id] : alt.filter((id) => id !== p.id)))}
                className="mt-1 size-4 accent-accent"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="break-words">{p.text}</span>
                {/* Nur ein Hinweis (§ 18 FAGG) — entscheiden tut der Hof im Einzelfall. */}
                <span className="text-[12.5px] leading-normal text-muted-foreground">{p.hinweis}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {umfang === 'teil' && !bestellung && (
        <Feld id="widerruf-freitext" label={WIDERRUF_TEXT.freitext} hinweis={WIDERRUF_TEXT.freitextHinweis}>
          <textarea
            id="widerruf-freitext"
            value={freitext}
            onChange={(e) => setFreitext(e.target.value)}
            maxLength={WIDERRUF_GRENZEN.nachricht}
            required
            rows={3}
            aria-describedby="widerruf-freitext-hinweis"
            className={cn(FELD, 'min-h-[88px] resize-y leading-normal')}
          />
        </Feld>
      )}

      <div aria-live="polite">{fehler && <Hinweiskarte ton="orange">{fehler}</Hinweiskarte>}</div>
      <button type="submit" className={cn(KNOPF_GRUEN, 'self-start')}>
        {WIDERRUF_TEXT.knopfWiderrufen}
      </button>
    </form>
  )
}

function Feld({ id, label, hinweis, children }: { id: string; label: string; hinweis?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={cn(FELD_LABEL, 'mb-0')}>
        {label}
      </label>
      {children}
      {hinweis && (
        <p id={`${id}-hinweis`} className="text-xs text-muted-foreground">
          {hinweis}
        </p>
      )}
    </div>
  )
}

/** Was abgeschickt wird bzw. wurde — dieselben Zeilen auf Zusammenfassung und Bestätigung. */
function Zusammenfassung({
  bestellung,
  nummer,
  name,
  email,
  umfangZeilen,
}: {
  bestellung: WiderrufBestellAnsicht | null
  nummer: string
  name: string | null
  email: string
  umfangZeilen: string[]
}) {
  const zeilen: [string, string][] = [
    [WIDERRUF_TEXT.bestellnummer, bestellung ? bestellung.bestellnummer : nummer],
    ...(bestellung ? ([['Vertragspartner', bestellung.hof]] as [string, string][]) : []),
    ...(name ? ([[WIDERRUF_TEXT.name, name]] as [string, string][]) : []),
    ...(!bestellung && email ? ([[WIDERRUF_TEXT.email, email]] as [string, string][]) : []),
  ]
  return (
    <dl className="flex flex-col gap-2 rounded-[12px] border border-border bg-background px-3.5 py-3 text-[14px]">
      {zeilen.map(([titel, wert]) => (
        <div key={titel} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
          <dt className="shrink-0 text-muted-foreground sm:w-36">{titel}</dt>
          <dd className="min-w-0 break-words text-foreground">{wert}</dd>
        </div>
      ))}
      <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
        <dt className="shrink-0 text-muted-foreground sm:w-36">Widerrufen</dt>
        <dd className="flex min-w-0 flex-col break-words text-foreground">
          {umfangZeilen.map((z) => (
            <span key={z}>{z}</span>
          ))}
        </dd>
      </div>
    </dl>
  )
}
