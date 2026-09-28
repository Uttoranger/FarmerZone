/**
 * Foto-Upload-Fehler an Sentry melden — der eigentliche Anlass der ganzen
 * Beobachtbarkeit: Die zweiwöchige Upload-Suche lief blind, weil Fehler nur
 * als Bildschirmfoto eines Bauern zurückkamen. Künftig steht ohne Screenshot
 * in Sentry, welcher Upload woran scheitert.
 *
 * DATENSPARSAMKEIT: KEIN Dateiname (— „Hof_Mueller_Franz.jpg" ist ein
 * personenbezogenes Datum, gleiche Regel wie protokolliereBildFehler in
 * upload-fehler.ts) und selbstverständlich KEIN Dateiinhalt. MIME-Typ,
 * Größe, Weg, Ursache, Versuchszahl und Android-Hauptversion sagen über
 * niemanden etwas aus. Die Diagnose je Anlauf kommt schon bereinigt an
 * (upload-diagnose.ts).
 *
 * Der Bau der Meldung ist rein und getestet; nur meldeUploadFehler und die
 * Geräteauskunft berühren Sentry bzw. den Browser — und werfen nie:
 * Telemetrie darf den Upload-Ablauf nicht verändern.
 */
import * as Sentry from '@sentry/nextjs'
import type { LeseDiagnose, LeseErgebnis, LeseVersuch, UploadAnlauf, UploadDiagnose, UploadSchritt } from '@/lib/upload-diagnose'
import { androidAuskunft, type AndroidAuskunft, type FotoWeg } from '@/lib/foto-wege'
import {
  bildFehlerArtVon,
  IMAGE_NETWORK_ERROR,
  IMAGE_STORAGE_ERROR,
  UPLOAD_DIAG,
  type BildFehlerArt,
} from '@/lib/upload-fehler'

/** Über welchen Weg die Datei kam — die vier Wege aus foto-wege.ts. */
export type UploadWeg = FotoWeg

/** Die Foto-Ursachen, plus Netz und Bildspeicher (keine Foto-Urteile)
 *  und Unbekannt. */
export type UploadUrsache = BildFehlerArt | 'netz' | 'bildspeicher' | 'unbekannt'

/** Ordnet einem gefangenen Fehler die Melde-Ursache zu — dieselbe Trennung
 *  wie in upload-fehler.ts: Foto-Urteile tragen ihre Art, Netzfehler- und
 *  Bildspeicher-Text ihre eigene, alles Übrige ehrlich 'unbekannt'. */
export function uploadUrsacheVon(e: unknown): UploadUrsache {
  const art = bildFehlerArtVon(e)
  if (art) return art
  if (e instanceof Error && e.message === IMAGE_NETWORK_ERROR) return 'netz'
  if (e instanceof Error && e.message === IMAGE_STORAGE_ERROR) return 'bildspeicher'
  return 'unbekannt'
}

export type UploadMeldung = {
  tags: { bereich: 'foto-upload'; ursache: UploadUrsache; kennung: string; schritt?: UploadSchritt }
  contexts: {
    upload: {
      dateiGroesseBytes: number
      dateiTyp: string
      weg: UploadWeg
      versuche: number
      /** Android-Hauptversion aus den Client Hints; null = kein Android oder unbekannt (foto-wege.ts). */
      androidVersion: number | null
    }
    uploadLesen?: UploadLesenKontext
  } & { [anlauf: `uploadAnlauf${number}`]: UploadAnlauf }
}

/**
 * Die Lese-Stufe als EIN flacher Kontext — aus demselben Grund wie die
 * Anläufe: Sentry kürzt verschachtelte Werte ab der dritten Ebene. Die
 * voll…-Felder fehlen, wenn die Probe gelang; die zweiterVersuch…-Felder,
 * wenn es keinen zweiten Versuch gab (Netz 1 nur nach sofortiger Ablehnung).
 */
export type UploadLesenKontext = {
  probeErgebnis: LeseErgebnis
  probeKlasse?: string
  probeMeldung?: string
  probeDauerMs: number
  vollErgebnis?: LeseErgebnis
  vollKlasse?: string
  vollMeldung?: string
  vollDauerMs?: number
  zweiterVersuchErgebnis?: LeseErgebnis
  zweiterVersuchKlasse?: string
  zweiterVersuchMeldung?: string
  zweiterVersuchDauerMs?: number
  /** Hat der zweite Leseversuch die Datei gebracht? null = es gab keinen. */
  zweiterVersuchGeholfen: boolean | null
}

function fehlerFelder(versuch: LeseVersuch): { klasse?: string; meldung?: string } {
  return versuch.ergebnis === 'fehler' ? { klasse: versuch.klasse, meldung: versuch.meldung } : {}
}

function lesenKontext({ probe, voll, zweiterVersuch }: LeseDiagnose): UploadLesenKontext {
  const kontext: UploadLesenKontext = {
    probeErgebnis: probe.ergebnis,
    probeDauerMs: probe.dauerMs,
    zweiterVersuchGeholfen: zweiterVersuch ? zweiterVersuch.ergebnis === 'ok' : null,
  }
  const probeFehler = fehlerFelder(probe)
  if (probeFehler.klasse !== undefined) {
    kontext.probeKlasse = probeFehler.klasse
    kontext.probeMeldung = probeFehler.meldung
  }
  if (voll) {
    kontext.vollErgebnis = voll.ergebnis
    kontext.vollDauerMs = voll.dauerMs
    const vollFehler = fehlerFelder(voll)
    if (vollFehler.klasse !== undefined) {
      kontext.vollKlasse = vollFehler.klasse
      kontext.vollMeldung = vollFehler.meldung
    }
  }
  if (zweiterVersuch) {
    kontext.zweiterVersuchErgebnis = zweiterVersuch.ergebnis
    kontext.zweiterVersuchDauerMs = zweiterVersuch.dauerMs
    const zweiterFehler = fehlerFelder(zweiterVersuch)
    if (zweiterFehler.klasse !== undefined) {
      kontext.zweiterVersuchKlasse = zweiterFehler.klasse
      kontext.zweiterVersuchMeldung = zweiterFehler.meldung
    }
  }
  return kontext
}

