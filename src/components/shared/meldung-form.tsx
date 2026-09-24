'use client'

import { useState, useSyncExternalStore, useTransition } from 'react'
import Link from 'next/link'
import { Bug, Lightbulb, HelpCircle, ImagePlus, X, Loader2 } from 'lucide-react'
import { meldungAbsenden } from '@/server/actions/meldung'
import {
  MELDUNG_ARTEN,
  MELDUNG_ART_SATZ,
  MELDUNG_KENNUNG_MAX,
  MELDUNG_TEXT_MAX,
  MELDUNG_TEXT_MIN,
  type MeldungArt,
} from '@/lib/meldung'
import { useImageUpload, stufenText } from '@/components/shared/image-upload'
import { Button } from '@/components/ui/button'

/**
 * Das Meldeformular des Fehlerbriefkastens — EINE Komponente, zwei Einstiege:
 * im Bauernbereich (/fehler-melden, mit Screenshot) und öffentlich
 * (/problem-melden, mit freiwilliger E-Mail für Rückfragen).
 *
 * Was automatisch mitgeht, steht sichtbar unter dem Formular: Seite, Browser,
 * Bildschirmgröße, Zeit, bei eingeloggtem Hof der Hof. KEINE IP, keine Cookies.
 */

const ART_ICON: Record<MeldungArt, typeof Bug> = { FEHLER: Bug, WUNSCH: Lightbulb, FRAGE: HelpCircle }

// Honigtopf: aus dem Blickfeld, aus der Tab-Reihenfolge, aus dem Screenreader —
// dasselbe Muster wie die Registrierung (register-form.tsx).
const HONIGTOPF_STIL: React.CSSProperties = {
  position: 'absolute',
  left: '-10000px',
  top: 'auto',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
}

type Kontext = { seiteUrl: string; userAgent: string; viewport: string }

const KEIN_KONTEXT: Kontext = { seiteUrl: '', userAgent: '', viewport: '' }

function kontextJetzt(): Kontext {
  if (typeof window === 'undefined') return KEIN_KONTEXT
  // Die Seite, von der die Meldung kommt: der Verweis, wenn er von uns stammt —
  // sonst die Adresse des Formulars selbst.
  let seiteUrl = window.location.href
  try {
    if (document.referrer && new URL(document.referrer).origin === window.location.origin) {
      seiteUrl = document.referrer
    }
  } catch {
    // Verweis nicht lesbar — die eigene Adresse genügt
  }
  return {
    seiteUrl,
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  }
}

// Der Kontext ist Browserwissen (Adresse, User-Agent, Fenstergröße) und darf
// erst NACH der Hydration erscheinen — der Server kennt ihn nicht, und ein
// Wert schon beim ersten Client-Render ergäbe eine Hydration-Abweichung.
// useSyncExternalStore liefert auf dem Server und während der Hydration den
// leeren Stand, danach den echten; der Snapshot wird nur bei Änderung neu
// gebaut (React verlangt ein stabiles Objekt).
let letzterKontext: Kontext = KEIN_KONTEXT
function kontextSnapshot(): Kontext {
  const neu = kontextJetzt()
  if (
    neu.seiteUrl !== letzterKontext.seiteUrl ||
    neu.userAgent !== letzterKontext.userAgent ||
    neu.viewport !== letzterKontext.viewport
  ) {
    letzterKontext = neu
  }
  return letzterKontext
}
function kontextAbonnieren(melden: () => void): () => void {
  window.addEventListener('resize', melden)
  return () => window.removeEventListener('resize', melden)
}

