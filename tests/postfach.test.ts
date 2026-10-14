/**
 * Postfach, Stufe 1 (Register N12, Nachtlauf Nr. 87): die Regeln aus
 * src/lib/postfach.ts ohne jeden Mock und die Grenzen aus
 * src/schemas/postfach.ts.
 *
 * Beweist:
 *  - Links nur relativ oder auf die Produktionsdomain; gespeichert und gezeigt
 *    wird der Weg in der App (kein „//", kein „\", kein fremder Host, Port
 *    oder Anmeldedaten, kein http).
 *  - Lesestand je Seite: Neu ist nur, was die ANDERE Seite nach dem Lesestand
 *    schrieb. Dass er nur vorrückt und höchstens eine E-Mail je Faden und
 *    Stunde geht, sind Bedingungen in den WHERE-Klauseln der Actions — das
 *    prüft tests/integration/postfach.int.test.ts an der echten Datenbank.
 *  - Liste, Zähler und Karte auf Heute lesen dieselbe Regel; „Du hast
 *    geantwortet" nur, wenn die Antwort das Neueste ist.
 *  - Empfänger: Filter „ohne Online-Zahlung" und „Futter ohne Nummer",
 *    Ausgewählte nur aus der Liste, jeder Hof einmal.
 *  - Zod: Text ≤ 1000, Titel ≤ 80, Kennungen cuid, keine fremden Felder; die
 *    Enum-Werte gleichen dem Prisma-Schema.
 */
import { describe, it, expect } from 'vitest'
import { $Enums } from '@prisma/client'
import { PRODUKTION_HOST } from '@/lib/umgebung'
import { MARKE_TEAM } from '@/lib/marke'
import {
  POSTFACH_FEHLER,
  POSTFACH_TEXT,
  adminPostfachAdresse,
  adminReiterAus,
  appPfadAusLink,
  empfaengerFuer,
  empfaengerText,
  empfaengerZahlen,
  fadenEintraege,
  heutePostfach,
  istNeuFuer,
  lesequoteText,
  meldungenImPostfach,
  neuesteDerAnderenSeite,
  passtZumFilter,
  postfachFilterAus,
  postfachZeilen,
  rundschreibenGelesen,
  sendenText,
  wannText,
  zaehleUngelesen,
  type EmpfaengerHof,
  type FadenNachricht,
  type FadenRoh,
} from '@/lib/postfach'
import {
  NACHRICHT_ARTEN,
  RUNDSCHREIBEN_ARTEN,
  UNTERHALTUNG_SEITEN,
  gelesenSchema,
  hofAntwortSchema,
  linkSchema,
  rundschreibenSchema,
  teamAntwortSchema,
} from '@/schemas/postfach'

const ID_A = 'cuntaaaaaaaaaaaaaaaaaaaa1'
const ID_B = 'cuntbbbbbbbbbbbbbbbbbbbb2'
const HOF_ID = 'cfarmaaaaaaaaaaaaaaaaaaa1'
// 13. Oktober 2026, 12:00 Uhr in Wien (MESZ, UTC+2).
const JETZT = new Date('2026-10-13T10:00:00Z')
const vor = (minuten: number) => new Date(JETZT.getTime() - minuten * 60_000)

describe('appPfadAusLink — nur relativ oder die Produktionsdomain', () => {
  it('nimmt Wege in der App und Adressen der Produktionsdomain, gibt immer den Weg zurück', () => {
    expect(appPfadAusLink('/products?bereich=futter')).toBe('/products?bereich=futter')
    expect(appPfadAusLink('  /settings/payments ')).toBe('/settings/payments')
    expect(appPfadAusLink(`https://${PRODUKTION_HOST}/agb#abschnitt`)).toBe('/agb#abschnitt')
    expect(appPfadAusLink(`https://${PRODUKTION_HOST}`)).toBe('/')
  })

  it('lehnt alles ab, was aus der App führen könnte', () => {
    for (const link of [
      '',
      '//fremd.example/x',
      '/\\fremd.example',
      '/a b',
      'https://fremd.example/agb',
      `http://${PRODUKTION_HOST}/agb`,
      `https://${PRODUKTION_HOST}:8443/agb`,
      `https://nutzer@${PRODUKTION_HOST}/agb`,
      `https://${PRODUKTION_HOST}.fremd.example/agb`,
      `www.${PRODUKTION_HOST}/agb`,
      'javascript:alert(1)',
      'products',
    ]) {
      expect(appPfadAusLink(link), link).toBeNull()
    }
  })
})

