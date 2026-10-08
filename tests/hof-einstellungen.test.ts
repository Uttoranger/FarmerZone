/**
 * Einstellungen in der HofShell (Gate 8, Nachtlauf Nr. 22d): Übersicht nach
 * den Mockups web-h1-einstellungen-uebersicht und mobil-h5-einstellungen, die
 * sechs Unterseiten umgezogen, /settings/konditionen neu nach K1 und B1.
 *
 * Beweist:
 *  - Alle Routen liegen in (hof) mit Ladeansicht, (farmer) hat keine mehr;
 *    die Seiten binden keine eigene Shell und keinen Bestandskopf ein.
 *  - Übersicht: acht Bereiche, die es gibt (keine Benachrichtigungen), jedes
 *    Ziel eine echte Seite; Status-Punkt aus derselben Liste wie Mein Hof.
 *  - Konditionen: Texte aus konditionen.ts (Übergang K1, Bar-Ausnahme B1),
 *    das Rechenbeispiel aus berechneServicegebuehr mit den Sätzen des Hofs.
 *  - Darstellung: vier Zustände, Punkt mit Text für Screenreader, lange
 *    Zeilen mit title, keine Farbwerte.
 */
import { describe, it, expect, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode; [k: string]: unknown }) => {
    const attribute = { ...rest }
    delete attribute.prefetch
    return createElement('a', { href, ...attribute }, children)
  },
}))
// Der Unterseiten-Kopf (Nr. 44) liest den Pfad, um die Elternseite zu finden.
const navigation = vi.hoisted(() => ({ pfad: '/settings/konditionen' }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pfad,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}))

