/**
 * Die Regeln der Kasse (/[farmSlug]/checkout, Nachtlauf Nr. 12) — rein, ohne
 * Datenbank, `jetzt` als Parameter (tests/kasse.test.ts).
 *
 * Die Kasse ENTSCHEIDET nichts über Geld: Verbindlich rechnet und prüft
 * /api/checkout. Was hier steht, sorgt dafür, dass der Browser dasselbe zeigt,
 * was der Server danach speichert — dieselben Zahlarten, derselbe Rechenweg
 * für die Servicegebühr, dieselben Abholfenster, dieselbe Frist.
 */
import { abholSchluessel, angeboteneAbholfenster, type AbholSlot } from '@/lib/abholfenster'
import { formatEuro, formatTagKurz, formatZahl } from '@/lib/format'
import { uhrzeitInWien } from '@/lib/fristen'
import { tagVersetzt } from '@/lib/kalender'
import { korbBetraege, zahlungsarten } from '@/lib/hofseite-kunde'
import { BAR_OHNE_GEBUEHR_ZAHLART, MINDESTBESTELLWERT_SATZ, PLATTFORMGEBUEHR_BEZEICHNUNG, PLATTFORMGEBUEHR_SATZ } from '@/lib/konditionen'
import { bestellGebuehr, endpreisJeStueckCents, mindestbestellwertErreicht, satzText, type PreisAnzeige } from '@/lib/plattformgebuehr'
import { TESTBETRIEB_TEXT } from '@/lib/stripe-modus'
import { alsCents, calcTotalAmount, decimalZuCents } from '@/lib/order-totals'
import { RESERVIERUNG_TTL_MS } from '@/lib/reservierung'
import {
  SERVICEGEBUEHR_BEZEICHNUNG,
  SERVICEGEBUEHR_HINWEIS,
  barOhneServicegebuehr,
  berechneServicegebuehr,
  centsAlsEuro,
  kalendertagInWien,
  servicegebuehrSatz,
  type ServicegebuehrEinstellung,
  type Zahlungsart,
} from '@/lib/servicegebuehr'
import { mitNetzSchutz, type NetzErgebnis } from '@/lib/netz'
import { mitKaeuferVorbelegung, type KaeuferVorbelegung } from '@/schemas/kaeufer-vorbelegung'

// ─── Zahlarten (E5) ─────────────────────────────────────────────────────────

/**
 * Was die Kasse über die Gebühr eines Hofs weiß: seine Servicegebühr (Modell
 * `bisher`) und — ab dem Stichtag „Hofpreis-Modell ab“ — die Preisanzeige
 * mit dem Satz der Plattformgebühr (N38, Nr. 197; `PublicFarm.preisAnzeige`).
 * Fehlt sie (null), rechnet die Kasse wie vor Nr. 197.
 */
export type KassenHof = ServicegebuehrEinstellung & { preisAnzeige?: PreisAnzeige }

/**
 * Womit eine NEUE Bestellung bezahlt werden kann. Seit E5 kennt das
 * Preismodell nur online und bar bei Abholung. ONSITE_CARD bleibt im Enum
 * (Expand/Contract), solange Bestellungen ihn tragen: Anzeige, Storno und
 * Abrechnung alter Bestellungen lesen ihn weiter, nur anlegen kann ihn
 * niemand mehr.
 */
export const NEUE_BESTELLUNG_ZAHLARTEN = ['ONLINE', 'ONSITE_CASH'] as const
export type NeueZahlart = (typeof NEUE_BESTELLUNG_ZAHLARTEN)[number]

/**
 * Die Stripe-Zahlarten der Kasse (online): Karte — Apple Pay und Google Pay
 * laufen im Payment Element als Wallet darüber — und EPS. Fest im
 * PaymentIntent statt der Konfiguration „Default“ im Stripe-Dashboard: Dort
 * muss SEPA-Lastschrift für die Monatsabrechnung der Höfe (Nr. 198) an sein,
 * in der Kasse aber nicht — eine SEPA-Zahlung ist erst nach Tagen bestätigt,
 * die Bestellung verfiele vorher.
 */
export const KASSE_ZAHLARTEN = ['card', 'eps'] as const

/** Darf eine neue Bestellung mit dieser Zahlart angelegt werden? */
export function zahlartFuerNeueBestellung(paymentMethod: string): paymentMethod is NeueZahlart {
  return (NEUE_BESTELLUNG_ZAHLARTEN as readonly string[]).includes(paymentMethod)
}

/** Maschinenlesbar für den Browser: Die gewählte Zahlart gibt es nicht (mehr). */
export const CODE_ZAHLART_NICHT_ANGEBOTEN = 'ZAHLART_NICHT_ANGEBOTEN'

