/**
 * Die Einstellungen der Plattform als Ganzes (Admin › Einstellungen; Register
 * K2-Ergänzung „Gründungshöfe sichtbar" und N15, Nr. 93) — rein und ohne
 * Datenbank prüfbar (tests/plattform-einstellung.test.ts).
 *
 * In der Datenbank steht genau EINE Zeile (`PlattformEinstellung`, Kennung
 * "plattform"), angelegt von der Migration. Gelesen wird nur; fehlt die Zeile
 * (frische Datenbank ohne Migration, Ladefehler), gelten die Standardwerte
 * hier — und die sind die Konstanten aus gruendungshof.ts. Geschrieben wird
 * nur aus der Admin-Action (src/server/actions/plattform-einstellung.ts).
 *
 * Die Prüfungen sind reine Funktionen mit festen Sätzen: dieselben im
 * Formular (sofort) und in der Action (Schutz, mit dem Stand nach der Sperre).
 * Seit Nr. 116 (Register K2, Aktion „100 Gründungshöfe“): Plätze nur erhöhen
 * und nie unter die vergebenen, Monate nur erhöhen (mehr nur, solange die
 * Aktion nicht vorbei ist), „Aktion bis“ einmal gesetzt nur noch früher. Das
 * Standard-Ende bleibt für die Übernahme stehen und ist nicht mehr änderbar.
 */
import {
  GRUENDUNG_BIS_STANDARD_TAG,
  GRUENDUNG_MONATE_STANDARD,
  MAX_GRUENDUNGSHOEFE,
  aktionLaeuft,
  bildeGruendungBis,
  gruendungTagKurz,
  type GruendungEinstellung,
  type GruendungZahlen,
} from '@/lib/gruendungshof'
import { kalendertagInWien, wienerMitternacht } from '@/lib/wiener-tag'
import { hofpreisModellAb, type HofpreisEinstellung } from '@/lib/plattformgebuehr'
import { MARKE } from '@/lib/marke'
import { PRODUKTION_HOST } from '@/lib/umgebung'

/** Die Kennung der einen Zeile. */
export const PLATTFORM_EINSTELLUNG_ID = 'plattform'

/** Das Etikett des Caches — die Admin-Action leert es nach dem Speichern. */
export const PLATTFORM_EINSTELLUNG_TAG = 'plattform-einstellung'

/**
 * Die Zeile, wie die Seiten sie brauchen — nur Zahlen und Text, damit sie
 * durch `unstable_cache` (JSON) und an Client-Komponenten gehen darf.
 * `gruendungBisTag` ist der Wiener Kalendertag JJJJ-MM-TT der DATE-Spalte.
 */
export type PlattformEinstellung = {
  gruendungPlaetze: number
  gruendungBisTag: string
  gruendungAnzeige: boolean
  /** Aktion (Nr. 116): Monate je neuer Zusage. */
  gruendungMonate: number
  /** Stichtag „Aktion bis“ als Wiener Kalendertag; null = ohne Stichtag. */
  gruendungAktionBisTag: string | null
  /** Wann die Zusagen festgeschrieben wurden (ISO-Text); null = noch nicht — alles wie vor Nr. 116. */
  gruendungFestAm: string | null
  /**
   * Stichtag „Hofpreis-Modell ab“ (Register N38, Nr. 197) als ISO-Zeitpunkt;
   * null = Vorgabe `BAR_SERVICEGEBUEHR_AB` (konditionen.ts). Gelesen über
   * `hofpreisEinstellungAus`, gerechnet nur in plattformgebuehr.ts.
   */
  hofpreisModellAb: string | null
  /** Wer zuletzt gespeichert hat; null = noch nie (Seed-Zeile der Migration). */
  geaendertVonUserId: string | null
  /** Zeitpunkt der letzten Änderung als ISO-Text; null ohne Zeile. */
  geaendertAm: string | null
}

/** Ohne Zeile: die Standardwerte der Spalten — dieselben Zahlen wie die Konstanten. */
export const PLATTFORM_EINSTELLUNG_STANDARD: PlattformEinstellung = {
  gruendungPlaetze: MAX_GRUENDUNGSHOEFE,
  gruendungBisTag: GRUENDUNG_BIS_STANDARD_TAG,
  gruendungAnzeige: true,
  gruendungMonate: GRUENDUNG_MONATE_STANDARD,
  gruendungAktionBisTag: null,
  gruendungFestAm: null,
  hofpreisModellAb: null,
  geaendertVonUserId: null,
  geaendertAm: null,
}

