/**
 * „Hof einrichten" (/onboarding, Gate 5 Nr. 15; Mockups web-h1-einrichten und
 * mobil-h1-einrichten): welche Schritte es gibt, welcher erledigt ist, was
 * jeder sagt und wohin er führt. Rein und ohne Datenbank prüfbar
 * (tests/einrichten.test.ts) — die Seite lädt nur die Zahlen und zeichnet.
 *
 * Wie die Erste-Schritte-Karte (erste-schritte.ts) wird NICHTS gespeichert:
 * Der Stand ergibt sich jedes Mal aus den Daten des Hofs.
 *
 * Abweichungen vom Mockup, mit Grund (Bericht Nr. 15):
 *  - Ohne Hof ist Schritt 2 „Hof anlegen" mit dem Formular: Registrieren legt
 *    weiter nur das Konto an (registerFarmer unverändert), den Hof legt
 *    createFarm an. Erst danach gibt es Hofseite, Produkte und Zahlung.
 *  - Die Lastschrift (SEPA-Mandat, Register N38, Nr. 198) ist ein Hinweis und
 *    zählt nicht mit: Sie braucht erst der Einzug der Plattformgebühr aus
 *    Barbestellungen, nicht der erste Verkauf. Der Hinweis führt zu
 *    „Lastschrift einrichten“ in Deine Konditionen; eingerichtet sagt er das.
 *
 * Stripe-Pflicht (Register Z1): „Hof online stellen" — die Freischaltung —
 * geht erst mit fertigem Stripe-Konto und (Ergänzung 21.10.2026) mit einer
 * aktiven Abholzeit. Hier steht es nur als Zustand; die Schranke selbst sitzt
 * im Server (freischaltSperre in approveFarmAction).
 */
import { aufzaehlung } from '@/lib/hofseite-fortschritt'
import { LASTSCHRIFT_HREF, LASTSCHRIFT_TEXT, ONLINE_ZAHLUNG_EINRICHTEN_SATZ, ONLINE_ZAHLUNG_EINRICHTEN_TITEL } from '@/lib/konditionen'
import { ABHOLZEITEN_FEHLEN } from '@/lib/pickup-slot-rules'
import type { WarteStand } from '@/lib/farm-approval'

export type EinrichtenDaten = {
  /** Name aus dem Konto (User.name). */
  personName: string
  email: string
  /**
   * Muss die E-Mail-Adresse noch bestätigt werden (S3, Nr. 17b; bestaetigungOffen,
   * frisch aus der Datenbank)? Dann wartet die Freischaltung auf den Hof,
   * nicht auf uns. Fehlt die Angabe, gilt nein (Konten vor dem Stichtag).
   */
  emailOffen?: boolean
  /** null = noch kein Hof angelegt. */
  hof: {
    name: string
    /** Aus hofseiteFortschritt — dieselbe Zählung wie „Mein Hof". */
    hofseite: { erledigt: number; gesamt: number; fehlend: readonly string[] }
    /** Alle Produkte, auch ausgeblendete: angelegt ist angelegt. */
    produkte: number
    /** stripeKontoBereit — Zahlungen UND Auszahlungen frei. */
    stripeBereit: boolean
    /** Mindestens eine aktive Abholzeit — ohne sie kein Freischalten (Register Z1, Ergänzung 21.10.2026). */
    abholzeitAktiv: boolean
    /** approvedAt gesetzt (nur der Betreiber setzt es). */
    freigeschaltet: boolean
    /** Farm.sepaMandatAm gesetzt — das Lastschrift-Mandat gilt (nur über den Webhook, Nr. 198). Fehlt es, gilt nein. */
    sepaMandat?: boolean
  } | null
}

export type SchrittId = 'konto' | 'hof' | 'hofseite' | 'produkte' | 'zahlung' | 'sepa' | 'freischaltung'

/**
 * erledigt · offen (jetzt dran, mit Aktion) · gesperrt (erst nach einem
 * anderen Schritt) · wartet (liegt beim Betreiber) · hinweis (zählt nicht).
 */
export type SchrittZustand = 'erledigt' | 'offen' | 'gesperrt' | 'wartet' | 'hinweis'

