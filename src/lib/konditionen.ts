/**
 * Die Konditionen für Höfe als Text — EINE Quelle für jede Seite, die Preise
 * nennt: /fuer-hoefe, /konditionen, Registrieren und Einrichten (Gate 5,
 * Nr. 15). Dazu die Sätze zur Stripe-Pflicht (Register Z1). Grundlage ist die Entscheidung E6 = Tarife (docs/nachtlauf/
 * freigabe.md): Hoftor 0 €, Hofladen 19 € im Monat, die Servicegebühr zahlt
 * der Kunde, abgerechnet wird einmal im Monat per SEPA.
 *
 * TEXTE UND EINE ANZEIGE-REGEL. Hier wird nichts begrenzt oder abgebucht: Es
 * gibt (noch) keine Tarif-Grenzen, keine Grundgebühr und keinen SEPA-Einzug
 * im Code; `Farm.tarif` bleibt für jeden Hof leer, bis Gate 8 die Wahl baut.
 * Die einzige Regel, `bestimmeTarifZustand` (Nr. 61), sagt nur, welchen Stand
 * Tarif-Zeile und „Deine Konditionen" zeigen.
 *
 * Übergang (Register K1, Nachtlauf 17d): In der Startphase ist die Plattform
 * kostenlos, die Tarife gelten erst ab `TARIFE_AB`. Jede Seite, die Tarife
 * zeigt, nennt dazu `KONDITIONEN_UEBERGANG` — das Datum steht nur hier.
 *
 * Regel für Anzeigen (wie früher gruendungshof.ts): Eine Zahl steht nie als
 * Literal in einer Seite, sondern kommt von hier. Der Satz der Servicegebühr
 * für neue Höfe (E4) steht hier EINMAL, servicegebuehr.ts reicht ihn weiter;
 * Beträge laufen über formatEuro (format.ts).
 *
 * Diese Datei bindet servicegebuehr.ts NICHT ein: servicegebuehr.ts liest den
 * Bar-Stichtag von hier (Register B1), ein Ring beider Module wäre beim Laden
 * eine Falle. Wiener Tage kommen aus wiener-tag.ts, Cent → Euro aus format.ts.
 */
import type { Tarif } from '@prisma/client'
import { centsAlsEuro, formatDatumLang, formatEuro, formatZahl } from '@/lib/format'
import { kalendertagInWien, wienerMitternacht } from '@/lib/wiener-tag'
import { MARKE } from '@/lib/marke'

/**
 * Die Tarif-Kennung ist das Prisma-Enum `Tarif` — nur als Typ eingebunden,
 * src/lib bleibt ohne Prisma-Client (ARCHITECTURE §1).
 */
export type TarifId = Tarif

/** Was der Tarif Hoftor erlaubt — als Zahl, damit der Text nie von ihr abweicht. */
export const HOFTOR_PRODUKTE = 3
export const HOFTOR_ABHOLZEITEN_JE_WOCHE = 1

export type TarifText = {
  id: TarifId
  name: string
  /** Grundgebühr im Monat in ganzen Cent. */
  grundgebuehrCents: number
  /** „€ 19" — ohne Nachkommastellen, wie im Preismodell. */
  preis: string
  /** Für wen der Tarif gedacht ist — auf /fuer-hoefe, /konditionen und Einrichten mit Bedingung. */
  zusatz: string
  /**
   * Nur „für wen", ohne Bedingung — für „Deine Konditionen" (Nr. 61), wo die
   * Bedingungen unter dem Preis stehen und sonst doppelt dastünden.
   */
  fuerWen: string
  leistungen: readonly string[]
}

/** „€ 0", „€ 19" — eine Grundgebühr zum Anzeigen. */
export function grundgebuehrText(cents: number): string {
  // Ganze Euro ohne Komma, krumme Beträge (falls je einer kommt) mit Cent.
  return cents % 100 === 0 ? formatEuro(centsAlsEuro(cents), 0) : formatEuro(centsAlsEuro(cents))
}

export const PRO_MONAT = '/ Monat'

/** „€ 19 im Monat" — der Preis als Satzteil auf „Deine Konditionen" (Nr. 61). */
export const IM_MONAT = 'im Monat'

/** Die Bedingung des Tarifs mit Grundgebühr (E6). */
export const MONATLICH_KUENDBAR = 'monatlich kündbar'

const HOFLADEN_FUER_WEN = 'Für den laufenden Verkauf'

export const TARIFE: readonly TarifText[] = [
  {
    id: 'HOFTOR',
    name: 'Hoftor',
    grundgebuehrCents: 0,
    preis: grundgebuehrText(0),
    // Seit Nr. 61 (Freigabe §14): wirkt auf /fuer-hoefe, /konditionen, Einrichten und „Deine Konditionen".
    zusatz: 'Für ein kleines Angebot',
    fuerWen: 'Für ein kleines Angebot',
    leistungen: [
      `${HOFTOR_PRODUKTE} Produkte`,
      `${HOFTOR_ABHOLZEITEN_JE_WOCHE} Abholzeit pro Woche`,
      'Online- und Barzahlung',
    ],
  },
  {
    id: 'HOFLADEN',
    name: 'Hofladen',
    grundgebuehrCents: 1900,
    preis: grundgebuehrText(1900),
    zusatz: `${HOFLADEN_FUER_WEN} · ${MONATLICH_KUENDBAR}`,
    fuerWen: HOFLADEN_FUER_WEN,
    leistungen: ['Unbegrenzt Produkte', 'Abholzeiten frei wählbar + Packliste', `Urlaubsmodus für ${grundgebuehrText(0)}`],
  },
]

