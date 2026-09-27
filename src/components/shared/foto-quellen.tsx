'use client'

import { useRef, useState, type ReactNode } from 'react'
import { Camera, FolderOpen, Image as ImageIcon } from 'lucide-react'
import { dateienAusFeld, leereDateiFeld } from '@/lib/foto-feld'

/**
 * Drei Wege zum Foto: Galerie, Dateien, Kamera.
 *
 * Androids Galerie-Picker liefert für cloud-ausgelagerte Fotos tote
 * Datei-Referenzen (Samsung/OneDrive „Speicher freigeben"): Die Galerie
 * zeigt das Bild, aber die Bytes kommen nie heraus — die Lese-Stufe
 * scheitert quer durch Alben. Die Dokument-Auswahl („Aus Dateien", bewusst
 * OHNE accept-Filter, damit „Eigene Dateien"/Downloads aufgeht) und die
 * Kamera sind davon nicht betroffen.
 *
 * Auf Touch-Geräten (grober Zeiger) öffnet der bestehende Auslöser deshalb
 * ein kleines Menü mit allen drei Wegen; am Desktop gibt es das Problem
 * nicht — dort öffnet der Klick wie bisher direkt die Dateiauswahl. Nach
 * der Auswahl ist der Ablauf exakt der bestehende: onFiles bekommt die
 * Dateien, sonst ändert sich nichts.
 *
 * Seit #134 wird das Datei-Feld beim KLICK geleert, nicht nach der Auswahl:
 * Ein Schreibzugriff auf `value` entzieht auf Android-Chrome die Leseerlaubnis
 * für ein Foto aus der Galerie (JAVASCRIPT-NEXTJS-4). Die Reihenfolge und ihre
 * Begründung stehen in src/lib/foto-feld.ts.
 */
/** Welcher der drei Wege gewählt wurde — reine Zusatzinformation für die
 *  Fehler-Meldung an Sentry (upload-meldung.ts); am Ablauf ändert sie nichts. */
export type FotoQuellenWeg = 'galerie' | 'dateien' | 'kamera'

export function useFotoQuellen({
  multiple = false,
  onFiles,
}: {
  multiple?: boolean
  onFiles: (dateien: File[], weg: FotoQuellenWeg) => void
}): { oeffnen: () => void; elemente: ReactNode } {
  const galerieRef = useRef<HTMLInputElement>(null)
  const dateienRef = useRef<HTMLInputElement>(null)
  const kameraRef = useRef<HTMLInputElement>(null)
  const [menueOffen, setMenueOffen] = useState(false)

  /**
   * Geleert wird VOR dem Auswahldialog, nicht nach der Auswahl (#134).
   *
   * `e.currentTarget` ist das angeklickte Feld — derselbe Handler taugt für
   * alle drei. `.click()` aus `oeffnen`/`waehle` löst ihn genauso aus wie ein
   * echter Fingertipp, und zwar synchron, bevor der Dialog aufgeht.
   * Begründung der Reihenfolge: src/lib/foto-feld.ts.
   */
  function vorAuswahl(e: React.MouseEvent<HTMLInputElement>) {
    leereDateiFeld(e.currentTarget)
  }

  function auswahl(e: React.ChangeEvent<HTMLInputElement>, weg: FotoQuellenWeg) {
    // BEWUSST ohne Zurücksetzen: Das würde die gerade gewählte Datei auf
    // Android entwerten, bevor sie gelesen ist.
    const dateien = dateienAusFeld(e.target)
    if (dateien.length > 0) onFiles(dateien, weg)
  }

  function oeffnen() {
    // Grober Zeiger = Touch-Gerät. Nur dort existiert das Cloud-Album-Problem
    // samt der Wahl zwischen Galerie, Dateien und Kamera.
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) {
      setMenueOffen(true)
    } else {
      galerieRef.current?.click()
    }
  }

  function waehle(ref: React.RefObject<HTMLInputElement | null>) {
    setMenueOffen(false)
    ref.current?.click()
  }

  const eintragKlasse =
    'flex w-full min-h-12 items-center gap-3 rounded-xl px-4 text-left text-sm font-medium text-foreground hover:bg-muted/40 transition-colors'

  const elemente = (
    <>
      <input
        ref={galerieRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onClick={vorAuswahl}
        onChange={(e) => auswahl(e, 'galerie')}
      />
      {/* BEWUSST ohne accept: erst das öffnet die Dokument-Auswahl mit
          „Eigene Dateien" und Downloads statt des Galerie-Pickers — der Weg
          an den toten Cloud-Referenzen vorbei. Was kein Bild ist, weist der
          Server an den Bytes ab. */}
      <input
        ref={dateienRef}
        type="file"
        multiple={multiple}
        className="hidden"
        onClick={vorAuswahl}
        onChange={(e) => auswahl(e, 'dateien')}
      />
      <input
        ref={kameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onClick={vorAuswahl}
        onChange={(e) => auswahl(e, 'kamera')}
      />

      {menueOffen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-label="Foto auswählen">
          <button
            type="button"
            aria-label="Abbrechen"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMenueOffen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(0,0,0,0.15)]">
            <p className="px-4 pt-1 pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Foto auswählen
            </p>
            <button type="button" className={eintragKlasse} onClick={() => waehle(galerieRef)}>
              <ImageIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              Aus der Galerie
            </button>
            <button type="button" className={eintragKlasse} onClick={() => waehle(dateienRef)}>
              <FolderOpen className="size-4 text-muted-foreground" aria-hidden="true" />
              Aus Dateien
            </button>
            <button type="button" className={eintragKlasse} onClick={() => waehle(kameraRef)}>
              <Camera className="size-4 text-muted-foreground" aria-hidden="true" />
              Foto aufnehmen
            </button>
            <button
              type="button"
              className="mt-1 flex w-full min-h-12 items-center justify-center rounded-xl px-4 text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
              onClick={() => setMenueOffen(false)}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </>
  )

  return { oeffnen, elemente }
}
