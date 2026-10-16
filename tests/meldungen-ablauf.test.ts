/**
 * Die reinen Regeln des Reiters „Meldungen" (Register N14, Ergänzung;
 * Nachtlauf Nr. 101) — ohne Mock.
 *
 * Beweist: meldungTeil ordnet jede der sieben Status × drei Arten genau einem
 * Teil zu, ein Duplikat zählt im Teil seiner Hauptmeldung; das Stand-Band
 * zählt Meldungen (Summe = Zahl der Meldungen), der Ablauf bündelt gleiche
 * Stichwörter im gleichen Teil; Stimmen zählen verschiedene Melder;
 * Aufbewahrung hält ein Duplikat, solange seine Hauptmeldung offen ist; die
 * Hof-Sicht leitet „Bereits bekannt · Behoben" beim Lesen ab und nennt einen
 * abgelegten Wunsch „Nicht geplant"; Rückgängig stellt Status, Art und Notiz
 * wieder her; die Adresse fällt bei Unsinn auf den Standard zurück.
 */
import { describe, expect, it } from 'vitest'
import {
  MELDUNG_ARTEN,
  MELDUNG_STATUS,
  ablaufStand,
  bescheidMailHtml,
  buendelStandVon,
  buendelVorschau,
  fuerHof,
  kannHauptmeldungSein,
  kiEntscheidung,
  meldungTeil,
  oeffentlicherStatus,
  sucheMeldungen,
  suchMeldungVon,
  teileErledigt,
  waehleZuLoeschende,
  zaehleStandBand,
  type AblaufMeldung,
  type MeldungArt,
  type MeldungStatus,
  type MeldungTeil,
  type TriageStand,
} from '@/lib/meldung'
import { gruppiereWuensche, type WunschRoh } from '@/server/queries/meldung'
import { buendelStandSchema, meldungenAnsichtAus, zusammenfassenSchema } from '@/schemas/meldung'

const JETZT = new Date('2026-10-15T10:00:00.000Z')
const TAG = 24 * 60 * 60 * 1000
const vor = (tage: number): Date => new Date(JETZT.getTime() - tage * TAG)

function meldung(id: string, abweichend: Partial<AblaufMeldung> = {}): AblaufMeldung {
  return {
    id,
    art: 'FEHLER',
    status: 'NEU',
    createdAt: vor(1),
    triagedAt: null,
    ersteZeile: `Erfundene Meldung ${id}`,
    hofName: `Hof ${id}`,
    farmId: `farm-${id}`,
    customerEmail: null,
    clusterKey: null,
    sprintName: null,
    duplikatVonId: null,
    screenshot: false,
    diagKennung: null,
    triageNotiz: null,
    antwortAnMelder: null,
    ...abweichend,
  }
}

