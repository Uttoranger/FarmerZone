import { SUPPORT_EMAIL } from '@/lib/support'
import { hofSichtbar } from '@/lib/hof-sichtbar'

/**
 * Was die Regeln dieser Datei vom Stripe-Konto lesen — ein Ausschnitt von
 * `Stripe.Account`, damit die Datei ohne SDK bleibt (das volle Konto ist
 * zuweisbar). Geprüft am SDK stripe 22.1.1 (API 2026-04-22.dahlia): Die
 * Fähigkeiten tragen je 'active' | 'inactive' | 'pending'.
 */
export type StripeKontoDaten = {
  charges_enabled?: boolean | null
  payouts_enabled?: boolean | null
  details_submitted?: boolean | null
  capabilities?: {
    card_payments?: string | null
    transfers?: string | null
    eps_payments?: string | null
  } | null
  requirements?: {
    disabled_reason?: string | null
    currently_due?: readonly string[] | null
    past_due?: readonly string[] | null
    pending_verification?: readonly string[] | null
  } | null
}

/** Die drei Fähigkeiten, die die App bei Stripe anfordert (createConnectAccount) und für „bereit“ verlangt. */
const PFLICHT_FAEHIGKEITEN = ['card_payments', 'transfers', 'eps_payments'] as const

/**
 * Wann das Stripe-Konto eines Hofs Online-Zahlungen tragen kann — EINE Regel
 * für alle, die `Farm.stripeAccountReady` schreiben: die Rückkehr aus dem
 * Onboarding (api/stripe/return), „Status prüfen" (actions/stripe-connect.ts)
 * und die Ereignisse `account.updated` und `capability.updated`
 * (api/stripe/webhook) — alle über `schreibeStripeKontoStand`
 * (src/server/stripe-konto-stand.ts).
 *
 * Bereit heißt (Register N49, E-036): Zahlungen UND Auszahlungen frei, und
 * Karte, Überweisung und EPS bei Stripe aktiv. Fehlt nur EPS, ist online ganz
 * aus, auch Karte — gewollt: Im Hofpreis-Modell (on_behalf_of) lehnt Stripe
 * ohne aktive EPS-Fähigkeit jeden Zahlungsvorgang mit EPS ab, und die Kasse
 * bietet EPS immer an (KASSE_ZAHLARTEN). Fehlt `capabilities` oder ein
 * Schlüssel darin: nicht bereit.
 *
 * Rein, ohne Stripe-SDK (tests/stripe-konto.test.ts).
 */
export function stripeKontoBereit(konto: StripeKontoDaten): boolean {
  if (konto.charges_enabled !== true || konto.payouts_enabled !== true) return false
  const faehigkeiten = konto.capabilities
  if (!faehigkeiten) return false
  return PFLICHT_FAEHIGKEITEN.every((f) => faehigkeiten[f] === 'active')
}

// ─── Grober Stand des Stripe-Kontos (Register N49) ─────────────────────────

/**
 * Die Werte, die in `Farm.stripeKontoStand` stehen dürfen — geprüft beim
 * Schreiben. Nur dieser grobe Stand wird gespeichert, nie `disabled_reason`,
 * Listen oder Kennungen aus `requirements`.
 */
export const STRIPE_KONTO_STAENDE = ['bereit', 'gesperrt', 'angaben_fehlen', 'eps_fehlt', 'pruefung', 'unklar'] as const
export type StripeKontoStand = (typeof STRIPE_KONTO_STAENDE)[number]

export function istStripeKontoStand(wert: unknown): wert is StripeKontoStand {
  return typeof wert === 'string' && (STRIPE_KONTO_STAENDE as readonly string[]).includes(wert)
}

function nichtLeer(liste: readonly string[] | null | undefined): boolean {
  return Array.isArray(liste) && liste.length > 0
}

/** disabled_reason, die „Stripe prüft“ heißen (ohne Zutun des Hofs). */
const GRUND_PRUEFUNG: ReadonlySet<string> = new Set(['requirements.pending_verification', 'under_review', 'listed'])