describe('Lesestand je Seite', () => {
  const vomTeam = { vonFarmId: null, createdAt: vor(10) }
  const vomHof = { vonFarmId: HOF_ID, createdAt: vor(10) }

  it('neu ist nur, was die andere Seite nach dem Lesestand schrieb — genau am Stand ist gelesen', () => {
    expect(istNeuFuer('HOF', vomTeam, null)).toBe(true)
    expect(istNeuFuer('HOF', vomTeam, vor(10))).toBe(false)
    expect(istNeuFuer('HOF', vomTeam, new Date(vor(10).getTime() - 1))).toBe(true)
    expect(istNeuFuer('HOF', vomHof, null)).toBe(false)
    expect(istNeuFuer('TEAM', vomHof, null)).toBe(true)
    expect(istNeuFuer('TEAM', vomTeam, null)).toBe(false)
  })
})

describe('wannText — kurz und nach Wiener Kalendertag', () => {
  it('gerade eben, Minuten, Stunden, gestern, Datum', () => {
    expect(wannText(new Date(JETZT.getTime() - 30_000), JETZT)).toBe('gerade eben')
    expect(wannText(vor(20), JETZT)).toBe('vor 20 Min.')
    expect(wannText(vor(3 * 60), JETZT)).toBe('vor 3 Std.')
    expect(wannText(new Date('2026-10-12T08:00:00Z'), JETZT)).toBe('gestern')
    expect(wannText(new Date('2026-10-06T08:00:00Z'), JETZT)).toBe('6. Okt')
    expect(wannText(new Date('2025-12-24T08:00:00Z'), JETZT)).toBe('24. Dez 2025')
  })

  it('kurz nach Mitternacht in Wien ist es schon heute, nicht gestern (UTC wäre noch gestern)', () => {
    const nachMitternacht = new Date('2026-10-13T00:30:00Z') // 02:30 in Wien
    const kurzVorher = new Date('2026-10-12T22:10:00Z') // 00:10 in Wien, derselbe Tag
    expect(wannText(kurzVorher, nachMitternacht)).toBe('vor 2 Std.')
  })
})

function faden(abweichend: Partial<FadenRoh> = {}): FadenRoh {
  return {
    id: ID_A,
    titel: 'Bitte die Betriebsnummer eintragen',
    rundschreibenWichtig: false,
    letzteNachrichtAm: vor(30),
    gelesenBis: null,
    neuesteVomTeam: { id: 'cnachaaaaaaaaaaaaaaaaaaa1', text: 'Erfundener Text vom Team.', linkUrl: null, art: 'NORMAL', createdAt: vor(30) },
    neuesteVomHof: null,
    ...abweichend,
  }
}