/** Maschinenlesbar (N38, Nr. 197): Bar geht bei diesem Hof gerade nicht — die Kasse bietet nur online an. */
export const CODE_BAR_NICHT_MOEGLICH = 'BAR_NICHT_MOEGLICH'

/** Maschinenlesbar (N38, Nr. 197): Der Warenwert liegt unter dem Mindestbestellwert. */
export const CODE_MINDESTBESTELLWERT = 'MINDESTBESTELLWERT'

/** Was die Kundin liest, wenn ein alter Tab noch „Karte bei Abholung" schickt. */
export const ZAHLART_NICHT_ANGEBOTEN =
  'Karte bei Abholung gibt es nicht mehr. Bitte wähl „Online bezahlen" oder „Bar bei Abholung".'

export type KassenZahlart = {
  wert: NeueZahlart
  titel: string
  zusatz: string
  /** Ein Satz, der an der Zahlart steht und gehört werden muss — heute nur der Testbetrieb (Z2). */
  hinweis?: string
}

/**
 * Wie eine Barbestellung verbindlich wird (Mail H3) — an „Bar bei Abholung". Ohne „ein Tipp
 * genügt": Der Weg braucht zwei Schritte, den Link in der Mail und den Knopf dahinter
 * (Register N10, Ergänzung Freigabe Lauf 13, Nr. 85).
 */
const BAR_BESTAETIGEN = 'Du bestätigst per E-Mail.'

/**
 * Die Zahlarten, die die Kasse anbietet — aus derselben Regel wie die rechte
 * Spalte der Hofseite (`zahlungsarten`: online nur mit fertiger Stripe-Anbindung des Hofs).
 *
 * Jede Zahlart trägt ihre eigene Erklärung (`zusatz`, Register N10, Nr. 82):
 * Online nennt die üblichen Wege; welche davon wirklich erscheinen, zeigt
 * Stripes Zahlungsfeld im nächsten Schritt (Apple/Google Pay nur auf
 * passenden Geräten — das sagt der Satz unter den Zahlarten). Bar nennt
 * seinen Vorteil selbst, aber nur, wenn es stimmt: Kostet bar gerade keine
 * Gebühr, online aber schon (`barGuenstiger`, Register B1).
 *
 * Register Z2 (Nr. 42): Im Testbetrieb steht an „Online bezahlen" der Satz
 * `TESTBETRIEB_TEXT.kasse`. Meldet der Server, dass Stripe den Zahlungszugang
 * des Hofs nicht kennt (`onlineAus`), bietet die Kasse online nicht mehr an —
 * dieselbe Liste wie bei einem Hof ohne fertige Stripe-Anbindung.
 */
export function kassenZahlarten(
  hof: {
    acceptsOnline: boolean
    stripeAccountReady: boolean
    acceptsOnsite: boolean
  },
  barIstGuenstiger = false,
  optionen: {
    /** Register Z2: Die Produktion läuft mit Test-Schlüssel (TESTBETRIEB, nie der Schlüssel). */
    testbetrieb?: boolean
    /** Register Z2: Stripe kennt den Zahlungszugang des Hofs nicht — online wie ohne Stripe-Anbindung. */
    onlineAus?: boolean
    /** N38 (Nr. 197): Bar geht bei diesem Hof gerade nicht (`barMoeglich` falsch) — nur online. */
    barAus?: boolean
  } = {}
): KassenZahlart[] {
  const ohneOnline = optionen.onlineAus ? { ...hof, stripeAccountReady: false } : hof
  const angebot = optionen.barAus ? { ...ohneOnline, acceptsOnsite: false } : ohneOnline
  return zahlungsarten(angebot).map((z) =>
    z.art === 'online'
      ? {
          wert: 'ONLINE',
          titel: 'Online bezahlen',
          zusatz: 'Karte, Apple/Google Pay oder EPS – du wählst im nächsten Schritt.',
          // Bar bleibt wählbar, die Beträge ändern sich nicht — nur der Satz kommt dazu.
          ...(optionen.testbetrieb ? { hinweis: TESTBETRIEB_TEXT.kasse } : {}),
        }
      : {
          wert: 'ONSITE_CASH',
          titel: 'Bar bei Abholung',
          zusatz: barIstGuenstiger ? `${BAR_OHNE_GEBUEHR_ZAHLART} ${BAR_BESTAETIGEN}` : BAR_BESTAETIGEN,
        }
  )
}

