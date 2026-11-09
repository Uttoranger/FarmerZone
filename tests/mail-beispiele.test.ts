/**
 * Beispiele in Admin › Betrieb › Mails (Register N48, Nr. 270;
 * src/server/mail-arten/beispiele.ts, zeigeMailBeispielAction).
 *
 * Beweist mit dem ECHTEN email.ts und den echten Vorlagen:
 *  - jede Art der sechs Mail-Boards (MAIL_BEISPIELE) liefert Betreff und HTML;
 *  - kein HTML und kein Betreff enthält eine Adresse außer gekürzten unter
 *    example.com, einen Code außer dem Platzhalter aus Nullen, einen Link
 *    (`href`) oder den Platzhalter-Token — also keinen signierten Link;
 *  - gebaut wird ohne Datenbank (jeder Zugriff auf prisma wirft), ohne
 *    Resend, ohne Protokoll und ohne Mail-Auftrag;
 *  - die Action verlangt das Admin-Recht `ansehen` (Gegenprobe: ohne Recht
 *    der Satz der Wache und kein Bau), nimmt nur eine Kennung der Liste und
 *    gibt nur Titel, Betreff und HTML zurück.
 * Gegenproben der Prüfungen: Ein roher Link mit Token, eine echte Adresse und
 * ein echter Code werden gefunden.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { resendBau, protokoll, schlange, wache } = vi.hoisted(() => ({
  resendBau: vi.fn(),
  protokoll: vi.fn(),
  schlange: { stelleMailEin: vi.fn(), stelleEinOhneRisiko: vi.fn(), arbeiteWarteschlange: vi.fn(), protokolliereSofortMail: vi.fn() },
  wache: { verlangeAdminAktion: vi.fn(), verlangeFrischeBestaetigung: vi.fn() },
}))

vi.mock('server-only', () => ({}))
// Jeder Zugriff auf die Datenbank wirft: Ein Beispiel darf sie nie brauchen.
vi.mock('@/lib/prisma', () => ({
  prisma: new Proxy(
    {},
    {
      get(_ziel, name) {
        throw new Error(`Datenbank gelesen: ${String(name)}`)
      },
    }
  ),
}))
vi.mock('@/server/mail-warteschlange', () => schlange)
vi.mock('@/server/admin-protokoll', () => ({ protokolliere: protokoll }))
vi.mock('@/server/admin-wache', () => wache)
vi.mock('@/server/betrieb-zaehler', () => ({ zaehleMail: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn(), captureMessage: vi.fn() }))
vi.mock('resend', () => ({
  Resend: class {
    constructor() {
      resendBau()
    }
  },
}))

import { MAIL_BEISPIELE, MAIL_BEISPIEL_IDS, MAIL_TEXT, BEISPIEL_GRUPPEN, type MailBeispielId } from '@/lib/betrieb-mails'

let beispiele: typeof import('@/server/mail-arten/beispiele')
let aktionen: typeof import('@/server/actions/betrieb')

beforeAll(async () => {
  beispiele = await import('@/server/mail-arten/beispiele')
  aktionen = await import('@/server/actions/betrieb')
}, 30_000)

beforeEach(() => {
  vi.clearAllMocks()
  wache.verlangeAdminAktion.mockResolvedValue({ ok: true, userId: 'admin_1' })
})

const ADRESSE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
/** Sechs Ziffern am Stück oder in zwei Dreiergruppen — die Form eines Codes. */
const CODE = /(?<![\d.,])\d{3}[\s ]?\d{3}(?![\d.,])/g

/** Was ein Beispiel nie enthalten darf — leer = sauber. */
function befunde(text: string): string[] {
  const funde: string[] = []
  for (const a of text.match(ADRESSE) ?? []) if (!a.toLowerCase().endsWith('@example.com')) funde.push(`Adresse ${a}`)
  for (const c of text.match(CODE) ?? []) if (c.replace(/\D/g, '') !== beispiele.BEISPIEL_CODE) funde.push(`Code ${c}`)
  // Ein Link zum Anklicken; `<link rel="preload">` des Fotos ist keiner und zeigt nur auf das Bild.
  if (/<a\b[^>]*\bhref\s*=/i.test(text)) funde.push('Link (href)')
  if (text.includes(beispiele.BEISPIEL_TOKEN)) funde.push('Token')
  if (/[?&](token|t|sig)=/i.test(text)) funde.push('Link mit Token')
  return funde
}