describe('meldungTeil — eine Regel für Band, Spalten und Chips', () => {
  const ERWARTET: Record<Exclude<MeldungStatus, 'DUPLIKAT'>, Record<MeldungArt, [MeldungTeil, boolean]>> = {
    NEU: { FEHLER: ['neu', false], WUNSCH: ['neu', false], FRAGE: ['neu', false] },
    VERMUTLICH_WUNSCH: { FEHLER: ['ki', false], WUNSCH: ['ki', false], FRAGE: ['ki', false] },
    GEPRUEFT: { FEHLER: ['neu', true], WUNSCH: ['gesammelt', false], FRAGE: ['neu', true] },
    GEPLANT: { FEHLER: ['geplant', false], WUNSCH: ['geplant', false], FRAGE: ['geplant', false] },
    ERLEDIGT: { FEHLER: ['erledigt', false], WUNSCH: ['erledigt', false], FRAGE: ['erledigt', false] },
    KEIN_FEHLER: { FEHLER: ['abgelegt', false], WUNSCH: ['abgelegt', false], FRAGE: ['abgelegt', false] },
  }

  it('ordnet alle sieben Status × drei Arten genau einem Teil zu (angesehen nur bei geprüftem Fehler und geprüfter Frage)', () => {
    for (const status of MELDUNG_STATUS) {
      for (const art of MELDUNG_ARTEN) {
        const ergebnis = meldungTeil({ status, art }, status === 'DUPLIKAT' ? { status: 'GEPLANT', art: 'WUNSCH' } : null)
        if (status === 'DUPLIKAT') {
          expect(ergebnis).toEqual({ teil: 'geplant', angesehen: false, eigeneKarte: false })
        } else {
          const [teil, angesehen] = ERWARTET[status][art]
          expect(ergebnis).toEqual({ teil, angesehen, eigeneKarte: true })
        }
      }
    }
  })

  it('ein Duplikat zählt im Teil seiner Hauptmeldung, ohne Hauptmeldung (gelöscht) oder in einer Kette unter Erledigt', () => {
    expect(meldungTeil({ status: 'DUPLIKAT', art: 'FEHLER' }, { status: 'NEU', art: 'FEHLER' }).teil).toBe('neu')
    expect(meldungTeil({ status: 'DUPLIKAT', art: 'FEHLER' }, { status: 'GEPRUEFT', art: 'WUNSCH' }).teil).toBe('gesammelt')
    expect(meldungTeil({ status: 'DUPLIKAT', art: 'FEHLER' }, null).teil).toBe('erledigt')
    expect(meldungTeil({ status: 'DUPLIKAT', art: 'FEHLER' }, { status: 'DUPLIKAT', art: 'FEHLER' }).teil).toBe('erledigt')
  })
})

describe('Stand-Band und Ablauf', () => {
  const liste: AblaufMeldung[] = [
    meldung('neu1'),
    meldung('neu2', { status: 'GEPRUEFT', art: 'FRAGE' }),
    meldung('ki1', { status: 'VERMUTLICH_WUNSCH', clusterKey: 'upload' }),
    meldung('ki2', { status: 'VERMUTLICH_WUNSCH', clusterKey: 'upload' }),
    meldung('plan1', { status: 'GEPLANT', art: 'WUNSCH', clusterKey: 'titelbild', triagedAt: vor(2) }),
    meldung('plan2', { status: 'GEPLANT', art: 'WUNSCH', clusterKey: 'titelbild', triagedAt: vor(3), farmId: null, hofName: null, customerEmail: 'kundin@example.com' }),
    meldung('dup1', { status: 'DUPLIKAT', duplikatVonId: 'plan1', art: 'FEHLER' }),
    meldung('erl1', { status: 'ERLEDIGT', triagedAt: vor(40) }),
    meldung('ges1', { status: 'GEPRUEFT', art: 'WUNSCH', clusterKey: 'abholzeiten' }),
    meldung('abg1', { status: 'KEIN_FEHLER', art: 'WUNSCH' }),
    meldung('waise', { status: 'DUPLIKAT', duplikatVonId: 'gibt-es-nicht' }),
  ]

  it('die Summe der Teile ist die Zahl der Meldungen — gezählt werden Meldungen, nicht Karten', () => {
    const stand = ablaufStand(liste, { art: null, von: 'alle' })
    const summe = Object.values(stand.band).reduce((a, b) => a + b, 0)
    expect(summe).toBe(liste.length)
    expect(stand.gesamt).toBe(liste.length)
    expect(stand.band).toEqual({ brauchtDich: 4, inArbeit: 3, erledigt: 2, gesammelt: 1, abgelegt: 1 })
  })

  it('zaehleStandBand fasst Neu und KI-Vorschlag zu „Braucht dich" zusammen', () => {
    expect(zaehleStandBand(['neu', 'ki', 'ki', 'geplant'])).toEqual({ brauchtDich: 3, inArbeit: 1, erledigt: 0, gesammelt: 0, abgelegt: 0 })
  })

  it('bündelt gleiches Stichwort im gleichen Teil zu einer Karte, das Duplikat hängt an seiner Hauptmeldung; KI-Vorschläge bleiben einzeln', () => {
    const { karten, inBuendeln, alsDuplikat } = ablaufStand(liste, { art: null, von: 'alle' })
    expect(karten.geplant).toHaveLength(1)
    expect(karten.geplant[0]).toMatchObject({ buendel: 'titelbild', meldungen: 3, duplikate: 1, hoefe: 2 })
    expect(karten.ki).toHaveLength(2)
    expect(karten.neu.map((k) => k.haupt.id).sort()).toEqual(['neu1', 'neu2'])
    expect(karten.neu.find((k) => k.haupt.id === 'neu2')?.angesehen).toBe(true)
    expect(inBuendeln).toBe(1)
    expect(alsDuplikat).toBe(1)
  })

  it('Filter Art und Von gelten für die Karten; ein Duplikat folgt seiner Hauptmeldung, das Band bleibt über alle', () => {
    const nurWunsch = ablaufStand(liste, { art: 'WUNSCH', von: 'alle' })
    expect(nurWunsch.karten.neu).toHaveLength(0)
    expect(nurWunsch.karten.geplant[0].duplikate).toBe(1)
    expect(nurWunsch.gesamt).toBe(liste.length)
    const kundschaft = ablaufStand(liste, { art: null, von: 'kundschaft' })
    expect(kundschaft.jeArt.alle).toBe(1)
    expect(kundschaft.karten.geplant[0].haupt.id).toBe('plan2')
  })

  it('Erledigt zeigt 30 Tage, Älteres steht hinter „+ n ältere"', () => {
    const { karten } = ablaufStand([meldung('a', { status: 'ERLEDIGT', triagedAt: vor(5) }), meldung('b', { status: 'ERLEDIGT', triagedAt: vor(31) })], { art: null, von: 'alle' })
    const { sichtbar, aeltere } = teileErledigt(karten.erledigt, JETZT)
    expect(sichtbar.map((k) => k.haupt.id)).toEqual(['a'])
    expect(aeltere.map((k) => k.haupt.id)).toEqual(['b'])
  })
})