/**
 * Ob bar gerade günstiger ist als online (Register B1): vor dem Stichtag
 * (`barOhneServicegebuehr`) UND bei einem Hof, dessen Online-Gebühr gerade gilt.
 * Bei einem gebührenfreien Hof ist bar ohnehin gleich teuer, ab dem Stichtag
 * zahlt bar wieder dieselbe Gebühr. EINE Bedingung für beides, was die Kasse
 * daraus macht: „Bar bei Abholung" nennt den Vorteil (`kassenZahlarten`), die
 * Übersicht schreibt „entfällt" (`gebuehrZeile`). `jetzt` wie überall in der
 * Kasse aus der Uhr der Seite; verbindlich entscheidet /api/checkout mit der
 * Server-Uhr.
 */
export function barGuenstiger(hof: KassenHof, jetzt: Date): boolean {
  // Im Hofpreis-Modell (N38) zahlt die Kundin online und bar immer dasselbe.
  if (hof.preisAnzeige) return false
  return barOhneServicegebuehr('ONSITE_CASH', jetzt) && servicegebuehrSatz(hof, jetzt) !== null
}

/**
 * Der Zahlweg, den die Kasse gerade zeigt: der gewählte, wenn die Kasse ihn
 * anbietet — sonst keiner. Ein Hof ganz ohne angebotene Zahlart stellt das
 * Formular zwar auf bar (es braucht einen Wert), es fließt aber kein Geld: Dann
 * stehen weder „entfällt" noch „bar am Hof" da (Register N10, Ergänzung
 * Freigabe Lauf 13, Nr. 85).
 */
export function kassenZahlweg(zahlarten: readonly KassenZahlart[], gewaehlt: string): NeueZahlart | null {
  return zahlarten.find((z) => z.wert === gewaehlt)?.wert ?? null
}

// ─── Beträge ────────────────────────────────────────────────────────────────

export type KassenBetraege = {
  /** Zeilensumme je Produkt in Cent. */
  zeilenCents: Map<string, number>
  warenCents: number
  gebuehrCents: number
  gesamtCents: number
}

/**
 * Warenpreis, Servicegebühr und Gesamt in ganzen Cent — auf genau dem Weg von
 * /api/checkout: Warenpreis über calcTotalAmount → decimalZuCents, Gebühr nur
 * aus berechneServicegebuehr (CODING_STANDARDS §2). Weil die Gebühr jeden
 * angefangenen Cent aufrundet, muss schon der Warenpreis in Cent auf beiden
 * Seiten derselbe sein. Nur Anzeige: Der Server rechnet mit den Preisen der
 * Datenbank und speichert den Snapshot.
 *
 * Mit der gewählten Zahlart (B1): Wechselt die Kundin auf bar, rechnet die
 * Kasse sofort ohne Gebühr, solange der Stichtag nicht erreicht ist — und
 * zurück auf online wieder mit. Was Stripe abbucht, bestimmt allein der
 * Server aus der gespeicherten Bestellung (`zahlungsBetraege`).
 */
export function kassenBetraege(
  positionen: readonly { productId: string; price: number; quantity: number }[],
  hof: KassenHof,
  jetzt: Date,
  zahlungsart: Zahlungsart
): KassenBetraege {
  if (hof.preisAnzeige) return hofpreisBetraege(positionen, hof.preisAnzeige.hundertstel)
  const { zeilenCents } = korbBetraege(positionen)
  const warenCents = decimalZuCents(calcTotalAmount(positionen.map((p) => ({ unitPrice: p.price, quantity: p.quantity }))))
  const { gebuehrCents } = berechneServicegebuehr(warenCents, hof, jetzt, zahlungsart)
  return { zeilenCents, warenCents, gebuehrCents, gesamtCents: warenCents + gebuehrCents }
}

/**
 * Die Beträge im Hofpreis-Modell (N38): Gebühr = Summe aus Menge × Gebühr je
 * Stück (bestellGebuehr, dieselbe Funktion wie /api/checkout), für online und
 * bar gleich. Die Zeilen zeigen den Endpreis × Menge — genau das, was die
 * Kundin auf den Karten sah; ihre Summe ist das Gesamt.
 */
function hofpreisBetraege(positionen: readonly { productId: string; price: number; quantity: number }[], hundertstel: number): KassenBetraege {
  const mitCents = positionen.map((p) => ({ productId: p.productId, preisCents: alsCents(String(p.price)), menge: p.quantity }))
  const summe = bestellGebuehr(mitCents, hundertstel)
  const zeilenCents = new Map<string, number>()
  for (const p of mitCents) {
    zeilenCents.set(p.productId, (zeilenCents.get(p.productId) ?? 0) + p.menge * endpreisJeStueckCents(p.preisCents, hundertstel))
  }
  return { zeilenCents, warenCents: summe.warenCents, gebuehrCents: summe.gebuehrCents, gesamtCents: summe.gesamtCents }
}

