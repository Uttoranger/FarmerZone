/**
 * Admin › Betrieb plausibel (Register N18, Ergänzung 24.10.2026; Nachtlauf Nr. 162).
 *
 * Beweist rein, ohne Datenbank (src/lib/betrieb.ts):
 *  - Supabase Pro: 8 GB und 250 GB aus GRENZEN; Kachel, Tarif-Zeile, Warn-Mail
 *    und „Nur im Dashboard“ sagen nichts mehr von „nur noch lesbar“, „ohne
 *    Sicherung“ oder „Pausiert“ — die Gegenprobe mit Free sagt es weiter.
 *  - Resend Pro vorbereitet: `mailsTag: null` heißt keine Tagesgrenze, keine
 *    Prozent, keine Tageswarnung; `TARIFE.resend` bleibt Free.
 *  - Der Monat der E-Mails ist der Abrechnungszeitraum von Resend (ab dem 17.,
 *    0 Uhr UTC): am 16., 17. und 18. und über den Jahreswechsel; Bild-Vorgänge
 *    bleiben beim Kalendermonat.
 *  - Vercel-Ausgaben ehrlich: nie gemeldet, früher gemeldet, im Zeitraum gemeldet.
 *  - Die Wache: Kein Text in src/lib/betrieb.ts nennt eine feste Grenzzahl.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import {
  GRENZE,
  GRENZEN,
  NUR_IM_DASHBOARD,
  RESEND_ABRECHNUNG_TAG,
  TARIFE,
  betriebKacheln,
  betriebMail,
  grenzSchritt,
  grenzStandText,
  grenzTexte,
  grenzeFuer,
  monatsBeginn,
  resendAbrechnungsBeginn,
  resendAbrechnungsEnde,
  tarifZeilen,
  vercelAusgabenKarte,
  warnEintraege,
  type Messung,
  type Tarife,
} from '@/lib/betrieb'

const T = (iso: string): Date => new Date(iso)
const m = (tag: string, art: Messung['art'], wert: number): Messung => ({ tag, art, wert, gemessenAm: T(`${tag}T04:05:00Z`) })
const FREE_DB: Tarife = { ...TARIFE, supabase: 'FREE' }
const RESEND_PRO: Tarife = { ...TARIFE, resend: 'PRO' }

describe('Supabase Pro (Nr. 162)', () => {
  it('Tarife: Supabase Pro mit 8 GB und 250 GB im Monat; Resend bleibt Free', () => {
    expect(TARIFE).toEqual({ vercel: 'PRO', supabase: 'PRO', resend: 'FREE' })
    expect(GRENZEN.supabase.PRO).toEqual({ datenbankBytes: 8_000_000_000, uebertragungBytesMonat: 250_000_000_000 })
    expect(GRENZE).toMatchObject({ datenbankBytes: 8_000_000_000, datenbankUebertragungBytesMonat: 250_000_000_000, mailsTag: 100, mailsMonat: 3_000 })
  })

  it('Kachel bei Pro: von 8 GB, inklusive und „kostet extra“, nie „nur noch lesbar“ — Free sagt es weiter (Gegenprobe)', () => {
    const jetzt = T('2026-10-24T08:00:00Z')
    const messungen = [m('2026-10-24', 'datenbankBytes', 15_000_000)]
    const db = betriebKacheln(messungen, jetzt)[1]
    expect(db).toMatchObject({ tarif: 'Supabase Pro', wert: '15 MB', von: 'von 8 GB', prozent: '0 %', warnt: false })
    expect(db.satz).toBe('8 GB inklusive, darüber wächst der Speicher automatisch und kostet extra.')
    expect(`${db.satz} ${db.kurz}`).not.toMatch(/nur noch lesbar/)
    const frei = betriebKacheln(messungen, jetzt, FREE_DB)[1]
    expect(frei).toMatchObject({ tarif: 'Supabase Free', von: 'von 500 MB', prozent: '3 %' })
    expect(frei.satz).toBe('Bei 500 MB nur noch lesbar – keine neuen Bestellungen.')
  })

  it('Warnstufen: 80/95/100 % von 8 GB', () => {
    const jetzt = T('2026-10-24T08:00:00Z')
    const anteilBei = (bytes: number): string | null => betriebKacheln([m('2026-10-24', 'datenbankBytes', bytes)], jetzt)[1].prozent
    expect(anteilBei(6_400_000_000)).toBe('80 %')
    expect(betriebKacheln([m('2026-10-24', 'datenbankBytes', 6_400_000_000)], jetzt)[1].warnt).toBe(true)
    expect(betriebKacheln([m('2026-10-24', 'datenbankBytes', 6_390_000_000)], jetzt)[1].warnt).toBe(false)
    expect(anteilBei(7_600_000_000)).toBe('95 %')
    expect(anteilBei(8_000_000_000)).toBe('100 %')
  })

  it('Tarif-Zeile: „Pro · tägliche Sicherung (7 Tage)“ ohne Ton „tun“; „Pausiert nach 7 Tagen“ nur bei Free', () => {
    const pro = tarifZeilen().find((z) => z.dienst === 'Supabase')
    expect(pro).toMatchObject({ marke: 'Pro · tägliche Sicherung (7 Tage)' })
    expect(pro?.ton).not.toBe('tun')
    expect(pro?.satz).toMatch(/8 GB/)
    expect(pro?.satz).toMatch(/250 GB/)
    expect(`${pro?.marke} ${pro?.satz}`).not.toMatch(/Pausiert|ohne Sicherung|nur noch lesbar/)
    const frei = tarifZeilen(FREE_DB).find((z) => z.dienst === 'Supabase')
    expect(frei).toMatchObject({ marke: 'Free · ohne Sicherung', ton: 'tun' })
    expect(frei?.satz).toMatch(/Pausiert nach 7 Tagen ohne Zugriff\.$/)
  })

  it('Nur im Dashboard: die Übertragung aus GRENZE (250 GB), nicht „5 GB“', () => {
    const supabase = NUR_IM_DASHBOARD.find((d) => d.titel === 'Supabase › Usage')
    expect(supabase?.satz).toBe('Übertragung (250 GB), aktive Konten')
  })

  it('Warn-Mail bei Pro: „kostet ab dann extra“, kein „nur noch lesbar“, kein „Supabase Pro mit 8 GB“ als Hilfe — Free bleibt (Gegenprobe)', () => {
    const mail = betriebMail({ art: 'grenze', wert: 'datenbank', anteil: 82, stand: grenzStandText('datenbank', 6_560_000_000), trend: null, ohneVerwendungBytes: null })
    expect(mail.absaetze[0]).toMatch(/^6,6 GB von 8 GB sind belegt\. /)
    expect(mail.absaetze[0]).toMatch(/kostet ab dann extra/)
    expect(mail.absaetze[0]).not.toMatch(/nur noch lesbar/)
    expect(mail.hilft).not.toMatch(/Supabase Pro/)
    const frei = grenzTexte(FREE_DB).datenbank
    expect(frei.voll).toBe('Bei 500 MB ist die Datenbank nur noch lesbar – keine neuen Bestellungen.')
    expect(frei.hilft).toBe('Supabase Pro mit 8 GB.')
  })
})

describe('Resend Pro vorbereitet: mailsTag null (Nr. 162)', () => {
  const jetzt = T('2026-10-24T08:00:00Z')

  it('GRENZEN.resend.PRO ohne Tagesgrenze, 50.000 im Monat', () => {
    expect(GRENZEN.resend.PRO).toEqual({ mailsTag: null, mailsMonat: 50_000 })
    expect(grenzeFuer(RESEND_PRO)).toMatchObject({ mailsTag: null, mailsMonat: 50_000 })
  })

  it('keine Tageswarnung: ohne Anteil kein Schritt, eine alte Stufe geht still auf 0 — mit Grenze warnt der Tag (Gegenprobe)', () => {
    expect(grenzSchritt('tag', null, null, jetzt)).toEqual({ tun: 'nichts' })
    expect(grenzSchritt('tag', { stufe: 1, gemeldetAm: T('2026-10-23T04:00:00Z') }, null, jetzt)).toEqual({ tun: 'still' })
    expect(grenzSchritt('tag', null, 85, jetzt)).toEqual({ tun: 'warnen', stufe: 1 })
  })

  it('Kachel: keine Prozent, kein Balken, „ohne Tagesgrenze“; der Monat zählt gegen 50.000 — Free mit Prozent (Gegenprobe)', () => {
    const messungen = [m('2026-10-24', 'mails', 140), m('2026-10-20', 'mails', 60)]
    const mails = betriebKacheln(messungen, jetzt, RESEND_PRO)[2]
    expect(mails).toMatchObject({ tarif: 'Resend Pro', wert: '140', anteil: null, prozent: null, warnt: false, von: 'ohne Tagesgrenze' })
    expect(mails.ohneGrenze).toBe('Keine Tagesgrenze – es zählt nur der Monat.')
    expect(mails.zeile).toMatch(/: 200 von 50\s000 \(0\s%\) · zählt je Empfänger$/)
    const frei = betriebKacheln(messungen, jetzt)[2]
    expect(frei).toMatchObject({ prozent: '140 %', warnt: true, ohneGrenze: null, von: 'von 100' })
  })

  it('Stand, Warnkarte und Tarif-Zeile kommen ohne Tagesgrenze zurecht', () => {
    expect(grenzTexte(RESEND_PRO).mailsTag.voll).toBe('Keine Tagesgrenze – es zählt nur der Monat.')
    expect(tarifZeilen(RESEND_PRO).find((z) => z.dienst === 'Resend')?.satz).toMatch(/^Keine Tagesgrenze, 50\s000 E-Mails im Monat \(ab dem 17\.\)\.$/)
    expect(tarifZeilen().find((z) => z.dienst === 'Resend')?.satz).toMatch(/^100 E-Mails am Tag, 3\s000 im Monat \(ab dem 17\.\)\.$/)
    // Eine noch offene Tageswarnung aus dem alten Tarif zeigt keinen Anteil — der Hinweis aus der Stufe genügt.
    expect(warnEintraege([{ art: 'mailsTag', stufe: 1, gemeldetAm: T('2026-10-24T04:00:00Z') }], [], [], [], jetzt, true)).toHaveLength(1)
  })
})

describe('Abrechnungszeitraum der E-Mails: ab dem 17., 0 Uhr UTC (Nr. 162)', () => {
  const iso = (d: Date): string => d.toISOString()

  it.each([
    ['2026-10-16T23:59:59.999Z', '2026-09-17T00:00:00.000Z', '2026-10-17T00:00:00.000Z'],
    ['2026-10-17T00:00:00.000Z', '2026-10-17T00:00:00.000Z', '2026-11-17T00:00:00.000Z'],
    ['2026-10-18T12:00:00.000Z', '2026-10-17T00:00:00.000Z', '2026-11-17T00:00:00.000Z'],
    ['2026-12-31T23:00:00.000Z', '2026-12-17T00:00:00.000Z', '2027-01-17T00:00:00.000Z'],
    ['2027-01-05T10:00:00.000Z', '2026-12-17T00:00:00.000Z', '2027-01-17T00:00:00.000Z'],
    ['2027-01-17T00:00:00.000Z', '2027-01-17T00:00:00.000Z', '2027-02-17T00:00:00.000Z'],
  ])('%s → Beginn %s, Ende %s', (jetzt, beginn, ende) => {
    expect(RESEND_ABRECHNUNG_TAG).toBe(17)
    expect(iso(resendAbrechnungsBeginn(T(jetzt)))).toBe(beginn)
    expect(iso(resendAbrechnungsEnde(T(jetzt)))).toBe(ende)
  })

  it('Monatsfenster: E-Mails im Abrechnungszeitraum, Bild-Vorgänge im Kalendermonat', () => {
    const jetzt = T('2026-11-03T08:00:00Z')
    expect(iso(monatsBeginn('mailsMonat', jetzt))).toBe('2026-10-17T00:00:00.000Z')
    expect(iso(monatsBeginn('mails', jetzt))).toBe('2026-10-17T00:00:00.000Z')
    expect(iso(monatsBeginn('bildVorgaenge', jetzt))).toBe('2026-11-01T00:00:00.000Z')
    expect(iso(monatsBeginn('bilderAuflistungen', jetzt))).toBe('2026-11-01T00:00:00.000Z')
  })

  const mails = [m('2026-09-20', 'mails', 3), m('2026-10-02', 'mails', 40), m('2026-10-16', 'mails', 5), m('2026-10-17', 'mails', 7), m('2026-10-18', 'mails', 11)]
  const zeileAm = (jetzt: string, messungen = mails): string => betriebKacheln(messungen, T(jetzt))[2].zeile

  it('Kachel am 16.: der Zeitraum ab 17. Sep — der 20. Sep zählt mit (Kalendermonat ergäbe 45)', () => {
    expect(zeileAm('2026-10-16T08:00:00Z')).toMatch(/^Monat 17\. Sep – 16\. Okt: 48 von 3\s000 \(1\s%\) · zählt je Empfänger$/)
  })

  it('Kachel am 17.: neuer Zeitraum, nur der 17. zählt', () => {
    expect(zeileAm('2026-10-17T08:00:00Z')).toMatch(/^Monat 17\. Okt – 16\. Nov: 7 von 3\s000/)
  })

  it('Kachel am 18.: 17. und 18. zählen, der 16. nicht', () => {
    expect(zeileAm('2026-10-18T08:00:00Z')).toMatch(/^Monat 17\. Okt – 16\. Nov: 18 von 3\s000/)
  })

  it('Kachel über den Jahreswechsel: Dezember zählt im Januar mit (Kalendermonat ergäbe 6)', () => {
    const messungen = [m('2026-12-16', 'mails', 100), m('2026-12-20', 'mails', 4), m('2027-01-05', 'mails', 6)]
    expect(zeileAm('2027-01-05T08:00:00Z', messungen)).toMatch(/^Monat 17\. Dez – 16\. Jän: 10 von 3\s000/)
  })

  it('Monatsregel mit dem Abrechnungszeitraum: eine Warnung vom 10. zählt am 18. nicht mehr, eine vom 20. am 1. noch — Kalendermonat umgekehrt (Gegenprobe)', () => {
    const vom10 = { stufe: 1, gemeldetAm: T('2026-10-10T04:00:00Z') }
    const am18 = T('2026-10-18T04:00:00Z')
    expect(grenzSchritt('monat', vom10, 85, am18, monatsBeginn('mailsMonat', am18))).toEqual({ tun: 'warnen', stufe: 1 })
    expect(grenzSchritt('monat', vom10, 85, am18)).toEqual({ tun: 'nichts' })
    const vom20 = { stufe: 1, gemeldetAm: T('2026-10-20T04:00:00Z') }
    const am1 = T('2026-11-01T04:00:00Z')
    expect(grenzSchritt('monat', vom20, 85, am1, monatsBeginn('mailsMonat', am1))).toEqual({ tun: 'nichts' })
    expect(grenzSchritt('monat', vom20, 85, am1)).toEqual({ tun: 'warnen', stufe: 1 })
  })

  it('Warnkarte „E-Mails im Monat“ rechnet den Anteil im Abrechnungszeitraum', () => {
    const jetzt = T('2026-11-02T08:00:00Z')
    const messungen = [m('2026-10-20', 'mails', 2_000), m('2026-11-02', 'mails', 500)]
    const [eintrag] = warnEintraege([{ art: 'mailsMonat', stufe: 1, gemeldetAm: T('2026-10-30T04:00:00Z') }], [], [], messungen, jetzt, true)
    expect(eintrag.titel).toMatch(/^E-Mails im Monat bei 83\s%$/)
    expect(eintrag.saetze[0]).toMatch(/bis zum 17\. keine E-Mail mehr/)
  })
})

describe('Vercel-Ausgaben ehrlich (Nr. 162)', () => {
  const jetzt = T('2026-10-24T09:00:00Z')

  it('nie eine Meldung: „Noch keine Meldung von Vercel …“, kein „Unter 50 %“', () => {
    const karte = vercelAusgabenKarte([], jetzt)
    expect(karte).toEqual({
      gemeldet: false,
      satz: 'Noch keine Meldung von Vercel. Vercel meldet erst ab 50 % des Limits – ob die Meldung eingerichtet ist, steht in Vercel › Settings › Billing.',
      kurz: 'Noch keine Meldung',
    })
  })

  it('frühere Meldung (vor dem Zeitraum): „Unter 50 % (letzte Meldung <Datum>).“ ohne Betrag', () => {
    const karte = vercelAusgabenKarte([m('2026-09-25', 'vercelAusgaben', 2600), m('2026-09-25', 'vercelLimit', 5000)], jetzt)
    expect(karte).toEqual({ gemeldet: false, satz: 'Unter 50 % (letzte Meldung 25. Sep).', kurz: 'Unter 50 %' })
    expect(karte.satz).not.toMatch(/\$/)
  })

  it('Meldung im laufenden Zeitraum: der Betrag', () => {
    const karte = vercelAusgabenKarte([m('2026-10-21', 'vercelAusgaben', 2510), m('2026-10-21', 'vercelLimit', 5000)], jetzt)
    expect(karte.gemeldet).toBe(true)
    expect(karte.satz).toMatch(/^Zuletzt gemeldet: 25,10 \$ von 50 \$ \(50\s%\) am /)
  })
})

describe('Wache: keine feste Grenzzahl in den Texten von src/lib/betrieb.ts (Nr. 162)', () => {
  /** Feste Grenzzahlen: Speicher mit Einheit (außer „0 MB“ der Anzeige), Tausender mit Punkt, eine Zahl vor „E-Mails“. */
  const GRENZZAHL = [/\b[1-9]\d*(?:[.,]\d+)?\s?(?:kB|MB|GB|TB)\b/, /\b\d{1,3}(?:\.\d{3})+\b/, /\b\d+\s+E-Mails\b/]
  const festeZahl = (text: string): boolean => GRENZZAHL.some((r) => r.test(text))

  /** Jeder Text im Quelltext: Zeichenketten und die festen Teile von Vorlagen — Kommentare zählen nicht. */
  function texte(quelle: string): string[] {
    const datei = ts.createSourceFile('betrieb.ts', quelle, ts.ScriptTarget.Latest, true)
    const funde: string[] = []
    const besuche = (knoten: ts.Node): void => {
      if (ts.isStringLiteral(knoten) || ts.isNoSubstitutionTemplateLiteral(knoten)) funde.push(knoten.text)
      if (ts.isTemplateExpression(knoten)) funde.push(knoten.head.text, ...knoten.templateSpans.map((s) => s.literal.text))
      ts.forEachChild(knoten, besuche)
    }
    besuche(datei)
    return funde
  }

  it('erkennt feste Grenzzahlen (Gegenprobe) und lässt Zahlen aus GRENZE durch', () => {
    const probe = texte('const a = "Bei 500 MB nur noch lesbar"; const b = `Übertragung (5 GB)`; const c = \'3.000 im Monat\'; const d = `${x} E-Mails, 100 E-Mails am Tag`; const f = \'0 MB\'; const e = `Bei ${grenze} nur noch lesbar`; // 8 GB im Kommentar')
    expect(probe.filter(festeZahl)).toEqual(['Bei 500 MB nur noch lesbar', 'Übertragung (5 GB)', '3.000 im Monat', ' E-Mails, 100 E-Mails am Tag'])
  })

  it('src/lib/betrieb.ts: kein Text mit fester Grenzzahl', () => {
    const quelle = readFileSync(join(process.cwd(), 'src/lib/betrieb.ts'), 'utf8')
    expect(texte(quelle).filter(festeZahl)).toEqual([])
  })
})