describe('Stimmen — gruppiereWuensche', () => {
  const w = (id: string, abweichend: Partial<WunschRoh> = {}): WunschRoh => ({
    id,
    art: 'WUNSCH',
    text: `Erfundener Wunsch ${id}`,
    clusterKey: 'abholzeiten',
    createdAt: vor(1),
    hofName: 'Hof A',
    farmId: 'farm-a',
    customerEmail: null,
    status: 'GEPRUEFT',
    duplikatVonId: null,
    sprintName: null,
    ...abweichend,
  })

  it('derselbe Hof zweimal ist eine Stimme', () => {
    const [b] = gruppiereWuensche([w('1'), w('2')])
    expect(b).toMatchObject({ anzahl: 2, stimmen: 1, hoefe: 1, kundinnen: 0 })
  })

  it('ein Duplikat zählt beim Stichwort seiner Hauptmeldung mit, auch wenn es selbst ein Fehler mit anderem Stichwort ist', () => {
    const [b] = gruppiereWuensche([w('1'), w('d', { art: 'FEHLER', status: 'DUPLIKAT', duplikatVonId: '1', farmId: 'farm-b', clusterKey: 'anderes' })])
    expect(b).toMatchObject({ clusterKey: 'abholzeiten', anzahl: 2, stimmen: 2, hoefe: 2, duplikate: 1 })
    expect(b.meldungen.find((m) => m.id === 'd')?.duplikat).toBe(true)
  })

  it('eine Kundin ohne Adresse zählt je Meldung, mit derselben Adresse einmal', () => {
    const ohne = { farmId: null, hofName: null, customerEmail: null }
    const [b] = gruppiereWuensche([w('1', ohne), w('2', ohne), w('3', { farmId: null, hofName: null, customerEmail: 'k@example.com' }), w('4', { farmId: null, hofName: null, customerEmail: 'K@example.com ' })])
    expect(b).toMatchObject({ stimmen: 3, hoefe: 0, kundinnen: 3, kundinnenMitAdresse: 1 })
  })

  it('gemeinsamer Stand, sonst „gemischt"; offene Bündel vor abgeschlossenen, dann nach Stimmen', () => {
    const cluster = gruppiereWuensche([
      w('z1', { clusterKey: 'zu', status: 'ERLEDIGT', farmId: 'f1' }),
      w('z2', { clusterKey: 'zu', status: 'ERLEDIGT', farmId: 'f2' }),
      w('z3', { clusterKey: 'zu', status: 'ERLEDIGT', farmId: 'f3' }),
      w('o1', { clusterKey: 'offen', status: 'GEPLANT', sprintName: 'Nr. 97' }),
      w('m1', { clusterKey: 'mix', status: 'GEPLANT', farmId: 'f4' }),
      w('m2', { clusterKey: 'mix', status: 'GEPRUEFT', farmId: 'f5' }),
    ])
    expect(cluster.map((c) => [c.clusterKey, c.stand])).toEqual([
      ['mix', 'gemischt'],
      ['offen', 'geplant'],
      ['zu', 'umgesetzt'],
    ])
    expect(cluster.find((c) => c.clusterKey === 'offen')?.sprintName).toBe('Nr. 97')
  })

  it('buendelStandVon: ein Stand für alle oder „gemischt"; nur Neues heißt „neu"', () => {
    expect(buendelStandVon(['GEPRUEFT', 'GEPRUEFT'])).toBe('gesammelt')
    expect(buendelStandVon(['KEIN_FEHLER'])).toBe('nichtGeplant')
    expect(buendelStandVon(['NEU', 'VERMUTLICH_WUNSCH'])).toBe('neu')
    expect(buendelStandVon(['GEPLANT', 'ERLEDIGT'])).toBe('gemischt')
    expect(buendelVorschau('nichtGeplant')).toBe('Nicht geplant — Antwort lesen')
    expect(buendelVorschau('geplant')).toBe('In Arbeit')
  })
})