/**
 * Der grobe Stand des Kontos: die erste Stufe, die zutrifft.
 * 1 bereit — `stripeKontoBereit`.
 * 2 gesperrt — Stripe hat abgelehnt (`rejected.…`) oder die Plattform pausiert.
 * 3 angaben_fehlen — der Hof muss im Stripe-Formular noch etwas tun.
 * 4 eps_fehlt — alles fertig, nur EPS ist weder aktiv noch in Prüfung.
 * 5 pruefung — Stripe prüft, der Hof muss nichts tun.
 * 6 unklar — sonst (das Team sieht nach, Aufgabe 'hof_online_haengt').
 *
 * GRENZE (DEVELOPMENT.md): Anforderungen mit der Endung „.support“ kann der
 * Hof im Formular nicht lösen; er sieht trotzdem „Angaben fehlen“.
 */
export function stripeKontoStand(konto: StripeKontoDaten): StripeKontoStand {
  if (stripeKontoBereit(konto)) return 'bereit'
  const anforderungen = konto.requirements ?? null
  const grund = anforderungen?.disabled_reason ?? null
  if (grund !== null && (grund.startsWith('rejected.') || grund === 'platform_paused')) return 'gesperrt'
  if (
    konto.details_submitted !== true ||
    nichtLeer(anforderungen?.currently_due) ||
    nichtLeer(anforderungen?.past_due) ||
    grund === 'requirements.past_due'
  ) {
    return 'angaben_fehlen'
  }
  const faehigkeiten = konto.capabilities ?? null
  const eps = faehigkeiten?.eps_payments ?? null
  if (
    konto.charges_enabled === true &&
    konto.payouts_enabled === true &&
    faehigkeiten?.card_payments === 'active' &&
    faehigkeiten?.transfers === 'active' &&
    eps !== 'active' &&
    eps !== 'pending'
  ) {
    return 'eps_fehlt'
  }
  if (
    nichtLeer(anforderungen?.pending_verification) ||
    (grund !== null && GRUND_PRUEFUNG.has(grund)) ||
    PFLICHT_FAEHIGKEITEN.some((f) => faehigkeiten?.[f] === 'pending')
  ) {
    return 'pruefung'
  }
  return 'unklar'
}

/** Was eine Seite zeigt: ohne Konto 'kein_konto', sonst ein Stand. */
export type StripeAnzeige = 'kein_konto' | StripeKontoStand

/**
 * Die Anzeige aus dem, was die Datenbank trägt. Bereit gilt nur über
 * `stripeAccountReady` (die eine Quelle von Kasse und Hofseite); ein
 * gespeichertes 'bereit' bei nicht bereit, NULL (Bestand ohne Backfill) oder
 * ein unbekannter Text zeigen 'angaben_fehlen' — das bisherige Verhalten.
 * Abfragen geben nur `stripeKontoDa` weiter, nie die Kennung.
 */
export function stripeAnzeige(d: {
  stripeKontoDa: boolean
  stripeAccountReady: boolean
  stripeKontoStand: string | null
}): StripeAnzeige {
  if (!d.stripeKontoDa) return 'kein_konto'
  if (d.stripeAccountReady) return 'bereit'
  if (istStripeKontoStand(d.stripeKontoStand) && d.stripeKontoStand !== 'bereit') return d.stripeKontoStand
  return 'angaben_fehlen'
}

/** Was der Hof sieht: eps_fehlt und unklar heißen für ihn gleich („noch nicht freigegeben“). */
export type HofStripeStufe = 'kein_konto' | 'bereit' | 'gesperrt' | 'angaben_fehlen' | 'pruefung' | 'noch_nicht'

export function hofStufe(anzeige: StripeAnzeige): HofStripeStufe {
  return anzeige === 'eps_fehlt' || anzeige === 'unklar' ? 'noch_nicht' : anzeige
}

