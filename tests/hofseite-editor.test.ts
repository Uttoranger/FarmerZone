/**
 * Tests für den Hofseiten-Editor im Browser — am Quelltext, weil die
 * Node-Umgebung nichts rendert (TESTING_GUIDELINES §1).
 *
 * Beweist:
 *  - /farm-page zeigt unter lg die Liste „Bearbeiten" (seit Nr. 50, vorher
 *    die alte Hofseite mit Stiften) und ab lg den Editor — der Kopf steht nur
 *    einmal; beide nehmen dieselben Bausteine (AbschnittInhalt).
 *  - (Die zwei Fassungen des Kopfs prüft seit Nr. 22e tests/mein-hof-seite.test.ts
 *    am gerenderten seitenkopf.tsx; der Bestandskopf fiel mit /status weg.)
 *  - „Hofseite ansehen" in der Seitenleiste entfällt ab lg.
 *  - Die Bausteine speichern nur über die vorhandenen Aktionen aus farm.ts,
 *    appearance.ts und farm-photos.ts — über abschnitt-speichern.ts; keine
 *    zweite Speicherlogik.
 *  - Wache über ganz src/ (Nr. 65, Syntaxbaum von TypeScript):
 *    saveAppearanceAction nur aus speichereAuftritt, updateProfile nur aus
 *    speichereProfil (beide in abschnitt-speichern.ts) — auch nicht unter
 *    anderem Namen, über einen Namensraum, einen dynamischen Import oder aus
 *    der eigenen Aktionsdatei heraus. Gegenproben zeigen, dass jede Suche
 *    anschlägt.
 *  - Die Vorschau ist die echte Hofseite im Vorschau-Modus — Handy (390 px)
 *    oder Web (1440 px) in EINEM iframe, der Maßstab gerechnet, nie hart
 *    codiert; die Markierung geht nur an den eigenen Ursprung.
 *  - Web neben der Bearbeitung nur ab 1280 px Fensterbreite, darunter im
 *    Overlay; die Spaltenbreiten kommen aus EINER Regel (editorSpalten,
 *    Register N7; Breiten-Transition 200 ms); „Vergrößern" öffnet das Overlay
 *    mit Titel und Umschalter. (Die Breiten selbst: tests/hofseite-vorschau.test.ts,
 *    ihr Einbau im Editor: tests/hofseite-editor-breite.test.ts.)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { hofseiteStand } from '@/lib/hofseite-fortschritt'

const quelltext = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

describe('/farm-page', () => {
  const seite = quelltext('src/app/(hof)/farm-page/page.tsx')

  it('unter lg die Liste „Bearbeiten" (Nr. 50), ab lg der Editor — beide mit denselben Daten', () => {
    expect(seite).toMatch(
      /<div className="lg:hidden">[\s\S]*?<h1 className="sr-only">Hofseite bearbeiten<\/h1>\s*<AbschnitteListe fortschritt=\{fortschritt\} hof=\{hof\} einstellungen=\{einstellungen\} auftritt=\{auftritt\} aktuell=\{aktuell\} \/>/
    )
    // Die alte Hofseite mit Stiften und die Checkliste sind dort entfallen (Register N4).
    expect(seite).not.toMatch(/FarmPageClient|ChecklisteKompakt|FarmPageView/)
    expect(seite).toContain('<HofseiteEditor fortschritt={fortschritt} hof={hof} einstellungen={einstellungen} auftritt={auftritt} aktuell={aktuell} />')
    // Ab lg trägt der Editor-Block die H1 der Seite — nur für Screenreader; sichtbar ist der Hofname im Kopf.
    expect(seite).toMatch(/<div className="hidden px-8 pb-12 lg:block">[\s\S]*?<h1 className="sr-only">Hofseite bearbeiten<\/h1>\s*<HofseiteEditor/)
  })

  it('der Kopf steht genau einmal je Reiter', () => {
    // Zwei Zweige, die sich ausschließen: Beiträge kehrt vorher zurück.
    const beitraege = seite.slice(seite.indexOf("if (reiter === 'beitraege')"), seite.indexOf('const [kopf, zustand, einstellungen'))
    const hofseite = seite.slice(seite.indexOf('const [kopf, zustand, einstellungen'))
    expect(beitraege.match(/<MeinHofSeitenkopf [^>]*aktiv="beitraege"/g)).toHaveLength(1)
    expect(hofseite.match(/<MeinHofSeitenkopf /g)).toHaveLength(1)
    expect(hofseite).toMatch(/<MeinHofSeitenkopf [^>]*aktiv="hofseite"/)
    expect(beitraege).toMatch(/return \(/)
  })

  it('der Editor bekommt keinen ganzen Hof mit Date oder Decimal, nur seine Felder', () => {
    expect(seite).not.toMatch(/<HofseiteEditor[^>]*\shof=\{farm\}/)
    expect(seite).toContain('bannerFocusY: farm.bannerFocusY')
  })
})

describe('Seitenleiste', () => {
  it('„Hofseite ansehen" entfällt ab lg', () => {
    const karte = quelltext('src/components/farmer/farm-identity-card.tsx')
    expect(karte).toMatch(/href="\/farm-page"\s*className="[^"]*\blg:hidden\b/)
  })
})

describe('Editor und Bausteine', () => {
  const editor = quelltext('src/components/farmer/hofseite-editor.tsx')
  const liste = quelltext('src/components/mein-hof/abschnitte-liste.tsx')
  const formulare = quelltext('src/components/mein-hof/abschnitt-formulare.tsx')
  const speichern = quelltext('src/components/mein-hof/abschnitt-speichern.ts')
  const BAUSTEINE = [
    'src/components/farmer/hofseite-editor.tsx',
    'src/components/mein-hof/abschnitte-liste.tsx',
    'src/components/mein-hof/abschnitt-inhalt.tsx',
    'src/components/mein-hof/abschnitt-formulare.tsx',
    'src/components/mein-hof/bild-bausteine.tsx',
    'src/components/mein-hof/abschnitt-speichern.ts',
  ]

  it('Editor ab lg und Blatt unter lg öffnen denselben Baustein je Zeile', () => {
    expect(editor).toMatch(/<AbschnittInhalt[\s\S]*?darstellung="zeile"/)
    expect(liste).toMatch(/<AbschnittInhalt[\s\S]*?darstellung="blatt"/)
    for (const text of [editor, liste]) expect(text).toContain("from '@/components/mein-hof/abschnitt-inhalt'")
  })

  it('speichert nur über die vorhandenen Aktionen — keine neue Aktion, keine zweite Speicherlogik', () => {
    const aktionen = new Set(BAUSTEINE.flatMap((pfad) => [...quelltext(pfad).matchAll(/from '@\/server\/actions\/([a-z-]+)'/g)].map((m) => m[1])))
    // bild-ausschnitt: der Ausschnitt des Titelbilds seit Nr. 97 (Register N13/N17) — eine eigene, freigegebene Aktion.
    expect([...aktionen].toSorted()).toEqual(['appearance', 'bild-ausschnitt', 'farm', 'farm-photos'])
    // Editor und Liste selbst rufen keine Aktion.
    for (const text of [editor, liste]) expect(text).not.toMatch(/from '@\/server\/actions\//)
    // Auftritt und Profil speichert NUR abschnitt-speichern.ts — die Formulare gehen über speichereAuftritt/speichereProfil
    // (die Wache über ganz src/ steht unten: „saveAppearanceAction und updateProfile nur aus abschnitt-speichern.ts").
    expect(formulare.match(/speichereAuftritt\(/g)?.length).toBeGreaterThanOrEqual(4)
    expect(formulare.match(/speichereProfil\(/g)?.length).toBe(3)
  })

  it('der Auftritt schickt nur seinen Teil (Nr. 65); das Profil liest vorher den frischen Stand und ändert nur sein Feld', () => {
    expect(speichern).toContain('return nacheinander(() => saveAppearanceAction(bereiteAuftrittVor(teil)))')
    // Gegenprobe: Der Auftritt liest keinen Stand mehr, um fremde Felder mitzuschreiben.
    expect(speichern).not.toMatch(/ladeAuftrittStand|auftrittMitTeil/)
    expect(speichern).toMatch(/const frisch = await ladeProfilStand\(\)[\s\S]*?updateProfile\(profilMitTeil\(frisch\.profil, teil\)\)/)
    // Nacheinander, nie verschränkt (tests/integration/auftritt-abschnitte.int.test.ts prüft den Zustand).
    expect(speichern.match(/return nacheinander\(/g)).toHaveLength(2)
  })

  it('Adress-Formular: die Adresse als Ganzes, nach geänderter Straße „Standort auf der Karte prüfen" (Nr. 65, Register N4)', () => {
    const adresse = formulare.slice(formulare.indexOf('export function AdresseForm'), formulare.indexOf('type KontaktDaten'))
    // Land und Kartenpunkt vom Laden gehen mit (bereiteAdresseVor, tests/abschnitt-stand.test.ts) ...
    expect(adresse).toContain('speichereProfil(bereiteAdresseVor(einstellungen, daten))')
    // ... und der Hinweis hängt an der einen Regel, Text und Ziel aus einer Quelle.
    expect(adresse).toContain('brauchtKartenpruefung(einstellungen, strasse)')
    expect(adresse).toContain('KARTENPUNKT_PRUEFEN.text')
    expect(adresse).toContain('href={KARTENPUNKT_PRUEFEN.href}')
    // Gegenprobe: nur Straße, PLZ und Ort direkt an speichereProfil (bis Nr. 65) steht nicht mehr da.
    expect(adresse).not.toContain('speichereProfil(daten)')
    expect(adresse).not.toContain('href="/settings/profile"')
  })

  it('schickt Logo und Titelbild nicht mit — die haben eigene Aktionen', () => {
    const stand = quelltext('src/lib/abschnitt-stand.ts')
    const teil = stand.slice(stand.indexOf('export function bereiteAuftrittVor'), stand.indexOf('export type ProfilQuelle'))
    expect(teil).toContain('anfrage.tagline')
    expect(teil).not.toMatch(/bannerType|bannerUrl|bannerValue|logoUrl/)
  })

  it('prüft die Felder mit den Schemas der Aktionen selbst, nicht mit einer Abschrift', () => {
    expect(formulare).toContain("from '@/schemas/hofprofil'")
    expect(formulare).toContain("from '@/schemas/auftritt'")
    // Name und Kontakt haben Obergrenzen — dort das Bearbeiten-Schema mit dem
    // gezeigten Stand, damit ein zu langer Altwert das Speichern nicht sperrt.
    expect(formulare.match(/profileSchema\.pick\(/g)).toHaveLength(1)
    expect(formulare.match(/profilBearbeitenSchema\(bestandVon\(einstellungen\)\)\.pick\(/g)).toHaveLength(2)
    expect(formulare).toContain('appearanceSchema.pick({ aboutText: true })')
    expect(formulare).toContain('appearanceSchema.pick({ farmValues: true })')
    expect(formulare).toContain('zodResolver(leitspruchFormularSchema)')
    expect(formulare).not.toMatch(/z\.object\(/)
  })

  it('nur eine Zeile offen zugleich, und die geht an die Vorschau', () => {
    expect(editor).toContain('setOffen((jetzt) => (jetzt === id ? null : id))')
    expect(editor).toMatch(/<HofseiteVorschauRahmen\s+slug=\{hof\.slug\}\s+stand=\{stand\}\s+markiert=\{offen\}/)
  })

  it('solange ein Foto hochlädt, bleiben Zeile und Blatt offen (CODING_STANDARDS §8)', () => {
    expect(editor).toMatch(/function umschalten\(id: HofseiteZeileId\) \{\s*if \(hochladen\) return/)
    expect(liste).toMatch(/if \(!auf && !hochladenJetzt\.current\) setzeOffen\(null\)/)
  })

  it('Web neben der Bearbeitung nur ab der Mindestbreite; die Spaltenbreiten kommen aus der einen Regel, nicht aus einer Rechnung im Editor', () => {
    expect(editor).toContain('useMindestbreite(VORSCHAU_WEB_MINDESTBREITE)')
    expect(editor).toContain("const webInline = geraet === 'web' && breit")
    expect(editor).toContain("editorSpalten(gemessen, webInline ? 'web' : 'handy', breit)")
    expect(editor).not.toContain('calc(100%')
    expect(editor).not.toContain('VORSCHAU_BEARBEITUNG_BREITE')
    expect(editor).toContain('webInlineMoeglich={breit}')
    // Der Server kennt die Fensterbreite nicht: der Hook liefert dort false, sonst spränge die Seite beim Hydrieren.
    const hook = quelltext('src/lib/use-mindestbreite.ts')
    expect(hook).toContain('useSyncExternalStore(anmelden, lesen, () => false)')
  })
})

describe('Vorschau-Rahmen', () => {
  const rahmen = quelltext('src/components/farmer/hofseite-vorschau-rahmen.tsx')

  it('Breite aus VORSCHAU_SEITENBREITE, Maßstab gemessen und gerechnet, nie hart codiert', () => {
    expect(rahmen).not.toMatch(/SEITEN_BREITE = 390/)
    expect(rahmen).toContain('VORSCHAU_SEITENBREITE[geraet]')
    expect(rahmen).toContain("vorschauMassstab({ breite: panelBreite }, 'web')")
    expect(rahmen).not.toMatch(/scale\(0\.\d+\)/)
    // Gemessen über den Hook in src/lib (seit Nr. 75), der den ResizeObserver hält.
    expect(rahmen).toContain('useElementGroesse()')
    expect(readFileSync(join(process.cwd(), 'src', 'lib', 'use-element-groesse.ts'), 'utf8')).toContain('new ResizeObserver(')
  })

  it('der Umschalter ist Gerät, nicht Tab: gedrückte Knöpfe; Web ohne Platz daneben geht ins Overlay', () => {
    expect(rahmen).toContain('aria-pressed={wert === id}')
    expect(rahmen).toMatch(/if \(g === 'web' && !webInlineMoeglich\) \{\s*oeffneOverlay\('web'\)/)
  })

  it('das Overlay hat Titel und Beschreibung und gibt den Fokus an sein öffnendes Element zurück', () => {
    expect(rahmen).toContain('<DialogTitle')
    expect(rahmen).toContain('<DialogDescription')
    expect(rahmen).toContain('aria-label="Vorschau schließen"')
    expect(rahmen).toContain('finalFocus={ausloeser}')
    expect(rahmen).toContain('ausloeser.current = document.activeElement instanceof HTMLElement ? document.activeElement : null')
  })

  // Die Markierung geht seit Nr. 49 über EINEN Hook — für diesen Rahmen und „So sieht’s die Kundin" unter lg.
  const markierung = quelltext('src/components/farmer/use-vorschau-markierung.ts')
  // Die Kundenansicht von Mein Hof (seit Nr. 107 als Vollbild) trägt den zweiten Rahmen.
  const kundin = quelltext('src/components/mein-hof/kundenansicht-vollbild.tsx')

  it('der erste Stand im src, jeder weitere per location.replace; die Markierung nur an den eigenen Ursprung', () => {
    // Sonst legte jedes Speichern einen Eintrag im Browserverlauf an.
    expect(rahmen).toMatch(/src=\{vorschauAdresse\(slug, anfang\)\}/)
    expect(rahmen).toContain('location.replace(vorschauAdresse(slug, stand))')
    expect(markierung.match(/postMessage\([^)]*window\.location\.origin\)/g)).toHaveLength(1)
    for (const text of [rahmen, markierung, kundin]) expect(text).not.toMatch(/postMessage\([^)]*'\*'/)
    // Beide Rahmen nehmen den Hook, keiner schickt selbst.
    for (const text of [rahmen, kundin]) {
      expect(text).toContain('useVorschauMarkierung(rahmen, markiert)')
      expect(text).not.toContain('postMessage(')
    }
  })

  it('schickt die Markierung nach dem Laden noch einmal — auf die Bereit-Meldung der eigenen Seite, nicht auf onLoad', () => {
    for (const text of [rahmen, kundin]) expect(text).not.toContain('onLoad=')
    expect(markierung).toContain('leseBereit(ereignis, window.location.origin)')
    expect(markierung).toContain('ereignis.source !== rahmen.current?.contentWindow')
    const empfaenger = quelltext('src/components/farm/vorschau-im-rahmen.tsx')
    expect(empfaenger).toMatch(/window\.parent\.postMessage\(\{ typ: BEREIT_TYP \}, window\.location\.origin\)/)
    // Das eigene Fenster scrollen, nicht scrollIntoView — das zöge die Editor-Seite mit.
    expect(empfaenger).not.toMatch(/\.scrollIntoView\(/)
    expect(empfaenger).toContain('window.scrollTo(')
  })
})

describe('hofseiteStand', () => {
  it('bildet Hofseite und Kartenpunkt auf den Stand ab', () => {
    const stand = hofseiteStand(
      {
        name: 'Hof Test',
        description: 'Gemüse aus Musterdorf',
        aboutText: null,
        logoUrl: null,
        bannerType: 'GRADIENT',
        bannerUrl: null,
        farmPhotos: [{}, {}],
        address: 'Musterweg 1',
        postalCode: '4900',
        city: 'Musterdorf',
        pickupSlots: [{ dayOfWeek: 6, startTime: '09:00', endTime: '12:00' }],
        acceptsOnline: false,
        stripeAccountReady: false,
        phone: '+43 660 0000000',
        email: 'hof@example.com',
        isPaused: true,
        sectionsConfig: [{ key: 'products', visible: true, order: 1 }],
      },
      { latitude: 48.2, longitude: 13.4 }
    )
    expect(stand).toMatchObject({ fotos: 2, hatKoordinaten: true, isPaused: true, name: 'Hof Test' })
    expect(stand.abholzeiten).toHaveLength(1)
    expect(hofseiteStand({ ...standOhnePunkt(), farmPhotos: [] }, { latitude: null, longitude: 13.4 }).hatKoordinaten).toBe(false)
  })
})

function standOhnePunkt() {
  return {
    name: 'Hof Test',
    description: '',
    aboutText: null,
    logoUrl: null,
    bannerType: 'GRADIENT',
    bannerUrl: null,
    farmPhotos: [],
    address: '',
    postalCode: '',
    city: '',
    pickupSlots: [],
    acceptsOnline: false,
    stripeAccountReady: false,
    phone: '',
    email: '',
    isPaused: false,
    sectionsConfig: [],
  }
}

// ─── Wache über ganz src/ (Nr. 65) ─────────────────────────────────────────

const SRC = join(process.cwd(), 'src')
const SPEICHERWEG = 'components/mein-hof/abschnitt-speichern.ts'

/** Jede Aktion: wo sie steht und aus welcher Funktion des Speicherwegs allein sie gerufen wird. */
const AKTIONEN: Record<string, { datei: string; nurAus: string }> = {
  saveAppearanceAction: { datei: 'server/actions/appearance.ts', nurAus: 'speichereAuftritt' },
  updateProfile: { datei: 'server/actions/farm.ts', nurAus: 'speichereProfil' },
}