describe('Aufbewahrung — ein Duplikat geht erst mit seiner Hauptmeldung', () => {
  const dup = { id: 'd', status: 'DUPLIKAT' as const, triagedAt: vor(200), createdAt: vor(210), duplikatVonId: 'h' }

  it('bleibt nach 200 Tagen, solange die Hauptmeldung offen ist', () => {
    expect(waehleZuLoeschende([dup], JETZT, new Map([['h', { status: 'GEPLANT' as const, triagedAt: vor(150), createdAt: vor(220) }]]))).toEqual([])
  })

  it('geht, wenn die Hauptmeldung seit 91 Tagen erledigt ist — auch wenn es selbst jünger ist; bei 89 Tagen noch nicht', () => {
    const jung = { ...dup, triagedAt: vor(3) }
    expect(waehleZuLoeschende([jung], JETZT, new Map([['h', { status: 'ERLEDIGT' as const, triagedAt: vor(91), createdAt: vor(120) }]]))).toEqual([jung])
    expect(waehleZuLoeschende([dup], JETZT, new Map([['h', { status: 'ERLEDIGT' as const, triagedAt: vor(89), createdAt: vor(120) }]]))).toEqual([])
  })

  it('in einer Kette (Hauptmeldung selbst Duplikat) bleibt es — lieber länger als eine Stimme zu früh', () => {
    expect(waehleZuLoeschende([dup], JETZT, new Map([['h', { status: 'DUPLIKAT' as const, triagedAt: vor(300), createdAt: vor(320) }]]))).toEqual([])
  })

  it('ohne Hauptmeldung gilt die Regel von heute: 90 Tage nach dem eigenen Abschluss', () => {
    expect(waehleZuLoeschende([dup], JETZT)).toEqual([dup])
    expect(waehleZuLoeschende([{ ...dup, triagedAt: vor(10) }], JETZT)).toEqual([])
  })
})

