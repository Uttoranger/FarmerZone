'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Camera, Loader2, X } from 'lucide-react'
import { MELDUNG_ARTEN, MELDUNG_ART_SATZ, MELDUNG_KENNUNG_MAX, MELDUNG_TEXT_MAX, MELDUNG_TEXT_MIN } from '@/lib/meldung'
import { MEINE_MELDUNGEN_HREF, MELDUNG_TEXT_LABEL, mitgeschicktSatz } from '@/lib/hof-hilfe'
import { stufenText } from '@/components/shared/image-upload'
import { HONIGTOPF_STIL, useMeldungFormular } from '@/components/shared/use-meldung-formular'
import { FELD, FELD_LABEL, KICKER, KNOPF_GRUEN, KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { cn } from '@/lib/utils'

/**
 * Das öffentliche Meldeformular des Fehlerbriefkastens (/problem-melden) —
 * seit Nr. 54 im neuen Design nach dem Mockup fehler-500-problem-melden-kunde
 * (dort als Dialog über der Fehlerseite; hier als Karte in der KundeShell).
 * Kundinnen melden mit freiwilliger E-Mail für Rückfragen; ein eingeloggter
 * Hof wird an der Sitzung erkannt und bekommt den Screenshot-Weg. Der
 * Hofbereich (/fehler-melden) zeigt „Meldung abgeben"
 * (components/hof-hilfe/meldung-abgeben.tsx); beide teilen die Logik aus
 * useMeldungFormular — Honigtopf, Zeitschranke, Kontext ohne IP und Cookies.
 *
 * Abweichungen vom Mockup (Bericht 54): drei Arten statt zwei (Wunsch bleibt,
 * wie im Hofbereich); die Fehlernummer bleibt ein freiwilliges Feld (wer
 * nicht von der Fehlerseite kommt, hat keine vorbelegt); unter 768 px steht
 * „Absenden" über die volle Breite und „Abbrechen" entfällt — dort führen
 * Kopf und Unterleiste der Shell weiter.
 */
export function MeldungForm({
  formToken,
  alsHof,
  kennungVorbelegt = '',
}: {
  /** Signierter Zeitstempel aus dem Seitenaufbau (Zweck 'meldung'). */
  formToken: string
  /** Eingeloggter Hof: Screenshot möglich, keine E-Mail-Abfrage. */
  alsHof: boolean
  /**
   * Die Fehlernummer aus der Adresse, schon geprüft (`bereinigeKennung`,
   * src/lib/fehlerseite.ts). Wer von der Fehlerseite kommt, soll sie nicht
   * abtippen müssen. Nur der Startwert — danach gehört das Feld dem Menschen.
   */
  kennungVorbelegt?: string
}) {
  const {
    art,
    setArt,
    text,
    setText,
    kennung,
    setKennung,
    email,
    setEmail,
    screenshotUrl,
    setScreenshotUrl,
    website,
    setWebsite,
    fehler,
    kurznummer,
    isPending,
    upload,
    absenden,
    nochEtwas,
  } = useMeldungFormular({ formToken, alsHof, kennungVorbelegt })

  // Nach dem Absenden ersetzt der Dank das Formular — der Fokus zieht mit,
  // sonst stünde er auf einem Knopf, den es nicht mehr gibt.
  const dankeRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (kurznummer) dankeRef.current?.focus()
  }, [kurznummer])

  if (kurznummer) {
    return (
      <div className="flex flex-col gap-2">
        <h2 ref={dankeRef} tabIndex={-1} className="font-heading text-xl font-semibold text-foreground outline-none">
          Danke — ist angekommen.
        </h2>
        <p className="text-sm text-muted-foreground">
          Deine Kurznummer: <span className="font-mono text-base font-semibold text-foreground">{kurznummer}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {alsHof
            ? 'Den Stand deiner Meldung findest du unter „Hilfe und Rückmeldung“.'
            : 'Merk dir die Kurznummer, falls du nachfragen möchtest.'}
        </p>
        <div className="mt-2 flex flex-wrap gap-2.5">
          {alsHof && (
            <Link href={MEINE_MELDUNGEN_HREF} className={KNOPF_GRUEN}>
              Zu deinen Meldungen
            </Link>
          )}
          <button type="button" onClick={nochEtwas} className={KNOPF_RAHMEN}>
            Noch etwas melden
          </button>
        </div>
      </div>
    )
  }

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
        {/* Drei Sätze statt „Fehler / Wunsch / Frage" — am Handy untereinander,
            weil ein Satz bei 375 px nicht in ein Drittel passt. */}
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
                  'min-h-12 rounded-xl p-3 text-left text-[13.5px] font-semibold text-foreground transition-colors duration-[250ms] sm:text-center',
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
          className={cn(FELD, 'min-h-[96px] resize-y leading-normal')}
        />
        <p id="meldung-text-zaehler" className="text-right text-[11.5px] text-muted-foreground tabular-nums">
          {text.length} / {MELDUNG_TEXT_MAX}
        </p>
      </div>

      {/* Screenshot — nur eingeloggte Höfe (der Upload-Weg braucht eine Hof-Sitzung). */}
      {alsHof && (
        <div>
          {/* Die Datei-Felder außerhalb der Fallunterscheidung (#135): Standen sie
              im Zweig ohne Bildschirmfoto, hängte der Erfolg sie mitten im
              laufenden Upload aus — dasselbe Muster wie das Leeren des Feldes. */}
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
                'flex min-h-12 w-full items-center gap-3 rounded-xl border-[1.5px] border-dashed border-border px-3.5 py-3 text-left text-[13.5px] text-foreground transition-colors duration-[250ms] hover:bg-muted disabled:opacity-60',
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
        </div>
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

      {/* E-Mail — nur Kundinnen (die Adresse eines Hofs kennen wir schon). */}
      {!alsHof && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="meldung-email" className={cn(FELD_LABEL, 'mb-0')}>
            Deine E-Mail <span className="font-normal">· nur für unsere Antwort, optional</span>
          </label>
          <input
            id="meldung-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="du@example.com"
            className={cn(FELD, 'min-h-11')}
          />
        </div>
      )}

      {/* Was mitgeht — ein Satz wie im Mockup, ohne Technik. */}
      <p className="rounded-[11px] border border-border bg-background px-3 py-2.5 text-[12.5px] leading-normal text-muted-foreground">
        {mitgeschicktSatz(kennung, alsHof)}
      </p>

      {/* Die Ablehnung des Servers inline als orange Hinweiskarte (DESIGN_SYSTEM „Zustände"), kein Toast. */}
      {fehler && (
        <div role="alert">
          <Hinweiskarte ton="orange">{fehler}</Hinweiskarte>
        </div>
      )}

      <div className="flex gap-2.5 md:justify-end">
        <Link href="/" className={cn(KNOPF_RAHMEN, 'hidden md:inline-flex')}>
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
