/**
 * Nr. 54 — alte Seiten ins neue Design und Admin am Handy.
 *
 * Beweist:
 *  - Jede umgezogene Seite trägt die Shell, die DESIGN_SYSTEM und Mockup für
 *    sie vorsehen: KundeShell (über KundeShellMitSitzung) für Bestellseite,
 *    Impressum, Konditionen, Problem melden und die beiden 404; die
 *    Fokus-Shell für die Bar-Bestätigung und die Passwort-Seiten. Mit
 *    Gegenprobe, dass die Suche anschlägt.
 *  - Der alte Kopf (KundenKopf) steht nur noch auf /datenschutz (Nr. 57).
 *  - Die Seiten mit Token in der Adresse bleiben aus dem Suchindex
 *    (Metadaten); die Header prüft tests/sicherheits-header.test.ts. Der
 *    Token von /reset-password steht im Formular nur an den erwarteten
 *    Stellen (mit Gegenprobe).
 *  - Die Befunde der Axe-Prüfung bleiben behoben: die grüne Marke der
 *    Bestellseite steht auf einer Karte, der Auge-Knopf der Passwortseite
 *    hat 44 px.
 *  - Die neuen reinen Helfer: mitgeschicktSatz (Problem melden),
 *    monatOhneJahr (Achse der Finanzen am Handy), bestellTon (Marke der
 *    Bestellseite = Marke in „Meine Bestellungen").
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { OrderStatus } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'

// Die Seiten binden Client-Formulare ein; für die Metadaten zählt nur der Export.
vi.mock('@/lib/auth-client', () => ({ authClient: {}, signIn: {}, signOut: vi.fn(), useSession: () => ({ data: null }) }))
vi.mock('@/lib/prisma', () => ({ prisma: { order: { findUnique: vi.fn() } } }))

import { metadata as resetMeta } from '@/app/(auth)/reset-password/page'
import { metadata as vergessenMeta } from '@/app/(auth)/forgot-password/page'
import { metadata as bestellungMeta } from '@/app/(public)/[farmSlug]/bestellung/[orderId]/page'
import { metadata as barMeta } from '@/app/(public)/[farmSlug]/bestaetigen/[token]/page'
import { metadata as problemMeta } from '@/app/(public)/problem-melden/page'
import { MELDUNG_TEXT_BEISPIEL, mitgeschicktSatz } from '@/lib/hof-hilfe'
import { monatKurz, monatOhneJahr } from '@/lib/finanzen'
import { bestellEintrag, bestellTon } from '@/lib/bestellungen-finden'
import { monatsschluessel } from '@/lib/servicegebuehr'

const WURZEL = process.cwd()
const lies = (datei: string): string => readFileSync(join(WURZEL, datei), 'utf8')

/** Wie oft ein Muster im Quelltext vorkommt. */
const anzahl = (text: string, muster: RegExp): number => text.match(new RegExp(muster.source, 'g'))?.length ?? 0