describe('Hof-Sicht — beim Lesen abgeleitet, nichts gespeichert', () => {
  const VOLL = {
    id: 'cmhofsicht00000000000001',
    art: 'FEHLER' as const,
    text: 'Erfundener Text',
    createdAt: vor(10),
    status: 'DUPLIKAT' as const,
    antwortAnMelder: null,
    duplikatVonId: 'cmhaupt0000000000000001',
    triageNotiz: 'intern',
  }

  it('ein Duplikat mit erledigter Hauptmeldung liest „Bereits bekannt · Behoben" nach Art der Hauptmeldung, grün', () => {
    const sicht = fuerHof(VOLL, { status: 'ERLEDIGT', art: 'FEHLER' })
    expect(sicht.status).toBe('Bereits bekannt · Behoben')
    expect(sicht.statusTon).toBe('fertig')
    expect(oeffentlicherStatus('DUPLIKAT', 'FEHLER', { status: 'ERLEDIGT', art: 'WUNSCH' })).toBe('Bereits bekannt · Umgesetzt')
    expect(Object.keys(sicht)).not.toContain('duplikatVonId')
    expect(JSON.stringify(sicht)).not.toContain('cmhaupt')
  })

  it('Gegenprobe: mit offener oder ohne Hauptmeldung bleibt es „Bereits bekannt"', () => {
    expect(fuerHof(VOLL, { status: 'GEPLANT', art: 'FEHLER' }).status).toBe('Bereits bekannt')
    expect(fuerHof(VOLL).status).toBe('Bereits bekannt')
    expect(fuerHof(VOLL).statusTon).toBe('neutral')
  })

  it('abgelegt heißt je Art anders: Fehler „Kein Fehler", Wunsch „Nicht geplant", Frage „Beantwortet"', () => {
    expect(oeffentlicherStatus('KEIN_FEHLER', 'FEHLER')).toBe('Kein Fehler — Antwort lesen')
    expect(oeffentlicherStatus('KEIN_FEHLER', 'WUNSCH')).toBe('Nicht geplant — Antwort lesen')
    expect(oeffentlicherStatus('KEIN_FEHLER', 'FRAGE')).toBe('Beantwortet')
  })
})

describe('KI-Vorschlag mit Rückgängig — kiEntscheidung', () => {
  const STAND: TriageStand = {
    status: 'VERMUTLICH_WUNSCH',
    art: 'FEHLER',
    clusterKey: null,
    triageNotiz: 'Notiz des Menschen\n[KI] es fehlt eine Möglichkeit',
    duplikatVonId: null,
    sprintName: null,
    antwortAnMelder: null,
  }

  it('„Ja, ein Wunsch": Art WUNSCH, Status GEPRUEFT, mit Ausgangsstand; Rückgängig stellt Status, Art und Notiz wieder her', () => {
    const { aufruf, rueckgaengig } = kiEntscheidung(STAND, true)
    expect(aufruf).toMatchObject({ status: 'GEPRUEFT', art: 'WUNSCH', triageNotiz: STAND.triageNotiz, vorherStatus: 'VERMUTLICH_WUNSCH', vorherNotiz: STAND.triageNotiz })
    expect(rueckgaengig).toMatchObject({ status: 'VERMUTLICH_WUNSCH', art: 'FEHLER', triageNotiz: STAND.triageNotiz, vorherStatus: 'GEPRUEFT', vorherNotiz: STAND.triageNotiz })
  })

  it('„Nein, ein Fehler": die KI-Zeile fällt weg; Rückgängig bringt sie zurück und baut auf der Notiz ohne sie auf', () => {
    const { aufruf, rueckgaengig } = kiEntscheidung(STAND, false)
    expect(aufruf).toMatchObject({ status: 'GEPRUEFT', art: 'FEHLER', triageNotiz: 'Notiz des Menschen' })
    expect(rueckgaengig).toMatchObject({ status: 'VERMUTLICH_WUNSCH', triageNotiz: STAND.triageNotiz, vorherStatus: 'GEPRUEFT', vorherNotiz: 'Notiz des Menschen' })
  })
})

