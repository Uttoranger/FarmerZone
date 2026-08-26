'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ImageIcon } from 'lucide-react'
import {
  ladeFotoHoch,
  stufenText,
  type UploadStufe,
} from '@/components/shared/image-upload'
import { bildFehlerMeldung } from '@/lib/upload-fehler'
import { meldeUploadFehler } from '@/lib/upload-meldung'
import { MAX_ORIGINAL_BYTES } from '@/lib/upload-pfade'
import { leseGeteilteFotos, leereGeteilteFotos } from '@/lib/teilen-ablage'
import { updateFarmBannerAction } from '@/server/actions/appearance'
import { addFarmPhotoAction } from '@/server/actions/farm-photos'

type Ziel = 'banner' | 'gallery'

type Ergebnis = { name: string; ok: boolean; meldung?: string }

/**
 * Nimmt die geteilten Fotos aus der Ablage entgegen und lädt sie über den
 * bestehenden Upload-Weg hoch — zweck 'banner' (Titelbild, nur bei genau
 * einem Foto) oder 'gallery' (Hofgalerie, bei mehreren immer). Die Serie
 * läuft sequenziell wie die bestehende Galerie-Serie. Die Ablage wird erst
 * geleert, wenn ALLE Fotos durch sind — ein gescheitertes bleibt für den
 * nächsten Versuch liegen.
 */
export function TeilenClient({
  hofSlug,
  bisherigesTitelbild,
}: {
  hofSlug: string
  bisherigesTitelbild: string | null
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

  useEffect(() => {
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
        let url: string
        try {
          url = await ladeFotoHoch(foto, wirksamesZiel, {
            altUrl:
              wirksamesZiel === 'banner' ? (bisherigesTitelbild ?? undefined) : undefined,
            onStufe: (stufe) => setLaufend((v) => (v ? { ...v, stufe } : v)),
            onFortschritt: (prozent) => setLaufend((v) => (v ? { ...v, prozent } : v)),
            onVersuch: (versuch) => {
              versuche = versuch
            },
          })
        } catch (e) {
          // Zusätzlich zur Anzeige nach Sentry — der Teilen-Weg ist der
          // vierte Weg neben Galerie, Dateien und Kamera (upload-meldung.ts).
          meldeUploadFehler(e, { datei: foto, weg: 'teilen', versuche })
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
      // über „Nochmal versuchen" ohne erneutes Teilen hochgeladen werden.
      await leereGeteilteFotos(window.caches)
    }
  }

  const fertigOhneFehler = ergebnisse !== null && ergebnisse.every((e) => e.ok)

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-md">
        <h1 className="font-heading text-2xl font-semibold text-foreground mb-1">
          Geteilte Fotos
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Fotos, die du aus der Galerie an FarmerZone teilst, landen hier.
        </p>

        {/* Ablage wird gelesen */}
        {fotos === null && <p className="text-sm text-muted-foreground">Einen Moment …</p>}

        {/* Aufgerufen ohne geteilte Datei: der dezente Hinweis */}
        {fotos !== null && fotos.length === 0 && !ergebnisse && (
          <div className="rounded-2xl bg-card p-6 shadow-sm">
            <ImageIcon className="size-6 text-muted-foreground mb-3" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-foreground">
              Gerade wurde nichts geteilt. So geht’s: FarmerZone über das Browser-Menü als
              App installieren, dann in der Galerie ein Foto wählen und über „Teilen“ an
              FarmerZone schicken — das funktioniert auch mit Cloud-Fotos, bei denen der
              Datei-Picker scheitert.
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4"
            >
              Zur Übersicht
            </Link>
          </div>
        )}

        {/* Fotos da, noch nicht (fertig) hochgeladen */}
        {fotos !== null && fotos.length > 0 && !fertigOhneFehler && (
          <div className="rounded-2xl bg-card p-5 shadow-sm">
            <div className="grid grid-cols-3 gap-2 mb-4">
              {vorschauen.map((url, i) => (
                /* Vorschau ist nur Vorschau: Ob die Datei taugt, entscheidet
                   der Server — ein nicht darstellbares Bild bleibt trotzdem
                   in der Liste. */
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt={fotos[i]?.name || `Foto ${i + 1}`}
                  className="aspect-square w-full rounded-lg object-cover bg-muted"
                />
              ))}
            </div>

            {/* Zielauswahl — bei mehreren Fotos ist nur die Galerie sinnvoll */}
            {mehrere ? (
              <p className="text-xs text-muted-foreground mb-4">
                {fotos.length} Fotos — sie gehen in die Hofgalerie.
              </p>
            ) : (
              <div className="flex gap-2 mb-4" role="radiogroup" aria-label="Wohin damit?">
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
                    className={`flex-1 min-h-11 rounded-xl border text-sm font-medium transition-colors ${
                      ziel === wert
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-foreground hover:bg-muted/40'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Fehlgeschlagene aus dem letzten Lauf */}
            {ergebnisse && (
              <ul className="mb-4 space-y-1">
                {ergebnisse
                  .filter((e) => !e.ok)
                  .map((e, i) => (
                    <li key={i} className="text-sm leading-relaxed text-destructive">
                      {e.meldung}
                    </li>
                  ))}
              </ul>
            )}

            <button
              type="button"
              onClick={hochladen}
              disabled={laeuft}
              className="w-full min-h-12 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {laeuft && laufend
                ? fotos.length > 1
                  ? `Foto ${laufend.index + 1} von ${fotos.length} — ${stufenText(laufend)}`
                  : stufenText(laufend)
                : ergebnisse
                  ? 'Nochmal versuchen'
                  : wirksamesZiel === 'banner'
                    ? 'Als Titelbild übernehmen'
                    : 'In die Hofgalerie laden'}
            </button>
          </div>
        )}

        {/* Alles angekommen */}
        {fertigOhneFehler && (
          <div className="rounded-2xl bg-card p-6 shadow-sm">
            <CheckCircle2 className="size-6 text-primary mb-3" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-foreground mb-4">
              {ergebnisse.length === 1
                ? wirksamesZiel === 'banner'
                  ? 'Das Foto ist dein neues Titelbild.'
                  : 'Das Foto ist in deiner Hofgalerie.'
                : `${ergebnisse.length} Fotos sind in deiner Hofgalerie.`}
            </p>
            <div className="flex flex-col gap-1">
              <Link
                href={`/${hofSlug}`}
                className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4"
              >
                Zur Hofseite
              </Link>
              <Link
                href="/settings/appearance"
                className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4"
              >
                Zu „Mein Auftritt“
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