/** Ein Tarif nach seiner Kennung. */
export function tarifText(id: TarifId): TarifText {
  const tarif = TARIFE.find((t) => t.id === id)
  // TARIFE führt jede Kennung des Typs — tests/konditionen.test.ts prüft das.
  if (!tarif) throw new Error(`Unbekannter Tarif: ${id}`)
  return tarif
}

/** Der günstigste Tarif — mit ihm startet jeder Hof. */
export const START_TARIF = tarifText('HOFTOR')

// ─── Übergang: Startphase, Tarife ab einem Stichtag (Register K1) ─────────────

/**
 * Ab diesem Wiener Kalendertag gelten die Tarife — festgelegt am 06.10.2026
 * (Register K1). Das EINZIGE Datum dazu im Code; alles andere leitet sich ab
 * (tests/konditionen-uebergang.test.ts sucht nach einem zweiten Exemplar).
 */
export const TARIFE_AB_TAG = '2027-02-01'

/** Der Stichtag als Zeitpunkt: Mitternacht in Wien, nicht in UTC. */
export const TARIFE_AB: Date = stichtag(TARIFE_AB_TAG)

function stichtag(kalendertag: string): Date {
  const zeitpunkt = wienerMitternacht(kalendertag)
  // Ein Tippfehler im Datum soll beim Bauen auffallen, nicht als „Invalid Date" auf der Seite.
  if (!zeitpunkt) throw new Error(`Ungültiger Stichtag: ${kalendertag}`)
  return zeitpunkt
}

/** „1. Februar 2027" — über den gemeinsamen Formatierer. */
export const TARIFE_AB_TEXT = formatDatumLang(TARIFE_AB)

// ─── Barzahlung ohne Servicegebühr bis zum SEPA-Start (Register B1) ──────────

/**
 * Ab diesem Zeitpunkt kostet auch eine BARZAHLUNG Servicegebühr. Vorher nicht:
 * Die Gebühr aus Barbestellungen kann erst die SEPA-Monatsabrechnung einziehen,
 * und eine Gebühr, die niemand einzieht, soll die Kundin nicht zahlen (B1).
 * Online bleibt die Gebühr, Stripe behält sie beim Bezahlen ein.
 *
 * Standard ist der Stichtag der Tarife. Verschiebt sich der SEPA-Start, wird
 * NUR diese Zeile geändert (etwa `stichtag('2027-03-01')`) — Rechnung, Kasse,
 * Finanzen und alle Texte leiten sich davon ab.
 *
 * Maßgeblich ist der BESTELLZEITPUNKT (Server-Uhr des Checkouts), nicht der
 * Abholtag — wie bei `Farm.serviceFeeActiveFrom`: Was die Kundin beim
 * Bestellen sieht, gilt. Grenze ist Mitternacht in Wien (wie `TARIFE_AB`);
 * eine Bestellung genau zur Grenze zahlt schon.
 */
export const BAR_SERVICEGEBUEHR_AB: Date = TARIFE_AB

/**
 * Der letzte Tag ohne Bargebühr, „31. Jänner 2027": der Wiener Tag eine
 * Millisekunde vor dem Stichtag, über den gemeinsamen Formatierer.
 */
export const BAR_OHNE_GEBUEHR_BIS_TEXT = formatDatumLang(new Date(BAR_SERVICEGEBUEHR_AB.getTime() - 1))

/**
 * Liegt dieser Zeitpunkt vor dem Bar-Stichtag? Der EINE Datumsvergleich zu
 * B1 — `barOhneServicegebuehr` (servicegebuehr.ts) und die Texte unten fragen
 * hier, damit die Grenze nirgends ein zweites Mal geschrieben wird.
 */
export function vorBarStichtag(zeitpunkt: Date): boolean {
  return zeitpunkt.getTime() < BAR_SERVICEGEBUEHR_AB.getTime()
}

/**
 * Einen Text um die Bar-Ausnahme ergänzen — nur vor dem Stichtag; danach
 * bleibt er, wie er war. Statische Seiten (/fuer-hoefe, /konditionen, die
 * Startseite) entscheiden beim Bauen bzw. bei der Revalidierung.
 */
export function mitBarAusnahme(text: string, jetzt: Date, satz: string = BAR_OHNE_GEBUEHR_SATZ): string {
  return vorBarStichtag(jetzt) ? `${text} ${satz}` : text
}