/**
 * Der Grund am ausgeschalteten Bestellknopf (N38): im Hofpreis-Modell unter
 * 10 € Warenwert der Satz zum Mindestbestellwert, sonst null. Verbindlich
 * prüft /api/checkout (400 mit demselben Satz).
 */
export function mindestbestellwertGrund(hof: KassenHof, warenCents: number): string | null {
  if (!hof.preisAnzeige) return null
  return mindestbestellwertErreicht(warenCents) ? null : MINDESTBESTELLWERT_SATZ
}

/** Was /api/checkout an Stripe gab (checkoutZahlungsBetragSchema in src/schemas/checkout.ts). */
export type ZahlungsBetrag = { amountCents: number; serviceFeeCents: number }

/**
 * Die Beträge, sobald die Bestellung steht — nur aus dem Betrag, den der Server
 * an Stripe gab. Keine eigene Rechnung mit Uhr oder Hofeinstellung: Der Server
 * friert die Gebühr beim Anlegen ein (Order.serviceFeeCents); rechnete die
 * Kasse mit ihrer Uhr weiter, stünde nach einem Wechsel der Gebühreneinstellung
 * auf dem Knopf ein anderer Betrag, als Stripe abbucht (Nachbesserung 1, Nr. 12).
 */
export function zahlungsBetraege(betrag: ZahlungsBetrag): Pick<KassenBetraege, 'warenCents' | 'gebuehrCents' | 'gesamtCents'> {
  return {
    warenCents: betrag.amountCents - betrag.serviceFeeCents,
    gebuehrCents: betrag.serviceFeeCents,
    gesamtCents: betrag.amountCents,
  }
}

/**
 * Was die Kasse zeigt: vor dem Anlegen die eigene Vorschau, danach die Summen
 * des Servers. Die Zeilen des Korbs bleiben — ihre Preise hat der Server beim
 * Anlegen mit der Datenbank abgeglichen (WARENKORB_GEAENDERT sonst).
 */
export function angezeigteBetraege(lokal: KassenBetraege, vomServer: ZahlungsBetrag | null): KassenBetraege {
  if (!vomServer) return lokal
  return { ...lokal, ...zahlungsBetraege(vomServer) }
}

/**
 * Die Bezeichnung der Gebührenzeile im Zahlungsschritt, einmal beim Anlegen
 * festgehalten. Den Satz nennt sie nur, wenn er zum Betrag des Servers passt —
 * sonst (Wechsel der Einstellung genau beim Anlegen) nur „Servicegebühr",
 * statt einen Satz zu nennen, der nicht zum Betrag gehört. Den Zahlungsschritt
 * gibt es nur online, deshalb die Regel für ONLINE.
 */
export function zahlungsGebuehrText(hof: KassenHof, jetzt: Date, betrag: ZahlungsBetrag): string {
  // Hofpreis-Modell: nur das Wort — den Satz zum Betrag des Servers prüfen geht ohne die Positionen nicht.
  if (hof.preisAnzeige) return PLATTFORMGEBUEHR_BEZEICHNUNG
  const { warenCents, gebuehrCents } = zahlungsBetraege(betrag)
  if (berechneServicegebuehr(warenCents, hof, jetzt, 'ONLINE').gebuehrCents !== gebuehrCents) return SERVICEGEBUEHR_BEZEICHNUNG
  return gebuehrBezeichnung(hof, jetzt)
}

/** „5 %, mind. € 0,50" — Satz und Mindestgebühr aus der Hofeinstellung, wie sie heute gilt. */
function satzMitMindestgebuehr(satz: { prozent: number; mindestCents: number }): string {
  const mindestens = satz.mindestCents > 0 ? `, mind. ${formatEuro(centsAlsEuro(satz.mindestCents))}` : ''
  return `${formatZahl(satz.prozent)} %${mindestens}`
}

/** „Servicegebühr · 5 %, mind. € 0,50" — Satz und Mindestgebühr aus der Hofeinstellung. */
export function gebuehrBezeichnung(hof: ServicegebuehrEinstellung, jetzt: Date): string {
  const satz = servicegebuehrSatz(hof, jetzt)
  if (!satz) return SERVICEGEBUEHR_BEZEICHNUNG
  return `${SERVICEGEBUEHR_BEZEICHNUNG} · ${satzMitMindestgebuehr(satz)}`
}

export type GebuehrZeile = {
  /** „Servicegebühr (5 %)" */
  titel: string
  /** Was der (i)-Knopf aufklappt: „5 %, mind. € 0,50. Für Bereitstellung …" */
  erklaerung: string
  /** Bar vor dem Stichtag bei einem Hof mit Online-Gebühr: „entfällt" statt € 0,00. */
  entfaellt: boolean
}

/** Das Wort in der Übersicht, wenn bar keine Gebühr kostet, online aber schon (N10). */
export const GEBUEHR_ENTFAELLT = 'entfällt'

