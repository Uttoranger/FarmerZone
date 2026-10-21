/**
 * Das Teilen-Fenster (Gate 7 Aufgabe 2; Mockups web-h4-teilen-fenster-mit-bild,
 * mobil-h4-teilen-ueber-das-telefon) — die reinen Regeln: welche Produkte
 * anfangs im Bild sind, wie die Auswahl umschaltet und wohin jeder Kanal führt.
 * Seit Nr. 67 mit Beitrag-Modus (Register T5; Mockups web-h4-beitrag-teilen,
 * mobil-h4-beitrag-teilen): Bild, Text und Link kommen aus einem
 * veröffentlichten Beitrag, die WhatsApp-Abonnentinnen sind die erste Karte.
 * Teilen legt dabei keinen Beitrag an (Teilen (d)) — es teilt einen, den es gibt.
 * Die Komponente (src/components/teilen/teilen-fenster.tsx) führt nur aus.
 */
import { TEILEN_BILD_PRODUKTE_MAX, type TeilenAuswahlEintrag } from '@/lib/teilen-bild'
import { TEILEN_PARAMETER, TEILEN_ZAEHLUNG_HINWEIS, type TeilenKanalCode } from '@/lib/teilen-kanal'
import { BEITRAG_PARAMETER } from '@/schemas/hofseite-reiter'
import { einzeiligerFremdtext } from '@/lib/fremdtext'
import { stripStatusVariables } from '@/lib/status-body'
import { BEITRAG_TEXT_MAX, BEITRAG_TITEL_MAX } from '@/lib/eingabegrenzen'
import { formatZahl } from '@/lib/format'

/** Die Druckansicht des Plakats (Gate 7 Aufgabe 3). */
export const PLAKAT_PFAD = '/status/plakat'

/** Anfangs im Bild: die ersten drei, die man kaufen kann — ausverkaufte nie. */
export function startAuswahl(auswahl: readonly TeilenAuswahlEintrag[]): string[] {
  return auswahl
    .filter((e) => !e.ausverkauft)
    .slice(0, TEILEN_BILD_PRODUKTE_MAX)
    .map((e) => e.id)
}

/**
 * Ein Produkt an- oder ausschalten. Ausverkauft bleibt aus, und mehr als drei
 * gehen nicht ins Bild — der vierte Tipp ändert nichts (die Oberfläche sagt
 * es dazu). Die Reihenfolge folgt der des Hofs.
 */
export function schalteAuswahl(
  gewaehlt: readonly string[],
  id: string,
  auswahl: readonly TeilenAuswahlEintrag[]
): string[] {
  const eintrag = auswahl.find((e) => e.id === id)
  if (!eintrag || eintrag.ausverkauft) return [...gewaehlt]
  if (gewaehlt.includes(id)) return gewaehlt.filter((g) => g !== id)
  if (gewaehlt.length >= TEILEN_BILD_PRODUKTE_MAX) return [...gewaehlt]
  const neu = new Set([...gewaehlt, id])
  return auswahl.filter((e) => neu.has(e.id)).map((e) => e.id)
}

/** Die Kanäle des Fensters in der Reihenfolge des Mockups. */
export const FENSTER_KANAELE = [
  { kanal: 'wa', label: 'WhatsApp' },
  { kanal: 'wa-status', label: 'WhatsApp-Status' },
  { kanal: 'fb', label: 'Facebook' },
  { kanal: 'ig', label: 'Instagram' },
  { kanal: 'mail', label: 'E-Mail' },
] as const satisfies readonly { kanal: TeilenKanalCode; label: string }[]

export type KanalZiel =
  /** Eine Adresse öffnen (WhatsApp, Facebook, E-Mail) — der Link steht im Text. */
  | { art: 'oeffnen'; href: string }
  /**
   * Bild + Text über das Teilen-Menü des Geräts (WhatsApp-Status, Instagram
   * haben keinen Web-Link); ohne Menü Bild speichern und Text kopieren.
   */
  | { art: 'bild'; text: string; link: string }

