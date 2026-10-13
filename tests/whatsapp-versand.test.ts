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
 *  - Die Tipp-Liste hat keine Zeitschaltung, keine Sätze „Gesendet",
 *    „versendet", „automatisch gespeichert", nimmt ihre Sätze aus der Quelle
 *    in lib/ und ruft die Action nie aus einem setState-Updater (Syntaxbaum,
 *    mit Gegenprobe am alten Muster).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

const CLIENT = readFileSync(
  join(process.cwd(), 'src', 'app', '(hof)', 'status', '[id]', 'send-whatsapp', 'whatsapp-tap-client.tsx'),
  'utf8'
)

/** Sätze, die eine Zustellung behaupten, die die App nicht sehen kann. */
const UNEHRLICH = /Gesendet|versendet|automatisch gespeichert/

/** Ruft ein setState-Updater (`setX(…)`) eine Action oder startTransition auf? */
function aktionImUpdater(quelltext: string): boolean {
  const datei = ts.createSourceFile('client.tsx', quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let gefunden = false
  const besuche = (knoten: ts.Node, imUpdater: boolean): void => {
    if (ts.isCallExpression(knoten) && ts.isIdentifier(knoten.expression) && /^set[A-Z]/.test(knoten.expression.text)) {
      knoten.arguments.forEach((argument) => besuche(argument, true))
      return
    }
    if (imUpdater && ts.isIdentifier(knoten) && /^(startTransition|setzeWhatsAppGetippt|markWhatsAppSent)$/.test(knoten.text)) {
      gefunden = true
    }
    ts.forEachChild(knoten, (kind) => besuche(kind, imUpdater))
  }
  besuche(datei, false)
  return gefunden
}

describe('Tipp-Liste (whatsapp-tap-client.tsx)', () => {
  it('keine Zeitschaltung und kein Satz, der eine Zustellung behauptet', () => {
    expect(CLIENT).not.toMatch(/\bsetTimeout\b/)
    expect(CLIENT).not.toMatch(UNEHRLICH)
  })

  it('nimmt Sätze und Regeln aus src/lib/whatsapp-versand.ts und speichert über setzeWhatsAppGetippt', () => {
    expect(CLIENT).toContain("from '@/lib/whatsapp-versand'")
    expect(CLIENT).toContain('setzeWhatsAppGetippt(')
    expect(CLIENT).toContain('nachSeitenEreignis(')
  })

  it('ruft die Action nie aus einem setState-Updater', () => {
    expect(aktionImUpdater(CLIENT)).toBe(false)
  })

  it('Gegenprobe: das alte Muster schlägt an jeder Stelle an', () => {
    const alt = `
      function markSent(email) {
        setSent((prev) => {
          const next = new Set(prev)
          startTransition(async () => { await markWhatsAppSent(postId, next.size) })
          return next
        })
      }
      const zeile = <a onClick={() => setTimeout(() => markSent(sub.email), 1000)}>Tippen</a>
      const marke = <span>Gesendet</span>
    `
    expect(alt).toMatch(/\bsetTimeout\b/)
    expect(alt).toMatch(UNEHRLICH)
    expect(aktionImUpdater(alt)).toBe(true)
  })
})