/**
 * Baut die Zusatzfelder des Sentry-Ereignisses — rein, ohne Dateinamen.
 *
 * Jeder Anlauf bekommt einen eigenen Kontext (uploadAnlauf1, uploadAnlauf2)
 * statt einer Liste unter `upload`: Sentry kürzt verschachtelte Werte ab der
 * dritten Ebene (normalizeDepth), eine Liste von Objekten käme als
 * „[Object]" an.
 */
export function baueUploadMeldung(eingabe: {
  ursache: UploadUrsache
  datei: { size: number; type: string }
  weg: UploadWeg
  versuche: number
  diagnose?: UploadDiagnose
  lesen?: LeseDiagnose
  androidVersion?: number | null
}): UploadMeldung {
  const meldung: UploadMeldung = {
    tags: { bereich: 'foto-upload', ursache: eingabe.ursache, kennung: UPLOAD_DIAG },
    contexts: {
      upload: {
        dateiGroesseBytes: eingabe.datei.size,
        dateiTyp: eingabe.datei.type || 'unbekannt',
        weg: eingabe.weg,
        versuche: eingabe.versuche,
        androidVersion: eingabe.androidVersion ?? null,
      },
    },
  }
  if (eingabe.diagnose) {
    meldung.tags.schritt = eingabe.diagnose.schritt
    eingabe.diagnose.anlaeufe.forEach((anlauf, i) => {
      meldung.contexts[`uploadAnlauf${i + 1}` as const] = anlauf
    })
  }
  if (eingabe.lesen) meldung.contexts.uploadLesen = lesenKontext(eingabe.lesen)
  return meldung
}

// ─── Geräteauskunft ─────────────────────────────────────────────────────────

type NavigatorMitHints = Navigator & {
  userAgentData?: {
    platform: string
    getHighEntropyValues?: (hints: string[]) => Promise<{ platformVersion?: string }>
  }
}

let auskunft: AndroidAuskunft | null = null
let hintsAngefragt = false

/**
 * Die Android-Auskunft, wie sie gerade vorliegt: aus den Client Hints, wenn
 * sie schon geantwortet haben, sonst aus dem User-Agent — der nennt seit
 * Chrome 110 für jedes Android „10", das gilt dann als unbekannt. Außerhalb
 * des Browsers null.
 */
export function geraeteAuskunft(): AndroidAuskunft | null {
  if (typeof navigator === 'undefined') return null
  if (!auskunft) auskunft = androidAuskunft({ userAgent: navigator.userAgent })
  return auskunft
}

/**
 * Holt die echte Android-Version einmal je Seitenlast über die Client Hints —
 * asynchron, deshalb VOR dem ersten Foto anstoßen (beim Öffnen der Auswahl,
 * beim Laden von /teilen). Bis die Antwort da ist, gilt der User-Agent;
 * ohne Client Hints (Safari, Firefox) bleibt er es. Wirft nie.
 */
export function bereiteGeraeteAuskunftVor(): void {
  try {
    if (hintsAngefragt || typeof navigator === 'undefined') return
    hintsAngefragt = true
    const daten = (navigator as NavigatorMitHints).userAgentData
    if (!daten || typeof daten.getHighEntropyValues !== 'function') return
    const userAgent = navigator.userAgent
    daten
      .getHighEntropyValues(['platformVersion'])
      .then((werte) => {
        auskunft = androidAuskunft({ userAgent, platform: daten.platform, platformVersion: werte.platformVersion })
      })
      .catch(() => {
        // Verweigert oder nicht unterstützt — der User-Agent bleibt die Auskunft.
      })
  } catch {
    // Ein Browser, der schon beim Zugriff wirft: Die Fotoauswahl muss trotzdem aufgehen.
  }
}

/**
 * Meldet einen Upload-Fehler an Sentry. Ohne initialisiertes Sentry
 * (fehlender DSN) ein No-op; und selbst wenn hier etwas schiefgeht, bleibt
 * es folgenlos — der Bauer bekommt seine Meldung aus dem bestehenden Pfad.
 */
export function meldeUploadFehler(
  fehler: unknown,
  eingabe: {
    datei: { size: number; type: string }
    weg: UploadWeg
    versuche: number
    /** Der Originalfehler je Anlauf, bereinigt — aus ladeFotoHoch (onDiagnose). */
    diagnose?: UploadDiagnose
    /** Wie die Lese-Stufe ausging, bereinigt — aus ladeFotoHoch (onLesen). */
    lesen?: LeseDiagnose
  }
): void {
  try {
    Sentry.captureException(
      fehler,
      baueUploadMeldung({
        ursache: uploadUrsacheVon(fehler),
        androidVersion: geraeteAuskunft()?.version ?? null,
        ...eingabe,
      })
    )
  } catch {
    // Telemetrie scheitert leise.
  }
}
