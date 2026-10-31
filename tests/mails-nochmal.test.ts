/**
 * „Alle Mails“ und „Nochmal schicken“ — die reinen Teile (Register N27,
 * Nr. 167; src/lib/betrieb-mails.ts, src/schemas/betrieb-mails.ts).
 *
 * Beweist, je mit Gegenprobe:
 *  - Wache: jede Art steht in GENAU einer der Listen NOCHMAL_ERLAUBT bzw.
 *    NOCHMAL_NIE; erlaubt sind nur Wichtig-Arten und der Bar-Bestätigungslink,
 *    nie Kann warten, nie ein Code (eine erfundene Liste schlägt an);
 *  - `maskiereAdresse` mit kurzen, langen und ungewöhnlichen Adressen;
 *  - `entschaerfeLinks`: kein Link mit Signatur oder Token im Ergebnis, auch
 *    nicht im Fließtext; Adressen nur gekürzt; harmlose Linktexte bleiben;
 *  - `passtNochmal`: Bezug fehlt, unpassender Stand, Bar-Link nur unbestätigt
 *    und in der Frist;
 *  - `mailDetail`: Knopf mit Bestätigungsschritt, aus mit Grund (Grenze 3,
 *    Stand), ohne Knopf bei Codes; Hinweise bei zugestellt bzw. abgelehnt;
 *  - die Zeilen der Liste und die Summen „Kann warten“ tragen keine Adresse;
 *  - die Adresse (`alleMailsAus`) nimmt nur bekannte Werte, sonst den Standard.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  ALLE_MAILS_TEXT,
  NOCHMAL_ERLAUBT,
  NOCHMAL_NIE,
  alleMailZeile,
  alleMailsHref,
  entschaerfeLinks,
  filterZeile,
  kannWartenZeile,
  mailDetail,
  maskiereAdresse,
  nochmalErlaubt,
  passtNochmal,
  type AlleMailRoh,
  type NochmalBestellung,
} from '@/lib/betrieb-mails'
import { alleMailsAus } from '@/schemas/betrieb-mails'
import { MAIL_ARTEN, MAIL_WEG } from '@/schemas/mail-auftrag'
import { GRUND_NICHT_BESTAETIGT } from '@/lib/fristen'

const JETZT = new Date('2026-10-24T07:42:00.000Z')

/** Die Prüfung der Wache — auch gegen eine erfundene Aufteilung (Gegenprobe). */
function aufteilungsFehler(erlaubt: readonly string[], nie: readonly string[], arten: readonly string[]): string[] {
  const fehler: string[] = []
  for (const art of arten) {
    const n = Number(erlaubt.includes(art)) + Number(nie.includes(art))
    if (n !== 1) fehler.push(`${art}: in ${n} Listen`)
  }
  for (const art of [...erlaubt, ...nie]) if (!arten.includes(art)) fehler.push(`${art}: keine Art`)
  return fehler
}

describe('Wache: jede Art in genau einer Liste', () => {
  it('MAIL_ARTEN ist vollständig und überschneidungsfrei aufgeteilt', () => {
    expect(aufteilungsFehler(NOCHMAL_ERLAUBT, NOCHMAL_NIE, MAIL_ARTEN)).toEqual([])
  })

  it('Gegenprobe: eine fehlende, eine doppelte und eine erfundene Art schlagen an', () => {
    const fehler = aufteilungsFehler([...NOCHMAL_ERLAUBT, 'beitrag'], NOCHMAL_NIE.filter((a) => a !== 'anmeldecode'), [...MAIL_ARTEN, 'neue-art'])
    expect(fehler).toEqual(expect.arrayContaining(['beitrag: in 2 Listen', 'anmeldecode: in 0 Listen', 'neue-art: in 0 Listen']))
  })

  it('erlaubt sind nur Wichtig-Arten, der Bar-Bestätigungslink und die Eingangsbestätigung des Widerrufs — nie Kann warten, nie ein Code oder eine Betreiber-Mail', () => {
    // Sonderfälle mit Weg Sofort: neuer Token (S17) bzw. Freigabe 200 Punkt 3 (Eingang sofort, nochmal erlaubt).
    for (const art of NOCHMAL_ERLAUBT) expect(art === 'bar-bestaetigungslink' || art === 'widerruf-eingang' || MAIL_WEG[art] === 'wichtig').toBe(true)
    for (const art of ['anmeldecode', 'bestellcode', 'passwort-link', 'login-link', 'admin-sicherheit', 'neue-anmeldung', 'beitrag', 'rundschreiben', 'bescheid', 'erstattung-offen', 'postfach'] as const) {
      expect(nochmalErlaubt(art)).toBe(false)
    }
    expect(nochmalErlaubt('abholbereit')).toBe(true)
  })
})