const db = vi.hoisted(() => ({ farm: { findUnique: vi.fn() } }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import {
  BETRIEBSNUMMER_ANKER,
  RECHENBEISPIEL_WARENPREIS_CENTS,
  TON_TEXT,
  einstellungenBereiche,
  zahlungHinweis,
  konditionenRechenbeispiel,
  konditionenZeile,
  type EinstellungenDaten,
  type KonditionenHof,
} from '@/lib/hof-einstellungen'
import { hofseiteFortschritt, type HofseiteStand } from '@/lib/hofseite-fortschritt'
import {
  BAR_GEBUEHR_SEPA_SATZ,
  BAR_OHNE_GEBUEHR_SATZ,
  KONDITIONEN_UEBERGANG,
  ONLINE_GEBUEHR_ABGETRENNT_SATZ,
  ONLINE_GEBUEHR_MIT_PROVISION_SATZ,
  barGebuehrSepaSatz,
  MONATSABRECHNUNG_TEXT,
  TARIFE,
  TARIFE_AB,
  TARIFE_AB_TEXT,
  BAR_SERVICEGEBUEHR_AB,
} from '@/lib/konditionen'
import { formatEuro } from '@/lib/format'
import { ladeKonditionenHof } from '@/server/queries/einstellungen'
import { EinstellungenUebersicht } from '@/components/hof-einstellungen/einstellungen-uebersicht'
import { EinstellungenFehler } from '@/components/hof-einstellungen/einstellungen-fehler'
import { UnterseitenKopf } from '@/components/hofbereich/unterseiten-kopf'
import { KonditionenAnsicht } from '@/components/hof-einstellungen/konditionen-ansicht'
import {
  EinstellungenLaden,
  EinstellungenUnterseiteLaden,
  KonditionenLaden,
} from '@/components/hof-einstellungen/einstellungen-laden'

function quelle(pfad: string): string {
  return readFileSync(join(process.cwd(), pfad), 'utf8')
}

const VOR_STICHTAG = new Date('2026-10-06T10:00:00Z')
const NACH_STICHTAG = new Date(TARIFE_AB.getTime() + 24 * 3600 * 1000)
const LANG = 'Biohof am Sonnenhang mit Hofladen, Bauernbrot aus dem Holzofen und Eiern vom Freiland'

function stand(teil: Partial<HofseiteStand> = {}): HofseiteStand {
  return {
    name: 'Hof Sonnenhang',
    description: 'Eier und Brot',
    aboutText: 'Seit drei Generationen.',
    logoUrl: 'https://example.com/logo.jpg',
    bannerType: 'PHOTO',
    bannerUrl: 'https://example.com/titel.jpg',
    fotos: 3,
    address: 'Dorfstraße 1',
    postalCode: '8700',
    city: 'Teststadt',
    hatKoordinaten: true,
    abholzeiten: [{ dayOfWeek: 3, startTime: '15:00', endTime: '18:00' }],
    acceptsOnline: true,
    stripeAccountReady: true,
    phone: '+43 000 000',
    email: 'hof@example.com',
    isPaused: false,
    sektionen: [{ key: 'about', visible: true, order: 0 }],
    ...teil,
  }
}

function daten(teil: Partial<EinstellungenDaten> = {}, standTeil: Partial<HofseiteStand> = {}): EinstellungenDaten {
  const s = stand(standTeil)
  return {
    name: s.name,
    address: s.address,
    postalCode: s.postalCode,
    city: s.city,
    hofseiteZeilen: hofseiteFortschritt(s).gruppen.flatMap((g) => g.zeilen),
    abholzeiten: s.abholzeiten,
    abholzeitenGesamt: s.abholzeiten.length,
    stripeKontoDa: true,
    stripeBereit: true,
    onlineAn: true,
    betriebsnummer: 'AT 1234567',
    betriebsstatus: 'PRIMAERPRODUKTION',
    tarif: null,
    isPaused: false,
    stillgelegt: false,
    teilenMomenteAus: false,
    ...teil,
  }
}

function hof(teil: Partial<KonditionenHof> = {}): KonditionenHof {
  return {
    tarif: null,
    serviceFeePercent: '5',
    serviceFeeMinCents: 50,
    serviceFeeActiveFrom: new Date('2026-01-01T00:00:00Z'),
    platformFeePercent: '0',
    ...teil,
  }
}

const bereich = (liste: ReturnType<typeof einstellungenBereiche>, id: string) => {
  const b = liste.find((x) => x.id === id)
  if (!b) throw new Error(`kein Bereich ${id}`)
  return b
}

// ─── Routen ─────────────────────────────────────────────────────────────────

const UNTERSEITEN = ['profile', 'pickup-slots', 'payments', 'pause', 'account', 'appearance', 'konditionen', 'teilen']

describe('Routen in der HofShell', () => {
  it('/settings und alle Unterseiten liegen in (hof) mit Ladeansicht; (farmer) hat keine mehr', () => {
    expect(existsSync(join(process.cwd(), 'src/app/(hof)/settings/page.tsx'))).toBe(true)
    expect(existsSync(join(process.cwd(), 'src/app/(hof)/settings/loading.tsx'))).toBe(true)
    for (const seite of UNTERSEITEN) {
      expect(existsSync(join(process.cwd(), `src/app/(hof)/settings/${seite}/page.tsx`)), seite).toBe(true)
      expect(existsSync(join(process.cwd(), `src/app/(hof)/settings/${seite}/loading.tsx`)), seite).toBe(true)
    }
    expect(existsSync(join(process.cwd(), 'src/app/(farmer)/settings'))).toBe(false)
  })

  it('keine Seite bindet eine eigene Shell oder den Bestandskopf ein', () => {
    for (const seite of ['', ...UNTERSEITEN.map((s) => `${s}/`)]) {
      const text = quelle(`src/app/(hof)/settings/${seite}page.tsx`)
      expect(text, seite).not.toMatch(/from '@\/components\/shells\//)
      expect(text, seite).not.toMatch(/farmer\/page-header/)
    }
  })

  it('konditionen ist ein Unterordner, kein neuer Hof-Slug: /settings/:path* deckt ihn im Proxy ab', () => {
    expect(quelle('src/proxy.ts')).toContain("'/settings/:path*'")
    expect(existsSync(join(process.cwd(), 'src/app/(hof)/konditionen'))).toBe(false)
  })

  it('die Unterseiten behalten Wege und Sicherheit: Stripe nur über die bestehenden Actions, Bild-Uploads über den Editor-Baustein', () => {
    const zahlung = quelle('src/app/(hof)/settings/payments/payments-actions.tsx')
    expect(zahlung).toContain("from '@/server/actions/stripe-connect'")
    for (const action of ['createConnectAccount', 'createOnboardingLink', 'checkConnectStatus']) expect(zahlung).toContain(action)
    expect(quelle('src/components/farmer/hofseite-editor.tsx')).toContain("from '@/app/(hof)/settings/appearance/appearance-client'")
    // Die Bestandsliste der Farbliterale wandert mit der Datei, sie wächst nicht.
    expect(quelle('eslint.config.mjs')).toContain("'src/app/(hof)/settings/appearance/appearance-client.tsx'")
    expect(quelle('eslint.config.mjs')).not.toContain('(farmer)/settings')
  })
})

// ─── Zahlungs-Seite: genau eine Hinweiskarte ────────────────────────────────

describe('zahlungHinweis — eine Karte oben auf /settings/payments', () => {
  const bereit = { stripeBereit: true, onlineAn: true }

  it('ohne Stripe: „einrichten" — bei ?stripe=pending bzw. error stattdessen deren Karte, nie zwei', () => {
    expect(zahlungHinweis({ rueckmeldung: undefined, stripeBereit: false, onlineAn: true })).toBe('einrichten')
    expect(zahlungHinweis({ rueckmeldung: 'pending', stripeBereit: false, onlineAn: true })).toBe('fortsetzen')
    expect(zahlungHinweis({ rueckmeldung: 'error', stripeBereit: false, onlineAn: true })).toBe('fehler')
  })

  it('Stripe fertig, Online aus: „einschalten"', () => {
    expect(zahlungHinweis({ rueckmeldung: undefined, stripeBereit: true, onlineAn: false })).toBe('einschalten')
  })

  it('alles fertig: nichts, nach der Rückkehr von Stripe „geschafft"', () => {
    expect(zahlungHinweis({ rueckmeldung: undefined, ...bereit })).toBeNull()
    expect(zahlungHinweis({ rueckmeldung: 'success', ...bereit })).toBe('geschafft')
    // „geschafft" nur, wenn es stimmt.
    expect(zahlungHinweis({ rueckmeldung: 'success', stripeBereit: false, onlineAn: true })).toBe('einrichten')
    expect(zahlungHinweis({ rueckmeldung: 'success', stripeBereit: true, onlineAn: false })).toBe('einschalten')
  })

  it('die Seite fragt die Regel und zeigt „Verbunden und aktiv" nur mit Online an', () => {
    const seite = quelle('src/app/(hof)/settings/payments/page.tsx')
    expect(seite).toContain('zahlungHinweis(')
    expect(seite).toMatch(/onlineAn[\s\S]*Verbunden und aktiv/)
    expect(quelle('src/app/(hof)/settings/payments/payments-actions.tsx')).toContain('schalteOnlineZahlungEin')
  })
})

// ─── Übersicht ──────────────────────────────────────────────────────────────

describe('einstellungenBereiche', () => {
  it('neun Bereiche in fester Reihenfolge — keine Benachrichtigungen (gibt es nicht), dafür Mein Auftritt und an ihrer Stelle die Teilen-Hinweise (Nr. 30)', () => {
    const liste = einstellungenBereiche(daten(), VOR_STICHTAG)
    expect(liste.map((b) => b.id)).toEqual([
      'hofdaten',
      'auftritt',
      'abholzeiten',
      'zahlung',
      'futtermittel',
      'konditionen',
      'teilen',
      'urlaubsmodus',
      'konto',
    ])
    expect(liste.map((b) => b.titel).join(' ')).not.toMatch(/Benachrichtigung|SEPA-Mandat/)
  })

  it('jedes Ziel ist eine echte Seite unter (hof)/settings', () => {
    for (const b of einstellungenBereiche(daten(), VOR_STICHTAG)) {
      const pfad = b.href.split('#')[0]
      expect(existsSync(join(process.cwd(), `src/app/(hof)${pfad}/page.tsx`)), b.href).toBe(true)
    }
  })

  it('alles eingerichtet: grün, Hofdaten mit Name und Adresse, Abholzeiten kurz', () => {
    const liste = einstellungenBereiche(daten(), VOR_STICHTAG)
    expect(bereich(liste, 'hofdaten')).toMatchObject({ ton: 'fertig', zeile: 'Hof Sonnenhang · Dorfstraße 1, 8700 Teststadt' })
    expect(bereich(liste, 'auftritt').ton).toBe('fertig')
    expect(bereich(liste, 'abholzeiten')).toMatchObject({ ton: 'fertig', zeile: 'Mi 15–18' })
    expect(bereich(liste, 'zahlung')).toMatchObject({ ton: 'fertig' })
    expect(bereich(liste, 'zahlung').zeile).toContain('Online-Zahlung über Stripe aktiv')
    expect(bereich(liste, 'konto').ton).toBe('fertig')
  })

  it('was fehlt, kommt aus derselben Liste wie Mein Hof — orange mit „Es fehlt"', () => {
    const liste = einstellungenBereiche(daten({}, { logoUrl: null, fotos: 0, hatKoordinaten: false }), VOR_STICHTAG)
    expect(bereich(liste, 'auftritt')).toMatchObject({ ton: 'offen', zeile: 'Es fehlen: Logo und Fotos' })
    expect(bereich(liste, 'hofdaten')).toMatchObject({ ton: 'offen', zeile: 'Es fehlt: Adresse und Standort' })
  })

  it('Abholzeiten: keine bzw. alle pausiert ist orange', () => {
    expect(bereich(einstellungenBereiche(daten({ abholzeiten: [], abholzeitenGesamt: 0 }), VOR_STICHTAG), 'abholzeiten')).toMatchObject({
      ton: 'offen',
      zeile: 'Noch keine — erst dann können Kunden bestellen',
    })
    const pausiert = bereich(einstellungenBereiche(daten({ abholzeiten: [], abholzeitenGesamt: 2 }), VOR_STICHTAG), 'abholzeiten')
    expect(pausiert.ton).toBe('offen')
    expect(pausiert.zeile).toContain('pausiert')
  })

  it('Zahlung: Stripe halb eingerichtet oder ohne Konto ist orange — einrichten ist Pflicht (Z1)', () => {
    const halb = bereich(einstellungenBereiche(daten({ stripeBereit: false }), VOR_STICHTAG), 'zahlung')
    expect(halb).toMatchObject({ ton: 'offen' })
    expect(halb.zeile).toContain('noch nicht fertig')
    const ohne = bereich(einstellungenBereiche(daten({ stripeBereit: false, stripeKontoDa: false }), VOR_STICHTAG), 'zahlung')
    expect(ohne).toMatchObject({ ton: 'offen', zeile: 'Online-Zahlung noch nicht eingerichtet · bitte einrichten' })
  })

  it('Zahlung: Bestandshof mit Online aus (früher „nur bar") ist orange und soll Stripe einrichten — kein „ist aus" (Z1)', () => {
    const alt = bereich(einstellungenBereiche(daten({ stripeBereit: false, stripeKontoDa: false, onlineAn: false }), VOR_STICHTAG), 'zahlung')
    expect(alt).toMatchObject({ ton: 'offen', zeile: 'Online-Zahlung noch nicht eingerichtet · bitte einrichten' })
    expect(bereich(einstellungenBereiche(daten({ stripeBereit: false, onlineAn: false }), VOR_STICHTAG), 'zahlung').ton).toBe('offen')
    // Stripe fertig, Online aber aus: nicht als „aktiv" ausgeben — der Checkout bietet online dann nicht an.
    const fertigAberAus = bereich(einstellungenBereiche(daten({ stripeBereit: true, onlineAn: false }), VOR_STICHTAG), 'zahlung')
    expect(fertigAberAus.ton).toBe('offen')
    expect(fertigAberAus.zeile).not.toContain('aktiv')
  })

  it('Zahlung: Stripe fertig, Online aus — der Punkt nennt den Ausweg „einschalten" und führt zur Zahlungs-Seite', () => {
    const b = bereich(einstellungenBereiche(daten({ stripeBereit: true, onlineAn: false }), VOR_STICHTAG), 'zahlung')
    expect(b).toMatchObject({ ton: 'offen', href: '/settings/payments' })
    expect(b.zeile).toContain('einschalten')
  })

  it('Zahlung: nirgends eine Wahl „nur bar" für den Hof', () => {
    for (const ueber of [{ stripeBereit: false, stripeKontoDa: false, onlineAn: false }, { stripeBereit: false }, {}]) {
      expect(bereich(einstellungenBereiche(daten(ueber), VOR_STICHTAG), 'zahlung').zeile).not.toMatch(/nur bar|ist aus/i)
    }
  })

  it('Futtermittel: Nummer mit Betriebsart grün und Sprung zum Abschnitt; ohne Nummer nur zur Info', () => {
    const mit = bereich(einstellungenBereiche(daten(), VOR_STICHTAG), 'futtermittel')
    expect(mit).toMatchObject({ ton: 'fertig', zeile: 'Primärproduktion · AT 1234567', href: `/settings/profile#${BETRIEBSNUMMER_ANKER}` })
    expect(quelle('src/components/settings/profile-form.tsx')).toContain('BETRIEBSNUMMER_ANKER')
    const ohne = bereich(einstellungenBereiche(daten({ betriebsnummer: '  ' }), VOR_STICHTAG), 'futtermittel')
    expect(ohne.ton).toBe('neutral')
  })

  it('Teilen-Hinweise (Nr. 30): grau, sagt an oder aus und führt nach /settings/teilen', () => {
    const an = bereich(einstellungenBereiche(daten(), VOR_STICHTAG), 'teilen')
    expect(an).toMatchObject({ titel: 'Teilen-Hinweise', ton: 'neutral', href: '/settings/teilen' })
    expect(an.zeile).toMatch(/^An · /)
    const aus = bereich(einstellungenBereiche(daten({ teilenMomenteAus: true }), VOR_STICHTAG), 'teilen')
    expect(aus.zeile).toMatch(/^Aus · /)
    expect(aus.ton).toBe('neutral')
  })

  it('Urlaubsmodus an ist orange, aus grau; stillgelegt macht Konto orange', () => {
    expect(bereich(einstellungenBereiche(daten({ isPaused: true }), VOR_STICHTAG), 'urlaubsmodus')).toMatchObject({ ton: 'offen' })
    expect(bereich(einstellungenBereiche(daten(), VOR_STICHTAG), 'urlaubsmodus')).toMatchObject({ ton: 'neutral' })
    expect(bereich(einstellungenBereiche(daten({ stillgelegt: true }), VOR_STICHTAG), 'konto')).toMatchObject({ ton: 'offen' })
  })

  it('Konditionen: ohne Tarif der Übergang (K1), mit Tarif vor dem Stichtag „ab …", nie als heute fällig', () => {
    expect(konditionenZeile(null, VOR_STICHTAG)).toContain('In der Startphase kostenlos.')
    expect(konditionenZeile(null, VOR_STICHTAG)).toContain(TARIFE_AB_TEXT)
    const laden = TARIFE.find((t) => t.id === 'HOFLADEN')!
    expect(konditionenZeile('HOFLADEN', VOR_STICHTAG)).toBe(`${laden.name} · ${laden.preis} / Monat ab ${TARIFE_AB_TEXT}`)
    expect(konditionenZeile('HOFLADEN', NACH_STICHTAG)).toBe(`${laden.name} · ${laden.preis} / Monat`)
  })
})

// ─── Konditionen: Rechenbeispiel ────────────────────────────────────────────

describe('konditionenRechenbeispiel', () => {
  it('online: Gebühr nach E4 auf den Warenpreis, die Auszahlung bleibt der volle Warenpreis', () => {
    const r = konditionenRechenbeispiel(hof(), VOR_STICHTAG)
    expect(RECHENBEISPIEL_WARENPREIS_CENTS).toBe(2000)
    expect(r.satz).toBe(`Servicegebühr 5 %, mind. ${formatEuro(0.5)} – zahlt der Kunde`)
    expect(r.online.zeilen.map((z) => z.betrag)).toEqual([formatEuro(20), `+ ${formatEuro(1)}`, formatEuro(21), formatEuro(20)])
    expect(r.online.satz).toBe(ONLINE_GEBUEHR_ABGETRENNT_SATZ)
  })

  it('bar vor dem SEPA-Start ohne Gebühr (B1), mit dem Satz aus konditionen.ts', () => {
    const r = konditionenRechenbeispiel(hof(), new Date(BAR_SERVICEGEBUEHR_AB.getTime() - 1))
    expect(r.bar.zeilen.map((z) => z.betrag)).toEqual([formatEuro(20), `+ ${formatEuro(0)}`, formatEuro(20), formatEuro(20)])
    expect(r.bar.satz).toBe(BAR_OHNE_GEBUEHR_SATZ)
  })

  it('bar ab dem Stichtag mit Gebühr, die die Monatsabrechnung holt', () => {
    const r = konditionenRechenbeispiel(hof(), BAR_SERVICEGEBUEHR_AB)
    expect(r.bar.zeilen.map((z) => z.betrag)).toEqual([formatEuro(20), `+ ${formatEuro(1)}`, formatEuro(21), formatEuro(20)])
    expect(r.bar.satz).toBe(BAR_GEBUEHR_SEPA_SATZ)
  })

  it('Hof ohne eingeschaltete Gebühr: kein Satz mit Prozent, ehrlicher Grund statt Versprechen', () => {
    const r = konditionenRechenbeispiel(hof({ serviceFeeActiveFrom: null }), VOR_STICHTAG)
    expect(r.satz).toBeNull()
    expect(r.online.zeilen[1].betrag).toBe(`+ ${formatEuro(0)}`)
    expect(r.online.satz).toBe('Für deinen Hof ist derzeit keine Servicegebühr eingestellt.')
    const spaeter = konditionenRechenbeispiel(hof({ serviceFeeActiveFrom: new Date('2027-03-01T00:00:00Z') }), VOR_STICHTAG)
    expect(spaeter.online.satz).toContain('März 2027')
  })

  it('eigener Satz des Hofs zählt (z. B. 4,9 %), Mindestgebühr greift', () => {
    const r = konditionenRechenbeispiel(hof({ serviceFeePercent: '4.9', serviceFeeMinCents: 120 }), VOR_STICHTAG)
    expect(r.satz).toContain('4,9 %')
    expect(r.online.zeilen[1].betrag).toBe(`+ ${formatEuro(1.2)}`)
  })

  it('eine Provision steht als eigene Zeile da und geht von der Auszahlung ab — im Pilot 0, dann keine Zeile', () => {
    expect(konditionenRechenbeispiel(hof(), VOR_STICHTAG).online.zeilen.map((z) => z.label)).not.toContain('Provision')
    const r = konditionenRechenbeispiel(hof({ platformFeePercent: '3' }), VOR_STICHTAG)
    expect(r.online.zeilen.find((z) => z.label === 'Provision')?.betrag).toBe(`− ${formatEuro(0.6)}`)
    expect(r.online.zeilen.at(-1)?.betrag).toBe(formatEuro(19.4))
    // Mit Provision bleibt der Warenpreis nicht unberührt — der Satz sagt das.
    expect(r.online.satz).toBe(ONLINE_GEBUEHR_MIT_PROVISION_SATZ)
    expect(r.online.satz).not.toContain('unberührt')
    expect(r.mitProvision).toBe(true)
  })
})

describe('Sätze der Konditionen aus konditionen.ts', () => {
  it('der SEPA-Satz zur Bargebühr hängt an B1: vor dem Stichtag keiner, ab dann der bisherige', () => {
    expect(barGebuehrSepaSatz(new Date(BAR_SERVICEGEBUEHR_AB.getTime() - 1))).toBeNull()
    expect(barGebuehrSepaSatz(BAR_SERVICEGEBUEHR_AB)).toBe(BAR_GEBUEHR_SEPA_SATZ)
    // Vor dem Stichtag sagt das Rechenbeispiel nie „holt per SEPA".
    expect(konditionenRechenbeispiel(hof(), VOR_STICHTAG).bar.satz).not.toContain('SEPA')
  })

  it('kein Satz steht als Literal in hof-einstellungen.ts', () => {
    const text = quelle('src/lib/hof-einstellungen.ts')
    for (const satz of ['automatisch abgetrennt', 'holt die Monatsabrechnung']) expect(text, satz).not.toContain(satz)
  })
})

describe('ladeKonditionenHof', () => {
  it('nur der eigene Hof (ownerId), Decimal als Text — nichts über Number()', async () => {
    db.farm.findUnique.mockResolvedValueOnce({
      tarif: null,
      serviceFeePercent: { toString: () => '5.00' },
      serviceFeeMinCents: 50,
      serviceFeeActiveFrom: null,
      platformFeePercent: { toString: () => '0.00' },
    })
    const ergebnis = await ladeKonditionenHof('nutzer-1')
    expect(db.farm.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: 'nutzer-1' } }))
    expect(ergebnis).toEqual({
      tarif: null,
      serviceFeePercent: '5.00',
      serviceFeeMinCents: 50,
      serviceFeeActiveFrom: null,
      platformFeePercent: '0.00',
    })
    db.farm.findUnique.mockResolvedValueOnce(null)
    expect(await ladeKonditionenHof('niemand')).toBeNull()
  })
})

