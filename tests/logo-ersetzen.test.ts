/**
 * Ein neues Logo in Mein Hof (LogoUpload, components/mein-hof/bild-bausteine.tsx;
 * Nacharbeit 98, Nachtlauf Nr. 108).
 *
 * Beweist:
 *  - Ein neues Logo ist EIN Aufruf: updateFarmLogoAction setzt den Ausschnitt im
 *    selben Update zurück — kein zweiter Aufruf von speichereBildAusschnittAction,
 *    der scheitern und den alten Ausschnitt am neuen Logo lassen könnte.
 *  - „Passt so“ gleich nach dem Upload schließt den Baustein ohne zweiten Toast
 *    und ohne Aufruf (das Logo steht schon ohne Ausschnitt).
 *  - Gegenprobe: Wer nach dem Upload einen Ausschnitt wählt, speichert ihn —
 *    mit Aufruf und Toast; über „Ausschnitt anpassen“ speichert auch Mitte/100 %.
 *  - Das kleine Logo in der Browser-Vorschau des Titelbilds steht mit dem
 *    Ausschnitt des Logos, ohne Filter — ohne Ausschnitt ohne Stil.
 *
 * Prüfstand (TESTING_GUIDELINES §1, „Einen Hook samt Effekten prüfen“): useState
 * hat eine Zelle je Aufrufstelle, useTransition führt den Rückruf aus und der
 * Test wartet darauf, useEffect ist still (useHochladenMelden ist hier nicht die
 * Aussage). Die Komponente läuft als Funktion; der Bild-Baustein wird nicht
 * gerendert, sein Element trägt die Griffe (onSpeichern), die der Test auslöst.
 * Nachgebildet sind nur die Grenzen: Upload-Hook, Aktionen, Toast.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'

const buehne = vi.hoisted(() => {
  type Setzer<T> = (wert: T | ((vorher: T) => T)) => void
  let zellen: { wert: unknown; setze: Setzer<unknown> }[] = []
  let zeiger = 0
  const laeufe: Promise<unknown>[] = []
  return {
    laeufe,
    leere(): void {
      zellen = []
      zeiger = 0
      laeufe.length = 0
    },
    beginneRender(): void {
      zeiger = 0
    },
    useState<T>(anfang: T | (() => T)): [T, Setzer<T>] {
      const i = zeiger++
      if (!zellen[i]) {
        const zelle: { wert: unknown; setze: Setzer<unknown> } = {
          wert: typeof anfang === 'function' ? (anfang as () => T)() : anfang,
          setze: (wert) => {
            zelle.wert = typeof wert === 'function' ? (wert as (vorher: unknown) => unknown)(zelle.wert) : wert
          },
        }
        zellen[i] = zelle
      }
      const zelle = zellen[i] as { wert: T; setze: Setzer<T> }
      return [zelle.wert, zelle.setze]
    },
    useTransition(): [boolean, (rueckruf: () => unknown) => void] {
      return [false, (rueckruf) => void laeufe.push(Promise.resolve().then(rueckruf))]
    },
  }
})

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useState: buehne.useState,
  useTransition: buehne.useTransition,
  useEffect: () => {},
}))

const upload = vi.hoisted(() => ({ onUploaded: null as ((url: string, meta: { batch: boolean }) => void) | null }))
vi.mock('@/components/shared/image-upload', () => ({
  stufenText: () => '',
  useImageUpload: (optionen: { onUploaded: (url: string, meta: { batch: boolean }) => void }) => {
    upload.onUploaded = optionen.onUploaded
    return { isUploading: false, progress: null, openFilePicker: () => {}, fileInput: null }
  },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {}, push() {} }) }))
vi.mock('@/server/actions/appearance', () => ({ updateFarmLogoAction: vi.fn(), updateFarmBannerAction: vi.fn() }))
vi.mock('@/server/actions/bild-ausschnitt', () => ({ speichereBildAusschnittAction: vi.fn() }))
vi.mock('@/server/actions/farm-photos', () => ({}))

import { toast } from 'sonner'
import { updateFarmLogoAction } from '@/server/actions/appearance'
import { speichereBildAusschnittAction } from '@/server/actions/bild-ausschnitt'
import { LogoUpload, TitelbildBaustein, type TitelbildHof } from '@/components/mein-hof/bild-bausteine'
import { TITELBILD_AUSSCHNITT_TEXT } from '@/lib/titelbild'
import { BildAusschnitt } from '@/components/shared/bild-ausschnitt'
import { AUSSCHNITT_STANDARD } from '@/lib/bild-ausschnitt'
import type { BildAusschnitt as BildAusschnittWert } from '@/schemas/bild-ausschnitt'

const ALT = 'https://speicher.public.blob.vercel-storage.com/farms/hof-1/logo/alt.webp'
const NEU = 'https://speicher.public.blob.vercel-storage.com/farms/hof-1/logo/neu.webp'
const gemeldet = vi.fn()

type Knoten = { type: unknown; props: Record<string, unknown> }

function zeige(): unknown {
  buehne.beginneRender()
  return LogoUpload({ logoUrl: ALT, onUploaded: gemeldet }) as ReactElement
}

/** Das Element des Bild-Bausteins im Baum — null, solange er zu ist. */
function baustein(knoten: unknown): Knoten | null {
  if (Array.isArray(knoten)) {
    for (const kind of knoten) {
      const fund = baustein(kind)
      if (fund) return fund
    }
    return null
  }
  if (knoten === null || typeof knoten !== 'object' || !('props' in knoten)) return null
  const element = knoten as Knoten
  if (element.type === BildAusschnitt) return element
  return baustein(element.props.children)
}