type Fund = { datei: string; zeile: number; name: string }

function tsDateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) return tsDateien(pfad)
    return /\.(ts|tsx)$/.test(name) ? [pfad] : []
  })
}

function umschliessendeFunktion(knoten: ts.Node): string | null {
  for (let k: ts.Node | undefined = knoten.parent; k; k = k.parent) {
    if (ts.isFunctionDeclaration(k) && k.name) return k.name.text
  }
  return null
}

/**
 * Jede Stelle, an der eine der zwei Aktionen vorkommt, außer ihrer Definition
 * und dem einen Aufruf im Speicherweg. Gesucht wird der Name als Bezeichner
 * (Import, auch umbenannt; Namensraum `a.updateProfile`; Zerlegung eines
 * dynamischen Imports) und als Text in eckigen Klammern (`a['updateProfile']`).
 */
function findeAktionsaufrufe(datei: string, text: string): Fund[] {
  const quelle = ts.createSourceFile(datei, text, ts.ScriptTarget.Latest, true, datei.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const funde: Fund[] = []
  function erlaubt(knoten: ts.Identifier): boolean {
    const aktion = AKTIONEN[knoten.text]
    const eltern = knoten.parent
    if (datei === aktion.datei && ts.isFunctionDeclaration(eltern) && eltern.name === knoten) return true
    if (datei !== SPEICHERWEG) return false
    if (ts.isImportSpecifier(eltern) && !eltern.propertyName) return true
    return ts.isCallExpression(eltern) && eltern.expression === knoten && umschliessendeFunktion(knoten) === aktion.nurAus
  }
  function besuche(knoten: ts.Node): void {
    // Object.hasOwn statt `in`: `in` fände auch toString und andere Namen aus Object.prototype.
    const name =
      ts.isIdentifier(knoten) && Object.hasOwn(AKTIONEN, knoten.text)
        ? knoten.text
        : ts.isElementAccessExpression(knoten) && ts.isStringLiteralLike(knoten.argumentExpression) && Object.hasOwn(AKTIONEN, knoten.argumentExpression.text)
          ? knoten.argumentExpression.text
          : null
    if (name && !(ts.isIdentifier(knoten) && erlaubt(knoten))) {
      funde.push({ datei, zeile: quelle.getLineAndCharacterOfPosition(knoten.getStart(quelle)).line + 1, name })
    }
    ts.forEachChild(knoten, besuche)
  }
  besuche(quelle)
  return funde
}

describe('saveAppearanceAction und updateProfile nur aus abschnitt-speichern.ts (Wache über ganz src/, Nr. 65)', () => {
  it(
    'kein Fund in src/: jede Aktion steht einmal und wird nur aus ihrer Funktion im Speicherweg gerufen',
    () => {
      // Liest und parst jede Datei unter src/ — eigenes Limit nur für diesen Fall (TESTING_GUIDELINES §4).
      const funde = tsDateien(SRC).flatMap((pfad) => findeAktionsaufrufe(relative(SRC, pfad).split('\\').join('/'), readFileSync(pfad, 'utf8')))
      expect(funde).toEqual([])
      // Gegenprobe am echten Speicherweg: Die erlaubten Stellen gibt es wirklich.
      const speicherweg = quelltext(`src/${SPEICHERWEG}`)
      expect(speicherweg).toMatch(/export function speichereAuftritt\([\s\S]*?saveAppearanceAction\(/)
      expect(speicherweg).toMatch(/export function speichereProfil\([\s\S]*?updateProfile\(/)
    },
    30_000
  )

  it('Gegenproben: jede Umgehung schlägt an', () => {
    const namen = (datei: string, text: string) => findeAktionsaufrufe(datei, text).map((f) => f.name)
    // Direkt aus einem Formular, auch umbenannt.
    expect(namen('components/settings/profile-form.tsx', "import { updateProfile } from '@/server/actions/farm'\nupdateProfile(daten)")).toEqual(['updateProfile', 'updateProfile'])
    expect(namen('app/(hof)/x/page.tsx', "import { updateProfile as speichern } from '@/server/actions/farm'")).toEqual(['updateProfile'])
    // Über einen Namensraum, einen dynamischen Import oder eckige Klammern.
    expect(namen('components/x.tsx', "import * as a from '@/server/actions/appearance'\na.saveAppearanceAction({})")).toEqual(['saveAppearanceAction'])
    expect(namen('components/x.tsx', "const { updateProfile: u } = await import('@/server/actions/farm')")).toEqual(['updateProfile'])
    expect(namen('components/x.tsx', "a['saveAppearanceAction']({})")).toEqual(['saveAppearanceAction'])
    // Aus der eigenen Aktionsdatei heraus, an der Kette vorbei.
    expect(namen('server/actions/farm.ts', 'export async function updateProfile() {}\nexport async function andere() { return updateProfile(x) }')).toEqual(['updateProfile'])
    // Im Speicherweg, aber aus der falschen Funktion oder umbenannt.
    expect(namen(SPEICHERWEG, 'export function speichereAuftritt() { return updateProfile(x) }')).toEqual(['updateProfile'])
    expect(namen(SPEICHERWEG, 'function hilfe() { return saveAppearanceAction(x) }')).toEqual(['saveAppearanceAction'])
    expect(namen(SPEICHERWEG, "import { saveAppearanceAction as s } from '@/server/actions/appearance'")).toEqual(['saveAppearanceAction'])
    // Erlaubt: Definition, Import und der Aufruf aus der eigenen Funktion des Speicherwegs.
    expect(namen('server/actions/appearance.ts', 'export async function saveAppearanceAction() {}')).toEqual([])
    expect(namen(SPEICHERWEG, "import { updateProfile } from '@/server/actions/farm'\nexport function speichereProfil() { return nacheinander(async () => updateProfile(y)) }")).toEqual([])
  })
})