// ─── Darstellung ────────────────────────────────────────────────────────────

const html = (el: React.ReactElement) => renderToStaticMarkup(el)

describe('Übersicht gerendert', () => {
  const bereiche = einstellungenBereiche(daten({ name: LANG }, { name: LANG }), VOR_STICHTAG)
  const markup = html(createElement(EinstellungenUebersicht, { bereiche }))

  it('eine h1, neun Links auf die Bereiche, jeder Punkt mit Text für Screenreader', () => {
    expect(markup.match(/<h1\b/g)).toHaveLength(1)
    expect(markup).toContain('Einstellungen')
    for (const b of bereiche) {
      expect(markup).toContain(`href="${b.href}"`)
      expect(markup).toContain(TON_TEXT[b.ton])
    }
    expect(markup).toContain('href="/meldungen"')
  })

  it('lange Zeilen kürzen mit dem vollen Text im title; Punkt und Pfeil sind aria-hidden', () => {
    expect(markup).toContain(`title="${bereich(bereiche, 'hofdaten').zeile}"`)
    expect(markup).toContain('line-clamp-2')
    expect(markup).toMatch(/data-ton="fertig"[^>]*aria-hidden="true"|aria-hidden="true"[^>]*data-ton="fertig"/)
  })
})

describe('Konditionen gerendert', () => {
  const markup = html(createElement(KonditionenAnsicht, { hof: hof(), jetzt: VOR_STICHTAG }))

  it('Übergang K1 wörtlich, beide Tarife mit Preis, Monatsabrechnung, Rechenbeispiel', () => {
    expect(markup.match(/<h1\b/g)).toHaveLength(1)
    expect(markup).toContain(KONDITIONEN_UEBERGANG)
    for (const t of TARIFE) {
      expect(markup).toContain(t.name)
      expect(markup).toContain(t.preis)
    }
    expect(markup).toContain(MONATSABRECHNUNG_TEXT)
    expect(markup).toContain(BAR_OHNE_GEBUEHR_SATZ.replace(/"/g, '&quot;'))
    expect(markup).toContain('href="/settings"')
    expect(markup).toContain('href="/konditionen"')
  })

  it('kein „Dein Tarif", solange der Hof keinen gewählt hat; mit Tarif steht er da', () => {
    expect(markup).not.toContain('Dein Tarif')
    expect(html(createElement(KonditionenAnsicht, { hof: hof({ tarif: 'HOFLADEN' }), jetzt: VOR_STICHTAG }))).toContain('Dein Tarif')
  })

  it('verspricht nichts aus dem Mockup, was nicht gilt (Live gehen nach Stripe, Mail bei Satzänderung, Gründungshof)', () => {
    expect(markup).not.toMatch(/Gründungs|Plattformgebühr|vorab per E-Mail|Live gehst du/)
  })
})

describe('Kopf, Fehler, Laden', () => {
  it('Unterseiten-Kopf (seit Nr. 44 UnterseitenKopf): Rückweg zu den Einstellungen mit 44 px, eine h1', () => {
    navigation.pfad = '/settings/pickup-slots'
    const k = html(createElement(UnterseitenKopf, { titel: 'Abholzeiten', satz: 'Wann Kunden abholen.' }))
    navigation.pfad = '/settings/konditionen'
    expect(k).toContain('href="/settings"')
    expect(k).toContain('min-h-11')
    expect(k.match(/<h1\b/g)).toHaveLength(1)
  })

  it('Fehler inline als orange Hinweiskarte mit „Noch einmal versuchen"', () => {
    const f = html(createElement(EinstellungenFehler, { titel: 'Einstellungen', href: '/settings' }))
    expect(f).toContain('data-ton="orange"')
    expect(f).toContain('Noch einmal versuchen')
    expect(f).toContain('href="/settings"')
  })

  it('Ladeansichten sind Skelette mit aria-busy', () => {
    for (const el of [EinstellungenLaden, EinstellungenUnterseiteLaden, KonditionenLaden]) {
      expect(html(createElement(el))).toContain('aria-busy="true"')
    }
  })
})

describe('Quelltext', () => {
  const DATEIEN = [
    'src/components/hof-einstellungen/einstellungen-uebersicht.tsx',
    'src/components/hof-einstellungen/konditionen-ansicht.tsx',
    'src/components/hofbereich/unterseiten-kopf.tsx',
    'src/app/(hof)/settings/page.tsx',
    'src/app/(hof)/settings/payments/page.tsx',
    'src/app/(hof)/settings/account/page.tsx',
    'src/app/(hof)/settings/account/archive-farm-card.tsx',
    'src/app/(hof)/settings/account/password-form.tsx',
    'src/components/settings/pause-client.tsx',
    'src/components/settings/pickup-slots-client.tsx',
    'src/components/settings/profile-form.tsx',
  ]

  it('keine Tailwind-Rohfarben (amber, red, green, emerald) mehr in den umgezogenen Seiten', () => {
    for (const datei of DATEIEN) {
      expect(quelle(datei), datei).not.toMatch(/\b(?:bg|text|border)-(?:amber|red|green|emerald)-\d/)
    }
  })

  it('Symbole neben Text sind aria-hidden', () => {
    for (const datei of DATEIEN.slice(0, 3)) {
      const text = quelle(datei)
      for (const m of text.matchAll(/<([A-Z][A-Za-z]+) className="size-[^"]*"([^>]*)\/>/g)) {
        expect(m[2], `${datei}: ${m[1]}`).toContain('aria-hidden')
      }
    }
  })
})
