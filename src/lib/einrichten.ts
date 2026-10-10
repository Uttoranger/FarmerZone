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
 *  - SEPA ist ein Hinweis ohne Eingabe und zählt nicht mit: Ein SEPA-Mandat
 *    bräuchte einen neuen Geldweg (Stripe SetupIntent), den es nicht gibt —
 *    ein Schritt, der nie fertig werden kann, ließe „Noch 1 Schritt" ewig
 *    stehen.
 *
 * Stripe-Pflicht (Register Z1): „Hof online stellen" — die Freischaltung —
 * geht erst mit fertigem Stripe-Konto. Hier steht es nur als Zustand; die
 * Schranke selbst sitzt im Server (freischaltSperre in approveFarmAction).
 */
import { aufzaehlung } from '@/lib/hofseite-fortschritt'
import { ONLINE_ZAHLUNG_EINRICHTEN_SATZ, ONLINE_ZAHLUNG_EINRICHTEN_TITEL } from '@/lib/konditionen'

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
    /** approvedAt gesetzt (nur der Betreiber setzt es). */
    freigeschaltet: boolean
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
  /** „Noch 3 Schritte bis zum ersten Verkauf". */
  ueberschrift: string
  /** „Noch 3 Schritte" — am Handy. */
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
          text: fertig ? `${stand} – Kunden sehen deinen Hof vollständig` : `${stand} – es fehlen ${aufzaehlung(hof.hofseite.fehlend)}`,
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
          aktion: { art: 'link', href: '/settings/payments', label: 'Mit Stripe einrichten', primaer: true },
        }

  const sepa: Omit<EinrichtenSchritt, 'nummer'> = {
    id: 'sepa',
    titel: 'SEPA-Mandat für die Monatsabrechnung',
    titelKurz: 'SEPA-Mandat',
    text: 'Für Grundgebühr und Servicegebühren aus Barbestellungen. Jetzt ist nichts zu tun.',
    textKurz: 'für die Monatsabrechnung · jetzt nichts zu tun',
    zustand: 'hinweis',
    aktion: null,
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
        : {
            id: 'freischaltung',
            titel: 'Prüfung und Freischaltung',
            titelKurz: 'Freischaltung',
            text: 'Wir schauen kurz drüber und melden uns per E-Mail – dann ist dein Hof öffentlich.',
            textKurz: 'wir melden uns per E-Mail',
            zustand: hof ? 'wartet' : 'gesperrt',
            aktion: null,
          }

  const schritte = [konto, hofSchritt, produkte, zahlung, sepa, freischaltung].map((s, i) => ({ ...s, nummer: i + 1 }))
  const zaehlend = schritte.filter((s) => s.zustand !== 'hinweis')
  const erledigt = zaehlend.filter((s) => s.zustand === 'erledigt').length
  const gesamt = zaehlend.length
  const offen = gesamt - erledigt

  return {
    schritte,
    erledigt,
    gesamt,
    ueberschrift:
      offen === 0
        ? 'Alles erledigt – dein Hof ist startklar'
        : `Noch ${offen === 1 ? 'ein Schritt' : `${offen} Schritte`} bis zum ersten Verkauf`,
    ueberschriftKurz: offen === 0 ? 'Alles erledigt' : `Noch ${offen === 1 ? 'ein Schritt' : `${offen} Schritte`}`,
  }
}
