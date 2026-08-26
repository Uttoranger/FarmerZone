/**
 * Foto-Upload-Fehler an Sentry melden — der eigentliche Anlass der ganzen
 * Beobachtbarkeit: Die zweiwöchige Upload-Suche lief blind, weil Fehler nur
 * als Bildschirmfoto eines Bauern zurückkamen. Künftig steht ohne Screenshot
 * in Sentry, welcher Upload woran scheitert.
 *
 * DATENSPARSAMKEIT: KEIN Dateiname (— „Hof_Mueller_Franz.jpg" ist ein
 * personenbezogenes Datum, gleiche Regel wie protokolliereBildFehler in
 * upload-fehler.ts) und selbstverständlich KEIN Dateiinhalt. MIME-Typ,
 * Größe, Weg, Ursache und Versuchszahl sagen über niemanden etwas aus.
 *
 * Der Bau der Meldung ist rein und getestet; nur meldeUploadFehler berührt
 * Sentry — und wirft nie: Telemetrie darf den Upload-Ablauf nicht verändern.
 */
import * as Sentry from '@sentry/nextjs'
import {
  bildFehlerArtVon,
  IMAGE_NETWORK_ERROR,
  UPLOAD_DIAG,
  type BildFehlerArt,
} from '@/lib/upload-fehler'

/** Über welchen Weg die Datei kam (#71: drei Quellen plus Teilen-Ziel). */
export type UploadWeg = 'galerie' | 'dateien' | 'kamera' | 'teilen'

/** Die drei Foto-Ursachen, plus Netz (kein Foto-Urteil) und Unbekannt. */
export type UploadUrsache = BildFehlerArt | 'netz' | 'unbekannt'

/** Ordnet einem gefangenen Fehler die Melde-Ursache zu — dieselbe Trennung
 *  wie in upload-fehler.ts: Foto-Urteile tragen ihre Art, der Netzfehler-Text
 *  ist 'netz', alles Übrige ehrlich 'unbekannt'. */
export function uploadUrsacheVon(e: unknown): UploadUrsache {
  const art = bildFehlerArtVon(e)
  if (art) return art
  if (e instanceof Error && e.message === IMAGE_NETWORK_ERROR) return 'netz'
  return 'unbekannt'
}

export type UploadMeldung = {
  tags: { bereich: 'foto-upload'; ursache: UploadUrsache; kennung: string }
  contexts: {
    upload: {
      dateiGroesseBytes: number
      dateiTyp: string
      weg: UploadWeg
      versuche: number
    }
  }
}

/** Baut die Zusatzfelder des Sentry-Ereignisses — rein, ohne Dateinamen. */
export function baueUploadMeldung(eingabe: {
  ursache: UploadUrsache
  datei: { size: number; type: string }
  weg: UploadWeg
  versuche: number
}): UploadMeldung {
  return {
    tags: { bereich: 'foto-upload', ursache: eingabe.ursache, kennung: UPLOAD_DIAG },
    contexts: {
      upload: {
        dateiGroesseBytes: eingabe.datei.size,
        dateiTyp: eingabe.datei.type || 'unbekannt',
        weg: eingabe.weg,
        versuche: eingabe.versuche,
      },
    },
  }
}

/**
 * Meldet einen Upload-Fehler an Sentry. Ohne initialisiertes Sentry
 * (fehlender DSN) ein No-op; und selbst wenn hier etwas schiefgeht, bleibt
 * es folgenlos — der Bauer bekommt seine Meldung aus dem bestehenden Pfad.
 */
export function meldeUploadFehler(
  fehler: unknown,
  eingabe: { datei: { size: number; type: string }; weg: UploadWeg; versuche: number }
): void {
  try {
    Sentry.captureException(fehler, baueUploadMeldung({ ursache: uploadUrsacheVon(fehler), ...eingabe }))
  } catch {
    // Telemetrie scheitert leise.
  }
}