describe('Suche in Zusammenfassen und Dazunehmen', () => {
  const liste = [
    suchMeldungVon(meldung('cmaaaa1111', { ersteZeile: 'Foto lädt nicht' }), 'Kundin'),
    suchMeldungVon(meldung('cmbbbb2222', { ersteZeile: 'Foto zu klein', status: 'DUPLIKAT' }), 'Kundin'),
    suchMeldungVon(meldung('cmcccc3333', { ersteZeile: 'Abholzeiten', status: 'KEIN_FEHLER' }), 'Kundin'),
  ]

  it('findet nach Kurznummer und Wort; Hauptmeldung kann nur eine offene oder erledigte Meldung sein, nicht die eigene', () => {
    const erlaubt = (m: (typeof liste)[number]) => kannHauptmeldungSein(m.status) && m.id !== 'cmaaaa1111'
    expect(sucheMeldungen(liste, 'foto', () => true).map((m) => m.id)).toEqual(['cmaaaa1111', 'cmbbbb2222'])
    expect(sucheMeldungen(liste, 'foto', erlaubt)).toEqual([])
    expect(sucheMeldungen(liste, 'cmcc', () => true).map((m) => m.id)).toEqual(['cmcccc3333'])
    expect(sucheMeldungen(liste, 'cmcc', erlaubt)).toEqual([])
    expect(sucheMeldungen(liste, '  ', () => true)).toEqual([])
  })
})

describe('Bescheid an Kundinnen — die Antwort bleibt Text', () => {
  it('maskiert Markup und hält Zeilen', () => {
    const html = bescheidMailHtml('<script>x</script>\n„Danke" & gut', 'Team')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;<br>„Danke&quot; &amp; gut')
  })
})

describe('Grenzen: Adresse und Eingaben', () => {
  it('unbekannte oder kaputte Werte in der Adresse heißen Standard, nie ein Fehler', () => {
    expect(meldungenAnsichtAus({ ansicht: 'quatsch', art: 'FEHLER!', von: '<x>', auf: 'gesammelt,boese', teil: '1', aeltere: 'ja', stand: 'x' })).toEqual({
      ansicht: 'ablauf',
      art: null,
      von: 'alle',
      auf: [],
      teil: 'brauchtDich',
      aeltere: false,
      buendel: null,
      stand: 'alle',
    })
    expect(meldungenAnsichtAus({ ansicht: ['wuensche', 'ablauf'], art: 'wunsch', von: 'kundschaft', auf: 'abgelegt,gesammelt', aeltere: '1', buendel: 'titelbild', stand: 'geplant' })).toMatchObject({
      ansicht: 'wuensche',
      art: 'WUNSCH',
      von: 'kundschaft',
      auf: ['abgelegt', 'gesammelt'],
      aeltere: true,
      buendel: 'titelbild',
      stand: 'geplant',
    })
  })

  it('Zusammenfassen lehnt die Selbstreferenz ab', () => {
    const r = zusammenfassenSchema.safeParse({ duplikatId: 'cmaaaa1111', hauptmeldungId: 'cmaaaa1111' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.message).toBe('Eine Meldung kann nicht ihr eigenes Duplikat sein.')
  })

  it('Stand für alle: Stand und Bescheid nur aus der Liste, leere Antwort heißt null', () => {
    expect(buendelStandSchema.safeParse({ clusterKey: 'k', stand: 'geloescht', bescheid: 'hoefe' }).success).toBe(false)
    expect(buendelStandSchema.parse({ clusterKey: ' k ', stand: 'geplant', sprintName: '', antwort: '  ', bescheid: 'niemand' })).toEqual({
      clusterKey: 'k',
      stand: 'geplant',
      sprintName: null,
      antwort: null,
      bescheid: 'niemand',
    })
  })
})