/**
 * Der Hinweis für Kundinnen — Startseite, Hofseite, Mini-Warenkorb (Wortlaut
 * freigabe.md §9, 19a). Die Kasse zeigt ihn seit Nr. 82 nicht mehr als Absatz:
 * Dort trägt „Bar bei Abholung" den Vorteil selbst (`BAR_OHNE_GEBUEHR_ZAHLART`).
 */
export const BAR_OHNE_GEBUEHR_HINWEIS = `Bei Barzahlung bis ${BAR_OHNE_GEBUEHR_BIS_TEXT} ohne Servicegebühr.`

/**
 * Der erste Satz an „Bar bei Abholung" in der Kasse (Register N10, Nr. 82) —
 * nur, solange bar wirklich günstiger ist (`barGuenstiger` in src/lib/kasse.ts).
 */
export const BAR_OHNE_GEBUEHR_ZAHLART = `Ohne Servicegebühr bis ${BAR_OHNE_GEBUEHR_BIS_TEXT}.`

/** Derselbe Inhalt als Satz für Höfe — /konditionen, /fuer-hoefe und die Mail „Vor-Ort-Bestellung bestätigt". */
export const BAR_OHNE_GEBUEHR_SATZ = `Bei Barzahlung fällt bis ${BAR_OHNE_GEBUEHR_BIS_TEXT} keine Servicegebühr an.`

// ─── Plattformgebühr im Hofpreis (Register N38, Nr. 197) ───────────────────

/**
 * Der Satz der Plattformgebühr im Hofpreis-Modell (N38): 6 % vom Warenpreis,
 * je Stück auf den Cent aufgerundet, ohne Mindestgebühr. Je Hof im Admin
 * änderbar (`Farm.plattformgebuehrProzent`, null = dieser Satz). Gerechnet
 * wird nur in src/lib/plattformgebuehr.ts.
 */
export const PLATTFORMGEBUEHR_PROZENT = 6

/** Mindestbestellwert je Bestellung im Hofpreis-Modell, Warenwert in Cent (N38). */
export const MINDESTBESTELLWERT_CENTS = 1000

/** Das Wort der Wortliste (N8) für die Gebühr im Hofpreis. */
export const PLATTFORMGEBUEHR_BEZEICHNUNG = 'Plattformgebühr'

/** Der Zusatz am Endpreis — Hofseite, Produktseite, Karten, Korb und Mails (N38). */
export const INKL_PLATTFORMGEBUEHR = 'inkl. Plattformgebühr'

/** Der Satz unter Korb und Positionen der Kasse im Hofpreis-Modell. */
export const PREISE_INKL_PLATTFORMGEBUEHR = `Preise ${INKL_PLATTFORMGEBUEHR}`

/** Der Satz in der Kasse unter der Aufschlüsselung (Freigabe Lauf 26, Nr. 197, wörtlich). */
export const PLATTFORMGEBUEHR_SATZ = `Die Plattformgebühr ist Teil des Preises. Der Hof zahlt damit die Bestellplattform ${MARKE}.`

/**
 * Der Satz unter den Beträgen der Kunden-Mails im Hofpreis-Modell: Die
 * Gebühr steht nicht als eigene Zeile da, sie steckt in den Endpreisen.
 */
export function inklPlattformgebuehrSatz(betrag: string): string {
  return `Alle Preise ${INKL_PLATTFORMGEBUEHR} (darin ${betrag}). ${PLATTFORMGEBUEHR_SATZ}`
}

/** Der Grund am ausgeschalteten Bestellknopf und die Meldung von /api/checkout (400). */
export const MINDESTBESTELLWERT_SATZ = `Mindestbestellwert ${formatZahl(centsAlsEuro(MINDESTBESTELLWERT_CENTS))} € bei diesem Hof`

/**
 * Neutral, wenn bar bei diesem Hof gerade nicht geht (kein Mandat, N38) —
 * /api/checkout antwortet damit (409), die Kasse bietet dann nur online an.
 * Sagt nichts über den Grund: Das Mandat ist Sache zwischen Hof und Plattform.
 */
export const BAR_NICHT_MOEGLICH_SATZ = 'Bei diesem Hof geht gerade nur Online-Bezahlen. Bitte wähl „Online bezahlen“.'

// ─── Lastschrift und Monatsabrechnung (N38, Nr. 198) ─────────────────────────

/** Wohin „Lastschrift einrichten“ führt: der Abschnitt „Barzahlung“ in Deine Konditionen. */
export const LASTSCHRIFT_HREF = '/settings/konditionen#barzahlung'