/**
 * Die Gebührenzeile der Übersicht vor dem Bestellen (Register N10, Nr. 82):
 * kurzer Titel mit dem Satz des Hofs, Mindestgebühr und Erklärsatz hinter dem
 * (i)-Knopf. Nur Worte — den Betrag zeigt die Übersicht allein aus
 * `kassenBetraege`. „entfällt" heißt: Bei bar kostet die Gebühr bis zum
 * Stichtag nichts, online gälte sie (`barGuenstiger`, Register B1). Beim
 * gebührenfreien Hof entfällt nichts — es gibt keine. `zahlweg` ist der
 * angebotene gewählte Zahlweg (`kassenZahlweg`): Ohne angebotene Barzahlung
 * steht kein „entfällt".
 */
export function gebuehrZeile(hof: KassenHof, jetzt: Date, zahlweg: Zahlungsart | null): GebuehrZeile {
  // Hofpreis-Modell (N38): „Plattformgebühr (6 %)“ und der Satz aus konditionen.ts; entfällt nie.
  if (hof.preisAnzeige) {
    return { titel: `${PLATTFORMGEBUEHR_BEZEICHNUNG} (${satzText(hof.preisAnzeige.hundertstel)} %)`, erklaerung: PLATTFORMGEBUEHR_SATZ, entfaellt: false }
  }
  const satz = servicegebuehrSatz(hof, jetzt)
  if (!satz) return { titel: SERVICEGEBUEHR_BEZEICHNUNG, erklaerung: SERVICEGEBUEHR_HINWEIS, entfaellt: false }
  return {
    titel: `${SERVICEGEBUEHR_BEZEICHNUNG} (${formatZahl(satz.prozent)} %)`,
    erklaerung: `${satzMitMindestgebuehr(satz)}. ${SERVICEGEBUEHR_HINWEIS}`,
    entfaellt: zahlweg === 'ONSITE_CASH' && barGuenstiger(hof, jetzt),
  }
}

/** Der Zahlweg online — unter dem Kaufknopf und im Zahlungsschritt. */
export const ZAHLWEG_ONLINE = 'Bezahlung sicher über Stripe'

/** Der Zahlweg bar — unter dem Kaufknopf, nur bei angebotener Barzahlung. */
const ZAHLWEG_BAR = 'bar am Hof · Bestätigung per E-Mail'

/**
 * Die Zeile unter dem Kaufknopf (Register N10): Termin und Zahlweg, damit die
 * Kundin vor dem Tippen sieht, wann sie abholt und wie sie zahlt —
 * „Abholung So, 18. Okt, 14:00–16:00 Uhr · Bezahlung sicher über Stripe" bzw.
 * „… · bar am Hof · Bestätigung per E-Mail". Den Termin schreibt `abholSatz`;
 * ohne gewählten Termin steht dort die Bitte, einen zu wählen. „bar am Hof"
 * nur, wenn die Kasse bar anbietet (`bar`, aus `kassenZahlweg`): Ohne
 * angebotene Zahlart steht nur der Termin da. Mit Kaufsperre (`gesperrt`, Register
 * N24) gibt es nichts zu wählen — die Karte oben nennt den Grund, hier steht nur
 * noch der Zahlweg (leer, wenn es keinen gibt).
 */
export function kaufknopfZeile(k: { termin: string | null; online: boolean; bar: boolean; gesperrt?: boolean }): string {
  const zahlweg = k.online ? ZAHLWEG_ONLINE : k.bar ? ZAHLWEG_BAR : null
  if (k.gesperrt) return zahlweg ?? ''
  const abholung = k.termin ? `Abholung ${k.termin}` : 'Wähl noch, wann du abholst'
  return zahlweg ? `${abholung} · ${zahlweg}` : abholung
}

// ─── Reservierungsfrist ─────────────────────────────────────────────────────

/** Wie lange ein erneuerter Halt gilt, in Minuten — für den Satz „… wieder N Minuten". */
export const RESERVIERUNG_MINUTEN = Math.round(RESERVIERUNG_TTL_MS / 60_000)

export type ReservierungsStand =
  | { zustand: 'unbekannt' }
  | { zustand: 'laeuft'; uhrzeit: string; rest: string }
  | { zustand: 'abgelaufen' }

/**
 * Was die Kasse zur Frist sagt. Vor dem Bestellen ist es die Frist der Halte
 * (StockReservation.expiresAt, von /api/warenkorb/pruefen beim Öffnen
 * erneuert), im Zahlungsschritt die Zahlungsfrist der Bestellung (fristVon).
 * An der Frist selbst gilt sie als abgelaufen — wie istGueltig
 * (`expiresAt > jetzt`). Angefangene Minuten zählen voll: „noch 1 Minute"
 * heißt höchstens eine.
 */
