'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ladeFotoHoch,
  stufenText,
  type UploadStufe,
} from '@/components/shared/image-upload'
import type { LeseDiagnose, UploadDiagnose } from '@/lib/upload-diagnose'
import { bildFehlerMeldung } from '@/lib/upload-fehler'
import { bereiteGeraeteAuskunftVor, meldeUploadFehler } from '@/lib/upload-meldung'
import { MAX_ORIGINAL_BYTES } from '@/lib/upload-pfade'
import { leseGeteilteFotos, leereGeteilteFotos } from '@/lib/teilen-ablage'
import { updateFarmBannerAction } from '@/server/actions/appearance'
import { addFarmPhotoAction } from '@/server/actions/farm-photos'
import { EINSTELLUNG_MEIN_AUFTRITT } from '@/lib/bauern-navigation'
import { MARKE } from '@/lib/marke'
import { HinweiskarteFehler } from '@/components/ui/hinweiskarte'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { RUNDUNG } from '@/components/ui/rundung'
import { FOTO_HUELLE } from '@/components/ui/bild-dunkel'
import { WerkzeugKopf } from '@/components/ui/werkzeug-kopf'
import { FesteAktionsleiste, AKTIONSLEISTE_KNOPF } from '@/components/ui/feste-aktionsleiste'
import { cn } from '@/lib/utils'

/** Rückweg und Ausweg (Board s2/w2-teilen): dieselbe Startseite des Hofbereichs, dasselbe Wort. */
const HEUTE_HREF = '/dashboard'
const ZU_HEUTE = 'Zu Heute'
/** Board s2/w2-teilen Bild 3: ein Absatz ohne eigene Überschrift (Nr. 250); davor stehen die Meldungen der Fotos mit Kürzel (C-Zeile „[S139]“). */
const TEILEN_FEHLER_SATZ = 'Die Fotos sind nicht hochgeladen, sie liegen noch hier. Prüf den Empfang und tippe auf „Nochmal“.'
const TEILEN_FEHLER_AUSWEG = 'Du kannst sie auch später unter Mein Hof › Hofseite hochladen.'
const TEILEN_TITEL = 'Geteilte Fotos'

type Ziel = 'banner' | 'gallery'

type Ergebnis = { name: string; ok: boolean; meldung?: string }

/**
 * Seit Nr. 181 im neuen Design (`data-design="neu"` am <main>): nur Tokens, in
 * beiden Themes lesbar — Links und das Häkchen grün (`text-brand-text`), nie
 * `text-primary` (orange Text taugt im Dunkeln nicht). Eine Shell trägt die
 * Seite bewusst nicht: Sie ist das Ziel des Teilens-Menüs, keine Seite zum
 * Stöbern; der Weg zurück sind die Links darin.
 *
 * Nimmt die geteilten Fotos aus der Ablage entgegen und lädt sie über den
 * bestehenden Upload-Weg hoch — zweck 'banner' (Titelbild, nur bei genau
 * einem Foto) oder 'gallery' (Hofgalerie, bei mehreren immer). Die Serie
 * läuft sequenziell wie die bestehende Galerie-Serie. Die Ablage wird erst
 * geleert, wenn ALLE Fotos durch sind — ein gescheitertes bleibt für den
 * nächsten Versuch liegen.
 */
