/**
 * Einstellungen des Hofs (/settings und /settings/konditionen, Nachtlauf
 * Nr. 22d, Gate 8) — rein und ohne Datenbank prüfbar
 * (tests/hof-einstellungen.test.ts).
 *
 * Die Übersicht (Mockups web-h1-einstellungen-uebersicht, mobil-h5-einstellungen)
 * zeigt neun Bereiche mit Status-Punkt. Es stehen nur Bereiche da, die es gibt:
 * „Benachrichtigungen" aus dem Mockup hat keine Einstellung im Code und fehlt
 * deshalb; „Mein Auftritt" (ohne Platz im Mockup) steht dafür da — seit
 * Nr. 50 als Link in Mein Hof, wo der Auftritt jetzt bearbeitet wird
 * (Register N4). Was fehlt, zählt dieselbe Liste wie „Mein Hof" und
 * „Einrichten" (hofseiteFortschritt, EINSTELLUNG_FUER_ZEILE) — eine Zahl, an
 * keiner Stelle anders gerechnet; freiwillige Zeilen (Leitspruch, Werte)
 * zählen nicht als fehlend.
 *
 * Die Konditionen nennen Tarife und Übergang nur aus konditionen.ts (K1) und
 * rechnen das Beispiel mit DER Gebührenregel (berechneServicegebuehr) und den
 * gespeicherten Sätzen DIESES Hofs — die Seite verspricht nichts, was nicht
 * schon gilt (keine neuen Vertragszusagen). Seit Nr. 61 (Fassung 2) baut
 * `baueKonditionenSeite` Stand, Tarif-Karten und Vergleich aus dem
 * Tarif-Zustand (`bestimmeTarifZustand`) — dieselbe Regel wie die Tarif-Zeile;
 * die Zeile der Übersicht (`konditionenZeile`) ebenso, ohne Preis.
 */
import type { Betriebsstatus, Tarif } from '@prisma/client'
import { aufzaehlung, abholzeitenKurz, EINSTELLUNG_FUER_ZEILE, type HofseiteZeile } from '@/lib/hofseite-fortschritt'
import type { WeeklySlot } from '@/lib/pickup-days'
import { ABHOLZEITEN_FEHLEN_ZEILE } from '@/lib/pickup-slot-rules'
import { BETRIEBSNUMMER_ANKER, BETRIEBSSTATUS } from '@/lib/taxonomie'
import {
  BAR_GEBUEHR_SEPA_SATZ,
  BAR_OHNE_GEBUEHR_SATZ,
  HOFTOR_ABHOLZEITEN_JE_WOCHE,
  HOFTOR_PRODUKTE,
  IM_MONAT,
  LASTSCHRIFT_TEXT,
  OHNE_WAHL_SATZ,
  ONLINE_GEBUEHR_ABGETRENNT_SATZ,
  ONLINE_GEBUEHR_MIT_PROVISION_SATZ,
  PLATTFORMGEBUEHR_BEZEICHNUNG,
  PREIS_BEDINGUNGEN,
  START_TARIF,
  TARIFE,
  TARIF_MARKE,
  TARIF_WAHL_SATZ,
  VERGLEICH_TEXT,
  barGebuehrSepaSatz,
  baueDeinStand,
  baueTarifZeile,
  bestimmeTarifZustand,
  tarifText,
  type DeinStand,
  type TarifHof,
  type TarifZustand,
} from '@/lib/konditionen'
import { barOhneServicegebuehr, berechneServicegebuehr, type ServicegebuehrEinstellung } from '@/lib/servicegebuehr'
import { barMoeglich, bestellGebuehr, einzugFuer, satzText, type GebuehrEinzug, type GebuehrLage } from '@/lib/plattformgebuehr'
import { calcPlatformFeeAmount, decimalZuCents, type DecimalEingabe } from '@/lib/order-totals'
import { centsAlsEuro, formatDatumLang, formatEuro, formatZahl } from '@/lib/format'
import { Decimal } from '@prisma/client/runtime/index-browser'
import { TEILEN_MOMENTE_PFAD, TEILEN_MOMENTE_TITEL, teilenMomenteZeile } from '@/lib/teilen-momente'
import { EINSTELLUNG_KONDITIONEN, EINSTELLUNG_KONTO, EINSTELLUNG_MEIN_AUFTRITT } from '@/lib/bauern-navigation'

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