export function reservierungsStand(bisIso: string | null, jetzt: Date): ReservierungsStand {
  if (!bisIso) return { zustand: 'unbekannt' }
  const bis = new Date(bisIso)
  if (Number.isNaN(bis.getTime())) return { zustand: 'unbekannt' }
  const restMs = bis.getTime() - jetzt.getTime()
  if (restMs <= 0) return { zustand: 'abgelaufen' }
  const minuten = Math.ceil(restMs / 60_000)
  return {
    zustand: 'laeuft',
    uhrzeit: uhrzeitInWien(bis),
    rest: minuten === 1 ? 'noch 1 Minute' : `noch ${minuten} Minuten`,
  }
}

// ─── Zahlung ────────────────────────────────────────────────────────────────

export type ZahlungsFehler = 'bezahlt' | 'abgelaufen' | 'abgelehnt' | 'netz' | 'sonstig'

/**
 * Was ein Fehler aus `stripe.confirmPayment` für die Kundin heißt.
 *
 * - Schon bezahlt oder in Bearbeitung (etwa nach Zurück und erneutem Tippen):
 *   Stripe meldet das als Fehler, das Geld ist aber unterwegs — zur
 *   Bestellung, die zeigt den Stand. Nie „nichts abgebucht".
 * - Abgebrochener Zahlungsvorgang oder Frist um: kein neuer Versuch möglich.
 * - Nur eine abgelehnte Karte (`card_error`) heißt sicher: Der Zahlungsvorgang
 *   steht wieder auf „Zahlungsart fehlt", es wurde nichts abgebucht, ein neuer
 *   Versuch geht. Unvollständige Eingaben zeigt Stripe selbst am Feld,
 *   Netzfehler (`api_connection_error`) heißen `netz`: Ob die Zahlung ankam, ist
 *   offen — die Kasse zeigt `NETZ_SATZ_UNSICHER` (Register N29, Ergänzung 26.10.2026).
 */
export function zahlungsFehlerArt(f: {
  fehlerTyp: string | undefined
  intentStatus: string | undefined
  fristUm: boolean
}): ZahlungsFehler {
  if (f.intentStatus === 'succeeded' || f.intentStatus === 'processing') return 'bezahlt'
  if (f.intentStatus === 'canceled' || f.fristUm) return 'abgelaufen'
  if (f.fehlerTyp === 'card_error') return 'abgelehnt'
  if (f.fehlerTyp === 'api_connection_error') return 'netz'
  return 'sonstig'
}

/** Der Fehlerzustand „Zahlung abgelehnt" (Mockup web-k3-zahlung-abgelehnt). */
export function zahlungAbgelehntText(bisUhrzeit: string | null): { titel: string; text: string } {
  const grund = 'Es wurde nichts abgebucht. Versuch es mit einer anderen Karte oder Zahlungsart'
  return {
    titel: 'Deine Karte wurde abgelehnt',
    text: bisUhrzeit ? `${grund} – deine Ware bleibt bis ${bisUhrzeit} Uhr für dich reserviert.` : `${grund}.`,
  }
}

/**
 * Die Bestätigungsseite mit `redirect_status`, wie Stripe sie nach der Zahlung
 * aufruft — für den Fall, dass die Zahlung schon durch ist und wir selbst
 * weiterleiten. Über URL gebaut statt mit angehängtem „&": Der Pfad vom Server
 * trägt heute `?sig=…`, ein Pfad ohne Abfrage ergäbe sonst eine kaputte
 * Adresse. Zurück kommt nur Pfad und Abfrage — die Weiterleitung bleibt auf
 * der eigenen Seite.
 */
export function bestaetigungMitStatus(pfad: string, origin: string, status: string): string {
  const url = new URL(pfad, origin)
  url.searchParams.set('redirect_status', status)
  return `${url.pathname}${url.search}`
}

/**
 * Der Satz unter der E-Mail (E8: Bestellen als Gast, kein Satz dazu im Checkout). Der Weg
 * zur Bestellung ist der signierte Link in der Bestätigungsmail.
 */
export const KONTAKT_HINWEIS = 'Dorthin schicken wir dir die Bestätigung mit dem Link zu deiner Bestellung.'

// ─── Käuferart vorbelegen (Nr. 29) ──────────────────────────────────────────

/** Startwert des Abschnitts „Betrieb" — dieselbe Form wie getBetriebsVorbelegung. */
export type KassenVorbelegung = { kaeuferArt: 'BETRIEB'; betriebsnummer: string }

/**
 * Die Adresse der Kasse; aus „Region › Futter kaufen" mit `?kaeufer=betrieb`
 * (src/schemas/kaeufer-vorbelegung.ts). Ohne Vorbelegung die bisherige Adresse.
 */
