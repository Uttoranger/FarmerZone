'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Camera, Check, Loader2, X } from 'lucide-react'
import { MELDUNG_ARTEN, MELDUNG_ART_SATZ, MELDUNG_KENNUNG_MAX, MELDUNG_TEXT_MAX, MELDUNG_TEXT_MIN } from '@/lib/meldung'
import { MEINE_MELDUNGEN_HREF, MELDUNG_TEXT_BEISPIEL, MELDUNG_TEXT_LABEL, OHNE_IP_UND_COOKIES, mitgeschicktSatz } from '@/lib/hof-hilfe'
import { hofAktiverPunkt, hofNavigation } from '@/lib/bauern-navigation'
import { stufenText } from '@/components/shared/image-upload'
import { HONIGTOPF_STIL, type Kontext, type MeldungFormular } from '@/components/shared/use-meldung-formular'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { HinweiskarteFehler } from '@/components/ui/hinweiskarte'
import { cn } from '@/lib/utils'

/** Die zwei Welten (Register N42 b, V51): Kundschaft grün, Hof orange. */
export type MeldungWelt = 'kunde' | 'hof'

/** Farbe je Welt — gewählte Art und Hauptknopf. Alles andere ist in beiden Welten gleich. */
const WELT_TON: Record<MeldungWelt, { gewaehlt: string; knopf: string }> = {
  kunde: { gewaehlt: 'border-[1.5px] border-accent bg-accent/15', knopf: 'bg-accent text-accent-foreground hover:bg-accent-hover' },
  hof: { gewaehlt: 'border-[1.5px] border-primary bg-primary/15', knopf: 'bg-primary text-primary-foreground hover:bg-primary/90' },
}

/** Die Sätze der Ansicht, eine Quelle für beide Welten (Wortlaut der bisherigen Formulare und des Boards s3-problem-melden). */
export const MELDUNG_ANSICHT_TEXT = {
  worum: 'Worum geht es?',
  fehlernummer: 'Fehlernummer',
  optional: '(optional)',
  fehlernummerHinweis: 'Manche Fehlermeldungen enden auf ein Kürzel in eckigen Klammern – das hilft uns, die Stelle zu finden.',
  mitgeschicktTitel: 'Das schicken wir automatisch mit',
  seite: 'Seite',
  geraet: 'Gerät',
  hof: 'Hof',
  email: 'Deine E-Mail',
  emailZusatz: '· nur für unsere Antwort, optional',
  bildschirmfoto: 'Bildschirmfoto hinzufügen',
  bildschirmfotoDa: 'Bildschirmfoto angehängt',
  entfernen: 'Entfernen',
  fehlerTitel: 'Das hat nicht geklappt',
  abbrechen: 'Abbrechen',
  absenden: 'Absenden',
  sendet: 'Einen Moment …',
  dankeTitel: 'Danke — ist angekommen.',
  kurznummer: 'Deine Kurznummer:',
  dankeKunde: 'Merk dir die Kurznummer, falls du nachfragen möchtest.',
  dankeHof: 'Den Stand deiner Meldung findest du unter „Meine Meldungen“.',
  zuMeldungen: 'Zu deinen Meldungen',
  nochEtwas: 'Noch etwas melden',
} as const

/** Feld der Ansicht: 48 px, Feldrand (≥ 3:1), auf der Karte. */
const FELD = cn('w-full min-w-0 rounded-xl border border-input bg-card px-3.5 text-base text-foreground placeholder:text-muted-foreground', FOKUS_RAHMEN)
const LABEL = 'text-[15px] font-semibold text-foreground'
const RAHMEN_KNOPF = cn(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-[1.5px] border-foreground bg-card px-[18px] text-[15px] font-semibold text-foreground hover:bg-muted',
  FOKUS_RAHMEN
)

/**
 * Der Name der Seite, von der die Meldung kommt — im Hofbereich der Name ihres
 * Punkts in der Navigation („Bestellungen“), sonst nur der Pfad (nie Abfrage
 * oder Anker: Suchwörter bleiben beim Gerät). Leer, solange der Browser den
 * Kontext noch nicht kennt (Server-Rendern).
 */
function seiteName(seiteUrl: string): string {
  if (!seiteUrl) return ''
  let pfad: string
  try {
    pfad = new URL(seiteUrl).pathname
  } catch {
    // Keine gültige Adresse: nichts zeigen statt Rohtext — mitgeschickt wird sie trotzdem (useMeldungFormular).
    return ''
  }
  const id = hofAktiverPunkt(pfad)
  if (!id) return pfad
  const nav = hofNavigation({ isAdmin: true })
  return [...nav.haupt, ...nav.verkaufUndKunden, ...nav.unten].find((p) => p.id === id)?.label ?? pfad
}

