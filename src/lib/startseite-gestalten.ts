/**
 * Startseite gestalten (Register N16, Nachtlauf Nr. 96) — die Regeln, rein und
 * ohne Datenbank prüfbar (tests/startseite-gestalten.test.ts): welche
 * Abschnitte es gibt und welche fest sind, welche Reihenfolge gilt, wann ein
 * Block live ist, wie eine Eingabe in Wiener Zeit zum Zeitpunkt wird und was
 * die Seite am Ende rendert.
 *
 * Kein Import aus Datenbank oder Umgebung: Das Admin-Formular (Browser) nimmt
 * dieselben Grenzen und Regeln wie Action und Seite.
 */
import type { ProductCategory, StartseiteArt, StartseiteVorlage } from '@prisma/client'
import { kalendertagInWien } from '@/lib/wiener-tag'
import { tagVersetzt } from '@/lib/kalender'
import { uhrzeitInWien, wienerZeitpunkt } from '@/lib/fristen'
import { formatTagKurz } from '@/lib/format'

/** Das Etikett des Datencaches der Startseite — Veröffentlichen in Admin › Startseite leert es (Nr. 99: nie das Speichern des Entwurfs). */
export const STARTSEITE_CACHE_TAG = 'startseite'

/** Ein Abschnitt, der eine bestehende Komponente der Startseite rendert (alles außer BLOCK). */
export type AbschnittArt = Exclude<StartseiteArt, 'BLOCK'>

/**
 * Die heutige Reihenfolge — dieselbe, die die Migration als Seed des Entwurfs
 * anlegt. Ohne Fassung (Nr. 99: kein Seed der Fassungen), mit einer
 * unlesbaren oder bei einem Lesefehler rendert die Seite sie.
 */
export const STANDARD_REIHENFOLGE: readonly AbschnittArt[] = [
  'KOPF',
  'HOEFE',
  'FUTTER',
  'BRENNMATERIAL',
  'SO_FUNKTIONIERTS',
  'FUER_HOEFE',
  'FRAGEN',
  'FUSS',
]

/** Fest: immer sichtbar, nicht verschiebbar (KOPF zuerst, HOEFE direkt danach, FUSS zuletzt). */
export const FESTE_ARTEN: readonly AbschnittArt[] = ['KOPF', 'HOEFE', 'FUSS']

export function istFest(art: StartseiteArt): boolean {
  return (FESTE_ARTEN as readonly StartseiteArt[]).includes(art)
}

/** Wie Admin › Startseite einen Abschnitt nennt (Mockup admin-startseite-gestalten). */
export const ABSCHNITT_TEXT: Record<AbschnittArt, { titel: string; satz: string }> = {
  KOPF: { titel: 'Kopf mit Suche', satz: 'Titel, Suchfeld, Karte der Region' },
  HOEFE: { titel: 'Höfe in deiner Nähe', satz: 'Hofkarten und Suche' },
  FUTTER: { titel: 'Futter für Pferd, Hase & Co.', satz: 'Einstieg Futtermittel' },
  BRENNMATERIAL: { titel: 'Brennmaterial', satz: 'nur Oktober bis März' },
  SO_FUNKTIONIERTS: { titel: 'So funktioniert’s', satz: 'drei Schritte, Rechenbeispiel' },
  FUER_HOEFE: { titel: 'Für Höfe', satz: 'Band mit Registrieren' },
  FRAGEN: { titel: 'Fragen', satz: 'häufige Fragen' },
  FUSS: { titel: 'Fuß', satz: 'Links, Rechtliches' },
}

// ─── Vorlagen und Grenzen ───────────────────────────────────────────────────

/** Die vier Vorlagen (components/startseite/bloecke) — neue nur über einen Lauf. */
export const VORLAGEN = ['SAISONKARTE', 'HINWEISBAND', 'HOEFE_AUSWAHL', 'KATEGORIE_HINWEIS'] as const satisfies readonly StartseiteVorlage[]