/**
 * Der Bereich mit der Pause (Farm.isPaused): Zeile der Übersicht, Titel von
 * /settings/pause und der Verweis beim Stilllegen heißen gleich (Boards
 * s1-/w1-einstellungen, s2-konto-hof, V8; Nr. 224). Die Aktion in Mein Hof
 * bleibt „Pausieren“.
 */
export const URLAUB_UND_PAUSE = 'Urlaub und Pause'

/** Seite und Knopf mit den Angaben des Hofs (Register N42 c, V43, V49; Board s2-hofdaten-zahlung). */
export const HOFDATEN_TEXT = {
  titel: 'Hofdaten',
  satz: 'Informationen, die auf deiner öffentlichen Hofseite sichtbar sind.',
  speichern: 'Hofdaten speichern',
  gespeichert: 'Hofdaten gespeichert',
} as const

/**
 * Konto und Sicherheit (Board s2-/w2-konto-hof; N42 c „Anmelde-Adresse“,
 * N42 d „Hof“ statt „Hofladen“, V55). Der Verweis auf die Pause nimmt
 * `URLAUB_UND_PAUSE`.
 */
export const KONTO_TEXT = {
  anmeldeAdresseTitel: 'Anmelde-Adresse',
  anmeldeAdresse: 'Deine Anmelde-Adresse:',
  anmeldeAdresseAendern: 'Um sie zu ändern,',
  passwortTitel: 'Passwort ändern',
  stilllegenSatz: 'Deinen Hof dauerhaft schließen.',
  nurVoruebergehend: 'Nur vorübergehend zusperren? Dann nutze lieber',
  nurHofSchliessen: 'Nur den Hof schließen, dein Konto aber behalten? Dann nutze oben',
} as const

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
  /** Ende der Gründungszusage (K2) — liefert ab Nr. 62 die Platzvergabe, bis dahin null. */
  gruendungBis: Date | null
  isPaused: boolean
  stillgelegt: boolean
  /** Farm.teilenMomenteAus (Nr. 30): true = die Teilen-Momente sind abgeschaltet. */
  teilenMomenteAus: boolean
}

/** Die Titel der fehlenden Zeilen, deren Formular an diesem Ziel liegt — Freiwilliges fehlt nie. */
function fehlendAuf(zeilen: readonly HofseiteZeile[], ziel: string): string[] {
  return zeilen.filter((z) => EINSTELLUNG_FUER_ZEILE[z.id] === ziel && !z.fertig && !z.freiwillig).map((z) => z.titel)
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
  const auftrittFehlt = fehlendAuf(d.hofseiteZeilen, EINSTELLUNG_MEIN_AUFTRITT.href)
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
      titel: EINSTELLUNG_MEIN_AUFTRITT.label,
      zeile: auftrittFehlt.length > 0 ? esFehlt(auftrittFehlt) : 'Titelbild, Logo, Über uns und Fotos sind da',
      ton: auftrittFehlt.length > 0 ? 'offen' : 'fertig',
      href: EINSTELLUNG_MEIN_AUFTRITT.href,
    },
    {
      id: 'abholzeiten',
      titel: 'Abholzeiten',
      zeile:
        d.abholzeiten.length > 0
          ? abholzeitenKurz(d.abholzeiten)
          : d.abholzeitenGesamt > 0
            ? 'Alle Abholzeiten sind pausiert — gerade kann niemand bestellen'
            : ABHOLZEITEN_FEHLEN_ZEILE,
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
      titel: EINSTELLUNG_KONDITIONEN.label,
      zeile: konditionenZeile(d, jetzt),
      ton: 'neutral',
      href: EINSTELLUNG_KONDITIONEN.href,
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
      titel: URLAUB_UND_PAUSE,
      zeile: d.isPaused ? 'An · Kunden können gerade nicht bestellen' : 'Aus · du nimmst Bestellungen an',
      ton: d.isPaused ? 'offen' : 'neutral',
      href: '/settings/pause',
    },
    {
      id: 'konto',
      titel: EINSTELLUNG_KONTO.label,
      zeile: d.stillgelegt ? 'Dein Hof ist stillgelegt' : 'E-Mail, Passwort, Darstellung, Hof stilllegen',
      ton: d.stillgelegt ? 'offen' : 'fertig',
      href: EINSTELLUNG_KONTO.href,
    },
  ]
}