/**
 * Weiche W-A (Register N49): Der Hof bekommt eine Nachricht, wenn Stripe nach
 * der Prüfung doch noch Angaben braucht. Projektleitung, 10.11.2026: ja.
 */
export const ANGABEN_NACHRICHT: boolean = true

// ─── Texte für den Hof (Register N49; das Wort EPS steht in keinem) ─────────

/** Die Stufen, in denen der Hof nichts im Stripe-Formular tun kann. */
export type HofWarteStufe = 'pruefung' | 'noch_nicht' | 'gesperrt'

export function istHofWarteStufe(stufe: HofStripeStufe): stufe is HofWarteStufe {
  return stufe === 'pruefung' || stufe === 'noch_nicht' || stufe === 'gesperrt'
}

const PRUEFUNG_TEXT_ANFANG =
  'Du musst nichts tun, wir melden uns. Das dauert meist nur kurz, manchmal ein paar Werktage. Sobald die Online-Zahlung aktiv ist, siehst du es hier.'

/**
 * Zahlungsseite: Kasten (Titel, Text) und Marke an der Karte
 * „Online-Zahlung (Stripe)“ — dieselben Wörter im Einrichten-Schritt.
 * Ohne W-A sagt „Stripe prüft“ zusätzlich, wo der Hof erfährt, wenn doch noch
 * etwas fehlt (dann gibt es keine Nachricht).
 */
export const ZAHLUNG_STUFE_TEXT: Record<HofWarteStufe, { titel: string; text: string; marke: string }> = {
  pruefung: {
    titel: 'Stripe prüft deine Angaben.',
    text: ANGABEN_NACHRICHT
      ? PRUEFUNG_TEXT_ANFANG
      : `${PRUEFUNG_TEXT_ANFANG} Braucht Stripe noch etwas von dir, steht es hier und auf Heute.`,
    marke: 'Stripe prüft',
  },
  noch_nicht: {
    titel: 'Stripe hat die Online-Zahlung noch nicht ganz freigegeben.',
    text: 'Du musst nichts tun, wir kümmern uns darum und melden uns.',
    marke: 'Noch nicht freigegeben',
  },
  gesperrt: {
    titel: 'Online-Zahlung ist bei Stripe gesperrt.',
    text: `Online bezahlen geht bei dir deshalb gerade nicht. Schreib uns bitte an ${SUPPORT_EMAIL}, wir helfen dir weiter.`,
    marke: 'Bei Stripe gesperrt',
  },
}

/** Zeile „Zahlung“ in den Einstellungen für die Stufen, in denen der Hof wartet. */
export const ZAHLUNG_ZEILE_TEXT: Record<HofWarteStufe, string> = {
  pruefung: 'Stripe prüft deine Angaben · du musst nichts tun',
  noch_nicht: 'Stripe hat noch nicht ganz freigegeben · wir kümmern uns darum',
  gesperrt: 'Online-Zahlung bei Stripe gesperrt · schreib uns',
}

/** Knopf des Hinweises auf Heute, wenn der Hof nichts bei Stripe ergänzen kann. */
export const ZAHLUNG_ANSEHEN = 'Zahlung ansehen'
/** Knopf, wenn der Hof bei Stripe etwas ergänzen muss. */
export const BEI_STRIPE_ERGAENZEN = 'Bei Stripe ergänzen'

/** Die Stufen, für die Heute einen Hinweis zeigt (Konto da, nicht bereit). */
export type HofPausiertStufe = 'angaben_fehlen' | HofWarteStufe

/**
 * Der Hof will online kassieren, hat ein Stripe-Konto, aber Stripe lässt es
 * gerade nicht zu (Angaben fehlen, Konto gesperrt oder in Prüfung). Dann
 * bietet der Checkout Online nicht an, und Heute zeigt den Hinweis mit dem Weg
 * zu Stripe.
 *
 * NUR MIT KONTO: `acceptsOnline` steht für jeden neuen Hof vorbelegt auf true.
 * Ohne die Bedingung stünde „pausiert" ab Tag eins bei jedem Hof, der Stripe
 * nie eingerichtet hat — dafür hat die Erste-Schritte-Karte ihren eigenen
 * Schritt „Online-Zahlung einrichten".
 */