/** Ob der Worker-Teil der Warteschlange eine Nochmal-Zeile anders behandelt (Namen der beiden Spalten). */
function workerUnterscheidet(quelltext: string): boolean {
  const worker = quelltext.slice(quelltext.indexOf('// ─── Worker'))
  return /\b(ausloeser|nochmalVon)\b/.test(worker)
}

describe('Wache: der Worker behandelt Nochmal-Zeilen wie jede andere', () => {
  it('src/server/mail-warteschlange.ts liest ausloeser und nochmalVon im Worker nie — Post-Sperre (Z3) und Abmeldung gelten gleich', () => {
    const quelle = readFileSync('src/server/mail-warteschlange.ts', 'utf8')
    expect(quelle).toContain('// ─── Worker')
    expect(workerUnterscheidet(quelle)).toBe(false)
  })

  it('Gegenprobe: ein Worker mit Sonderweg für Support-Zeilen schlägt an', () => {
    expect(workerUnterscheidet("// ─── Worker\nif (auftrag.ausloeser === 'support') versende()")).toBe(true)
  })
})

describe('maskiereAdresse', () => {
  it.each([
    ['kundin@example.at', 'k•••@example.at'],
    ['a@b.at', 'a•••@b.at'],
    ['Sehr.Lange.Adresse+filter@sub.domain.example.com', 's•••@sub.domain.example.com'],
    ['  Ö@Example.AT ', 'ö•••@example.at'],
    ['"zitat@ung"@example.at', '"•••@example.at'],
    ['ohne-at', '•••'],
    ['@example.at', '•••'],
    ['kundin@', '•••'],
  ])('%s → %s', (roh, gekuerzt) => {
    expect(maskiereAdresse(roh)).toBe(gekuerzt)
  })

  it('Gegenprobe: der Teil vor dem @ steht nie ganz da', () => {
    expect(maskiereAdresse('erfundene.kundin@example.at')).not.toContain('erfundene')
  })
})

describe('entschaerfeLinks', () => {
  const MAIL = [
    '<p>Hallo Erika,</p>',
    '<a href="https://agrilo.at/lindenhof/bestaetigen/Ab3dEf6hIj9kLm2nOp5qRs8tUv1wXy4z" style="color:green">Abholung bestätigen</a>',
    '<a href="https://agrilo.at/orders/cmf1234567890abcdefghijk?sig=abc123def456">Bestellung ansehen</a>',
    '<a href=\'https://agrilo.at/abmelden?t=geheim\'>Abmelden</a>',
    '<a href="mailto:hof@example.at">hof@example.at</a>',
    '<a href="https://agrilo.at/hilfe">Hilfe</a>',
    '<p>Oder kopiere: https://agrilo.at/x/bestaetigen/Ab3dEf6hIj9kLm2nOp5qRs8tUv1wXy4z – Fragen an kundin.erfunden@example.at</p>',
    '<img src="https://agrilo.at/marke/logo-1234567890abcdef.png" alt="">',
  ].join('')

  it('kein Link mit Signatur oder Token, kein href, keine volle Adresse — auch nicht im Fließtext', () => {
    const aus = entschaerfeLinks(MAIL)
    for (const geheim of ['Ab3dEf6hIj9kLm2nOp5qRs8tUv1wXy4z', 'sig=', 't=geheim', 'href', 'mailto', 'kundin.erfunden@', 'hof@example.at']) expect(aus).not.toContain(geheim)
    expect(aus.match(/\[Link\]/g)?.length).toBe(5)
    expect(aus).toContain('k•••@example.at')
  })

  it('Gegenprobe: harmlose Linktexte und Bilder bleiben, der Text drumherum auch', () => {
    const aus = entschaerfeLinks(MAIL)
    expect(aus).toContain('<span>Hilfe</span>')
    expect(aus).toContain('Hallo Erika,')
    expect(aus).toContain('<img src="https://agrilo.at/marke/logo-1234567890abcdef.png"')
  })
})