describe('Liste, Zähler und Karte auf Heute', () => {
  it('neueste zuerst; Filter „Ungelesen" zeigt nur Fäden mit Neuem vom Team', () => {
    const alt = faden({ id: ID_B, letzteNachrichtAm: vor(600), gelesenBis: vor(30), neuesteVomTeam: { ...faden().neuesteVomTeam!, createdAt: vor(600) } })
    const neu = faden()
    expect(postfachZeilen([alt, neu], 'alle', JETZT).map((z) => z.id)).toEqual([ID_A, ID_B])
    expect(postfachZeilen([alt, neu], 'ungelesen', JETZT).map((z) => z.id)).toEqual([ID_A])
    expect(zaehleUngelesen([alt, neu])).toBe(1)
  })

  it('„Du hast geantwortet" nur, wenn die Antwort des Hofs das Neueste ist', () => {
    const beantwortet = faden({ gelesenBis: vor(5), neuesteVomHof: { text: 'Danke, mach ich.', createdAt: vor(5) }, letzteNachrichtAm: vor(5) })
    expect(postfachZeilen([beantwortet], 'alle', JETZT)[0]).toMatchObject({ eigeneAntwort: 'Danke, mach ich.', ungelesen: false })
    const teamDanach = faden({ neuesteVomHof: { text: 'Danke, mach ich.', createdAt: vor(40) } })
    expect(postfachZeilen([teamDanach], 'alle', JETZT)[0]).toMatchObject({ eigeneAntwort: null, ungelesen: true })
  })

  it('Wichtig aus dem Rundschreiben oder der neuesten Nachricht vom Team; ohne Rundschreiben ein fester Titel', () => {
    expect(postfachZeilen([faden({ rundschreibenWichtig: true })], 'alle', JETZT)[0].wichtig).toBe(true)
    expect(postfachZeilen([faden({ neuesteVomTeam: { ...faden().neuesteVomTeam!, art: 'WICHTIG' } })], 'alle', JETZT)[0].wichtig).toBe(true)
    expect(postfachZeilen([faden()], 'alle', JETZT)[0]).toMatchObject({ wichtig: false, href: `/postfach/${ID_A}` })
    expect(postfachZeilen([faden({ titel: null })], 'alle', JETZT)[0].titel).toBe(POSTFACH_TEXT.ohneTitel)
  })

  it('Heute zeigt die neueste ungelesene Nachricht und zählt die übrigen Fäden', () => {
    expect(heutePostfach([faden({ gelesenBis: vor(1) })], JETZT)).toBeNull()
    const aelter = faden({ id: ID_B, neuesteVomTeam: { ...faden().neuesteVomTeam!, id: 'cnachbbbbbbbbbbbbbbbbbbb2', createdAt: vor(90) } })
    const neuer = faden({ neuesteVomTeam: { ...faden().neuesteVomTeam!, linkUrl: `https://${PRODUKTION_HOST}/products?bereich=futter` } })
    const karte = heutePostfach([aelter, neuer], JETZT)
    expect(karte?.weitere).toBe(1)
    expect(karte?.nachricht).toMatchObject({ unterhaltungId: ID_A, link: '/products?bereich=futter', wann: 'vor 30 Min.', href: `/postfach/${ID_A}` })
  })
})

describe('Der Faden', () => {
  const nachrichten: FadenNachricht[] = [
    { id: 'cn2', vonFarmId: HOF_ID, text: 'Antwort des Hofs', linkUrl: null, art: 'NORMAL', createdAt: new Date('2026-10-13T08:12:00Z') },
    { id: 'cn1', vonFarmId: null, text: 'Rundschreiben', linkUrl: '/products', art: 'WICHTIG', createdAt: new Date('2026-10-10T07:00:00Z') },
    { id: 'cn3', vonFarmId: null, text: 'Antwort des Teams', linkUrl: null, art: 'NORMAL', createdAt: new Date('2026-10-13T08:31:00Z') },
  ]

  it('älteste zuerst, mit Tageszeile; „gelesen" nur an den eigenen Nachrichten', () => {
    const eintraege = fadenEintraege(nachrichten, 'HOF', new Date('2026-10-13T08:20:00Z'), JETZT)
    expect(eintraege.map((e) => (e.art === 'tag' ? `[${e.text}]` : e.id))).toEqual(['[Sa, 10. Okt]', 'cn1', '[Heute]', 'cn2', 'cn3'])
    const zwei = eintraege.find((e) => e.art === 'nachricht' && e.id === 'cn2')
    const drei = eintraege.find((e) => e.art === 'nachricht' && e.id === 'cn3')
    expect(zwei).toMatchObject({ vomTeam: false, gelesen: true, uhrzeit: '10:12' })
    expect(drei).toMatchObject({ vomTeam: true, gelesen: null })
    const team = fadenEintraege(nachrichten, 'TEAM', null, JETZT)
    expect(team.find((e) => e.art === 'nachricht' && e.id === 'cn1')).toMatchObject({ gelesen: false, wichtig: true, link: '/products' })
  })

  it('Öffnen liest bis zur neuesten Nachricht der anderen Seite', () => {
    expect(neuesteDerAnderenSeite(nachrichten, 'HOF')?.id).toBe('cn3')
    expect(neuesteDerAnderenSeite(nachrichten, 'TEAM')?.id).toBe('cn2')
    expect(neuesteDerAnderenSeite([], 'HOF')).toBeNull()
  })
})