/** Eine Gruppe der Übersicht: Überschrift und ihre Bereiche, in der Reihenfolge von `einstellungenBereiche`. */
export type EinstellungGruppe = { id: 'hof' | 'konto'; titel: string; bereiche: EinstellungBereich[] }

/** Was in die Gruppe „Konto“ gehört (Boards s1-/w1-einstellungen); alles andere steht unter „Dein Hof“. */
const KONTO_BEREICHE: readonly EinstellungBereichId[] = ['konditionen', 'konto']

/**
 * Die Bereiche in zwei Gruppen wie die Boards s1-/w1-einstellungen: „Dein
 * Hof“ und „Konto“ (Nr. 224). Reihenfolge und Inhalt bleiben aus
 * `einstellungenBereiche`; eine leere Gruppe steht nicht da.
 */
export function einstellungenGruppen(bereiche: readonly EinstellungBereich[]): EinstellungGruppe[] {
  const gruppen: EinstellungGruppe[] = [
    { id: 'hof', titel: 'Dein Hof', bereiche: bereiche.filter((b) => !KONTO_BEREICHE.includes(b.id)) },
    { id: 'konto', titel: 'Konto', bereiche: bereiche.filter((b) => KONTO_BEREICHE.includes(b.id)) },
  ]
  return gruppen.filter((g) => g.bereiche.length > 0)
}

// ─── Zahlungs-Seite ─────────────────────────────────────────────────────────

/** Welche EINE Hinweiskarte oben auf /settings/payments steht. */
export type ZahlungHinweisArt = 'geschafft' | 'fortsetzen' | 'fehler' | 'einrichten' | 'einschalten' | 'neu-einrichten'

/**
 * Genau eine Karte, nie zwei orange übereinander (Nachbesserung Nr. 24):
 * Die Rückmeldung von Stripe (`?stripe=`) geht vor, sonst sagt die Karte, was
 * fehlt — Stripe einrichten (Z1) oder, bei fertigem Konto und Online aus
 * (Bestandshof vor Z1), Online-Zahlung einschalten. „geschafft" nur, wenn
 * es stimmt.
 *
 * `?stripe=neu` (Register Z2, Nr. 42): Stripe kennt das gespeicherte Konto
 * nicht — gesetzt von „Status prüfen", „Einrichtung fortsetzen" und der
 * Rückkehr aus dem Onboarding, nachdem der Hof als nicht bereit vermerkt ist.
 * Die Karte heißt dann „Online-Zahlung neu einrichten" — nur mit Konto und
 * nur, solange es nicht bereit ist. Der Parameter öffnet nichts: Ob wirklich
 * neu angelegt wird, fragt `createConnectAccount` selbst bei Stripe nach.
 */
export function zahlungHinweis(d: {
  rueckmeldung: string | undefined
  stripeBereit: boolean
  onlineAn: boolean
  /** Ein Stripe-Konto ist gespeichert (Farm.stripeAccountId gesetzt). */
  stripeKontoDa?: boolean
}): ZahlungHinweisArt | null {
  if (d.rueckmeldung === 'error') return 'fehler'
  if (!d.stripeBereit) {
    if (d.rueckmeldung === 'neu' && d.stripeKontoDa) return 'neu-einrichten'
    return d.rueckmeldung === 'pending' ? 'fortsetzen' : 'einrichten'
  }
  if (!d.onlineAn) return 'einschalten'
  return d.rueckmeldung === 'success' ? 'geschafft' : null
}

