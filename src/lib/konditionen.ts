/**
 * Die Konditionen für Höfe als Text — EINE Quelle für jede Seite, die Preise
 * nennt: /fuer-hoefe, /konditionen, Registrieren und Einrichten (Gate 5,
 * Nr. 15). Grundlage ist die Entscheidung E6 = Tarife (docs/nachtlauf/
 * freigabe.md): Hoftor 0 €, Hofladen 19 € im Monat, die Servicegebühr zahlt
 * der Kunde, abgerechnet wird einmal im Monat per SEPA.
 *
 * NUR TEXTE. Hier wird nichts berechnet, begrenzt oder abgebucht: Es gibt
 * (noch) keine Tarif-Grenzen, keine Grundgebühr und keinen SEPA-Einzug im
 * Code; `Farm.tarif` bleibt für jeden Hof leer, bis Gate 8 die Wahl baut.
 *
 * Regel für Anzeigen (wie früher gruendungshof.ts): Eine Zahl steht nie als
 * Literal in einer Seite, sondern kommt von hier. Der Satz der Servicegebühr
 * kommt aus servicegebuehr.ts (E4) und steht hier nicht ein zweites Mal;
 * Beträge laufen über formatEuro (format.ts).
 */
import { formatEuro, formatZahl } from '@/lib/format'
import {
  SERVICEGEBUEHR_STANDARD_MIND_CENTS,
  SERVICEGEBUEHR_STANDARD_PROZENT,
  centsAlsEuro,
} from '@/lib/servicegebuehr'

/** Dieselben Werte wie das Prisma-Enum `Tarif` (tests/konditionen.test.ts gleicht ab). */
export type TarifId = 'HOFTOR' | 'HOFLADEN'

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
  /** Für wen der Tarif gedacht ist. */
  zusatz: string
  leistungen: readonly string[]
}

/** „€ 0", „€ 19" — eine Grundgebühr zum Anzeigen. */
export function grundgebuehrText(cents: number): string {
  // Ganze Euro ohne Komma, krumme Beträge (falls je einer kommt) mit Cent.
  return cents % 100 === 0 ? formatEuro(centsAlsEuro(cents), 0) : formatEuro(centsAlsEuro(cents))
}

export const PRO_MONAT = '/ Monat'

export const TARIFE: readonly TarifText[] = [
  {
    id: 'HOFTOR',
    name: 'Hoftor',
    grundgebuehrCents: 0,
    preis: grundgebuehrText(0),
    zusatz: 'Zum Reinschnuppern',
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
    zusatz: 'Für den laufenden Verkauf · monatlich kündbar',
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

// ─── Servicegebühr ──────────────────────────────────────────────────────────

/** „5 % (mind. € 0,50)" — Satz und Mindestgebühr für neue Höfe (E4). */
export const SERVICEGEBUEHR_SATZ_TEXT =
  `${formatZahl(SERVICEGEBUEHR_STANDARD_PROZENT)} % ` +
  `(mind. ${formatEuro(centsAlsEuro(SERVICEGEBUEHR_STANDARD_MIND_CENTS))})`

/** Der Grundsatz in einem Satz — Preise-Abschnitt von /fuer-hoefe und /konditionen. */
export const SERVICEGEBUEHR_ZAHLT_KUNDE =
  `Die Servicegebühr von ${SERVICEGEBUEHR_SATZ_TEXT} zahlt der Kunde. ` +
  'Du bekommst immer den vollen Warenpreis – online wie bar.'

/** Kurzfassung für Karten (Einrichten, Vorteile). */
export const VOLLER_WARENPREIS = 'Die Servicegebühr zahlt der Kunde – du behältst den vollen Warenpreis.'

/** Wie abgerechnet wird (E6). Beschreibt das Preismodell, nicht einen laufenden Einzug. */
export const MONATSABRECHNUNG_TEXT =
  'Grundgebühr und Servicegebühren aus Barbestellungen rechnen wir einmal im Monat ab, per SEPA-Lastschrift. ' +
  'Bei Online-Zahlungen ist die Servicegebühr schon beim Bezahlen erledigt.'

// ─── Wortlaute für die Einstiege ────────────────────────────────────────────

/** Unter den Knöpfen oben auf /fuer-hoefe. */
export const EINSTIEG_HINWEIS = `Mit dem Tarif ${START_TARIF.name} ab ${START_TARIF.preis} – monatlich kündbar.`

/** Unter der Überschrift „Hof registrieren" (Web) bzw. kürzer am Handy. */
export const REGISTRIEREN_TARIF = `Kostenlos starten mit dem Tarif ${START_TARIF.name}. Wechseln kannst du jederzeit.`

/** Unter dem Hofladen-Preis am Handy. */
export const HOFTOR_ALTERNATIVE = `Oder ${START_TARIF.name} ab ${START_TARIF.preis} zum Reinschnuppern`

/** Wann der Text dieser Seite zuletzt geändert wurde. */
export const KONDITIONEN_STAND = 'Oktober 2026'

/**
 * Was die Karte „Tarif" auf Einrichten zeigt. Ein Hof ohne gewählten Tarif
 * (`Farm.tarif` leer — heute jeder) sieht beide Tarife statt eines erfundenen
 * „Dein Tarif"; einen Tarif setzt erst Gate 8.
 */
export function tarifKarte(tarif: TarifId | null): { titel: string; tarife: readonly TarifText[] } {
  return tarif ? { titel: 'Dein Tarif', tarife: [tarifText(tarif)] } : { titel: 'Tarife', tarife: TARIFE }
}