/** Die Spalten, die `plattformEinstellungAus` braucht — EIN Select für alle Leser. */
export const PLATTFORM_EINSTELLUNG_SELECT = {
  gruendungPlaetze: true,
  gruendungBisStandard: true,
  gruendungAnzeige: true,
  gruendungMonate: true,
  gruendungAktionBis: true,
  gruendungFestAm: true,
  hofpreisModellAb: true,
  geaendertVonUserId: true,
  updatedAt: true,
} as const

/** Die Zeile aus der Datenbank → die Form der Seiten (Datum als Wiener Kalendertag). */
export function plattformEinstellungAus(zeile: {
  gruendungPlaetze: number
  gruendungBisStandard: Date
  gruendungAnzeige: boolean
  gruendungMonate: number
  gruendungAktionBis: Date | null
  gruendungFestAm: Date | null
  hofpreisModellAb: Date | null
  geaendertVonUserId: string | null
  updatedAt: Date
}): PlattformEinstellung {
  return {
    gruendungPlaetze: zeile.gruendungPlaetze,
    gruendungBisTag: kalendertagInWien(zeile.gruendungBisStandard),
    gruendungAnzeige: zeile.gruendungAnzeige,
    gruendungMonate: zeile.gruendungMonate,
    gruendungAktionBisTag: zeile.gruendungAktionBis ? kalendertagInWien(zeile.gruendungAktionBis) : null,
    gruendungFestAm: zeile.gruendungFestAm ? zeile.gruendungFestAm.toISOString() : null,
    hofpreisModellAb: zeile.hofpreisModellAb ? zeile.hofpreisModellAb.toISOString() : null,
    geaendertVonUserId: zeile.geaendertVonUserId,
    geaendertAm: zeile.updatedAt.toISOString(),
  }
}

/** Was plattformgebuehr.ts braucht (N38): der Stichtag als Date oder null. */
export function hofpreisEinstellungAus(einstellung: Pick<PlattformEinstellung, 'hofpreisModellAb'>): HofpreisEinstellung {
  return { hofpreisModellAb: einstellung.hofpreisModellAb ? new Date(einstellung.hofpreisModellAb) : null }
}

/** Was die Fachregeln in gruendungshof.ts brauchen. */
export function gruendungEinstellungAus(einstellung: PlattformEinstellung): GruendungEinstellung {
  return {
    plaetze: einstellung.gruendungPlaetze,
    bis: bildeGruendungBis(einstellung.gruendungBisTag),
    anzeige: einstellung.gruendungAnzeige,
    monate: einstellung.gruendungMonate,
    aktionBisTag: einstellung.gruendungAktionBisTag,
    festAm: einstellung.gruendungFestAm ? new Date(einstellung.gruendungFestAm) : null,
  }
}

// ─── Prüfen ──────────────────────────────────────────────────────────────────

/** Obergrenze des Felds „Plätze gesamt" — nur gegen Tippfehler, keine Fachregel. */
export const GRUENDUNG_PLAETZE_MAX = 999

/** Obergrenze des Felds „Monate“ — nur gegen Tippfehler (zehn Jahre), keine Fachregel. */
export const GRUENDUNG_MONATE_MAX = 120

/** Die festen Sätze der Gruppe Gründungshöfe (Freigabe §18, Nr. 93; §21, Nr. 116). */
export const GRUENDUNG_EINSTELLUNG_FEHLER = {
  weniger: (vergeben: number): string =>
    `Weniger Plätze als vergeben geht nicht – ${vergeben} ${vergeben === 1 ? 'ist' : 'sind'} schon vergeben. Trag mindestens ${vergeben} ein.`,
  plaetze: `Trag bei „Plätze gesamt“ eine ganze Zahl von 0 bis ${GRUENDUNG_PLAETZE_MAX} ein.`,
  plaetzeNurMehr: (bisher: number): string => `Plätze lassen sich nur erhöhen – gerade sind es ${bisher}.`,
  monate: `Trag bei „Monate“ eine ganze Zahl von 1 bis ${GRUENDUNG_MONATE_MAX} ein.`,
  monateNurMehr: (bisher: number): string => `Die Monate lassen sich nur erhöhen – gerade sind es ${bisher}.`,
  monateVorbei: 'Die Aktion ist vorbei – mehr Monate gehen nur, solange sie läuft.',
  datum: 'Wähle den letzten Tag der Aktion.',
  vergangen: 'Dieser Tag ist schon vorbei. Wähle heute oder einen späteren Tag.',
  /** Wortlaut der Freigabe (§21, Nr. 116, Punkt 5). */
  nieNachHinten: 'Nie nach hinten schieben – sonst ist die Werbung irreführend.',
  ungueltig: 'Wir konnten die Eingabe nicht lesen. Lade die Seite neu und versuch es noch einmal.',
} as const

