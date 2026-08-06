// Einstiegs-Checkliste für neu registrierte Höfe.
//
// Seit der offenen Registrierung landen Bauern ohne Begleitung in der
// Oberfläche. Diese Liste ist der rote Faden: Was muss ich tun, damit mein
// Hofladen läuft? Bewusst als Karte auf der Übersicht statt als klickende
// Tour — eine Tour nervt beim zweiten Mal, eine Liste misst echten Zustand.
//
// NICHTS wird gespeichert. Der Fortschritt ergibt sich jedes Mal neu aus den
// vorhandenen Daten; es gibt kein „abgehakt"-Feld, das mit der Wirklichkeit
// auseinanderlaufen könnte. Deshalb ist auch kein Schema-Feld nötig.
//
// Reine Funktion ohne Datenbankbezug — dasselbe Muster wie dashboard-hints.ts,
// das die Bedingungen der übrigen Hinweiskarten trägt.

/** Alles, was die Liste zum Rechnen braucht — Zählwerte und Ja/Nein, sonst nichts. */
export type ErsteSchritteDaten = {
  hatBeschreibung: boolean
  hatLogo: boolean
  /** Ein hochgeladenes Foto, kein Farbverlauf — siehe Kommentar in der Query. */
  hatTitelbild: boolean
  /** ALLE Produkte, auch ausgeblendete: angelegt ist angelegt. */
  produkte: number
  /** Nur aktive Abholzeiten — eine abgeschaltete nützt keinem Kunden. */
  aktiveAbholzeiten: number
  zahlungBereit: boolean
}

export type ErsterSchritt = {
  id: 'profil' | 'auftritt' | 'produkt' | 'abholzeiten' | 'zahlung'
  titel: string
  /** Ein Satz, warum das nützt — nicht was es technisch tut. */
  nutzen: string
  href: string
  erledigt: boolean
  /** Bar bei Abholung funktioniert ohne — das muss dranstehen. */
  optional: boolean
}

export type ErsteSchritteErgebnis = {
  schritte: ErsterSchritt[]
  erledigt: number
  gesamt: number
  /** Anteil erledigt (0–100), gerundet — für den Balken. */
  prozent: number
  /** false = die Karte gehört gar nicht erst auf die Seite. */
  anzeigen: boolean
}

/**
 * Zusatzsatz, solange der Hof auf die Freigabe wartet.
 *
 * Bewusst KEINE Wiederholung von FARM_PENDING_OWNER_HINT (src/lib/farm-approval.ts:31),
 * der über dem Balken in jeder Farmer-Seite steht und bereits sagt, dass man
 * schon einrichten kann und der Hof mit der Freischaltung online geht. Dieser
 * Satz hier setzt eins drauf und bezieht sich auf DIESE Liste: warum es sich
 * lohnt, sie jetzt abzuarbeiten statt später.
 */
export const ERSTE_SCHRITTE_WARTET =
  'Arbeite die Liste am besten jetzt schon ab — dann steht dein Hof fertig da, sobald die Freischaltung durch ist.'

/**
 * Berechnet Punkte und Fortschritt.
 *
 * Die Reihenfolge ist die Arbeitsreihenfolge und liegt fest: erst wissen, wer
 * du bist (Profil, Auftritt), dann was du verkaufst (Produkt), dann wann man
 * es bekommt (Abholzeiten), zuletzt das Kür-Thema Bezahlung.
 */
export function ersteSchritte(daten: ErsteSchritteDaten): ErsteSchritteErgebnis {
  const schritte: ErsterSchritt[] = [
    {
      id: 'profil',
      titel: 'Hofprofil ausfüllen',
      nutzen: 'Wer bei dir kauft, will wissen, wer du bist.',
      href: '/settings/profile',
      erledigt: daten.hatBeschreibung,
      optional: false,
    },
    {
      id: 'auftritt',
      titel: 'Logo und Titelbild hochladen',
      nutzen: 'Macht aus der Vorlage deinen Hof.',
      href: '/settings/appearance',
      erledigt: daten.hatLogo && daten.hatTitelbild,
      optional: false,
    },
    {
      id: 'produkt',
      titel: 'Erstes Produkt anlegen',
      nutzen: 'Ohne Produkt gibt es nichts zu bestellen.',
      href: '/products',
      erledigt: daten.produkte > 0,
      optional: false,
    },
    {
      id: 'abholzeiten',
      titel: 'Abholzeiten festlegen',
      nutzen: 'Erst dann können Kunden bestellen.',
      href: '/settings/pickup-slots',
      erledigt: daten.aktiveAbholzeiten > 0,
      optional: false,
    },
    {
      id: 'zahlung',
      titel: 'Online-Zahlung einrichten',
      nutzen: 'Bar bei Abholung geht auch ohne.',
      href: '/settings/payments',
      erledigt: daten.zahlungBereit,
      optional: true,
    },
  ]

  const erledigt = schritte.filter((s) => s.erledigt).length
  const gesamt = schritte.length

  return {
    schritte,
    erledigt,
    gesamt,
    prozent: Math.round((erledigt / gesamt) * 100),
    // Ein einziger offener Punkt genügt, damit die Karte bleibt; ist alles
    // erledigt, verschwindet sie restlos — kein „Alles erledigt"-Rest.
    anzeigen: erledigt < gesamt,
  }
}
