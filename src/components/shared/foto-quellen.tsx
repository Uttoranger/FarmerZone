'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Camera, FolderOpen, Image as ImageIcon, Share2 } from 'lucide-react'
import { dateienAusFeld, leereDateiFeld } from '@/lib/foto-feld'
import { gleicheDatei, teilenHinweis, type FotoWeg, type KartenGrund } from '@/lib/foto-wege'
import { bereiteGeraeteAuskunftVor, geraeteAuskunft } from '@/lib/upload-meldung'
import type { UploadZweck } from '@/lib/upload-pfade'

/**
 * Zwei Knöpfe zum Foto: „Foto wählen" und „Foto aufnehmen" — und dahinter
 * die Netze aus foto-wege.ts, wenn das Handy ein Foto nicht herausgibt.
 *
 * Vorher waren es drei Wege (Galerie, Dateien, Kamera), und der Bauer musste
 * wählen, ohne den Unterschied zu kennen (JAVASCRIPT-NEXTJS-5: dasselbe Foto
 * 16-mal nicht lesbar, die Meldung schickte ihn in eine Schleife). Jetzt:
 *
 *  - „Foto wählen": accept="image/*", ohne capture. Android zeigt damit die
 *    Systemfotoauswahl, die ab Android 12 auch Cloud-Fotos (Google Fotos)
 *    selbst lädt.
 *  - „Foto aufnehmen": capture="environment".
 *  - Die frühere Dokument-Auswahl ist zur RETTUNG geworden: eine verborgene
 *    Eingabe mit breitem accept, damit Android die Dateien-App zeigt, in der
 *    Google Fotos ein Bild beim Öffnen herunterlädt. Sie öffnet nur über die
 *    Karte („Anders auswählen").
 *  - Die Karte ersetzt die Fehlermeldung, wo das Foto oder der Weg das
 *    Problem war: mit „Anders auswählen", „Foto aufnehmen" und, wo es geht,
 *    dem Teilen aus der Galerie an die installierte App.
 *  - Dieselbe Datei nach einem Fehler noch einmal über „Foto wählen": sofort
 *    die Karte, kein neuer Versuch.
 *
 * Auf Touch-Geräten (grober Zeiger) öffnet der bestehende Auslöser das Menü
 * mit den zwei Knöpfen; am Desktop öffnet der Klick wie bisher direkt die
 * Dateiauswahl. Nach der Auswahl ist der Ablauf der bestehende: onFiles
 * bekommt die Dateien und den Weg.
 *
 * Seit #135 wird das Datei-Feld beim KLICK geleert, nicht nach der Auswahl:
 * Ein Schreibzugriff auf `value` entzieht auf Android-Chrome die Leseerlaubnis
 * für ein Foto aus der Galerie (JAVASCRIPT-NEXTJS-4). Die Reihenfolge und ihre
 * Begründung stehen in src/lib/foto-feld.ts.
 */

/** Über welchen der drei Knöpfe die Auswahl kam — Teilen läuft über /teilen. */
export type FotoQuellenWeg = Exclude<FotoWeg, 'teilen'>

/** Was die Karte zeigt: der Grund und der fertige Satz (karteText in upload-fehler.ts). */
export type FotoKarte = { grund: KartenGrund; text: string }

type OffeneKarte = FotoKarte & { hinweis: 'teilen' | 'installieren' | null }

