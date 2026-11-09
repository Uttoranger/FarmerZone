'use client'

import { useRef, useState, useTransition } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { WIDERRUF_GRENZEN, WIDERRUF_TEXT, type WiderrufUmfang } from '@/lib/widerruf'
import { reicheWiderrufMitLinkEin, reicheWiderrufOhneLinkEin, type WiderrufAntwort } from '@/server/actions/widerruf'
import { FELD, FELD_LABEL, KNOPF_GRUEN, KNOPF_UMRISS } from '@/components/anmelden/stil'
import { HinweiskarteFehler } from '@/components/ui/hinweiskarte'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Kaestchen } from '@/components/ui/kaestchen'
import { RUNDUNG } from '@/components/ui/rundung'
import { formatZeitpunktMitWochentag } from '@/lib/format'
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

/*
 * Seit Nr. 239 (Abnahme Lauf 31, Boards s3-/w3-widerruf) nur am Rahmen geändert, nie am Wortlaut: Felder, Beschriftungen
 * und Knöpfe in den Formen der Anmeldung (components/anmelden/stil.ts: Beschriftung in Textfarbe, Feld mit Feldrand,
 * Knöpfe als Rechteck über die volle Breite), Ecken in Pixeln (rounded-2xl wächst im neuen Design mit --radius), der
 * Eingang im Paar „läuft“ (mintgrün, Beschriftungen ≥ 4,5:1 auf der Fläche) und „Drucken oder speichern“ ohne Symbol.
 */
const KARTE = 'flex flex-col gap-3.5 rounded-[16px] border border-border bg-card px-4 py-4 md:px-[18px]'
/** Mehrzeiliges Feld: die Feldform ohne die feste Höhe. */
const FELD_MEHRZEILIG = cn(FELD, 'h-auto min-h-[88px] resize-y py-3 leading-normal')
/*
 * Die zwei Auswahlkarten „Die ganze Bestellung“ / „Einzelne Artikel“ nach Board s3-/w3-widerruf (Abnahme Lauf 32,
 * widerruf Bild 1/2, Nr. 279): 52 px hoch, Beschriftung fett, Punkt 22 px, gewählt mit Rand 2 px in Grün auf grün
 * getönter Fläche (der zweite Pixel als Ring nach innen, damit nichts springt), Ecken 12 px (G8).
 */
const AUSWAHL = cn(
  'flex min-h-[52px] cursor-pointer items-center gap-3 border border-input bg-card px-3 py-2 text-[15px] font-semibold text-foreground',
  'has-[:checked]:border-accent has-[:checked]:bg-accent/10 has-[:checked]:ring-1 has-[:checked]:ring-accent has-[:checked]:ring-inset',
  RUNDUNG.karte,
  FOKUS_RAHMEN
)
/** Eine Zeile der Positionsliste (Board s3-/w3-widerruf Bild 1): Linie oben, Kästchen 22 px, Text 15 px. */
const POSITION = 'flex gap-2.5 border-t border-border py-2 text-[15px] text-foreground'
/** „Schritt 1 von 2" über der Karte (Board w3-widerruf). */
const SCHRITT = 'text-[12.5px] font-semibold text-muted-foreground'
const KOPF = 'font-heading text-[20px] font-semibold text-foreground outline-none'

