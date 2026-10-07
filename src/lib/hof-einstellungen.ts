/**
 * Einstellungen des Hofs (/settings und /settings/konditionen, Nachtlauf
 * Nr. 22d, Gate 8) — rein und ohne Datenbank prüfbar
 * (tests/hof-einstellungen.test.ts).
 *
 * Die Übersicht (Mockups web-h1-einstellungen-uebersicht, mobil-h5-einstellungen)
 * zeigt acht Bereiche mit Status-Punkt. Es stehen nur Bereiche da, die es gibt:
 * „Benachrichtigungen" aus dem Mockup hat keine Einstellung im Code und fehlt
 * deshalb; „Mein Auftritt" (eine bestehende Seite ohne Platz im Mockup) steht
 * dafür da. Was fehlt, zählt dieselbe Liste wie „Mein Hof" und „Einrichten"
 * (hofseiteFortschritt, EINSTELLUNG_FUER_ZEILE) — eine Zahl, an keiner Stelle
 * anders gerechnet.
 *
 * Die Konditionen nennen Tarife und Übergang nur aus konditionen.ts (K1) und
 * rechnen das Beispiel mit DER Gebührenregel (berechneServicegebuehr) und den
 * gespeicherten Sätzen DIESES Hofs — die Seite verspricht nichts, was nicht
 * schon gilt (keine neuen Vertragszusagen).
 */
import type { Betriebsstatus, Tarif } from '@prisma/client'
import { aufzaehlung, abholzeitenKurz, EINSTELLUNG_FUER_ZEILE, type HofseiteZeile } from '@/lib/hofseite-fortschritt'
import type { WeeklySlot } from '@/lib/pickup-days'
import { BETRIEBSNUMMER_ANKER, BETRIEBSSTATUS } from '@/lib/taxonomie'
import {
  BAR_OHNE_GEBUEHR_SATZ,
  PRO_MONAT,
  STARTPHASE_SATZ,
  TARIFE_AB,
  TARIFE_AB_SATZ,
  TARIFE_AB_TEXT,
  tarifText,
} from '@/lib/konditionen'
import { barOhneServicegebuehr, berechneServicegebuehr, type ServicegebuehrEinstellung } from '@/lib/servicegebuehr'
import { calcPlatformFeeAmount, decimalZuCents, type DecimalEingabe } from '@/lib/order-totals'
import { centsAlsEuro, formatDatumLang, formatEuro, formatZahl } from '@/lib/format'
import { Decimal } from '@prisma/client/runtime/index-browser'

/** Weitergereicht: Das Sprungziel steht in taxonomie.ts, weil das Hofprofil (Client) es auch braucht. */
export { BETRIEBSNUMMER_ANKER }

// ─── Übersicht ──────────────────────────────────────────────────────────────

/** Der Status-Punkt: grün eingerichtet, orange braucht dich, grau nur zur Info. */
export type EinstellungTon = 'fertig' | 'offen' | 'neutral'

export type EinstellungBereichId =
  | 'hofdaten'
  | 'auftritt'
  | 'abholzeiten'
  | 'zahlung'
  | 'futtermittel'
  | 'konditionen'
  | 'urlaubsmodus'
  | 'konto'

export type EinstellungBereich = {
  id: EinstellungBereichId
  titel: string
  /** Was gerade eingestellt ist — eine Zeile, die Anzeige kürzt nach zwei. */
  zeile: string
  ton: EinstellungTon
  href: string
}

/** Was der Punkt bedeutet — für Screenreader neben dem Punkt (der Punkt allein ist nur Farbe). */
export const TON_TEXT: Record<EinstellungTon, string> = {
  fertig: 'Eingerichtet',
  offen: 'Braucht dich',
  neutral: 'Zur Info',
}

export const EINSTELLUNGEN_TITEL = 'Einstellungen'
export const EINSTELLUNGEN_SATZ = 'Alles rund um deinen Hof an einem Ort.'

export type EinstellungenDaten = {
  name: string
  address: string
  postalCode: string
  city: string
  /** Die Zeilen der Hofseiten-Liste (hofseiteFortschritt) — sie sagen, was fehlt. */
  hofseiteZeilen: readonly HofseiteZeile[]
  /** Nur aktive Abholzeiten; `abholzeitenGesamt` zählt auch pausierte. */
  abholzeiten: readonly WeeklySlot[]
  abholzeitenGesamt: number
  stripeKontoDa: boolean
  stripeBereit: boolean
  betriebsnummer: string | null
  betriebsstatus: Betriebsstatus | null
  tarif: Tarif | null
  isPaused: boolean
  stillgelegt: boolean
}

/** Die Titel der fehlenden Zeilen, deren Formular auf dieser Einstellungsseite liegt. */
function fehlendAuf(zeilen: readonly HofseiteZeile[], ziel: string): string[] {
  return zeilen.filter((z) => EINSTELLUNG_FUER_ZEILE[z.id] === ziel && !z.fertig).map((z) => z.titel)
}

