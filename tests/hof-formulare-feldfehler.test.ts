/**
 * Feldfehler am Feld (Nr. 174, WCAG 3.3.1): Der Satz steht unter dem Feld mit
 * `role="alert"`, das Feld zeigt mit `aria-invalid` und `aria-describedby` auf
 * ihn. Gilt für die Felder der Formulare Futter und Brennmaterial (Rahmen
 * `Feld`), den Beitrag und – als Karte am Formular – für Speicherfehler, die
 * kein Feld betreffen („Nochmal" nur am Netz, Register N29).
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Feld, FeldFehler, feldId } from '@/components/produkte/familien-teile'
import { FeldFehlerSatz, SpeicherFehler, feldFehlerAttribute } from '@/components/shared/formular-meldungen'
import { DezimalFeld } from '@/components/shared/dezimal-feld'
import { NETZ_KNOPF, NETZ_SATZ } from '@/lib/netz'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }), usePathname: () => '/status/new' }))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('@/server/actions/status-posts', () => ({ publishStatusPost: vi.fn() }))
vi.mock('@/server/actions/bild-ausschnitt', () => ({ speichereBildAusschnittAction: vi.fn() }))
vi.mock('@/server/actions/appearance', () => ({ saveAppearanceAction: vi.fn() }))
vi.mock('@/server/actions/farm', () => ({ updateProfile: vi.fn(), ladeProfilStand: vi.fn() }))
vi.mock('@/components/shared/image-upload', () => ({
  stufenText: () => '',
  useImageUpload: () => ({ fileInput: null, isUploading: false, progress: null, openFilePicker: vi.fn() }),
}))
vi.mock('@/components/teilen/teilen-fenster', () => ({ TeilenFenster: () => null }))
vi.mock('@/components/teilen/beitrag-teilen', () => ({ ladeBeitragFenster: vi.fn() }))

describe('feldFehlerAttribute', () => {
  it('Fehler: aria-invalid und der Satz; mit Hilfe beide; ohne beides nichts', () => {
    expect(feldFehlerAttribute('a', true)).toEqual({ 'aria-invalid': true, 'aria-describedby': 'a-fehler' })
    expect(feldFehlerAttribute('a', true, true)).toEqual({ 'aria-invalid': true, 'aria-describedby': 'a-fehler a-hilfe' })
    expect(feldFehlerAttribute('a', false, true)).toEqual({ 'aria-describedby': 'a-hilfe' })
    expect(feldFehlerAttribute('a', false)).toEqual({})
  })
})

describe('Feld (Futter, Brennmaterial)', () => {
  const eingabe = (): ReactElement => createElement('input', { id: feldId('name') })
  const markup = (fehler?: string, hilfe?: string, kind: ReactElement = eingabe()) =>
    renderToStaticMarkup(createElement(Feld, { feld: 'name', label: 'Name', fehler, hilfe } as never, kind))

  it('mit Fehler: das Feld ist ungültig und zeigt auf den Satz, der Satz meldet sich', () => {
    const m = markup('Bitte gib einen Namen an.')
    expect(m).toMatch(/<input[^>]*aria-invalid="true"/)
    expect(m).toMatch(/<input[^>]*aria-describedby="feld-name-fehler"/)
    expect(m).toMatch(/<p id="feld-name-fehler" role="alert"[^>]*>Bitte gib einen Namen an\.<\/p>/)
  })

  it('mit Hilfe, ohne Fehler: das Feld zeigt auf die Hilfe, nicht ungültig', () => {
    const m = markup(undefined, 'z. B. Heu')
    expect(m).toMatch(/<input[^>]*aria-describedby="feld-name-hilfe"/)
    expect(m).not.toContain('aria-invalid')
    expect(m).toContain('id="feld-name-hilfe"')
  })

  it('Gegenprobe: ohne Fehler und ohne Hilfe bleibt das Feld unverändert', () => {
    const m = markup()
    expect(m).not.toContain('aria-invalid')
    expect(m).not.toContain('aria-describedby')
    expect(m).not.toContain('role="alert"')
  })

  it('auch ein DezimalFeld (Preis, Gewicht) bekommt die Verbindung', () => {
    const preis = createElement(DezimalFeld, { id: feldId('name'), value: null, onChange: () => undefined })
    const m = markup('Bitte gib einen Preis an.', undefined, preis)
    expect(m).toMatch(/<input[^>]*aria-invalid="true"/)
    expect(m).toMatch(/<input[^>]*aria-describedby="feld-name-fehler"/)
  })

  it('FeldFehler (Fehler ohne Feld-Rahmen, z. B. Gruppen) meldet sich ebenfalls', () => {
    expect(renderToStaticMarkup(createElement(FeldFehler, { id: 'x' } as never, 'Satz'))).toContain('role="alert"')
  })
})

describe('FeldFehlerSatz und SpeicherFehler', () => {
  it('ohne Text nichts', () => {
    expect(renderToStaticMarkup(createElement(FeldFehlerSatz, { feldId: 'a', text: null }))).toBe('')
    expect(renderToStaticMarkup(createElement(SpeicherFehler, { text: null }))).toBe('')
  })

  it('Speicherfehler: Karte mit role="alert"; „Nochmal" nur am Netz', () => {
    const karte = renderToStaticMarkup(createElement(SpeicherFehler, { text: 'Das ging nicht.', nochmal: false, onNochmal: () => undefined }))
    expect(karte).toContain('role="alert"')
    expect(karte).toContain('Das ging nicht.')
    expect(karte).not.toContain(NETZ_KNOPF)

    const netz = renderToStaticMarkup(createElement(SpeicherFehler, { text: NETZ_SATZ, nochmal: true, onNochmal: () => undefined }))
    expect(netz).toContain(NETZ_SATZ)
    expect(netz).toMatch(new RegExp(`<button[^>]*type="button"[^>]*>${NETZ_KNOPF}</button>`))
  })
})

describe('Beitrag schreiben', () => {
  it('Titel und Nachricht: 16 px, Weiter-Taste, kein „*", „(freiwillig)" statt „(optional)"', async () => {
    const { StatusNewClient } = await import('@/app/(hof)/status/new/status-new-client')
    const m = renderToStaticMarkup(
      createElement(StatusNewClient, {
        products: [{ id: 'p1', name: 'Eier' }],
        emailCount: 0,
        recentEmailSentAt: null,
        jetzt: '2026-10-25T10:00:00.000Z',
        prefill: null,
      } as never)
    )
    const titel = m.match(/<input[^>]*id="status-title"[^>]*>/)?.[0] ?? ''
    const text = m.match(/<textarea[^>]*id="status-body"[^>]*>/)?.[0] ?? ''
    expect(titel).toContain('enterKeyHint="next"')
    for (const feld of [titel, text]) {
      expect(feld).toContain('text-base')
      expect(feld).not.toMatch(/(^|[\s"])text-sm/)
    }
    expect(m).not.toMatch(/ \*\s*<\/label>/)
    expect(m).toContain('(freiwillig)')
    expect(m).not.toContain('(optional)')
  })
})
