'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Loader2, X } from 'lucide-react'
import { MELDUNG_ARTEN, MELDUNG_ART_SATZ, MELDUNG_KENNUNG_MAX, MELDUNG_TEXT_MAX, MELDUNG_TEXT_MIN } from '@/lib/meldung'
import { MEINE_MELDUNGEN_HREF, MELDUNG_TEXT_BEISPIEL, MELDUNG_TEXT_LABEL, OHNE_IP_UND_COOKIES, mitgeschicktSatz, seiteName } from '@/lib/hof-hilfe'
import { geraetName } from '@/lib/geraete'
import { stufenText } from '@/components/shared/image-upload'
import { HONIGTOPF_STIL, kennungZumSenden, type Kontext, type MeldungFormular } from '@/components/shared/use-meldung-formular'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { HinweiskarteFehler } from '@/components/ui/hinweiskarte'
import { FELD_FEHLER_RAHMEN } from '@/components/ui/feld-fehler'
import { AKTIONSLEISTE_KNOPF, FesteAktionsleiste } from '@/components/ui/feste-aktionsleiste'
import { RUNDUNG } from '@/components/ui/rundung'
import { meldungEingabeSchema } from '@/schemas/meldung'
import { cn } from '@/lib/utils'

/** Die zwei Welten (Register N42 b, V51): Kundschaft grün, Hof orange. */
export type MeldungWelt = 'kunde' | 'hof'

/**
 * Farbe je Welt — gewählte Art, ihr Auswahlpunkt und Hauptknopf. Die gewählte Karte und der Punkt nehmen die
 * Zustandspaare, die die Boards zeichnen (Nr. 268): Kundschaft „läuft“ (s3/w3: Rand und Punkt `zustand-laeuft`,
 * Fläche `zustand-laeuft-grund`), Hof „tun“ (s2/w2: `status-offen` auf `zustand-tun-grund`) — so stimmen beide
 * Themes ohne eigene Farbe.
 */
const WELT_TON: Record<MeldungWelt, { gewaehlt: string; punkt: string; knopf: string }> = {
  kunde: {
    gewaehlt: 'border-[1.5px] border-zustand-laeuft bg-zustand-laeuft-grund',
    punkt: 'size-5 checked:border-zustand-laeuft checked:bg-zustand-laeuft',
    knopf: 'bg-accent text-accent-foreground hover:bg-accent-hover',
  },
  hof: {
    gewaehlt: 'border-2 border-status-offen bg-zustand-tun-grund',
    punkt: 'size-[22px] checked:border-status-offen checked:bg-status-offen',
    knopf: 'bg-primary text-primary-foreground hover:bg-primary/90',
  },
}

/** Die Sätze der Ansicht, eine Quelle für beide Welten (Wortlaut der bisherigen Formulare und des Boards s3-problem-melden). */
export const MELDUNG_ANSICHT_TEXT = {
  worum: 'Worum geht es?',
  fehlernummer: 'Fehlernummer',
  optional: '(optional)',
  /** Nur im Hofbereich (Board s2-/w2-meldungen; DESIGN_SYSTEM; Liste Lauf 32 problem-melden „Hilfetext zu eckigen Klammern“). */
  fehlernummerHinweis: 'Manche Fehlermeldungen enden auf ein Kürzel in eckigen Klammern – das hilft uns, die Stelle zu finden.',
  mitgeschicktTitel: 'Das schicken wir automatisch mit',
  seite: 'Seite',
  geraet: 'Gerät',
  hof: 'Hof',
  email: 'Deine E-Mail',
  emailZusatz: '· nur für unsere Antwort, optional',
  bildschirmfoto: '+ Bildschirmfoto hinzufügen',
  /** Platzhalter der Fehlernummer — nur im Hofbereich (Board s2-/w2-meldungen; das Kunden-Board s3-/w3-problem-melden zeigt keinen). */
  fehlernummerBeispiel: 'z. B. A7F3',
  bildschirmfotoDa: 'Bildschirmfoto angehängt',
  entfernen: 'Entfernen',
  fehlerTitel: 'Das hat nicht geklappt',
  abbrechen: 'Abbrechen',
  absenden: 'Absenden',
  sendet: 'Einen Moment …',
  /** Kundschaft wörtlich nach Board s3-/w3-problem-melden (Geviertstrich). */
  dankeTitel: 'Danke — ist angekommen.',
  /** Hofbereich nach Board s2-/w2-meldungen (Halbgeviertstrich). */
  dankeTitelHof: 'Danke – ist angekommen.',
  kurznummer: 'Deine Kurznummer:',
  dankeKunde: 'Merk dir die Kurznummer, falls du nachfragen möchtest.',
  dankeHof: 'Den Stand deiner Meldung findest du unter „Meine Meldungen“.',
  // Wortliste N8 „Meine Meldungen“ (Liste Lauf 32 meldungen).
  zuMeldungen: 'Meine Meldungen',
  nochEtwas: 'Noch etwas melden',
} as const