/** Die Sätze rund um Lastschrift und Monatsabrechnung — Konditionen, Heute, Postfach und Mails nehmen sie von hier. */
export const LASTSCHRIFT_TEXT = {
  titel: 'Barzahlung',
  einrichten: 'Lastschrift einrichten',
  aendern: 'Lastschrift ändern',
  mandatDa: (bank: string | null, letzte4: string | null): string =>
    `Lastschrift eingerichtet${bank || letzte4 ? ` · ${[bank, letzte4 ? `IBAN endet auf ${letzte4}` : null].filter(Boolean).join(' · ')}` : ''}`,
  mandatFehlt: 'Noch keine Lastschrift eingerichtet.',
  mandatPflicht: 'Ohne Lastschrift bieten wir bei dir ab dem Einzug nur Online-Bezahlen an.',
  mandatFrei: 'Eine Lastschrift ist bei dir nicht Pflicht – ohne sie schicken wir die Rechnung zur Überweisung.',
  einzugAb: (datum: string): string => `Einzug ab ${datum}`,
  erlassen: (datum: string): string => `Bis ${datum} behältst du die Plattformgebühr aus Barbestellungen – wir verzichten darauf.`,
  satz: (satz: string): string => `Plattformgebühr ${satz} % vom Warenpreis`,
  wartet: 'Die Bank bestätigt die Lastschrift – das dauert meist nur einen Moment. Lade die Seite gleich neu.',
  fehler: 'Wir konnten die Lastschrift gerade nicht starten. Versuch es bitte gleich noch einmal.',
  abrechnungen: 'Monatsabrechnungen',
  abrechnungenLeer: 'Noch keine Monatsabrechnung. Die erste kommt nach dem ersten Monat mit Plattformgebühr.',
  spalten: { monat: 'Monat', bar: 'bar', online: 'online', stand: 'Stand' },
  rechnung: 'Rechnung (PDF)',
  bezahlen: 'Jetzt bezahlen',
  rechnungFehlt: 'Die Rechnung lässt sich gerade nicht öffnen. Versuch es bitte gleich noch einmal.',
  heuteTitel: 'Barzahlung ist pausiert',
  heuteSatz: (monat: string): string =>
    `Die Plattformgebühr für ${monat} ist noch offen. Bis sie bezahlt ist, nehmen wir bei dir keine Barbestellungen an – laufende Bestellungen bleiben.`,
} as const

/** Die Postfach-Nachricht vier Wochen vor dem Einzugsbeginn (N38, „Start“). */
export function ankuendigungText(d: { datum: string; satz: string; mandatNoetig: boolean }): string {
  return (
    `Ab ${d.datum} ziehen wir die Plattformgebühr (${d.satz} % vom Warenpreis) aus deinen Barbestellungen einmal im Monat ein. ` +
    'Bei Online-Zahlungen behält Stripe sie schon beim Bezahlen ein. ' +
    (d.mandatNoetig ? `Dafür brauchst du eine Lastschrift. ${LASTSCHRIFT_TEXT.mandatPflicht}` : LASTSCHRIFT_TEXT.mandatFrei)
  )
}

/** Die Postfach-Nachricht nach einer gescheiterten Lastschrift (N38, „Einzug scheitert“). */
export function lastschriftGescheitertText(d: { monat: string; tage: number }): string {
  return (
    `Die Lastschrift für ${d.monat} hat nicht geklappt. Stripe versucht es erneut. ` +
    'Bitte sorg für Deckung auf deinem Konto oder bezahl die Rechnung direkt. ' +
    `Bleibt der Betrag ${d.tage} Tage offen, nehmen wir bei dir keine Barbestellungen mehr an – laufende Bestellungen bleiben.`
  )
}

// ─── Online-Zahlung gehört zum Start (Register Z1) ───────────────────────────

/**
 * Jeder Hof richtet Stripe ein, bevor er online geht; eine Wahl „nur bar" gibt
 * es nicht mehr (Z1). Barzahlung DURCH KUNDINNEN bleibt möglich (B1) — das ist
 * keine Wahl des Hofs statt Stripe.
 *
 * Wörtlich aus der Freigabe (freigabe.md §10 „24"): Einrichten, Zahlung und
 * Heute zeigen diesen Satz, keine Seite schreibt ihn ab
 * (tests/stripe-pflicht.test.ts).
 */
export const ONLINE_ZAHLUNG_EINRICHTEN_SATZ =
  'Damit deine Kundinnen auch mit Karte, Apple Pay oder EPS zahlen können, richte bitte die Online-Zahlung ein. ' +
  'Dauert etwa 10 Minuten.'

/** Der Titel des Schritts und des Hinweises — überall gleich. */
export const ONLINE_ZAHLUNG_EINRICHTEN_TITEL = 'Online-Zahlung einrichten'

/**
 * Der Schritt „Online-Zahlung einrichten" für die öffentlichen Seiten
 * (/fuer-hoefe, /konditionen, Registrieren): Er gehört zum Start und steht
 * vor der Freischaltung. Ohne Zahlungsarten im Text — welche Stripe anbietet,
 * schaltet der Betreiber im Stripe-Konto frei.
 */
export const ONLINE_ZAHLUNG_START_SCHRITT = {
  titel: ONLINE_ZAHLUNG_EINRICHTEN_TITEL,
  text: 'Über Stripe, dauert etwa 10 Minuten. Gehört zum Start – ohne sie schalten wir keinen Hof frei.',
} as const

/** Dasselbe kurz — neben dem Registrieren-Formular. */
export const ONLINE_ZAHLUNG_START_KURZ = 'über Stripe, etwa 10 Minuten – gehört zum Start'