/** Eine Eingabe der Gruppe Gründungshöfe, wie Formular und Action sie prüfen. `aktionBisTag` leer = ohne Stichtag. */
export type GruendungEingabe = { plaetze: number; monate: number; aktionBisTag: string | null; anzeige: boolean }

/** Ein gültiger Kalendertag JJJJ-MM-TT? Die Form allein ließe den 30. Februar durch. */
function istKalendertag(tag: string): boolean {
  const mitternacht = /^\d{4}-\d{2}-\d{2}$/.test(tag) ? wienerMitternacht(tag) : null
  return mitternacht !== null && kalendertagInWien(mitternacht) === tag
}

/**
 * Die Regeln der Gruppe Gründungshöfe (Register K2, Änderung Nr. 116) gegen
 * den gespeicherten Stand (`bisher`, in der Action nach der Sperre gelesen)
 * und die vergebenen Plätze: Plätze nur erhöhen, nie unter die vergebenen
 * (wer einen Platz hat, behält ihn — K1); Monate nur erhöhen, und mehr nur,
 * solange die Aktion nicht vorbei ist (sie gelten nur für künftige Zusagen);
 * „Aktion bis“ einmal gesetzt nur noch früher (nie leer, nie später) und nie
 * vor dem heutigen WIENER Tag. Zurück kommt der erste verletzte Satz oder null.
 */
export function pruefeGruendungEingabe(eingabe: GruendungEingabe, bisher: GruendungEinstellung, vergeben: number, jetzt: Date): string | null {
  if (!Number.isInteger(eingabe.plaetze) || eingabe.plaetze < 0 || eingabe.plaetze > GRUENDUNG_PLAETZE_MAX) {
    return GRUENDUNG_EINSTELLUNG_FEHLER.plaetze
  }
  if (eingabe.plaetze < vergeben) return GRUENDUNG_EINSTELLUNG_FEHLER.weniger(vergeben)
  if (eingabe.plaetze < bisher.plaetze) return GRUENDUNG_EINSTELLUNG_FEHLER.plaetzeNurMehr(bisher.plaetze)
  if (!Number.isInteger(eingabe.monate) || eingabe.monate < 1 || eingabe.monate > GRUENDUNG_MONATE_MAX) return GRUENDUNG_EINSTELLUNG_FEHLER.monate
  if (eingabe.monate < bisher.monate) return GRUENDUNG_EINSTELLUNG_FEHLER.monateNurMehr(bisher.monate)

  if (eingabe.aktionBisTag !== bisher.aktionBisTag) {
    if (eingabe.aktionBisTag === null) return GRUENDUNG_EINSTELLUNG_FEHLER.nieNachHinten
    if (!istKalendertag(eingabe.aktionBisTag)) return GRUENDUNG_EINSTELLUNG_FEHLER.datum
    if (bisher.aktionBisTag !== null && eingabe.aktionBisTag > bisher.aktionBisTag) return GRUENDUNG_EINSTELLUNG_FEHLER.nieNachHinten
    // JJJJ-MM-TT vergleicht sich als Text wie als Datum.
    if (eingabe.aktionBisTag < kalendertagInWien(jetzt)) return GRUENDUNG_EINSTELLUNG_FEHLER.vergangen
  }

  // Mehr Monate nur, solange die Aktion nicht vorbei ist — mit den neuen Plätzen und dem neuen Stichtag gerechnet.
  const danach: GruendungEinstellung = { ...bisher, plaetze: eingabe.plaetze, aktionBisTag: eingabe.aktionBisTag }
  if (eingabe.monate > bisher.monate && bisher.festAm !== null && !aktionLaeuft(jetzt, danach, vergeben)) {
    return GRUENDUNG_EINSTELLUNG_FEHLER.monateVorbei
  }
  return null
}

// ─── Texte der Seite ─────────────────────────────────────────────────────────