export function onlineZahlungPausiert(hof: {
  acceptsOnline: boolean
  stripeAccountReady: boolean
  stripeAccountId: string | null
}): boolean {
  return hof.acceptsOnline && !hof.stripeAccountReady && hof.stripeAccountId !== null
}

/**
 * Antwort des Checkouts, wenn Stripe den Zahlungsvorgang nicht anlegen
 * konnte — Code für den Browser, Satz für die Kundin.
 */
export const CODE_ZAHLUNG_NICHT_MOEGLICH = 'ZAHLUNG_NICHT_MOEGLICH'

export function zahlungNichtMoeglichText(barMoeglich: boolean): string {
  return barMoeglich
    ? 'Online-Zahlung ist gerade nicht möglich. Bitte versuch es später oder wähle Barzahlung.'
    : 'Online-Zahlung ist gerade nicht möglich. Bitte versuch es später noch einmal.'
}

/**
 * Der Hinweis auf Heute (Titel, Satz, Knopf) je Stufe, ohne Fachbegriffe.
 * Ohne Barzahlung gibt es keinen Ausweg für die Kunden; dann darf der Satz
 * ihn nicht versprechen — `barMoeglich` ist dieselbe Frage wie in Kasse und
 * Zahlungsseite (ladeBarMoeglich), nicht nur „nimmt bar an“.
 *
 * Abweichung vom Mockup (Koordinator, 09.11.2026): Der Titel bei fehlenden
 * Angaben heißt „Stripe braucht noch Angaben von dir“ statt „Online-Zahlung
 * ist pausiert“.
 */
export function onlinePausiertHinweis(
  stufe: HofPausiertStufe,
  barMoeglich: boolean
): { titel: string; satz: string; knopf: string } {
  const bar = barMoeglich
    ? 'Bis dahin können Kunden nur bar bei Abholung bestellen.'
    : 'Bis dahin können Kunden bei dir nicht bestellen.'
  switch (stufe) {
    case 'angaben_fehlen':
      return { titel: 'Stripe braucht noch Angaben von dir', satz: `Erst danach können Kunden online bezahlen. ${bar}`, knopf: BEI_STRIPE_ERGAENZEN }
    case 'pruefung':
      return { titel: 'Stripe prüft deine Angaben', satz: `Du musst nichts tun, wir melden uns. ${bar}`, knopf: ZAHLUNG_ANSEHEN }
    case 'noch_nicht':
      return {
        titel: 'Online-Zahlung noch nicht freigegeben',
        satz: `Stripe hat die Online-Zahlung noch nicht ganz freigegeben. Du musst nichts tun, wir kümmern uns darum und melden uns. ${bar}`,
        knopf: ZAHLUNG_ANSEHEN,
      }
    case 'gesperrt':
      return {
        titel: 'Online-Zahlung ist bei Stripe gesperrt',
        satz: `Online bezahlen geht bei dir deshalb gerade nicht. Schreib uns bitte an ${SUPPORT_EMAIL}, wir helfen dir weiter. ${bar}`,
        knopf: ZAHLUNG_ANSEHEN,
      }
  }
}

// ─── Nachrichten an den Hof (Register N49) ──────────────────────────────────

/** Anlass einer Nachricht: Online-Zahlung aktiv, oder (W-A) Stripe braucht nach der Prüfung noch Angaben. */
export const ONLINE_ZAHLUNG_ANLAESSE = ['aktiv', 'angaben'] as const
export type OnlineZahlungAnlass = (typeof ONLINE_ZAHLUNG_ANLAESSE)[number]

/** Wohin Nachricht und Mail führen. */
export const ZAHLUNG_HREF = '/settings/payments'

