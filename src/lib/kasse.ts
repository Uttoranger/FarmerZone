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
import { formatEuro, formatZahl } from '@/lib/format'
import { uhrzeitInWien } from '@/lib/fristen'
import { abholtagName } from '@/lib/heute'
import { korbBetraege, zahlungsarten } from '@/lib/hofseite-kunde'
import { BAR_OHNE_GEBUEHR_HINWEIS } from '@/lib/konditionen'
import { calcTotalAmount, decimalZuCents } from '@/lib/order-totals'
import { RESERVIERUNG_TTL_MS } from '@/lib/reservierung'
import {
  SERVICEGEBUEHR_BEZEICHNUNG,
  barOhneServicegebuehr,
  berechneServicegebuehr,
  centsAlsEuro,
  kalendertagInWien,
  servicegebuehrSatz,
  type ServicegebuehrEinstellung,
} from '@/lib/servicegebuehr'

// ─── Zahlarten (E5) ─────────────────────────────────────────────────────────

/**
 * Womit eine NEUE Bestellung bezahlt werden kann. Seit E5 kennt das
 * Preismodell nur online und bar bei Abholung. ONSITE_CARD bleibt im Enum
 * (Expand/Contract), solange Bestellungen ihn tragen: Anzeige, Storno und
 * Abrechnung alter Bestellungen lesen ihn weiter, nur anlegen kann ihn
 * niemand mehr.
 */
export const NEUE_BESTELLUNG_ZAHLARTEN = ['ONLINE', 'ONSITE_CASH'] as const
export type NeueZahlart = (typeof NEUE_BESTELLUNG_ZAHLARTEN)[number]

/** Darf eine neue Bestellung mit dieser Zahlart angelegt werden? */
export function zahlartFuerNeueBestellung(paymentMethod: string): paymentMethod is NeueZahlart {
  return (NEUE_BESTELLUNG_ZAHLARTEN as readonly string[]).includes(paymentMethod)
}

/** Maschinenlesbar für den Browser: Die gewählte Zahlart gibt es nicht (mehr). */
export const CODE_ZAHLART_NICHT_ANGEBOTEN = 'ZAHLART_NICHT_ANGEBOTEN'

/** Was die Kundin liest, wenn ein alter Tab noch „Karte bei Abholung" schickt. */
export const ZAHLART_NICHT_ANGEBOTEN =
  'Karte bei Abholung gibt es nicht mehr. Bitte wähl „Online bezahlen" oder „Bar bei Abholung".'

export type KassenZahlart = { wert: NeueZahlart; titel: string; zusatz: string }

/**
 * Die Zahlarten, die die Kasse anbietet — aus derselben Regel wie die rechte
 * Spalte der Hofseite (`zahlungsarten`: online nur mit fertiger Stripe-Anbindung des Hofs).
 * Welche Online-Wege (Karte, EPS, Apple/Google Pay) es dann gibt, zeigt
 * Stripes Zahlungsfeld im nächsten Schritt — das hängt an den Einstellungen im
 * Stripe-Dashboard und am Gerät, nicht an uns. Deshalb verspricht der Zusatz
 * keinen bestimmten Weg.
 *
 * „gleicher Betrag" sagt der Zusatz nur, wenn es stimmt: Kostet bar gerade
 * keine Gebühr, online aber schon (`barHinweis`, Register B1), fällt er weg —
 * den Unterschied nennt dann der Hinweis unter den Zahlarten.
 */
export function kassenZahlarten(
  hof: {
    acceptsOnline: boolean
    stripeAccountReady: boolean
    acceptsOnsite: boolean
  },
  barGuenstiger = false
): KassenZahlart[] {
  return zahlungsarten(hof).map((z) =>
    z.art === 'online'
      ? { wert: 'ONLINE', titel: 'Online bezahlen', zusatz: 'Karte und weitere Wege – du wählst im nächsten Schritt' }
      : {
          wert: 'ONSITE_CASH',
          titel: 'Bar bei Abholung',
          zusatz: barGuenstiger ? 'du bestätigst per E-Mail' : 'gleicher Betrag, du bestätigst per E-Mail',
        }
  )
}