function hof(abweichend: Partial<EmpfaengerHof> = {}): EmpfaengerHof {
  return { id: HOF_ID, name: 'Hof Test', ort: 'Teststadt', stripeAccountReady: true, betriebsnummer: 'LFBIS 0000000', betriebsstatus: null, hatFutter: false, ...abweichend }
}

describe('Empfänger eines Rundschreibens', () => {
  const fertig = hof({ id: 'cfarm00000000000000000001' })
  const ohneStripe = hof({ id: 'cfarm00000000000000000002', stripeAccountReady: false })
  const futterOhne = hof({ id: 'cfarm00000000000000000003', hatFutter: true, betriebsnummer: '   ' })
  const futterMit = hof({ id: 'cfarm00000000000000000004', hatFutter: true })
  const ohneFutterOhneNummer = hof({ id: 'cfarm00000000000000000005', betriebsnummer: null })
  const alle = [fertig, ohneStripe, futterOhne, futterMit, ohneFutterOhneNummer]

  it('Filter treffen genau die richtigen Höfe', () => {
    expect(passtZumFilter(ohneStripe, 'ohne-online-zahlung')).toBe(true)
    expect(passtZumFilter(fertig, 'ohne-online-zahlung')).toBe(false)
    expect(empfaengerFuer({ art: 'futter-ohne-nummer' }, alle)).toEqual([futterOhne.id])
    expect(empfaengerFuer({ art: 'ohne-online-zahlung' }, alle)).toEqual([ohneStripe.id])
    expect(empfaengerFuer({ art: 'alle' }, alle)).toHaveLength(5)
  })

  it('Ausgewählte nur aus der Liste, jeder Hof einmal — eine fremde Kennung fällt still heraus', () => {
    const regel = { art: 'ausgewaehlt' as const, hofIds: [futterMit.id, futterMit.id, 'cfremdxxxxxxxxxxxxxxxxxx9'] }
    expect(empfaengerFuer(regel, alle)).toEqual([futterMit.id])
    expect(empfaengerZahlen(alle, [fertig.id])).toEqual({ alle: 5, ausgewaehlt: 1, 'ohne-online-zahlung': 1, 'futter-ohne-nummer': 1 })
  })

  it('Texte: Empfänger, Knopf, Lesequote', () => {
    expect(empfaengerText('alle', 4)).toBe('Alle Höfe · 4')
    expect(empfaengerText('futter-ohne-nummer', 2)).toBe('2 Höfe (Futter ohne Nummer)')
    expect(empfaengerText('ausgewaehlt', 1)).toBe('1 Hof (ausgewählt)')
    expect(sendenText(1)).toBe('An 1 Hof senden')
    expect(sendenText(2)).toBe('An 2 Höfe senden')
    expect(lesequoteText(3, 4)).toBe('3 von 4 gelesen')
  })

  it('gelesen ist ein Rundschreiben, wenn der Lesestand bis zum Versand reicht', () => {
    expect(rundschreibenGelesen(null, vor(10))).toBe(false)
    expect(rundschreibenGelesen(vor(10), vor(10))).toBe(true)
    expect(rundschreibenGelesen(vor(11), vor(10))).toBe(false)
  })
})

describe('Adressen', () => {
  it('Reiter aus der Adresse, unbekannt heißt Unterhaltungen', () => {
    expect(adminReiterAus('rundschreiben')).toBe('rundschreiben')
    expect(adminReiterAus(['meldungen', 'x'])).toBe('meldungen')
    expect(adminReiterAus('fremd')).toBe('unterhaltungen')
    expect(adminPostfachAdresse('unterhaltungen', { faden: ID_A })).toBe(`/admin/postfach?faden=${ID_A}`)
    expect(postfachFilterAus('ungelesen')).toBe('ungelesen')
    expect(postfachFilterAus('x')).toBe('alle')
  })

  it('die alten Briefkasten-Links behalten ihre Filter im Reiter Meldungen', () => {
    expect(meldungenImPostfach('/admin/meldungen')).toBe('/admin/postfach?reiter=meldungen')
    expect(meldungenImPostfach('/admin/meldungen?status=NEU&art=FEHLER')).toBe('/admin/postfach?reiter=meldungen&status=NEU&art=FEHLER')
  })
})