/**
 * Die Gruppen (Register N15: Gründungshöfe · Plattform). Die Gruppe „Betrieb“
 * entfiel mit Nr. 103 (N15 geändert): Der Stripe-Modus steht in Admin ›
 * Betrieb, `?gruppe=betrieb` leitet dorthin um (src/app/admin/einstellungen/page.tsx).
 */
// „Anmeldung" (Register N20, Nr. 115) ist eine eigene Seite: /admin/einstellungen/anmeldung.
// „Team“ (Register N35, Nr. 190) nur für Inhaber — die Seite blendet die Gruppe sonst aus.
// „Benachrichtigungen“ seit Nr. 193 (N32): die Zustellung aus dem Postfach — dieselben Teile.
export const EINSTELLUNGEN_GRUPPEN = ['gruendung', 'team', 'benachrichtigungen', 'plattform', 'anmeldung'] as const
export type EinstellungenGruppe = (typeof EINSTELLUNGEN_GRUPPEN)[number]

export const ADMIN_EINSTELLUNGEN_HREF = '/admin/einstellungen'

/** Der Weg zu einer Gruppe — die erste ohne Abfrage. */
export function einstellungenGruppeHref(gruppe: EinstellungenGruppe): string {
  if (gruppe === 'anmeldung') return `${ADMIN_EINSTELLUNGEN_HREF}/anmeldung`
  return gruppe === 'gruendung' ? ADMIN_EINSTELLUNGEN_HREF : `${ADMIN_EINSTELLUNGEN_HREF}?gruppe=${gruppe}`
}