export const VORLAGE_TEXT: Record<StartseiteVorlage, { titel: string; satz: string }> = {
  SAISONKARTE: { titel: 'Saisonkarte mit Bild', satz: 'Überzeile, Titel, Text, Bild, Link – z. B. Ostern, Erntezeit' },
  HINWEISBAND: { titel: 'Hinweisband', satz: 'Ein Satz über die ganze Breite – z. B. Winterpause' },
  HOEFE_AUSWAHL: { titel: 'Höfe-Auswahl', satz: 'Bis zu 3 Höfe mit Karte – z. B. „Brennholz jetzt“' },
  KATEGORIE_HINWEIS: { titel: 'Kategorie-Hinweis', satz: 'Eine Kategorie mit Illustration und Link auf Entdecken' },
}

export const UEBERZEILE_MAX = 24
export const TITEL_MAX = 60
export const TEXT_MAX = 160
export const LINK_TEXT_MAX = 40
export const LINK_MAX = 200
export const HOEFE_AUSWAHL_MAX = 3

/** Ohne eigenen Linktext steht dieser am Link eines Blocks. */
export const LINK_TEXT_STANDARD = 'Mehr ansehen'

/**
 * Nur die Felder, die zur Vorlage gehören: Höfe nur bei der Höfe-Auswahl, die
 * Kategorie nur beim Kategorie-Hinweis, das Bild nur bei der Saisonkarte, das
 * Hinweisband ist ein Satz (nur Titel und Link), ein Linktext nur mit Link —
 * ein Wechsel der Vorlage lässt keine unsichtbaren Reste stehen. EINE Regel
 * für die Action (was gespeichert wird) und den Entwurf im Browser (womit
 * „Was sich gegenüber live ändert“ vergleicht).
 */
export function felderDerVorlage<
  T extends {
    vorlage: StartseiteVorlage
    ueberzeile: string | null
    text: string | null
    bildUrl: string | null
    linkUrl: string | null
    linkText: string | null
    farmIds: string[]
    kategorie: ProductCategory | null
  },
>(b: T): T {
  return {
    ...b,
    ueberzeile: b.vorlage === 'HINWEISBAND' ? null : b.ueberzeile,
    text: b.vorlage === 'HINWEISBAND' ? null : b.text,
    bildUrl: b.vorlage === 'SAISONKARTE' ? b.bildUrl : null,
    linkText: b.linkUrl ? b.linkText : null,
    farmIds: b.vorlage === 'HOEFE_AUSWAHL' ? b.farmIds : [],
    kategorie: b.vorlage === 'KATEGORIE_HINWEIS' ? b.kategorie : null,
  }
}

/** Die Kennung, unter der ein noch nicht gespeicherter Block in der Reihenfolge steht. */
export const NEUER_BLOCK = 'neu'

/**
 * Ein Link-Ziel nur relativ zur eigenen Seite: beginnt mit „/", nirgends „//"
 * und kein „\" — „//fremd.example" und „/\fremd.example" öffnet der Browser
 * als fremde Adresse; „//" mitten im Link (Nr. 99, Nacharbeit 96) braucht
 * kein eigener Pfad. Kein Leerraum, keine Steuerzeichen.
 */
export function istRelativerLink(wert: string): boolean {
  return wert.length <= LINK_MAX && !wert.includes('//') && /^\/[^\s\\\u0000-\u001f\u007f]*$/.test(wert)
}

// ─── Reihenfolge ────────────────────────────────────────────────────────────

export type ListenEintrag = { art: StartseiteArt; sichtbar: boolean }

export type ReihenfolgeFehler =
  | 'abschnitt-fehlt'
  | 'abschnitt-doppelt'
  | 'kopf-nicht-oben'
  | 'fuss-nicht-unten'
  | 'hoefe-nicht-unter-kopf'
  | 'fest-ausgeblendet'