/** Feld der Ansicht: 48 px, Feldrand (≥ 3:1), auf der Karte. */
const FELD = cn(RUNDUNG.feld, 'w-full min-w-0 border border-input bg-card px-3.5 text-base text-foreground placeholder:text-muted-foreground', FOKUS_RAHMEN)
/** Beschriftung ganz fett, auch „(optional)“ und „· nur für unsere Antwort, optional“ (beide Boards; Nr. 268). */
const LABEL = 'text-[15px] font-semibold text-foreground'
/**
 * Umriss-Knopf („Abbrechen“, „Noch etwas melden“, „Entfernen“): 12 px rund über `RUNDUNG` statt Pille — die Boards
 * zeichnen ihn eckig-gerundet wie „Absenden“ (Nacharbeit 251, Nr. 268). Die Höhe gibt der Aufrufer dazu.
 */
const RAHMEN_KNOPF = cn(
  'inline-flex items-center justify-center gap-2 border-[1.5px] border-foreground bg-card px-5 text-[16px] font-bold text-foreground hover:bg-muted',
  RUNDUNG.karte,
  FOKUS_RAHMEN
)
/**
 * Der Auswahlpunkt selbst gezeichnet (Nr. 268, Liste problem-melden „Auswahlpunkt im Dunkeln Ring statt gefüllt“):
 * Mit `accent-color` malt der Browser den gewählten Punkt im Dunkeln als hellen Ring mit dunkler Mitte. Hier ein
 * Kreis im Feldrand; gewählt Rand und Fläche im Ton der Welt mit einem Spalt in der Kartenfarbe — der gefüllte
 * Punkt der Boards in beiden Themes. `appearance-none` nimmt nur die Zeichnung, das native Optionsfeld bleibt
 * (Tastatur, Vorleser, Formularwert).
 */
const PUNKT = 'shrink-0 cursor-pointer appearance-none rounded-full border-2 border-kaestchen-rand bg-card transition-colors duration-[250ms] checked:shadow-[inset_0_0_0_3px_var(--color-card)]'

/**
 * „Das schicken wir automatisch mit“ (Board s2-/w2-meldungen, Nacharbeit 225):
 * im Hofbereich eine Karte mit Seite und Gerät statt des Satzes (Seite als Name des
 * Navigationspunkts aus src/lib/hof-hilfe.ts, Gerät als `geraetName`). Ohne
 * Kontext (vor dem Einhängen) steht ein Strich; der Satz ohne IP und Cookies
 * bleibt darunter — er sagt, was NICHT mitgeht.
 */
function MitgeschicktKarte({ kontext, kennung, hofName }: { kontext: Kontext; kennung: string; hofName?: string }): React.JSX.Element {
  const T = MELDUNG_ANSICHT_TEXT
  const zeilen: { name: string; wert: string }[] = [
    ...(kennung.trim() ? [{ name: T.fehlernummer, wert: kennung.trim() }] : []),
    { name: T.seite, wert: seiteName(kontext.seiteUrl) },
    { name: T.geraet, wert: kontext.userAgent.trim() === '' ? '–' : geraetName(kontext.userAgent) },
    // Der Hof aus der Sitzung (Board s2-/w2-meldungen): nur, wenn die Seite den Namen gibt.
    ...(hofName?.trim() ? [{ name: T.hof, wert: hofName.trim() }] : []),
  ]
  return (
    <div data-slot="meldung-mitgeschickt" className={cn('flex flex-col gap-0.5 border border-border bg-card px-3.5 py-3', RUNDUNG.karte)}>
      <p className="text-[13px] font-bold tracking-[0.52px] text-muted-foreground uppercase">{T.mitgeschicktTitel}</p>
      <dl className="flex flex-col">
        {zeilen.map((z, i) => (
          <div key={z.name} className={cn('flex min-h-10 items-center justify-between gap-3 py-1.5 text-[15px]', i > 0 && 'border-t border-border')}>
            <dt className="text-foreground">{z.name}</dt>
            <dd className="min-w-0 truncate text-right text-foreground">{z.wert}</dd>
          </div>
        ))}
      </dl>
      <p className="pt-1 text-[13px] leading-normal text-muted-foreground">{OHNE_IP_UND_COOKIES}</p>
    </div>
  )
}