export type SchrittAktion =
  | { art: 'link'; href: string; label: string; primaer: boolean }
  /** Das Formular „Hof anlegen" steht im Schritt selbst. */
  | { art: 'formular' }

export type EinrichtenSchritt = {
  id: SchrittId
  /** Die Nummer im Kreis — fortlaufend über alle sechs, auch den Hinweis. */
  nummer: number
  titel: string
  /** Am Handy kürzer (Mockup mobil-h1-einrichten). */
  titelKurz: string
  text: string
  textKurz: string
  zustand: SchrittZustand
  aktion: SchrittAktion | null
}

export type EinrichtenStand = {
  schritte: EinrichtenSchritt[]
  /** Erledigte unter den zählenden Schritten (ohne Hinweis). */
  erledigt: number
  gesamt: number
  /** „1 von 5 Schritten erledigt" (Board w2-registrieren, Lauf 30). */
  ueberschrift: string
  /** Am Handy dieselbe Zeile (Board s2-registrieren); bleibt als eigenes Feld für die Aufrufer. */
  ueberschriftKurz: string
}

/** Der Vorname für „Willkommen, …" — das erste Wort des Namens, sonst nichts. */
export function vorname(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ''
}

function anzahl(n: number, eins: string, mehr: string): string {
  return n === 1 ? `1 ${eins}` : `${n} ${mehr}`
}