/** Die Karte „Bar bei Abholung“ auf /settings/payments (Board s2-/w2-hofdaten-zahlung, V46, V61, V71). */
export type BarKarte = {
  /** Die Marke mit Wort — nie nur die Farbe. */
  marke: string
  ton: 'fertig' | 'offen'
  /** Ein Satz unter der Beschreibung, oder null. */
  satz: string | null
  /** „Lastschrift einrichten“ zeigen (Weg auf „Deine Konditionen“, dort richtet Stripe sie ein). */
  lastschrift: boolean
  /** Bei „Pausiert“ der Weg zur offenen Monatsabrechnung auf „Deine Konditionen“. */
  zuKonditionen: boolean
}

export const BAR_KARTE_TEXT = {
  titel: 'Bar bei Abholung',
  beschreibung: 'Kundinnen können bei der Abholung auch bar zahlen – zusätzlich zur Online-Zahlung.',
  aktiv: 'Aktiv',
  brauchtLastschrift: 'Braucht Lastschrift',
  pausiert: 'Pausiert',
  lastschriftSatz:
    'Barzahlung gibt es, sobald du die Lastschrift für die Monatsabrechnung eingerichtet hast. ' +
    'Darüber ziehen wir einmal im Monat die Plattformgebühr aus Barbestellungen ein.',
  /** Eine Monatsabrechnung sperrt bar (Nr. 198) — eine Lastschrift hilft da nicht, auch wenn eine fehlt. */
  pausiertSatz: 'Barzahlung ist pausiert, solange eine Monatsabrechnung offen ist.',
  /** Der Weg bei „Pausiert“ — dort stehen Barzahlung und Monatsabrechnungen (Nr. 198). */
  zuKonditionen: 'Zu „Deine Konditionen“',
  gruendungSatz: (bis: string): string =>
    `Bis ${bis} zahlst du als Gründungshof auf Barverkäufe keine Plattformgebühr; die Lastschrift brauchst du erst danach.`,
  einrichten: LASTSCHRIFT_TEXT.einrichten,
  /** Dort steht die Karte „Barzahlung“ mit Stripes Formular (Nr. 198). */
  einrichtenHref: '/settings/konditionen#barzahlung',
} as const

/**
 * Was die Karte „Bar bei Abholung“ sagt — keine neue Regel: Ob bar geht,
 * entscheidet `barMoeglich` (dieselbe Quelle wie Kasse und /api/checkout).
 * Geht es nicht, weil eine Monatsabrechnung sperrt (`barGesperrt`), heißt die
 * Marke „Pausiert“ — eine Lastschrift höbe die Sperre nicht auf. Sonst
 * (Hofpreis-Modell, Einzug fällig, Lastschrift Pflicht und keine da) heißt sie
 * „Braucht Lastschrift“ mit dem Weg dorthin (N42 g). Ist die Bargebühr noch
 * erlassen (`einzugFuer` → `erlassen`), nennt der Satz den Einzugstag aus der
 * Lage (`einzugAb`, wie die Karte „Barzahlung“) — als Gründungshof nur, wenn
 * `Farm.einzugAb` leer ist (dann kommt der Tag aus der Gründung), sonst neutral.
 * Im Modell „bisher“ kein Satz.
 */
export function barKarte(lage: GebuehrLage, jetzt: Date, hof: { einzugAb: Date | null }): BarKarte {
  const T = BAR_KARTE_TEXT
  if (!barMoeglich(lage, jetzt)) {
    if (lage.modell === 'hofpreis' && lage.barGesperrt) return { marke: T.pausiert, ton: 'offen', satz: T.pausiertSatz, lastschrift: false, zuKonditionen: true }
    return { marke: T.brauchtLastschrift, ton: 'offen', satz: T.lastschriftSatz, lastschrift: true, zuKonditionen: false }
  }
  let satz: string | null = null
  if (lage.modell === 'hofpreis' && einzugFuer(lage, 'ONSITE_CASH', jetzt) === 'erlassen') {
    // Derselbe Tag wie die Karte „Barzahlung“ (ladeBarzahlung: formatDatumLang(einzugAb)) — eine Quelle.
    const bis = formatDatumLang(lage.einzugAb)
    satz = hof.einzugAb === null ? T.gruendungSatz(bis) : LASTSCHRIFT_TEXT.erlassen(bis)
  }
  return { marke: T.aktiv, ton: 'fertig', satz, lastschrift: false, zuKonditionen: false }
}

