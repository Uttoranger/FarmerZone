/**
 * Rückweg im Hofbereich (Nachtlauf Nr. 44, Register N1, freigabe.md §12).
 *
 * Beweist:
 *  - UnterseitenKopf: am Handy eine feste Leiste oben (sticky, 56 px) mit
 *    Pfeil und dem Namen der Elternseite (15 px halbfett); der Link ist die
 *    ganze Fläche (≥ 44 px), hat sichtbaren Fokus und heißt „Zurück zu …".
 *    Im Browser die Zeile „‹ …", darunter der Titel als h1. Name und Ziel
 *    kommen aus elternseite(); auf einer Seite der Leiste gibt es keinen
 *    Rückweg (Gegenprobe).
 *  - Die alten Bausteine (EinstellungenKopf, ZurueckZuEinstellungen,
 *    ZurueckLink) gibt es nicht mehr, keine Datei bindet sie ein; jede
 *    genannte Unterseite trägt den neuen Kopf.
 *  - Speichern: auf Einstellungs-Unterseiten Toast „Gespeichert" und zurück
 *    zur Übersicht, nur nach Erfolg; Abholzeiten bleibt; derselbe Baustein im
 *    Hofseiten-Editor behält seine Meldung. Mein Auftritt verlässt die Seite
 *    nicht, solange ein Foto hochlädt; das Hof-Profil nicht, solange die
 *    Ortssuche läuft (Nachbesserung Runde 1).
 *  - Tab-Titel und Seitentitel der Unterseiten haben eine Schreibweise.
 *  - Hof-Profil: „Einstellungen → Mein Auftritt" ist ein Link.
 *  - Mehr-Blatt: „Angemeldet …" ist ein Link auf „Konto und Sicherheit".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const navigation = vi.hoisted(() => ({ pfad: '/settings/profile', push: vi.fn() }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pfad,
  useRouter: () => ({ push: navigation.push, refresh: vi.fn(), replace: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode; [k: string]: unknown }) => {
    const attribute = { ...rest }
    delete attribute.prefetch
    delete attribute.onNavigate
    return createElement('a', { href, ...attribute }, children)
  },
}))
// Die Karte lädt Leaflet nur im Browser (ssr: false) — hier steht sie leer.
vi.mock('next/dynamic', () => ({ default: () => () => null }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/server/actions/farm', () => ({
  updateProfile: vi.fn(),
  sucheHofStandort: vi.fn(),
  holeAdresseZumPunkt: vi.fn(),
}))
vi.mock('@/lib/auth-client', () => ({ signOut: vi.fn() }))

import { UnterseitenKopf } from '@/components/hofbereich/unterseiten-kopf'
import { useNachSpeichern } from '@/components/hof-einstellungen/use-nach-speichern'
import { ProfileForm } from '@/components/settings/profile-form'
import { PersonZeile } from '@/components/shells/hof-shell'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { EINSTELLUNG_KONTO, GESPEICHERT_TEXT, RUECKWEG_PRAEFIX } from '@/lib/bauern-navigation'
import type { FarmSettings } from '@/server/queries/farm'

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

function kopf(pfad: string, props: Parameters<typeof UnterseitenKopf>[0] = {}): string {
  navigation.pfad = pfad
  return renderToStaticMarkup(createElement(UnterseitenKopf, props))
}

/** Die Klassen des Elements, das unmittelbar vor `marke` geöffnet wird. */
function klassenVor(html: string, marke: string): string {
  const stelle = html.indexOf(marke)
  expect(stelle, marke).toBeGreaterThanOrEqual(0)
  const davor = html.slice(0, stelle)
  const treffer = [...davor.matchAll(/class="([^"]*)"/g)]
  return treffer[treffer.length - 1]?.[1] ?? ''
}

beforeEach(() => {
  vi.clearAllMocks()
  navigation.pfad = '/settings/profile'
})

// ─── Der Baustein ───────────────────────────────────────────────────────────