/** Der Satz zu einem Fehler — für Action und Formular derselbe. */
export const REIHENFOLGE_FEHLER_TEXT: Record<ReihenfolgeFehler, string> = {
  'abschnitt-fehlt': 'Ein Abschnitt der Startseite fehlt. Lade die Seite neu und versuch es noch einmal.',
  'abschnitt-doppelt': 'Ein Abschnitt steht doppelt in der Liste. Lade die Seite neu und versuch es noch einmal.',
  'kopf-nicht-oben': 'Der Kopf mit Suche bleibt immer ganz oben.',
  'fuss-nicht-unten': 'Der Fuß bleibt immer ganz unten.',
  'hoefe-nicht-unter-kopf': '„Höfe in deiner Nähe“ bleibt direkt unter dem Kopf – nur Blöcke dürfen dazwischen.',
  'fest-ausgeblendet': 'Kopf, Höfe und Fuß lassen sich nicht ausblenden.',
}

/**
 * Prüft eine ganze Liste: jeder Abschnitt genau einmal, KOPF zuerst, FUSS
 * zuletzt, HOEFE als erster Abschnitt nach dem KOPF (Blöcke dürfen dazwischen,
 * Mockup admin-startseite-gestalten), die festen sichtbar. Der Server prüft
 * damit jedes Speichern — nicht nur das Formular.
 */
export function pruefeReihenfolge(liste: readonly ListenEintrag[]): ReihenfolgeFehler | null {
  const abschnitte = liste.filter((e) => e.art !== 'BLOCK')
  for (const art of STANDARD_REIHENFOLGE) {
    const anzahl = abschnitte.filter((e) => e.art === art).length
    if (anzahl === 0) return 'abschnitt-fehlt'
    if (anzahl > 1) return 'abschnitt-doppelt'
  }
  if (liste[0]?.art !== 'KOPF') return 'kopf-nicht-oben'
  if (liste[liste.length - 1]?.art !== 'FUSS') return 'fuss-nicht-unten'
  if (abschnitte[1]?.art !== 'HOEFE') return 'hoefe-nicht-unter-kopf'
  if (liste.some((e) => istFest(e.art) && !e.sichtbar)) return 'fest-ausgeblendet'
  return null
}

/** Die Liste mit dem Eintrag an `index` um einen Platz nach oben (-1) oder unten (1). */
export function verschiebe<T>(liste: readonly T[], index: number, richtung: -1 | 1): T[] {
  const ziel = index + richtung
  if (index < 0 || index >= liste.length || ziel < 0 || ziel >= liste.length) return [...liste]
  const neu = [...liste]
  ;[neu[index], neu[ziel]] = [neu[ziel], neu[index]]
  return neu
}

/** Darf der Eintrag an `index` einen Platz nach oben bzw. unten? Feste nie, sonst nur in eine gültige Liste. */
export function darfVerschieben(liste: readonly ListenEintrag[], index: number, richtung: -1 | 1): boolean {
  const eintrag = liste[index]
  if (!eintrag || istFest(eintrag.art)) return false
  const ziel = index + richtung
  if (ziel < 0 || ziel >= liste.length) return false
  return pruefeReihenfolge(verschiebe(liste, index, richtung)) === null
}

// ─── Zeitraum ───────────────────────────────────────────────────────────────

export type Zeitraum = { liveAb: Date; liveBis: Date | null }

/** Live, wenn liveAb ≤ jetzt < liveBis; ohne liveBis offen. Verglichen wird nur am Server. */
export function istLive(block: Zeitraum, jetzt: Date): boolean {
  const t = jetzt.getTime()
  return block.liveAb.getTime() <= t && (block.liveBis === null || t < block.liveBis.getTime())
}

export type BlockZustand = 'live' | 'geplant' | 'beendet'

export function blockZustand(block: Zeitraum, jetzt: Date): BlockZustand {
  if (istLive(block, jetzt)) return 'live'
  return block.liveAb.getTime() > jetzt.getTime() ? 'geplant' : 'beendet'
}

export const BLOCK_ZUSTAND_TEXT: Record<BlockZustand, string> = { live: 'Live', geplant: 'Geplant', beendet: 'Beendet' }

/**
 * Kalendertag (JJJJ-MM-TT) und Uhrzeit (HH:MM) aus dem Formular, Wiener Zeit
 * → Zeitpunkt (über wienerZeitpunkt aus fristen.ts). Eine Uhrzeit, die es an
 * dem Tag nicht gibt (Ende März 02:00–02:59), ist null: Der Rundweg über die
 * Wiener Uhrzeit trifft sie nicht — sonst stünde im Block eine andere Zeit als
 * eingegeben.
 */
