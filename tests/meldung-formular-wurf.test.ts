/**
 * „Problem melden“: Scheitert die Anfrage (Wurf der Aktion statt Ablehnung), fällt die Seite nicht mehr auf die 500
 * (Abnahme Lauf 31, Board s3-/w3-problem-melden Bild 6; Nr. 242).
 *
 * Beweist (Hook als Funktion, ein kleiner Prüfstand für useState/useTransition — TESTING_GUIDELINES §1):
 *  - Ein Wurf der Aktion setzt den Board-Satz an die Karte, die Eingaben bleiben, „Nochmal“ ist da und schickt
 *    dieselben Eingaben noch einmal.
 *  - Ein Netzabbruch nimmt NETZ_SATZ_UNSICHER ohne „Nochmal“ (Register N29, Ergänzung 26.10.2026: der Server kann
 *    die Meldung schon angelegt haben); Sentry bekommt dann nur eine Brotkrume.
 *  - Ein echter Wurf geht nach Sentry — fester Text, ohne den Text der Meldung.
 *  - Gegenprobe: Eine Ablehnung des Servers (zu viele Meldungen) zeigt ihren Satz ohne „Nochmal“.
 *  - Der Dank trägt die h1, wenn die Ansicht die Überschrift der Seite trägt.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const stand = vi.hoisted(() => {
  const s = {
    zellen: [] as unknown[],
    zeiger: 0,
    laeufe: [] as Promise<unknown>[],
    /** Ein neuer Render beginnt: Die Aufrufstellen zählen wieder von vorn. */
    neuerRender: () => {
      s.zeiger = 0
    },
  }
  return s
})

vi.mock('react', async (importOriginal) => {
  const echt = await importOriginal<typeof import('react')>()
  return {
    ...echt,
    useState: (start: unknown) => {
      const i = stand.zeiger++
      if (!(i in stand.zellen)) stand.zellen[i] = typeof start === 'function' ? (start as () => unknown)() : start
      const setze = (wert: unknown) => {
        stand.zellen[i] = typeof wert === 'function' ? (wert as (v: unknown) => unknown)(stand.zellen[i]) : wert
      }
      return [stand.zellen[i], setze]
    },
    useTransition: () => [false, (lauf: () => unknown) => stand.laeufe.push(Promise.resolve(lauf()))],
    useSyncExternalStore: (_abo: unknown, _jetzt: unknown, server: () => unknown) => server(),
  }
})
vi.mock('@/server/actions/meldung', () => ({ meldungAbsenden: vi.fn() }))
vi.mock('@/components/shared/image-upload', () => ({
  useImageUpload: () => ({ fileInput: null, openFilePicker: () => {}, isUploading: false, progress: null }),
  stufenText: () => '',
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => createElement('a', { href, ...rest }, children),
}))

import * as Sentry from '@sentry/nextjs'
import { meldungAbsenden } from '@/server/actions/meldung'
import { useMeldungFormular, type MeldungFormular } from '@/components/shared/use-meldung-formular'
import { MeldungFormularAnsicht } from '@/components/ui/meldung-formular-ansicht'
import { MELDUNG_NICHT_GESPEICHERT, ZU_VIELE_MELDUNGEN } from '@/lib/meldung'
import { NETZ_KNOPF, NETZ_SATZ, NETZ_SATZ_UNSICHER } from '@/lib/netz'

const absenden = vi.mocked(meldungAbsenden)

/** Ein Render des Hooks im Prüfstand (der Name mit „use“, weil er einen Hook ruft). */
function useRender(): MeldungFormular {
  stand.neuerRender()
  return useMeldungFormular({ formToken: 'zeitstempel', alsHof: false, kennungVorbelegt: '' })
}

async function abwarten(): Promise<void> {
  const laeufe = stand.laeufe.splice(0)
  await Promise.all(laeufe)
}

const ereignis = { preventDefault: () => {} } as unknown as React.FormEvent

beforeEach(() => {
  stand.zellen = []
  stand.laeufe = []
  vi.clearAllMocks()
})

