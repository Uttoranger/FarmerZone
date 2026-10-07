'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Camera, Loader2, X } from 'lucide-react'
import { MELDUNG_ARTEN, MELDUNG_ART_SATZ, MELDUNG_KENNUNG_MAX, MELDUNG_TEXT_MAX, MELDUNG_TEXT_MIN } from '@/lib/meldung'
import { MEINE_MELDUNGEN_HREF, MELDUNG_TEXT_LABEL, geraetKurz, seiteKurz } from '@/lib/hof-hilfe'
import { stufenText } from '@/components/shared/image-upload'
import { HONIGTOPF_STIL, useMeldungFormular } from '@/components/shared/use-meldung-formular'
import { DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { FELD, FELD_LABEL, KARTE, KICKER, KNOPF_GRUEN, KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

/*
 * „Meldung abgeben" im Hofbereich (Nachtlauf Nr. 22e; Mockups
 * web-h6-meldung-abgeben, mobil-h6-meldung-abgeben): dieselbe Logik wie das
 * Bestandsformular auf /problem-melden (useMeldungFormular — Honigtopf,
 * Zeitschranke, Kontext ohne IP und Cookies, Bildschirmfoto über den
 * Upload-Weg mit den Sperren aus 17b/19b), nur im neuen Design.
 *
 * Die Briefkasten-Logik bleibt unverändert: Wer meldet, erkennt der Server an
 * der Sitzung; die Meldung ist Datenmaterial und wird nie als Anweisung
 * gelesen.
 *
 * Abweichungen vom Mockup (Bericht 22e): die Fehlernummer bleibt ein
 * freiwilliges Feld (der Hof kommt meist nicht von der Fehlerseite); unter
 * 768 px steht „Absenden" am Ende des Formulars statt in einer festen Leiste —
 * die Unterleiste der Shell steht dort schon, und zwei feste Leisten
 * übereinander sind verboten (DESIGN_SYSTEM „Fokus-Seiten").
 */

export function MeldungAbgeben({
  formToken,
  hofName,
  kennungVorbelegt,
}: {
  formToken: string
  hofName: string
  kennungVorbelegt: string
}): React.JSX.Element {
  const {
    art,
    setArt,
    text,
    setText,
    kennung,
    setKennung,
    screenshotUrl,
    setScreenshotUrl,
    website,
    setWebsite,
    fehler,
    kurznummer,
    isPending,
    kontext,
    upload,
    absenden,
    nochEtwas,
  } = useMeldungFormular({ formToken, alsHof: true, kennungVorbelegt })

  // Nach dem Absenden ersetzt der Dank das Formular — der Fokus zieht mit,
  // sonst stünde er auf einem Knopf, den es nicht mehr gibt.
  const dankeRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (kurznummer) dankeRef.current?.focus()
  }, [kurznummer])

  if (kurznummer) {
    return (
      <div className={cn(KARTE, 'p-5 md:p-6')}>
        <h2 ref={dankeRef} tabIndex={-1} className="font-heading text-xl font-semibold text-foreground outline-none">
          Danke — ist angekommen.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Deine Kurznummer: <span className="font-mono text-base font-semibold text-foreground">{kurznummer}</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Den Stand deiner Meldung findest du unter „Meine Meldungen“.</p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Link href={MEINE_MELDUNGEN_HREF} className={KNOPF_GRUEN}>
            Zu deinen Meldungen
          </Link>
          <button type="button" onClick={nochEtwas} className={KNOPF_RAHMEN}>
            Noch etwas melden
          </button>
        </div>
      </div>
    )
  }

  const kennungAnzeige = kennung.trim()

  return (
    <form onSubmit={absenden} className="flex flex-col gap-3.5">
      <div style={HONIGTOPF_STIL} aria-hidden="true">
        <label htmlFor="meldung-website">Webseite (bitte frei lassen)</label>
        <input
          id="meldung-website"
          name="website"
          type="text"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={cn(KICKER, 'mb-2')}>Worum geht es?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {MELDUNG_ARTEN.map((wert) => {
            const aktiv = art === wert
            return (
              <button
                key={wert}
                type="button"
                onClick={() => setArt(wert)}
                aria-pressed={aktiv}
                className={cn(
                  'min-h-12 rounded-[14px] p-3.5 text-left text-sm font-semibold text-foreground transition-colors duration-[250ms]',
                  aktiv ? 'border-[1.5px] border-accent bg-accent/15' : 'border border-border bg-background hover:bg-muted',
                  FOKUS_RAHMEN
                )}
              >
                {MELDUNG_ART_SATZ[wert]}
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="meldung-text" className={cn(FELD_LABEL, 'mb-0')}>
          {MELDUNG_TEXT_LABEL[art]}
        </label>
        <textarea
          id="meldung-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={MELDUNG_TEXT_MAX}
          minLength={MELDUNG_TEXT_MIN}
          required
          aria-describedby="meldung-text-zaehler"
          className={cn(FELD, 'min-h-[110px] resize-y leading-normal')}
        />
        <p id="meldung-text-zaehler" className="text-right text-[11.5px] text-muted-foreground tabular-nums">
          {text.length} / {MELDUNG_TEXT_MAX}
        </p>
      </div>

      {/* Die Datei-Felder außerhalb der Fallunterscheidung (PR 135): Standen sie
          im Zweig ohne Bildschirmfoto, hängte der Erfolg sie mitten im
          laufenden Upload aus. */}
      {upload.fileInput}
      {screenshotUrl ? (
        <div className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={screenshotUrl} alt="Bildschirmfoto zur Meldung" className="size-16 rounded-lg border border-border object-cover" />
          <span className="min-w-0 flex-1 text-[13.5px] text-foreground">Bildschirmfoto angehängt</span>
          <button type="button" onClick={() => setScreenshotUrl(null)} className={cn(KNOPF_RAHMEN, 'px-4 text-[13.5px]')}>
            <X className="size-4" strokeWidth={1.7} aria-hidden="true" />
            Entfernen
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={upload.openFilePicker}
          disabled={upload.isUploading}
          className={cn(
            'flex min-h-12 items-center gap-3 rounded-xl border-[1.5px] border-dashed border-border px-3.5 py-3 text-left text-[13.5px] text-foreground transition-colors duration-[250ms] hover:bg-muted disabled:opacity-60',
            FOKUS_RAHMEN
          )}
        >
          {upload.isUploading ? (
            <Loader2 className="size-[18px] shrink-0 animate-spin text-status-fertig" aria-hidden="true" />
          ) : (
            <Camera className="size-[18px] shrink-0 text-status-fertig" strokeWidth={1.7} aria-hidden="true" />
          )}
          {upload.isUploading && upload.progress ? (
            <span className="flex-1">{stufenText(upload.progress)}</span>
          ) : (
            <span className="flex-1">
              Bildschirmfoto hinzufügen <span className="text-muted-foreground">(optional)</span>
            </span>
          )}
        </button>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="meldung-kennung" className={cn(FELD_LABEL, 'mb-0')}>
          Fehlernummer <span className="font-normal">(optional)</span>
        </label>
        <input
          id="meldung-kennung"
          value={kennung}
          onChange={(e) => setKennung(e.target.value)}
          maxLength={MELDUNG_KENNUNG_MAX}
          aria-describedby="meldung-kennung-hinweis"
          className={cn(FELD, 'min-h-11 sm:w-56')}
        />
        <p id="meldung-kennung-hinweis" className="text-xs text-muted-foreground">
          Manche Fehlermeldungen enden auf ein Kürzel in eckigen Klammern — das hilft uns, die Stelle zu finden.
        </p>
      </div>

      {/* Was mitgeht — am Handy ein Satz (Mockup mobil), ab 768 px die Karte. */}
      <p className="text-xs leading-normal text-muted-foreground md:hidden">
        Seite, Gerät und dein Hof gehen automatisch mit. Keine IP-Adresse, keine Cookies.
      </p>
      <div className={cn(KARTE, 'hidden flex-col gap-3 bg-card px-[18px] py-4 md:flex')}>
        <p className={KICKER}>Das schicken wir automatisch mit</p>
        <dl className="text-[13px]">
          <MitZeile name="Seite" wert={seiteKurz(kontext.seiteUrl)} />
          <MitZeile name="Gerät" wert={geraetKurz(kontext.userAgent)} />
          <MitZeile name="Hof" wert={hofName} />
          {kennungAnzeige !== '' && <MitZeile name="Fehlernummer" wert={kennungAnzeige} />}
        </dl>
        <p className="text-xs leading-normal text-muted-foreground">Keine IP-Adresse, keine Cookies.</p>
      </div>

      <DialogFehler text={fehler || null} />

      <div className="flex gap-2.5 md:justify-end">
        <Link href={MEINE_MELDUNGEN_HREF} className={cn(KNOPF_RAHMEN, 'hidden md:inline-flex')}>
          Abbrechen
        </Link>
        <button
          type="submit"
          disabled={isPending || upload.isUploading}
          aria-busy={isPending || undefined}
          className={cn(KNOPF_GRUEN, 'min-h-12 w-full rounded-[14px] md:min-h-11 md:w-auto md:rounded-full')}
        >
          {isPending ? 'Einen Moment …' : 'Absenden'}
        </button>
      </div>
    </form>
  )
}

function MitZeile({ name, wert }: { name: string; wert: string }): React.JSX.Element {
  return (
    <div className="flex gap-2.5 border-t border-border py-1.5">
      <dt className="w-[130px] shrink-0 text-muted-foreground">{name}</dt>
      <dd className="min-w-0 flex-1 break-words text-foreground">{wert || '–'}</dd>
    </div>
  )
}