// ─── Servicegebühr ──────────────────────────────────────────────────────────

/**
 * Der Satz, den ein NEUER Hof beim Anlegen bekommt (Entscheidung E4, Preismodell
 * des Betreibers: 5 %, mindestens € 0,50). Der Spalten-Default im Schema
 * (`Farm.serviceFeePercent @default(4.9)`) ist älter und bleibt bis zu einer
 * eigens freigegebenen Migration stehen — deshalb setzt das Anlegen den Satz
 * ausdrücklich (createFarm, Seed), statt sich auf den Default zu verlassen.
 * Bestehende Höfe behalten ihren gespeicherten Satz; umgestellt wird im Admin.
 * servicegebuehr.ts reicht beide Werte unverändert weiter.
 */
export const SERVICEGEBUEHR_STANDARD_PROZENT = 5

/** Mindestgebühr eines neuen Hofes in Cent (E4). */
export const SERVICEGEBUEHR_STANDARD_MIND_CENTS = 50

/** „5 % (mind. € 0,50)" — Satz und Mindestgebühr für neue Höfe (E4). */
export const SERVICEGEBUEHR_SATZ_TEXT =
  `${formatZahl(SERVICEGEBUEHR_STANDARD_PROZENT)} % ` +
  `(mind. ${formatEuro(centsAlsEuro(SERVICEGEBUEHR_STANDARD_MIND_CENTS))})`

/** Der Grundsatz — Preise-Abschnitt von /fuer-hoefe und /konditionen; mit Bar-Ausnahme über `servicegebuehrZahltKunde`. */
export const SERVICEGEBUEHR_ZAHLT_KUNDE =
  `Die Servicegebühr von ${SERVICEGEBUEHR_SATZ_TEXT} zahlt der Kunde. ` +
  'Du bekommst immer den vollen Warenpreis – online wie bar.'

/** Der Grundsatz, wie die Seiten ihn zeigen: vor dem Stichtag mit der Bar-Ausnahme (B1) in der Mitte. */
export function servicegebuehrZahltKunde(jetzt: Date): string {
  if (!vorBarStichtag(jetzt)) return SERVICEGEBUEHR_ZAHLT_KUNDE
  return (
    `Die Servicegebühr von ${SERVICEGEBUEHR_SATZ_TEXT} zahlt der Kunde. ` +
    `${BAR_OHNE_GEBUEHR_SATZ} ` +
    'Du bekommst immer den vollen Warenpreis – online wie bar.'
  )
}

/**
 * Online: Was mit der Gebühr passiert — Satz unter dem Rechenbeispiel in den
 * Einstellungen (/settings/konditionen). Mit Provision (Farm.platformFeePercent
 * > 0) bleibt der Warenpreis NICHT unberührt, dann der zweite Satz.
 */
export const ONLINE_GEBUEHR_ABGETRENNT_SATZ =
  'Die Gebühr wird beim Bezahlen automatisch abgetrennt – dein Warenpreis bleibt unberührt.'
export const ONLINE_GEBUEHR_MIT_PROVISION_SATZ =
  'Die Gebühr wird beim Bezahlen automatisch abgetrennt. Von deinem Warenpreis geht nur die Provision ab.'

/** Bar ab dem SEPA-Start: wer die kassierte Gebühr einzieht (E6). */
export const BAR_GEBUEHR_SEPA_SATZ = 'Die Gebühr holt die Monatsabrechnung per SEPA-Lastschrift.'

/**
 * Der SEPA-Satz zur Bargebühr — an B1 gebunden: Vor `BAR_SERVICEGEBUEHR_AB`
 * kostet bar keine Gebühr, also holt auch keine Monatsabrechnung etwas (null).
 */
export function barGebuehrSepaSatz(jetzt: Date): string | null {
  return vorBarStichtag(jetzt) ? null : BAR_GEBUEHR_SEPA_SATZ
}

/** Kurzfassung für Karten (Einrichten, Vorteile). */
export const VOLLER_WARENPREIS = 'Die Servicegebühr zahlt der Kunde – du behältst den vollen Warenpreis.'

/** Die drei Sätze des Übergangs einzeln — die Metadaten brauchen nur die ersten beiden. */
export const STARTPHASE_SATZ = 'In der Startphase kostenlos.'
export const TARIFE_AB_SATZ = `Die Tarife gelten ab ${TARIFE_AB_TEXT}.`
export const BESTANDSHOEFE_SATZ = 'Bereits freigeschaltete Höfe behalten ihre zugesagten Konditionen.'

/**
 * Der Übergang in einem Satz (Register K1, wörtlich) — für /fuer-hoefe,
 * /konditionen, Registrieren und Einrichten. Keine Seite schreibt ihn ab.
 */
export const KONDITIONEN_UEBERGANG = [STARTPHASE_SATZ, TARIFE_AB_SATZ, BESTANDSHOEFE_SATZ].join(' ')

/**
 * Für den Betreiber im Freischalten-Dialog: welches Modell öffentlich gilt.
 * Die Gründungsplatz-Vergabe daneben bleibt, bis die Abrechnung gebaut ist (Gate 8).
 */