/** Alle Sätze von Admin › Einstellungen — EINE Quelle (Mockups admin-einstellungen, admin-mobil-einstellungen). */
export const EINSTELLUNGEN_TEXT = {
  titel: 'Einstellungen',
  satz: 'Was die Plattform als Ganzes betrifft – in Gruppen, jede mit eigenem Speichern. Änderungen gelten sofort.',
  satzKurz: 'Gruppen, jede mit eigenem Speichern.',
  navigation: 'Gruppen der Einstellungen',
  ladefehler: 'Wir konnten die Einstellungen gerade nicht laden.',
  gruppe: {
    gruendung: { titel: 'Gründungshöfe', zeile: 'Plätze, Monate, Aktion, Anzeige' },
    team: { titel: 'Team und Rechte', zeile: 'Personen, Rechte, Notfallzugang' },
    benachrichtigungen: { titel: 'Benachrichtigungen', zeile: 'Wer welche Mails des Betriebs bekommt' },
    plattform: { titel: 'Plattform', zeile: 'Name und Adresse' },
    anmeldung: { titel: 'Anmeldung', zeile: 'Passkeys, Ersatzcodes, Geräte', satz: 'Deine Passkeys, Ersatzcodes und angemeldeten Geräte.', link: 'Anmeldung öffnen' },
  },
  gruendung: {
    register: 'Register K2',
    satz: 'Wie viele Höfe ohne Grundgebühr starten dürfen, wie lange und bis wann die Aktion läuft.',
    kachelPlaetze: 'Plätze gesamt',
    kachelVergeben: 'Vergeben',
    kachelVergebenZeile: 'nach Reihenfolge der Freischaltung',
    /** Nach dem Festschreiben (Nr. 116): die Nummern stehen je Hof fest. */
    kachelVergebenFest: 'festgeschrieben, Nummer je Hof',
    /** Register K2, Nr. 109: ausgenommene Höfe zählen nicht mit, die Kachel nennt sie. */
    kachelVergebenAusgenommen: (ausgenommen: number): string => `nach Reihenfolge der Freischaltung · ${ausgenommen} ausgenommen`,
    kachelFrei: 'Frei',
    kachelFreiZeile: 'steht im Satz auf den Seiten',
    feldPlaetze: 'Plätze gesamt',
    feldPlaetzeZeile: 'nur erhöhen, nie unter die vergebenen',
    feldMonate: 'Monate ohne Grundgebühr',
    feldMonateZeile: 'nur erhöhen; gilt nur für künftige Zusagen',
    feldAktionBis: 'Aktion bis',
    feldAktionBisZeile: 'leer = ohne Stichtag; einmal gesetzt nur noch früher',
    /** Das Standard-Ende von vor Nr. 116 — nur noch für die Übernahme beim Festschreiben, nicht änderbar. */
    feldBis: 'Bisheriges Standard-Ende',
    feldGesperrt: 'fest',
    schalter: 'Auf den Seiten zeigen',
    schalterSatz:
      'Startseite (Satz im Für-Höfe-Band), /fuer-hoefe (Pill, Knopf, Preiszeile) und Registrieren (Satz). Steuert nur die Sätze, nie die Vergabe. Verschwindet von selbst, wenn alle Plätze vergeben sind oder die Aktion vorbei ist.',
    aufDenSeiten: 'So steht es auf den Seiten',
    aufDenSeitenLeer: 'Auf den Seiten steht gerade nichts – die Anzeige ist aus, alle Plätze sind vergeben oder die Aktion ist vorbei.',
    regel:
      'Weniger Plätze als vergeben geht nicht – wer einen Platz hat, behält ihn. Ein anderes Ende für einen einzelnen Hof: Höfe › „Gründungshof bis“ (dort steht dann „abweichend“).',
    /** Zusagen festschreiben (Register K2, Änderung Nr. 116) — heikle Aktion, nur solange noch nicht festgeschrieben. */
    festschreiben: 'Zusagen festschreiben …',
    festschreibenSatz:
      'Schreibt Platz und Ende für jeden freigeschalteten Hof fest – auch für stillgelegte. Danach vergibt jede Freischaltung die kleinste freie Nummer, solange die Aktion läuft.',
    festschreibenTitel: 'Zusagen festschreiben?',
    festschreibenDialog: (anzahl: number): string =>
      `${anzahl} ${anzahl === 1 ? 'Hof bekommt' : 'Höfe bekommen'} Platz und Ende fest. Das Ende ist nie früher als bisher. Das geht nur einmal.`,
    festschreibenLeer: 'Bisher ist kein Hof freigeschaltet. Festgeschrieben wird trotzdem – ab dann zählt jede Freischaltung.',
    /** Leere Liste, aber freigeschaltete Höfe sind ausgenommen (Nr. 119) — „kein Hof freigeschaltet“ wäre dann falsch. */
    festschreibenAlleAusgenommen: 'Alle freigeschalteten Höfe sind ausgenommen. Festgeschrieben wird trotzdem – ab dann zählt jede Freischaltung.',
    festschreibenSpalten: { hof: 'Hof', nummer: 'Nr.', ende: 'Ende bisher → neu' },
    festschreibenOhne: 'keine Zusage',
    festschreibenStillgelegt: 'stillgelegt',
    festschreibenKnopf: 'Festschreiben',
    festschreibenAbbrechen: 'Abbrechen',
    festschreibenFertig: 'Die Zusagen sind festgeschrieben.',
    festgeschrieben: (am: string): string => `Zusagen festgeschrieben am ${am}.`,
    festschreibenSchon: 'Die Zusagen sind schon festgeschrieben. Lade die Seite neu.',
    festschreibenPlaetze: (noetig: number): string =>
      `Erhöhe zuerst die Plätze auf mindestens ${noetig} – sonst verlöre ein Hof, der heute einen Platz hat, seine Zusage.`,
    festschreibenFehler: 'Wir konnten die Zusagen nicht festschreiben. Lade die Seite neu und versuch es noch einmal.',
    verwerfen: 'Verwerfen',
    speichern: 'Speichern',
    speichert: 'Wird gespeichert …',
    gespeichert: 'Gespeichert. Die Seiten zeigen die neuen Zahlen.',
  },
  plattform: {
    satz: 'Nur zum Nachsehen: Name und Adresse stehen an einer Stelle im Code (Register M1).',
    name: 'Name',
    adresse: 'Adresse',
  },
  /** Die Protokollzeile je Gruppe (N15): die letzte Änderung, kein Verlauf (S12 kommt nicht in diesem Lauf). */
  protokoll: (person: string, am: string): string => `Zuletzt geändert von ${person} am ${am}`,
  protokollUnbekannt: 'einem gelöschten Konto',
  protokollNie: 'Noch nie geändert – es gelten die Standardwerte.',
} as const

/** Name und Adresse der Gruppe Plattform — aus den EINEN Stellen (Register M1). */
export const PLATTFORM_ANGABEN = { name: MARKE, adresse: PRODUKTION_HOST } as const

// Datum und Uhrzeit in Wien, wie die Protokollzeile sie schreibt („12.10.2026, 21:14").
const PROTOKOLL_FORMAT = new Intl.DateTimeFormat('de-AT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Vienna',
})

