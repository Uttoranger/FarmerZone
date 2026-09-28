'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Camera, FolderOpen, Image as ImageIcon, Share2 } from 'lucide-react'
import { dateienAusFeld, leereDateiFeld } from '@/lib/foto-feld'
import { browserSpeicher, leseFotoWeg, loescheFotoWeg, schreibeFotoWeg } from '@/lib/foto-weg-speicher'
import {
  auswegFuer,
  ersterWeg,
  merkerNachErgebnis,
  sofortKarte,
  standardWeg,
  teilenHinweis,
  zuMerken,
  type AuswahlWeg,
  type Fehlschlag,
  type FotoWeg,
  type KartenGrund,
  type WegWahl,
} from '@/lib/foto-wege'
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
 *  - „Foto wählen" öffnet den ersten Weg des Geräts (foto-wege.ts,
 *    ersterWeg): auf Android die Dateien-App (breites accept), sonst die
 *    Galerie (accept="image/*", ohne capture). Seit JAVASCRIPT-NEXTJS-6 ist
 *    das auf Android umgedreht — der Galerie-Weg gab dort dasselbe Foto nicht
 *    verlässlich heraus, die Dateien-App schon.
 *  - „Foto aufnehmen": capture="environment".
 *  - Die Karte ersetzt die Fehlermeldung, wo das Foto oder der Weg das
 *    Problem war: mit dem Ausweg (dem jeweils anderen Weg — „Aus der Galerie"
 *    oder „Anders auswählen"), „Foto aufnehmen" und, wo es geht, dem Teilen
 *    aus der Galerie an die installierte App.
 *  - Klappt der Ausweg, merkt sich das Gerät ihn (foto-weg-speicher.ts) und
 *    „Foto wählen" öffnet künftig direkt ihn; scheitert der gemerkte Weg,
 *    wird er vergessen. Das meldet der Aufrufer über meldeErgebnis.
 *  - Dieselbe Datei nach einem Fehler noch einmal über denselben Weg: sofort
 *    die Karte, kein neuer Versuch.
 *
 * Auf Touch-Geräten (grober Zeiger) öffnet der bestehende Auslöser das Menü
 * mit den zwei Knöpfen; am Desktop öffnet der Klick wie bisher direkt die
 * Dateiauswahl. Nach der Auswahl ist der Ablauf der bestehende: onFiles
 * bekommt die Dateien und die Auswahl (Weg und Wahl).
 *
 * Seit #135 wird das Datei-Feld beim KLICK geleert, nicht nach der Auswahl:
 * Ein Schreibzugriff auf `value` entzieht auf Android-Chrome die Leseerlaubnis
 * für ein Foto aus der Galerie (JAVASCRIPT-NEXTJS-4). Die Reihenfolge und ihre
 * Begründung stehen in src/lib/foto-feld.ts.
 */

/** Über welche der drei Eingaben die Auswahl kam — Teilen läuft über /teilen. */
export type FotoQuellenWeg = Exclude<FotoWeg, 'teilen'>

/** Eine Auswahl: über welchen Weg, und warum dieser Weg (Standard, Ausweg, gemerkt). */
export type FotoAuswahl = { weg: FotoQuellenWeg; wahl: WegWahl }

/** Was die Karte zeigt: der Grund und der fertige Satz (karteText in upload-fehler.ts). */
export type FotoKarte = { grund: KartenGrund; text: string }

type OffeneKarte = FotoKarte & { hinweis: 'teilen' | 'installieren' | null; ausweg: AuswahlWeg }

/** Der Knopf für den Ausweg — je nachdem, welcher Weg der andere ist. */
const AUSWEG_KNOPF: Record<AuswahlWeg, string> = {
  galerie: 'Aus der Galerie',
  dateien: 'Anders auswählen',
}

function istAndroid(): boolean {
  return geraeteAuskunft()?.android ?? false
}

/** Was „Foto wählen" gerade öffnet — der gemerkte Weg, sonst der Standard des Geräts. */
function ersteAuswahl(): { weg: AuswahlWeg; wahl: WegWahl } {
  return ersterWeg({ android: istAndroid(), gemerkt: leseFotoWeg(browserSpeicher()) })
}

/** Läuft die Seite als installierte App? Nur dort ist Teilen an FarmerZone möglich. */
function istInstalliert(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** Was der Screenreader zur Karte ansagt — je Grund. */
const KARTEN_LABEL: Record<KartenGrund, string> = {
  lesen: 'Foto nicht lesbar',
  heic: 'Format noch nicht möglich',
  'kein-foto': 'Kein Foto',
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
  onFiles: (dateien: File[], auswahl: FotoAuswahl) => void
}): {
  oeffnen: () => void
  elemente: ReactNode
  /** Die Karte nach einem Fehlschlag dieser Auswahl; `dateien` merkt die unlesbaren für sofortKarte. */
  zeigeKarte: (karte: FotoKarte, auswahl: FotoAuswahl, dateien?: readonly Fehlschlag[]) => void
  /** Ob die Lese-Stufe die Datei dieser Auswahl bekam — pflegt den gemerkten Weg (merkerNachErgebnis). */
  meldeErgebnis: (auswahl: FotoAuswahl, lesbar: boolean) => void
} {
  const galerieRef = useRef<HTMLInputElement>(null)
  const dateienRef = useRef<HTMLInputElement>(null)
  const kameraRef = useRef<HTMLInputElement>(null)
  const [menueOffen, setMenueOffen] = useState(false)
  const [karte, setKarte] = useState<OffeneKarte | null>(null)
  // Die Dateien, an denen es zuletzt scheiterte, und ihr Weg — kommt eine
  // über denselben Weg noch einmal (Größe und Typ gleich), gibt es sofort die Karte.
  const merker = useRef<{ weg: FotoQuellenWeg; dateien: Fehlschlag[]; karte: FotoKarte } | null>(null)
  // Warum die gerade geöffnete Eingabe geöffnet wurde. Gesetzt unmittelbar
  // vor dem click(); die Auswahl kommt erst, wenn der Dialog zu ist.
  const offeneWahl = useRef<WegWahl>('standard')

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
    const gewaehlt: FotoAuswahl = { weg, wahl: offeneWahl.current }
    const gemerkt = merker.current
    if (gemerkt && sofortKarte(gewaehlt, dateien, gemerkt)) {
      zeigeKarte(gemerkt.karte, gewaehlt)
      return
    }
    // Eine andere Datei oder ein anderer Weg: Der alte Fehlschlag ist vorbei.
    merker.current = null
    onFiles(dateien, gewaehlt)
  }

  const eingabe: Record<FotoQuellenWeg, React.RefObject<HTMLInputElement | null>> = {
    galerie: galerieRef,
    dateien: dateienRef,
    kamera: kameraRef,
  }

  function oeffnen() {
    // Die Android-Version für die Diagnose jetzt anstoßen — asynchron, und
    // bis zum ersten möglichen Fehler längst da.
    bereiteGeraeteAuskunftVor()
    // Grober Zeiger = Touch-Gerät. Nur dort gibt es eine Kamera zur Wahl.
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) {
      setMenueOffen(true)
    } else {
      fotoWaehlen()
    }
  }

  function waehle({ weg, wahl }: FotoAuswahl) {
    setMenueOffen(false)
    setKarte(null)
    offeneWahl.current = wahl
    eingabe[weg].current?.click()
  }

  /** „Foto wählen": der Weg wird erst beim Tippen bestimmt — der Merker kann sich seit dem Laden geändert haben. */
  function fotoWaehlen() {
    waehle(ersteAuswahl())
  }

  function zeigeKarte(neue: FotoKarte, gescheitert: FotoAuswahl, dateien?: readonly Fehlschlag[]) {
    const merke = dateien ? zuMerken(neue.grund, dateien) : []
    if (merke.length > 0) merker.current = { weg: gescheitert.weg, dateien: merke, karte: neue }
    setMenueOffen(false)
    setKarte({
      ...neue,
      hinweis: teilenHinweis({ zweck, android: istAndroid(), installiert: istInstalliert() }),
      ausweg: auswegFuer(gescheitert.weg, ersteAuswahl().weg),
    })
  }

  function meldeErgebnis(gewaehlt: FotoAuswahl, lesbar: boolean) {
    const aenderung = merkerNachErgebnis({ ...gewaehlt, lesbar, standard: standardWeg(istAndroid()) })
    if (aenderung?.art === 'setzen') schreibeFotoWeg(browserSpeicher(), aenderung.weg)
    else if (aenderung?.art === 'loeschen') loescheFotoWeg(browserSpeicher())
  }

  const elemente = (
    <>
      {/* Die Galerie: accept="image/*" ohne capture — Android zeigt die
          Systemfotoauswahl, das iPhone die Mediathek samt iCloud-Abruf.
          Erster Weg auf iPhone und Desktop, Ausweg auf Android. */}
      <input
        ref={galerieRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onClick={vorAuswahl}
        onChange={(e) => auswahl(e, 'galerie')}
      />
      {/* Die Dateien-App: Das breite accept führt Android in die Dateien-App
          statt in die Fotoauswahl. Erster Weg auf Android, Ausweg sonst.
          Weil dort auch Nicht-Bilder wählbar sind, prüft die Lese-Stufe die
          ersten Bytes (foto-wege.ts). */}
      <input
        ref={dateienRef}
        type="file"
        accept="image/*,application/octet-stream"
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
            <button type="button" autoFocus className={EINTRAG} onClick={fotoWaehlen}>
              <ImageIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              Foto wählen
            </button>
            <button type="button" className={EINTRAG} onClick={() => waehle({ weg: 'kamera', wahl: 'standard' })}>
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
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={KARTEN_LABEL[karte.grund]}>
          <button type="button" aria-label="Schließen" className="absolute inset-0 bg-black/40" onClick={() => setKarte(null)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(0,0,0,0.15)]">
            <p className="px-4 pt-2 pb-3 text-sm leading-relaxed text-foreground">{karte.text}</p>
            {/* Der Ausweg: der jeweils andere Auswahlweg (foto-wege.ts,
                auswegFuer). Bei HEIC hilft kein anderer Weg — das Foto
                bleibt in seinem Format. */}
            {karte.grund !== 'heic' && (
              <button
                type="button"
                autoFocus
                className={EINTRAG}
                onClick={() => waehle({ weg: karte.ausweg, wahl: 'ausweg' })}
              >
                {karte.ausweg === 'galerie' ? (
                  <ImageIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <FolderOpen className="size-4 text-muted-foreground" aria-hidden="true" />
                )}
                {AUSWEG_KNOPF[karte.ausweg]}
              </button>
            )}
            <button
              type="button"
              autoFocus={karte.grund === 'heic'}
              className={EINTRAG}
              onClick={() => waehle({ weg: 'kamera', wahl: 'ausweg' })}
            >
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

  return { oeffnen, elemente, zeigeKarte, meldeErgebnis }
}