export function MeldungForm({
  formToken,
  alsHof,
  hofName,
}: {
  /** Signierter Zeitstempel aus dem Seitenaufbau (Zweck 'meldung'). */
  formToken: string
  /** Eingeloggter Hof: Screenshot möglich, keine E-Mail-Abfrage. */
  alsHof: boolean
  hofName?: string
}) {
  const [art, setArt] = useState<MeldungArt>('FEHLER')
  const [text, setText] = useState('')
  const [kennung, setKennung] = useState('')
  const [email, setEmail] = useState('')
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [website, setWebsite] = useState('')
  const [fehler, setFehler] = useState('')
  const [kurznummer, setKurznummer] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const kontext = useSyncExternalStore(kontextAbonnieren, kontextSnapshot, () => KEIN_KONTEXT)

  const upload = useImageUpload({
    variant: 'meldung',
    onUploaded: (url) => setScreenshotUrl(url),
  })

  function absenden(e: React.FormEvent) {
    e.preventDefault()
    setFehler('')
    startTransition(async () => {
      const result = await meldungAbsenden({
        art,
        text,
        seiteUrl: kontext.seiteUrl,
        userAgent: kontext.userAgent,
        viewport: kontext.viewport,
        diagKennung: kennung,
        customerEmail: alsHof ? '' : email,
        screenshotUrl: screenshotUrl ?? '',
        website,
        formToken,
      })
      if ('error' in result) setFehler(result.error)
      else setKurznummer(result.kurznummer)
    })
  }

  if (kurznummer) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading text-lg font-semibold text-foreground">Danke — ist angekommen.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Deine Kurznummer:{' '}
          <span className="font-mono text-base font-semibold text-foreground">{kurznummer}</span>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {alsHof
            ? 'Den Stand deiner Meldung findest du unter „Meine Meldungen“.'
            : 'Merk dir die Kurznummer, falls du nachfragen möchtest.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {alsHof && (
            <Link href="/meldungen" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90">
              Meine Meldungen
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              setKurznummer(null)
              setText('')
              setKennung('')
              setScreenshotUrl(null)
            }}
            className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted/40"
          >
            Noch etwas melden
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={absenden} className="space-y-5">
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

      {/* Art: drei Knöpfe */}
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-foreground">Worum geht es?</legend>
        {/* Drei Sätze statt „Fehler / Wunsch / Frage" — untereinander, weil ein
            Satz bei 375 px nicht in ein Drittel passt. Die Werte bleiben dieselben. */}
        <div className="grid gap-2 sm:grid-cols-3">
          {MELDUNG_ARTEN.map((wert) => {
            const Icon = ART_ICON[wert]
            const aktiv = art === wert
            return (
              <button
                key={wert}
                type="button"
                onClick={() => setArt(wert)}
                aria-pressed={aktiv}
                className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-medium transition-colors sm:flex-col sm:justify-center sm:gap-1 sm:text-center ${
                  aktiv ? 'border-primary bg-primary/8 text-primary' : 'border-border bg-card text-foreground hover:bg-muted/40'
                }`}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {MELDUNG_ART_SATZ[wert]}
              </button>
            )
          })}
        </div>
      </fieldset>

      {/* Text */}
      <div>
        <label htmlFor="meldung-text" className="mb-1 block text-sm font-medium text-foreground">
          Was ist passiert, was hättest du erwartet?
        </label>
        <textarea
          id="meldung-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          maxLength={MELDUNG_TEXT_MAX}
          required
          minLength={MELDUNG_TEXT_MIN}
          placeholder="z. B. Beim Speichern eines Produkts kam „Bild konnte nicht verarbeitet werden“, obwohl es ein normales JPEG war."
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
        />
        <p className="mt-1 text-right text-xs text-muted-foreground">
          {text.length} / {MELDUNG_TEXT_MAX}
        </p>
      </div>

      {/* Screenshot — nur eingeloggte Höfe (der Upload-Weg braucht eine Hof-Sitzung) */}
      {alsHof && (
        <div>
          <span className="mb-1 block text-sm font-medium text-foreground">Bildschirmfoto (optional)</span>
          {screenshotUrl ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={screenshotUrl} alt="Bildschirmfoto zur Meldung" className="h-20 w-20 rounded-lg border border-border object-cover" />
              <button
                type="button"
                onClick={() => setScreenshotUrl(null)}
                className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs text-foreground hover:bg-muted/40"
              >
                <X className="size-3.5" aria-hidden="true" /> Entfernen
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={upload.openFilePicker}
                disabled={upload.isUploading}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-dashed border-border px-4 text-sm text-foreground hover:bg-muted/40 disabled:opacity-60"
              >
                {upload.isUploading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-4" aria-hidden="true" />}
                {upload.isUploading && upload.progress ? stufenText(upload.progress) : 'Bildschirmfoto anhängen'}
              </button>
              {upload.fileInput}
            </>
          )}
        </div>
      )}

      {/* Kennung */}
      <div>
        <label htmlFor="meldung-kennung" className="mb-1 block text-sm font-medium text-foreground">
          Kennung aus der Fehlermeldung (optional)
        </label>
        <input
          id="meldung-kennung"
          value={kennung}
          onChange={(e) => setKennung(e.target.value)}
          maxLength={MELDUNG_KENNUNG_MAX}
          placeholder="z. B. S71"
          className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground sm:w-48"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Manche Fehlermeldungen enden auf ein Kürzel in eckigen Klammern — das hilft uns, den Stand zu finden.
        </p>
      </div>

      {/* E-Mail — nur Kundinnen */}
      {!alsHof && (
        <div>
          <label htmlFor="meldung-email" className="mb-1 block text-sm font-medium text-foreground">
            E-Mail (optional, nur für Rückfragen)
          </label>
          <input
            id="meldung-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="du@beispiel.at"
            className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
          />
        </div>
      )}

      {/* Was mitgeht — sichtbar erklärt */}
      <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Das schicken wir automatisch mit:</p>
        <ul className="mt-1 space-y-0.5 break-all">
          <li>Seite: {kontext.seiteUrl || '–'}</li>
          <li>Browser: {kontext.userAgent || '–'}</li>
          <li>Bildschirm: {kontext.viewport || '–'} · Zeit: beim Absenden</li>
          {alsHof && <li>Hof: {hofName ?? 'dein Hof'}</li>}
        </ul>
        <p className="mt-1">Keine IP-Adresse, keine Cookies.</p>
      </div>

      {fehler && <p className="text-sm text-destructive">{fehler}</p>}

      <Button type="submit" disabled={isPending || upload.isUploading} className="h-12 w-full text-base font-semibold sm:w-auto sm:px-6">
        {isPending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : 'Meldung absenden'}
      </Button>
    </form>
  )
}