/**
 * Der Hinweis unter den Zahlarten (Register B1): „Bei Barzahlung bis
 * <Vortag des Stichtags> ohne Servicegebühr." — nur, solange bar wirklich günstiger
 * ist: vor dem Stichtag (`barOhneServicegebuehr`) UND bei einem Hof, dessen
 * Online-Gebühr gerade gilt. Bei einem gebührenfreien Hof ist bar ohnehin
 * gleich teuer, ab dem Stichtag zahlt bar wieder dieselbe Gebühr — dann
 * null, kein Hinweis. `jetzt` wie überall in der Kasse aus der Uhr der Seite;
 * verbindlich entscheidet /api/checkout mit der Server-Uhr.
 */
export function barHinweis(hof: ServicegebuehrEinstellung, jetzt: Date): string | null {
  if (!barOhneServicegebuehr('ONSITE_CASH', jetzt)) return null
  return servicegebuehrSatz(hof, jetzt) === null ? null : BAR_OHNE_GEBUEHR_HINWEIS
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
  hof: ServicegebuehrEinstellung,
  jetzt: Date,
  zahlungsart: string
): KassenBetraege {
  const { zeilenCents } = korbBetraege(positionen)
  const warenCents = decimalZuCents(calcTotalAmount(positionen.map((p) => ({ unitPrice: p.price, quantity: p.quantity }))))
  const { gebuehrCents } = berechneServicegebuehr(warenCents, hof, jetzt, zahlungsart)
  return { zeilenCents, warenCents, gebuehrCents, gesamtCents: warenCents + gebuehrCents }
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
export function zahlungsGebuehrText(hof: ServicegebuehrEinstellung, jetzt: Date, betrag: ZahlungsBetrag): string {
  const { warenCents, gebuehrCents } = zahlungsBetraege(betrag)
  if (berechneServicegebuehr(warenCents, hof, jetzt, 'ONLINE').gebuehrCents !== gebuehrCents) return SERVICEGEBUEHR_BEZEICHNUNG
  return gebuehrBezeichnung(hof, jetzt)
}

/** „Servicegebühr · 5 %, mind. € 0,50" — Satz und Mindestgebühr aus der Hofeinstellung. */
export function gebuehrBezeichnung(hof: ServicegebuehrEinstellung, jetzt: Date): string {
  const satz = servicegebuehrSatz(hof, jetzt)
  if (!satz) return SERVICEGEBUEHR_BEZEICHNUNG
  const mindestens = satz.mindestCents > 0 ? `, mind. ${formatEuro(centsAlsEuro(satz.mindestCents))}` : ''
  return `${SERVICEGEBUEHR_BEZEICHNUNG} · ${formatZahl(satz.prozent)} %${mindestens}`
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

export type ZahlungsFehler = 'bezahlt' | 'abgelaufen' | 'abgelehnt' | 'sonstig'

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
 *   Netzfehler bleiben ohne Zusatz.
 */
export function zahlungsFehlerArt(f: {
  fehlerTyp: string | undefined
  intentStatus: string | undefined
  fristUm: boolean
}): ZahlungsFehler {
  if (f.intentStatus === 'succeeded' || f.intentStatus === 'processing') return 'bezahlt'
  if (f.intentStatus === 'canceled' || f.fristUm) return 'abgelaufen'
  if (f.fehlerTyp === 'card_error') return 'abgelehnt'
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
  /** „Heute", „Morgen", „Mittwoch" oder „Mittwoch, 14. Oktober". */
  tag: string
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
  return angeboteneAbholfenster(slots, jetzt).map((f) => {
    const key = abholSchluessel(f)
    return {
      key,
      tag: f.datum === heute ? 'Heute' : abholtagName(heute, f.datum),
      zeit: `${f.start}–${f.ende} Uhr`,
      start: f.start,
      heute: f.datum === heute,
      ausgebucht: ausgebucht.includes(key),
    }
  })
}

/**
 * Bis wann heute noch bestellt werden kann: der Beginn des LETZTEN freien
 * heutigen Fensters (Bestellschluss = Beginn, src/lib/fristen.ts). Kein
 * heutiges Fenster mehr frei: null.
 */
export function bestellschlussHeute(kacheln: readonly AbholKachel[]): string | null {
  return kacheln.filter((k) => k.heute && !k.ausgebucht).at(-1)?.start ?? null
}