describe('Zod an der Grenze', () => {
  it('die Enum-Werte gleichen dem Prisma-Schema', () => {
    expect([...RUNDSCHREIBEN_ARTEN]).toEqual(Object.values($Enums.RundschreibenArt))
    expect([...NACHRICHT_ARTEN]).toEqual(Object.values($Enums.NachrichtArt))
    expect([...UNTERHALTUNG_SEITEN]).toEqual(Object.values($Enums.UnterhaltungSeite))
  })

  it('Antwort des Hofs: Text getrimmt, nicht leer, höchstens 1000; nur diese zwei Felder', () => {
    expect(hofAntwortSchema.parse({ unterhaltungId: ID_A, text: '  Danke!  ' })).toEqual({ unterhaltungId: ID_A, text: 'Danke!' })
    expect(hofAntwortSchema.safeParse({ unterhaltungId: ID_A, text: '   ' }).error?.issues[0]?.message).toBe(POSTFACH_FEHLER.textLeer)
    expect(hofAntwortSchema.safeParse({ unterhaltungId: ID_A, text: 'x'.repeat(1001) }).error?.issues[0]?.message).toBe(POSTFACH_FEHLER.textZuLang)
    expect(hofAntwortSchema.safeParse({ unterhaltungId: ID_A, text: 'x'.repeat(1000) }).success).toBe(true)
    expect(hofAntwortSchema.safeParse({ unterhaltungId: 'keine-cuid', text: 'Danke' }).success).toBe(false)
    expect(hofAntwortSchema.safeParse({ unterhaltungId: ID_A, text: 'Danke', vonFarmId: null }).success).toBe(false)
    expect(gelesenSchema.safeParse({ unterhaltungId: ID_A, nachrichtId: ID_B }).success).toBe(true)
  })

  it('Link: leer ist null, sonst nur erlaubte Wege', () => {
    expect(linkSchema.parse('')).toBeNull()
    expect(linkSchema.parse(undefined)).toBeNull()
    expect(linkSchema.parse(`https://${PRODUKTION_HOST}/agb`)).toBe('/agb')
    expect(linkSchema.safeParse('https://fremd.example').error?.issues[0]?.message).toBe(POSTFACH_FEHLER.link)
  })

  it('Rundschreiben: Titel höchstens 80, Art Info/Wichtig, Empfänger nach Regel', () => {
    const gueltig = { titel: 'Neue Abholzeiten', text: 'Erfundener Text.', art: 'INFO', link: '', perMail: false, empfaenger: { art: 'alle' } }
    expect(rundschreibenSchema.parse(gueltig)).toMatchObject({ link: null, empfaenger: { art: 'alle' } })
    expect(rundschreibenSchema.safeParse({ ...gueltig, titel: 'x'.repeat(81) }).error?.issues[0]?.message).toBe(POSTFACH_FEHLER.titelZuLang)
    expect(rundschreibenSchema.safeParse({ ...gueltig, art: 'SYSTEM' }).success).toBe(false)
    expect(rundschreibenSchema.safeParse({ ...gueltig, empfaenger: { art: 'ausgewaehlt', hofIds: [] } }).success).toBe(false)
    expect(rundschreibenSchema.safeParse({ ...gueltig, empfaenger: { art: 'jeder' } }).success).toBe(false)
    expect(teamAntwortSchema.safeParse({ unterhaltungId: ID_A, text: 'Passt.', wichtig: false, link: null, perMail: true }).success).toBe(true)
  })

  it('der Hinweis im Faden nennt das Team aus MARKE_TEAM', () => {
    expect(POSTFACH_TEXT.antwortHinweis).toBe(`Deine Antwort geht nur an das ${MARKE_TEAM}.`)
  })
})