const bestellung = (teil: Partial<NochmalBestellung> = {}): NochmalBestellung => ({
  status: 'READY',
  paymentMethod: 'ONLINE',
  paymentStatus: 'PAID',
  cancelReason: null,
  createdAt: new Date('2026-10-24T07:00:00.000Z'),
  pickupDate: new Date('2026-10-25T10:00:00.000Z'),
  pickupTimeStart: '15:00',
  farm: { archivedAt: null, geschlossenAm: null },
  ...teil,
})

describe('passtNochmal', () => {
  it('Bezug fehlt: Bestellung bzw. Hof gelöscht', () => {
    expect(passtNochmal('abholbereit', { bestellung: null, hof: null }, JETZT)).toEqual({ ok: false, grund: 'Die Bestellung gibt es nicht mehr.' })
    expect(passtNochmal('freischaltung', { bestellung: null, hof: null }, JETZT)).toEqual({ ok: false, grund: 'Den Hof gibt es nicht mehr.' })
  })

  it('unpassender Stand: „abholbereit“ für eine stornierte Bestellung — Gegenprobe bereit', () => {
    expect(passtNochmal('abholbereit', { bestellung: bestellung({ status: 'CANCELLED' }), hof: null }, JETZT)).toMatchObject({ ok: false, grund: expect.stringContaining('Passt nicht mehr') })
    expect(passtNochmal('abholbereit', { bestellung: bestellung(), hof: null }, JETZT)).toEqual({ ok: true })
    expect(passtNochmal('storniert', { bestellung: bestellung(), hof: null }, JETZT).ok).toBe(false)
    expect(passtNochmal('storniert', { bestellung: bestellung({ status: 'CANCELLED' }), hof: null }, JETZT).ok).toBe(true)
    expect(passtNochmal('bestellung-bezahlt-hof', { bestellung: bestellung({ paymentMethod: 'ONSITE_CASH', status: 'CONFIRMED' }), hof: null }, JETZT).ok).toBe(false)
    expect(passtNochmal('bar-bestaetigt-hof', { bestellung: bestellung({ paymentMethod: 'ONSITE_CASH', status: 'CONFIRMED' }), hof: null }, JETZT).ok).toBe(true)
  })

  it('Bar-Link: nur unbestätigt und in der Frist — bestätigt, verfallen und storniert nie', () => {
    const offen = bestellung({ status: 'PENDING_CONFIRMATION', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING' })
    expect(passtNochmal('bar-bestaetigungslink', { bestellung: offen, hof: null }, JETZT)).toEqual({ ok: true })
    expect(passtNochmal('bar-bestaetigungslink', { bestellung: { ...offen, status: 'CONFIRMED' }, hof: null }, JETZT).ok).toBe(false)
    expect(passtNochmal('bar-bestaetigungslink', { bestellung: { ...offen, status: 'CANCELLED', cancelReason: GRUND_NICHT_BESTAETIGT }, hof: null }, JETZT).ok).toBe(false)
    const spaet = new Date('2026-10-26T12:00:00.000Z')
    expect(passtNochmal('bar-bestaetigungslink', { bestellung: offen, hof: null }, spaet)).toEqual({ ok: false, grund: 'Die Frist zum Bestätigen ist vorbei.' })
  })

  it('NOCHMAL_NIE: immer nein, mit dem Satz der Gruppe', () => {
    expect(passtNochmal('anmeldecode', { bestellung: bestellung(), hof: null }, JETZT)).toEqual({ ok: false, grund: ALLE_MAILS_TEXT.nieCode })
    expect(passtNochmal('beitrag', { bestellung: null, hof: null }, JETZT)).toEqual({ ok: false, grund: ALLE_MAILS_TEXT.nieEinwilligung })
    expect(passtNochmal('meldung', { bestellung: null, hof: null }, JETZT)).toEqual({ ok: false, grund: ALLE_MAILS_TEXT.nieSonst })
  })
})

const roh = (teil: Partial<AlleMailRoh> = {}): AlleMailRoh => ({
  id: 'cmfauftrag0000000000001a',
  art: 'abholbereit',
  vorrang: 1,
  status: 'gesendet',
  versuche: 0,
  fehlerCode: null,
  erstelltAm: new Date('2026-10-24T07:12:00.000Z'),
  gesendetAm: new Date('2026-10-24T07:12:04.000Z'),
  naechsterVersuchAm: new Date('2026-10-24T07:12:00.000Z'),
  zugestelltAm: new Date('2026-10-24T07:12:09.000Z'),
  bounceAm: null,
  beschwerdeAm: null,
  bestellungId: 'bestellung_1',
  farmId: 'hof_1',
  ausloeser: 'system',
  nochmalVon: null,
  ...teil,
})

const ADRESSE = 'erfundene.kundin@example.at'
const detailEingabe = (teil: Partial<Parameters<typeof mailDetail>[0]> = {}): Parameters<typeof mailDetail>[0] => ({
  mail: roh(),
  nochmal: [],
  heute: 0,
  stand: { bestellung: bestellung(), hof: null },
  adresse: ADRESSE,
  bestellung: { id: 'bestellung_1', nummer: 'HM-2611-A4F2', hof: 'Testhof A' },
  hofName: 'Testhof A',
  ...teil,
})

describe('mailDetail', () => {
  it('zugestellt: Knopf mit Bestätigungsschritt (an wen gekürzt, Vermerk, Spam-Frage), Verlauf, Hinweis „Erst dann nochmal schicken.“', () => {
    const d = mailDetail(detailEingabe(), JETZT)
    expect(d.an).toBe('e•••@example.at · aus der Bestellung')
    expect(d.knopf).toMatchObject({ darf: true, heute: 'Heute 0 von 3 · fragt nach deinem Passkey', spam: true })
    if (!d.knopf.darf) throw new Error('Knopf erwartet')
    expect(d.knopf.punkte).toEqual(['Geht an e•••@example.at (aus der Bestellung).', ALLE_MAILS_TEXT.dialogStand, ALLE_MAILS_TEXT.dialogVermerk])
    expect(d.verlauf.map((v) => v.titel)).toEqual(['Eingestellt', 'An Resend übergeben', 'Zugestellt'])
    expect(d.zugestellt).toBe(true)
    expect(JSON.stringify(d)).not.toContain('erfundene')
  })

  it('Bar-Link: neuer Link, alter gilt nicht mehr, die Frist bleibt', () => {
    const offen = bestellung({ status: 'PENDING_CONFIRMATION', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING' })
    const d = mailDetail(detailEingabe({ mail: roh({ art: 'bar-bestaetigungslink', vorrang: 0 }), stand: { bestellung: offen, hof: null } }), JETZT)
    if (!d.knopf.darf) throw new Error('Knopf erwartet')
    expect(d.knopf.dialogTitel).toBe(ALLE_MAILS_TEXT.dialogTitelLink)
    expect(d.knopf.punkte[0]).toBe('Neuer Link an e•••@example.at (aus der Bestellung).')
    expect(d.knopf.punkte).toContain(ALLE_MAILS_TEXT.dialogAlterLink)
    expect(d.knopf.punkte.some((p) => p.startsWith('Die Frist bleibt '))).toBe(true)
  })

  it('aus mit Grund: 3-mal heute, wartende Mail, unpassender Stand — Gegenprobe 2-mal geht', () => {
    expect(mailDetail(detailEingabe({ heute: 3 }), JETZT).knopf).toEqual({ darf: false, grund: ALLE_MAILS_TEXT.grenze, heute: 'Heute 3 von 3 · fragt nach deinem Passkey' })
    expect(mailDetail(detailEingabe({ heute: 2 }), JETZT).knopf.darf).toBe(true)
    expect(mailDetail(detailEingabe({ mail: roh({ status: 'offen' }) }), JETZT).knopf).toMatchObject({ darf: false, grund: ALLE_MAILS_TEXT.standUnterwegs })
    expect(mailDetail(detailEingabe({ stand: { bestellung: bestellung({ status: 'CANCELLED' }), hof: null } }), JETZT).knopf.darf).toBe(false)
  })

  it('Nochmal-Stände (N27, Ergänzung 25.10.2026): gesperrt und verworfen mit eigenem Grund — Gegenprobe: gesendet, gescheitert, ohne Schlüssel haben den Knopf', () => {
    expect(mailDetail(detailEingabe({ mail: roh({ status: 'gesperrt' }) }), JETZT).knopf).toMatchObject({ darf: false, grund: ALLE_MAILS_TEXT.standGesperrt })
    expect(mailDetail(detailEingabe({ mail: roh({ status: 'verworfen' }) }), JETZT).knopf).toMatchObject({ darf: false, grund: ALLE_MAILS_TEXT.standVerworfen })
    expect(mailDetail(detailEingabe({ mail: roh({ status: 'in_arbeit' }) }), JETZT).knopf).toMatchObject({ darf: false, grund: ALLE_MAILS_TEXT.standUnterwegs })
    for (const status of ['gesendet', 'gescheitert', 'ohne_schluessel']) expect(mailDetail(detailEingabe({ mail: roh({ status }) }), JETZT).knopf.darf).toBe(true)
    expect(ALLE_MAILS_TEXT.standGesperrt).toContain('Test-Adressen')
    expect(ALLE_MAILS_TEXT.standVerworfen).toContain('Einwilligung')
  })

  it('Codes: kein Knopf, nur der Satz; die Adresse ist nicht gespeichert', () => {
    const d = mailDetail(detailEingabe({ mail: roh({ art: 'anmeldecode', vorrang: 0, bestellungId: null }), stand: { bestellung: null, hof: null }, adresse: null, bestellung: null }), JETZT)
    expect(d.knopf).toEqual({ darf: false, grund: ALLE_MAILS_TEXT.nieCode, heute: null })
    expect(d.an).toBe(ALLE_MAILS_TEXT.adresseUnbekannt)
    expect(d.zeigtVorschau).toBe(false)
  })

  it('abgelehnt: der Hinweis, nach der richtigen Adresse zu fragen; nochmal geschickte Zeilen stehen im Verlauf', () => {
    const d = mailDetail(detailEingabe({ mail: roh({ bounceAm: JETZT, zugestelltAm: null }), nochmal: [roh({ id: 'cmfauftrag0000000000002b', ausloeser: 'support', nochmalVon: 'cmfauftrag0000000000001a', erstelltAm: JETZT })] }), JETZT)
    expect(d.abgelehnt).toBe(true)
    expect(d.zugestellt).toBe(false)
    expect(d.nochmalText).toBe('einmal')
    expect(d.verlauf.at(-1)).toMatchObject({ titel: 'Nochmal geschickt · vom Support', id: 'cmfauftrag0000000000002b' })
  })
})

describe('Liste ohne Adresse', () => {
  it('Zeile: Zeit, deutscher Name, Weg, Bestellnummer, Stand, Versuche, vom Support', () => {
    const z = alleMailZeile(roh({ ausloeser: 'support', nochmalVon: 'x' }), { bestellnummern: new Map([['bestellung_1', 'HM-2611-A4F2']]), hoefe: new Map() }, JETZT)
    expect(z).toMatchObject({ zeit: '09:12', name: 'Nochmal: Abholbereit', weg: 'Wichtig', bezug: 'HM-2611-A4F2', stand: { wort: 'zugestellt' }, versuche: '0', vomSupport: true, hinweis: null })
    const code = alleMailZeile(roh({ art: 'anmeldecode', vorrang: 0, bestellungId: null, farmId: null }), { bestellnummern: new Map(), hoefe: new Map() }, JETZT)
    expect(code).toMatchObject({ name: 'Anmeldecode', bezug: '–', hinweis: ALLE_MAILS_TEXT.codeNie })
  })

  it('Kann warten nur als Summe: „Beitrag ‚…‘ · 412 gesendet · 3 abgelehnt“', () => {
    const z = kannWartenZeile({ art: 'beitrag', gruppe: 'p1', titel: 'Kürbisse sind da', erstelltAm: JETZT, gesendet: 412, offen: 0, gescheitert: 0, abgelehnt: 3, spam: 0 }, JETZT)
    expect(`${z.titel} · ${z.zahlen}`).toBe('Beitrag ‚Kürbisse sind da‘ · 412 gesendet · 3 abgelehnt')
    expect(kannWartenZeile({ art: 'bescheid', gruppe: 'm1', titel: null, erstelltAm: JETZT, gesendet: 2, offen: 1, gescheitert: 0, abgelehnt: 0, spam: 0 }, JETZT).titel).toBe('Bescheid zu einer Meldung')
  })
})

describe('Adresse der Seite (Zod)', () => {
  it('bekannte Werte und Cursor', () => {
    const p = alleMailsAus({ reiter: 'mails', liste: 'alle', art: 'abholbereit', weg: 'wichtig', stand: 'abgelehnt', zeitraum: '7t', hof: 'cmfhof1', support: '1', nach: '1761291120000.cmfauftrag0000000000001a', mail: 'cmfauftrag0000000000001a' })
    expect(p).toEqual({
      liste: true,
      filter: { art: 'abholbereit', weg: 'wichtig', stand: 'abgelehnt', zeitraum: '7t', hof: 'cmfhof1', support: true },
      nach: { am: new Date(1761291120000), id: 'cmfauftrag0000000000001a' },
      mail: 'cmfauftrag0000000000001a',
    })
  })

  it('Gegenprobe: Unbekanntes, Doppeltes und Adressen werden zum Standard', () => {
    const p = alleMailsAus({ liste: ['alle', 'alle'], art: 'gibt-es-nicht', stand: 'bounce', zeitraum: '365t', hof: 'kundin@example.at', support: 'ja', nach: 'x', mail: 'kundin@example.at' })
    expect(p).toEqual({ liste: false, filter: { art: null, weg: null, stand: null, zeitraum: '90t', hof: null, support: false }, nach: null, mail: null })
  })

  it('alleMailsHref und alleMailsAus passen zusammen; die Filterzeile am Handy', () => {
    const f = { art: 'storniert', weg: null, stand: 'gescheitert', zeitraum: '30t', hof: null, support: true } as const
    const q = Object.fromEntries(new URL(alleMailsHref(f, { mail: 'cmfauftrag0000000000001a' }), 'https://x.at').searchParams)
    expect(alleMailsAus(q)).toMatchObject({ liste: true, filter: f, mail: 'cmfauftrag0000000000001a' })
    expect(filterZeile(f, null)).toBe('Storniert · gescheitert · 30 Tage · alle Höfe · nur vom Support')
  })
})