/**
 * Die zwei Schritte des Rücktritts (Freigabe 200, „Wege“; Boards s3/w3-widerruf):
 * Eingabe mit dem Knopf „Vertrag widerrufen“, dann die Prüfung mit „Widerruf
 * bestätigen“, danach die Eingangsbestätigung zum Drucken oder Speichern. Die
 * zwei Knöpfe bleiben wörtlich nach N39 (N43 (1)), die Sätze sagen „Rücktritt“.
 * Geprüft wird auf dem Server (src/schemas/widerruf.ts); hier nur, was der
 * Browser mit `required` und `maxLength` ohnehin kann. Alle Angaben stehen im
 * ersten Schritt, der zweite zeigt nur noch, was abgeschickt wird.
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
      ? [bestellung && bestellung.positionen.length > 0 ? `${WIDERRUF_TEXT.ganz}: ${bestellung.positionen.map((p) => p.text).join(', ')}` : WIDERRUF_TEXT.ganz]
      : bestellung
        ? bestellung.positionen.filter((p) => gewaehlt.includes(p.id)).map((p) => p.text)
        : [freitext]

  function weiter(e: React.FormEvent) {
    e.preventDefault()
    setFehler(null)
    if (bestellung && umfang === 'teil' && gewaehlt.length === 0) {
      setFehler(WIDERRUF_TEXT.artikelFehlt)
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
      setEingegangenAm(formatZeitpunktMitWochentag(new Date(antwort.eingegangenAm)))
      setSchritt('eingegangen')
      requestAnimationFrame(() => kopfRef.current?.focus())
    })
  }

  if (schritt === 'eingegangen' && eingegangenAm) {
    // Grün getönt wie die Hinweiskarte der Kundenwelt (Board w3-widerruf Bild 4). `data-widerruf-eingegangen` blendet
    // in page.tsx Titel und Einleitung der Seite aus (Liste Lauf 32, widerruf „Seitentitel … über der Bestätigung“).
    return (
      <section data-widerruf-eingegangen aria-labelledby="widerruf-kopf" className="flex flex-col gap-2 rounded-[16px] border border-zustand-laeuft/30 bg-zustand-laeuft-grund px-4 py-4 md:px-[18px]">
        <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground" aria-hidden="true">
          <Check className="size-5" strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          {/* Die h1 der Seite (Nr. 266): Nach dem Absenden ist der Kopf der Seite ausgeblendet (display:none). */}
          <h1 id="widerruf-kopf" ref={kopfRef} tabIndex={-1} className={KOPF}>
            {WIDERRUF_TEXT.eingangTitel}
          </h1>
          <p className="text-[14.5px] text-foreground">
            {WIDERRUF_TEXT.eingangAm(eingegangenAm)} {WIDERRUF_TEXT.eingangMail}
          </p>
        </div>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[14px] leading-normal text-foreground">
          {WIDERRUF_TEXT.naechsteSchritte.map((satz) => (
            <li key={satz}>{satz}</li>
          ))}
        </ol>
        {/* Der Beleg zum Drucken: was eingegangen ist (über das Board hinaus, Bericht 231). */}
        <Zusammenfassung bestellung={bestellung} nummer={nummer} name={name} email={email} umfangZeilen={umfangZeilen} aufGruen />
        {/* Im Web textbreit und links (Board w3-widerruf Bild 4). */}
        <button type="button" onClick={() => window.print()} className={cn(KNOPF_UMRISS, 'mt-1 lg:w-auto lg:self-start lg:px-[18px] print:hidden')}>
          {WIDERRUF_TEXT.speichern}
        </button>
      </section>
    )
  }

  if (schritt === 'zusammenfassung') {
    return (
      <div className="flex flex-col gap-3">
        {/* Über der Karte, die Angaben bleiben stehen (Board w3-widerruf Bild 6). */}
        <div aria-live="polite">
          {fehler && <HinweiskarteFehler titel={WIDERRUF_TEXT.fehlerTitel}>{fehler}</HinweiskarteFehler>}
        </div>
        <section aria-labelledby="widerruf-kopf" className={KARTE}>
          <div className="flex flex-col gap-1">
            <p className={SCHRITT}>{WIDERRUF_TEXT.schritt(2)}</p>
            <h2 id="widerruf-kopf" ref={kopfRef} tabIndex={-1} className={KOPF}>
              {WIDERRUF_TEXT.zusammenfassung}
            </h2>
          </div>
          <Zusammenfassung bestellung={bestellung} nummer={nummer} name={name} email={email} umfangZeilen={umfangZeilen} />
          <div className="flex flex-col gap-2.5">
            <button type="button" onClick={bestaetigen} disabled={laeuft || name.trim() === ''} aria-busy={laeuft} className={KNOPF_GRUEN}>
              {laeuft && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {WIDERRUF_TEXT.knopfBestaetigen}
            </button>
            <button type="button" onClick={() => setSchritt('eingabe')} disabled={laeuft} className={KNOPF_UMRISS}>
              {WIDERRUF_TEXT.zurueck}
            </button>
          </div>
        </section>
      </div>
    )
  }

  const nameFeld = (
    <Feld id="widerruf-name" label={WIDERRUF_TEXT.name}>
      <input id="widerruf-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={WIDERRUF_GRENZEN.name} required autoComplete="name" className={FELD} />
    </Feld>
  )

  return (
    <form onSubmit={weiter} className={KARTE}>
      <p className={SCHRITT}>{WIDERRUF_TEXT.schritt(1)}</p>
      {bestellung ? (
        <dl className="flex flex-col text-[14px]">
          <Zeile titel={WIDERRUF_TEXT.bestellung} wert={bestellung.bestellnummer} />
          <Zeile titel={WIDERRUF_TEXT.hof} wert={bestellung.hof} />
        </dl>
      ) : (
        <>
          {nameFeld}
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
              className={FELD}
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
              className={FELD}
            />
          </Feld>
        </>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className={cn(FELD_LABEL, 'mb-2')}>{WIDERRUF_TEXT.positionenTitel}</legend>
        <label className={AUSWAHL}>
          <input type="radio" name="umfang" value="ganz" checked={umfang === 'ganz'} onChange={() => setUmfang('ganz')} className="size-[22px] shrink-0 accent-accent" />
          <span>{WIDERRUF_TEXT.ganz}</span>
        </label>
        <label className={AUSWAHL}>
          <input type="radio" name="umfang" value="teil" checked={umfang === 'teil'} onChange={() => setUmfang('teil')} className="size-[22px] shrink-0 accent-accent" />
          <span>{WIDERRUF_TEXT.teil}</span>
        </label>
      </fieldset>

      {/* Die ganze Bestellung: die Positionen als Liste mit Häkchen darunter (Board s3-/w3-widerruf Bild 1; Abnahme
          Lauf 32, widerruf) — nur gezeigt, kein Feld: Abgeschickt wird wie bisher `umfang: 'ganz'` ohne Positionen. */}
      {umfang === 'ganz' && bestellung && bestellung.positionen.length > 0 && (
        <ul className="flex flex-col" aria-label={WIDERRUF_TEXT.ganz}>
          {bestellung.positionen.map((p) => (
            <li key={p.id} className={POSITION}>
              <span aria-hidden="true" className="grid size-[22px] shrink-0 place-items-center rounded-[6px] bg-kaestchen-flaeche text-kaestchen-haken">
                <Check className="size-4" strokeWidth={3} />
              </span>
              <PositionText text={p.text} hinweis={p.hinweis} />
            </li>
          ))}
        </ul>
      )}

      {/* Einzelne Artikel: dieselbe Liste zum Ankreuzen, seit Nr. 279 mit dem Kästchen-Baustein (A-8) — nur das Aussehen
          ist neu; Zustand, Klick und übermittelte Auswahl belegt tests/widerruf-kaestchen-verhalten.test.ts. */}
      {umfang === 'teil' && bestellung && (
        <fieldset className="flex flex-col">
          <legend className="sr-only">{WIDERRUF_TEXT.teil}</legend>
          {bestellung.positionen.map((p) => (
            <label key={p.id} className={cn(POSITION, 'cursor-pointer')}>
              <Kaestchen
                checked={gewaehlt.includes(p.id)}
                onChange={(e) => setGewaehlt((alt) => (e.target.checked ? [...alt, p.id] : alt.filter((id) => id !== p.id)))}
              />
              <PositionText text={p.text} hinweis={p.hinweis} />
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
            className={FELD_MEHRZEILIG}
          />
        </Feld>
      )}

      {/* Mit Link fragt die Seite den Namen hier (vorbelegt aus der Bestellung), ohne Link steht er oben. */}
      {bestellung && nameFeld}
      {(bestellung || umfang === 'ganz') && (
        <Feld id="widerruf-nachricht" label={WIDERRUF_TEXT.nachricht}>
          <textarea
            id="widerruf-nachricht"
            value={nachricht}
            onChange={(e) => setNachricht(e.target.value)}
            maxLength={WIDERRUF_GRENZEN.nachricht}
            rows={3}
            className={FELD_MEHRZEILIG}
          />
        </Feld>
      )}

      {/* Fehlerkasten mit 12 px Ecken (G8) wie im zweiten Schritt. */}
      <div aria-live="polite">{fehler && <HinweiskarteFehler>{fehler}</HinweiskarteFehler>}</div>
      <button type="submit" className={KNOPF_GRUEN}>
        {WIDERRUF_TEXT.knopfWiderrufen}
      </button>
    </form>
  )
}

function Feld({ id, label, hinweis, children }: { id: string; label: string; hinweis?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={FELD_LABEL}>
        {label}
      </label>
      {children}
      {hinweis && (
        <p id={`${id}-hinweis`} className="text-[13px] text-muted-foreground">
          {hinweis}
        </p>
      )}
    </div>
  )
}

/** Text einer Position mit dem Hinweis darunter — in der Liste „ganze Bestellung“ und beim Ankreuzen gleich. */
function PositionText({ text, hinweis }: { text: string; hinweis: string }) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="break-words">{text}</span>
      {/* Nur ein Hinweis (§ 18 FAGG) — entscheiden tut der Hof im Einzelfall. */}
      <span className="text-[12.5px] leading-normal text-muted-foreground">{hinweis}</span>
    </span>
  )
}

/** Eine Zeile „Bestellung … / Hof …" über der Auswahl (Board w3-widerruf Bild 1). */
function Zeile({ titel, wert }: { titel: string; wert: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2.5 first:border-t">
      <dt className="shrink-0 text-muted-foreground">{titel}</dt>
      <dd className="min-w-0 text-right break-words text-foreground">{wert}</dd>
    </div>
  )
}

/** Was abgeschickt wird bzw. wurde — dieselben Zeilen auf Prüfung und Bestätigung (Board w3-widerruf Bild 3). */
function Zusammenfassung({
  bestellung,
  nummer,
  name,
  email,
  umfangZeilen,
  aufGruen = false,
}: {
  bestellung: WiderrufBestellAnsicht | null
  nummer: string
  name: string
  email: string
  umfangZeilen: string[]
  /** Auf der grünen Fläche des Eingangs: Beschriftung im Paar „läuft“ statt leise (axe color-contrast, Abnahme Lauf 31). */
  aufGruen?: boolean
}) {
  const zeilen: [string, string][] = [
    [WIDERRUF_TEXT.bestellung, bestellung ? WIDERRUF_TEXT.bestellungBei(bestellung.bestellnummer, bestellung.hof) : nummer],
    [WIDERRUF_TEXT.was, umfangZeilen.join(', ')],
    ...(name.trim() ? ([[WIDERRUF_TEXT.nameZeile, name]] as [string, string][]) : []),
    // Mit Link geht die Bestätigung an die Adresse der Bestellung — die Seite kennt und zeigt sie nicht.
    ...(!bestellung && email ? ([[WIDERRUF_TEXT.eingangsbestaetigungAn, email]] as [string, string][]) : []),
  ]
  return (
    <dl className="flex flex-col text-[15px]">
      {zeilen.map(([titel, wert]) => (
        <div key={titel} className={cn('flex flex-col gap-0.5 border-t py-2', aufGruen ? 'border-zustand-laeuft/30' : 'border-border')}>
          <dt className={cn('text-[13px]', aufGruen ? 'font-semibold text-zustand-laeuft' : 'text-muted-foreground')}>{titel}</dt>
          <dd className="min-w-0 break-words whitespace-pre-line text-foreground">{wert}</dd>
        </div>
      ))}
    </dl>
  )
}
