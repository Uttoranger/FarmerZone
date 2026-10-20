/**
 * Admin › Betrieb an den Systemgrenzen (Register N18/N15, Nr. 103).
 *
 * Beweist:
 *  - „Jetzt messen“ (Action) nur für den Admin; liegt die letzte Messung
 *    weniger als 10 Minuten zurück, misst sie nicht neu und sagt die Uhrzeit.
 *    Das entscheidet seit Nr. 113 EINE Anweisung (`beginneMessung`); die
 *    Warn-Mail geht erst nach der Antwort (`nachher`).
 *  - „Messungen als CSV“: ohne Admin-Recht 403 ohne Inhalt, sonst nur Zahlen,
 *    no-store, als Datei.
 *  - Der Punkt am Reiter und der Hinweis in der Betriebsleiste: nur in der
 *    Produktion, aus EINER schlanken Abfrage je Seitenaufbau; scheitert sie,
 *    fehlt nur der Punkt (Sentry ohne Inhalt).
 *  - Die AdminShell zeigt Punkt („1 Warnung“) und Hinweis mit Link — ohne
 *    Warnung keins von beiden (Gegenprobe).
 *  - Admin › Einstellungen: `?gruppe=betrieb` führt nach Admin › Betrieb.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const wache = vi.hoisted(() => ({ verlangeAdminAktion: vi.fn(), verlangeAdminSeite: vi.fn(async () => 'admin_1'), verlangeAdminShell: vi.fn(async () => ({ userId: 'admin_1', inhaltOffen: true })), verlangeFrischeBestaetigung: vi.fn(async () => ({ ok: true, userId: 'admin_1', sitzungId: 'sitzung-admin_1' })), frischOderBestaetigen: vi.fn(async () => null), adminPflichtOffen: vi.fn(async () => false) }))
const umgebung = vi.hoisted(() => ({ vercelProduktion: false }))
const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  betriebMessung: { findFirst: vi.fn(), findMany: vi.fn() },
  betriebWarnung: { findMany: vi.fn() },
  ablaufLauf: { findMany: vi.fn() },
}))

vi.mock('@/server/admin-wache', () => wache)
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/server/betrieb', () => ({ messeUndPruefe: vi.fn(async () => ({ gemessen: [], fehler: [] })), beginneMessung: vi.fn(async () => true) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/server/queries/admin', () => ({ zaehleWartendeHoefe: vi.fn(async () => 0) }))
vi.mock('@/server/queries/postfach', () => ({ zaehleOffenImEingang: vi.fn(async () => ({ gesamt: 0 })) }))
vi.mock('@/lib/umgebung-server', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@/lib/umgebung-server')>()
  return {
    ...echt,
    get UMGEBUNG() {
      return { ...echt.UMGEBUNG, vercelProduktion: umgebung.vercelProduktion }
    },
  }
})
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/betrieb',
  redirect: vi.fn((ziel: string) => {
    throw new Error(`REDIRECT:${ziel}`)
  }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => createElement('a', { href, ...rest }, children),
}))

import * as Sentry from '@sentry/nextjs'
import { beginneMessung, messeUndPruefe } from '@/server/betrieb'
import { messeJetztAction } from '@/server/actions/betrieb'
import { GET as exportGet } from '@/app/admin/betrieb/export/route'
import { ladeAdminbereich } from '@/server/adminbereich'
import { AdminShell, type AdminShellProps } from '@/components/shells/admin-shell'
import AdminEinstellungenPage from '@/app/admin/einstellungen/page'

beforeEach(() => {
  vi.clearAllMocks()
  umgebung.vercelProduktion = false
  wache.verlangeAdminAktion.mockResolvedValue({ ok: true, userId: 'admin_1' })
  db.user.findUnique.mockResolvedValue({ name: 'Max Mustermann', role: 'CUSTOMER', farm: null })
  db.betriebWarnung.findMany.mockResolvedValue([{ art: 'bilder', stufe: 1 }])
  db.ablaufLauf.findMany.mockResolvedValue([])
})

describe('„Jetzt messen“', () => {
  it('ohne Admin-Recht: der Satz der Wache, keine Messung', async () => {
    wache.verlangeAdminAktion.mockResolvedValue({ error: 'Kein Zugriff.' })
    expect(await messeJetztAction()).toEqual({ error: 'Kein Zugriff.' })
    expect(beginneMessung).not.toHaveBeenCalled()
    expect(messeUndPruefe).not.toHaveBeenCalled()
  })

  it('Beginn nicht belegt (Messung vor 5 Minuten): misst nicht neu und nennt die Uhrzeit (Wiener Zeit) — auch die eines laufenden Beginns', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-16T08:05:00.000Z'))
    vi.mocked(beginneMessung).mockResolvedValueOnce(false)
    db.betriebMessung.findFirst.mockResolvedValue({ gemessenAm: new Date('2026-10-16T08:00:00.000Z') })
    expect(await messeJetztAction()).toEqual({ ok: true, satz: 'Gerade erst gemessen – um 10:00' })
    expect(messeUndPruefe).not.toHaveBeenCalled()
    // Die Uhrzeit nimmt den Merker mit: Ein gleichzeitiger Klick sieht die Zeit des ersten, auch wenn der noch misst.
    expect(db.betriebMessung.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { art: { in: expect.arrayContaining(['messBeginn', 'datenbankBytes']) } } }))
    vi.useRealTimers()
  })

  it('Beginn belegt: misst, prüft die Grenzen und schickt die Warn-Mail erst nach der Antwort', async () => {
    expect(await messeJetztAction()).toMatchObject({ ok: true, satz: 'Gemessen. Die Kacheln zeigen die neuen Zahlen.' })
    expect(beginneMessung).toHaveBeenCalledTimes(1)
    expect(messeUndPruefe).toHaveBeenCalledWith(expect.any(Date), { nachher: true })
    expect(db.betriebMessung.findFirst).not.toHaveBeenCalled()
  })
})

describe('„Messungen als CSV“', () => {
  it('ohne Admin-Recht: 403 ohne Inhalt, keine Abfrage', async () => {
    wache.verlangeAdminAktion.mockResolvedValue({ error: 'Nicht angemeldet.' })
    const antwort = await exportGet()
    expect(antwort.status).toBe(403)
    expect(await antwort.text()).toBe('Kein Zugriff.')
    expect(db.betriebMessung.findMany).not.toHaveBeenCalled()
  })

  it('als Admin: nur Tag, Art und Zahl, no-store, als Datei — eine fremde Art fällt weg', async () => {
    db.betriebMessung.findMany.mockResolvedValue([
      { tag: new Date('2026-10-16T00:00:00.000Z'), art: 'mails', wert: BigInt(12) },
      { tag: new Date('2026-10-16T00:00:00.000Z'), art: 'von-hand', wert: BigInt(1) },
    ])
    const antwort = await exportGet()
    expect(antwort.status).toBe(200)
    expect(antwort.headers.get('cache-control')).toBe('no-store')
    expect(antwort.headers.get('content-disposition')).toMatch(/^attachment; filename="betrieb-messungen-\d{4}-\d{2}-\d{2}\.csv"$/)
    // Die BOM (Excel erkennt so UTF-8) steht als Bytes vorn; der Decoder entfernt sie beim Lesen.
    const bytes = new Uint8Array(await antwort.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(new TextDecoder().decode(bytes)).toBe('Tag;Art;Wert\r\n2026-10-16;mails;12\r\n')
  })
})

describe('Punkt und Hinweis der Shell (ladeAdminbereich)', () => {
  it('außerhalb der Produktion: kein Hinweis und keine Abfrage', async () => {
    expect((await ladeAdminbereich()).betrieb).toBeNull()
    expect(db.betriebWarnung.findMany).not.toHaveBeenCalled()
  })

  it('in der Produktion mit offener Warnung: „1 Warnung“ samt Hinweis', async () => {
    umgebung.vercelProduktion = true
    expect((await ladeAdminbereich()).betrieb).toEqual({ anzahl: 1, text: 'Bilder-Speicher über 80 %', kurz: 'Bilder über 80 %' })
    expect(db.betriebWarnung.findMany).toHaveBeenCalledWith({ where: { stufe: { gt: 0 } }, select: { art: true, stufe: true } })
  })

  it('scheitert die Abfrage, fehlt nur der Punkt — Sentry mit festem Satz, ohne Inhalt', async () => {
    umgebung.vercelProduktion = true
    db.betriebWarnung.findMany.mockRejectedValue(Object.assign(new Error('Tabelle "BetriebWarnung" fehlt'), { name: 'PrismaClientKnownRequestError' }))
    const bereich = await ladeAdminbereich()
    expect(bereich.betrieb).toBeNull()
    expect(bereich.personName).toBe('Max Mustermann')
    const [gemeldet] = vi.mocked(Sentry.captureException).mock.calls[0] as [Error]
    expect([gemeldet.name, gemeldet.message]).toEqual(['PrismaClientKnownRequestError', 'Betrieb: Hinweis der Shell nicht gelesen'])
  })
})

describe('AdminShell: Punkt am Reiter und Hinweis in der Betriebsleiste', () => {
  const Shell = AdminShell as unknown as ComponentType<Omit<AdminShellProps, 'children'>>
  const render = (betrieb: AdminShellProps['betrieb']): string =>
    renderToStaticMarkup(createElement(Shell, { personName: 'Max Mustermann', hatHof: false, zahlen: { hoefe: 0, briefkasten: 0 }, betrieb }))

  it('mit Warnung: Punkt mit „1 Warnung“ und der Hinweis als Link nach Admin › Betrieb', () => {
    const html = render({ anzahl: 1, text: 'Bilder-Speicher über 80 %', kurz: 'Bilder über 80 %' })
    expect(html).toContain('aria-label="1 Warnung"')
    expect(html).toContain('Bilder-Speicher über 80 % – ansehen')
    expect(html).toMatch(/<a [^>]*href="\/admin\/betrieb"[^>]*>(?:(?!<\/a>)[\s\S])*Bilder über 80 %/)
  })

  it('Gegenprobe: ohne Warnung weder Punkt noch Hinweis — der Reiter Betrieb steht trotzdem da', () => {
    const html = render(null)
    expect(html).not.toContain('Warnung')
    expect(html).not.toContain('ansehen')
    expect(html).toContain('>Betrieb')
  })
})

describe('Admin › Einstellungen', () => {
  it('ein alter Link auf die Gruppe Betrieb führt nach Admin › Betrieb', async () => {
    await expect(AdminEinstellungenPage({ searchParams: Promise.resolve({ gruppe: 'betrieb' }) })).rejects.toThrow('REDIRECT:/admin/betrieb')
  })
})