/** System und Browser in zwei Wörtern („Android · Chrome“) — nur Anzeige; mit geht der volle User-Agent. */
export function geraetKurz(userAgent: string): string {
  const ua = userAgent
  const system = /Android/i.test(ua)
    ? 'Android'
    : /iPhone/i.test(ua)
      ? 'iPhone'
      : /iPad/i.test(ua)
        ? 'iPad'
        : /Windows/i.test(ua)
          ? 'Windows'
          : /Mac OS X|Macintosh/i.test(ua)
            ? 'Mac'
            : /Linux/i.test(ua)
              ? 'Linux'
              : ''
  // Reihenfolge zählt: Edge und Samsung nennen auch „Chrome“, Chrome nennt auch „Safari“.
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /SamsungBrowser/.test(ua)
      ? 'Samsung Internet'
      : /Firefox|FxiOS/.test(ua)
        ? 'Firefox'
        : /Chrome|CriOS/.test(ua)
          ? 'Chrome'
          : /Safari/.test(ua)
            ? 'Safari'
            : ''
  return [system, browser].filter((t) => t !== '').join(' · ')
}

/**
 * „Das schicken wir automatisch mit“ (Board s2-/w2-meldungen, Nacharbeit 225):
 * im Hofbereich eine Karte mit Seite, Gerät und Hof statt des Satzes. Ohne
 * Kontext (vor dem Einhängen) steht ein Strich; der Satz ohne IP und Cookies
 * bleibt darunter — er sagt, was NICHT mitgeht.
 */