/**
 * Postfach-Nachricht (nur der Text; eine Nachricht hat keine Überschrift) und
 * Mail (Überschrift = Betreff, Knopf „Zahlung ansehen“) mit demselben Text.
 * „aktiv“ verspricht online bezahlen „ab sofort“ nur, wenn Kundinnen den Hof
 * gerade sehen (heuteHofSichtbar).
 */
export function onlineZahlungNachricht(
  anlass: OnlineZahlungAnlass,
  hofSichtbar: boolean
): { betreff: string; text: string } {
  if (anlass === 'angaben') {
    return {
      betreff: 'Stripe braucht noch Angaben von dir',
      text: 'Stripe braucht noch Angaben von dir. Öffne Einstellungen › Zahlung und tippe auf ‚Einrichtung fortsetzen‘.',
    }
  }
  return {
    betreff: 'Online-Zahlung ist aktiv',
    text: hofSichtbar
      ? 'Stripe hat dein Konto freigegeben. Ab sofort können Kunden bei dir online bezahlen.'
      : 'Stripe hat dein Konto freigegeben. Sobald dein Hof online ist, können Kunden dort auch online bezahlen.',
  }
}

/**
 * Darf die Nachricht (Postfach und Mail, Register N49) jetzt noch hinaus?
 * EINE Regel für den Nachlauf nach dem Wechsel und den Renderer der Mail:
 * Hof da und nicht stillgelegt oder geschlossen (hofSichtbar), will online
 * kassieren, und der Anlass stimmt noch — bei „aktiv“ ist das Konto bereit,
 * bei „angaben“ steht der Stand auf 'angaben_fehlen'.
 */
export function onlineZahlungNachrichtPasst(
  anlass: OnlineZahlungAnlass,
  hof: {
    archivedAt: Date | null
    geschlossenAm: Date | null
    acceptsOnline: boolean
    stripeAccountReady: boolean
    stripeKontoStand: string | null
  } | null
): boolean {
  if (!hof || !hofSichtbar(hof) || !hof.acceptsOnline) return false
  return anlass === 'aktiv' ? hof.stripeAccountReady : !hof.stripeAccountReady && hof.stripeKontoStand === 'angaben_fehlen'
}

// ─── Für das Team (Register N49) ────────────────────────────────────────────

/** Der genaue Grund — nur für das Team (Akte, Hofliste, „Hof wartet auf Freischaltung“). */
export function stripeGrundAdmin(anzeige: StripeAnzeige): string {
  switch (anzeige) {
    case 'kein_konto':
      return 'Stripe fehlt'
    case 'angaben_fehlen':
      return 'Stripe: Angaben fehlen'
    case 'pruefung':
      return 'Stripe prüft'
    case 'eps_fehlt':
      return 'Stripe: EPS nicht aktiv'
    case 'unklar':
      return 'Stripe: nicht freigegeben, Grund unklar'
    case 'gesperrt':
      return 'Stripe: gesperrt'
    case 'bereit':
      return 'Stripe eingerichtet'
  }
}

/** Die Stände, bei denen ein verkaufender Hof eine Aufgabe für das Team bekommt. */
export type HofOnlineHaengtStand = 'eps_fehlt' | 'unklar' | 'gesperrt'

export function istHofOnlineHaengtStand(anzeige: StripeAnzeige): anzeige is HofOnlineHaengtStand {
  return anzeige === 'eps_fehlt' || anzeige === 'unklar' || anzeige === 'gesperrt'
}

// Titel und Satz der Aufgabe 'hof_online_haengt' stehen in src/lib/admin-aufgaben.ts:
// Sie nennen das „Stripe-Dashboard“, und das Wort gehört nur in Admin-Texte (Wortliste).

// ─── Hof-Konto, das Stripe nicht kennt (Register Z2, Nachtlauf Nr. 42) ─────

/**
 * Über diese Parameter spricht ein Aufruf das Hof-Konto an: das Zielkonto
 * eines PaymentIntents (Destination Charge) bzw. das Konto selbst.
 */
const HOFKONTO_PARAMETER: ReadonlySet<string> = new Set(['transfer_data[destination]', 'destination', 'account'])