export const KONDITIONEN_DERZEIT = `Derzeit gilt: ${KONDITIONEN_UEBERGANG}`

/** Ein Stück Satz, auf Wunsch hervorgehoben — „Deine Konditionen" zeigt manche Teile fett (Nr. 61). */
export type TextTeil = { text: string; betont?: boolean }

/**
 * Wie abgerechnet wird (E6), zeitlich eingeordnet (K1): Vor dem Stichtag läuft
 * keine Abbuchung. Barbestellungen vor dem Stichtag tragen keine Gebühr, und
 * Gebühren aus älteren Barbestellungen werden nicht eingezogen (B1) — deshalb
 * gibt es vor dem Stichtag nichts, was die Abrechnung nachholen müsste. Die
 * Grundgebühr nur nach aktiver Wahl von Hofladen (E6-Ergänzung, Nr. 61) —
 * „Deine Konditionen" hebt das hervor, darum in Teilen.
 */
export const MONATSABRECHNUNG_TEILE: readonly TextTeil[] = [
  { text: `Ab dem ${TARIFE_AB_TEXT} rechnen wir einmal im Monat per SEPA-Lastschrift ab: die Grundgebühr – ` },
  { text: `nur wenn du ${tarifText('HOFLADEN').name} gewählt hast`, betont: true },
  { text: ' – und die Servicegebühren aus Barbestellungen. Bei Online-Zahlungen ist die Servicegebühr schon beim Bezahlen erledigt.' },
]

/** Derselbe Satz am Stück — für /konditionen. */
export const MONATSABRECHNUNG_TEXT = MONATSABRECHNUNG_TEILE.map((teil) => teil.text).join('')

/** Wann der Text dieser Seite zuletzt geändert wurde. */
export const KONDITIONEN_STAND = 'Oktober 2026'

/**
 * Was die Karte „Tarif" auf Einrichten zeigt: ohne gewählten Tarif
 * (`Farm.tarif` leer — heute jeder Hof) beide Tarife, mit Wahl (erst ab
 * Gate 8) nur diesen unter „Dein Tarif". Wo der Hof gerade steht
 * (Startphase, Gründungshof, Hoftor), sagt nicht diese Karte, sondern die
 * Tarif-Zeile der HofShell über `bestimmeTarifZustand` (Nr. 61).
 */
export function tarifKarte(tarif: TarifId | null): { titel: string; tarife: readonly TarifText[] } {
  return tarif ? { titel: 'Dein Tarif', tarife: [tarifText(tarif)] } : { titel: 'Tarife', tarife: TARIFE }
}

// ─── Tarif-Zustand und Tarif-Zeile (Nr. 61; Register E6-Ergänzung, K1, K2) ──

/** Wo ein Hof gerade steht — die Tarif-Zeile der HofShell und „Deine Konditionen" fragen nur das. */
export type TarifZustand = 'startphase' | 'gruendungshof' | 'hoftor' | 'hofladen'

/**
 * Was die Regel über einen Hof wissen muss. `gruendungBis` ist das Ende der
 * Gründungszusage (K2, DATE-Spalte ab Nr. 62); bis Nr. 62 Gründungshöfe
 * erkennt, liefert jeder Aufrufer null.
 */
export type TarifHof = { tarif: TarifId | null; gruendungBis: Date | null }

type Stand = { zustand: 'gruendungshof'; bis: Date } | { zustand: Exclude<TarifZustand, 'gruendungshof'> }

function ermittleStand(hof: TarifHof, jetzt: Date): Stand {
  // Einschließlich des Tages und als WIENER Kalendertag: Eine DATE-Spalte kommt
  // als UTC-Mitternacht, und um 0:30 Uhr in Wien ist es in UTC noch gestern.
  if (hof.gruendungBis !== null && kalendertagInWien(jetzt) <= kalendertagInWien(hof.gruendungBis)) {
    return { zustand: 'gruendungshof', bis: hof.gruendungBis }
  }
  if (jetzt.getTime() < TARIFE_AB.getTime()) return { zustand: 'startphase' }
  return { zustand: hof.tarif === 'HOFLADEN' ? 'hofladen' : 'hoftor' }
}

/**
 * Die EINE Regel zum Tarif-Zustand (Nr. 61): Gründungshof bis einschließlich
 * seines Tages (K2) — mit Vorrang vor der Startphase, denn er soll seine
 * Zusage sehen, nicht die allgemeine —, sonst vor `TARIFE_AB` die Startphase
 * (K1), danach Hoftor ohne Wahl und Hofladen nur nach aktiver Wahl
 * (E6-Ergänzung). Sie entscheidet nur die Anzeige.
 */
export function bestimmeTarifZustand(hof: TarifHof, jetzt: Date): TarifZustand {
  return ermittleStand(hof, jetzt).zustand
}

/** „kostenlos" — statt „€ 0" in Tarif-Zeile und Tarif-Karte (Nr. 61). */
export const KOSTENLOS = 'kostenlos'