export function kassenAdresse(farmSlug: string, kaeufer: KaeuferVorbelegung | null): string {
  return mitKaeuferVorbelegung(`/${farmSlug}/checkout`, kaeufer)
}

/**
 * Womit der Abschnitt „Betrieb" startet. Die Vorbelegung aus dem eigenen Hof
 * (getBetriebsVorbelegung, mit Betriebsnummer) geht vor; sonst belegt
 * `?kaeufer=betrieb` nur den Haken vor, die Nummer bleibt leer. NUR der
 * Startwert des Formulars: Die Kundin kann umstellen, ein verborgener
 * Abschnitt schickt weiter PRIVAT, und ob die Käuferart reicht, prüft allein
 * /api/checkout (pruefeBetriebsnachweis). Geld, Gebühr und Bestand berührt sie nicht.
 */
export function kassenVorbelegung(
  ausHof: KassenVorbelegung | null,
  ausAdresse: KaeuferVorbelegung | null
): KassenVorbelegung | null {
  if (ausHof) return ausHof
  if (ausAdresse === 'betrieb') return { kaeuferArt: 'BETRIEB', betriebsnummer: '' }
  return null
}

// ─── Rückweg ────────────────────────────────────────────────────────────────

export type KassenZurueck =
  | { art: 'link'; href: string; label: string }
  | { art: 'knopf'; ziel: 'formular' | 'zahlung'; label: string }

/**
 * Wohin „Zurück" im Kopf der Kasse führt. Hinaus zum Hof nur, solange keine
 * Bestellung steht (ARCHITECTURE §4, „Kundenseiten"): Danach hält sie Bestand,
 * und wer hinaus- und wiederkäme, bekäme einen neuen Idempotenz-Schlüssel und
 * legte eine zweite an. Ab dann wechselt „Zurück" nur zwischen Angaben und
 * Zahlung.
 */
export function kassenZurueck(k: {
  farmSlug: string
  schritt: 'formular' | 'zahlung'
  bestellungAngelegt: boolean
}): KassenZurueck {
  if (k.schritt === 'zahlung') return { art: 'knopf', ziel: 'formular', label: 'Zurück zu deinen Angaben' }
  if (k.bestellungAngelegt) return { art: 'knopf', ziel: 'zahlung', label: 'Zurück zur Zahlung' }
  return { art: 'link', href: `/${k.farmSlug}`, label: 'Zurück zum Hof' }
}

// ─── Abholung ───────────────────────────────────────────────────────────────

export type AbholKachel = {
  /** „JJJJ-MM-TT|HH:MM|HH:MM" — der Wert, den /api/checkout prüft. */
  key: string
  /**
   * „Sa, 10. Okt" — jeder Termin mit Wochentag UND Datum (Nr. 46, Register
   * N2): Ein Wochentag allein ließ offen, welcher Samstag gemeint ist.
   */
  datum: string
  /** „Heute" bzw. „Morgen" zusätzlich zum Datum, sonst null. */
  relativ: 'Heute' | 'Morgen' | null
  /** „15:00–18:00 Uhr". */
  zeit: string
  /** Beginn, HH:MM — zugleich Bestellschluss (src/lib/fristen.ts). */
  start: string
  heute: boolean
  ausgebucht: boolean
}

/**
 * Die wählbaren Abholfenster als Kacheln — mit derselben Regel, die der
 * Checkout-Handler prüft (angeboteneAbholfenster). Volle Fenster bleiben
 * sichtbar, aber nicht wählbar; gezählt hat der Server.
 */
export function abholKacheln(slots: readonly AbholSlot[], jetzt: Date, ausgebucht: readonly string[]): AbholKachel[] {
  const heute = kalendertagInWien(jetzt)
  const morgen = tagVersetzt(heute, 1)
  return angeboteneAbholfenster(slots, jetzt).map((f) => {
    const key = abholSchluessel(f)
    return {
      key,
      datum: formatTagKurz(f.datum),
      relativ: f.datum === heute ? 'Heute' : f.datum === morgen ? 'Morgen' : null,
      zeit: `${f.start}–${f.ende} Uhr`,
      start: f.start,
      heute: f.datum === heute,
      ausgebucht: ausgebucht.includes(key),
    }
  })
}

/**
 * Der gewählte Termin als Satzteil — unter dem Kaufknopf und im
 * Zahlungsschritt: „Sa, 10. Okt, 09:00–12:00 Uhr", heute bzw. morgen mit dem
 * Wort dazu: „Do, 8. Okt (heute), 15:00–18:00 Uhr". Dieselbe Schreibweise wie
 * die Kachel, damit die Kundin den Termin wiedererkennt.
 */
