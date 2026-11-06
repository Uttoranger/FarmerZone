'use client'

import { useState, useSyncExternalStore, useTransition } from 'react'
import * as Sentry from '@sentry/nextjs'
import { meldungAbsenden } from '@/server/actions/meldung'
import { MELDUNG_NICHT_GESPEICHERT, type MeldungArt } from '@/lib/meldung'
import { NETZ_SATZ, istNetzFehler } from '@/lib/netz'
import { BEZEICHNER, befundVon } from '@/lib/upload-diagnose'
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

/**
 * Meldet ein gescheitertes Absenden an Sentry — seit der Wurf nicht mehr an die Fehlergrenze geht, sähe Sentry ihn
 * sonst nicht (CODING_STANDARDS §4 „Fremde Fehler nach Sentry“): fester Text, die Klasse als Name, die Nachricht
 * bereinigt (befundVon), nie der Text der Meldung. Ein Netzabbruch ist nur eine Brotkrume. Wirft nie.
 */
export function meldeGescheitertesAbsenden(fehler: unknown): void {
  try {
    const { klasse, meldung } = befundVon(fehler)
    const name = BEZEICHNER.test(klasse) ? klasse : 'Unbekannt'
    if (istNetzFehler(fehler)) {
      Sentry.addBreadcrumb({ category: 'meldung', level: 'warning', message: 'Meldung: Verbindung abgebrochen', data: { klasse: name } })
      return
    }
    const ereignis = new Error('Meldung: Absenden gescheitert')
    ereignis.name = name
    Sentry.captureException(ereignis, { level: 'error', tags: { bereich: 'meldung-absenden', klasse: name }, extra: { fehlertext: meldung } })
  } catch {
    // Absichtlich leer: Telemetrie scheitert leise, der Satz an der Karte kommt trotzdem.
  }
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
  /**
   * Nur nach einer gescheiterten Anfrage (Netz, Wurf der Aktion): schickt dieselben Eingaben noch einmal — die
   * Fehlerkarte zeigt dann „Nochmal“ (Register N29). Bei einer Ablehnung (zu viele Meldungen, Text zu kurz) fehlt
   * er: Dort hilft nur, die Eingabe zu ändern oder zu warten.
   */
  nochmal?: () => void
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

  const [gescheitert, setGescheitert] = useState(false)

  function senden() {
    setFehler('')
    setGescheitert(false)
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof meldungAbsenden>>
      try {
        result = await meldungAbsenden({
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
      } catch (wurf) {
        // Geworfen ginge es an die Fehlergrenze (500), und der Text wäre weg (Board Bild 6, Nr. 242). Darum der
        // Satz an der Karte, die Eingaben bleiben, „Nochmal“ schickt dieselben noch einmal.
        meldeGescheitertesAbsenden(wurf)
        setFehler(istNetzFehler(wurf) ? NETZ_SATZ : MELDUNG_NICHT_GESPEICHERT)
        setGescheitert(true)
        return
      }
      if ('error' in result) setFehler(result.error)
      else setKurznummer(result.kurznummer)
    })
  }

  function absenden(e: React.FormEvent) {
    e.preventDefault()
    senden()
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
    nochmal: gescheitert ? senden : undefined,
    kurznummer,
    isPending,
    kontext,
    upload,
    absenden,
    nochEtwas,
  }
}