describe('UnterseitenKopf am Handy', () => {
  const html = kopf('/settings/profile', { titel: 'Hof-Profil', satz: 'Informationen für deine Hofseite.' })
  const leiste = html.slice(0, html.indexOf('</div>') + 6)

  it('eine feste Leiste oben: sticky, 56 px hoch, eigene Fläche — nur unter 768 px', () => {
    const klassen = leiste.match(/^<div class="([^"]*)"/)?.[1] ?? ''
    for (const k of ['sticky', 'top-0', 'h-14', 'bg-card', 'border-b', 'md:hidden', 'print:hidden']) expect(klassen.split(' '), k).toContain(k)
  })

  it('Pfeil plus Name der Elternseite (15 px halbfett); die ganze Fläche ist EIN Link mit mindestens 44 px', () => {
    expect(leiste.match(/<a /g)).toHaveLength(1)
    expect(leiste).toContain('href="/settings"')
    const link = leiste.match(/<a href="\/settings" class="([^"]*)"/)?.[1] ?? ''
    for (const k of ['min-h-11', 'text-[15px]', 'font-semibold']) expect(link.split(' '), k).toContain(k)
    expect(leiste).toContain('>Einstellungen</span>')
    expect(leiste).toMatch(/<svg[^>]*lucide-arrow-left[^>]*aria-hidden="true"|<svg[^>]*aria-hidden="true"[^>]*lucide-arrow-left/)
  })

  it('heißt für den Screenreader „Zurück zu Einstellungen" und hat einen sichtbaren Fokus', () => {
    expect(leiste).toContain(`<span class="sr-only">${RUECKWEG_PRAEFIX} </span>`)
    expect(RUECKWEG_PRAEFIX).toBe('Zurück zu')
    const link = leiste.match(/<a href="\/settings" class="([^"]*)"/)?.[1] ?? ''
    for (const k of FOKUS_RAHMEN.split(' ')) expect(link.split(' '), k).toContain(k)
  })

  it('ein langer Name sprengt die Leiste nicht', () => {
    expect(klassenVor(leiste, '>Einstellungen</span>')).toContain('truncate')
  })
})

describe('UnterseitenKopf im Browser und Titel', () => {
  const html = kopf('/settings/profile', { titel: 'Hof-Profil', satz: 'Informationen für deine Hofseite.' })

  it('ab 768 px die bisherige Zeile „‹ …" mit Chevron, 44 px, ebenfalls „Zurück zu …"', () => {
    const links = [...html.matchAll(/<a href="\/settings" class="([^"]*)"/g)].map((t) => t[1])
    expect(links).toHaveLength(2)
    expect(klassenVor(html, links[1] ? `<a href="/settings" class="${links[1]}"` : '')).toContain('md:flex')
    expect(links[1].split(' ')).toContain('min-h-11')
    expect(html).toMatch(/lucide-chevron-left/)
    expect(html.match(new RegExp(`${RUECKWEG_PRAEFIX} </span>`, 'g'))).toHaveLength(2)
  })

  it('darunter der Titel als einzige h1, mit dem Satz', () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(html).toMatch(/<h1[^>]*>Hof-Profil<\/h1>/)
    expect(html).toContain('Informationen für deine Hofseite.')
  })

  it('Gegenprobe: auf einer Seite der Leiste kein Rückweg — nur der Titel', () => {
    const oben = kopf('/settings', { titel: 'Einstellungen' })
    expect(oben).not.toContain('<a ')
    expect(oben).not.toContain('sticky')
    expect(oben).toMatch(/<h1[^>]*>Einstellungen<\/h1>/)
  })

  it('ohne Titel nur der Rückweg (die Seite trägt ihre h1 selbst)', () => {
    const neu = kopf('/status/new')
    expect(neu).not.toContain('<h1')
    expect(neu).toContain('href="/farm-page?reiter=beitraege"')
    expect(neu).toContain('>Beiträge</span>')
  })

  it('der Filter der Elternseite bleibt erhalten; ab 1024 px steht die Liste daneben', () => {
    const detail = kopf('/orders/bestellung-1', { titel: 'Bestellung FZ-1', suche: '?filter=heute', listeDaneben: true })
    expect(detail.match(/href="\/orders\?filter=heute"/g)).toHaveLength(2)
    // Der Titelblock (um die h1) und die Browser-Zeile entfallen ab 1024 px.
    expect(detail).toMatch(/<div class="[^"]*\blg:hidden\b[^"]*"><div class="min-w-0"><h1/)
    expect(detail).toMatch(/md:flex[^"]*lg:hidden|lg:hidden[^"]*md:flex/)
    // Gegenprobe: ohne listeDaneben bleiben beide.
    expect(kopf('/orders/bestellung-1', { titel: 'Bestellung FZ-1' })).not.toContain('lg:hidden')
  })

  it('zeileImBrowser={false}: nur die Leiste am Handy', () => {
    const melden = kopf('/fehler-melden', { zeileImBrowser: false })
    expect(melden.match(/<a /g)).toHaveLength(1)
    expect(melden).toContain('href="/meldungen"')
    expect(melden).toContain('>Hilfe und Rückmeldung</span>')
  })

  it('nur Tokens, keine Farbwerte', () => {
    const text = quelle('src/components/hofbereich/unterseiten-kopf.tsx') + quelle('src/components/hofbereich/unterseiten-kopf-stil.ts')
    expect(text).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|oklch)\(/)
    expect(text).not.toMatch(/\b(bg|text|border)-(white|black|gray|slate|green|amber|red)\b/)
  })
})

