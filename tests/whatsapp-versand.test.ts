/**
 * WhatsApp an Abonnentinnen, ehrlich und je Person (Register W1, Nachtlauf
 * Nr. 66): src/lib/whatsapp-versand.ts ohne jeden Mock, dazu eine Wache am
 * Quelltext der Tipp-Liste.
 *
 * Beweist:
 *  - Der Stand zählt nur heutige Abonnentinnen; eine gespeicherte Kennung von
 *    jemandem, der sich abgemeldet hat, zählt nicht (nie „4 von 3").
 *  - Geöffnet ist eine Person erst nach Verlassen UND Rückkehr der Seite, und
 *    gespeichert wird genau einmal — nie per Zeitschaltung.
 *  - Keine Client-Komponente unter src/app/(hof) hat eine Zeitschaltung,
 *    einen Satz „Gesendet", „versendet", „automatisch gespeichert" (außer den
 *    begründeten E-Mail-Sätzen) oder eine Action im setState-Updater
 *    (Syntaxbaum, mit Gegenprobe am alten Muster) — seit Nr. 75 für alle
 *    Clients des Hofbereichs (Regelvorschlag 66). Die Tipp-Liste nimmt ihre
 *    Sätze aus der Quelle in lib/.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, it, expect } from 'vitest'
import { WHATSAPP_VERSAND_TEXT, nachSeitenEreignis, versandStand, type Abonnentin } from '@/lib/whatsapp-versand'

const ANNA: Abonnentin = { id: 'cabo00000000000000000001', name: 'Anna Muster', phone: '+43 660 0000000' }
const BERTA: Abonnentin = { id: 'cabo00000000000000000002', name: 'Berta Muster', phone: '+43 660 0000001' }
const CARLA: Abonnentin = { id: 'cabo00000000000000000003', name: 'Carla Muster', phone: '+43 660 0000002' }
const ALLE = [ANNA, BERTA, CARLA]

describe('versandStand', () => {
  it('ohne Abonnentinnen: nichts zu zählen und nie „fertig"', () => {
    expect(versandStand([], [ANNA.id])).toEqual({ personen: [], geoeffnet: 0, gesamt: 0, fertig: false })
  })

  it('teilweise: je Person geöffnet oder offen, „1 von 3 geöffnet"', () => {
    const stand = versandStand(ALLE, [BERTA.id])
    expect(stand.personen.map((p) => [p.name, p.geoeffnet])).toEqual([
      ['Anna Muster', false],
      ['Berta Muster', true],
      ['Carla Muster', false],
    ])
    expect(stand).toMatchObject({ geoeffnet: 1, gesamt: 3, fertig: false })
    expect(WHATSAPP_VERSAND_TEXT.stand(stand.geoeffnet, stand.gesamt)).toBe('1 von 3 geöffnet')
  })

  it('fertig, wenn alle heutigen Abonnentinnen geöffnet sind — der Abschluss sagt nicht „gesendet"', () => {
    const stand = versandStand(ALLE, [CARLA.id, ANNA.id, BERTA.id])
    expect(stand).toMatchObject({ geoeffnet: 3, gesamt: 3, fertig: true })
    expect(WHATSAPP_VERSAND_TEXT.abschluss(stand.gesamt)).toBe('Alle 3 geöffnet – gesendet hast du in WhatsApp.')
  })

  it('wer nicht mehr abonniert ist, zählt nicht — auch nicht in den Abschluss', () => {
    const abgemeldet = 'cabo00000000000000000099'
    expect(versandStand(ALLE, [ANNA.id, abgemeldet])).toMatchObject({ geoeffnet: 1, gesamt: 3, fertig: false })
    expect(versandStand([ANNA], [abgemeldet])).toMatchObject({ geoeffnet: 0, gesamt: 1, fertig: false })
  })
})

describe('nachSeitenEreignis — geöffnet erst bei der Rückkehr (W1)', () => {
  const getippt = { id: ANNA.id, verlassen: false }

  it('Tipp, Seite verlassen (WhatsApp vorn), zurück → Anna wird genau einmal gespeichert', () => {
    const weg = nachSeitenEreignis(getippt, 'verlassen')
    expect(weg).toEqual({ stand: { id: ANNA.id, verlassen: true }, speichern: null })
    const zurueck = nachSeitenEreignis(weg.stand, 'zurueck')
    expect(zurueck).toEqual({ stand: null, speichern: ANNA.id })
    // Sichtbar UND Fokus melden beide „zurück" — das zweite speichert nichts mehr.
    expect(nachSeitenEreignis(zurueck.stand, 'zurueck')).toEqual({ stand: null, speichern: null })
  })

  it('ein Tipp, nach dem die Seite nie weg war, zählt nicht', () => {
    expect(nachSeitenEreignis(getippt, 'zurueck')).toEqual({ stand: getippt, speichern: null })
  })

  it('ohne Tipp ändert kein Seitenwechsel etwas', () => {
    expect(nachSeitenEreignis(null, 'verlassen')).toEqual({ stand: null, speichern: null })
    expect(nachSeitenEreignis(null, 'zurueck')).toEqual({ stand: null, speichern: null })
  })
})

const HOF_ORDNER = join(process.cwd(), 'src', 'app', '(hof)')

/** Alle Client-Komponenten unter src/app/(hof): Pfad ab dort → Quelltext. */
function hofClients(): Map<string, string> {
  const clients = new Map<string, string>()
  const besuche = (ordner: string): void => {
    for (const eintrag of readdirSync(ordner, { withFileTypes: true })) {
      const pfad = join(ordner, eintrag.name)
      if (eintrag.isDirectory()) besuche(pfad)
      else if (/\.tsx?$/.test(eintrag.name)) {
        const text = readFileSync(pfad, 'utf8')
        if (/^\s*['"]use client['"]/.test(text)) clients.set(relative(HOF_ORDNER, pfad).split(sep).join('/'), text)
      }
    }
  }
  besuche(HOF_ORDNER)
  return clients
}

const CLIENTS = hofClients()
const CLIENT = CLIENTS.get('status/[id]/send-whatsapp/whatsapp-tap-client.tsx') ?? ''

/** Sätze, die eine Zustellung behaupten, die die App nicht sehen kann. */
const UNEHRLICH = /Gesendet|versendet|automatisch gespeichert/

/**
 * Ausnahmen je Datei und Satz: E-Mails an Abonnentinnen verschickt die App
 * selbst (Resend), anders als WhatsApp — dort darf „versendet" stehen. Die
 * längeren Sätze zuerst; ein Satz, den es nicht mehr gibt, macht die Wache
 * rot, damit die Liste nicht still wächst.
 */
const ERLAUBTE_SAETZE: readonly { datei: string; satz: string; grund: string }[] = [
  { datei: 'status/new/status-new-client.tsx', satz: 'E-Mails werden automatisch versendet', grund: 'Die App verschickt die Mails beim Veröffentlichen selbst.' },
  { datei: 'status/new/status-new-client.tsx', satz: 'E-Mails versendet', grund: 'Zahl der Mails, die die App verschickt hat (Ergebnis und Mailabstand).' },
  { datei: 'status/new/status-new-client.tsx', satz: 'Wird versendet…', grund: 'Knopf, solange die App veröffentlicht und die Mails verschickt.' },
]

/**
 * Ausnahmen von „keine Zeitschaltung", je Datei mit Grund: Ein offener Faden im
 * Postfach lädt alle 60 s nach (Register N12, router.refresh, kein
 * Polling-Endpunkt) — die Zeitschaltung holt nur die Seite neu, sie speichert
 * nichts und behauptet keine Zustellung. Eine Ausnahme ohne Zeitschaltung
 * macht die Wache rot.
 */
const ERLAUBTE_ZEITSCHALTUNG: readonly { datei: string; grund: string }[] = [
  { datei: 'postfach/[id]/faden-nachladen.tsx', grund: 'Register N12: offener Faden lädt alle 60 s nach (router.refresh), nur bei sichtbarer Seite.' },
]

function ohneErlaubteSaetze(datei: string, text: string): string {
  return ERLAUBTE_SAETZE.filter((e) => e.datei === datei).reduce((rest, e) => rest.split(e.satz).join(''), text)
}

/** Ruft ein setState-Updater (`setX(…)`) eine Action oder startTransition auf? Actions: was die Datei aus src/server/actions einbindet. */
function aktionImUpdater(quelltext: string): boolean {
  const datei = ts.createSourceFile('client.tsx', quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const aktionen = new Set(['startTransition'])
  for (const anweisung of datei.statements) {
    if (!ts.isImportDeclaration(anweisung) || !ts.isStringLiteral(anweisung.moduleSpecifier)) continue
    if (!anweisung.moduleSpecifier.text.startsWith('@/server/actions/')) continue
    const benannt = anweisung.importClause?.namedBindings
    if (benannt && ts.isNamedImports(benannt)) for (const element of benannt.elements) aktionen.add(element.name.text)
  }
  let gefunden = false
  const besuche = (knoten: ts.Node, imUpdater: boolean): void => {
    if (ts.isCallExpression(knoten) && ts.isIdentifier(knoten.expression) && /^set[A-Z]/.test(knoten.expression.text)) {
      knoten.arguments.forEach((argument) => besuche(argument, true))
      return
    }
    if (imUpdater && ts.isIdentifier(knoten) && aktionen.has(knoten.text)) gefunden = true
    ts.forEachChild(knoten, (kind) => besuche(kind, imUpdater))
  }
  besuche(datei, false)
  return gefunden
}

describe('Client-Komponenten unter src/app/(hof) (Quelltext-Wache, Regelvorschlag 66, seit Nr. 75)', () => {
  it('findet alle Clients des Hofbereichs, darunter die Tipp-Liste', () => {
    expect(CLIENTS.size).toBeGreaterThanOrEqual(6)
    expect(CLIENT).toContain('setzeWhatsAppGetippt(')
  })

  it('keine Zeitschaltung und kein Satz, der eine Zustellung behauptet — außer den begründeten E-Mail-Sätzen', () => {
    for (const [datei, text] of CLIENTS) {
      if (!ERLAUBTE_ZEITSCHALTUNG.some((e) => e.datei === datei)) expect(text, datei).not.toMatch(/\bset(Timeout|Interval)\b/)
      expect(ohneErlaubteSaetze(datei, text), datei).not.toMatch(UNEHRLICH)
    }
  })

  it('jede erlaubte Zeitschaltung steht noch in ihrer Datei — und nur als router.refresh', () => {
    for (const { datei } of ERLAUBTE_ZEITSCHALTUNG) {
      const text = CLIENTS.get(datei) ?? ''
      expect(text, datei).toMatch(/\bsetInterval\b/)
      expect(text, datei).toContain('router.refresh()')
      expect(aktionImUpdater(text), datei).toBe(false)
    }
  })

  it('jede Ausnahme steht noch in ihrer Datei', () => {
    for (const { datei, satz } of ERLAUBTE_SAETZE) expect(CLIENTS.get(datei) ?? '', `${datei}: ${satz}`).toContain(satz)
  })

  it('ruft eine Action nie aus einem setState-Updater', () => {
    for (const [datei, text] of CLIENTS) expect(aktionImUpdater(text), datei).toBe(false)
  })

  it('die Tipp-Liste nimmt Sätze und Regeln aus src/lib/whatsapp-versand.ts und speichert über setzeWhatsAppGetippt', () => {
    expect(CLIENT).toContain("from '@/lib/whatsapp-versand'")
    expect(CLIENT).toContain('nachSeitenEreignis(')
  })

  it('Gegenprobe: das alte Muster schlägt an jeder Stelle an', () => {
    const alt = `
      import { markWhatsAppSent } from '@/server/actions/status-posts'
      function markSent(email) {
        setSent((prev) => {
          const next = new Set(prev)
          startTransition(async () => { await markWhatsAppSent(postId, next.size) })
          return next
        })
      }
      function speichern() {
        setStand(() => markWhatsAppSent(postId, 1))
      }
      const zeile = <a onClick={() => setTimeout(() => markSent(sub.email), 1000)}>Tippen</a>
      const marke = <span>Gesendet</span>
    `
    expect(alt).toMatch(/\bsetTimeout\b/)
    expect(alt).toMatch(UNEHRLICH)
    expect(aktionImUpdater(alt)).toBe(true)
    expect(aktionImUpdater(alt.replace('startTransition(async () => { await markWhatsAppSent(postId, next.size) })', ''))).toBe(true)
    // Ohne den Import ist markWhatsAppSent keine Action — dann zählt nur startTransition.
    expect(aktionImUpdater(alt.replace(/^\s*import .*$/m, '').replace('setStand(() => markWhatsAppSent(postId, 1))', ''))).toBe(true)
    expect(ohneErlaubteSaetze('status/new/status-new-client.tsx', 'Zugestellt: Gesendet')).toMatch(UNEHRLICH)
  })
})