/**
 * Kennt Stripe das gespeicherte Konto eines Hofs nicht (mehr)? Typischer
 * Fall: ein Konto aus dem Testmodus, nachdem die Produktion auf den
 * Live-Schlüssel umgestellt ist — Stripe antwortet dann mit „No such
 * account" bzw. beim Zielkonto eines PaymentIntents „No such destination".
 *
 * Streng (Nr. 42, Runde 1): `resource_missing` allein reicht nicht — derselbe
 * Code meint sonst etwa einen unbekannten PaymentIntent. Es zählt nur, was
 * sich aufs Hof-Konto bezieht: die Meldung „No such account/destination"
 * oder `resource_missing` an einem Konto-Parameter (HOFKONTO_PARAMETER).
 *
 * Die Regel der Kasse (Zielkonto des PaymentIntents). Reine Konto-Aufrufe
 * fragen `istUnzugaenglichesStripeKonto`, die zusätzlich den Zugriffsfehler
 * kennt.
 *
 * Geprüft wird die Form, nicht die Klasse: So erkennt die Regel auch die
 * Fehler aus den Test-Mocks, und sie bleibt ohne Stripe-SDK.
 */
export function istUnbekanntesStripeKonto(fehler: unknown): boolean {
  if (typeof fehler !== 'object' || fehler === null) return false
  const { code, param, message } = fehler as { code?: unknown; param?: unknown; message?: unknown }
  if (typeof message === 'string' && /\bNo such (account|destination)\b/i.test(message)) return true
  return code === 'resource_missing' && typeof param === 'string' && HOFKONTO_PARAMETER.has(param)
}

/**
 * Für reine Konto-Aufrufe mit der gespeicherten Kennung — Kontostatus
 * (`accounts.retrieve`), Einrichtungslink (`accountLinks.create`), Login-Link
 * (`accounts.createLoginLink`): Neben „unbekannt" zählt hier auch der
 * Zugriffsfehler. Auf eine Kennung, die nicht zur Plattform gehört oder nicht
 * (mehr) existiert, antwortet Stripe oft mit 403 `account_invalid` („does not
 * have access to account … (or that account does not exist)"). Gespeicherte
 * Kennungen stammen immer aus dem eigenen `accounts.create` — kein Zugriff
 * heißt dann: neu einrichten (Nr. 42, Runde 1).
 *
 * GRENZE: Derselbe Fehler kommt auch, wenn der Plattform-Schlüssel zum
 * falschen Stripe-Konto gehört. Dann gilt jeder Hof als unbekannt, und
 * „neu einrichten" legte die Konten bei der falschen Plattform an — deshalb
 * prüft der Mensch die Plattform des Schlüssels vor dem Umschalten
 * (docs/betrieb/stripe-live.md).
 *
 * NICHT für die Kasse: Dort bleibt es bei `istUnbekanntesStripeKonto`.
 */
export function istUnzugaenglichesStripeKonto(fehler: unknown): boolean {
  if (istUnbekanntesStripeKonto(fehler)) return true
  if (typeof fehler !== 'object' || fehler === null) return false
  const { code, message } = fehler as { code?: unknown; message?: unknown }
  if (code === 'account_invalid') return true
  return typeof message === 'string' && /\bdoes not have access to account\b/i.test(message)
}

/** So lange bekommt ein Neuversuch beim Neu-Einrichten dasselbe Konto (15 Minuten). */
export const NEU_EINRICHTEN_FENSTER_MS = 15 * 60 * 1000

