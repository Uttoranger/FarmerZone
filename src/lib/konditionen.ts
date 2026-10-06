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
 * Übergang (Register K1, Nachtlauf 17d): In der Startphase ist FarmerZone
 * kostenlos, die Tarife gelten erst ab `TARIFE_AB`. Jede Seite, die Tarife
 * zeigt, nennt dazu `KONDITIONEN_UEBERGANG` — das Datum steht nur hier.
 *
 * Regel für Anzeigen (wie früher gruendungshof.ts): Eine Zahl steht nie als
 * Literal in einer Seite, sondern kommt von hier. Der Satz der Servicegebühr
 * kommt aus servicegebuehr.ts (E4) und steht hier nicht ein zweites Mal;
 * Beträge laufen über formatEuro (format.ts).
 */
import type { Tarif } from '@prisma/client'
import { formatDatumLang, formatEuro, formatZahl } from '@/lib/format'
import {
  SERVICEGEBUEHR_STANDARD_MIND_CENTS,
  SERVICEGEBUEHR_STANDARD_PROZENT,
  centsAlsEuro,
  wienerMitternacht,
} from '@/lib/servicegebuehr'

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

/**
 * Wie abgerechnet wird (E6). Beschreibt das Preismodell, nicht einen
 * laufenden Einzug: Die Grundgebühr gibt es erst ab dem Stichtag (K1).
 */
export const MONATSABRECHNUNG_TEXT =
  `Die Monatsabrechnung per SEPA-Lastschrift umfasst die Grundgebühr (ab ${TARIFE_AB_TEXT}) ` +
  'und die Servicegebühren aus Barbestellungen. ' +
  'Bei Online-Zahlungen ist die Servicegebühr schon beim Bezahlen erledigt.'

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