/** Die Protokollzeile der Gruppe Gründungshöfe — fertig als Text. */
export function protokollZeile(einstellung: PlattformEinstellung, personName: string | null): string {
  if (einstellung.geaendertVonUserId === null || einstellung.geaendertAm === null) return EINSTELLUNGEN_TEXT.protokollNie
  return EINSTELLUNGEN_TEXT.protokoll(personName ?? EINSTELLUNGEN_TEXT.protokollUnbekannt, PROTOKOLL_FORMAT.format(new Date(einstellung.geaendertAm)))
}

/** „Zusagen festgeschrieben am 19.10.2026, 21:14.“ — null, solange nicht festgeschrieben (Nr. 116). */
export function festgeschriebenZeile(einstellung: PlattformEinstellung): string | null {
  return einstellung.gruendungFestAm === null ? null : EINSTELLUNGEN_TEXT.gruendung.festgeschrieben(PROTOKOLL_FORMAT.format(new Date(einstellung.gruendungFestAm)))
}

/**
 * „12 Plätze · 5 frei · bis 31.12.2027" — die Zeile der zugeklappten Gruppe am
 * Handy; in der Aktion (Nr. 116) mit Monaten und Stichtag statt des Standard-Endes.
 */
export function gruendungZeileKurz(zahlen: Pick<GruendungZahlen, 'gesamt' | 'frei' | 'bisTag' | 'art' | 'monate' | 'aktionBisTag'>): string {
  const anfang = `${zahlen.gesamt} Plätze · ${zahlen.frei} frei`
  if (zahlen.art === 'bisher') return `${anfang} · bis ${gruendungTagKurz(zahlen.bisTag)}`
  return `${anfang} · ${zahlen.monate} Monate${zahlen.aktionBisTag ? ` · bis ${gruendungTagKurz(zahlen.aktionBisTag)}` : ''}`
}

// ─── Stichtag „Hofpreis-Modell ab“ (Register N38, Nr. 197) ──────────────────

/** Die Texte der Karte in Admin › Einstellungen. */
export const HOFPREIS_STICHTAG_TEXT = {
  titel: 'Hofpreis-Modell ab',
  satz: 'Ab diesem Tag gilt für neue Bestellungen die Plattformgebühr im Hofpreis (6 %, Mindestbestellwert 10 €). Vorher bleibt alles wie heute.',
  feld: 'Stichtag',
  speichern: 'Stichtag speichern',
  speichert: 'Speichert …',
  gespeichert: 'Stichtag gespeichert.',
  erreicht: 'Der Stichtag ist erreicht – er lässt sich nicht mehr ändern.',
} as const

/** Die Meldungen der Regel — eigene deutsche Sätze, nie Zods Standardtext. */
export const HOFPREIS_STICHTAG_FEHLER = {
  datum: 'Bitte gib ein gültiges Datum ein.',
  zukunft: 'Der Stichtag muss in der Zukunft liegen.',
  erreicht: 'Der Stichtag ist schon erreicht und lässt sich nicht mehr ändern.',
  gleich: 'Das ist schon der gespeicherte Stichtag.',
} as const

/** Der wirksame Stichtag als Wiener Kalendertag (JJJJ-MM-TT) — Einstellung, sonst BAR_SERVICEGEBUEHR_AB. */
export function hofpreisStichtagTag(einstellung: HofpreisEinstellung): string {
  return kalendertagInWien(hofpreisModellAb(einstellung))
}

/**
 * Die Regel des Stichtags (Freigabe 197, Punkt 6) — dieselbe reine Funktion
 * für Formular und Action: Ändern nur, solange der wirksame Stichtag noch
 * nicht erreicht ist, und der neue Tag (Wiener Mitternacht) liegt in der
 * Zukunft. null = in Ordnung, sonst der Satz.
 */
export function pruefeHofpreisStichtag(neuTag: string, bisher: HofpreisEinstellung, jetzt: Date): string | null {
  if (hofpreisModellAb(bisher).getTime() <= jetzt.getTime()) return HOFPREIS_STICHTAG_FEHLER.erreicht
  const neu = /^\d{4}-\d{2}-\d{2}$/.test(neuTag) ? wienerMitternacht(neuTag) : null
  if (!neu) return HOFPREIS_STICHTAG_FEHLER.datum
  if (neu.getTime() <= jetzt.getTime()) return HOFPREIS_STICHTAG_FEHLER.zukunft
  if (neu.getTime() === hofpreisModellAb(bisher).getTime()) return HOFPREIS_STICHTAG_FEHLER.gleich
  return null
}
