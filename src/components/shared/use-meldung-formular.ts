'use client'

import { useState, useSyncExternalStore, useTransition } from 'react'
import { meldungAbsenden } from '@/server/actions/meldung'
import type { MeldungArt } from '@/lib/meldung'
import { useImageUpload } from '@/components/shared/image-upload'

/**
 * Die Logik des Meldeformulars im Fehlerbriefkasten — EINE Quelle für beide
 * Gestalten: das Bestandsformular (MeldungForm, öffentlich auf /problem-melden)
 * und „Meldung abgeben" im neuen Design (components/hof-hilfe/meldung-abgeben.tsx,
 * /fehler-melden in der HofShell, seit Nachtlauf Nr. 22e). Zustand, Kontext,
 * Bildschirmfoto und Absenden stehen hier, damit beide genau dasselbe schicken:
 * Honigtopf, Zeitschranke (formToken), Kontext ohne IP und Cookies.
 *
 * Wer meldet, entscheidet weiter der Server aus der Sitzung, nie das Formular
 * (`alsHof` steuert nur, ob die E-Mail mitgeht und das Bildschirmfoto
 * angeboten wird).
 */

// Honigtopf: aus dem Blickfeld, aus der Tab-Reihenfolge, aus dem Screenreader —
// dasselbe Muster wie die Registrierung (register-form.tsx). Hier, damit beide
// Gestalten des Formulars dasselbe Feld tragen.
export const HONIGTOPF_STIL: React.CSSProperties = {
  position: 'absolute',
  left: '-10000px',
  top: 'auto',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
}

export type Kontext = { seiteUrl: string; userAgent: string; viewport: string }

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

export type MeldungFormular = {
  art: MeldungArt
  setArt: (art: MeldungArt) => void
  text: string
  setText: (text: string) => void
  kennung: string
  setKennung: (kennung: string) => void
  email: string
  setEmail: (email: string) => void
  screenshotUrl: string | null
  setScreenshotUrl: (url: string | null) => void
  website: string
  setWebsite: (wert: string) => void
  /** Die Ablehnung des Servers als Satz; leer = kein Fehler. */
  fehler: string
  /** Nach dem Absenden die Kurznummer, sonst null. */
  kurznummer: string | null
  isPending: boolean
  kontext: Kontext
  upload: ReturnType<typeof useImageUpload>
  absenden: (e: React.FormEvent) => void
  nochEtwas: () => void
}

export function useMeldungFormular({
  formToken,
  alsHof,
  kennungVorbelegt,
}: {
  /** Signierter Zeitstempel aus dem Seitenaufbau (Zweck 'meldung'). */
  formToken: string
  alsHof: boolean
  /** Die schon geprüfte Fehlernummer aus der Adresse — nur der Startwert. */
  kennungVorbelegt: string
}): MeldungFormular {
  const [art, setArt] = useState<MeldungArt>('FEHLER')
  const [text, setText] = useState('')
  const [kennung, setKennung] = useState(kennungVorbelegt)
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

  /** „Noch etwas melden": zurück zum leeren Formular, die Art bleibt. */
  function nochEtwas() {
    setKurznummer(null)
    setText('')
    setKennung('')
    setScreenshotUrl(null)
  }

  return {
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
    kontext,
    upload,
    absenden,
    nochEtwas,
  }
}