/** Der letzte Augenblick der Startphase: eine Millisekunde vor dem Stichtag. */
const STARTPHASE_ENDE = new Date(TARIFE_AB.getTime() - 1)

/** „31. Jänner 2027" — der letzte Tag der Startphase (K1), über den gemeinsamen Formatierer. */
export const STARTPHASE_BIS_TEXT = formatDatumLang(STARTPHASE_ENDE)

// Monat in Wiener Zeit, österreichisch („Jänner") — wie formatDatumLang.
const MONAT_JAHR_FORMAT = new Intl.DateTimeFormat('de-AT', { month: 'long', year: 'numeric', timeZone: 'Europe/Vienna' })
const MONAT_FORMAT = new Intl.DateTimeFormat('de-AT', { month: 'long', timeZone: 'Europe/Vienna' })

/**
 * „Jänner 2027" — ab diesem Monat kann ein Hof Hofladen wählen: im letzten
 * Monat der Startphase (Freigabe §14 Nr. 61; E6-Ergänzung: nur nach aktiver
 * Wahl mit SEPA-Mandat).
 */
export const TARIF_WAHL_AB_TEXT = MONAT_JAHR_FORMAT.format(STARTPHASE_ENDE)

/** „Produkte im Shop" — Tarif-Zeile und Vergleich sagen dasselbe. */
export const PRODUKTE_IM_SHOP = 'Produkte im Shop'

const HOFTOR_NAME = tarifText('HOFTOR').name
const HOFLADEN_NAME = tarifText('HOFLADEN').name

/**
 * Die Texte der Tarif-Zeile in Seitenleiste und Mehr-Blatt (Nr. 61): eine
 * Statuszeile ohne Preis und ohne Warnfarbe — der Preis steht nur auf „Deine
 * Konditionen", nach dem Nutzen und mit Bedingungen (E6-Ergänzung). Hofladen
 * hat keine Zeile.
 */
export const TARIF_ZEILE = {
  startphase: { titel: `Startphase: ${KOSTENLOS}`, zeile: `bis ${STARTPHASE_BIS_TEXT}`, handy: 'du musst nichts tun' },
  gruendungshof: { titel: 'Gründungshof', zeile: 'ohne Grundgebühr bis' },
  hoftor: { titel: `${HOFTOR_NAME} · ${KOSTENLOS}`, zeile: PRODUKTE_IM_SHOP, hinweis: 'Tarife vergleichen' },
} as const

/**
 * Was die Tarif-Zeile zeigt — fertig vom Server: Die HofShell ist eine
 * Client-Komponente und rechnet nichts mit der Zeit (CODING_STANDARDS §2).
 */
export type TarifZeileDaten = {
  zustand: Exclude<TarifZustand, 'hofladen'>
  titel: string
  /** Unterzeile in der Seitenleiste. */
  zeile: string
  /** Unterzeile im Mehr-Blatt (am Handy). */
  zeileHandy: string
  /** Nur Hoftor: „n von 3" und der Anteil für den Balken (0 bis 1) — Anzeige, keine Sperre (O8 baut Gate 8). */
  grenze?: { wert: string; anteil: number }
  /** Nur Hoftor: „Tarife vergleichen". */
  hinweis?: string
}

/** Die Tarif-Zeile eines Hofs aus TARIF_ZEILE — null bei Hofladen (keine Zeile). */
export function baueTarifZeile(hof: TarifHof & { produkteImShop: number }, jetzt: Date): TarifZeileDaten | null {
  const stand = ermittleStand(hof, jetzt)
  switch (stand.zustand) {
    case 'hofladen':
      return null
    case 'startphase': {
      const t = TARIF_ZEILE.startphase
      return { zustand: stand.zustand, titel: t.titel, zeile: t.zeile, zeileHandy: `${t.zeile} · ${t.handy}` }
    }
    case 'gruendungshof': {
      const zeile = `${TARIF_ZEILE.gruendungshof.zeile} ${formatDatumLang(stand.bis)}`
      return { zustand: stand.zustand, titel: TARIF_ZEILE.gruendungshof.titel, zeile, zeileHandy: zeile }
    }
    case 'hoftor': {
      const t = TARIF_ZEILE.hoftor
      return {
        zustand: stand.zustand,
        titel: t.titel,
        zeile: t.zeile,
        zeileHandy: t.zeile,
        grenze: {
          wert: `${hof.produkteImShop} von ${HOFTOR_PRODUKTE}`,
          anteil: Math.min(hof.produkteImShop / HOFTOR_PRODUKTE, 1),
        },
        hinweis: t.hinweis,
      }
    }
  }
}

// ─── „Deine Konditionen", Fassung 2 (Nr. 61; Mockups *-h1-einstellungen-konditionen-v2) ──

/** „Dein Stand" oben auf der Seite: eine Überschrift, Sätze mit hervorgehobenen Teilen. */
export type DeinStand = { titel: string; saetze: readonly (readonly TextTeil[])[] }

export const DEIN_STAND_TITEL = 'Dein Stand'