/**
 * Die Darstellung von „Problem melden" mit Ton je Welt (Register N42 b, V51; Board
 * s3-problem-melden/w3-problem-melden): EIN Baustein für /problem-melden (KundeShell, grün) und
 * /fehler-melden (HofShell, orange). Die Logik bleibt in useMeldungFormular — Honigtopf,
 * Zeitschranke, Kontext ohne IP und Cookies, Bildschirmfoto, Absenden —, diese Ansicht zeichnet nur
 * ihren Zustand: Die Seite ruft den Hook und gibt sein Ergebnis als `formular` herein.
 *
 * Aufbau nach Board: höchstens 560 px; drei Arten als Optionsfelder (Karten je 64 px, Punkt selbst
 * gezeichnet); das Textfeld fragt je Art anders, mit Zähler; die Fehlernummer (von der 500 vorbelegt)
 * nur bei „Etwas funktioniert nicht“; Kundin: E-Mail optional, nur für die Antwort; angemeldeter Hof:
 * „Bildschirmfoto hinzufügen" statt E-Mail; was mitgeht. Serverfehler als orange Hinweiskarte über
 * dem Formular, die Eingaben bleiben. „Absenden" am Handy über die volle Breite, ab 768 px rechts mit
 * „Abbrechen" als Umriss daneben (12 px rund). Danach ersetzt der Dank mit Kurznummer das Formular;
 * der Fokus zieht mit.
 *
 * Variante je Welt (Nr. 268, keine zweite Quelle): `welt="kunde"` folgt dem Board s3-/w3-problem-melden
 * (Karte, Zähler rechts, Satz „Mitgeschickt: …“ auch mit Hof-Sitzung, Bildschirmfoto nach der
 * Fehlernummer gestrichelt), `welt="hof"` dem Board s2-/w2-meldungen (frei auf dem Grund, Hilfetext zu
 * eckigen Klammern, Karte „Das schicken wir automatisch mit“, Bildschirmfoto vor der Fehlernummer).
 */