export const ONLINE_AUS_TITEL = 'Online-Zahlung ist noch aus'
export const ONLINE_AUS_SATZ =
  'Dein Stripe-Konto ist fertig, die Online-Zahlung ist für deinen Hof aber noch aus. ' +
  'Schalte sie ein, damit deine Kundinnen online zahlen können.'

/**
 * Die Zeile „Konditionen und Tarif": der Stand aus derselben Regel und mit
 * denselben Texten wie die Tarif-Zeile der HofShell (`baueTarifZeile`) — ohne
 * Preis, bei Hofladen nur der Name: Der Preis steht allein auf „Deine
 * Konditionen", nach dem Nutzen und mit Bedingungen (E6-Ergänzung).
 */
export function konditionenZeile(hof: TarifHof, jetzt: Date): string {
  // Die Zahl der Produkte braucht nur der Balken der Tarif-Zeile; die Übersicht
  // zeigt ihn nicht und lädt sie deshalb nicht.
  const zeile = baueTarifZeile({ tarif: hof.tarif, gruendungBis: hof.gruendungBis, produkteImShop: 0 }, jetzt)
  if (zeile === null) return tarifText('HOFLADEN').name
  // Bei Hoftor nur der Titel: „Produkte im Shop" ohne die Zahl sagte nichts.
  return zeile.zustand === 'hoftor' ? zeile.titel : `${zeile.titel} · ${zeile.zeile}`
}

// ─── Konditionen: Rechenbeispiel ────────────────────────────────────────────

/** Der Warenpreis des Rechenbeispiels in Cent — wie im Mockup eine Bestellung über € 20. */
export const RECHENBEISPIEL_WARENPREIS_CENTS = 2000

