/**
 * Nr. 54 — alte Seiten ins neue Design und Admin am Handy.
 *
 * Beweist:
 *  - Jede umgezogene Seite trägt die Shell, die DESIGN_SYSTEM und Mockup für
 *    sie vorsehen: KundeShell (über KundeShellMitSitzung) für Bestellseite,
 *    Impressum, Konditionen, Problem melden und die beiden 404; die
 *    Fokus-Shell für die Bar-Bestätigung und die Passwort-Seiten. Mit
 *    Gegenprobe, dass die Suche anschlägt.
 *  - Der alte Kopf (KundenKopf) ist entfernt (Nr. 181; /datenschutz war die letzte Seite).
 *  - Die Seiten mit Token in der Adresse bleiben aus dem Suchindex
 *    (Metadaten); die Header prüft tests/sicherheits-header.test.ts. Der
 *    Token von /reset-password steht im Formular nur an den erwarteten
 *    Stellen (mit Gegenprobe).
 *  - Die Befunde der Axe-Prüfung bleiben behoben: die grüne Marke der
 *    Bestellseite steht auf einer Karte, der Auge-Knopf der Passwortseite
 *    hat 44 px.
 *  - Die neuen reinen Helfer: mitgeschicktSatz (Problem melden),
 *    monatOhneJahr (Achse der Finanzen am Handy); die Marke der Bestellseite
 *    = die Marke in „Meine Bestellungen" (Art aus bestellStatusAnzeige, Nr. 85).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { OrderStatus } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import ts from 'typescript'
import { MARKE } from '@/lib/marke'

// Die Seiten binden Client-Formulare ein; für die Metadaten zählt nur der Export.
vi.mock('@/lib/auth-client', () => ({ authClient: {}, signIn: {}, signOut: vi.fn(), useSession: () => ({ data: null }) }))
vi.mock('@/lib/prisma', () => ({ prisma: { order: { findUnique: vi.fn() } } }))

import { metadata as resetMeta } from '@/app/(auth)/reset-password/page'
import { metadata as vergessenMeta } from '@/app/(auth)/forgot-password/page'
import { metadata as bestellungMeta } from '@/app/(public)/[farmSlug]/bestellung/[orderId]/page'
import { metadata as barMeta } from '@/app/(public)/[farmSlug]/bestaetigen/[token]/page'
import { metadata as problemMeta } from '@/app/(public)/problem-melden/page'
import { MELDUNG_TEXT_BEISPIEL, OHNE_IP_UND_COOKIES, mitgeschicktSatz } from '@/lib/hof-hilfe'
import { monatKurz, monatOhneJahr } from '@/lib/finanzen'
import { bestellEintrag } from '@/lib/bestellungen-finden'
import { bestellStatusAnzeige } from '@/lib/bestellstatus'
import type { MarkeArt } from '@/lib/marke-art'
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
    ['src/app/(public)/agb/page.tsx', 1],
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

describe('Der alte Kopf — nirgends mehr (zog mit Nr. 181 als Letzter um)', () => {
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

  it('rendert KundenKopf nirgends — die Suche findet ihn aber, wo er stünde (Gegenprobe)', () => {
    expect(kopfNutzer()).toEqual([])
    expect(/<KundenKopf\b/.test('<KundenKopf seite={{ art: \'x\' }} />')).toBe(true)
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
    expect(vergessenMeta.title).toBe(`Passwort vergessen — ${MARKE}`)
    expect(vergessenMeta.robots).toBeUndefined()
  })

})

describe('/reset-password — der Token steht nur an den erwarteten Stellen', () => {
  const FORMULAR = 'src/app/(auth)/reset-password/neues-passwort-formular.tsx'

  /**
   * Die Zeilen, in denen ein Bezeichner im Code steht — über den Syntaxbaum
   * von TypeScript: Kommentare zählen nicht, Strings und Template-Literale
   * bleiben Code. (Der frühere Filter mit regulären Ausdrücken hielt „//host"
   * in einer Adresse für den Anfang eines Kommentars.) Leerraum vereinheitlicht.
   */
  function zeilenMit(quelltext: string, name: string): string[] {
    const datei = ts.createSourceFile('formular.tsx', quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const zeilen = quelltext.split('\n')
    const treffer = new Set<number>()
    const besuche = (knoten: ts.Node): void => {
      if (ts.isIdentifier(knoten) && knoten.text === name) {
        treffer.add(datei.getLineAndCharacterOfPosition(knoten.getStart(datei)).line)
      }
      ts.forEachChild(knoten, besuche)
    }
    besuche(datei)
    return [...treffer].sort((a, b) => a - b).map((zeile) => zeilen[zeile].trim().replace(/\s+/g, ' '))
  }

  /** Wie oft eine Funktion dieses Namens aufgerufen wird — ebenfalls im Syntaxbaum. */
  function aufrufe(quelltext: string, name: string): number {
    const datei = ts.createSourceFile('formular.tsx', quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    let anzahl = 0
    const besuche = (knoten: ts.Node): void => {
      if (ts.isCallExpression(knoten) && ts.isIdentifier(knoten.expression) && knoten.expression.text === name) anzahl++
      ts.forEachChild(knoten, besuche)
    }
    besuche(datei)
    return anzahl
  }

  const PASSWORT_FORMULARE = [FORMULAR, 'src/app/(auth)/forgot-password/passwort-vergessen-formular.tsx']

  /** Gelesen aus der Adresse, geprüft, an Better Auth — sonst nirgends. */
  const TOKEN_ZEILEN = [
    "const token = searchParams.get('token')",
    'const linkUngueltig = !token || !!errorParam',
    'if (!canSubmit || !token) return',
    'const { error } = await authClient.resetPassword({ newPassword: password, token })',
  ]
  /**
   * Andere Wege an die Adresse samt Token: über das Dokument, über einen
   * berechneten Schlüssel oder über die Navigations-Messung. Der Syntaxbaum
   * fände `document.URL` nicht über den Namen `location`, darum hier im
   * Rohtext (strenger: auch ein Kommentar schlüge an).
   */
  const ADRESSE_UEBER_DAS_DOKUMENT =
    /\bdocument\s*\.\s*(?:URL|documentURI|baseURI|location)\b|\[\s*['"`]location['"`]\s*\]|getEntriesByType\s*\(\s*['"`]navigation['"`]/

  /** Die Adresse selbst geht nirgends hin — sonst trüge sie den Token mit. */
  const ADRESS_ZEILEN = [
    'const searchParams = useSearchParams()',
    "const token = searchParams.get('token')",
    "const errorParam = searchParams.get('error')",
  ]

  it('im Formular genau diese Zeilen — kein Link, kein fetch, kein router.push, kein Log mit dem Token', () => {
    const formular = lies(FORMULAR)
    expect(zeilenMit(formular, 'token')).toEqual(TOKEN_ZEILEN)
    expect(zeilenMit(formular, 'searchParams')).toEqual(ADRESS_ZEILEN)
    expect(formular).not.toMatch(/console\.|Sentry/)
  })

  it('die Seite fasst ihn nicht an', () => {
    const seite = lies('src/app/(auth)/reset-password/page.tsx')
    expect(zeilenMit(seite, 'token')).toEqual([])
    expect(zeilenMit(seite, 'searchParams')).toEqual([])
  })

  it('die Adresse wird genau einmal gelesen, ohne Umbenennung; weder `location` noch das Dokument (URL, documentURI, baseURI) in einem Passwort-Formular', () => {
    const formular = lies(FORMULAR)
    expect(aufrufe(formular, 'useSearchParams')).toBe(1)
    expect(zeilenMit(formular, 'useSearchParams')).toEqual([
      "import { useRouter, useSearchParams } from 'next/navigation'",
      'const searchParams = useSearchParams()',
    ])
    for (const datei of PASSWORT_FORMULARE) {
      expect(zeilenMit(lies(datei), 'location'), datei).toEqual([])
      expect(lies(datei), datei).not.toMatch(ADRESSE_UEBER_DAS_DOKUMENT)
    }
    // „Passwort vergessen" braucht die Adresse gar nicht.
    expect(aufrufe(lies(PASSWORT_FORMULARE[1]), 'useSearchParams')).toBe(0)
  })

  it('Gegenprobe: ein zweites Lesen der Adresse oder `location` fiele auf', () => {
    const formular = lies(FORMULAR)
    expect(aufrufe(`${formular}\nconst adresse = useSearchParams()`, 'useSearchParams')).toBe(2)
    const umbenannt = formular.replace('useRouter, useSearchParams }', 'useRouter, useSearchParams as adresse }')
    expect(zeilenMit(umbenannt, 'useSearchParams')).not.toContain("import { useRouter, useSearchParams } from 'next/navigation'")
    for (const zusatz of [
      "void fetch('/api/x?' + location.search)",
      "void fetch('//host' + document.location.search)",
      "window.location.href = '/x'",
    ]) {
      expect(zeilenMit(`${formular}\n${zusatz}`, 'location'), zusatz).not.toEqual([])
    }
    // Wege ohne den Namen `location` (Nachprüfung Runde 2: `document.URL` war aus der Prüfung gefallen).
    for (const zusatz of [
      "void fetch('//host/?u=' + encodeURIComponent(document.URL))",
      'void fetch(document.documentURI)',
      'void fetch(document.baseURI)',
      "void fetch(window['location'].href)",
      "void fetch(String(performance.getEntriesByType('navigation')[0]))",
    ]) {
      expect(`${formular}\n${zusatz}`, zusatz).toMatch(ADRESSE_UEBER_DAS_DOKUMENT)
    }
  })

  it('Gegenprobe: jede weitere Verwendung fiele auf — auch an einen fremden Host ohne Protokoll', () => {
    const formular = lies(FORMULAR)
    for (const zusatz of [
      "router.push('/login?token=' + token)",
      "void fetch('/api/x', { method: 'POST', body: token })",
      "<Link href={'/x?t=' + token}>x</Link>",
      'const t = token',
      // Protokoll-relative Adressen: „//" ist hier kein Kommentar.
      "router.push('//host/?t=' + token)",
      'void fetch(`//host?t=$' + '{token}`)',
      "<Link href={'//host?t=' + token}>x</Link>",
    ]) {
      expect(zeilenMit(`${formular}\n${zusatz}`, 'token'), zusatz).not.toEqual(TOKEN_ZEILEN)
    }
    const adressLink = "<Link href={'//host?' + searchParams.toString()}>x</Link>"
    expect(zeilenMit(`${formular}\n${adressLink}`, 'searchParams')).not.toEqual(ADRESS_ZEILEN)
    // Kommentare zählen nicht: Der Kopfkommentar nennt „?token=", die Suche übergeht ihn.
    expect(formular).toMatch(/\?token=/)
    expect(zeilenMit('// token im Kommentar\n/* token */\nconst x = 1', 'token')).toEqual([])
  })
})

describe('Kontrast und Touch-Ziele (Befunde der Axe-Prüfung)', () => {
  it('die grüne Marke der Bestellseite steht auf der Kopf-Karte, nicht auf dem hellen Seitengrund', () => {
    const text = lies('src/app/(public)/[farmSlug]/bestellung/[orderId]/page.tsx')
    const karte = text.indexOf("<div className={cn(KARTE, 'flex flex-col gap-2')}>")
    const marke = text.indexOf('<Marke art={status.art}')
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

  it('eine Quelle: beide Meldeformulare und der Briefkasten schreiben den Satz nicht selbst', () => {
    for (const datei of [
      'src/components/shared/meldung-form.tsx',
      'src/components/hof-hilfe/meldung-abgeben.tsx',
      'src/components/admin/briefkasten-teile.tsx',
    ]) {
      expect(lies(datei), datei).not.toMatch(/Keine IP-Adresse|automatisch mit\./)
    }
    expect(lies('src/components/shared/meldung-form.tsx')).toMatch(/mitgeschicktSatz\(kennung, alsHof\)/)
    // „Meldung abgeben" ist immer ein Hof — am Handy derselbe Satz, mit Fehlernummer, sobald eine dasteht.
    expect(lies('src/components/hof-hilfe/meldung-abgeben.tsx')).toMatch(/\{mitgeschicktSatz\(kennung, true\)\}/)
    expect(mitgeschicktSatz('', true)).toBe(`Mitgeschickt: Seite, Gerät und dein Hof. ${OHNE_IP_UND_COOKIES}`)
    expect(OHNE_IP_UND_COOKIES).toBe('Keine IP-Adresse, keine Cookies.')
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

  it('fester Wortlaut wie im übrigen Code — nicht Intl, dessen Kürzel je nach ICU-Stand schwanken', () => {
    expect(jahr.map(monatOhneJahr)).toEqual(['Jän', 'Feb', 'März', 'Apr', 'Mai', 'Juni', 'Juli', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'])
    const quelle = lies('src/lib/finanzen.ts')
    const rumpf = quelle.slice(quelle.indexOf('export function monatOhneJahr'), quelle.indexOf('export function monatOhneJahr') + 200)
    expect(rumpf).toContain('MONAT_KURZ[')
    expect(rumpf).not.toContain('toLocaleDateString')
  })
})

describe('Die Marke der Bestellseite ist die Marke der Liste (Art aus bestellStatusAnzeige, Register G5)', () => {
  /**
   * Feste Erwartung je Status — nicht bestellStatusAnzeige selbst: Liste und Seite rufen sie auf,
   * ein Vergleich damit bewiese nichts.
   */
  const ERWARTET: Record<OrderStatus, MarkeArt> = {
    PENDING_CONFIRMATION: 'tun',
    PAID: 'laeuft',
    CONFIRMED: 'laeuft',
    IN_PREPARATION: 'laeuft',
    READY: 'laeuft',
    PICKED_UP: 'erledigt',
    // Freigabe Lauf 13 (Nr. 85): storniert rot, nicht abgeholt erledigt — vorher beide grau.
    CANCELLED: 'abgebrochen',
    NOT_PICKED_UP: 'erledigt',
  }
  const STATUS = Object.keys(ERWARTET) as OrderStatus[]

  it('tun, solange die Kundin etwas tun muss; läuft, solange es läuft; storniert abgebrochen; sonst erledigt', () => {
    for (const status of STATUS) expect(bestellStatusAnzeige(status, '', 'ONLINE').art, status).toBe(ERWARTET[status])
  })

  it('„Meine Bestellungen" zeigt je Status dieselbe feste Art', () => {
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
      expect(eintrag.art, status).toBe(ERWARTET[status])
    }
  })

  it('die Bestellseite zeichnet die Art aus bestellStatusAnzeige mit dem Baustein Marke', () => {
    const seite = lies('src/app/(public)/[farmSlug]/bestellung/[orderId]/page.tsx')
    expect(seite).toMatch(/const status = bestellStatusAnzeige\(order\.status, /)
    expect(seite).toMatch(/<Marke art=\{status\.art\}>\{status\.marke\}<\/Marke>/)
  })
})
