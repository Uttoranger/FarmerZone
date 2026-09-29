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
  /** Gesetzte Koordinaten (latitude UND longitude) — der Kartenpunkt wird
   *  auf der eingebetteten Profilkarte geschoben und mit dem Profil
   *  gespeichert; er gehört zum fertigen Profil. */
  hatKoordinaten: boolean
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
  'Arbeite die Liste am besten jetzt schon ab — dann steht dein Hof fertig da, sobald die Freischaltungs-Mail kommt.'

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
      nutzen: 'Wer bei dir kauft, will wissen, wer du bist. Standort auf der Karte setzen.',
      href: '/settings/profile',
      // Beschreibung UND gesetzter Kartenpunkt — die Adresse allein reicht
      // nicht mehr, seit Kundinnen den Hof später auf einer Karte finden sollen.
      erledigt: daten.hatBeschreibung && daten.hatKoordinaten,
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

/** Die Hof-Stammdaten, aus denen die Checkliste liest — so, wie die Abfrage sie liefert. */
export type HofFuerErsteSchritte = {
  description: string | null
  latitude: number | null
  longitude: number | null
  logoUrl: string | null
  bannerType: string
  bannerUrl: string | null
  stripeAccountReady: boolean
}

/**
 * Stammdaten und Zählwerte → Checklisten-Daten, für Heute (queries/heute.ts).
 * getDashboardStats in queries/dashboard.ts hält noch eine eigene Kopie; sie
 * ist seit Heute ungenutzt und fällt mit ihr.
 */
export function ersteSchritteDaten(
  hof: HofFuerErsteSchritte | null,
  zaehler: { produkte: number; aktiveAbholzeiten: number }
): ErsteSchritteDaten {
  return {
    // `description` ist eine Pflichtspalte (prisma/schema.prisma), im
    // Onboarding aber ein optionales Feld — ein Hof ohne Beschreibung trägt
    // einen leeren String, kein null. Ein `!== null` ginge hier immer durch.
    hatBeschreibung: (hof?.description ?? '').trim().length > 0,
    hatKoordinaten: hof?.latitude != null && hof?.longitude != null,
    hatLogo: (hof?.logoUrl ?? '').trim().length > 0,
    // Dieselbe Bedingung, mit der die Hofseite entscheidet, ob sie ein Foto
    // oder einen Farbverlauf zeigt (farm-page-view.tsx). Ein Verlauf ist die
    // Voreinstellung und kein hochgeladenes Titelbild — der Schritt heißt
    // „hochladen" und wäre sonst für jeden Hof von Anfang an erledigt.
    hatTitelbild: hof?.bannerType === 'PHOTO' && !!hof?.bannerUrl,
    // ALLE Produkte, auch ausgeblendete: angelegt ist angelegt.
    produkte: zaehler.produkte,
    // Nur AKTIVE Abholzeiten: eine abgeschaltete nützt keinem Kunden.
    aktiveAbholzeiten: zaehler.aktiveAbholzeiten,
    zahlungBereit: hof?.stripeAccountReady === true,
  }
}

// ─── Ausblenden ─────────────────────────────────────────────────────────────

/**
 * Wer die Karte nicht mehr sehen will, klickt sie weg; gemerkt wird das in
 * einem Cookie, nicht in localStorage: Der Server liest ihn beim Rendern der
 * Seite und lässt die Karte gleich weg — kein Aufblitzen, kein Nachrutschen
 * des Inhalts. Der Wert ist die Hof-ID, damit ein anderer Hof im selben
 * Browser die Karte weiter sieht. Keine Spalte in der Datenbank: Die Karte
 * misst echten Zustand, das Wegklicken ist eine Gerätevorliebe.
 */
export const ERSTE_SCHRITTE_AUS_COOKIE = 'fz-erste-schritte-aus'

/** Ein Jahr — länger als jede Einrichtung dauert, kürzer als für immer. */
export const ERSTE_SCHRITTE_AUS_DAUER_S = 365 * 24 * 60 * 60

/**
 * Liest den Cookie: ausgeblendet nur, wenn er genau diese Hof-ID trägt.
 * Ein leerer, fremder oder fehlender Wert heißt: Karte zeigen.
 */
export function ersteSchritteAusgeblendet(cookieWert: string | undefined, farmId: string): boolean {
  return cookieWert !== undefined && cookieWert.length > 0 && cookieWert === farmId
}

export type ErsteSchritteAnzeige = 'karte' | 'zeile' | 'nichts'

/**
 * Was Heute für die Erste-Schritte-Karte zeigt: die Karte, solange etwas
 * offen ist und der Hof sie nicht weggeklickt hat; sonst unten die schmale
 * Zeile „Erste Schritte einblenden"; ist alles erledigt, gar nichts — auch
 * die Zeile nicht, sie würde eine leere Karte zurückholen.
 */
export function ersteSchritteAnzeige(ergebnis: { anzeigen: boolean }, ausgeblendet: boolean): ErsteSchritteAnzeige {
  if (!ergebnis.anzeigen) return 'nichts'
  return ausgeblendet ? 'zeile' : 'karte'
}