export type KonditionenHof = ServicegebuehrEinstellung & {
  /** Farm.platformFeePercent — im Pilot 0; geht online vom Warenpreis ab. */
  platformFeePercent: DecimalEingabe
  tarif: Tarif | null
  /** Ende der Gründungszusage (K2) — liefert ab Nr. 62 die Platzvergabe, bis dahin null. */
  gruendungBis: Date | null
  /** Produkte, die gerade im Shop stehen (`isAvailable`) — „Heute" im Vergleich mit Hoftor. */
  produkteImShop: number
  /** Aktive Abholzeiten je Woche — „Heute" im Vergleich mit Hoftor. */
  abholzeitenJeWoche: number
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
 * gespeicherten Sätzen dieses Hofs. `lage` ist die Gebührenlage des Hofs
 * (`ladeGebuehrLage`, N38): im Modell „bisher“ die Servicegebühr über
 * berechneServicegebuehr (E4, B1), sonst sein Satz der Plattformgebühr,
 * gerechnet über bestellGebuehr wie Kasse und /api/checkout, und bar nach
 * `einzugFuer` (Nr. 224). Die
 * Provision über calcPlatformFeeAmount wie im Checkout — keine zweite Rechnung.
 */
export function konditionenRechenbeispiel(hof: KonditionenHof, jetzt: Date, lage: GebuehrLage): Rechenbeispiel {
  const waren = RECHENBEISPIEL_WARENPREIS_CENTS
  const provision = decimalZuCents(calcPlatformFeeAmount(new Decimal(waren).div(100), hof.platformFeePercent))
  const titel = `Rechenbeispiel: eine Bestellung über ${euro(waren)}`
  if (lage.modell === 'hofpreis') return rechenbeispielHofpreis(waren, provision, lage, jetzt, titel)

  const online = berechneServicegebuehr(waren, hof, jetzt, 'ONLINE').gebuehrCents
  const bar = berechneServicegebuehr(waren, hof, jetzt, 'ONSITE_CASH').gebuehrCents
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
    titel,
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

/** Die Zeile der Plattformgebühr im Rechenbeispiel: Sie steckt im Preis, den die Kundin sieht (N38). */
export const RECHENBEISPIEL_GEBUEHR_IM_PREIS = `${PLATTFORMGEBUEHR_BEZEICHNUNG} (im Preis)`

/**
 * Das Beispiel im Hofpreis-Modell (N38): Die Kundin zahlt den Endpreis
 * (Warenpreis + Gebühr je Stück, aufgerundet), online behält Stripe die Gebühr
 * ein. Bar entscheidet `einzugFuer` (dieselbe Quelle wie /api/checkout), wohin
 * die kassierte Gebühr geht: `erlassen` — sie bleibt beim Hof, ihm bleibt der
 * ganze Betrag; `sepa` — die Monatsabrechnung holt sie per Lastschrift;
 * `ueberweisung` — per Rechnung; null — bar geht gerade nicht (Sperre bzw.
 * Lastschrift fehlt), der Satz sagt warum.
 */
function rechenbeispielHofpreis(
  waren: number,
  provision: number,
  lage: Extract<GebuehrLage, { modell: 'hofpreis' }>,
  jetzt: Date,
  titel: string
): Rechenbeispiel {
  const { gebuehrCents, gesamtCents } = bestellGebuehr([{ preisCents: waren, menge: 1 }], lage.hundertstel)
  const gebuehrZeile: RechenZeile = { label: RECHENBEISPIEL_GEBUEHR_IM_PREIS, betrag: `+ ${euro(gebuehrCents)}` }
  const onlineZeilen: RechenZeile[] = [
    { label: 'Warenpreis', betrag: euro(waren) },
    gebuehrZeile,
    { label: 'Kunde zahlt', betrag: euro(gesamtCents), summe: true },
  ]
  if (provision > 0) onlineZeilen.push({ label: 'Provision', betrag: `− ${euro(provision)}` })
  onlineZeilen.push({ label: 'Deine Auszahlung', betrag: euro(waren - provision), summe: true })
  const einzug = einzugFuer(lage, 'ONSITE_CASH', jetzt)
  return {
    titel,
    satz: `${PLATTFORMGEBUEHR_BEZEICHNUNG} ${satzText(lage.hundertstel)} % je Stück, aufgerundet – steckt im Preis, den die Kundin zahlt`,
    mitProvision: provision > 0,
    online: {
      titel: 'Online bezahlt',
      zeilen: onlineZeilen,
      satz: provision > 0 ? ONLINE_GEBUEHR_MIT_PROVISION_SATZ : ONLINE_GEBUEHR_ABGETRENNT_SATZ,
    },
    bar: {
      titel: 'Bar bei Abholung',
      zeilen: [
        { label: 'Warenpreis', betrag: euro(waren) },
        gebuehrZeile,
        { label: 'Du kassierst („Bar zu kassieren“)', betrag: euro(gesamtCents), summe: true },
        { label: 'Dir bleibt', betrag: euro(einzug === 'erlassen' ? gesamtCents : waren), summe: true },
      ],
      satz: barSatzHofpreis(lage, einzug),
    },
  }
}

/** Der Satz unter der Bar-Spalte im Hofpreis-Modell — nur bestehende Texte, gewählt nach `einzugFuer`. */
function barSatzHofpreis(lage: Extract<GebuehrLage, { modell: 'hofpreis' }>, einzug: GebuehrEinzug | null): string {
  // Tag wie die Karte „Barzahlung“ darunter (formatDatumLang(einzugAb)), nie ein anderer.
  if (einzug === 'erlassen') return LASTSCHRIFT_TEXT.erlassen(formatDatumLang(lage.einzugAb))
  if (einzug === 'ueberweisung') return LASTSCHRIFT_TEXT.mandatFrei
  if (einzug === null) return lage.barGesperrt ? BAR_KARTE_TEXT.pausiertSatz : LASTSCHRIFT_TEXT.mandatPflicht
  return BAR_GEBUEHR_SEPA_SATZ
}

// ─── Konditionen, Fassung 2: Stand, Tarif-Karten, Vergleich (Nr. 61) ────────

/** Eine Tarif-Karte, wie „Deine Konditionen" sie zeigt — nur Text und Wahrheitswerte. */
export type TarifKarteAnzeige = {
  id: Tarif
  name: string
  fuerWen: string
  leistungen: readonly string[]
  /** „kostenlos" neben dem Namen — nur ohne Grundgebühr; nie „€ 0". */
  kostenlos: boolean
  marke: { text: string; ton: 'fertig' | 'neutral' } | null
  /** Unter den Leistungen beim Tarif, der ohne Wahl gilt. */
  satz: string | null
  /** Der Preis mit Bedingungen — erst NACH den Leistungen (E6-Ergänzung). */
  preis: { betrag: string; bedingungen: string; wahl: string | null } | null
}

export type VergleichZeile = { label: string; heute: number; hoftor: number }

export type KonditionenSeite = {
  zustand: TarifZustand
  /** „Dein Stand" (`baueDeinStand`): `'startphase'` und `'gruendungshof'`; nach dem Stichtag null — dann zeigt die Seite den Übergang K1 allein. */
  stand: DeinStand | null
  karten: TarifKarteAnzeige[]
  /** Nur vor dem Stichtag (`'startphase'`): was sich für diesen Hof ab dann ändert. */
  vergleich: VergleichZeile[] | null
}

/**
 * Stand, Tarif-Karten und Vergleich für „Deine Konditionen" (Mockups
 * web-/mobil-h1-einstellungen-konditionen-v2). Marken nach E6-Ergänzung:
 * „Dein Tarif" nur nach Wahl; „Gilt automatisch" für Hoftor nur ohne Wahl und
 * nicht für einen Gründungshof (für ihn gilt bis zu seinem Tag Hofladen ohne
 * Grundgebühr, K2). „Dein Stand" kommt aus konditionen.ts (`baueDeinStand`,
 * beim Gründungshof mit seinem Datum). Der Vergleich nennt die Zahlen dieses
 * Hofs neben den Grenzen von Hoftor — nur vor dem Stichtag, solange die
 * Änderung bevorsteht.
 */
export function baueKonditionenSeite(hof: KonditionenHof, jetzt: Date): KonditionenSeite {
  const zustand = bestimmeTarifZustand(hof, jetzt)
  const ohneWahl = hof.tarif === null && zustand !== 'gruendungshof'

  const karten = TARIFE.map((t): TarifKarteAnzeige => {
    const gewaehlt = hof.tarif === t.id
    const automatisch = ohneWahl && t.id === START_TARIF.id
    const kostetGrundgebuehr = t.grundgebuehrCents > 0
    return {
      id: t.id,
      name: t.name,
      fuerWen: t.fuerWen,
      leistungen: t.leistungen,
      kostenlos: !kostetGrundgebuehr,
      marke: gewaehlt
        ? { text: TARIF_MARKE.gewaehlt, ton: 'fertig' }
        : automatisch
          ? { text: TARIF_MARKE.automatisch, ton: 'fertig' }
          : kostetGrundgebuehr
            ? { text: TARIF_MARKE.mehr, ton: 'neutral' }
            : null,
      satz: automatisch ? OHNE_WAHL_SATZ : null,
      preis: kostetGrundgebuehr
        ? { betrag: `${t.preis} ${IM_MONAT}`, bedingungen: PREIS_BEDINGUNGEN, wahl: gewaehlt ? null : TARIF_WAHL_SATZ }
        : null,
    }
  })

  return {
    zustand,
    stand: baueDeinStand(hof, jetzt),
    karten,
    vergleich:
      zustand === 'startphase'
        ? [
            { label: VERGLEICH_TEXT.produkte, heute: hof.produkteImShop, hoftor: HOFTOR_PRODUKTE },
            { label: VERGLEICH_TEXT.abholzeiten, heute: hof.abholzeitenJeWoche, hoftor: HOFTOR_ABHOLZEITEN_JE_WOCHE },
          ]
        : null,
  }
}
