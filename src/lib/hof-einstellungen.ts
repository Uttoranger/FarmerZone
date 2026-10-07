/**
 * Einstellungen des Hofs (/settings und /settings/konditionen, Nachtlauf
 * Nr. 22d, Gate 8) — rein und ohne Datenbank prüfbar
 * (tests/hof-einstellungen.test.ts).
 *
 * Die Übersicht (Mockups web-h1-einstellungen-uebersicht, mobil-h5-einstellungen)
 * zeigt neun Bereiche mit Status-Punkt. Es stehen nur Bereiche da, die es gibt:
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
  ONLINE_GEBUEHR_ABGETRENNT_SATZ,
  ONLINE_GEBUEHR_MIT_PROVISION_SATZ,
  PRO_MONAT,
  barGebuehrSepaSatz,
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
import { TEILEN_MOMENTE_PFAD, TEILEN_MOMENTE_TITEL, teilenMomenteZeile } from '@/lib/teilen-momente'

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
  | 'teilen'
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
  /**
   * Farm.acceptsOnline. Eine Wahl „nur bar" gibt es nicht mehr (Register Z1);
   * ein Bestandshof mit false wird nur aufgefordert, Stripe einzurichten — die
   * Daten bleiben, wie sie sind.
   */
  onlineAn: boolean
  betriebsnummer: string | null
  betriebsstatus: Betriebsstatus | null
  tarif: Tarif | null
  isPaused: boolean
  stillgelegt: boolean
  /** Farm.teilenMomenteAus (Nr. 30): true = die Teilen-Momente sind abgeschaltet. */
  teilenMomenteAus: boolean
}

/** Die Titel der fehlenden Zeilen, deren Formular auf dieser Einstellungsseite liegt. */
function fehlendAuf(zeilen: readonly HofseiteZeile[], ziel: string): string[] {
  return zeilen.filter((z) => EINSTELLUNG_FUER_ZEILE[z.id] === ziel && !z.fertig).map((z) => z.titel)
}

function esFehlt(teile: readonly string[]): string {
  return `Es ${teile.length === 1 ? 'fehlt' : 'fehlen'}: ${aufzaehlung(teile)}`
}

/**
 * Die neun Bereiche der Übersicht, in der Reihenfolge des Mockups (Mein
 * Auftritt gleich nach den Hofdaten, wo er inhaltlich hingehört). Seit Nr. 30
 * stehen die Teilen-Hinweise dort, wo das Mockup „Benachrichtigungen" zeigt —
 * der einzige Schalter, der dort heute schon etwas bewirkt.
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
      // Jeder Hof richtet Stripe ein (Register Z1): Ohne fertiges Konto ist
      // der Punkt orange — auch bei einem Bestandshof mit Online aus, der nur
      // aufgefordert wird. Barzahlung durch Kundinnen bleibt (B1), sie ist
      // aber keine Wahl des Hofs statt Stripe.
      zeile: !d.stripeBereit
        ? d.stripeKontoDa
          ? 'Stripe-Einrichtung noch nicht fertig · bitte abschließen'
          : 'Online-Zahlung noch nicht eingerichtet · bitte einrichten'
        : d.onlineAn
          ? 'Online-Zahlung über Stripe aktiv · bar bei Abholung'
          : // Stripe ist fertig, Online steht aus der Zeit vor Z1 noch auf aus:
            // Der Checkout bietet online dann nicht an — nicht „aktiv" nennen.
            // Ausweg: der Knopf „Online-Zahlung einschalten" auf der Zahlungs-Seite.
            'Stripe eingerichtet · Online-Zahlung noch aus – jetzt einschalten',
      ton: d.stripeBereit && d.onlineAn ? 'fertig' : 'offen',
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
      id: 'teilen',
      titel: TEILEN_MOMENTE_TITEL,
      zeile: teilenMomenteZeile(d.teilenMomenteAus),
      ton: 'neutral',
      href: TEILEN_MOMENTE_PFAD,
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

// ─── Zahlungs-Seite ─────────────────────────────────────────────────────────

/** Welche EINE Hinweiskarte oben auf /settings/payments steht. */
export type ZahlungHinweisArt = 'geschafft' | 'fortsetzen' | 'fehler' | 'einrichten' | 'einschalten'

/**
 * Genau eine Karte, nie zwei orange übereinander (Nachbesserung Nr. 24):
 * Die Rückmeldung von Stripe (`?stripe=`) geht vor, sonst sagt die Karte, was
 * fehlt — Stripe einrichten (Z1) oder, bei fertigem Konto und Online aus
 * (Bestandshof vor Z1), Online-Zahlung einschalten. „geschafft" nur, wenn
 * es stimmt.
 */
export function zahlungHinweis(d: {
  rueckmeldung: string | undefined
  stripeBereit: boolean
  onlineAn: boolean
}): ZahlungHinweisArt | null {
  if (d.rueckmeldung === 'error') return 'fehler'
  if (!d.stripeBereit) return d.rueckmeldung === 'pending' ? 'fortsetzen' : 'einrichten'
  if (!d.onlineAn) return 'einschalten'
  return d.rueckmeldung === 'success' ? 'geschafft' : null
}

export const ONLINE_AUS_TITEL = 'Online-Zahlung ist noch aus'
export const ONLINE_AUS_SATZ =
  'Dein Stripe-Konto ist fertig, die Online-Zahlung ist für deinen Hof aber noch aus. ' +
  'Schalte sie ein, damit deine Kundinnen online zahlen können.'

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
      satz:
        online > 0
          ? provision > 0
            ? ONLINE_GEBUEHR_MIT_PROVISION_SATZ
            : ONLINE_GEBUEHR_ABGETRENNT_SATZ
          : (grund ?? ''),
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
          ? (barGebuehrSepaSatz(jetzt) ?? '')
          : (grund ?? ''),
    },
  }
}