async function fertig(): Promise<void> {
  while (buehne.laeufe.length > 0) await buehne.laeufe.shift()
}

/** Ein neues Logo, wie es der Upload-Hook meldet — danach ist der Baustein offen („Passt so“). */
async function neuesLogo(): Promise<Knoten> {
  zeige()
  upload.onUploaded?.(NEU, { batch: false })
  await fertig()
  const offen = baustein(zeige())
  if (!offen) throw new Error('Der Baustein ist nach dem Upload nicht offen')
  return offen
}

beforeEach(() => {
  vi.clearAllMocks()
  buehne.leere()
  upload.onUploaded = null
  vi.mocked(updateFarmLogoAction).mockResolvedValue({})
  vi.mocked(speichereBildAusschnittAction).mockResolvedValue({ ok: true })
})

describe('LogoUpload — ein neues Logo', () => {
  it('ist ein Aufruf: updateFarmLogoAction, kein zweiter für den Ausschnitt — und ein Toast', async () => {
    const offen = await neuesLogo()

    expect(updateFarmLogoAction).toHaveBeenCalledExactlyOnceWith(NEU)
    expect(speichereBildAusschnittAction).not.toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(offen.props.nachUpload).toBe(true)
    expect(offen.props.wert).toEqual(AUSSCHNITT_STANDARD)
  })

  it('„Passt so“ schließt ohne zweiten Toast und ohne Aufruf — und meldet das neue Logo', async () => {
    const offen = await neuesLogo()

    ;(offen.props.onSpeichern as (wert: BildAusschnittWert) => void)(AUSSCHNITT_STANDARD)
    await fertig()

    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(speichereBildAusschnittAction).not.toHaveBeenCalled()
    expect(gemeldet).toHaveBeenCalledExactlyOnceWith(NEU)
    expect(baustein(zeige())).toBeNull()
  })

  it('Gegenprobe: ein gewählter Ausschnitt nach dem Upload wird gespeichert — mit Aufruf und Toast', async () => {
    const offen = await neuesLogo()

    ;(offen.props.onSpeichern as (wert: BildAusschnittWert) => void)({ ...AUSSCHNITT_STANDARD, fokusX: 30, zoom: 140 })
    await fertig()

    expect(speichereBildAusschnittAction).toHaveBeenCalledExactlyOnceWith({
      ziel: 'logo',
      wert: { fokusX: 30, fokusY: 50, zoom: 140, filter: 'NATUERLICH' },
    })
    expect(toast.success).toHaveBeenCalledTimes(2)
  })

  it('Gegenprobe: über „Ausschnitt anpassen“ speichert auch Mitte/100 % — dort kann ein alter Ausschnitt stehen', async () => {
    const ansicht = zeige() as Knoten
    const anpassen = (ansicht.props.children as Knoten[]).find((k) => k && typeof k.props?.onAnpassen === 'function')
    if (!anpassen) throw new Error('Kein „Ausschnitt anpassen“')
    ;(anpassen.props.onAnpassen as () => void)()
    const offen = baustein(zeige())
    if (!offen) throw new Error('Der Baustein ist nicht offen')

    ;(offen.props.onSpeichern as (wert: BildAusschnittWert) => void)(AUSSCHNITT_STANDARD)
    await fertig()

    expect(speichereBildAusschnittAction).toHaveBeenCalledExactlyOnceWith({ ziel: 'logo', wert: AUSSCHNITT_STANDARD })
    expect(toast.success).toHaveBeenCalledTimes(1)
  })
})