describe('Shell je Seite (Nr. 54)', () => {
  const KUNDE_SHELL = /<KundeShellMitSitzung>/
  const FOKUS_SHELL = /<KundeFokusShell\b/

  it.each([
    // Gültiger Link und ruhige Seite bei falscher Signatur — beide in derselben Shell.
    ['src/app/(public)/[farmSlug]/bestellung/[orderId]/page.tsx', 2],
    ['src/app/(public)/impressum/page.tsx', 1],
    ['src/app/(public)/konditionen/page.tsx', 1],
    ['src/app/(public)/problem-melden/page.tsx', 1],
    ['src/app/not-found.tsx', 1],
    ['src/app/(public)/[farmSlug]/not-found.tsx', 1],
  ])('%s steht in der KundeShell mit Unterleiste', (datei, mal) => {
    const text = lies(datei)
    expect(anzahl(text, KUNDE_SHELL)).toBe(mal)
    // Keine Fokus-Seite: Die Unterleiste bleibt (DESIGN_SYSTEM „Fokus-Seiten ohne Unterleiste").
    expect(text).not.toMatch(/unterleiste=\{false\}/)
    expect(text).not.toMatch(/<KundenKopf\b/)
  })

  it.each([
    // Offen, verfallen/storniert (Rahmen) und ungültiger Token.
    ['src/app/(public)/[farmSlug]/bestaetigen/[token]/page.tsx', 2],
    ['src/app/(auth)/forgot-password/page.tsx', 1],
    ['src/app/(auth)/reset-password/page.tsx', 1],
  ])('%s steht in der Fokus-Shell', (datei, mal) => {
    const text = lies(datei)
    expect(anzahl(text, FOKUS_SHELL)).toBe(mal)
    expect(text).not.toMatch(/<KundenKopf\b/)
  })

  it('die Passwort-Seiten führen zurück zur Anmeldung — nie durch den Verlauf', () => {
    for (const datei of ['src/app/(auth)/forgot-password/page.tsx', 'src/app/(auth)/reset-password/page.tsx']) {
      expect(lies(datei), datei).toMatch(/zurueck=\{\{ href: '\/login', label: 'Zurück zur Anmeldung' \}\}/)
    }
  })

  it('die Bar-Bestätigung führt zurück zum Hof bzw. ohne gültigen Token zu den Höfen', () => {
    const text = lies('src/app/(public)/[farmSlug]/bestaetigen/[token]/page.tsx')
    expect(text).toMatch(/zurueck=\{\{ href: `\/\$\{hofSlug\}`/)
    expect(text).toMatch(/zurueck=\{\{ href: '\/hoefe'/)
    expect(text).not.toMatch(/router\.back|history\.back/)
  })

  it('Gegenprobe: die Suchmuster schlagen an', () => {
    expect(KUNDE_SHELL.test('<KundeShellMitSitzung>')).toBe(true)
    expect(FOKUS_SHELL.test('<KundeFokusShell titel="x"')).toBe(true)
    expect(anzahl('<KundeShellMitSitzung> … <KundeShellMitSitzung>', KUNDE_SHELL)).toBe(2)
  })
})

describe('Der alte Kopf — nur noch auf /datenschutz (zieht mit Nr. 57 um)', () => {
  /** Alle Dateien unter src/app, die KundenKopf rendern. */
  function kopfNutzer(): string[] {
    const ergebnis: string[] = []
    const lauf = (ordner: string): void => {
      for (const name of readdirSync(ordner)) {
        const pfad = join(ordner, name)
        if (statSync(pfad).isDirectory()) lauf(pfad)
        else if (/\.tsx$/.test(name) && /<KundenKopf\b/.test(readFileSync(pfad, 'utf8'))) {
          ergebnis.push(relative(WURZEL, pfad).split('\\').join('/'))
        }
      }
    }
    lauf(join(WURZEL, 'src/app'))
    return ergebnis.sort()
  }

  it('rendert KundenKopf nirgends sonst — die Suche findet den Datenschutz (Gegenprobe)', () => {
    expect(kopfNutzer()).toEqual(['src/app/(public)/datenschutz/page.tsx'])
  })
})

describe('Seiten mit Token in der Adresse bleiben aus dem Suchindex (Metadaten)', () => {
  it('/reset-password: noindex wie /verify (Nr. 54, neu)', () => {
    expect(resetMeta.robots).toEqual({ index: false, follow: false })
  })

  it('/{hof}/bestellung/{id}?s=…: noindex wie bisher', () => {
    expect(bestellungMeta.robots).toEqual({ index: false, follow: false })
  })

  it('/{hof}/bestaetigen/{token}: noindex und kein Referrer wie bisher', () => {
    expect(barMeta.robots).toEqual({ index: false, follow: false })
    expect(barMeta.referrer).toBe('no-referrer')
  })

  it('/problem-melden bleibt noindex; /forgot-password trägt keinen Token und hat nur einen Titel', () => {
    expect(problemMeta.robots).toEqual({ index: false, follow: false })
    expect(vergessenMeta.title).toBe('Passwort vergessen — FarmerZone')
    expect(vergessenMeta.robots).toBeUndefined()
  })

})

describe('/reset-password — der Token steht nur an den erwarteten Stellen', () => {
  const FORMULAR = 'src/app/(auth)/reset-password/neues-passwort-formular.tsx'

  /** Die Codezeilen mit einem Treffer — ohne Kommentare, Leerraum vereinheitlicht. */
  function zeilenMit(quelltext: string, muster: RegExp): string[] {
    return quelltext
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
      .split('\n')
      .filter((zeile) => muster.test(zeile))
      .map((zeile) => zeile.trim().replace(/\s+/g, ' '))
  }

  /** Gelesen aus der Adresse, geprüft, an Better Auth — sonst nirgends. */
  const TOKEN_ZEILEN = [
    "const token = searchParams.get('token')",
    'const linkUngueltig = !token || !!errorParam',
    'if (!canSubmit || !token) return',
    'const { error } = await authClient.resetPassword({ newPassword: password, token })',
  ]
  /** Die Adresse selbst geht nirgends hin — sonst trüge sie den Token mit. */
  const ADRESS_ZEILEN = [
    'const searchParams = useSearchParams()',
    "const token = searchParams.get('token')",
    "const errorParam = searchParams.get('error')",
  ]

  it('im Formular genau diese Zeilen — kein Link, kein fetch, kein router.push, kein Log mit dem Token', () => {
    const formular = lies(FORMULAR)
    expect(zeilenMit(formular, /\btoken\b/)).toEqual(TOKEN_ZEILEN)
    expect(zeilenMit(formular, /\bsearchParams\b/)).toEqual(ADRESS_ZEILEN)
    expect(formular).not.toMatch(/window\.location|document\.URL|location\.href|console\.|Sentry/)
  })

  it('die Seite fasst ihn nicht an', () => {
    expect(zeilenMit(lies('src/app/(auth)/reset-password/page.tsx'), /\btoken\b|searchParams/)).toEqual([])
  })

  it('Gegenprobe: jede weitere Verwendung fiele auf', () => {
    const formular = lies(FORMULAR)
    for (const zusatz of [
      "router.push('/login?token=' + token)",
      "void fetch('/api/x', { method: 'POST', body: token })",
      "<Link href={'/x?t=' + token}>x</Link>",
      'const t = token',
    ]) {
      expect(zeilenMit(`${formular}\n${zusatz}`, /\btoken\b/), zusatz).not.toEqual(TOKEN_ZEILEN)
    }
    const adressLink = "<Link href={'/x?' + searchParams.toString()}>x</Link>"
    expect(zeilenMit(`${formular}\n${adressLink}`, /\bsearchParams\b/)).not.toEqual(ADRESS_ZEILEN)
    // Kommentare zählen nicht: Der Kopfkommentar nennt „?token=", die Suche übergeht ihn.
    expect(formular).toMatch(/\?token=/)
  })
})

describe('Kontrast und Touch-Ziele (Befunde der Axe-Prüfung)', () => {
  it('die grüne Marke der Bestellseite steht auf der Kopf-Karte, nicht auf dem hellen Seitengrund', () => {
    const text = lies('src/app/(public)/[farmSlug]/bestellung/[orderId]/page.tsx')
    const karte = text.indexOf("<div className={cn(KARTE, 'flex flex-col gap-2')}>")
    const marke = text.indexOf('<StatusBadge')
    const abholung = text.indexOf('abholung-titel')
    expect(karte).toBeGreaterThan(-1)
    // Die Marke steht im Kopf — nach dem Öffnen der Karte, vor der Karte „Abholung".
    expect(marke).toBeGreaterThan(karte)
    expect(marke).toBeLessThan(abholung)
  })

  it('der Auge-Knopf der Passwortseite ist 44 px groß, benannt und meldet seinen Zustand', () => {
    const text = lies('src/app/(auth)/reset-password/neues-passwort-formular.tsx')
    // Nicht das gemeinsame PasswordInput (Knopf 16 px).
    expect(text).not.toMatch(/from '@\/components\/ui\/password-input'/)
    expect(text).toMatch(/flex size-11 items-center justify-center/)
    expect(text).toMatch(/aria-pressed=\{sichtbar\}/)
    expect(text).toMatch(/aria-label=\{sichtbar \? 'Passwort verbergen' : 'Passwort anzeigen'\}/)
    expect(anzahl(text, /<PasswortFeld\b/)).toBe(2)
  })
})

describe('Ladeansicht der Bestellseite — dieselben Karten wie die Seite', () => {
  const SEITE = 'src/app/(public)/[farmSlug]/bestellung/[orderId]/page.tsx'
  const LADEN = 'src/app/(public)/[farmSlug]/bestellung/[orderId]/loading.tsx'
  /** Der Kopf der Seite ist seit dem Axe-Befund eine Karte (b98c13a). */
  const KOPF_KARTE = "className={cn(KARTE, 'flex flex-col gap-2')}"

  it('der Kopf steht im Skeleton als dieselbe Karte wie auf der Seite — beim Umschalten springt nichts', () => {
    const seite = lies(SEITE)
    const laden = lies(LADEN)
    expect(seite).toContain(KOPF_KARTE)
    // Die erste Karte der Ladeansicht ist der Kopf, vor „Abholung".
    expect(laden.indexOf(KOPF_KARTE)).toBeGreaterThan(-1)
    expect(laden.indexOf(KOPF_KARTE)).toBeLessThan(laden.indexOf('{/* Abholung */}'))
  })

  it('alle drei Karten nehmen die Klasse der Seite, nicht eine Abschrift', () => {
    const laden = lies(LADEN)
    expect(laden).toMatch(/import \{ KARTE \} from '@\/components\/bestaetigung\/bestaetigung-teile'/)
    expect(anzahl(laden, /cn\(KARTE, /)).toBe(3)
    expect(laden).not.toMatch(/rounded-2xl border border-border bg-card/)
  })
})

describe('Problem melden — das Beispiel im Textfeld kommt aus dem Mockup', () => {
  it('bei „Fehler" der Wortlaut des Mockups, bei Wunsch und Frage keins', () => {
    expect(MELDUNG_TEXT_BEISPIEL.FEHLER).toBe('Beim Bezahlen kam diese Seite …')
    expect(lies('docs/mockups/fehler-500-problem-melden-kunde.html')).toContain(MELDUNG_TEXT_BEISPIEL.FEHLER)
    expect(MELDUNG_TEXT_BEISPIEL.WUNSCH).toBeUndefined()
    expect(MELDUNG_TEXT_BEISPIEL.FRAGE).toBeUndefined()
  })

  it('das Textfeld nimmt das Beispiel der gewählten Art', () => {
    expect(lies('src/components/shared/meldung-form.tsx')).toMatch(/placeholder=\{MELDUNG_TEXT_BEISPIEL\[art\]\}/)
  })
})

describe('mitgeschicktSatz — was unter „Problem melden" automatisch mitgeht', () => {
  it('mit Fehlernummer, wie im Mockup', () => {
    expect(mitgeschicktSatz('7F3A-21C9', false)).toBe(
      'Mitgeschickt: Fehlernummer 7F3A-21C9, Seite und Gerät. Keine IP-Adresse, keine Cookies.'
    )
  })

  it('ohne Fehlernummer — leer oder nur Leerzeichen — fehlt sie', () => {
    expect(mitgeschicktSatz('', false)).toBe('Mitgeschickt: Seite und Gerät. Keine IP-Adresse, keine Cookies.')
    expect(mitgeschicktSatz('   ', false)).toBe('Mitgeschickt: Seite und Gerät. Keine IP-Adresse, keine Cookies.')
  })

  it('ein angemeldeter Hof: dazu „dein Hof"; die Nummer ohne Ränder', () => {
    expect(mitgeschicktSatz(' S71 ', true)).toBe(
      'Mitgeschickt: Fehlernummer S71, Seite, Gerät und dein Hof. Keine IP-Adresse, keine Cookies.'
    )
  })
})

describe('monatOhneJahr — die Achse der Finanzen am Handy', () => {
  const jahr = Array.from({ length: 12 }, (_, i) => monatsschluessel(2026, i + 1))

  it('nennt den Monat ohne Jahr, die lange Achse behält es', () => {
    expect(monatOhneJahr(monatsschluessel(2026, 9))).toMatch(/^Sep/)
    expect(monatOhneJahr(monatsschluessel(2026, 9))).not.toMatch(/26/)
    expect(monatKurz(monatsschluessel(2026, 9))).toMatch(/26/)
  })

  it('in zwölf Monaten ist jeder Name eindeutig — das Jahr fehlt ohne Verlust', () => {
    const namen = jahr.map(monatOhneJahr)
    expect(new Set(namen).size).toBe(12)
  })

  it('höchstens vier Zeichen — passt unter eine Säule bei zwölf Monaten in 390 px', () => {
    for (const name of jahr.map(monatOhneJahr)) expect(name.length, name).toBeLessThanOrEqual(4)
  })

  it('der Monat ist der Wiener, nicht der des Servers', () => {
    // Jänner: Die Monatsgrenze liegt in UTC am 31.12. um 23:00 — der Name bleibt „Jän".
    expect(monatOhneJahr(monatsschluessel(2026, 1))).toMatch(/^Jän/)
  })
})

describe('bestellTon — die Marke der Bestellseite ist die Marke der Liste', () => {
  const STATUS: OrderStatus[] = [
    'PENDING_CONFIRMATION',
    'PAID',
    'CONFIRMED',
    'IN_PREPARATION',
    'READY',
    'PICKED_UP',
    'CANCELLED',
    'NOT_PICKED_UP',
  ]

  it('orange, solange die Kundin etwas tun muss; grün, solange es läuft; sonst neutral', () => {
    expect(bestellTon('PENDING_CONFIRMATION')).toBe('offen')
    for (const s of ['PAID', 'CONFIRMED', 'IN_PREPARATION', 'READY'] as const) expect(bestellTon(s), s).toBe('fertig')
    for (const s of ['PICKED_UP', 'CANCELLED', 'NOT_PICKED_UP'] as const) expect(bestellTon(s), s).toBe('neutral')
  })

  it('„Meine Bestellungen" nimmt denselben Ton', () => {
    const jetzt = new Date('2026-10-10T08:00:00Z')
    for (const status of STATUS) {
      const eintrag = bestellEintrag(
        {
          id: 'o1',
          link: '/hof-test/bestellung/o1?s=x',
          hofName: 'Hof Test',
          bestellnummer: 'HT-1',
          status,
          paymentMethod: 'ONLINE',
          paymentStatus: 'PAID',
          pickupDate: new Date('2026-10-11T10:00:00Z'),
          pickupTimeStart: '15:00',
          pickupTimeEnd: '18:00',
          createdAt: new Date('2026-10-09T08:00:00Z'),
          gesamtCents: 1000,
          artikel: 1,
        },
        jetzt,
        true
      )
      expect(eintrag.ton, status).toBe(bestellTon(status))
    }
  })
})