function MitgeschicktKarte({ kontext, kennung, hofName }: { kontext: Kontext; kennung: string; hofName?: string }): React.JSX.Element {
  const T = MELDUNG_ANSICHT_TEXT
  const zeilen: { name: string; wert: string }[] = [
    ...(kennung.trim() ? [{ name: T.fehlernummer, wert: kennung.trim() }] : []),
    { name: T.seite, wert: seiteName(kontext.seiteUrl) || '–' },
    { name: T.geraet, wert: geraetKurz(kontext.userAgent) || '–' },
    ...(hofName ? [{ name: T.hof, wert: hofName }] : []),
  ]
  return (
    <div data-slot="meldung-mitgeschickt" className="flex flex-col gap-0.5 rounded-2xl border border-border bg-card px-3.5 py-3">
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
 * Aufbau nach Board: Karte höchstens 560 px; drei Arten als Optionsfelder (Radio, je 48 px); das
 * Textfeld fragt je Art anders, mit Zähler; Fehlernummer (von der 500 vorbelegt); Kundin: E-Mail
 * optional, nur für die Antwort; angemeldeter Hof: „Bildschirmfoto hinzufügen" statt E-Mail; der
 * Satz, was mitgeht. Serverfehler als orange Hinweiskarte über dem Formular, die Eingaben bleiben.
 * „Absenden" am Handy über die volle Breite, ab 768 px rechts mit „Abbrechen" als Umriss daneben.
 * Danach ersetzt der Dank mit Kurznummer das Formular; der Fokus zieht mit.
 */
export function MeldungFormularAnsicht({
  formular,
  welt,
  alsHof,
  abbrechenHref,
  titel,
  satz,
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
  /** Der Name des Hofs für die Karte „Das schicken wir automatisch mit“ (nur Hof); ohne ihn fehlt die Zeile „Hof“. */
  hofName?: string
  className?: string
}): React.JSX.Element {
  const f = formular
  const ton = WELT_TON[welt]
  const T = MELDUNG_ANSICHT_TEXT

  const dankeRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (f.kurznummer) dankeRef.current?.focus()
  }, [f.kurznummer])

  if (f.kurznummer) {
    return (
      <div
        role="status"
        data-slot="meldung-danke"
        data-welt={welt}
        className={cn('flex w-full max-w-[560px] flex-col items-start gap-2 rounded-2xl border border-zustand-laeuft/30 bg-zustand-laeuft-grund px-4 py-[18px]', className)}
      >
        <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-accent text-accent-foreground">
          <Check className="size-5" strokeWidth={2.2} aria-hidden="true" />
        </span>
        <h2 ref={dankeRef} tabIndex={-1} className="font-heading text-[22px] font-semibold text-foreground outline-none">
          {T.dankeTitel}
        </h2>
        <p className="text-[15px] text-zustand-laeuft">
          {T.kurznummer} <strong className="font-mono">{f.kurznummer}</strong>. {alsHof ? T.dankeHof : T.dankeKunde}
        </p>
        <div className="mt-1 flex flex-wrap gap-2.5">
          {alsHof && (
            <Link href={MEINE_MELDUNGEN_HREF} className={cn('inline-flex min-h-11 items-center rounded-full px-[18px] text-[15px] font-semibold', ton.knopf, FOKUS_RAHMEN)}>
              {T.zuMeldungen}
            </Link>
          )}
          <button type="button" onClick={f.nochEtwas} className={RAHMEN_KNOPF}>
            {T.nochEtwas}
          </button>
        </div>
      </div>
    )
  }

  const gesperrt = f.isPending || f.upload.isUploading

  return (
    <div data-slot="meldung-formular" data-welt={welt} className={cn('flex w-full max-w-[560px] flex-col gap-2.5', className)}>
      {f.fehler && <HinweiskarteFehler titel={T.fehlerTitel}>{f.fehler}</HinweiskarteFehler>}
      <form onSubmit={f.absenden} className="flex flex-col gap-3.5 rounded-2xl border border-border bg-card p-[18px]">
        {titel && <h1 className="font-heading text-2xl font-semibold text-foreground">{titel}</h1>}
        {satz && <p className="-mt-2 text-[15px] text-muted-foreground">{satz}</p>}

        <div style={HONIGTOPF_STIL} aria-hidden="true">
          <label htmlFor="meldung-website">Webseite (bitte frei lassen)</label>
          <input id="meldung-website" name="website" type="text" value={f.website} onChange={(e) => f.setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" />
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend className={cn(LABEL, 'mb-1.5')}>{T.worum}</legend>
          <div className="grid gap-1.5 sm:grid-cols-3">
            {MELDUNG_ARTEN.map((wert) => {
              const aktiv = f.art === wert
              return (
                <label
                  key={wert}
                  className={cn(
                    'flex min-h-12 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-[14px] font-semibold text-foreground transition-colors duration-[250ms] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-solid has-focus-visible:outline-ring',
                    aktiv ? ton.gewaehlt : 'border border-input bg-card hover:bg-muted'
                  )}
                >
                  <input
                    type="radio"
                    name="meldung-art"
                    value={wert}
                    checked={aktiv}
                    onChange={() => f.setArt(wert)}
                    className={cn('size-5 shrink-0', welt === 'hof' ? 'accent-primary' : 'accent-accent')}
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
            id="meldung-text"
            value={f.text}
            onChange={(e) => f.setText(e.target.value)}
            rows={4}
            maxLength={MELDUNG_TEXT_MAX}
            minLength={MELDUNG_TEXT_MIN}
            placeholder={MELDUNG_TEXT_BEISPIEL[f.art]}
            required
            aria-describedby="meldung-text-zaehler"
            className={cn(FELD, 'min-h-[110px] resize-y py-2.5 leading-normal')}
          />
          <p id="meldung-text-zaehler" className="text-[13px] text-muted-foreground tabular-nums">
            {f.text.length} / {MELDUNG_TEXT_MAX}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="meldung-kennung" className={LABEL}>
            {T.fehlernummer} <span className="font-normal">{T.optional}</span>
          </label>
          <input
            id="meldung-kennung"
            value={f.kennung}
            onChange={(e) => f.setKennung(e.target.value)}
            maxLength={MELDUNG_KENNUNG_MAX}
            aria-describedby="meldung-kennung-hinweis"
            className={cn(FELD, 'h-12 sm:w-56')}
          />
          <p id="meldung-kennung-hinweis" className="text-[13px] leading-normal text-muted-foreground">
            {T.fehlernummerHinweis}
          </p>
        </div>

        {/* Bildschirmfoto nur für angemeldete Höfe (der Upload-Weg braucht eine Hof-Sitzung); die Datei-Felder stehen außerhalb der Fallunterscheidung (PR 135). */}
        {alsHof && f.upload.fileInput}
        {alsHof &&
          (f.screenshotUrl ? (
            <div className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.screenshotUrl} alt="Bildschirmfoto zur Meldung" className="size-16 rounded-lg border border-border object-cover" />
              <span className="min-w-0 flex-1 text-[14px] text-foreground">{T.bildschirmfotoDa}</span>
              <button type="button" onClick={() => f.setScreenshotUrl(null)} className={RAHMEN_KNOPF}>
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
                'flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-foreground bg-card px-3.5 text-[16px] font-bold text-foreground hover:bg-muted disabled:opacity-60',
                FOKUS_RAHMEN
              )}
            >
              {f.upload.isUploading ? (
                <Loader2 className="size-[18px] shrink-0 animate-spin" aria-hidden="true" />
              ) : (
                <Camera className="size-[18px] shrink-0" strokeWidth={1.7} aria-hidden="true" />
              )}
              {f.upload.isUploading && f.upload.progress ? stufenText(f.upload.progress) : T.bildschirmfoto}
            </button>
          ))}

        {!alsHof && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="meldung-email" className={LABEL}>
              {T.email} <span className="font-normal">{T.emailZusatz}</span>
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

        {/* Der Hof sieht, was mitgeht, als Karte (Board s2-/w2-meldungen); die Kundin den Satz (Board s3-problem-melden). */}
        {alsHof ? (
          <MitgeschicktKarte kontext={f.kontext} kennung={f.kennung} hofName={hofName} />
        ) : (
          <p className="text-[13px] leading-normal text-muted-foreground">{mitgeschicktSatz(f.kennung, alsHof)}</p>
        )}

        <div className="flex gap-2.5 md:justify-end">
          <Link href={abbrechenHref} className={cn(RAHMEN_KNOPF, 'hidden md:inline-flex')}>
            {T.abbrechen}
          </Link>
          <button
            type="submit"
            disabled={gesperrt}
            aria-busy={f.isPending || undefined}
            className={cn(
              'inline-flex min-h-[52px] w-full items-center justify-center rounded-[14px] px-5 text-[16px] font-bold disabled:opacity-60 md:min-h-11 md:w-auto md:rounded-full',
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