describe('Titelbild-Vorschau in Mein Hof — das kleine Logo', () => {
  const HOF: TitelbildHof = {
    bannerType: 'PHOTO',
    bannerUrl: 'https://speicher.public.blob.vercel-storage.com/farms/hof-1/banner/titel.webp',
    bannerValue: null,
    bannerFocusY: 50,
    bannerAusschnitt: null,
    name: 'Testhof A',
    logoUrl: ALT,
    adresse: 'testhof-a.example',
  }
  const ANSCHRIFT = { address: 'Teststraße 1', postalCode: '1010', city: 'Teststadt' }

  /** Alle Elemente im Baum, ohne Komponenten auszurollen. */
  function alle(knoten: unknown, passt: (k: Knoten) => boolean, funde: Knoten[] = []): Knoten[] {
    if (Array.isArray(knoten)) {
      for (const kind of knoten) alle(kind, passt, funde)
      return funde
    }
    if (knoten === null || typeof knoten !== 'object' || !('props' in knoten)) return funde
    const element = knoten as Knoten
    if (passt(element)) funde.push(element)
    return alle(element.props.children, passt, funde)
  }
  const text = (knoten: unknown): string =>
    Array.isArray(knoten) ? knoten.map(text).join('') : typeof knoten === 'string' ? knoten : knoten && typeof knoten === 'object' && 'props' in knoten ? text((knoten as Knoten).props.children) : ''

  /** Öffnet „Ausschnitt anpassen“ und liefert das Logo-Bild der Browser-Vorschau. */
  function logoInVorschau(logoAusschnitt: BildAusschnittWert | null): Knoten {
    const zeigeTitelbild = () => {
      buehne.beginneRender()
      return TitelbildBaustein({ hof: HOF, anschrift: ANSCHRIFT, logoAusschnitt }) as unknown
    }
    const anpassen = alle(zeigeTitelbild(), (k) => k.type === 'button' && text(k.props.children).includes(TITELBILD_AUSSCHNITT_TEXT.anpassen))[0]
    if (!anpassen) throw new Error('Kein „Ausschnitt anpassen“')
    ;(anpassen.props.onClick as () => void)()
    const offen = baustein(zeigeTitelbild())
    if (!offen) throw new Error('Der Baustein ist nicht offen')
    const [browser] = offen.props.vorschauen as { umgebung: (rahmen: unknown) => Knoten }[]
    const huelle = browser.umgebung(null)
    const vorschau = (huelle.type as (p: unknown) => unknown)(huelle.props)
    const logo = alle(vorschau, (k) => k.props.src === ALT)[0]
    if (!logo) throw new Error('Kein Logo in der Browser-Vorschau')
    return logo
  }

  it('trägt den Ausschnitt des Logos — Fokus und Zoom, aber keinen Filter', () => {
    const logo = logoInVorschau({ fokusX: 30, fokusY: 70, zoom: 140, filter: 'WARM' })

    expect(logo.props.style).toMatchObject({ objectPosition: '30% 70%', transform: 'scale(1.4)' })
    expect(logo.props.style).not.toHaveProperty('filter')
  })

  it('ohne Ausschnitt steht das Logo wie heute — kein Fokus, kein Zoom', () => {
    const logo = logoInVorschau(null)

    expect(logo.props.style).not.toHaveProperty('objectPosition')
    expect(logo.props.style).not.toHaveProperty('transform')
  })
})