describe('Absenden scheitert an der Anfrage', () => {
  it('zeigt den Board-Satz, behält den Text und bietet „Nochmal“ mit denselben Eingaben', async () => {
    useRender().setText('Der Knopf reagiert nicht.')
    absenden.mockRejectedValueOnce(new TypeError('Kaputt beim Server'))
    useRender().absenden(ereignis)
    await abwarten()

    const nachher = useRender()
    expect(nachher.fehler).toBe(MELDUNG_NICHT_GESPEICHERT)
    expect(nachher.text).toBe('Der Knopf reagiert nicht.')
    expect(nachher.nochmal).toBeTypeOf('function')

    absenden.mockResolvedValueOnce({ kurznummer: 'AB12' } as Awaited<ReturnType<typeof meldungAbsenden>>)
    nachher.nochmal?.()
    await abwarten()
    expect(absenden).toHaveBeenCalledTimes(2)
    expect(absenden.mock.calls[1]?.[0]).toMatchObject({ text: 'Der Knopf reagiert nicht.' })
    const danach = useRender()
    expect(danach.kurznummer).toBe('AB12')
    expect(danach.fehler).toBe('')
    expect(danach.nochmal).toBeUndefined()
  })

  it('meldet den Wurf an Sentry — fester Text, ohne den Text der Meldung', async () => {
    useRender().setText('Geheimer Inhalt der Meldung')
    absenden.mockRejectedValueOnce(new TypeError('Kaputt beim Server'))
    useRender().absenden(ereignis)
    await abwarten()

    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    const [fehler, kontext] = vi.mocked(Sentry.captureException).mock.calls[0] ?? []
    expect((fehler as Error).message).toBe('Meldung: Absenden gescheitert')
    expect(JSON.stringify(kontext)).toContain('meldung-absenden')
    expect(JSON.stringify(kontext)).not.toContain('Geheimer Inhalt')
  })

  it('am Netz gescheitert: NETZ_SATZ_UNSICHER ohne „Nochmal“ (die Meldung kann schon angelegt sein) und nur eine Brotkrume', async () => {
    useRender().setText('Der Knopf reagiert nicht.')
    absenden.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    useRender().absenden(ereignis)
    await abwarten()

    const nachher = useRender()
    expect(nachher.fehler).toBe(NETZ_SATZ_UNSICHER)
    expect(nachher.fehler).not.toBe(NETZ_SATZ)
    expect(nachher.nochmal).toBeUndefined()
    expect(nachher.text).toBe('Der Knopf reagiert nicht.')
    expect(Sentry.captureException).not.toHaveBeenCalled()
    expect(Sentry.addBreadcrumb).toHaveBeenCalledTimes(1)
  })

  it('Gegenprobe: eine Ablehnung des Servers zeigt ihren Satz ohne „Nochmal“', async () => {
    absenden.mockResolvedValueOnce({ error: ZU_VIELE_MELDUNGEN } as Awaited<ReturnType<typeof meldungAbsenden>>)
    useRender().absenden(ereignis)
    await abwarten()

    const nachher = useRender()
    expect(nachher.fehler).toBe(ZU_VIELE_MELDUNGEN)
    expect(nachher.nochmal).toBeUndefined()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})

describe('Ansicht', () => {
  function useFormular(teil: Partial<MeldungFormular>): MeldungFormular {
    stand.neuerRender()
    return { ...useMeldungFormular({ formToken: 'zeitstempel', alsHof: false, kennungVorbelegt: '' }), ...teil }
  }
  const ansicht = (f: MeldungFormular, titel?: string) =>
    renderToStaticMarkup(createElement(MeldungFormularAnsicht, { formular: f, welt: 'kunde', alsHof: false, abbrechenHref: '/', titel }))

  it('die Fehlerkarte zeigt „Nochmal“ nur mit dem Griff', () => {
    expect(ansicht(useFormular({ fehler: MELDUNG_NICHT_GESPEICHERT, nochmal: () => {} }))).toContain(`>${NETZ_KNOPF}<`)
    expect(ansicht(useFormular({ fehler: ZU_VIELE_MELDUNGEN }))).not.toContain(`>${NETZ_KNOPF}<`)
  })

  it('der Dank ist die h1, wenn die Ansicht die Überschrift der Seite trägt — sonst h2', () => {
    const mitTitel = ansicht(useFormular({ kurznummer: 'AB12' }), 'Problem melden')
    expect(mitTitel).toMatch(/<h1[^>]*>Danke/)
    const ohne = ansicht(useFormular({ kurznummer: 'AB12' }))
    expect(ohne).not.toContain('<h1')
    expect(ohne).toMatch(/<h2[^>]*>Danke/)
  })
})