/** Läuft die Seite als installierte App? Nur dort ist Teilen an FarmerZone möglich. */
function istInstalliert(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

const EINTRAG =
  'flex w-full min-h-12 items-center gap-3 rounded-xl px-4 text-left text-sm font-medium text-foreground hover:bg-muted/40 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
const ABBRECHEN =
  'mt-1 flex w-full min-h-12 items-center justify-center rounded-xl px-4 text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

export function useFotoQuellen({
  multiple = false,
  zweck,
  onFiles,
}: {
  multiple?: boolean
  /** Wohin das Foto soll — entscheidet, ob die Karte das Teilen anbietet. */
  zweck: UploadZweck
  onFiles: (dateien: File[], weg: FotoQuellenWeg) => void
}): { oeffnen: () => void; elemente: ReactNode; zeigeKarte: (karte: FotoKarte, datei?: { size: number; type: string }) => void } {
  const standardRef = useRef<HTMLInputElement>(null)
  const kameraRef = useRef<HTMLInputElement>(null)
  const rettungRef = useRef<HTMLInputElement>(null)
  const [menueOffen, setMenueOffen] = useState(false)
  const [karte, setKarte] = useState<OffeneKarte | null>(null)
  // Die Datei, an der es zuletzt scheiterte — kommt sie über „Foto wählen"
  // noch einmal (Größe und Typ gleich), gibt es sofort die Karte.
  const merker = useRef<{ size: number; type: string; karte: FotoKarte } | null>(null)

  // Escape schließt Menü und Karte — wie jedes Blatt.
  useEffect(() => {
    if (!menueOffen && !karte) return
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenueOffen(false)
        setKarte(null)
      }
    }
    window.addEventListener('keydown', beiTaste)
    return () => window.removeEventListener('keydown', beiTaste)
  }, [menueOffen, karte])

  /**
   * Geleert wird VOR dem Auswahldialog, nicht nach der Auswahl (#135).
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
    if (dateien.length === 0) return
    const gemerkt = merker.current
    if (weg === 'standard' && dateien.length === 1 && gemerkt && gleicheDatei(dateien[0], gemerkt)) {
      zeigeKarte(gemerkt.karte)
      return
    }
    // Eine andere Datei oder ein anderer Weg: Der alte Fehlschlag ist vorbei.
    merker.current = null
    onFiles(dateien, weg)
  }

  function oeffnen() {
    // Die Android-Version für die Diagnose jetzt anstoßen — asynchron, und
    // bis zum ersten möglichen Fehler längst da.
    bereiteGeraeteAuskunftVor()
    // Grober Zeiger = Touch-Gerät. Nur dort gibt es eine Kamera zur Wahl.
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) {
      setMenueOffen(true)
    } else {
      standardRef.current?.click()
    }
  }

  function waehle(ref: React.RefObject<HTMLInputElement | null>) {
    setMenueOffen(false)
    setKarte(null)
    ref.current?.click()
  }

  function zeigeKarte(neue: FotoKarte, datei?: { size: number; type: string }) {
    if (datei && neue.grund === 'lesen') merker.current = { size: datei.size, type: datei.type, karte: neue }
    setMenueOffen(false)
    setKarte({
      ...neue,
      hinweis: teilenHinweis({ zweck, android: geraeteAuskunft()?.android ?? false, installiert: istInstalliert() }),
    })
  }

  const elemente = (
    <>
      <input
        ref={standardRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onClick={vorAuswahl}
        onChange={(e) => auswahl(e, 'standard')}
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
      {/* Die Rettung: Das breite accept führt Android in die Dateien-App
          statt in die Fotoauswahl. Weil dort auch Nicht-Bilder wählbar sind,
          prüft die Lese-Stufe die ersten Bytes (foto-wege.ts). */}
      <input
        ref={rettungRef}
        type="file"
        accept="image/*,application/octet-stream"
        multiple={multiple}
        className="hidden"
        onClick={vorAuswahl}
        onChange={(e) => auswahl(e, 'rettung')}
      />

      {menueOffen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Foto auswählen">
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
            <button type="button" autoFocus className={EINTRAG} onClick={() => waehle(standardRef)}>
              <ImageIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              Foto wählen
            </button>
            <button type="button" className={EINTRAG} onClick={() => waehle(kameraRef)}>
              <Camera className="size-4 text-muted-foreground" aria-hidden="true" />
              Foto aufnehmen
            </button>
            <button type="button" className={ABBRECHEN} onClick={() => setMenueOffen(false)}>
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {karte && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Foto nicht lesbar">
          <button type="button" aria-label="Schließen" className="absolute inset-0 bg-black/40" onClick={() => setKarte(null)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(0,0,0,0.15)]">
            <p className="px-4 pt-2 pb-3 text-sm leading-relaxed text-foreground">{karte.text}</p>
            {karte.grund !== 'heic' && (
              <button type="button" autoFocus className={EINTRAG} onClick={() => waehle(rettungRef)}>
                <FolderOpen className="size-4 text-muted-foreground" aria-hidden="true" />
                Anders auswählen
              </button>
            )}
            <button type="button" autoFocus={karte.grund === 'heic'} className={EINTRAG} onClick={() => waehle(kameraRef)}>
              <Camera className="size-4 text-muted-foreground" aria-hidden="true" />
              Foto aufnehmen
            </button>
            {/* Netz 3: Beim Teilen stellt die Galerie die Bytes selbst bereit,
                inklusive Cloud-Abruf — nur in der installierten App. */}
            {karte.hinweis === 'teilen' && (
              <p className="flex items-start gap-3 px-4 py-3 text-sm text-muted-foreground">
                <Share2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>Oder in der Galerie: Teilen → FarmerZone</span>
              </p>
            )}
            {karte.hinweis === 'installieren' && (
              <p className="flex items-start gap-3 px-4 py-3 text-sm text-muted-foreground">
                <Share2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  Oder installiere FarmerZone als App (Browser-Menü → „Zum Startbildschirm hinzufügen“). Dann
                  kannst du Fotos aus der Galerie direkt an FarmerZone teilen.
                </span>
              </p>
            )}
            <button type="button" className={ABBRECHEN} onClick={() => setKarte(null)}>
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </>
  )

  return { oeffnen, elemente, zeigeKarte }
}