function esFehlt(teile: readonly string[]): string {
  return `Es ${teile.length === 1 ? 'fehlt' : 'fehlen'}: ${aufzaehlung(teile)}`
}

/**
 * Die acht Bereiche der Übersicht, in der Reihenfolge des Mockups (Mein
 * Auftritt gleich nach den Hofdaten, wo er inhaltlich hingehört).
 */
export function einstellungenBereiche(d: EinstellungenDaten, jetzt: Date): EinstellungBereich[] {
  const profilFehlt = fehlendAuf(d.hofseiteZeilen, '/settings/profile')
  const auftrittFehlt = fehlendAuf(d.hofseiteZeilen, '/settings/appearance')
  const nummer = d.betriebsnummer?.trim() ?? ''

  return [
    {
      id: 'hofdaten',
      titel: 'Hofdaten',
      zeile: profilFehlt.length > 0 ? esFehlt(profilFehlt) : `${d.name} · ${d.address}, ${d.postalCode} ${d.city}`,
      ton: profilFehlt.length > 0 ? 'offen' : 'fertig',
      href: '/settings/profile',
    },
    {
      id: 'auftritt',
      titel: 'Mein Auftritt',
      zeile: auftrittFehlt.length > 0 ? esFehlt(auftrittFehlt) : 'Titelbild, Logo, Über uns und Fotos sind da',
      ton: auftrittFehlt.length > 0 ? 'offen' : 'fertig',
      href: '/settings/appearance',
    },
    {
      id: 'abholzeiten',
      titel: 'Abholzeiten',
      zeile:
        d.abholzeiten.length > 0
          ? abholzeitenKurz(d.abholzeiten)
          : d.abholzeitenGesamt > 0
            ? 'Alle Abholzeiten sind pausiert — gerade kann niemand bestellen'
            : 'Noch keine — erst dann können Kunden bestellen',
      ton: d.abholzeiten.length > 0 ? 'fertig' : 'offen',
      href: '/settings/pickup-slots',
    },
    {
      id: 'zahlung',
      titel: 'Zahlung',
      zeile: d.stripeBereit
        ? 'Online-Zahlung über Stripe aktiv · bar bei Abholung'
        : d.stripeKontoDa
          ? 'Stripe-Einrichtung noch nicht fertig · bar bei Abholung geht'
          : 'Bar bei Abholung · Online-Zahlung noch nicht eingerichtet',
      ton: d.stripeBereit ? 'fertig' : 'offen',
      href: '/settings/payments',
    },
    {
      id: 'futtermittel',
      titel: 'Futtermittel-Registrierung',
      zeile: nummer
        ? d.betriebsstatus
          ? `${BETRIEBSSTATUS[d.betriebsstatus].name} · ${nummer}`
          : nummer
        : 'Keine Nummer — brauchst du nur, wenn du Futter verkaufst',
      ton: nummer ? 'fertig' : 'neutral',
      href: `/settings/profile#${BETRIEBSNUMMER_ANKER}`,
    },
    {
      id: 'konditionen',
      titel: 'Konditionen und Tarif',
      zeile: konditionenZeile(d.tarif, jetzt),
      ton: 'neutral',
      href: '/settings/konditionen',
    },
    {
      id: 'urlaubsmodus',
      titel: 'Urlaubsmodus',
      zeile: d.isPaused ? 'An · Kunden können gerade nicht bestellen' : 'Aus · du nimmst Bestellungen an',
      ton: d.isPaused ? 'offen' : 'neutral',
      href: '/settings/pause',
    },
    {
      id: 'konto',
      titel: 'Konto und Sicherheit',
      zeile: d.stillgelegt ? 'Dein Hof ist stillgelegt' : 'E-Mail, Passwort, Darstellung, Hof stilllegen',
      ton: d.stillgelegt ? 'offen' : 'fertig',
      href: '/settings/account',
    },
  ]
}

/**
 * Die Zeile „Konditionen und Tarif": ohne gewählten Tarif (heute jeder Hof)
 * der Übergang aus K1; mit Tarif dessen Name und Preis — vor dem Stichtag mit
 * „ab …", damit kein Tarif als heute fällig dasteht.
 */
export function konditionenZeile(tarif: Tarif | null, jetzt: Date): string {
  if (!tarif) return `${STARTPHASE_SATZ} ${TARIFE_AB_SATZ}`
  const t = tarifText(tarif)
  const ab = jetzt.getTime() < TARIFE_AB.getTime() ? ` ab ${TARIFE_AB_TEXT}` : ''
  return `${t.name} · ${t.preis} ${PRO_MONAT}${ab}`
}

// ─── Konditionen: Rechenbeispiel ────────────────────────────────────────────