/**
 * „Dein Stand" in der Startphase (K1, E6-Ergänzung). Für Gründungshöfe gilt
 * `baueGruendungsZusage` (K2), für die Zeit nach dem Stichtag kommt der
 * Wortlaut mit Gate 8 — bis dahin steht dort der Übergang K1 allein.
 */
export const DEIN_STAND_STARTPHASE: DeinStand = {
  titel: `Startphase – für dich ist alles ${KOSTENLOS}.`,
  saetze: [
    [{ text: 'Bis ' }, { text: STARTPHASE_BIS_TEXT, betont: true }, { text: ' zahlst du nichts. Du musst nichts tun und nichts auswählen.' }],
    [{ text: `Ab ${TARIFE_AB_TEXT} läuft dein Hof ` }, { text: `${KOSTENLOS} im Tarif ${HOFTOR_NAME}`, betont: true }, { text: ' weiter.' }],
    [{ text: `${HOFLADEN_NAME} gibt es nur, wenn du ihn selbst wählst. Erst dann wird etwas abgebucht.` }],
  ],
}

/**
 * Die Zusage eines Gründungshofs (Register K2): Hofladen ohne Grundgebühr bis
 * zu seinem Tag, danach die normale Regel (E6-Ergänzung) — nie ein Preis, nie
 * die alte Provision für „danach". Der Wortlaut steht NUR hier: „Dein Stand"
 * nimmt ihn, und Nr. 62 lässt `gruendungsKonditionenText` (gruendungshof.ts,
 * Freischalt-Dialog im Admin) hierauf verweisen. Datum wie in der Tarif-Zeile.
 */
export function baueGruendungsZusage(bis: Date): string {
  return (
    `${HOFLADEN_NAME} ${TARIF_ZEILE.gruendungshof.zeile} ${formatDatumLang(bis)}. ` +
    `Danach wählst du deinen Tarif – ohne Wahl bleibt ${HOFTOR_NAME}, ${KOSTENLOS}.`
  )
}

/**
 * „Dein Stand" eines Hofs aus derselben Regel wie die Tarif-Zeile: ein
 * Gründungshof mit seiner Zusage (Vorrang, K2), sonst vor dem Stichtag die
 * Startphase (K1). Danach null, bis Gate 8 den Wortlaut bringt — dann zeigt
 * „Deine Konditionen" den Übergang K1 allein.
 */
export function baueDeinStand(hof: TarifHof, jetzt: Date): DeinStand | null {
  const stand = ermittleStand(hof, jetzt)
  if (stand.zustand === 'gruendungshof') {
    return { titel: TARIF_ZEILE.gruendungshof.titel, saetze: [[{ text: baueGruendungsZusage(stand.bis) }]] }
  }
  return stand.zustand === 'startphase' ? DEIN_STAND_STARTPHASE : null
}

/** Über den Tarif-Karten. */
export const TARIFE_TITEL = 'Zwei Tarife – du entscheidest'

/** Die Marken über den Tarif-Karten (E6-Ergänzung: ohne Wahl gilt Hoftor; „Dein Tarif" nur nach Wahl). */
export const TARIF_MARKE = { gewaehlt: 'Dein Tarif', automatisch: 'Gilt automatisch', mehr: 'Wenn du mehr brauchst' } as const

/** Unter dem Tarif, der ohne Wahl gilt. */
export const OHNE_WAHL_SATZ = 'Du musst dafür nichts tun.'

/** Unter dem Preis: frühestens ab dem Stichtag (K1), kündbar, nur nach Wahl (E6-Ergänzung). */
export const PREIS_BEDINGUNGEN = `frühestens ab ${TARIFE_AB_TEXT} · ${MONATLICH_KUENDBAR} · nur wenn du ihn wählst`

/** Wann die Wahl öffnet (Freigabe §14 Nr. 61). */
export const TARIF_WAHL_SATZ = `Wählen kannst du ab ${TARIF_WAHL_AB_TEXT}.`

/** Der Vergleich „Heute / Im Hoftor" — nur vor dem Stichtag, Zahlen aus den Konstanten und der Hof-Abfrage. */
export const VERGLEICH_TEXT = {
  titel: `Was das ab ${MONAT_FORMAT.format(TARIFE_AB)} für deinen Hof heißt`,
  heute: 'Heute',
  hoftor: `Im ${HOFTOR_NAME}`,
  produkte: PRODUKTE_IM_SHOP,
  abholzeiten: 'Abholzeiten pro Woche',
} as const

/** Was über der Grenze geschieht (O8): Der Hof wählt, der Rest ruht, gelöscht wird nichts. */
export const VERGLEICH_SATZ: readonly TextTeil[] = [
  {
    text:
      `Im ${HOFTOR_NAME} suchst du dir aus, welche ${HOFTOR_PRODUKTE} Produkte sichtbar bleiben. ` +
      'Die anderen ruhen und sind mit einem Tipp wieder da – ',
  },
  { text: 'gelöscht wird nichts', betont: true },
  { text: `. Mit ${HOFLADEN_NAME} bleibt alles, wie es ist.` },
]