// ─── Speichern ──────────────────────────────────────────────────────────────

describe('useNachSpeichern — Toast „Gespeichert" und zurück zur Übersicht', () => {
  function nachSpeichernAuf(pfad: string): (sonst: string, zusatz?: string) => void {
    navigation.pfad = pfad
    let fn: ((sonst: string, zusatz?: string) => void) | null = null
    function Probe() {
      fn = useNachSpeichern()
      return null
    }
    renderToStaticMarkup(createElement(Probe))
    if (!fn) throw new Error('Hook nicht gerendert')
    return fn
  }

  it.each(['profile', 'appearance', 'pause', 'account'])('/settings/%s: Toast „Gespeichert", dann /settings', (seite) => {
    nachSpeichernAuf(`/settings/${seite}`)('Profil gespeichert')
    expect(toast.success).toHaveBeenCalledWith(GESPEICHERT_TEXT, undefined)
    expect(navigation.push).toHaveBeenCalledWith('/settings')
  })

  it('ein Zusatz (Passwort: andere Geräte abgemeldet) steht unter „Gespeichert"', () => {
    nachSpeichernAuf('/settings/account')('Passwort geändert', 'Andere Geräte wurden abgemeldet.')
    expect(toast.success).toHaveBeenCalledWith('Gespeichert', { description: 'Andere Geräte wurden abgemeldet.' })
  })

  it('Abholzeiten bleibt auf der Seite, mit der bisherigen Meldung', () => {
    nachSpeichernAuf('/settings/pickup-slots')('Abholzeit hinzugefügt')
    expect(toast.success).toHaveBeenCalledWith('Abholzeit hinzugefügt', undefined)
    expect(navigation.push).not.toHaveBeenCalled()
  })

  it('im Hofseiten-Editor (/farm-page) bleibt alles, wie es war', () => {
    nachSpeichernAuf('/farm-page')('Nachricht gespeichert')
    expect(toast.success).toHaveBeenCalledWith('Nachricht gespeichert', undefined)
    expect(navigation.push).not.toHaveBeenCalled()
  })
})