describe('Beispiele: jede Art der Boards', () => {
  it('die Liste deckt alle sechs Boards, jede Kennung genau einmal', () => {
    expect(new Set(MAIL_BEISPIEL_IDS).size).toBe(MAIL_BEISPIELE.length)
    expect(new Set(MAIL_BEISPIELE.map((b) => b.gruppe))).toEqual(new Set(BEISPIEL_GRUPPEN.map((g) => g.id)))
    // 30 Bilder auf den Boards mail-zugang (4), -sicherheit (6), -team (5), -betrieb (6), -hof-konto (5), -neuigkeiten (4)
    expect(MAIL_BEISPIELE.length).toBe(30)
  })

  it.each(MAIL_BEISPIEL_IDS)('%s: Betreff und HTML, keine echte Adresse, kein Code außer Nullen, kein Link', async (id) => {
    const mail = await beispiele.baueMailBeispiel(id)

    expect(mail.betreff.length).toBeGreaterThan(0)
    expect(mail.html).toContain('<')
    expect(Object.keys(mail).sort()).toEqual(['betreff', 'html'])
    expect(befunde(mail.betreff)).toEqual([])
    expect(befunde(mail.html)).toEqual([])
    // Kein Versand, kein Protokoll, kein Auftrag.
    expect(resendBau).not.toHaveBeenCalled()
    expect(schlange.protokolliereSofortMail).not.toHaveBeenCalled()
    expect(schlange.stelleMailEin).not.toHaveBeenCalled()
    expect(schlange.stelleEinOhneRisiko).not.toHaveBeenCalled()
  })

  it('Codes erscheinen nur als Platzhalter aus Nullen (Anmeldecode, Bestellcode, Einrichtungscode)', async () => {
    for (const id of ['anmeldecode', 'bestellcode', 'einrichtungscode'] as const) {
      const { html } = await beispiele.baueMailBeispiel(id)
      expect(html.match(CODE)?.length ?? 0, id).toBeGreaterThan(0)
    }
  })

  it('Gegenprobe: ein roher Link mit Token, eine echte Adresse und ein echter Code werden gefunden', () => {
    const roh = `<a href="https://hof.example.com/verify?token=${beispiele.BEISPIEL_TOKEN}">Bestätigen</a> franz@hof.at 482 917`
    expect(befunde(roh)).toEqual(['Adresse franz@hof.at', 'Code 482 917', 'Link (href)', 'Token', 'Link mit Token'])
    expect(befunde('Am 12.03.2027 um 482917 Uhr')).toEqual(['Code 482917'])
  })
})

describe('zeigeMailBeispielAction', () => {
  it('ohne Admin-Recht: genau der Satz der Wache, kein Betreff, kein HTML', async () => {
    wache.verlangeAdminAktion.mockResolvedValue({ error: 'Nur für den Betreiber.' })

    expect(await aktionen.zeigeMailBeispielAction({ beispiel: 'anmeldecode' })).toEqual({ error: 'Nur für den Betreiber.' })
    expect(wache.verlangeAdminAktion).toHaveBeenCalledWith({ recht: 'ansehen' })
  })

  it('nur eine Kennung aus der Liste; eine Mail-Auftrags-ID oder Adresse ist ungültig', async () => {
    for (const eingabe of [{ beispiel: 'cmfauftrag0000000000001a' }, { id: 'cmfauftrag0000000000001a' }, { beispiel: 'anmeldecode', an: 'x@example.com' }, null]) {
      const antwort = await aktionen.zeigeMailBeispielAction(eingabe)
      if (eingabe && 'an' in eingabe) {
        // Zusätzliche Felder fallen weg (z.object) — eine Adresse erreicht nie den Bau.
        expect('ok' in antwort && JSON.stringify(antwort)).not.toContain('x@example.com')
      } else {
        expect(antwort).toEqual({ error: MAIL_TEXT.eingabeUngueltig })
      }
    }
  })

  it.each(['anmeldecode', 'neuer-hof', 'beitrag-mit-foto'] satisfies MailBeispielId[])('%s: Titel, Betreff und HTML — nichts gespeichert, protokolliert oder verschickt', async (id) => {
    const antwort = await aktionen.zeigeMailBeispielAction({ beispiel: id })

    expect(antwort).toMatchObject({ ok: true })
    expect(Object.keys(antwort).sort()).toEqual(['betreff', 'html', 'ok', 'titel'])
    expect(protokoll).not.toHaveBeenCalled()
    expect(schlange.stelleMailEin).not.toHaveBeenCalled()
    expect(resendBau).not.toHaveBeenCalled()
  })
})
