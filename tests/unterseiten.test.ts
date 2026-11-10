/**
 * Unterseiten im Hofbereich: Rückweg und Speichern (Nachtlauf Nr. 44, Register N1, freigabe.md §12).
 *
 * Beweist:
 *  - Jede Unterseite trägt den Werkzeug-Kopf (ui/werkzeug-kopf.tsx, G1); Name und Ziel des
 *    Rückwegs kommen aus elternseite(). /fehler-melden hat genau eine h1, die im Kopf.
 *  - Die alten Bausteine (EinstellungenKopf, ZurueckZuEinstellungen,
 *    ZurueckLink) gibt es nicht mehr, keine Datei bindet sie ein.
 *  - Speichern: auf Einstellungs-Unterseiten Toast „Gespeichert" und zurück
 *    zur Übersicht, nur nach Erfolg; Abholzeiten bleibt; derselbe Baustein im
 *    Hofseiten-Editor behält seine Meldung. Mein Auftritt verlässt die Seite
 *    nicht, solange ein Foto hochlädt; das Hof-Profil nicht, solange die
 *    Ortssuche läuft (Nachbesserung Runde 1). Ein Fehler des Hof-Profils
 *    steht im Formular, auch eine gescheiterte Anfrage (Runde 2).
 *  - Tab-Titel und Seitentitel der Unterseiten haben eine Schreibweise.
 *  - Hof-Profil: „Mein Hof › Hofseite" ist ein Link.
 *  - Mehr-Blatt: die Person ist ein Link auf „Konto und Sicherheit" (Name, Ziel als Unterzeile).
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
  ladeProfilStand: vi.fn(),
  sucheHofStandort: vi.fn(),
  holeAdresseZumPunkt: vi.fn(),
}))
// Das Hof-Profil speichert seit Nr. 50 Runde 1 über den Speicherweg der Abschnitte (abschnitt-speichern.ts).
vi.mock('@/server/actions/appearance', () => ({ saveAppearanceAction: vi.fn() }))
vi.mock('@/lib/auth-client', () => ({ signOut: vi.fn() }))

import { useNachSpeichern } from '@/components/hof-einstellungen/use-nach-speichern'
import { ProfileForm } from '@/components/settings/profile-form'
import { PersonZeile } from '@/components/shells/hof-shell'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { PROBLEM_MELDEN } from '@/lib/fehlerseite'
import { EINSTELLUNG_KONTO, GESPEICHERT_TEXT, elternseite } from '@/lib/bauern-navigation'
import type { FarmSettings } from '@/server/queries/farm'

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

beforeEach(() => {
  vi.clearAllMocks()
  navigation.pfad = '/settings/profile'
})

// ─── Der Kopf der Unterseiten ───────────────────────────────────────────────

describe('Der Kopf der Unterseiten', () => {
  it('/fehler-melden: seit Nr. 251 der Werkzeug-Kopf (G1) — die h1 steht in der Leiste, keine zweite h1 (Nr. 56 entfällt)', () => {
    const seite = quelle('src/app/(hof)/fehler-melden/page.tsx')
    expect(seite).toContain('<WerkzeugKopf titel={PROBLEM_MELDEN}')
    expect(seite).not.toMatch(/<h1\b/)
    expect(seite).not.toContain('UnterseitenKopf')
    expect(PROBLEM_MELDEN).toBe(elternseite('/fehler-melden')?.name)
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

  // /settings/appearance leitet seit Nr. 50 nur noch um (Mein Hof) — dort wird nichts mehr gespeichert.
  it.each(['profile', 'pause', 'account'])('/settings/%s: Toast „Gespeichert", dann /settings', (seite) => {
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
    ['src/components/settings/profile-form.tsx', 'onSubmit', /if \(satz\)/],
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

  // Was das Hof-Profil beim Speichern schickt (nur Geändertes, über speichereProfil), prüft seit Nr. 65
  // tests/hof-profil-absenden.test.ts mit echtem Absenden statt mit Textvergleichen.

  it('der Fehlerweg kehrt vorher zurück bzw. steht im anderen Zweig — kein Sprung bei einem Fehler', () => {
    const profil = rumpf(quelle('src/components/settings/profile-form.tsx'), 'onSubmit')
    expect(profil).toMatch(/if \(satz\) \{\s*setSpeicherFehler\(satz\)\s*return\s*\}\s*nachSpeichern\(/)
    const passwort = rumpf(quelle('src/app/(hof)/settings/account/password-form.tsx'), 'handleSubmit')
    expect(passwort).toMatch(/if \(error\) \{[\s\S]*?return\s*\}[\s\S]*nachSpeichern\(/)
  })

  it('Hof-Profil: ein Fehler steht im Formular über dem Knopf, die Eingabe bleibt — auch eine gescheiterte Anfrage', () => {
    const text = quelle('src/components/settings/profile-form.tsx')
    const profil = rumpf(text, 'onSubmit')
    // Nie geworfen (die Fehlergrenze nähme die Eingabe mit), nie als Toast.
    expect(profil).toContain('speichernOhneWurf(')
    expect(profil).not.toContain('toast.error(')
    // Ein neuer Versuch räumt den alten Satz weg.
    expect(profil).toMatch(/if \(sucheLaeuft\) return\s*setSpeicherFehler\(null\)/)
    // Seit Nr. 174 die Hinweiskarte mit „Nochmal" am Netz (SpeicherFehler) statt DialogFehler.
    // Seit Nr. 250 steht der Knopf in der festen Aktionsleiste (G2), weiter direkt nach dem Fehlerkasten; seit Nr. 278
    // ist er eine Konstante (`speichernKnopf`), die im Web unter der rechten Spalte und am Handy in der Leiste steht.
    expect(text).toMatch(/<SpeicherFehler text=\{speicherFehler\}[^>]*\/>\s*\{\/\*[^*]*\*\/\}\s*<FesteAktionsleiste[^>]*>\{speichernKnopf\}/)
    expect(text).toMatch(/const speichernKnopf = \(\s*<button type="submit"/)
    // Ohne Fehler steht nichts da.
    expect(renderToStaticMarkup(createElement(ProfileForm, { farm: HOF }))).not.toContain('role="alert"')
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

  it('Mein Hof (früher Mein Auftritt): Blatt und Zeile bleiben offen, solange ein Foto hochlädt (der Upload ginge beim Schließen verloren)', () => {
    // Seit Nr. 50 speichert jedes Bild sofort; geschlossen würde nur das Datei-Feld aushängen (CODING_STANDARDS §8).
    const inhalt = quelle('src/components/mein-hof/abschnitt-inhalt.tsx')
    for (const baustein of ['TitelbildBaustein', 'LogoUpload', 'GallerySection']) {
      expect(inhalt, baustein).toMatch(new RegExp(`<${baustein}[^>]*onHochladen=\\{onHochladen\\}`))
    }
    const liste = quelle('src/components/mein-hof/abschnitte-liste.tsx')
    expect(liste).toMatch(/if \(!auf && !hochladenJetzt\.current\) setzeOffen\(null\)/)
    expect(liste).toMatch(/<SheetClose\s+disabled=\{hochladen\}/)
    expect(liste).toContain("{hochladen ? 'Foto lädt noch …' : 'Schließen'}")
    expect(quelle('src/components/farmer/hofseite-editor.tsx')).toMatch(/if \(hochladen\) return/)
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
  }, 30_000)

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
    ['/settings/teilen', 'src/app/(hof)/settings/teilen/page.tsx'],
    ['/settings/konditionen', 'src/components/hof-einstellungen/konditionen-ansicht.tsx'],
    ['/customers/[kundeId]', 'src/components/hof-kunden/kunden-detail.tsx'],
    ['/orders/[orderId]', 'src/components/hof-bestellungen/bestell-detail.tsx'],
    ['/status/new', 'src/app/(hof)/status/new/page.tsx'],
    ['/status/[id]/send-whatsapp', 'src/app/(hof)/status/[id]/send-whatsapp/page.tsx'],
    ['/status/plakat', 'src/app/(hof)/status/plakat/page.tsx'],
    ['/fehler-melden', 'src/app/(hof)/fehler-melden/page.tsx'],
  ]

  // Seit 26.1 (Lauf 33) gibt es nur noch den Werkzeug-Kopf (G1, ui/werkzeug-kopf.tsx) — er liest den Pfad
  // selbst, die Seite schreibt kein Ziel; dass niemand den alten Kopf zurückholt, prüft tests/werkzeug-kopf-wache.test.ts.
  it.each(MIT_KOPF)('%s trägt den Werkzeug-Kopf', (_route, datei) => {
    const text = quelle(datei)
    expect(text).toContain("from '@/components/ui/werkzeug-kopf'")
    expect(text).toContain('<WerkzeugKopf')
  })

  it('die eigenen Rückwege von Kunden- und Bestelldetail sind weg (eine Schreibweise)', () => {
    expect(quelle('src/components/hof-kunden/kunden-detail.tsx')).not.toContain('Alle Kunden')
    expect(quelle('src/components/hof-bestellungen/bestell-detail.tsx')).not.toContain('Zurück zu den Bestellungen')
    expect(quelle('src/app/(hof)/fehler-melden/page.tsx')).not.toContain('Meine Meldungen')
  })

  it('der Kopf steht direkt im Rahmen der Seite — sonst klebt die Leiste nur, solange ein Kasten um den Kopf reicht', () => {
    // Plakat: der Kopf darf nicht im druckfreien Kasten um Titel und Knopf stehen.
    // Seit Nr. 250 der Werkzeug-Kopf (G1) direkt im Rahmen; der Satz darunter ist selbst print:hidden.
    const plakat = quelle('src/app/(hof)/status/plakat/page.tsx')
    const rahmen = plakat.indexOf('print:m-0 print:max-w-none')
    expect(rahmen).toBeGreaterThan(-1)
    expect(plakat.indexOf('<WerkzeugKopf')).toBeGreaterThan(rahmen)
    expect(plakat).not.toContain('<div className="print:hidden">')
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

describe('Hof-Profil: „Mein Hof › Hofseite" ist ein Link (seit Nr. 50, vorher „Einstellungen → Mein Auftritt"; „›“ seit Nr. 278)', () => {
  it('führt nach Mein Hof, grün und 44 px hoch, mit sichtbarem Fokus', () => {
    const html = renderToStaticMarkup(createElement(ProfileForm, { farm: HOF }))
    const link = html.match(/<a href="\/farm-page" class="([^"]*)"[^>]*>([^<]*)<\/a>/)
    expect(link?.[2]).toBe('Mein Hof › Hofseite')
    const klassen = link?.[1].split(' ') ?? []
    for (const k of ['text-brand-text', 'py-3', ...FOKUS_RAHMEN.split(' ')]) expect(klassen, k).toContain(k)
    expect(html).not.toContain('/settings/appearance')
  })

  // Seit Nr. 224 heißt der Knopf „Hofdaten speichern“ (Register N42 c, V43/V49).
  it('ohne laufende Suche ist „Hofdaten speichern" frei', () => {
    const html = renderToStaticMarkup(createElement(ProfileForm, { farm: HOF }))
    const knopf = html.match(/<button[^>]*type="submit"[^>]*>([^<]*)<\/button>/)
    expect(knopf?.[1]).toBe('Hofdaten speichern')
    expect(knopf?.[0]).not.toMatch(/\sdisabled=/)
  })
})

describe('Tab-Titel und Seitentitel der Unterseiten', () => {
  // Zahlung bleibt außen vor (Nr. 42 ändert dort parallel, nur der Kopf ist getauscht);
  // Konditionen hat im Bestand zwei Wortlaute (Tab „Konditionen", h1 „Deine Konditionen").
  // /settings/appearance leitet seit Nr. 50 nur noch um — ohne eigenen Tab-Titel und Kopf.
  it.each(['profile', 'pickup-slots', 'pause', 'account', 'teilen'])('/settings/%s: der Tab nimmt dieselbe Schreibweise wie der Kopf', (seite) => {
    const text = quelle(`src/app/(hof)/settings/${seite}/page.tsx`)
    const tab = text.match(/title: `\$\{([A-Za-z_.]+)\} — \$\{MARKE\}`/)
    expect(tab, seite).not.toBeNull()
    const quelleDesTitels = tab?.[1] ?? ''
    expect(text, seite).toContain(`{${quelleDesTitels}}`)
  })
})

describe('Mehr-Blatt: die Person führt zu Konto und Sicherheit (seit Nr. 220: Name und Ziel als Unterzeile, Board s1-mehr-neu)', () => {
  it('ein Link (≥ 44 px, Fokus innen wie die Zeilen der Gruppe) mit Name und sichtbarem Ziel', () => {
    const html = renderToStaticMarkup(createElement(PersonZeile, { name: 'Max Mustermann', konto: EINSTELLUNG_KONTO }))
    expect(html).toMatch(/^<a href="\/settings\/account"/)
    const klassen = html.match(/^<a href="\/settings\/account" class="([^"]*)"/)?.[1].split(' ') ?? []
    for (const k of ['min-h-[60px]', ...FOKUS_RAHMEN_INNEN.split(' ')]) expect(klassen, k).toContain(k)
    expect(html).toContain('Max Mustermann')
    expect(html).toContain(`>${EINSTELLUNG_KONTO.label}</span>`)
    expect(html).toMatch(/lucide-chevron-right[^>]*aria-hidden="true"|aria-hidden="true"[^>]*lucide-chevron-right/)
  })

  it('Gegenprobe: ohne Namen steht „Dein Konto“, das Ziel bleibt', () => {
    const html = renderToStaticMarkup(createElement(PersonZeile, { name: '  ', konto: EINSTELLUNG_KONTO }))
    expect(html).toContain('Dein Konto')
    expect(html).toMatch(/^<a href="\/settings\/account"/)
  })

  it('in der HofShell steht die Person im Mehr-Blatt; die Seitenleiste zeigt „Konto · <Name>“ (V13)', () => {
    const shell = quelle('src/components/shells/hof-shell.tsx')
    const mehr = shell.slice(shell.indexOf('<SheetKopf titel={HOF_MEHR_TITEL}'))
    expect(mehr).toContain('<PersonZeile name={personName} konto={EINSTELLUNG_KONTO} onNavigate={schliessen} />')
    const leiste = shell.slice(shell.indexOf('<aside'), shell.indexOf('</aside>'))
    expect(leiste).toContain('<KontoZeile name={personName} />')
    expect(leiste).not.toContain('<PersonZeile')
  })
})