/**
 * Der geteilte Link mit dem Kürzel seines Kanals — dasselbe `?k=` wie
 * `teilenLink`, auch wenn der Link schon eine Abfrage trägt (Beitrag-Modus:
 * `?beitrag=<id>&k=wa`). Die Hofseite entfernt nur `k` und behält den
 * Beitrag (`teilenBesuchAusAdresse`).
 */
export function linkMitKanal(link: string, kanal: TeilenKanalCode): string {
  return `${link}${link.includes('?') ? '&' : '?'}${TEILEN_PARAMETER}=${kanal}`
}

/**
 * Der Link eines Beitrags (T5, Ergänzung Nr. 128): die Übersicht der Hofseite
 * mit genau diesem Beitrag oben (`?beitrag=<id>`, „Aktuell vom Hof“), nicht
 * mehr ein Reiter. Gilt für die volle Adresse, für die Anzeige im Feld und
 * für die Mail an Abonnentinnen (emails/status-update.tsx).
 */
export function beitragLink(hofLink: string, beitragId: string): string {
  return `${hofLink}?${BEITRAG_PARAMETER}=${encodeURIComponent(beitragId)}`
}

/**
 * Die Kennung, die ein Link auf einen Beitrag trägt (T5, F8): nur, wenn der
 * Beitrag auf der Hofseite steht. Sonst sagte die Seite „nicht mehr aktuell“,
 * obwohl es den Beitrag gibt. EINE Regel für die Mail an Abonnentinnen
 * (server/actions/status-posts.ts) und den WhatsApp-Link je Person
 * (beitragLinkMitKanal); das Teilen-Fenster und die Karten auf Heute und der
 * Startseite zeigen nur Beiträge, die schon auf der Hofseite stehen.
 */
export function beitragIdImLink(beitrag: { id: string; showOnFarmPage: boolean }): string | undefined {
  return beitrag.showOnFarmPage ? beitrag.id : undefined
}

/**
 * Der Link je Person in WhatsApp (T5): die Hofseite mit genau diesem Beitrag
 * (`beitragLink`) und dem Kürzel des Kanals (`linkMitKanal`) — in der
 * Reihenfolge des Teilen-Fensters, `?beitrag=<id>&k=wa`. Steht der Beitrag
 * nicht auf der Hofseite (beitragIdImLink), ist es die Hofseite mit `?k=wa`.
 */
export function beitragLinkMitKanal(hofLink: string, beitrag: { id: string; showOnFarmPage: boolean }, kanal: TeilenKanalCode): string {
  const beitragId = beitragIdImLink(beitrag)
  return linkMitKanal(beitragId ? beitragLink(hofLink, beitragId) : hofLink, kanal)
}

/**
 * Wohin ein Kanal führt. Jeder Link trägt sein Kürzel (`?k=`), damit die
 * Zählung weiß, woher ein Besuch kam — sonst nichts (S8). Der Link kommt aus
 * den Daten des Fensters: die Hofseite bzw. der Beitrag darauf (`?beitrag=`).
 */