/** Der Rumpf einer Funktion im Quelltext — von ihrem Namen bis zur nächsten Funktion auf gleicher Ebene. */
function rumpf(text: string, name: string): string {
  const start = text.search(new RegExp(`(async )?function ${name}\\(`))
  expect(start, name).toBeGreaterThanOrEqual(0)
  const rest = text.slice(start + 1)
  const ende = rest.search(/\n {2}(async )?function |\n {2}\/\/ ──|\n {2}return \(/)
  return text.slice(start, ende === -1 ? undefined : start + 1 + ende)
}

describe('Speichern auf den Einstellungs-Unterseiten (Quelltext)', () => {
  const FORMULARE: [string, string, RegExp][] = [
    ['src/components/settings/profile-form.tsx', 'onSubmit', /if \(res\.error\)/],
    ['src/app/(hof)/settings/appearance/appearance-client.tsx', 'handleSave', /if \(result\.error\)/],
    ['src/components/settings/pause-client.tsx', 'handleSaveMessage', /if \(res\.error\)/],
    ['src/app/(hof)/settings/account/password-form.tsx', 'handleSubmit', /if \(error\)/],
  ]

  it.each(FORMULARE)('%s: nach dem Speichern zurück zur Übersicht — erst nach der Fehlerprüfung', (datei, funktion, fehler) => {
    const text = quelle(datei)
    expect(text).toContain("from '@/components/hof-einstellungen/use-nach-speichern'")
    const teil = rumpf(text, funktion)
    const pruefung = teil.search(fehler)
    const aufruf = teil.indexOf('nachSpeichern(')
    expect(pruefung, `${funktion}: Fehlerprüfung`).toBeGreaterThanOrEqual(0)
    expect(aufruf, `${funktion}: nachSpeichern`).toBeGreaterThan(pruefung)
  })

  it('der Fehlerweg kehrt vorher zurück bzw. steht im anderen Zweig — kein Sprung bei einem Fehler', () => {
    const profil = rumpf(quelle('src/components/settings/profile-form.tsx'), 'onSubmit')
    expect(profil).toMatch(/if \(res\.error\) \{\s*toast\.error\(res\.error\)\s*\} else \{\s*nachSpeichern\(/)
    const passwort = rumpf(quelle('src/app/(hof)/settings/account/password-form.tsx'), 'handleSubmit')
    expect(passwort).toMatch(/if \(error\) \{[\s\S]*?return\s*\}[\s\S]*nachSpeichern\(/)
  })

  it('Abholzeiten bleibt auf der Seite — kein Sprung zur Übersicht', () => {
    expect(quelle('src/components/settings/pickup-slots-client.tsx')).not.toMatch(/useNachSpeichern|router\.push\('\/settings'\)/)
  })

  it('Umschalter mit sofortiger Wirkung bleiben auf der Seite (Urlaubsmodus an/aus)', () => {
    expect(rumpf(quelle('src/components/settings/pause-client.tsx'), 'handleToggle')).not.toContain('nachSpeichern(')
  })

  it('Hof-Profil: Speichern wartet, solange „Auf der Karte suchen" läuft — der neue Standort ginge sonst verloren', () => {
    const text = quelle('src/components/settings/profile-form.tsx')
    expect(text).toMatch(/type="submit"\s*disabled=\{isPending \|\| sucheLaeuft\}/)
    expect(rumpf(text, 'onSubmit')).toMatch(/if \(sucheLaeuft\) return[\s\S]*startTransition\(/)
    // Umgekehrt beginnt keine Suche, während gespeichert wird (danach geht es zur Übersicht).
    expect(text).toMatch(/onClick=\{aufKarteSuchen\}\s*disabled=\{sucheLaeuft \|\| isPending\}/)
    // Gegenprobe: Die alte Sperre allein (nur isPending) fällt auf.
    expect('type="submit"\n        disabled={isPending}').not.toMatch(/type="submit"\s*disabled=\{isPending \|\| sucheLaeuft\}/)
  })

  it('Mein Auftritt: Speichern wartet, solange ein Foto hochlädt (der Upload ginge beim Verlassen verloren)', () => {
    const text = quelle('src/app/(hof)/settings/appearance/appearance-client.tsx')
    expect(text).toMatch(/disabled=\{saving \|\| uploadLaeuft\}/)
    for (const baustein of ['LogoUpload', 'BannerPhotoUpload', 'GallerySection']) {
      expect(text, baustein).toMatch(new RegExp(`<${baustein}[^>]*onHochladen=`))
    }
  })
})

// ─── Alte Bausteine ─────────────────────────────────────────────────────────

const ALTE_BAUSTEINE = /<(EinstellungenKopf|ZurueckZuEinstellungen|ZurueckLink)\b|import\s*\{[^}]*\b(EinstellungenKopf|ZurueckZuEinstellungen|ZurueckLink)\b/

function dateienUnter(ordner: string): string[] {
  const liste: string[] = []
  const suche = (o: string) => {
    for (const name of readdirSync(o)) {
      const p = join(o, name)
      if (statSync(p).isDirectory()) suche(p)
      else if (/\.tsx?$/.test(name)) liste.push(p)
    }
  }
  suche(join(process.cwd(), ordner))
  return liste
}

describe('Die alten Bausteine sind ersetzt', () => {
  it('EinstellungenKopf, ZurueckZuEinstellungen und ZurueckLink gibt es nicht mehr', () => {
    expect(existsSync(join(process.cwd(), 'src/components/hof-einstellungen/einstellungen-kopf.tsx'))).toBe(false)
    expect(existsSync(join(process.cwd(), 'src/components/hofbereich/zurueck-link.tsx'))).toBe(false)
  })

  it('keine Datei unter src/ bindet sie ein', () => {
    const dateien = dateienUnter('src')
    expect(dateien.length).toBeGreaterThan(200)
    for (const datei of dateien) expect(readFileSync(datei, 'utf8'), datei).not.toMatch(ALTE_BAUSTEINE)
  })

  it('Gegenprobe: die Suche findet Einbindung und Import', () => {
    expect('<ZurueckLink href="/x">x</ZurueckLink>').toMatch(ALTE_BAUSTEINE)
    expect("import { EinstellungenKopf } from '@/components/hof-einstellungen/einstellungen-kopf'").toMatch(ALTE_BAUSTEINE)
    expect('// der alte ZurueckLink führte zu Google').not.toMatch(ALTE_BAUSTEINE)
  })

  // Wo der Kopf steht: in der Seite selbst oder im Baustein, den sie zeigt.
  const MIT_KOPF: [string, string][] = [
    ['/settings/profile', 'src/app/(hof)/settings/profile/page.tsx'],
    ['/settings/pickup-slots', 'src/app/(hof)/settings/pickup-slots/page.tsx'],
    ['/settings/payments', 'src/app/(hof)/settings/payments/page.tsx'],
    ['/settings/pause', 'src/app/(hof)/settings/pause/page.tsx'],
    ['/settings/account', 'src/app/(hof)/settings/account/page.tsx'],
    ['/settings/appearance', 'src/app/(hof)/settings/appearance/page.tsx'],
    ['/settings/teilen', 'src/app/(hof)/settings/teilen/page.tsx'],
    ['/settings/konditionen', 'src/components/hof-einstellungen/konditionen-ansicht.tsx'],
    ['/customers/[kundeId]', 'src/components/hof-kunden/kunden-detail.tsx'],
    ['/orders/[orderId]', 'src/components/hof-bestellungen/bestell-detail.tsx'],
    ['/status/new', 'src/app/(hof)/status/new/page.tsx'],
    ['/status/[id]/send-whatsapp', 'src/app/(hof)/status/[id]/send-whatsapp/page.tsx'],
    ['/status/plakat', 'src/app/(hof)/status/plakat/page.tsx'],
    ['/fehler-melden', 'src/app/(hof)/fehler-melden/page.tsx'],
  ]

  it.each(MIT_KOPF)('%s trägt den UnterseitenKopf', (_route, datei) => {
    const text = quelle(datei)
    expect(text).toContain("from '@/components/hofbereich/unterseiten-kopf'")
    expect(text).toContain('<UnterseitenKopf')
  })

  it('die eigenen Rückwege von Kunden- und Bestelldetail sind weg (eine Schreibweise)', () => {
    expect(quelle('src/components/hof-kunden/kunden-detail.tsx')).not.toContain('Alle Kunden')
    expect(quelle('src/components/hof-bestellungen/bestell-detail.tsx')).not.toContain('Zurück zu den Bestellungen')
    expect(quelle('src/app/(hof)/fehler-melden/page.tsx')).not.toContain('Meine Meldungen')
  })

  it('der Kopf steht direkt im Rahmen der Seite — sonst klebt die Leiste nur, solange ein Kasten um den Kopf reicht', () => {
    // Plakat: der Kopf darf nicht im druckfreien Kasten um Titel und Knopf stehen.
    const plakat = quelle('src/app/(hof)/status/plakat/page.tsx')
    expect(plakat.indexOf('<UnterseitenKopf')).toBeLessThan(plakat.indexOf('<div className="print:hidden">'))
  })
})

// ─── Hof-Profil und Mehr-Blatt ──────────────────────────────────────────────

const HOF: FarmSettings = {
  id: 'hof-1',
  name: 'Hof Beispiel',
  ownerName: 'Max Mustermann',
  description: 'Eier und Brot',
  address: 'Dorfstraße 1',
  postalCode: '8700',
  city: 'Teststadt',
  country: 'AT',
  latitude: null,
  longitude: null,
  phone: '+43 660 0000000',
  email: 'hof@example.com',
  logoUrl: null,
  bannerUrl: null,
  isPaused: false,
  pauseMessage: null,
  slug: 'hof-beispiel',
  betriebsnummer: null,
  betriebsstatus: null,
  pickupSlots: [],
}

describe('Hof-Profil: „Einstellungen → Mein Auftritt" ist ein Link', () => {
  it('führt nach /settings/appearance, grün und 44 px hoch, mit sichtbarem Fokus', () => {
    const html = renderToStaticMarkup(createElement(ProfileForm, { farm: HOF }))
    const link = html.match(/<a href="\/settings\/appearance" class="([^"]*)"[^>]*>([^<]*)<\/a>/)
    expect(link?.[2]).toBe('Einstellungen → Mein Auftritt')
    const klassen = link?.[1].split(' ') ?? []
    for (const k of ['text-brand-text', 'py-3', ...FOKUS_RAHMEN.split(' ')]) expect(klassen, k).toContain(k)
    expect(html).not.toContain('<span class="text-foreground">Einstellungen → Mein Auftritt</span>')
  })

  it('ohne laufende Suche ist „Profil speichern" frei', () => {
    const html = renderToStaticMarkup(createElement(ProfileForm, { farm: HOF }))
    const knopf = html.match(/<button[^>]*type="submit"[^>]*>([^<]*)<\/button>/)
    expect(knopf?.[1]).toBe('Profil speichern')
    expect(knopf?.[0]).not.toMatch(/\sdisabled=/)
  })
})

describe('Tab-Titel und Seitentitel der Unterseiten', () => {
  // Zahlung bleibt außen vor (Nr. 42 ändert dort parallel, nur der Kopf ist getauscht);
  // Konditionen hat im Bestand zwei Wortlaute (Tab „Konditionen", h1 „Deine Konditionen").
  it.each(['profile', 'pickup-slots', 'pause', 'account', 'appearance', 'teilen'])('/settings/%s: der Tab nimmt dieselbe Schreibweise wie der Kopf', (seite) => {
    const text = quelle(`src/app/(hof)/settings/${seite}/page.tsx`)
    const tab = text.match(/title: `\$\{([A-Za-z_.]+)\} — FarmerZone`/)
    expect(tab, seite).not.toBeNull()
    const quelleDesTitels = tab?.[1] ?? ''
    // Die Mein-Auftritt-Seite trägt ihre h1 im Formular (aus derselben Konstante).
    const kopf = seite === 'appearance' ? quelle('src/app/(hof)/settings/appearance/appearance-client.tsx') : text
    expect(kopf, seite).toContain(`{${quelleDesTitels}}`)
  })
})

describe('Mehr-Blatt: „Angemeldet …" führt zu Konto und Sicherheit', () => {
  it('mit Ziel ein Link (≥ 44 px, Fokus) — der Screenreader hört auch, wohin', () => {
    const html = renderToStaticMarkup(createElement(PersonZeile, { name: 'Max Mustermann', konto: EINSTELLUNG_KONTO }))
    expect(html).toMatch(/^<a href="\/settings\/account"/)
    const klassen = html.match(/^<a href="\/settings\/account" class="([^"]*)"/)?.[1].split(' ') ?? []
    for (const k of ['min-h-11', ...FOKUS_RAHMEN.split(' ')]) expect(klassen, k).toContain(k)
    expect(html).toContain('Angemeldet')
    expect(html).toContain('Max Mustermann')
    expect(html).toContain('<span class="sr-only">, Konto und Sicherheit</span>')
    expect(html).toMatch(/lucide-chevron-right[^>]*aria-hidden="true"|aria-hidden="true"[^>]*lucide-chevron-right/)
  })

  it('Gegenprobe: ohne Ziel (Seitenleiste) bleibt die Zeile Anzeige', () => {
    const html = renderToStaticMarkup(createElement(PersonZeile, { name: 'Max Mustermann' }))
    expect(html).not.toContain('<a ')
    expect(html).toContain('Angemeldet')
  })

  it('in der HofShell trägt nur das Mehr-Blatt das Ziel', () => {
    const shell = quelle('src/components/shells/hof-shell.tsx')
    const mehr = shell.slice(shell.indexOf('<SheetTitle className="font-heading text-2xl font-semibold">Mehr</SheetTitle>'))
    expect(mehr).toContain('<PersonZeile name={personName} konto={EINSTELLUNG_KONTO} onNavigate={schliessen} />')
    const leiste = shell.slice(shell.indexOf('<aside'), shell.indexOf('</aside>'))
    expect(leiste).toContain('<PersonZeile name={personName} />')
  })
})
