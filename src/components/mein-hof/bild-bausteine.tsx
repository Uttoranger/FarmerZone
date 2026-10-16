'use client'

import { useEffect, useState, useTransition, type ReactNode } from 'react'
import Image from 'next/image'
import { Camera, ChevronDown, ChevronUp, Crop, Loader2, Plus, Trash2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { updateFarmBannerAction, updateFarmLogoAction } from '@/server/actions/appearance'
import { speichereBildAusschnittAction } from '@/server/actions/bild-ausschnitt'
import {
  addFarmPhotoAction,
  deleteFarmPhotoAction,
  moveFarmPhotoAction,
  updateFarmPhotoCaptionAction,
} from '@/server/actions/farm-photos'
import type { FarmPhotoData } from '@/server/queries/appearance'
import { stufenText, useImageUpload } from '@/components/shared/image-upload'
import { CoverEditButton, TITELBILD_KNOPF_STIL } from '@/components/farm/farm-page-view'
import { BildAusschnitt } from '@/components/shared/bild-ausschnitt'
import { titelbildFoto, titelbildVerlauf } from '@/lib/mein-hof'
import {
  TITELBILD_AUSSCHNITT_TEXT,
  TITELBILD_RAHMEN_COMPUTER,
  TITELBILD_VORSCHAU_BROWSER,
  TITELBILD_VORSCHAU_HANDY,
  titelbildAusschnitt,
  titelbildDarstellung,
  titelbildHinweis,
} from '@/lib/titelbild'
import { AUSSCHNITT_STANDARD, bildStil } from '@/lib/bild-ausschnitt'
import {
  BILD_RAHMEN_TEXT,
  GALERIE_RAHMEN_KACHEL,
  GALERIE_VORSCHAU_HANDY,
  LOGO_RAHMEN,
  LOGO_VORSCHAU_PX,
  alsFotoAusschnitt,
} from '@/lib/bild-rahmen'
import { hofInitialen } from '@/lib/hof-initialen'
import { MARKE } from '@/lib/marke'
import type { BildAusschnitt as BildAusschnittWert } from '@/schemas/bild-ausschnitt'
import { useBildmasse } from '@/components/hofseite/titelbild'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

/*
 * Die Bild-Bausteine von Mein Hof — Titelbild, Logo und Fotos (Nachtlauf
 * Nr. 50, Register N4): ab lg in der Zeile des Editors, unter lg im Blatt von
 * unten, dieselben Bausteine. Logo und Fotos kommen aus dem früheren „Mein
 * Auftritt" (/settings/appearance, seit Nr. 50 eine Umleitung), das Titelbild
 * aus dem Editor. Der Upload ist unverändert: useImageUpload
 * (components/shared/image-upload.tsx) mit HEIC-Sperre und WebP, gespeichert
 * über die eigenen Aktionen jedes Bildes — nie über saveAppearanceAction.
 *
 * Jeder Baustein speichert sofort. `meldeErfolg` ersetzt den eigenen Toast
 * (unter lg „Gespeichert · Ansehen"), `onGespeichert` lädt danach Vorschau
 * bzw. Seite neu, `onHochladen` meldet, solange ein Foto hochlädt — dann
 * bleiben Blatt und Zeile offen: Hinge das Datei-Feld zwischen Auswahl und
 * fertigem Upload aus, verlöre Android die Datei (CODING_STANDARDS §8).
 *
 * Keine Karte mit eigenem Schatten: Fläche und Rand gibt das Blatt bzw. die
 * Zeile (DESIGN_SYSTEM, Karten).
 */

/** Knöpfe nur mit Symbol (Pfeile, Löschen): 44 px Trefferfläche, das Symbol bleibt klein (DESIGN_SYSTEM, Nr. 35). */
const SYMBOL_KNOPF = 'size-11 shrink-0 rounded-md flex items-center justify-center'

/** Höchstens so viele Fotos stehen in der Galerie der Hofseite. */
export const GALERIE_MAX = 8

/**
 * Meldet dem Aufrufer, ob gerade ein Foto hochlädt. Der Aufrufer reicht einen
 * stabilen Setter herein. Hängt der Baustein selbst aus, meldet er „fertig" —
 * sonst bliebe das Blatt für immer offen.
 */
function useHochladenMelden(laeuft: boolean, melden: ((laeuft: boolean) => void) | undefined): void {
  useEffect(() => {
    if (!melden) return
    melden(laeuft)
    return () => {
      if (laeuft) melden(false)
    }
  }, [laeuft, melden])
}

type BildBausteinProps = {
  /** Nach jedem erfolgreichen Speichern — lädt Vorschau bzw. Seite neu. */
  onGespeichert?: () => void
  /** Ersetzt den eigenen Erfolgs-Toast (unter lg: „Gespeichert · Ansehen"). */
  meldeErfolg?: () => void
  /** Meldet, solange ein Foto hochlädt oder gespeichert wird. */
  onHochladen?: (laeuft: boolean) => void
}

// ── Titelbild ────────────────────────────────────────────────────────────────

/** Was der Baustein „Titelbild" vom Hof braucht — ohne Date, ohne Decimal. */
export type TitelbildHof = {
  bannerType: string
  bannerUrl: string | null
  bannerValue: string | null
  bannerFocusY: number
  /** Ausschnitt des Titelbilds, schon geprüft (Register N13, Nr. 97); null = wie vorher. */
  bannerAusschnitt: BildAusschnittWert | null
  /** Für die Vorschauen „So sieht es … aus“: Name, Logo und die Adresse der Hofseite, wie Kundinnen sie sehen. */
  name: string
  logoUrl: string | null
  adresse: string
}

/** Die Anschrift unter dem Namen, wie auf der Hofseite. */
type TitelbildAnschrift = { address: string; postalCode: string; city: string }

/**
 * Titelbild: Abbild mit den vorhandenen Knöpfen der Hofseite — Foto ersetzen,
 * Ausschnitt anpassen, Foto entfernen (dann zeigt die Hofseite wieder den
 * Verlauf des Hofs). Entfernen ist dieselbe Aktion wie früher in „Mein
 * Auftritt" (updateFarmBannerAction mit GRADIENT), keine neue Logik.
 *
 * „Ausschnitt anpassen“ öffnet seit Nr. 97 den Bild-Baustein (Register N13,
 * Ergänzung; N17): Rahmen „Computer“ zum Ziehen, Zoom, die Vorschauen
 * „So sieht es im Browser aus“ und „… am Handy aus“, die Wahl füllen/ganz und
 * die sechs Filter — in der Zeile wie im Blatt. Die Browser-Vorschau steht auch
 * in der Zeile (Register N17): Die große Vorschau daneben ist die echte
 * Hofseite und zeigt erst das Gespeicherte.
 */
export function TitelbildBaustein({
  hof,
  anschrift,
  onGespeichert,
  meldeErfolg,
  onHochladen,
}: BildBausteinProps & { hof: TitelbildHof; anschrift: TitelbildAnschrift }): React.JSX.Element {
  const [offen, setOffen] = useState(false)
  const [pending, start] = useTransition()
  const [entferntGerade, startEntfernen] = useTransition()
  const foto = titelbildFoto(hof)
  const ausschnitt = titelbildAusschnitt(hof.bannerAusschnitt, hof.bannerFocusY)
  // Die Maße liest der Browser aus der Vorschau, sobald sie geladen ist (Register N6, Nr. 72) — der Satz darunter gilt nur ohne eigene Wahl.
  const { masse, beimLaden } = useBildmasse(foto)
  const hochformatHinweis = titelbildHinweis(masse, ausschnitt.darstellung)

  function entfernen() {
    startEntfernen(async () => {
      const res = await updateFarmBannerAction('GRADIENT', null)
      if (res.error) {
        toast.error(res.error)
        return
      }
      if (meldeErfolg) meldeErfolg()
      else toast.success('Titelbild entfernt')
      onGespeichert?.()
    })
  }

  function speichern(wert: BildAusschnittWert) {
    start(async () => {
      const res = await speichereBildAusschnittAction({ ziel: 'banner', wert })
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      if (meldeErfolg) meldeErfolg()
      else toast.success(TITELBILD_AUSSCHNITT_TEXT.gespeichert)
      setOffen(false)
      onGespeichert?.()
    })
  }

  if (offen && foto) {
    const ort = `${anschrift.address}, ${anschrift.postalCode} ${anschrift.city}`
    return (
      <div>
        <BildAusschnitt
          foto={foto}
          wert={ausschnitt}
          rahmen={{ name: TITELBILD_AUSSCHNITT_TEXT.rahmen, verhaeltnis: TITELBILD_RAHMEN_COMPUTER }}
          vorschauen={[
            {
              titel: TITELBILD_AUSSCHNITT_TEXT.vorschauBrowser,
              verhaeltnis: TITELBILD_VORSCHAU_BROWSER,
              satz: TITELBILD_AUSSCHNITT_TEXT.browserSatz,
              // Am Computer gilt die Wahl, ohne Wahl die Form des Fotos — dieselbe Regel wie die Hofseite.
              ganz: (wert, gemessen) => titelbildDarstellung(gemessen, wert.darstellung) === 'ganz',
              umgebung: (rahmen) => (
                <BrowserVorschau hof={hof} ort={ort}>
                  {rahmen}
                </BrowserVorschau>
              ),
            },
            {
              titel: TITELBILD_AUSSCHNITT_TEXT.vorschauHandy,
              verhaeltnis: TITELBILD_VORSCHAU_HANDY,
              name: TITELBILD_AUSSCHNITT_TEXT.handyMarke,
              breite: 156,
              satz: TITELBILD_AUSSCHNITT_TEXT.handySatz,
              darueber: <HandyName name={hof.name} ort={ort} />,
            },
          ]}
          mitDarstellung
          speichert={pending}
          onSpeichern={speichern}
          onAbbrechen={() => setOffen(false)}
        />
        <p className="mt-3 text-xs text-muted-foreground">{TITELBILD_AUSSCHNITT_TEXT.satz}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="relative aspect-[5/2] overflow-hidden rounded-xl bg-muted">
        {foto ? (
          <Image src={foto} alt="" fill sizes="640px" className="object-cover" style={bildStil(ausschnitt)} onLoad={beimLaden} />
        ) : (
          // Der Verlauf ist ein Wert des Hofs (Titelbild-Einstellung), kein Farbliteral im Code.
          <div className="absolute inset-0" style={{ background: titelbildVerlauf(hof.bannerValue) }} />
        )}
        {foto && (
          <button
            type="button"
            onClick={entfernen}
            disabled={entferntGerade}
            aria-label="Titelbild entfernen"
            className={cn('group absolute top-0.5 left-0.5 flex size-11 items-center justify-center rounded-full disabled:opacity-60', FOKUS_RAHMEN_INNEN)}
          >
            {/* Sichtbar der 28-px-Kreis wie früher in „Mein Auftritt", getroffen wird der 44-px-Knopf (Nr. 35).
                Theme-fest dunkel auf dem Foto über Tokens (DESIGN_SYSTEM, Bild-Overlays). */}
            <span className="flex size-7 items-center justify-center rounded-full bg-primary-foreground/60 text-accent-foreground transition-colors group-hover:bg-primary-foreground/80">
              <X className="size-3.5" aria-hidden="true" />
            </span>
          </button>
        )}
        <div className="absolute top-2 right-2 flex flex-wrap items-center justify-end gap-2">
          {foto && (
            <button
              type="button"
              onClick={() => setOffen(true)}
              className="flex min-h-11 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition-opacity hover:opacity-90"
              style={TITELBILD_KNOPF_STIL}
            >
              <Crop className="size-3.5" strokeWidth={1.7} aria-hidden="true" />
              {TITELBILD_AUSSCHNITT_TEXT.anpassen}
            </button>
          )}
          <CoverEditButton
            currentBannerUrl={hof.bannerUrl}
            onGespeichert={onGespeichert}
            meldeErfolg={meldeErfolg}
            onHochladen={onHochladen}
            gross
          />
        </div>
      </div>
      {hochformatHinweis && <p className="mt-2 text-xs text-muted-foreground">{hochformatHinweis}</p>}
      <p className="mt-2 text-xs text-muted-foreground">{TITELBILD_AUSSCHNITT_TEXT.satz}</p>
    </div>
  )
}

/**
 * „So sieht es im Browser aus“: die Hofseite am Computer verkleinert —
 * Browserleiste mit Adresse, Kopf, das Titelbild über die volle Breite (der
 * Rahmen aus dem Bild-Baustein), darunter der Hofkopf mit Logo, Name und
 * Anschrift und angedeutete Produkte (Mockups web-/mobil-h1-titelbild-ausschnitt).
 * Nur Bild: Der Baustein setzt es `aria-hidden`; Links und Knöpfe der echten
 * Seite sind hier leere Flächen.
 */
function BrowserVorschau({ hof, ort, children }: { hof: TitelbildHof; ort: string; children: ReactNode }): React.JSX.Element {
  return (
    <div className="overflow-hidden rounded-[10px] border border-border bg-background">
      <div className="flex h-[22px] items-center gap-1.5 border-b border-border bg-card px-2">
        <span className="flex gap-1">
          {[0, 1, 2].map((punkt) => (
            <span key={punkt} className="size-1.5 rounded-full bg-border" />
          ))}
        </span>
        <span className="flex min-w-0 flex-1 justify-center">
          <span className="truncate rounded-full border border-border bg-background px-2 py-px text-[8px] text-muted-foreground">{hof.adresse}</span>
        </span>
        <span className="w-[26px]" />
      </div>
      <div className="flex h-[18px] items-center gap-1.5 border-b border-border px-2.5">
        <span className="font-heading text-[7px] font-bold text-brand-text">{MARKE}</span>
        <span className="flex-1" />
        {[0, 1, 2, 3].map((stelle) => (
          <span key={stelle} className="h-[3px] w-5 rounded-full bg-border" />
        ))}
      </div>
      <div className="h-3" />
      {children}
      <div className="relative -mt-[13px] flex items-end gap-1.5 px-3">
        <span className="relative flex size-[26px] shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-background bg-accent font-heading text-[9px] font-bold text-accent-foreground">
          {hof.logoUrl ? <Image src={hof.logoUrl} alt="" fill sizes="26px" className="object-cover" /> : hofInitialen(hof.name)}
        </span>
        <span className="min-w-0 pb-px leading-tight">
          <span className="block truncate font-heading text-[9.5px] font-semibold text-foreground">{hof.name}</span>
          <span className="block truncate text-[5.5px] text-muted-foreground">{ort}</span>
        </span>
        <span className="flex-1" />
        <span className="mb-0.5 flex gap-[3px]">
          <span className="h-2 w-6 rounded-full border border-border" />
          <span className="h-2 w-6 rounded-full border border-border" />
          <span className="h-2 w-8 rounded-full bg-accent" />
        </span>
      </div>
      <div className="grid grid-cols-4 gap-[5px] px-3 pt-2 pb-2.5">
        {[0, 1, 2, 3].map((karte) => (
          <span key={karte} className="h-11 rounded-[4px] border border-border bg-card" />
        ))}
      </div>
    </div>
  )
}

/** Name und Anschrift auf dem Titelbild am Handy, über dem dunklen Schleier — theme-fest (Bild-Overlay). */
function HandyName({ name, ort }: { name: string; ort: string }): React.JSX.Element {
  return (
    <>
      <span className="pointer-events-none absolute inset-0 bg-linear-to-t from-primary-foreground/75 via-primary-foreground/10 to-transparent" />
      <span className="pointer-events-none absolute right-2 bottom-[7px] left-[9px] leading-[1.1] text-accent-foreground">
        <span className="block truncate font-heading text-[11px] font-semibold">{name}</span>
        <span className="mt-0.5 block truncate text-[7px] opacity-85">{ort}</span>
      </span>
    </>
  )
}

// ── Logo ─────────────────────────────────────────────────────────────────────

/**
 * Logo: rund, Ausschnitt ohne Filter (Register N17, Nr. 98). Nach dem Upload
 * öffnet der Bild-Baustein einmal von selbst mit Standardwerten — „Passt so“
 * lässt das Logo wie heute (Mitte, `null`).
 *
 * Der Aufrufer hängt den Baustein am Logo auf (`key`): Lädt die Seite nach dem
 * Upload neu, beginnt er frisch. Darum meldet er das neue Logo erst, wenn der
 * Baustein zu ist — sonst schlösse ihn das Neuladen, bevor der Hof wählen kann.
 */
export function LogoUpload({
  logoUrl,
  logoAusschnitt = null,
  onUploaded,
  onHochladen,
  meldeErfolg,
}: {
  logoUrl: string | null
  /** Der gespeicherte Ausschnitt, schon geprüft; ohne Angabe wie heute. */
  logoAusschnitt?: BildAusschnittWert | null
  onUploaded: (url: string | null) => void
  /** Meldet, solange ein Foto hochlädt oder gespeichert wird. */
  onHochladen?: (laeuft: boolean) => void
  /** Ersetzt den eigenen Erfolgs-Toast (unter lg: „Gespeichert · Ansehen"). */
  meldeErfolg?: () => void
}): React.JSX.Element {
  const [speichert, startTransition] = useTransition()
  const [speichertAusschnitt, startAusschnitt] = useTransition()
  // Das gerade hochgeladene Logo — bis der Aufrufer neu lädt, steht es nur hier.
  const [neuesLogo, setNeuesLogo] = useState<string | null>(null)
  const [ausschnitt, setAusschnitt] = useState<BildAusschnittWert | null>(logoAusschnitt)
  // Offen gleich nach dem Upload („Passt so“) oder über „Ausschnitt anpassen“.
  const [offen, setOffen] = useState<false | 'nachUpload' | 'anpassen'>(false)
  const logo = neuesLogo ?? logoUrl

  const { isUploading, progress, openFilePicker, fileInput } = useImageUpload({
    variant: 'logo',
    oldUrl: logoUrl ?? undefined,
    onUploaded: (url) => {
      startTransition(async () => {
        const result = await updateFarmLogoAction(url)
        if (result.error) {
          toast.error(result.error)
          return
        }
        // Der alte Ausschnitt gehörte zum alten Foto: zurück auf „wie heute“ (`null`), bevor der Baustein
        // aufgeht — immer, denn ob einer gespeichert ist, weiß der Baustein nur, wenn der Aufrufer ihn reicht.
        const zurueck = await speichereBildAusschnittAction({ ziel: 'logo', wert: AUSSCHNITT_STANDARD })
        if ('error' in zurueck) toast.error(zurueck.error)
        setAusschnitt(null)
        setNeuesLogo(url)
        setOffen('nachUpload')
        if (meldeErfolg) meldeErfolg()
        else toast.success('Logo gespeichert')
      })
    },
  })
  useHochladenMelden(isUploading || speichert || speichertAusschnitt, onHochladen)

  function schliessen() {
    setOffen(false)
    // Erst jetzt neu laden: Vorschau und Seite zeigen danach das neue Logo samt Ausschnitt.
    if (neuesLogo) onUploaded(neuesLogo)
  }

  function speichern(wert: BildAusschnittWert) {
    startAusschnitt(async () => {
      // Das Logo bekommt keinen Filter (Register N17) — der Baustein zeigt keine Kacheln, die Aktion nimmt nur „Natürlich“.
      const res = await speichereBildAusschnittAction({ ziel: 'logo', wert: { ...alsFotoAusschnitt(wert), filter: 'NATUERLICH' } })
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      setAusschnitt(wert)
      if (meldeErfolg) meldeErfolg()
      else toast.success(BILD_RAHMEN_TEXT.gespeichert)
      setOffen(false)
      onUploaded(logo)
    })
  }

  async function handleRemove() {
    startTransition(async () => {
      const result = await updateFarmLogoAction(null)
      if (result.error) {
        toast.error(result.error)
      } else {
        onUploaded(null)
        if (meldeErfolg) meldeErfolg()
        else toast.success('Logo entfernt')
      }
    })
  }

  const rund = (rahmen: ReactNode) => <div className="overflow-hidden rounded-full border border-border">{rahmen}</div>

  // Das Datei-Feld steht in beiden Zuständen an derselben Stelle — es hängt nie aus (CODING_STANDARDS §8).
  return (
    <div>
      {fileInput}
      {offen && logo ? (
        <div>
          <BildAusschnitt
            foto={logo}
            wert={ausschnitt ?? AUSSCHNITT_STANDARD}
            rahmen={{ name: BILD_RAHMEN_TEXT.logo.rahmen, verhaeltnis: LOGO_RAHMEN, rund: true }}
            // Die drei Größen in einer Reihe unter einem Titel (Mockup system-h1-bild-baustein: 96 / 72 / 40 px rund).
            vorschauen={[
              {
                titel: BILD_RAHMEN_TEXT.logo.groessen,
                satz: BILD_RAHMEN_TEXT.logo.groessenSatz,
                verhaeltnis: LOGO_RAHMEN,
                breite: LOGO_VORSCHAU_PX.hofseite,
                umgebung: rund,
                mittig: true,
                daneben: [
                  { verhaeltnis: LOGO_RAHMEN, breite: LOGO_VORSCHAU_PX.meinHof, umgebung: rund },
                  { verhaeltnis: LOGO_RAHMEN, breite: LOGO_VORSCHAU_PX.klein, umgebung: rund },
                ],
              },
            ]}
            mitFilter={false}
            nachUpload={offen === 'nachUpload'}
            speichert={speichertAusschnitt}
            onSpeichern={speichern}
            onAbbrechen={schliessen}
          />
          <p className="mt-3 text-xs text-muted-foreground">{BILD_RAHMEN_TEXT.logo.satz}</p>
        </div>
      ) : (
        <LogoAnsicht
          logo={logo}
          ausschnitt={ausschnitt}
          isUploading={isUploading}
          fortschritt={progress ? stufenText(progress) : null}
          openFilePicker={openFilePicker}
          onAnpassen={() => setOffen('anpassen')}
          onEntfernen={handleRemove}
        />
      )}
    </div>
  )
}

/** Das Logo, wie es ist: runde Vorschau mit Entfernen, darunter Ersetzen und „Ausschnitt anpassen“. */
function LogoAnsicht({
  logo,
  ausschnitt,
  isUploading,
  fortschritt,
  openFilePicker,
  onAnpassen,
  onEntfernen,
}: {
  logo: string | null
  ausschnitt: BildAusschnittWert | null
  isUploading: boolean
  /** Die Stufe des Uploads als Satz, solange er läuft. */
  fortschritt: string | null
  /** Öffnet die Dateiauswahl (useImageUpload). */
  openFilePicker: () => void
  onAnpassen: () => void
  onEntfernen: () => void
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-4">
      {/* Runde Vorschau — der Entfernen-Knopf liegt außerhalb des runden
          Rahmens: overflow-hidden schnitte seine 44-px-Trefferfläche ab (Nr. 35). */}
      <div className="relative shrink-0">
        <div className="relative flex size-[72px] items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-muted">
          {logo ? (
            <Image src={logo} alt="Logo" fill sizes="72px" className="object-cover" style={bildStil(ausschnitt, { filter: false })} />
          ) : (
            <Camera className="size-6 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
          )}
        </div>
        {logo && (
          <button
            type="button"
            onClick={onEntfernen}
            className={cn('absolute -top-3 -right-3 size-11 rounded-full flex items-center justify-center', FOKUS_RAHMEN)}
            aria-label="Logo entfernen"
          >
            {/* Sichtbar bleibt der kleine Kreis, die Trefferfläche ist der ganze Knopf.
                Theme-fest dunkel auf dem Foto über Tokens (DESIGN_SYSTEM, Bild-Overlays). */}
            <span className="size-5 rounded-full bg-primary-foreground/60 text-accent-foreground flex items-center justify-center">
              <X className="w-3 h-3" aria-hidden="true" />
            </span>
          </button>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openFilePicker}
            disabled={isUploading}
            className={cn(
              'inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60',
              FOKUS_RAHMEN
            )}
          >
            {isUploading ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Upload className="size-3.5" aria-hidden="true" />}
            {/* Die Stufe statt eines stummen Spinners: Seit dem Zeitwächter-Umbau
                nennt jeder Hänger seinen Ort. */}
            {isUploading && fortschritt ? fortschritt : logo ? 'Logo ersetzen' : 'Logo hochladen'}
          </button>
          {logo && !isUploading && (
            <button
              type="button"
              onClick={onAnpassen}
              className={cn(
                'inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-muted',
                FOKUS_RAHMEN
              )}
            >
              <Crop className="size-3.5" strokeWidth={1.7} aria-hidden="true" />
              {BILD_RAHMEN_TEXT.anpassen}
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Rund und quadratisch wirkt am besten · sonst zeigen wir den Anfangsbuchstaben.</p>
      </div>
    </div>
  )
}

// ── Fotos ────────────────────────────────────────────────────────────────────

function GalleryPhotoItem({
  photo,
  index,
  total,
  onDeleted,
  onCaptionChange,
  onMove,
  onAnpassen,
}: {
  photo: FarmPhotoData
  index: number
  total: number
  onDeleted: (id: string) => void
  onCaptionChange: (id: string, caption: string) => void
  onMove: (id: string, dir: 'up' | 'down') => void
  /** Öffnet den Bild-Baustein für dieses Foto (Register N17, Nr. 98). */
  onAnpassen: (photo: FarmPhotoData) => void
}) {
  const [caption, setCaption] = useState(photo.caption ?? '')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSavingCaption, setIsSavingCaption] = useState(false)

  async function handleCaptionBlur() {
    if (caption === (photo.caption ?? '')) return
    setIsSavingCaption(true)
    const result = await updateFarmPhotoCaptionAction(photo.id, caption)
    setIsSavingCaption(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      onCaptionChange(photo.id, caption)
    }
  }

  async function handleDelete() {
    setIsDeleting(true)
    const result = await deleteFarmPhotoAction(photo.id)
    if (result.error) {
      toast.error(result.error)
      setIsDeleting(false)
    } else {
      onDeleted(photo.id)
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
      {/* Das Vorschaubild ist der Knopf zum Ausschnitt: 64 px Trefferfläche, ohne einen fünften Knopf in der Zeile. */}
      <button
        type="button"
        onClick={() => onAnpassen(photo)}
        aria-label={`${BILD_RAHMEN_TEXT.anpassen}: Foto ${index + 1}`}
        className={cn('relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted', FOKUS_RAHMEN)}
      >
        <Image src={photo.url} alt="" fill sizes="64px" className="object-cover" style={bildStil(photo.ausschnitt)} />
        {/* Theme-fest dunkel auf dem Foto (DESIGN_SYSTEM, Bild-Overlays). */}
        <span className="absolute right-1 bottom-1 flex size-5 items-center justify-center rounded-full bg-primary-foreground/60 text-accent-foreground">
          <Crop className="size-3" strokeWidth={1.7} aria-hidden="true" />
        </span>
      </button>
      <div className="min-w-0 flex-1 space-y-1.5">
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value.slice(0, 100))}
          onBlur={handleCaptionBlur}
          placeholder="Bildunterschrift (freiwillig)"
          aria-label={`Bildunterschrift zu Foto ${index + 1}`}
          className="h-11 w-full rounded-lg border border-input bg-card px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
        {isSavingCaption && <span className="text-xs text-muted-foreground">Speichert…</span>}
      </div>
      {/* 44-px-Ziele (Nr. 35); die Pfeile übereinander, damit das Feld daneben Platz behält. */}
      <div className="flex shrink-0 flex-col">
        <button
          type="button"
          onClick={() => onMove(photo.id, 'up')}
          disabled={index === 0}
          aria-label={`Foto ${index + 1} nach oben`}
          className={cn(SYMBOL_KNOPF, FOKUS_RAHMEN, 'hover:bg-muted disabled:opacity-30')}
        >
          <ChevronUp className="size-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onMove(photo.id, 'down')}
          disabled={index === total - 1}
          aria-label={`Foto ${index + 1} nach unten`}
          className={cn(SYMBOL_KNOPF, FOKUS_RAHMEN, 'hover:bg-muted disabled:opacity-30')}
        >
          <ChevronDown className="size-3.5" aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        aria-label={`Foto ${index + 1} löschen`}
        className={cn(SYMBOL_KNOPF, FOKUS_RAHMEN, 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40')}
      >
        {isDeleting ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="size-3.5" aria-hidden="true" />}
      </button>
    </div>
  )
}

/**
 * Die Galerie der Hofseite: bis zu acht Fotos, mit Unterschrift, Reihenfolge
 * und Löschen. Mehrfachauswahl nur hier — Foto für Foto wäre mühsam; Logo
 * und Titelbild bleiben Einzelauswahl.
 */
export function GallerySection({
  initialPhotos,
  onGespeichert,
  meldeErfolg,
  onHochladen,
}: BildBausteinProps & { initialPhotos: FarmPhotoData[] }): React.JSX.Element {
  const [photos, setPhotos] = useState<FarmPhotoData[]>(initialPhotos)
  // Das Foto, dessen Ausschnitt gerade gewählt wird — nach einem Upload einmal von selbst (Register N17), dann mit „Passt so“.
  const [offen, setOffen] = useState<{ foto: FarmPhotoData; nachUpload: boolean } | null>(null)
  const [speichertAusschnitt, startAusschnitt] = useTransition()
  const canUpload = photos.length < GALERIE_MAX

  function erfolg(sonst: string | null) {
    if (meldeErfolg) meldeErfolg()
    else if (sonst) toast.success(sonst)
    onGespeichert?.()
  }

  const { isUploading, progress, openFilePicker, fileInput } = useImageUpload({
    variant: 'gallery',
    multiple: true,
    maxFiles: GALERIE_MAX - photos.length,
    onUploaded: async (url, { batch }) => {
      const result = await addFarmPhotoAction({ url })
      // In einer Serie zählt der Fehler ins Sammelergebnis — deshalb werfen
      // statt einzeln melden.
      if (result.error) throw new Error(result.error)
      const photo = result.photo
      if (photo) {
        // Ein neues Foto hat noch keinen Ausschnitt; der Baustein öffnet einmal von selbst — in einer Serie für das erste.
        const neu: FarmPhotoData = { ...photo, ausschnitt: null }
        setPhotos((prev) => [...prev, neu])
        setOffen((alt) => alt ?? { foto: neu, nachUpload: true })
        // Eine Serie meldet ihr Ergebnis am Ende selbst (useImageUpload, serieGespeichert).
        if (batch) onGespeichert?.()
        else erfolg('Foto hinzugefügt')
      }
    },
    // Hat jedes Foto der Serie geklappt: „Gespeichert · Ansehen" wie nach einem einzelnen (unter lg).
    serieGespeichert: meldeErfolg,
  })
  // onUploaded wird im Upload abgewartet — isUploading deckt das Speichern mit ab.
  useHochladenMelden(isUploading || speichertAusschnitt, onHochladen)

  function speichereAusschnitt(foto: FarmPhotoData, wert: BildAusschnittWert) {
    startAusschnitt(async () => {
      const res = await speichereBildAusschnittAction({ ziel: 'foto', farmPhotoId: foto.id, wert: alsFotoAusschnitt(wert) })
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      setPhotos((prev) => prev.map((p) => (p.id === foto.id ? { ...p, ausschnitt: wert } : p)))
      setOffen(null)
      erfolg(BILD_RAHMEN_TEXT.gespeichert)
    })
  }

  function handleDeleted(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id).map((p, i) => ({ ...p, sortOrder: i })))
    erfolg(null)
  }

  function handleCaptionChange(id: string, caption: string) {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, caption: caption || null } : p)))
    erfolg(null)
  }

  async function handleMove(id: string, dir: 'up' | 'down') {
    const result = await moveFarmPhotoAction(id, dir)
    if (result.error) {
      toast.error(result.error)
      return
    }
    setPhotos((prev) => {
      const next = [...prev]
      const idx = next.findIndex((p) => p.id === id)
      if (idx === -1) return next
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= next.length) return next
      ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
      return next.map((p, i) => ({ ...p, sortOrder: i }))
    })
    erfolg(null)
  }

  if (offen) {
    return (
      <div>
        {/* Dasselbe Datei-Feld an derselben Stelle: Läuft noch eine Serie, hängt es nie aus (CODING_STANDARDS §8). */}
        {fileInput}
        <BildAusschnitt
          key={offen.foto.id}
          foto={offen.foto.url}
          wert={offen.foto.ausschnitt ?? AUSSCHNITT_STANDARD}
          rahmen={{ name: BILD_RAHMEN_TEXT.galerie.rahmen, verhaeltnis: GALERIE_RAHMEN_KACHEL }}
          vorschauen={[{ titel: BILD_RAHMEN_TEXT.galerie.vorschauHandy, verhaeltnis: GALERIE_VORSCHAU_HANDY, breite: 160, satz: BILD_RAHMEN_TEXT.galerie.satz }]}
          nachUpload={offen.nachUpload}
          speichert={speichertAusschnitt}
          onSpeichern={(wert) => speichereAusschnitt(offen.foto, wert)}
          onAbbrechen={() => setOffen(null)}
        />
        {/* Läuft die Serie weiter, sagt eine Zeile, wo sie steht — die Liste kommt nach dem Baustein. */}
        {progress && progress.total > 1 && (
          <p className="mt-3 text-xs text-muted-foreground">{`Foto ${progress.current} von ${progress.total} — ${stufenText(progress)}`}</p>
        )}
      </div>
    )
  }

  return (
    <div>
      {fileInput}
      <p className="mb-3 flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
        <span>Bis zu {GALERIE_MAX} Fotos vom Hof — sie stehen auf deiner Hofseite.</span>
        <span className="shrink-0 tabular-nums">
          {photos.length}/{GALERIE_MAX}
        </span>
      </p>

      {photos.length > 0 && (
        <div className="mb-3 space-y-2">
          {photos.map((photo, i) => (
            <GalleryPhotoItem
              key={photo.id}
              photo={photo}
              index={i}
              total={photos.length}
              onDeleted={handleDeleted}
              onCaptionChange={handleCaptionChange}
              onMove={handleMove}
              onAnpassen={(foto) => setOffen({ foto, nachUpload: false })}
            />
          ))}
        </div>
      )}

      {canUpload ? (
        <button
          type="button"
          onClick={openFilePicker}
          disabled={isUploading}
          className={cn(
            'flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60',
            FOKUS_RAHMEN
          )}
        >
          {isUploading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
          {/* Der Prozentsatz ist für Mobilfunk gedacht: Das ORIGINAL geht über
              die Leitung (6–8 MB). Ohne bewegte Zahl sieht das nach Absturz aus. */}
          {progress
            ? progress.total > 1
              ? `Foto ${progress.current} von ${progress.total} — ${stufenText(progress)}`
              : stufenText(progress)
            : isUploading
              ? 'Wird hochgeladen…'
              : 'Fotos hinzufügen'}
        </button>
      ) : (
        <p className="py-2 text-center text-xs text-muted-foreground">Mehr als {GALERIE_MAX} Fotos gehen nicht — lösche erst eins.</p>
      )}
    </div>
  )
}