export function einrichtenStand(daten: EinrichtenDaten): EinrichtenStand {
  const { hof } = daten
  const gesperrt = 'Geht los, sobald dein Hof angelegt ist.'

  const konto: Omit<EinrichtenSchritt, 'nummer'> = {
    id: 'konto',
    titel: 'Konto erstellt',
    titelKurz: 'Konto erstellt',
    text: hof ? `${hof.name} · ${daten.email}` : daten.email,
    textKurz: hof ? hof.name : daten.email,
    zustand: 'erledigt',
    aktion: null,
  }

  const hofSchritt: Omit<EinrichtenSchritt, 'nummer'> = hof
    ? (() => {
        const fertig = hof.hofseite.erledigt >= hof.hofseite.gesamt
        const stand = `${hof.hofseite.erledigt} von ${hof.hofseite.gesamt} fertig`
        return {
          id: 'hofseite',
          titel: 'Hofseite einrichten',
          titelKurz: 'Hofseite einrichten',
          text: fertig ? `${stand} – Kunden sehen deinen Hof vollständig` : `${hof.hofseite.erledigt} von ${hof.hofseite.gesamt} – es fehlen ${aufzaehlung(hof.hofseite.fehlend)}`,
          textKurz: stand,
          zustand: fertig ? 'erledigt' : 'offen',
          aktion: fertig ? null : { art: 'link', href: '/farm-page', label: 'Weiter', primaer: false },
        }
      })()
    : {
        id: 'hof',
        titel: 'Hof anlegen',
        titelKurz: 'Hof anlegen',
        text: 'Name, Adresse und Telefon – daraus entsteht deine Hofseite.',
        textKurz: 'Name, Adresse, Telefon',
        zustand: 'offen',
        aktion: { art: 'formular' },
      }

  const produkte: Omit<EinrichtenSchritt, 'nummer'> = !hof
    ? { id: 'produkte', titel: 'Erste Produkte anlegen', titelKurz: 'Erste Produkte', text: gesperrt, textKurz: 'nach dem Hof', zustand: 'gesperrt', aktion: null }
    : hof.produkte > 0
      ? {
          id: 'produkte',
          titel: 'Erste Produkte anlegen',
          titelKurz: 'Erste Produkte',
          text: `${anzahl(hof.produkte, 'Produkt', 'Produkte')} angelegt`,
          textKurz: `${hof.produkte} angelegt`,
          zustand: 'erledigt',
          aktion: null,
        }
      : {
          id: 'produkte',
          titel: 'Erste Produkte anlegen',
          titelKurz: 'Erste Produkte',
          text: 'Ohne Produkt gibt es nichts zu bestellen.',
          textKurz: 'noch keins',
          zustand: 'offen',
          aktion: { art: 'link', href: '/products?neu=1', label: 'Produkt anlegen', primaer: false },
        }

  // Nur ein Link in die bestehende Stripe-Einrichtung (/settings/payments) —
  // hier entsteht kein Stripe-Aufruf.
  const zahlung: Omit<EinrichtenSchritt, 'nummer'> = !hof
    ? { id: 'zahlung', titel: 'Online-Zahlung einrichten', titelKurz: 'Online-Zahlung (Stripe)', text: gesperrt, textKurz: 'nach dem Hof', zustand: 'gesperrt', aktion: null }
    : hof.stripeBereit
      ? {
          id: 'zahlung',
          titel: 'Online-Zahlung einrichten',
          titelKurz: 'Online-Zahlung (Stripe)',
          text: 'Online-Zahlung über Stripe ist eingerichtet.',
          textKurz: 'eingerichtet',
          zustand: 'erledigt',
          aktion: null,
        }
      : {
          id: 'zahlung',
          titel: 'Online-Zahlung einrichten',
          titelKurz: 'Online-Zahlung (Stripe)',
          // Wörtlich aus der Freigabe (Z1), eine Quelle in konditionen.ts.
          text: ONLINE_ZAHLUNG_EINRICHTEN_SATZ,
          // Auch am Handy der volle Satz — er ist der Grund für die Pflicht.
          textKurz: ONLINE_ZAHLUNG_EINRICHTEN_SATZ,
          zustand: 'offen',
          aktion: { art: 'link', href: '/settings/payments', label: 'Mit Stripe einrichten', primaer: false },
        }

  // Nr. 198: der Mandat-Schritt — ein Hinweis mit dem Weg zu „Lastschrift einrichten“, zählt nicht mit.
  const sepa: Omit<EinrichtenSchritt, 'nummer'> = hof?.sepaMandat
    ? {
        id: 'sepa',
        titel: 'Lastschrift für die Monatsabrechnung',
        titelKurz: 'Lastschrift',
        text: 'Die Lastschrift ist eingerichtet – die Plattformgebühr aus Barbestellungen ziehen wir einmal im Monat ein.',
        textKurz: 'eingerichtet',
        zustand: 'hinweis',
        aktion: null,
      }
    : {
        id: 'sepa',
        titel: 'Lastschrift für die Monatsabrechnung',
        titelKurz: 'Lastschrift',
        // Wortlaut Board w2-registrieren; „ab dem Einzug“ bleibt aus dem Code: Vorher und in der
        // Gründungszeit geht bar auch ohne Lastschrift (barMoeglich, einzugAbFuer).
        text:
          'Ohne Lastschrift gibt es bei dir ab dem Einzug kein „Bar bei Abholung“: Darüber ziehen wir einmal im Monat ' +
          'die Plattformgebühr aus Barbestellungen ein. Für die Freischaltung brauchst du sie nicht.',
        textKurz: 'für Barbestellungen',
        zustand: 'hinweis',
        aktion: hof ? { art: 'link', href: LASTSCHRIFT_HREF, label: LASTSCHRIFT_TEXT.einrichten, primaer: false } : null,
      }

  const freischaltung: Omit<EinrichtenSchritt, 'nummer'> = hof?.freigeschaltet
    ? {
        id: 'freischaltung',
        titel: 'Prüfung und Freischaltung',
        titelKurz: 'Freischaltung',
        text: 'Dein Hof ist freigeschaltet und öffentlich.',
        textKurz: 'erledigt',
        zustand: 'erledigt',
        aktion: null,
      }
    : hof && daten.emailOffen
      ? {
          // Einrichten geht weiter (Texte, Abholzeiten); nur online gehen
          // wartet auf die Bestätigung — der Link führt zu „Erneut senden".
          id: 'freischaltung',
          titel: 'Prüfung und Freischaltung',
          titelKurz: 'Freischaltung',
          text: 'Bestätige zuerst deine E-Mail-Adresse – danach schauen wir drüber und schalten deinen Hof frei.',
          textKurz: 'erst nach der E-Mail-Bestätigung',
          zustand: 'gesperrt',
          aktion: { art: 'link', href: '/verify', label: 'E-Mail bestätigen', primaer: false },
        }
      : hof && !hof.stripeBereit
        ? {
            // Z1: Online geht ein Hof erst mit Stripe — dieselbe Reihenfolge
            // wie freischaltSperre (erst die E-Mail, dann Stripe).
            id: 'freischaltung',
            titel: 'Prüfung und Freischaltung',
            titelKurz: 'Freischaltung',
            text: 'Geht erst mit eingerichteter Online-Zahlung – danach schauen wir drüber und schalten deinen Hof frei.',
            textKurz: 'erst nach der Online-Zahlung',
            zustand: 'gesperrt',
            aktion: { art: 'link', href: '/settings/payments', label: ONLINE_ZAHLUNG_EINRICHTEN_TITEL, primaer: false },
          }
        : hof && !hof.abholzeitAktiv
          ? {
              // Z1, Ergänzung 21.10.2026: ohne aktive Abholzeit kann niemand bestellen —
              // derselbe Grund wie in freischaltSperre, in der Reihenfolge nach Stripe.
              id: 'freischaltung',
              titel: 'Prüfung und Freischaltung',
              titelKurz: 'Freischaltung',
              text: 'Geht erst mit einer Abholzeit – danach schauen wir drüber und schalten deinen Hof frei.',
              textKurz: 'erst mit einer Abholzeit',
              zustand: 'gesperrt',
              aktion: { art: 'link', href: ABHOLZEITEN_FEHLEN.aktion.href, label: ABHOLZEITEN_FEHLEN.aktion.text, primaer: false },
            }
          : {
              id: 'freischaltung',
              titel: 'Prüfung und Freischaltung',
              titelKurz: 'Freischaltung',
              text: 'Wir schauen kurz drüber und melden uns per E-Mail – dann ist dein Hof öffentlich.',
              textKurz: 'wir melden uns per E-Mail',
              zustand: hof ? 'wartet' : 'gesperrt',
              aktion: null,
            }

  // „Alles ist eingerichtet“ nur, wenn die Freischaltung wirklich als letztes offen ist:
  // `wartet` gilt schon mit E-Mail, Stripe und Abholzeit, auch bei unfertiger Hofseite.
  const vorher = [konto, hofSchritt, produkte, zahlung]
  const freischaltungFertig: Omit<EinrichtenSchritt, 'nummer'> =
    freischaltung.zustand === 'wartet' && vorher.every((s) => s.zustand === 'erledigt')
      ? { ...freischaltung, text: 'Alles ist eingerichtet. Wir schauen drüber und schalten deinen Hof frei – du bekommst dann eine E-Mail.' }
      : freischaltung

  const schritte = [...vorher, sepa, freischaltungFertig].map((s, i) => ({ ...s, nummer: i + 1 }))
  // Eine Hauptaktion (Register N1): orange ist nur der Knopf am ersten offenen Schritt in der Reihenfolge
  // (Liste Lauf 32, registrieren „Orange auf ‚Mit Stripe einrichten‘ statt auf ‚Weiter‘“); alle anderen Wege bleiben Umriss.
  const erster = schritte.find((s) => s.zustand === 'offen' && s.aktion !== null)
  for (const s of schritte) {
    if (s.aktion?.art === 'link') s.aktion = { ...s.aktion, primaer: s === erster }
  }
  const zaehlend = schritte.filter((s) => s.zustand !== 'hinweis')
  const erledigt = zaehlend.filter((s) => s.zustand === 'erledigt').length
  const gesamt = zaehlend.length
  const zeile = `${erledigt} von ${gesamt} Schritten erledigt`

  return { schritte, erledigt, gesamt, ueberschrift: zeile, ueberschriftKurz: zeile }
}

/**
 * Welcher Warte-Balken gilt (Register N42 e, V59): Solange ein Schritt offen
 * oder gesperrt ist, muss der Hof noch etwas tun („Richte deinen Hof fertig
 * ein“); sonst liegt nur noch die Freischaltung beim Team („wird noch
 * geprüft“). Dieselben Schritte wie die Seite — keine zweite Zählung.
 */
export function warteStand(stand: EinrichtenStand): WarteStand {
  return stand.schritte.some((s) => s.zustand === 'offen' || s.zustand === 'gesperrt') ? 'einrichten' : 'pruefung'
}