export function abholSatz(k: Pick<AbholKachel, 'datum' | 'relativ' | 'zeit'>): string {
  const relativ = k.relativ ? ` (${k.relativ.toLowerCase()})` : ''
  return `${k.datum}${relativ}, ${k.zeit}`
}

/**
 * Bis wann heute noch bestellt werden kann: der Beginn des LETZTEN freien
 * heutigen Fensters (Bestellschluss = Beginn, src/lib/fristen.ts). Kein
 * heutiges Fenster mehr frei: null.
 */
export function bestellschlussHeute(kacheln: readonly AbholKachel[]): string | null {
  return kacheln.filter((k) => k.heute && !k.ausgebucht).at(-1)?.start ?? null
}

// ─── Vertrauen, Grund, Ausweg (Nr. 176; Board system-sterne-kasse-vertrauen) ─

/** Unter der Gesamtsumme: Die Preise der Hofseite und der Kasse enthalten die Umsatzsteuer. */
export const PREISE_INKL_UST = 'Preise inkl. USt'

/** Der Link bei „Deine Daten" zur Datenschutzerklärung — die Kasse hat keinen Seitenfuß. */
export const KASSE_DATENSCHUTZ_LINK = 'Was passiert damit?'

/** Nach dem Zeitlimit: kein Vorwurf, und die Zusage, die der Idempotenz-Schlüssel hält. */
export const KASSE_ZEITLIMIT_SATZ = 'Dauert länger als sonst – nichts wird doppelt bestellt.'

/** Der Knopf dazu. */
export const KASSE_NOCHMAL = 'Nochmal versuchen'

/**
 * Der Zusatz an der Korb-Leiste der Hofseite (product-grid.tsx, Nr. 177 übernimmt
 * den Import): „Servicegebühr" ist das Wort der Wortliste, „Gebühr" allein nicht.
 */
export const SERVICEGEBUEHR_ZUSATZ = '+ Servicegebühr'

/** So lange wartet die Kasse auf /api/checkout, bevor sie „Nochmal versuchen" anbietet. */
export const KASSE_ZEITLIMIT_MS = 15_000

/**
 * Schickt die Bestellung an /api/checkout — wirft nie. `netz`/`zeit` heißt: Die
 * Antwort fehlt, ob der Server die Bestellung angelegt hat, ist offen. Der
 * zweite Versuch schickt deshalb den SELBEN Idempotenz-Schlüssel (er steht im
 * `body`, den die Kasse unverändert wieder übergibt): Der Server liefert dann
 * die bestehende Bestellung statt einer zweiten. Die Antwort mit Fehlerstatus
 * ist kein Wurf; die bewertet die Kasse selbst.
 */
export function bestellungSenden(body: unknown, { zeitlimitMs = KASSE_ZEITLIMIT_MS }: { zeitlimitMs?: number } = {}): Promise<NetzErgebnis<Response>> {
  const text = JSON.stringify(body)
  return mitNetzSchutz(
    (signal) => fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text, signal }),
    { zeitlimitMs }
  )
}

/** Das Stück des Tastaturereignisses, das `weiterBeiEnter` braucht (ohne DOM-Typen testbar). */
type EnterEreignis = {
  key: string
  target: unknown
  currentTarget: { querySelectorAll(auswahl: string): ArrayLike<{ focus(): void }> }
  preventDefault(): void
}

/**
 * Enter in einem einzeiligen Feld geht zum nächsten Feld, statt das Formular
 * abzuschicken. Die Tastatur zeigt dort „Weiter" (enterKeyHint) — und der
 * Abschluss dieses Formulars ist zahlungspflichtig: Eine Taste, die „Weiter"
 * heißt, darf nie bestellen. Notizfeld, Haken und Knöpfe behalten ihr Verhalten.
 *
 * Bleibt so (Entscheidung 4, Morgenbericht 25, am 26.10.2026 bestätigt): Enter
 * springt in der Kasse weiter, bestellt wird nur mit dem Kaufknopf.
 */
export function weiterBeiEnter(e: EnterEreignis): void {
  const ziel = e.target as { tagName?: string; type?: string; focus?: () => void }
  if (e.key !== 'Enter' || ziel.tagName !== 'INPUT') return
  if (ziel.type === 'checkbox' || ziel.type === 'radio' || ziel.type === 'submit' || ziel.type === 'button') return
  e.preventDefault()
  const felder = Array.from(e.currentTarget.querySelectorAll('input:not([type=radio]):not([type=checkbox]):not([type=submit]):not([type=button]):not([disabled]), textarea:not([disabled])'))
  const i = felder.indexOf(ziel as (typeof felder)[number])
  felder[i + 1]?.focus()
}