export function zeitpunktAusEingabe(tag: string, uhrzeit: string): Date | null {
  const zeitpunkt = wienerZeitpunkt(tag, uhrzeit)
  return zeitpunkt && uhrzeitInWien(zeitpunkt) === uhrzeit ? zeitpunkt : null
}

/** Ein Zeitpunkt → Tag und Uhrzeit in Wien, wie sie im Formular stehen. */
export function wienerEingabe(zeitpunkt: Date): { tag: string; uhrzeit: string } {
  return { tag: kalendertagInWien(zeitpunkt), uhrzeit: uhrzeitInWien(zeitpunkt) }
}

/** „Fr, 27. März 2027" — der Stand einer Vorschau, Wiener Tag. */
export function standText(zeitpunkt: Date): string {
  const tag = kalendertagInWien(zeitpunkt)
  return `${formatTagKurz(tag)} ${tag.slice(0, 4)}`
}

/** „26. März → 6. Apr. 2027" in der Liste: Tag und Monat kurz, ohne „bis" offen. */
export function zeitraumText(block: Zeitraum): string {
  const ab = formatTagKurz(kalendertagInWien(block.liveAb))
  if (!block.liveBis) return `ab ${ab}`
  return `${ab} → ${formatTagKurz(kalendertagInWien(block.liveBis))}`
}

export type StandWahl = 'heute' | 'woche' | 'block' | 'termin'

export const STAND_TEXT: Record<StandWahl, string> = { heute: 'Heute', woche: '+1 Woche', block: 'nächster Block', termin: 'geplanter Termin' }

/**
 * Die Tage der Vorschau („Stand am"): heute, in einer Woche (derselbe Wiener
 * Tag + 7, gleiche Uhrzeit), der Beginn des nächsten geplanten Blocks und
 * (Nr. 99) der Termin der nächsten geplanten Fassung — null, wenn es keinen
 * gibt.
 */
export function standZeitpunkt(wahl: StandWahl, jetzt: Date, bloecke: readonly Zeitraum[], termin: Date | null = null): Date | null {
  if (wahl === 'heute') return jetzt
  if (wahl === 'termin') return termin
  if (wahl === 'woche') {
    const { tag, uhrzeit } = wienerEingabe(jetzt)
    return zeitpunktAusEingabe(tagVersetzt(tag, 7), uhrzeit) ?? new Date(jetzt.getTime() + 7 * 24 * 60 * 60_000)
  }
  const kuenftige = bloecke.map((b) => b.liveAb.getTime()).filter((t) => t > jetzt.getTime())
  return kuenftige.length > 0 ? new Date(Math.min(...kuenftige)) : null
}

// ─── Was die Seite rendert ──────────────────────────────────────────────────

/** Ein Block, wie die Seite ihn bekommt — ohne Date (aus dem Datencache kommen Texte). */
export type StartseitenBlockDaten = {
  id: string
  vorlage: StartseiteVorlage
  ueberzeile: string | null
  titel: string
  text: string | null
  bildUrl: string | null
  linkUrl: string | null
  linkText: string | null
  /** Die Slugs der gewählten Höfe, in der gewählten Reihenfolge. */
  hofSlugs: string[]
  kategorie: ProductCategory | null
  liveAb: string
  liveBis: string | null
}

export type StartseitenZeile =
  | { art: AbschnittArt; sichtbar: boolean }
  | { art: 'BLOCK'; sichtbar: boolean; block: StartseitenBlockDaten }

export type RenderEintrag = { art: AbschnittArt } | { art: 'BLOCK'; block: StartseitenBlockDaten }

/** Die heutige Reihenfolge als Zeilen — der Rückfall ohne Datenbank. */
export function standardZeilen(): StartseitenZeile[] {
  return STANDARD_REIHENFOLGE.map((art) => ({ art, sichtbar: true }))
}