export function MeldungFormularAnsicht({
  formular,
  welt,
  alsHof,
  abbrechenHref,
  titel,
  satz,
  einleitung,
  hofName,
  className,
}: {
  formular: MeldungFormular
  welt: MeldungWelt
  /** Angemeldeter Hof: Bildschirmfoto statt E-Mail, Dank führt zu „Meine Meldungen". */
  alsHof: boolean
  /** Ziel von „Abbrechen" ab 768 px. */
  abbrechenHref: string
  /** Überschrift in der Karte (h1), wenn die Seite keine eigene trägt. */
  titel?: string
  satz?: string
  /** Satz über dem Formular (außerhalb der Karte); nach dem Absenden entfällt er (Board s2-/w2-meldungen Bild 3). */
  einleitung?: string
  /** Name des angemeldeten Hofs für die Zeile „Hof“ in der Karte „Das schicken wir automatisch mit“. */
  hofName?: string
  className?: string
}): React.JSX.Element {
  const f = formular
  const ton = WELT_TON[welt]
  const T = MELDUNG_ANSICHT_TEXT

  const dankeRef = useRef<HTMLHeadingElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  // Feldfehler am Textfeld (G6): geprüft beim Absenden, nicht vorher — der Knopf bleibt bedienbar. Der Satz kommt
  // aus dem Schema, das auch der Server prüft (meldungEingabeSchema), nie aus der Ansicht.
  const [textFehler, setTextFehler] = useState<string | null>(null)
  function absenden(e: React.FormEvent) {
    const pruefung = meldungEingabeSchema.shape.text.safeParse(f.text)
    if (!pruefung.success) {
      e.preventDefault()
      setTextFehler(pruefung.error.issues[0]?.message ?? null)
      textRef.current?.focus()
      return
    }
    setTextFehler(null)
    f.absenden(e)
  }
  useEffect(() => {
    if (f.kurznummer) dankeRef.current?.focus()
  }, [f.kurznummer])

  if (f.kurznummer) {
    const DankeTitel = titel ? 'h1' : 'h2'
    return (
      <div
        role="status"
        data-slot="meldung-danke"
        data-welt={welt}
        className={cn('flex w-full max-w-[560px] flex-col items-start gap-2 border border-zustand-laeuft/30 bg-zustand-laeuft-grund px-4 py-[18px]', RUNDUNG.karte, className)}
      >
        <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-accent text-accent-foreground">
          <Check className="size-5" strokeWidth={2.2} aria-hidden="true" />
        </span>
        {/* Trägt die Ansicht die h1 der Seite (`titel`), ist der Dank jetzt sie — sonst stünde die Seite ohne h1 da
            (Abnahme Lauf 31, problem-melden Bild 5; Nr. 242). */}
        <DankeTitel ref={dankeRef} tabIndex={-1} className="font-heading text-[22px] font-semibold text-foreground outline-none">
          {welt === 'hof' ? T.dankeTitelHof : T.dankeTitel}
        </DankeTitel>
        <p className="text-[15px] text-zustand-laeuft">
          {T.kurznummer} <strong className="font-mono">{f.kurznummer}</strong>. {alsHof ? T.dankeHof : T.dankeKunde}
        </p>
        {/* Im Hofbereich beide Knöpfe volle Breite untereinander (Board s2-/w2-meldungen Bild 3); die Kundschaft
            behält den Umriss-Knopf links (Board s3-/w3-problem-melden). */}
        <div className={cn('mt-1', welt === 'hof' ? 'flex w-full flex-col gap-2.5' : 'flex flex-wrap gap-2.5')}>
          {alsHof && (
            <Link href={MEINE_MELDUNGEN_HREF} className={cn('inline-flex min-h-[52px] w-full items-center justify-center px-[18px] text-[16px] font-bold', RUNDUNG.karte, ton.knopf, FOKUS_RAHMEN)}>
              {T.zuMeldungen}
            </Link>
          )}
          <button type="button" onClick={f.nochEtwas} className={cn(RAHMEN_KNOPF, 'min-h-[52px]', welt === 'hof' && 'w-full')}>
            {T.nochEtwas}
          </button>
        </div>
      </div>
    )
  }

  const gesperrt = f.isPending || f.upload.isUploading
  // Fehlernummer nur bei „Etwas funktioniert nicht“ (Board s3/w3 Bild 3); was nicht dasteht, geht nicht mit.
  const mitKennung = f.art === 'FEHLER'
  const kennung = kennungZumSenden(f.art, f.kennung)
  // Hof-Board s2/w2: Bildschirmfoto vor der Fehlernummer, mittig, durchgezogen, „(optional)“. Kunden-Board s3/w3
  // Bild 4 (angemeldeter Hof auf /problem-melden): nach der Fehlernummer, linksbündig, gestrichelt, ohne Zusatz.
  const fotoZuerst = welt === 'hof'
  // Höhe der Knöpfe am Formularende: Kundschaft 52 px (w3), Hof im Web 48 px (w2).
  const knopfHoehe = welt === 'hof' ? 'min-h-[52px] md:min-h-12' : 'min-h-[52px]'

  const bildschirmfoto = alsHof ? (
    f.screenshotUrl ? (
      <div className={cn('flex items-center gap-3 border border-border px-3.5 py-3', RUNDUNG.feld)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={f.screenshotUrl} alt="Bildschirmfoto zur Meldung" className="size-16 rounded-lg border border-border object-cover" />
        <span className="min-w-0 flex-1 text-[14px] text-foreground">{T.bildschirmfotoDa}</span>
        <button type="button" onClick={() => f.setScreenshotUrl(null)} className={cn(RAHMEN_KNOPF, 'min-h-11 px-[18px] text-[15px]')}>
          <X className="size-4" strokeWidth={1.7} aria-hidden="true" />
          {T.entfernen}
        </button>
      </div>
    ) : (
      <button
        type="button"
        onClick={f.upload.openFilePicker}
        disabled={f.upload.isUploading}
        className={cn(
          'flex min-h-[52px] w-full items-center gap-2 border-[1.5px] border-foreground bg-card px-3.5 text-[16px] font-bold text-foreground hover:bg-muted disabled:opacity-60',
          fotoZuerst ? 'justify-center' : 'justify-start border-dashed',
          RUNDUNG.karte,
          FOKUS_RAHMEN
        )}
      >
        {f.upload.isUploading && <Loader2 className="size-[18px] shrink-0 animate-spin" aria-hidden="true" />}
        {f.upload.isUploading && f.upload.progress ? stufenText(f.upload.progress) : <span>{fotoZuerst ? `${T.bildschirmfoto} ${T.optional}` : T.bildschirmfoto}</span>}
      </button>
    )
  ) : null

  return (
    <div data-slot="meldung-formular" data-welt={welt} className={cn('flex w-full max-w-[560px] flex-col gap-2.5', className)}>
      {einleitung && <p className="text-sm leading-normal text-muted-foreground">{einleitung}</p>}
      {f.fehler && (
        <HinweiskarteFehler titel={T.fehlerTitel} nochmal={f.nochmal}>
          {f.fehler}
        </HinweiskarteFehler>
      )}
      {/* Im Hofbereich prüft nur `absenden` (Feldfehler G6, Board s2-/w2-meldungen); die Kundschaft behält die
          Browser-Prüfung (required/minLength), das Kunden-Board zeigt keinen Feldfehler. Beide Wege messen am selben
          Schema wie der Server. */}
      <form
        onSubmit={absenden}
        noValidate={welt === 'hof'}
        className={cn(
          'flex flex-col gap-3.5',
          // Hofbereich frei auf dem Grund, auch im Web (Board w2-meldungen; Abnahme Lauf 32 meldungen Punkt 8);
          // die Kundschaft in der Karte (Board s3/w3).
          welt === 'kunde' && cn('border border-border bg-card p-[18px]', RUNDUNG.karte)
        )}
      >
        {titel && <h1 className="font-heading text-2xl font-semibold text-foreground">{titel}</h1>}
        {satz && <p className="-mt-2 text-[15px] text-muted-foreground">{satz}</p>}

        <div style={HONIGTOPF_STIL} aria-hidden="true">
          <label htmlFor="meldung-website">Webseite (bitte frei lassen)</label>
          <input id="meldung-website" name="website" type="text" value={f.website} onChange={(e) => f.setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" />
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend className={cn(LABEL, 'mb-1.5')}>{T.worum}</legend>
          {/* Drei Karten untereinander, je 64 px in beiden Welten (Liste Lauf 32: problem-melden „Auswahlkarten 46 statt
              64 px“, meldungen „Auswahlzeilen niedriger“; so hoch stehen sie in den gezeichneten Boards). */}
          <div className="grid gap-1.5">
            {MELDUNG_ARTEN.map((wert) => {
              const aktiv = f.art === wert
              return (
                <label
                  key={wert}
                  className={cn(
                    'flex cursor-pointer items-center py-2 text-[14px] font-semibold text-foreground transition-colors duration-[250ms] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-solid has-focus-visible:outline-ring',
                    welt === 'hof' ? 'min-h-16 gap-3 px-3 text-[15px]' : 'min-h-16 gap-2 px-3',
                    RUNDUNG.karte,
                    aktiv ? ton.gewaehlt : 'border border-input bg-card hover:bg-muted'
                  )}
                >
                  <input
                    type="radio"
                    name="meldung-art"
                    value={wert}
                    checked={aktiv}
                    onChange={() => f.setArt(wert)}
                    className={cn(PUNKT, ton.punkt)}
                  />
                  {MELDUNG_ART_SATZ[wert]}
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="meldung-text" className={LABEL}>
            {MELDUNG_TEXT_LABEL[f.art]}
          </label>
          <textarea
            ref={textRef}
            id="meldung-text"
            value={f.text}
            onChange={(e) => f.setText(e.target.value)}
            rows={4}
            maxLength={MELDUNG_TEXT_MAX}
            minLength={welt === 'hof' ? undefined : MELDUNG_TEXT_MIN}
            required={welt !== 'hof'}
            placeholder={MELDUNG_TEXT_BEISPIEL[f.art]}
            aria-invalid={textFehler ? true : undefined}
            aria-describedby={textFehler ? 'meldung-text-fehler meldung-text-zaehler' : 'meldung-text-zaehler'}
            className={cn(FELD, FELD_FEHLER_RAHMEN, 'min-h-[110px] resize-y py-2.5 leading-normal')}
          />
          {textFehler && (
            <p id="meldung-text-fehler" role="alert" className="text-[14px] leading-snug font-semibold text-status-offen">
              {textFehler}
            </p>
          )}
          {/* Kundschaft rechtsbündig (Board s3/w3), Hof links (Board s2/w2). */}
          <p id="meldung-text-zaehler" className={cn('text-[13px] text-muted-foreground tabular-nums', welt === 'kunde' && 'text-right')}>
            {f.text.length} / {MELDUNG_TEXT_MAX}
          </p>
        </div>

        {/* Bildschirmfoto nur für angemeldete Höfe (der Upload-Weg braucht eine Hof-Sitzung); die Datei-Felder stehen außerhalb der Fallunterscheidung (PR 135). */}
        {alsHof && f.upload.fileInput}
        {fotoZuerst && bildschirmfoto}

        {mitKennung && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="meldung-kennung" className={LABEL}>
              {T.fehlernummer} {T.optional}
            </label>
            <input
              id="meldung-kennung"
              value={f.kennung}
              onChange={(e) => f.setKennung(e.target.value)}
              maxLength={MELDUNG_KENNUNG_MAX}
              placeholder={welt === 'hof' ? T.fehlernummerBeispiel : undefined}
              aria-describedby={welt === 'hof' ? 'meldung-kennung-hinweis' : undefined}
              className={cn(FELD, 'h-12')}
            />
            {welt === 'hof' && (
              <p id="meldung-kennung-hinweis" className="text-[13px] leading-normal text-muted-foreground">
                {T.fehlernummerHinweis}
              </p>
            )}
          </div>
        )}

        {!fotoZuerst && bildschirmfoto}

        {!alsHof && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="meldung-email" className={LABEL}>
              {T.email} {T.emailZusatz}
            </label>
            <input
              id="meldung-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={f.email}
              onChange={(e) => f.setEmail(e.target.value)}
              className={cn(FELD, 'h-12')}
            />
          </div>
        )}

        {/* Im Hofbereich die Karte (Board s2-/w2-meldungen); auf /problem-melden immer der Satz, auch mit Hof-Sitzung
            (Board s3/w3 Bild 4; Liste Lauf 32 problem-melden „Kasten … bei Hof-Sitzung“). */}
        {welt === 'hof' ? (
          <MitgeschicktKarte kontext={f.kontext} kennung={kennung} hofName={hofName} />
        ) : (
          <p className="text-[13px] leading-normal text-muted-foreground">{mitgeschicktSatz(kennung, alsHof)}</p>
        )}

        {/* Im Hofbereich am Handy die feste Leiste „Absenden“ über der Unterleiste (G2, Board s2-meldungen);
            ab 768 px die Knöpfe am Formularende (V47). */}
        {welt === 'hof' && (
          <FesteAktionsleiste className="md:hidden">
            <button type="submit" disabled={gesperrt} aria-busy={f.isPending || undefined} className={cn(AKTIONSLEISTE_KNOPF, 'disabled:opacity-60')}>
              {f.isPending ? T.sendet : T.absenden}
            </button>
          </FesteAktionsleiste>
        )}
        <div className={cn('gap-2.5 md:justify-end', welt === 'hof' ? 'hidden md:flex' : 'flex')}>
          <Link href={abbrechenHref} className={cn(RAHMEN_KNOPF, knopfHoehe, 'hidden md:inline-flex')}>
            {T.abbrechen}
          </Link>
          <button
            type="submit"
            disabled={gesperrt}
            aria-busy={f.isPending || undefined}
            className={cn(
              // 12 px rund über RUNDUNG auch im Web (Nacharbeit 251; vorher Pille mit 44 px).
              'inline-flex w-full items-center justify-center px-6 text-[16px] font-bold disabled:opacity-60 md:w-auto',
              knopfHoehe,
              RUNDUNG.karte,
              ton.knopf,
              FOKUS_RAHMEN
            )}
          >
            {f.isPending ? T.sendet : T.absenden}
          </button>
        </div>
      </form>
    </div>
  )
}
