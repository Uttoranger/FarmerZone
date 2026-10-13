/**
 * Die Tipp-Liste beim Speichern (Nr. 75, Nacharbeit zu Nr. 66, Register W1).
 *
 * Fehler: Ein geworfener Fehler der Action (Netzabbruch) lief aus der
 * Transition an die Fehlergrenze — die Fehlerseite kam, danach standen
 * Personen wieder auf „offen". Jetzt fängt speichernOhneWurf den Wurf, ein
 * Toast sagt den Satz aus src/lib/whatsapp-versand.ts, und die Person steht
 * wieder so da wie vor dem Tipp. Dazu: Eine Nummer ohne eine Ziffer bekommt
 * keinen wa.me-Link (Sicherheitsprüfung 13.10.).
 *
 * Ohne DOM (TESTING_GUIDELINES §1) ersetzt ein kleiner Prüfstand die Hooks:
 * Zustand je Aufrufstelle, die Transition läuft sofort und wird abgewartet
 * (ein Wurf darin käme bei React an der Fehlergrenze an — hier im Test).
 * Die Komponente läuft als Funktion; geklickt wird über das onClick des
 * Knopfs im gelieferten Baum.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'

const pruefstand = vi.hoisted(() => {
  let zellen: unknown[] = []
  let zeiger = 0
  let laeufe: Promise<unknown>[] = []
  return {
    neu(): void {
      zellen = []
      laeufe = []
    },
    beginne(): void {
      zeiger = 0
    },
    useState<T>(anfang: T): [T, (wert: T | ((vorher: T) => T)) => void] {
      const stelle = zeiger++
      if (stelle >= zellen.length) zellen.push(anfang)
      const setze = (wert: T | ((vorher: T) => T)): void => {
        zellen[stelle] = typeof wert === 'function' ? (wert as (vorher: T) => T)(zellen[stelle] as T) : wert
      }
      return [zellen[stelle] as T, setze]
    },
    useRef<T>(anfang: T): { current: T } {
      const stelle = zeiger++
      if (stelle >= zellen.length) zellen.push({ current: anfang })
      return zellen[stelle] as { current: T }
    },
    useTransition(): [boolean, (rueckruf: () => unknown) => void] {
      return [false, (rueckruf) => void laeufe.push(Promise.resolve().then(rueckruf))]
    },
    /** Wartet auf alle Transitionen; wirft, wenn eine geworfen hat. */
    async fertig(): Promise<void> {
      await Promise.all(laeufe)
    },
  }
})

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useState: pruefstand.useState,
  useRef: pruefstand.useRef,
  useTransition: pruefstand.useTransition,
  useCallback: <T,>(funktion: T): T => funktion,
  useEffect: () => {},
}))
vi.mock('@/server/actions/status-posts', () => ({ setzeWhatsAppGetippt: vi.fn() }))
vi.mock('@/server/actions/appearance', () => ({ saveAppearanceAction: vi.fn() }))
vi.mock('@/server/actions/farm', () => ({ ladeProfilStand: vi.fn(), updateProfile: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ addBreadcrumb: vi.fn(), captureException: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { toast } from 'sonner'
import { setzeWhatsAppGetippt } from '@/server/actions/status-posts'
import { WHATSAPP_VERSAND_TEXT, type Abonnentin } from '@/lib/whatsapp-versand'
import { WhatsAppTapClient } from '@/app/(hof)/status/[id]/send-whatsapp/whatsapp-tap-client'

const ANNA: Abonnentin = { id: 'cabo00000000000000000001', name: 'Anna Muster', phone: '+43 660 0000000' }
const BERTA: Abonnentin = { id: 'cabo00000000000000000002', name: 'Berta Muster', phone: '+43 664 0000000' }
const PROPS = { postId: 'cpost0000000000000000001', title: 'Neue Eier', body: 'Frisch gelegt.', farmSlug: 'hof-test' }

type Knoten = { type?: unknown; key?: unknown; props?: Record<string, unknown> }

/** Jedes Element im Baum, Kinder zuerst nach den Eltern. */
function elemente(knoten: unknown): Knoten[] {
  if (knoten == null || typeof knoten !== 'object') return []
  if (Array.isArray(knoten)) return knoten.flatMap(elemente)
  const element = knoten as Knoten
  return element.props ? [element, ...elemente(element.props.children)] : []
}

function rendere(abonnentinnen: Abonnentin[], getippt: string[]): ReactElement {
  pruefstand.beginne()
  return WhatsAppTapClient({ ...PROPS, abonnentinnen, getippt })
}

/** Wer laut Liste geöffnet ist: die Zeilen (Schlüssel = Abonnements-ID) mit dem Wort „Geöffnet". */
function geoeffnet(baum: ReactElement): unknown[] {
  return elemente(baum)
    .filter((e) => e.type === 'li' && elemente(e.props?.children).some((innen) => innen.props?.children === WHATSAPP_VERSAND_TEXT.geoeffnet))
    .map((e) => e.key)
}

beforeEach(() => {
  vi.clearAllMocks()
  pruefstand.neu()
})

describe('Tipp-Liste: Speichern ohne Wurf', () => {
  it('scheitert die Anfrage (Netz weg): Toast mit dem Satz aus lib/, die Person steht wieder wie vorher, keine Fehlerseite', async () => {
    vi.mocked(setzeWhatsAppGetippt).mockRejectedValue(new TypeError('Failed to fetch'))
    const baum = rendere([ANNA, BERTA], [ANNA.id])
    // Der einzige Knopf: „Zurücksetzen" bei Anna (geöffnet).
    const zuruecksetzen = elemente(baum).find((e) => e.type === 'button')
    if (!zuruecksetzen) throw new Error('Kein Knopf „Zurücksetzen" im Baum')

    ;(zuruecksetzen.props?.onClick as () => void)()
    // Sofort gezeigt — das letzte Wort hat die Antwort.
    expect(geoeffnet(rendere([ANNA, BERTA], [ANNA.id]))).toEqual([])

    await pruefstand.fertig()

    expect(toast.error).toHaveBeenCalledWith(WHATSAPP_VERSAND_TEXT.nichtGespeichert)
    expect(geoeffnet(rendere([ANNA, BERTA], [ANNA.id]))).toEqual([ANNA.id])
  })

  it('ein Satz der Action (Person abgemeldet) steht in der Liste, die Person wie vorher — kein Toast', async () => {
    vi.mocked(setzeWhatsAppGetippt).mockResolvedValue({ error: 'Diese Person bekommt deine WhatsApp-Nachrichten nicht mehr. Lade die Seite neu.' })
    const baum = rendere([ANNA, BERTA], [ANNA.id])
    const zuruecksetzen = elemente(baum).find((e) => e.type === 'button')
    ;(zuruecksetzen?.props?.onClick as () => void)()

    await pruefstand.fertig()

    expect(toast.error).not.toHaveBeenCalled()
    const danach = rendere([ANNA, BERTA], [ANNA.id])
    expect(geoeffnet(danach)).toEqual([ANNA.id])
    expect(elemente(danach).find((e) => e.props?.role === 'alert')?.props?.children).toBe(
      'Diese Person bekommt deine WhatsApp-Nachrichten nicht mehr. Lade die Seite neu.'
    )
  })
})

describe('Tipp-Liste: kein Link ohne Ziffern', () => {
  it('eine Nummer ohne eine Ziffer bekommt keinen wa.me-Link — eine echte Nummer schon (Gegenprobe)', () => {
    const OHNE: Abonnentin = { id: 'cabo00000000000000000003', name: 'Carla Muster', phone: 'keine Angabe' }
    const links = elemente(rendere([ANNA, OHNE], []))
      .filter((e) => e.type === 'a')
      .map((e) => String(e.props?.href))
    expect(links).toHaveLength(1)
    expect(links[0]).toMatch(/^https:\/\/wa\.me\/436600000000\?text=/)
  })
})

describe('Tipp-Liste: die Nummer einheitlich', () => {
  it('unter dem Namen steht die Nummer als „+43 660 000 0000“ (Nr. 81, N8) — Unlesbares unverändert', () => {
    const ROH: Abonnentin = { id: 'cabo00000000000000000004', name: 'Dora Muster', phone: '0660 0000000' }
    const OHNE: Abonnentin = { id: 'cabo00000000000000000003', name: 'Carla Muster', phone: 'keine Angabe' }
    const zeilen = elemente(rendere([ROH, OHNE], []))
      .filter((e) => e.type === 'p')
      .map((e) => e.props?.children)
    expect(zeilen).toContain('+43 660 000 0000')
    expect(zeilen).toContain('keine Angabe')
    expect(zeilen).not.toContain('0660 0000000')
  })
})