export function TeilenClient({
  hofSlug,
}: {
  hofSlug: string
}) {
  // null = Ablage wird noch gelesen
  const [fotos, setFotos] = useState<File[] | null>(null)
  const [vorschauen, setVorschauen] = useState<string[]>([])
  const [ziel, setZiel] = useState<Ziel>('gallery')
  const [laeuft, setLaeuft] = useState(false)
  const [laufend, setLaufend] = useState<{
    index: number
    stufe: UploadStufe
    prozent: number
  } | null>(null)
  const [ergebnisse, setErgebnisse] = useState<Ergebnis[] | null>(null)
  // Nach dem Hochladen gehört der Fokus auf das Ergebnis (Liste Lauf 32, teilen „Fokus nach Erfolg“).
  const zuHeuteNachErfolg = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    // Die Android-Version für die Diagnose — asynchron, vor dem ersten Upload.
    bereiteGeraeteAuskunftVor()
    let vorschauUrls: string[] = []
    ;(async () => {
      // Ohne Cache-API (sehr alte Browser) gibt es schlicht keine Ablage
      const geteilte = 'caches' in window ? await leseGeteilteFotos(window.caches) : []
      vorschauUrls = geteilte.map((f) => URL.createObjectURL(f))
      setFotos(geteilte)
      setVorschauen(vorschauUrls)
      // Ein einzelnes Foto ist meist ein Titelbild-Kandidat — Vorauswahl,
      // die Wahl bleibt beim Bauern. Mehrere Fotos: nur die Galerie.
      if (geteilte.length === 1) setZiel('banner')
    })()
    return () => {
      for (const url of vorschauUrls) URL.revokeObjectURL(url)
    }
  }, [])

  const mehrere = (fotos?.length ?? 0) > 1
  const wirksamesZiel: Ziel = mehrere ? 'gallery' : ziel

  async function hochladen() {
    if (!fotos || fotos.length === 0 || laeuft) return
    setLaeuft(true)
    setErgebnisse(null)

    const ausgang: Ergebnis[] = []
    try {
      for (let i = 0; i < fotos.length; i++) {
        const foto = fotos[i]
        if (foto.size > MAX_ORIGINAL_BYTES) {
          ausgang.push({ name: foto.name, ok: false, meldung: 'Datei zu groß (max. 25 MB)' })
          continue
        }
        setLaufend({ index: i, stufe: 'lesen', prozent: 0 })
        // 0 = der Transfer hat nie begonnen — nur für die Sentry-Meldung.
        let versuche = 0
        let diagnose: UploadDiagnose | undefined
        let lesen: LeseDiagnose | undefined
        let url: string
        try {
          url = await ladeFotoHoch(foto, wirksamesZiel, {
            weg: 'teilen',
            onStufe: (stufe) => setLaufend((v) => (v ? { ...v, stufe } : v)),
            onFortschritt: (prozent) => setLaufend((v) => (v ? { ...v, prozent } : v)),
            onVersuch: (versuch) => {
              versuche = versuch
            },
            onDiagnose: (d) => {
              diagnose = d
            },
            onLesen: (l) => {
              lesen = l
            },
          })
        } catch (e) {
          // Zusätzlich zur Anzeige nach Sentry — der Teilen-Weg ist der
          // vierte Weg neben Galerie, Dateien und Kamera (upload-meldung.ts).
          meldeUploadFehler(e, { datei: foto, weg: 'teilen', versuche, diagnose, lesen })
          ausgang.push({ name: foto.name, ok: false, meldung: bildFehlerMeldung(e).text })
          continue
        }
        try {
          const ergebnis =
            wirksamesZiel === 'banner'
              ? await updateFarmBannerAction('PHOTO', url)
              : await addFarmPhotoAction({ url })
          if ('error' in ergebnis && ergebnis.error) {
            ausgang.push({ name: foto.name, ok: false, meldung: ergebnis.error })
          } else {
            ausgang.push({ name: foto.name, ok: true })
          }
        } catch (e) {
          // KEIN Upload-Fehler mehr (der Transfer gelang) — keine
          // Foto-Upload-Meldung, nur die bestehende Anzeige.
          ausgang.push({ name: foto.name, ok: false, meldung: bildFehlerMeldung(e).text })
        }
      }
    } finally {
      setLaufend(null)
      setLaeuft(false)
    }

    setErgebnisse(ausgang)
    if (ausgang.every((e) => e.ok) && 'caches' in window) {
      // Erst jetzt leeren: Ein gescheitertes Foto bleibt liegen und kann
      // über „Nochmal" ohne erneutes Teilen hochgeladen werden.
      await leereGeteilteFotos(window.caches)
    }
  }

  const fertigOhneFehler = ergebnisse !== null && ergebnisse.every((e) => e.ok)

  useEffect(() => {
    if (fertigOhneFehler) zuHeuteNachErfolg.current?.focus()
  }, [fertigOhneFehler])

  return (
    <main data-design="neu" className="min-h-screen bg-background px-4 pt-5 pb-8 md:px-8 md:pt-8">
      {/* 520 px wie im Board w2-teilen (vorher 448), linksbündig. */}
      <div className="max-w-[520px]">
        {/* Werkzeug-Kopf (G1, Nr. 250): am Handy die feste Leiste mit „‹“ nach Heute (Elternseite in
            bauern-navigation.ts), im Web der Textlink „‹ Heute“ über der h1; die Seite steht ohne Shell. */}
        <WerkzeugKopf titel={TEILEN_TITEL} />
        <p className="mb-6 text-[15px] leading-[1.45] text-muted-foreground">
          Fotos, die du aus der Galerie an {MARKE} teilst, landen hier.
        </p>

        {/* Ablage wird gelesen */}
        {fotos === null && <p className="text-sm text-muted-foreground">Einen Moment …</p>}

        {/* Aufgerufen ohne geteilte Datei: der dezente Hinweis */}
        {fotos !== null && fotos.length === 0 && !ergebnisse && (
          // Board s2/w2-teilen Bild 2: gestrichelter Kasten ohne Symbol, Titel fett in eigener Zeile, „Zu Heute“ als Umriss über die Breite.
          <div className={cn('flex flex-col gap-2 border border-border bg-card p-5', RUNDUNG.karte)}>
            <p className="text-[16px] font-bold text-foreground">Gerade wurde nichts geteilt</p>
            <p className="text-sm leading-[1.45] text-muted-foreground">
              So geht’s: {MARKE} über das Browser-Menü als App installieren, dann in der Galerie ein Foto wählen und über
              „Teilen“ an {MARKE} schicken – das funktioniert auch mit Cloud-Fotos.
            </p>
            <Link
              href={HEUTE_HREF}
              className={cn(
                'mt-2 flex min-h-[52px] w-full items-center justify-center rounded-[14px] border-[1.5px] border-foreground bg-card px-4 text-[16px] font-bold text-foreground hover:bg-muted',
                FOKUS_RAHMEN
              )}
            >
              {ZU_HEUTE}
            </Link>
          </div>
        )}

        {/* Fotos da, noch nicht (fertig) hochgeladen */}
        {fotos !== null && fotos.length > 0 && !fertigOhneFehler && (
          // Frei auf der Seite wie im Board (keine zusätzliche Karte); Vorschauen zweispaltig über die Breite.
          <div>
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              {vorschauen.map((url, i) => (
                /* Vorschau ist nur Vorschau: Ob die Datei taugt, entscheidet
                   der Server — ein nicht darstellbares Bild bleibt trotzdem
                   in der Liste. */
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt={fotos[i]?.name || `Foto ${i + 1}`}
                  className={cn('aspect-[4/3] w-full bg-muted object-cover', RUNDUNG.feld, FOTO_HUELLE)}
                />
              ))}
            </div>

            {/* Zielauswahl — bei mehreren Fotos ist nur die Galerie sinnvoll */}
            {mehrere ? (
              <p className="text-[15px] font-semibold text-foreground mb-4">
                {fotos.length} Fotos – sie gehen in die Hofgalerie.
              </p>
            ) : (
              // Zwei Radio-Karten mit Kreis links (Liste Lauf 32, teilen „Auswahl Titelbild / Hofgalerie“).
              <div className="mb-4 flex flex-col gap-2" role="radiogroup" aria-label="Wohin damit?">
                {(
                  [
                    ['banner', 'Titelbild'],
                    ['gallery', 'Hofgalerie'],
                  ] as const
                ).map(([wert, label]) => (
                  <button
                    key={wert}
                    type="button"
                    role="radio"
                    aria-checked={ziel === wert}
                    onClick={() => setZiel(wert)}
                    className={cn(
                      'flex min-h-[52px] w-full items-center gap-3 border-[1.5px] bg-card px-3.5 text-left text-[16px] font-semibold text-foreground transition-colors hover:bg-muted',
                      RUNDUNG.karte,
                      ziel === wert ? 'border-foreground' : 'border-border',
                      FOKUS_RAHMEN
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'grid size-5 shrink-0 place-items-center rounded-full border-2',
                        ziel === wert ? 'border-foreground' : 'border-muted-foreground'
                      )}
                    >
                      {ziel === wert && <span className="size-2.5 rounded-full bg-foreground" />}
                    </span>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Fehlgeschlagene aus dem letzten Lauf: orange Karte mit „Nochmal“ (V17, Board s2/w2-teilen Bild 3) — die Fotos bleiben in der Ablage. */}
            {ergebnisse && !laeuft ? (
              <HinweiskarteFehler nochmal={hochladen} laeuft={laeuft}>
                {/* Gleiche Meldungen nur einmal — zwei Fotos mit demselben Netzfehler sagten sonst zweimal dasselbe. */}
                <p>
                  {[...new Set(ergebnisse.filter((e) => !e.ok).map((e) => e.meldung))].join(' ')} {TEILEN_FEHLER_SATZ}{' '}
                  {TEILEN_FEHLER_AUSWEG}
                </p>
              </HinweiskarteFehler>
            ) : (
              // Am Handy fest unten (G2, ohne Unterleiste: die Seite hat keine Shell), im Web schmal und linksbündig.
              <FesteAktionsleiste ueberUnterleiste={false}>
                <button
                  type="button"
                  onClick={hochladen}
                  aria-busy={laeuft || undefined}
                  className={cn(AKTIONSLEISTE_KNOPF, 'md:w-auto md:px-6 aria-busy:opacity-60')}
                >
                  {laeuft && laufend
                    ? fotos.length > 1
                      ? `Foto ${laufend.index + 1} von ${fotos.length} — ${stufenText(laufend)}`
                      : stufenText(laufend)
                    : wirksamesZiel === 'banner'
                      ? 'Als Titelbild übernehmen'
                      : 'In die Hofgalerie laden'}
                </button>
              </FesteAktionsleiste>
            )}
          </div>
        )}

        {/* Alles angekommen */}
        {fertigOhneFehler && (
          <div role="status" className={cn('flex flex-col gap-3 border border-border bg-card p-5', RUNDUNG.karte)}>
            <p className="text-[15px] leading-relaxed font-semibold text-foreground">
              {ergebnisse.length === 1
                ? wirksamesZiel === 'banner'
                  ? 'Das Foto ist dein neues Titelbild.'
                  : 'Das Foto ist in deiner Hofgalerie.'
                : `${ergebnisse.length} Fotos sind in deiner Hofgalerie.`}
            </p>
            <div className="flex flex-col gap-1">
              <Link
                ref={zuHeuteNachErfolg}
                href={HEUTE_HREF}
                className={cn('inline-flex min-h-11 w-fit items-center text-sm font-semibold text-brand-text underline underline-offset-4', FOKUS_RAHMEN)}
              >
                {ZU_HEUTE}
              </Link>
              <Link
                href={`/${hofSlug}`}
                className={cn('inline-flex min-h-11 w-fit items-center text-sm font-medium text-brand-text underline underline-offset-4', FOKUS_RAHMEN)}
              >
                Zur Hofseite
              </Link>
              <Link
                href={EINSTELLUNG_MEIN_AUFTRITT.href}
                className={cn('inline-flex min-h-11 w-fit items-center text-sm font-medium text-brand-text underline underline-offset-4', FOKUS_RAHMEN)}
              >
                Zu „{EINSTELLUNG_MEIN_AUFTRITT.label}“
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