export function kanalZiel(
  kanal: (typeof FENSTER_KANAELE)[number]['kanal'],
  { link, text, hofName }: { link: string; text: string; hofName: string }
): KanalZiel {
  const geteilt = linkMitKanal(link, kanal)
  const mitLink = text.trim() ? `${text.trim()}\n${geteilt}` : geteilt
  switch (kanal) {
    case 'wa':
      return { art: 'oeffnen', href: `https://wa.me/?text=${encodeURIComponent(mitLink)}` }
    case 'fb':
      return { art: 'oeffnen', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(geteilt)}` }
    case 'mail':
      return {
        art: 'oeffnen',
        href: `mailto:?subject=${encodeURIComponent(hofName)}&body=${encodeURIComponent(mitLink)}`,
      }
    case 'wa-status':
    case 'ig':
      return { art: 'bild', text: mitLink, link: geteilt }
  }
}

/** Was beide Arten des Fensters vom Server bekommen — nur öffentliche Hofdaten, fertig formatiert. */
type TeilenFensterGrund = {
  hofName: string
  slug: string
  /** Der geteilte Link ohne Kürzel (APP_URL): die Hofseite, im Beitrag-Modus mit `?beitrag=<id>` (beitragLink). */
  link: string
  /** So steht der Link im Feld: Host und Pfad ohne https:// (Domain/hof-test bzw. Domain/hof-test?beitrag=<id>). */
  adresse: string
  auswahl: TeilenAuswahlEintrag[]
  textVorschlag: string
}

/** Das Fenster von Heute: den Hof teilen. */
export type TeilenFensterHof = TeilenFensterGrund & { art: 'hof' }

/** Das Fenster eines veröffentlichten Beitrags (Register T5). */
export type TeilenFensterBeitrag = TeilenFensterGrund & {
  art: 'beitrag'
  beitragId: string
  titel: string
  /** Anfangs im Bild: die verknüpften Produkte des Beitrags (Kennungen der Einträge), höchstens drei. */
  vorbelegt: string[]
  /** Einträge ohne eigenes Foto — das Bild zeigt dort die Illustration der Kategorie (T6). */
  ohneFoto: string[]
  /** Die heutigen WhatsApp-Abonnentinnen (W1); null ohne Abonnentinnen — dann gibt es keine Karte. */
  abonnentinnen: { anzahl: number; geoeffnet: number } | null
  /** Die Tipp-Liste `/status/<id>/send-whatsapp`; null ohne Abonnentinnen. */
  versandPfad: string | null
  /** An wie viele Adressen die Mail beim Veröffentlichen ging; null ohne Mail. */
  email: { anzahl: number } | null
}

export type TeilenFensterDaten = TeilenFensterHof | TeilenFensterBeitrag

/**
 * Die Sätze des Beitrag-Modus (Register T5) — jeder Satz mit Zusage
 * („per E-Mail verschickt", „automatisch raus") nur aus dieser Quelle;
 * „n von m geöffnet" kommt aus WHATSAPP_VERSAND_TEXT (W1).
 */
export const BEITRAG_TEILEN_TEXT = {
  titel: 'Beitrag teilen',
  /** Unterzeile der Mockups: im Web lang, am Handy kurz; ohne Mail entfällt ihr Teil. */
  unterzeile: (email: number | null, kurz: boolean): string =>
    [
      'Veröffentlicht',
      kurz ? 'auf der Hofseite' : 'auf deiner Hofseite',
      email === null ? null : `${formatZahl(email)} per E-Mail${kurz ? '' : ' verschickt'}`,
    ]
      .filter((teil): teil is string => teil !== null)
      .join(' · '),
  abonnentinnen: 'Deine WhatsApp-Abonnentinnen',
  abonnentinnenZeile: (anzahl: number): string =>
    `${formatZahl(anzahl)} ${anzahl === 1 ? 'Person' : 'Kundinnen und Kunden'} · je ein Tipp, WhatsApp öffnet sich mit dem Text`,
  verschicken: 'Nachrichten verschicken',
  vorbelegt: `Vorbelegt: die Produkte aus dem Beitrag. Bis zu drei passen ins Bild.`,
  ohneFoto: 'ohne Foto',
  mitFoto: 'Mit Foto wirkt’s besser',
  fotoHinzufuegen: 'Foto hinzufügen',
  telefon: 'Teilen über das Telefon',
  emailHinweis: 'E-Mails an Abonnentinnen gehen beim Veröffentlichen automatisch raus.',
  nichtTeilbar: 'Diesen Beitrag kannst du gerade nicht teilen – er steht nicht mehr auf deiner Hofseite. Lade die Seite neu.',
  ladenGingNicht: 'Wir konnten das Teilen-Fenster gerade nicht öffnen. Bitte versuch es noch einmal.',
} as const

/**
 * Die Einträge der Auswahl, die ein Beitrag verknüpft: eine Familie zählt,
 * wenn eine ihrer Größen verknüpft ist (die Kennung des Eintrags ist ihr
 * erstes kaufbares Produkt). Nie ausverkauft, höchstens drei, in der
 * Reihenfolge des Hofs.
 */
export function beitragVorbelegung(
  auswahl: readonly TeilenAuswahlEintrag[],
  produkte: readonly { id: string; familieId: string | null }[],
  verknuepft: readonly string[]
): string[] {
  const gruppe = new Map(produkte.map((p) => [p.id, p.familieId ? `f:${p.familieId}` : `p:${p.id}`]))
  const gewuenscht = new Set(verknuepft.map((id) => gruppe.get(id)))
  return auswahl
    .filter((e) => !e.ausverkauft && gewuenscht.has(gruppe.get(e.id)))
    .slice(0, TEILEN_BILD_PRODUKTE_MAX)
    .map((e) => e.id)
}

/** Anfangs im Bild: im Beitrag-Modus die verknüpften Produkte; ohne solche (und beim Hof) die ersten drei kaufbaren. */
export function anfangsAuswahl(daten: TeilenFensterDaten): string[] {
  return daten.art === 'beitrag' && daten.vorbelegt.length > 0 ? [...daten.vorbelegt] : startAuswahl(daten.auswahl)
}

/**
 * Die Karte „Deine WhatsApp-Abonnentinnen" (W1). Zählregel wie der Knopf im
 * Reiter „Beiträge": n ist, wer geöffnet bekam, m die HEUTIGEN
 * Abonnentinnen — n nie über m, sonst stünde nach Abmeldungen „4 von 3".
 * Ohne Abonnentinnen keine Karte und kein Weg zur Tipp-Liste.
 */
export function beitragWhatsApp(
  beitragId: string,
  anzahl: number,
  getippt: number
): Pick<TeilenFensterBeitrag, 'abonnentinnen' | 'versandPfad'> {
  if (anzahl <= 0) return { abonnentinnen: null, versandPfad: null }
  return { abonnentinnen: { anzahl, geoeffnet: Math.min(getippt, anzahl) }, versandPfad: `/status/${beitragId}/send-whatsapp` }
}

/**
 * Der vorgeschlagene Text im Beitrag-Modus (T5): „Titel – Text", dann
 * „Online bestellen, <Abholung>." — vom Hof frei änderbar. `{Vorname}` fällt
 * weg wie auf der Hofseite; der Text steht einzeilig wie im Mockup.
 */
export function beitragTextVorschlag(titel: string, body: string, abholung: string | null): string {
  const teile = [einzeiligerFremdtext(titel, BEITRAG_TITEL_MAX), einzeiligerFremdtext(stripStatusVariables(body), BEITRAG_TEXT_MAX)]
  const was = teile.filter((t) => t !== '').join(' – ')
  const satz = was === '' || /[.!?…]$/.test(was) ? was : `${was}.`
  return [satz, abholung ? `Online bestellen, ${abholung}.` : 'Jetzt online bestellen.'].filter((t) => t !== '').join(' ')
}

/** „Plakat drucken" nur beim Hof: Ein Plakat trägt die feste Hofseite (`?k=qr`), keinen Beitrag (T5). */
export function plakatPfad(daten: TeilenFensterDaten): string | null {
  return daten.art === 'hof' ? PLAKAT_PFAD : null
}

/**
 * Welcher Knopf orange ist — höchstens einer (T5): mit Abonnentinnen
 * „Nachrichten verschicken", sonst wie beim Hof WhatsApp (Web) bzw. das
 * Teilen-Menü des Telefons (Handy).
 */
export function orangerKnopf(daten: TeilenFensterDaten, breit: boolean): 'abonnentinnen' | 'whatsapp' | 'telefon' {
  if (daten.art === 'beitrag' && daten.abonnentinnen) return 'abonnentinnen'
  return breit ? 'whatsapp' : 'telefon'
}

/** Die Fußnote: der Zählhinweis (T1), im Beitrag-Modus dazu der Satz zur Mail. */
export function fensterFussnote(daten: TeilenFensterDaten): string {
  return daten.art === 'beitrag' ? `${TEILEN_ZAEHLUNG_HINWEIS} ${BEITRAG_TEILEN_TEXT.emailHinweis}` : TEILEN_ZAEHLUNG_HINWEIS
}