/** Der Warenpreis des Rechenbeispiels in Cent — wie im Mockup eine Bestellung über € 20. */
export const RECHENBEISPIEL_WARENPREIS_CENTS = 2000

export type KonditionenHof = ServicegebuehrEinstellung & {
  /** Farm.platformFeePercent — im Pilot 0; geht online vom Warenpreis ab. */
  platformFeePercent: DecimalEingabe
  tarif: Tarif | null
}

export type RechenZeile = { label: string; betrag: string; summe?: boolean }

export type RechenSeite = { titel: string; zeilen: RechenZeile[]; satz: string }

export type Rechenbeispiel = {
  titel: string
  /** „Servicegebühr 5 %, mind. € 0,50 – zahlt der Kunde" — nur, wenn für den Hof eine Gebühr gilt. */
  satz: string | null
  /** Geht online eine Provision vom Warenpreis ab? Dann sagt die Seite nicht „voller Warenpreis". */
  mitProvision: boolean
  online: RechenSeite
  bar: RechenSeite
}

function euro(cents: number): string {
  return formatEuro(centsAlsEuro(cents))
}

function zeitpunkt(wert: Date | string | null): Date | null {
  if (wert === null) return null
  const d = wert instanceof Date ? wert : new Date(wert)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Warum für diesen Hof gerade keine Gebühr anfällt (abgesehen von der
 * Bar-Ausnahme B1) — oder null, wenn eine gilt.
 */
function keineGebuehrGrund(hof: KonditionenHof, jetzt: Date): string | null {
  const ab = zeitpunkt(hof.serviceFeeActiveFrom)
  if (ab === null) return 'Für deinen Hof ist derzeit keine Servicegebühr eingestellt.'
  if (ab.getTime() > jetzt.getTime()) return `Für deinen Hof gilt die Servicegebühr ab ${formatDatumLang(ab)}.`
  return null
}

/**
 * Das Rechenbeispiel für eine Bestellung über € 20, heute bestellt, mit den
 * gespeicherten Sätzen dieses Hofs. Gebühr nur über berechneServicegebuehr
 * (E4, B1), Provision über calcPlatformFeeAmount wie im Checkout — keine
 * zweite Rechnung.
 */
export function konditionenRechenbeispiel(hof: KonditionenHof, jetzt: Date): Rechenbeispiel {
  const waren = RECHENBEISPIEL_WARENPREIS_CENTS
  const online = berechneServicegebuehr(waren, hof, jetzt, 'ONLINE').gebuehrCents
  const bar = berechneServicegebuehr(waren, hof, jetzt, 'ONSITE_CASH').gebuehrCents
  const provision = decimalZuCents(calcPlatformFeeAmount(new Decimal(waren).div(100), hof.platformFeePercent))
  const grund = keineGebuehrGrund(hof, jetzt)
  const prozent = Number(hof.serviceFeePercent.toString())

  const onlineZeilen: RechenZeile[] = [
    { label: 'Warenpreis', betrag: euro(waren) },
    { label: 'Servicegebühr (Kunde)', betrag: `+ ${euro(online)}` },
    { label: 'Kunde zahlt', betrag: euro(waren + online), summe: true },
  ]
  if (provision > 0) onlineZeilen.push({ label: 'Provision', betrag: `− ${euro(provision)}` })
  onlineZeilen.push({ label: 'Deine Auszahlung', betrag: euro(waren - provision), summe: true })

  return {
    titel: `Rechenbeispiel: eine Bestellung über ${euro(waren)}`,
    satz:
      grund === null && Number.isFinite(prozent)
        ? `Servicegebühr ${formatZahl(prozent)} %, mind. ${euro(hof.serviceFeeMinCents)} – zahlt der Kunde`
        : null,
    mitProvision: provision > 0,
    online: {
      titel: 'Online bezahlt',
      zeilen: onlineZeilen,
      satz: online > 0 ? 'Die Gebühr wird beim Bezahlen automatisch abgetrennt – dein Warenpreis bleibt unberührt.' : (grund ?? ''),
    },
    bar: {
      titel: 'Bar bei Abholung',
      zeilen: [
        { label: 'Warenpreis', betrag: euro(waren) },
        { label: 'Servicegebühr (Kunde)', betrag: `+ ${euro(bar)}` },
        { label: 'Du kassierst („Bar zu kassieren“)', betrag: euro(waren + bar), summe: true },
        { label: 'Dir bleibt', betrag: euro(waren), summe: true },
      ],
      satz: barOhneServicegebuehr('ONSITE_CASH', jetzt)
        ? BAR_OHNE_GEBUEHR_SATZ
        : bar > 0
          ? 'Die Gebühr holt die Monatsabrechnung per SEPA-Lastschrift.'
          : (grund ?? ''),
    },
  }
}