/**
 * Idempotenz-Schlüssel für `accounts.create` beim Neu-Einrichten: Hof-ID,
 * alte Kennung und das 15-Minuten-Fenster (UTC, gezählt seit 1970).
 *
 * Warum mit Fenster (Nr. 42, Runde 2): Stripe hält unter einem Schlüssel
 * 24 Stunden lang JEDES Ergebnis, auch einen Fehler. Ohne Fenster sperrte ein
 * gescheiterter erster Versuch — wahrscheinlich am Tag der Live-Umstellung —
 * das Neu-Einrichten bis zu einen Tag. Mit Fenster bekommen Doppelklick und
 * sofortiger Neuversuch weiter dasselbe Konto; nach spätestens 15 Minuten
 * gilt ein neuer Schlüssel.
 *
 * Grenze: Fällt ein Doppelklick genau auf die Fenstergrenze, legt Stripe
 * zwei Konten an. Gespeichert wird trotzdem nur eines (bedingt auf die alte
 * Kennung), das andere steht mit Hof-ID im Server-Protokoll.
 */
export function neuEinrichtenSchluessel(farmId: string, altesKonto: string, jetzt: Date): string {
  const fenster = Math.floor(jetzt.getTime() / NEU_EINRICHTEN_FENSTER_MS)
  return `hofkonto-neu-${farmId}-${altesKonto}-${fenster}`
}

/**
 * Der Name der Karte mit Verkäufer, Anschrift, Telefon und E-Mail des Hofs
 * über dem Kaufknopf der Kasse (components/checkout/angaben-zum-hof.tsx,
 * Nr. 60). Hier, weil auch die Antwort des Checkouts auf sie verweist.
 */
export const ANGABEN_ZUM_HOF_TITEL = 'Angaben zum Hof'

/**
 * Der Ausweg, wo die Kasse nicht weiterkommt — kein Abholtermin, keine
 * Zahlart, Online-Zahlung gesperrt (Nr. 60): Die Kontaktdaten stehen in
 * derselben Kasse, statt „frag beim Hof nach" ohne Nummer.
 */
export const KONTAKT_UNTER_ANGABEN_ZUM_HOF = `Die Kontaktdaten des Hofs stehen unter „${ANGABEN_ZUM_HOF_TITEL}“.`

/**
 * Antwort des Checkouts, wenn Stripe das Konto des Hofs nicht kennt. Kein
 * „versuch es später": Online kommt bei diesem Hof erst zurück, wenn er
 * Stripe neu einrichtet. Ohne Barzahlung verspricht der Satz sie nicht.
 */
export function hofKontoUnbekanntText(barMoeglich: boolean): string {
  return barMoeglich
    ? 'Online-Zahlung ist bei diesem Hof gerade nicht möglich. Bitte wähle Bar bei Abholung.'
    : `Online-Zahlung ist bei diesem Hof gerade nicht möglich. ${KONTAKT_UNTER_ANGABEN_ZUM_HOF}`
}

/** Was der Hof sieht (Einstellungen → Zahlung): Titel und Satz der Hinweiskarte, Knopf. */
export const NEU_EINRICHTEN_TITEL = 'Online-Zahlung neu einrichten'
/**
 * Der Satz der Karte. Ohne Barzahlung (`acceptsOnsite` false) gibt es keinen
 * Ausweg für die Kundinnen; dann verspricht er ihn nicht — wie
 * `onlinePausiertHinweis` und `hofKontoUnbekanntText`.
 */
export function neuEinrichtenSatz(barMoeglich: boolean): string {
  const anfang = 'Stripe kennt dein bisheriges Konto nicht mehr. Richte die Online-Zahlung bitte neu ein – das dauert etwa 10 Minuten. '
  return barMoeglich
    ? `${anfang}Bis dahin bieten wir deinen Kundinnen nur Barzahlung an.`
    : `${anfang}Bis dahin können Kunden bei dir nicht bestellen.`
}
/** Die Marke an der Karte „Online-Zahlung (Stripe)". */
export const NEU_EINRICHTEN_MARKE = 'Nicht mehr verbunden'
/** Kurzfassung für Stellen außerhalb der Zahlungs-Einstellungen (Verkäufe, Aktionen). */
export const NEU_EINRICHTEN_KURZ =
  'Stripe kennt dein bisheriges Konto nicht mehr. Richte die Online-Zahlung unter Einstellungen → Zahlung neu ein.'