/**
 * Was die Seite in welcher Reihenfolge rendert: nur sichtbare Zeilen,
 * Brennmaterial nur in der Saison (die Automatik gilt zusätzlich zum Auge),
 * Blöcke nur im Zeitraum — außer dem Block in Bearbeitung der Vorschau. Eine
 * kaputte Liste (ein fester Abschnitt fehlt, steht falsch oder ist aus) fällt
 * auf die heutige Reihenfolge zurück: Die Startseite zeigt nie weniger als
 * Kopf, Höfe und Fuß.
 */
export function zuRendern(
  zeilen: readonly StartseitenZeile[],
  jetzt: Date,
  optionen: { brennmaterialSaison: boolean; blockEntwurfId?: string | null }
): RenderEintrag[] {
  const gueltig = zeilen.length > 0 && pruefeReihenfolge(zeilen) === null
  const liste = gueltig ? zeilen : standardZeilen()
  const ergebnis: RenderEintrag[] = []
  for (const zeile of liste) {
    if (!zeile.sichtbar) continue
    if (zeile.art === 'BLOCK') {
      const { block } = zeile
      const zeitraum = { liveAb: new Date(block.liveAb), liveBis: block.liveBis ? new Date(block.liveBis) : null }
      if (block.id === optionen.blockEntwurfId || istLive(zeitraum, jetzt)) ergebnis.push({ art: 'BLOCK', block })
      continue
    }
    if (zeile.art === 'BRENNMATERIAL' && !optionen.brennmaterialSaison) continue
    ergebnis.push({ art: zeile.art })
  }
  return ergebnis
}

// ─── Admin › Startseite ─────────────────────────────────────────────────────

export const ADMIN_STARTSEITE_HREF = '/admin/startseite'

/**
 * Die Route hinter „Vorschau öffnen": prüft Link und Admin-Sitzung, schaltet
 * den Draft Mode für DIESEN Browser ein und leitet auf die Startseite weiter —
 * so wirkt der Link auf jedem Gerät, auf dem der Admin angemeldet ist.
 */
export const ADMIN_STARTSEITE_VORSCHAU_HREF = `${ADMIN_STARTSEITE_HREF}/vorschau`

/**
 * Die Texte von Admin › Startseite (Mockups admin-startseite-gestalten,
 * admin-startseite-vorschau; seit Nr. 99 dazu admin-startseite-entwurf —
 * die Texte von Entwurf und Fassung stehen in src/lib/startseite-fassung.ts).
 */
export const ADMIN_STARTSEITE_TEXT = {
  titel: 'Startseite',
  bearbeiten: 'Bearbeiten',
  kundin: 'So sieht’s die Kundin',
  liste: 'Abschnitte',
  listeHinweis: 'Pfeile = Reihenfolge · Auge = aus/ein',
  fest: 'fest',
  automatik: 'Automatik',
  einfuegen: 'Block einfügen',
  bibliothek: 'Block einfügen · Vorlagen',
  bibliothekRegel: 'Mehr Vorlagen nur über einen Lauf – jede ist eine Komponente im Design-System, kein freies Layout.',
  blockNeu: 'Neuer Block',
  blockBearbeiten: 'Block bearbeiten',
  regel: 'Wiener Ortszeit. Ohne „bis“ bleibt der Block, bis du ihn beendest. Jede Änderung landet im Entwurf – live geht sie erst mit „Veröffentlichen …“.',
  fertig: 'Fertig',
  geloescht: 'Der Block ist aus dem Entwurf gelöscht.',
  bildHinweis: 'Quadratisch, mindestens 320 × 320 Pixel.',
  hoefeHinweis: 'Nur freigeschaltete Höfe, höchstens drei.',
  vorschauKachel: 'Vorschau',
  vorschauSatz:
    'Die echte Startseite – dein Entwurf oder die Live-Fassung – mit den Blöcken, die am gewählten Tag live wären. Höfe und Produkte sind der Stand von jetzt.',
  vorschauLinkSatz: '„Vorschau öffnen“ zeigt dieselbe Seite im Browser über einen signierten Link (nur Admin, 1 Stunde) – zum Durchtippen am eigenen Handy.',
  vorschauOeffnen: 'Vorschau öffnen',
} as const
