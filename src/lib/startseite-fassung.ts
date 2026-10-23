/**
 * Entwurf und Fassung der Startseite (Register N16, Änderung Nr. 99) — die
 * Regeln, rein und ohne Datenbank prüfbar (tests/startseite-fassung.test.ts).
 *
 * Admin › Startseite arbeitet in einem Entwurf (die Tabellen
 * StartseiteAbschnitt/-Block); „Veröffentlichen …" macht daraus eine
 * unveränderliche Fassung (StartseiteFassung, Format in
 * src/schemas/startseite-fassung.ts). Live ist die jüngste nicht
 * zurückgezogene Fassung, deren Zeit erreicht ist — verglichen beim Lesen
 * (src/server/queries/startseite.ts), kein Cron. Entwurf, Live und jede
 * Fassung werden über EINEN Weg zu den Zeilen der Seite (zeilenAusFassung).
 *
 * Kein Import aus Datenbank oder Umgebung: Admin › Startseite (Browser)
 * vergleicht mit denselben Funktionen wie der Server.
 */
import type { ProductCategory, StartseiteArt, StartseiteVorlage } from '@prisma/client'
import type { FassungBlock, FassungInhalt, FassungZeile } from '@/schemas/startseite-fassung'
import {
  ABSCHNITT_TEXT,
  STANDARD_REIHENFOLGE,
  type AbschnittArt,
  type StartseitenBlockDaten,
  type StartseitenZeile,
  istLive,
  standText,
} from '@/lib/startseite-gestalten'
import type { VorschauQuelle } from '@/schemas/startseite'
import { kalendertagInWien } from '@/lib/wiener-tag'
import { uhrzeitInWien } from '@/lib/fristen'
import { MONAT_KURZ, formatTagKurz } from '@/lib/format'
import { PRODUKTION_HOST } from '@/lib/umgebung'

const MINUTE_MS = 60_000
const TAG_MS = 24 * 60 * MINUTE_MS

/** Ein Termin darf höchstens so weit zurückliegen (Uhren, Klick kurz vor der Minute). */
export const TERMIN_TOLERANZ_MS = MINUTE_MS
/** … und höchstens so weit voraus liegen. */
export const TERMIN_HOECHSTENS_TAGE = 365

/** Nach so viel Ruhe speichert Admin › Startseite den Entwurf. */
export const ENTWURF_RUHE_MS = 800

/** Die Vorlage kurz, wie „Was sich gegenüber live ändert“ sie nennt. */
export const VORLAGE_KURZ: Record<StartseiteVorlage, string> = {
  SAISONKARTE: 'Saisonkarte',
  HINWEISBAND: 'Hinweisband',
  HOEFE_AUSWAHL: 'Höfe-Auswahl',
  KATEGORIE_HINWEIS: 'Kategorie-Hinweis',
}

/** Artikel und Fürwörter je Vorlage für die Hinweise im Dialog („Die Saisonkarte … Sie erscheint …"). */
const VORLAGE_GRAMMATIK: Record<StartseiteVorlage, { der: string; sein: string; er: string }> = {
  SAISONKARTE: { der: 'Die', sein: 'ihren', er: 'Sie' },
  HINWEISBAND: { der: 'Das', sein: 'seinen', er: 'Es' },
  HOEFE_AUSWAHL: { der: 'Die', sein: 'ihren', er: 'Sie' },
  KATEGORIE_HINWEIS: { der: 'Der', sein: 'seinen', er: 'Er' },
}

// ─── Entwurf → Fassung → Zeilen der Seite ───────────────────────────────────

/** Ohne Fassung: die Standard-Reihenfolge, alle sichtbar, keine Blöcke — der Stand vor Nr. 99. */
export function standardFassung(): FassungInhalt {
  return { v: 1, zeilen: STANDARD_REIHENFOLGE.map((art) => ({ art, sichtbar: true })) }
}

/** Ein Block des Entwurfs, wie Tabelle und Formular ihn kennen — leere Felder als null, Zeitpunkte als ISO-Text. */
export type EntwurfBlock = {
  id: string
  vorlage: StartseiteVorlage
  ueberzeile: string | null
  titel: string
  text: string | null
  bildUrl: string | null
  linkUrl: string | null
  linkText: string | null
  farmIds: string[]
  kategorie: ProductCategory | null
  liveAb: string
  liveBis: string | null
}

export type EntwurfZeile = { art: StartseiteArt; sichtbar: boolean; block: EntwurfBlock | null }

function blockAusEntwurf(b: EntwurfBlock): FassungBlock {
  return {
    id: b.id,
    vorlage: b.vorlage,
    ...(b.ueberzeile !== null && { ueberzeile: b.ueberzeile }),
    titel: b.titel,
    ...(b.text !== null && { text: b.text }),
    ...(b.bildUrl !== null && { bildUrl: b.bildUrl }),
    ...(b.linkUrl !== null && { linkUrl: b.linkUrl }),
    ...(b.linkText !== null && { linkText: b.linkText }),
    farmIds: [...b.farmIds],
    ...(b.kategorie !== null && { kategorie: b.kategorie }),
    liveAb: b.liveAb,
    ...(b.liveBis !== null && { liveBis: b.liveBis }),
  }
}

/** Der Entwurf im Format einer Fassung — was „Veröffentlichen …" speichert und womit verglichen wird. */
export function fassungAusEntwurf(zeilen: readonly EntwurfZeile[]): FassungInhalt {
  return {
    v: 1,
    zeilen: zeilen.flatMap((z): FassungZeile[] => {
      if (z.art !== 'BLOCK') return [{ art: z.art, sichtbar: z.sichtbar }]
      // Eine BLOCK-Zeile ohne Block gibt es nur nach einem Eingriff von Hand — sie fällt weg.
      return z.block ? [{ art: 'BLOCK', sichtbar: z.sichtbar, block: blockAusEntwurf(z.block) }] : []
    }),
  }
}

/** Ein Block der Fassung als Block des Entwurfs (Als Entwurf übernehmen) — ohne Kennung bekommt er eine neue. */
export function entwurfAusBlock(b: FassungBlock): Omit<EntwurfBlock, 'id'> & { id: string | null } {
  return {
    id: b.id ?? null,
    vorlage: b.vorlage,
    ueberzeile: b.ueberzeile ?? null,
    titel: b.titel,
    text: b.text ?? null,
    bildUrl: b.bildUrl ?? null,
    linkUrl: b.linkUrl ?? null,
    linkText: b.linkText ?? null,
    farmIds: [...b.farmIds],
    kategorie: b.kategorie ?? null,
    liveAb: b.liveAb,
    liveBis: b.liveBis ?? null,
  }
}

/**
 * DER Weg zu den Zeilen der Seite — für Live, jede Fassung und den Entwurf
 * (über fassungAusEntwurf). `slugs` kennt nur freigeschaltete, öffentlich
 * sichtbare Höfe (eine Abfrage für alle Blöcke): Ein später gesperrter Hof
 * fällt hier weg. Die Zeiträume der Blöcke prüft danach zuRendern.
 */
export function zeilenAusFassung(inhalt: FassungInhalt, slugs: ReadonlyMap<string, string>): StartseitenZeile[] {
  return inhalt.zeilen.map((z, index): StartseitenZeile => {
    if (z.art !== 'BLOCK') return { art: z.art, sichtbar: z.sichtbar }
    const b = z.block
    const block: StartseitenBlockDaten = {
      // Ohne Kennung (von Hand geschrieben) eine feste je Platz — sie dient der Seite nur als Schlüssel.
      id: b.id ?? `fassung-block-${index}`,
      vorlage: b.vorlage,
      ueberzeile: b.ueberzeile ?? null,
      titel: b.titel,
      text: b.text ?? null,
      bildUrl: b.bildUrl ?? null,
      linkUrl: b.linkUrl ?? null,
      linkText: b.linkText ?? null,
      hofSlugs: b.farmIds.flatMap((id) => slugs.get(id) ?? []),
      kategorie: b.kategorie ?? null,
      liveAb: b.liveAb,
      liveBis: b.liveBis ?? null,
    }
    return { art: 'BLOCK', sichtbar: z.sichtbar, block }
  })
}

/** Alle gewählten Höfe einer oder mehrerer Fassungen — für EINE Abfrage der Slugs. */
export function hofKennungen(inhalte: readonly FassungInhalt[]): string[] {
  return [...new Set(inhalte.flatMap((f) => f.zeilen.flatMap((z) => (z.art === 'BLOCK' ? z.block.farmIds : []))))]
}

// ─── Live und geplant ───────────────────────────────────────────────────────

/**
 * Der Datencache der Startseite trägt den Zeitpunkt der nächsten geplanten
 * Fassung. Ist er erreicht, liest die Startseite an ihm vorbei frisch, bis der
 * Eintrag erneuert ist — sonst käme eine geplante Fassung erst nach dem Cache
 * (5 Minuten) UND dem Neubau der Seite (5 Minuten) an.
 */
export function mussFrischLesen(naechsteAb: string | null, jetzt: Date): boolean {
  return naechsteAb !== null && Date.parse(naechsteAb) <= jetzt.getTime()
}

type Zeitlich = { liveAb: string; createdAt: string }

function neuesteZuerst(a: Zeitlich, b: Zeitlich): number {
  return Date.parse(b.liveAb) - Date.parse(a.liveAb) || Date.parse(b.createdAt) - Date.parse(a.createdAt)
}

/**
 * Zeitplan und Verlauf aus allen nicht zurückgezogenen Fassungen: geplant
 * (liveAb > jetzt, nächste zuerst), live (die jüngste mit liveAb ≤ jetzt; bei
 * gleicher Zeit die später angelegte) und früher (neueste zuerst, `bis` = der
 * Beginn der Fassung, die sie abgelöst hat). Dieselbe Regel wie die Abfrage
 * der Startseite (leseFassungZu) — der Integrationstest prüft beide an
 * denselben Zeilen.
 */
export function ordneFassungen<T extends Zeitlich>(
  liste: readonly T[],
  jetzt: Date
): { geplant: T[]; live: T | null; frueher: (T & { bis: string })[] } {
  const sortiert = [...liste].sort(neuesteZuerst)
  const geplant = sortiert.filter((f) => Date.parse(f.liveAb) > jetzt.getTime()).reverse()
  const erreicht = sortiert.filter((f) => Date.parse(f.liveAb) <= jetzt.getTime())
  const [live = null, ...rest] = erreicht
  const frueher = rest.map((f, i) => ({ ...f, bis: erreicht[i].liveAb }))
  return { geplant, live, frueher }
}

/** Ein Termin für „Veröffentlichen …": nicht mehr als eine Minute zurück, höchstens 365 Tage voraus. */
export function pruefeTermin(termin: Date, jetzt: Date): 'vergangen' | 'zu-weit' | null {
  if (termin.getTime() < jetzt.getTime() - TERMIN_TOLERANZ_MS) return 'vergangen'
  if (termin.getTime() > jetzt.getTime() + TERMIN_HOECHSTENS_TAGE * TAG_MS) return 'zu-weit'
  return null
}

// ─── Was sich gegenüber live ändert ─────────────────────────────────────────

export type AenderungArt = 'neu' | 'entfernt' | 'verschoben' | 'ausgeblendet' | 'eingeblendet' | 'geaendert'

export type Aenderung = {
  art: AenderungArt
  titel: string
  /** Die Zeile, an der die Änderung hängt: die Art eines Abschnitts oder `block:<Kennung>`. */
  schluessel: string
  /** Nur bei Blöcken. */
  vorlage?: StartseiteVorlage
  /** Neu: die Zeile davor; verschoben: die Zeile danach. */
  nachbar?: string
  /** Neu: der Zeitraum des Blocks, kurz. */
  zeitraum?: string
}

export const AENDERUNG_TEXT: Record<AenderungArt, string> = {
  neu: 'Neu',
  entfernt: 'Entfernt',
  verschoben: 'Verschoben',
  ausgeblendet: 'Ausgeblendet',
  eingeblendet: 'Eingeblendet',
  geaendert: 'Geändert',
}

/** Die Zeile einer Fassung als Schlüssel: Abschnitte über ihre Art, Blöcke über ihre Kennung. */
export function zeilenSchluessel(zeile: FassungZeile, index: number): string {
  return zeile.art === 'BLOCK' ? `block:${zeile.block.id ?? `#${index}`}` : zeile.art
}

function titelVon(zeile: FassungZeile): string {
  return zeile.art === 'BLOCK' ? zeile.block.titel : ABSCHNITT_TEXT[zeile.art].titel
}

const BLOCK_FELDER = ['vorlage', 'ueberzeile', 'titel', 'text', 'bildUrl', 'linkUrl', 'linkText', 'kategorie', 'liveAb', 'liveBis'] as const

function gleicherBlock(a: FassungBlock, b: FassungBlock): boolean {
  return BLOCK_FELDER.every((feld) => a[feld] === b[feld]) && a.farmIds.join('\n') === b.farmIds.join('\n')
}

/**
 * Welche Stellen in `folge` in ihrer Reihenfolge bleiben: die längste
 * steigende Teilfolge. Was nicht dazugehört, ist verschoben — so zählt ein
 * Tausch zweier Nachbarn als EINE Verschiebung, und ein eingefügter Block
 * verschiebt nichts. Bei gleicher Länge bleibt das spätere Element stehen
 * (Mockup: „Für Höfe“ vor „So funktioniert’s“ — verschoben ist der, der
 * nach oben kam).
 */
function bleibende(folge: readonly number[]): Set<number> {
  const laenge = folge.map(() => 1)
  const vorher = folge.map(() => -1)
  for (let i = 0; i < folge.length; i++) {
    for (let j = 0; j < i; j++) {
      if (folge[j] < folge[i] && laenge[j] + 1 >= laenge[i]) {
        laenge[i] = laenge[j] + 1
        vorher[i] = j
      }
    }
  }
  let ende = -1
  for (let i = 0; i < folge.length; i++) if (ende < 0 || laenge[i] >= laenge[ende]) ende = i
  const bleibt = new Set<number>()
  for (let i = ende; i >= 0; i = vorher[i]) bleibt.add(i)
  return bleibt
}

/**
 * Was der Entwurf gegenüber live ändert — in der Reihenfolge des Entwurfs,
 * Entferntes zuletzt. Abschnitte zählen über ihre Art, Blöcke über ihre
 * Kennung: ein Block mit anderer Kennung ist neu, einer ohne Gegenstück im
 * Entwurf entfernt, ein Block mit anderen Feldern (auch Zeitraum) geändert.
 */
export function vergleicheMitLive(live: FassungInhalt, entwurf: FassungInhalt): Aenderung[] {
  const liveStelle = new Map(live.zeilen.map((z, i) => [zeilenSchluessel(z, i), i]))
  const entwurfSchluessel = entwurf.zeilen.map((z, i) => zeilenSchluessel(z, i))
  const gemeinsam = entwurf.zeilen.flatMap((_, i) => (liveStelle.has(entwurfSchluessel[i]) ? [i] : []))
  const bleibt = bleibende(gemeinsam.map((i) => liveStelle.get(entwurfSchluessel[i]) ?? 0))
  const verschoben = new Set(gemeinsam.filter((_, k) => !bleibt.has(k)))

  const aenderungen: Aenderung[] = []
  entwurf.zeilen.forEach((zeile, i) => {
    const schluessel = entwurfSchluessel[i]
    const titel = titelVon(zeile)
    const vorlage = zeile.art === 'BLOCK' ? { vorlage: zeile.block.vorlage } : {}
    const stelle = liveStelle.get(schluessel)
    const vorbild = stelle === undefined ? undefined : live.zeilen[stelle]
    if (!vorbild) {
      const nachbar = i > 0 ? titelVon(entwurf.zeilen[i - 1]) : undefined
      const zeitraum = zeile.art === 'BLOCK' ? zeitraumKurz(zeile.block.liveAb, zeile.block.liveBis ?? null) : undefined
      aenderungen.push({ art: 'neu', titel, schluessel, ...vorlage, nachbar, zeitraum })
      return
    }
    if (zeile.art === 'BLOCK' && vorbild.art === 'BLOCK' && !gleicherBlock(zeile.block, vorbild.block)) {
      aenderungen.push({ art: 'geaendert', titel, schluessel, ...vorlage })
    }
    if (verschoben.has(i)) {
      const naechste = entwurf.zeilen[i + 1]
      aenderungen.push({ art: 'verschoben', titel, schluessel, ...vorlage, nachbar: naechste ? titelVon(naechste) : undefined })
    }
    if (vorbild.sichtbar !== zeile.sichtbar) {
      aenderungen.push({ art: zeile.sichtbar ? 'eingeblendet' : 'ausgeblendet', titel, schluessel, ...vorlage })
    }
  })
  const imEntwurf = new Set(entwurfSchluessel)
  live.zeilen.forEach((zeile, i) => {
    const schluessel = zeilenSchluessel(zeile, i)
    if (imEntwurf.has(schluessel) || zeile.art !== 'BLOCK') return
    aenderungen.push({ art: 'entfernt', titel: zeile.block.titel, schluessel, vorlage: zeile.block.vorlage })
  })
  return aenderungen
}

function vorlageUndTitel(a: Aenderung): string {
  return a.vorlage ? `${VORLAGE_KURZ[a.vorlage]} „${a.titel}“` : `„${a.titel}“`
}

/** Eine Zeile der Karte „Was sich gegenüber live ändert“ (rechts neben AENDERUNG_TEXT). */
export function aenderungSatz(a: Aenderung): string {
  switch (a.art) {
    case 'neu':
      return `${vorlageUndTitel(a)}${a.nachbar ? ` nach „${a.nachbar}“` : ''}${a.zeitraum ? ` – sichtbar ${a.zeitraum}` : ''}`
    case 'verschoben':
      return `„${a.titel}“${a.nachbar ? ` vor „${a.nachbar}“` : ''}`
    case 'ausgeblendet':
    case 'eingeblendet':
      return `„${a.titel}“`
    default:
      return vorlageUndTitel(a)
  }
}

/** Die Kurzfassung im Zeitplan: „Neu: Saisonkarte (18.–31. Okt) · „Für Höfe“ verschoben“. */
export function aenderungKurz(a: Aenderung): string {
  switch (a.art) {
    case 'neu':
      return `Neu: ${a.vorlage ? VORLAGE_KURZ[a.vorlage] : `„${a.titel}“`}${a.zeitraum ? ` (${a.zeitraum})` : ''}`
    case 'geaendert':
      return `${vorlageUndTitel(a)} geändert`
    case 'entfernt':
      return `${vorlageUndTitel(a)} entfernt`
    default:
      return `„${a.titel}“ ${a.art}`
  }
}

/** Die Marke an der Zeile der Liste: höchstens eine je Zeile, die wichtigste zuerst. */
const MARKEN_VORRANG: readonly AenderungArt[] = ['neu', 'ausgeblendet', 'eingeblendet', 'geaendert', 'verschoben']

export function zeilenMarken(aenderungen: readonly Aenderung[]): Map<string, { text: string; ton: 'tun' | 'laeuft' }> {
  const marken = new Map<string, { text: string; ton: 'tun' | 'laeuft' }>()
  for (const art of MARKEN_VORRANG) {
    for (const a of aenderungen) {
      if (a.art !== art || marken.has(a.schluessel)) continue
      const text = art === 'neu' ? `neu${a.zeitraum ? ` · ${a.zeitraum}` : ''}` : AENDERUNG_TEXT[art].toLowerCase()
      // Mockup: „neu“ grün, alles andere orange.
      marken.set(a.schluessel, { text, ton: art === 'neu' || art === 'eingeblendet' ? 'laeuft' : 'tun' })
    }
  }
  return marken
}

/** „8 Abschnitte · keine Blöcke · Standard-Reihenfolge“ — wie eine Fassung aussieht (Live und Verlauf). */
export function beschreibeFassung(inhalt: FassungInhalt): string {
  const abschnitte = inhalt.zeilen.filter((z): z is Extract<FassungZeile, { art: AbschnittArt }> => z.art !== 'BLOCK')
  const aus = abschnitte.filter((z) => !z.sichtbar).map((z) => `„${ABSCHNITT_TEXT[z.art].titel}“`)
  const bloecke = inhalt.zeilen.flatMap((z) => (z.art === 'BLOCK' ? [`${VORLAGE_KURZ[z.block.vorlage]} „${z.block.titel}“`] : []))
  const standard = abschnitte.every((z, i) => z.art === STANDARD_REIHENFOLGE[i])
  return [
    `${abschnitte.length - aus.length} Abschnitte${aus.length > 0 ? ` (ohne ${aus.join(', ')})` : ''}`,
    bloecke.length > 0 ? bloecke.join(', ') : 'keine Blöcke',
    standard ? 'Standard-Reihenfolge' : 'eigene Reihenfolge',
  ].join(' · ')
}

// ─── Zeiten als Text ────────────────────────────────────────────────────────

/** „Fr, 17. Okt, 09:00“ — Termin in Wiener Zeit. */
export function terminText(zeitpunkt: Date): string {
  return `${formatTagKurz(kalendertagInWien(zeitpunkt))}, ${uhrzeitInWien(zeitpunkt)}`
}

/** „Fr, 17. Okt 2026, 09:00“ — im Zeitplan, mit Jahr. */
export function terminTextMitJahr(zeitpunkt: Date): string {
  const tag = kalendertagInWien(zeitpunkt)
  return `${formatTagKurz(tag)} ${tag.slice(0, 4)}, ${uhrzeitInWien(zeitpunkt)}`
}

function tagUndMonat(kalendertag: string): { tag: number; monat: string; schluessel: string } {
  const monat = Number(kalendertag.slice(5, 7))
  return { tag: Number(kalendertag.slice(8, 10)), monat: MONAT_KURZ[monat - 1], schluessel: kalendertag.slice(0, 7) }
}

/** „18.–31. Okt“, „28. Okt – 3. Nov“, „ab 18. Okt“ — der Zeitraum eines Blocks, Wiener Tage. */
export function zeitraumKurz(liveAb: string, liveBis: string | null): string {
  const ab = tagUndMonat(kalendertagInWien(new Date(liveAb)))
  if (!liveBis) return `ab ${ab.tag}. ${ab.monat}`
  const bis = tagUndMonat(kalendertagInWien(new Date(liveBis)))
  if (ab.schluessel === bis.schluessel) return ab.tag === bis.tag ? `${ab.tag}. ${ab.monat}` : `${ab.tag}.–${bis.tag}. ${ab.monat}`
  return `${ab.tag}. ${ab.monat} – ${bis.tag}. ${bis.monat}`
}

/** „in 1 Tag 12 Std“, „in 1 Std 15 Min“, „in 10 Min“ — wie weit ein Termin weg ist. */
export function abstandText(termin: Date, jetzt: Date): string {
  const minuten = Math.max(0, Math.floor((termin.getTime() - jetzt.getTime()) / MINUTE_MS))
  const tage = Math.floor(minuten / (24 * 60))
  const stunden = Math.floor((minuten % (24 * 60)) / 60)
  const rest = minuten % 60
  if (tage > 0) return `in ${tage} ${tage === 1 ? 'Tag' : 'Tagen'}${stunden > 0 ? ` ${stunden} Std` : ''}`
  if (stunden > 0) return `in ${stunden} Std${rest > 0 ? ` ${rest} Min` : ''}`
  return minuten > 0 ? `in ${minuten} Min` : 'gleich'
}

/**
 * Die Hinweise im Dialog: ein sichtbarer Block, der erst nach dem Termin
 * beginnt oder vorher schon endet — Blöcke behalten ihren eigenen Zeitraum
 * zusätzlich (Register N16).
 */
export function blockHinweise(inhalt: FassungInhalt, termin: Date): string[] {
  const amTag = `am ${Number(kalendertagInWien(termin).slice(8, 10))}.`
  return inhalt.zeilen.flatMap((z) => {
    if (z.art !== 'BLOCK' || !z.sichtbar) return []
    const b = z.block
    const g = VORLAGE_GRAMMATIK[b.vorlage]
    const eigener = `${g.der} ${VORLAGE_KURZ[b.vorlage]} hat ${g.sein} eigenen Zeitraum (${zeitraumKurz(b.liveAb, b.liveBis ?? null)}).`
    if (Date.parse(b.liveAb) > termin.getTime()) {
      const ab = tagUndMonat(kalendertagInWien(new Date(b.liveAb)))
      return [`${eigener} ${g.er} erscheint erst ab ${ab.tag}. ${ab.monat}, auch wenn diese Fassung ${amTag} live geht.`]
    }
    if (b.liveBis && Date.parse(b.liveBis) <= termin.getTime()) {
      return [`${eigener} ${g.er} ist schon vorbei, wenn diese Fassung ${amTag} live geht.`]
    }
    return []
  })
}

/** „1 Änderung“, „3 Änderungen“ — mit `lang` „… gegenüber live“. */
export function aenderungenText(anzahl: number, lang = false): string {
  if (anzahl === 0) return ENTWURF_TEXT.keineAenderungen
  return `${anzahl} ${anzahl === 1 ? 'Änderung' : 'Änderungen'}${lang ? ' gegenüber live' : ''}`
}

/** Der Knopf im Dialog nennt den Termin. */
export function veroeffentlichenKnopf(termin: Date | null): string {
  return termin ? `Für ${terminText(termin)} planen` : 'Jetzt veröffentlichen'
}

/** Die Rückmeldung nach dem Veröffentlichen (Toast). */
export function veroeffentlichtText(termin: Date | null): string {
  return termin ? `Geplant für ${terminText(termin)}` : 'Veröffentlicht – in wenigen Minuten überall'
}

// ─── Texte ──────────────────────────────────────────────────────────────────

/**
 * Die Texte von Entwurf, Fassung und Zeitplan (Mockups admin-startseite-
 * entwurf, -veroeffentlichen, -zeitplan, mobil-admin-startseite-entwurf;
 * Register N16). „bis zu 5 Minuten“ ist die Zusage aus N16 (revalidate 300).
 */
export const ENTWURF_TEXT = {
  satz: 'Du arbeitest in einem Entwurf. Die Kundinnen sehen weiter die veröffentlichte Fassung, bis du veröffentlichst.',
  satzHandy: 'Du arbeitest in einem Entwurf. Live geht erst, was du veröffentlichst.',
  satzZeitplan: 'Was wann live ist – und was vorher war.',
  bearbeiten: 'Bearbeiten',
  zeitplan: 'Zeitplan',
  verlauf: 'Verlauf',
  entwurf: 'Entwurf',
  live: 'Live',
  fassung: 'Fassung',
  geplant: 'Geplant',
  frueher: 'Früher',
  nichtsGeplant: 'Nichts geplant',
  standard: 'Standard-Reihenfolge',
  keineAenderungen: 'Keine Änderungen gegenüber live',
  verwerfen: 'Entwurf verwerfen',
  verwerfenFrage: 'Entwurf verwerfen? Er wird wieder wie live.',
  veroeffentlichen: 'Veröffentlichen …',
  speichert: 'Speichert …',
  gespeichertTitel: 'Im Entwurf gespeichert.',
  gespeichertSatz: `Jede Änderung landet sofort im Entwurf – auf ${PRODUKTION_HOST} ändert sich nichts, bis du veröffentlichst.`,
  gespeichertHandy: 'Änderungen werden automatisch als Entwurf gespeichert.',
  aenderungenTitel: 'Was sich gegenüber live ändert',
  dialogTitel: 'Entwurf veröffentlichen',
  dialogSatz: 'Aus deinem Entwurf wird eine Fassung der Startseite.',
  wann: 'Wann?',
  jetzt: 'Jetzt',
  jetztSatz: 'Geht sofort live, spätestens nach 5 Minuten überall.',
  termin: 'Zu einem Zeitpunkt',
  terminSatz: 'Bis dahin bleibt die Startseite, wie sie ist.',
  datum: 'Datum',
  uhrzeit: 'Uhrzeit',
  wienerZeit: 'Wiener Zeit',
  wasWannLive: 'Was wann live ist',
  vorschauKnopf: 'Vorschau',
  ansehen: 'Ansehen',
  zurueckziehen: 'Zurückziehen',
  zurueckziehenFrage: 'Diese Planung zurückziehen? Die Startseite bleibt dann, wie sie ist.',
  zurueckgezogen: 'Die Planung ist zurückgezogen.',
  alsEntwurf: 'Als Entwurf übernehmen',
  alsEntwurfFrage: 'Dein jetziger Entwurf wird ersetzt.',
  uebernommen: 'Die Fassung ist jetzt dein Entwurf.',
  verworfen: 'Der Entwurf ist wieder wie live.',
  nichtGespeichert: 'Der Entwurf ist noch nicht gespeichert. Prüf die Angaben und versuch es noch einmal.',
  abbrechen: 'Abbrechen',
  keinVerlauf: 'Noch keine früheren Fassungen.',
  regelTitel: 'So funktioniert’s',
  regeln: [
    `Änderungen landen automatisch im Entwurf – ${PRODUKTION_HOST} bleibt, wie es ist.`,
    '„Veröffentlichen“ macht aus dem Entwurf eine Fassung – jetzt oder zu Datum und Uhrzeit (Wiener Zeit).',
    'Es gilt immer die jüngste Fassung, deren Zeit erreicht ist. Mehrere Planungen sind möglich, z. B. Weihnachten ab 20. Dez und zurück zur normalen ab 7. Jän.',
    'Blöcke mit Zeitraum erscheinen zusätzlich nur in ihrem Zeitraum.',
    'Zurückziehen geht bis zur geplanten Zeit; danach eine frühere Fassung „als Entwurf übernehmen“ und neu veröffentlichen.',
    'Die Umstellung braucht bis zu 5 Minuten, bis sie überall ankommt.',
  ],
  bandEntwurf: 'ENTWURF · NUR FÜR DICH SICHTBAR',
  bandLive: `LIVE · SO SIEHT ES ${PRODUKTION_HOST.toUpperCase()} GERADE`,
  bandGeplant: 'GEPLANT · SO SIEHT ES AB DEM TERMIN AUS',
  quelleBeschriftung: 'Was die Vorschau zeigt',
  /** Unter der Vorschau, solange der offene Block nicht gespeichert ist — derselbe Satz wie im Formular (Nr. 155). */
  nochNichtInVorschau: (grund: string) => `Noch nicht in der Vorschau: ${grund}`,
  /** Unter der Vorschau nach „Fertig“, wenn der Block am gezeigten Tag nicht live ist (Nr. 155). */
  nichtZuSehenAb: (titel: string, ab: string) => `„${titel}“ ist an diesem Tag nicht zu sehen – live ab ${ab}.`,
  nichtZuSehenBis: (titel: string, bis: string) => `„${titel}“ ist an diesem Tag nicht zu sehen – live bis ${bis}.`,
} as const

/** „Zurückziehen geht bis 09:00.“ unter dem Dialog. */
export function zurueckziehenBisText(termin: Date): string {
  return `Zurückziehen geht bis ${uhrzeitInWien(termin)}.`
}

/** „Fassung vom Mi, 15. Okt, 20:30“ bzw. ohne Fassung die Standard-Reihenfolge. */
export function liveText(liveAb: string | null): string {
  return liveAb ? `Fassung vom ${terminText(new Date(liveAb))}` : ENTWURF_TEXT.standard
}

/** Ob eine Fassung zu einem Termin geplant war (angelegt mehr als eine Minute vor ihrer Zeit) oder sofort veröffentlicht. */
export function warGeplant(f: { liveAb: string; createdAt: string }): boolean {
  return Date.parse(f.liveAb) - Date.parse(f.createdAt) > TERMIN_TOLERANZ_MS
}

/** „geplant von …“ bzw. „veröffentlicht von …“ — ohne bekannten Namen nur das Wort. */
export function vonText(f: { liveAb: string; createdAt: string; von: string | null }): string {
  return `${warGeplant(f) ? 'geplant' : 'veröffentlicht'}${f.von ? ` von ${f.von}` : ''}`
}

/** „heute 20:44“ bzw. „Mi, 15. Okt, 20:44“ — wann eine Fassung angelegt wurde. */
export function angelegtText(createdAt: string, jetzt: Date): string {
  const angelegt = new Date(createdAt)
  return kalendertagInWien(angelegt) === kalendertagInWien(jetzt) ? `heute ${uhrzeitInWien(angelegt)}` : terminText(angelegt)
}

/** „Mo, 6. Okt 2026, 07:00 – Mi, 15. Okt, 20:30“ — der Zeitraum einer früheren Fassung. */
export function verlaufZeitraum(liveAb: string, bis: string): string {
  return `${terminTextMitJahr(new Date(liveAb))} – ${terminText(new Date(bis))}`
}

/** Die Kurzfassung einer Planung: was sie gegenüber der Fassung davor ändert. */
export function planungKurz(vorher: FassungInhalt, fassung: FassungInhalt): string {
  const aenderungen = vergleicheMitLive(vorher, fassung)
  return aenderungen.length > 0 ? aenderungen.map(aenderungKurz).join(' · ') : ENTWURF_TEXT.keineAenderungen
}

// ─── Vorschau des Entwurfs: Quelle, Neuladen, Lage im Rahmen (Nr. 106) ─────

/** Wie die Quelle einer Vorschau heißt — im Band der Seite und im Titel des Rahmens. */
export function vorschauQuelleText(quelle: VorschauQuelle): string {
  if (quelle === 'entwurf') return ENTWURF_TEXT.entwurf
  return quelle === 'live' ? ENTWURF_TEXT.live : ENTWURF_TEXT.fassung
}

/** Das Band oben auf der Seite im Rahmen: „Vorschau · Entwurf · Stand am Fr, 16. Okt 2026“ (Nacharbeit 99). */
export function vorschauBandText(quelle: VorschauQuelle, datum: Date): string {
  return `Vorschau · ${vorschauQuelleText(quelle)} · Stand am ${standText(datum)}`
}

/**
 * Welche Rahmen stehen (Register N16, Ergänzung Nr. 106): Der sichtbare
 * bleibt, bis die neue Adresse fertig geladen ist — dann tauscht die
 * Vorschau. Bis dahin lädt die neue unsichtbar daneben; kommt währenddessen
 * eine noch neuere, ersetzt sie die ladende. Nie ein leerer Rahmen nach einer
 * Speicherung, nie mehr als zwei.
 */
export function vorschauRahmen(sichtbar: string | null, gewuenscht: string | null): { rahmen: string[]; laedt: boolean } {
  const laedt = gewuenscht !== null && gewuenscht !== sichtbar
  return { rahmen: [...(sichtbar === null ? [] : [sichtbar]), ...(laedt ? [gewuenscht] : [])], laedt }
}

/**
 * Wohin der neue Rahmen nach dem Laden scrollt: dorthin, wo der alte stand —
 * solange der alte noch die Startseite zeigt. Hat jemand im Rahmen eine
 * andere Seite geöffnet (oder lässt der Browser keinen Blick hinein), beginnt
 * der neue oben. Eine Markierung, die selbst scrollt (VorschauImRahmen),
 * gibt es nur auf der Hofseite; die Startseite im Rahmen scrollt nie selbst.
 */
export function scrollNachNeuladen(alt: { pfadname: string; scrollY: number } | null): number {
  return alt !== null && alt.pfadname === '/' ? Math.max(0, Math.round(alt.scrollY)) : 0
}

// ─── Hinweis unter der Vorschau beim Bearbeiten (Register N16, Ergänzung 23.10.2026; Nr. 155) ─

export type VorschauHinweisLage = {
  /**
   * Der offene Block: `neu` = noch nie gespeichert, `pruefung` = der Satz des
   * Schemas für seinen jetzigen Stand (null = gültig), `fehler` = der Satz der
   * letzten Speicherung, wie ihn das Formular zeigt.
   */
  offen: { neu: boolean; pruefung: string | null; fehler: string | null } | null
  /** Der eben mit „Fertig“ geschlossene Block — bis zur nächsten Änderung oder zum nächsten Wechsel von „Stand am“. */
  geschlossen: { titel: string; liveAb: string; liveBis: string | null } | null
  /** Der Tag, den die Vorschau zeigt (null: es gibt ihn nicht). */
  tag: Date | null
}

/**
 * Welche Zeile unter „So sieht’s die Kundin“ steht. Die Vorschau liest den
 * Entwurf aus der Datenbank: Ein offener Block, der nicht gespeichert ist
 * (neu und ungültig, oder die letzte Speicherung scheiterte), fehlt dort —
 * das sagt die Zeile mit dem Grund. Ein gespeicherter offener Block steht da,
 * egal wann er live ist (blockEntwurfId, zuRendern). Nach „Fertig“ gilt
 * wieder sein Zeitraum: Ist er am gezeigten Tag nicht live, sagt die Zeile
 * warum er fehlt.
 */
export function vorschauHinweis({ offen, geschlossen, tag }: VorschauHinweisLage): string | null {
  if (offen) {
    const grund = offen.fehler ?? (offen.neu ? offen.pruefung : null)
    return grund === null ? null : ENTWURF_TEXT.nochNichtInVorschau(grund)
  }
  if (!geschlossen || !tag) return null
  const liveAb = new Date(geschlossen.liveAb)
  const liveBis = geschlossen.liveBis ? new Date(geschlossen.liveBis) : null
  if (istLive({ liveAb, liveBis }, tag)) return null
  if (liveAb.getTime() > tag.getTime() || !liveBis) return ENTWURF_TEXT.nichtZuSehenAb(geschlossen.titel, terminText(liveAb))
  return ENTWURF_TEXT.nichtZuSehenBis(geschlossen.titel, terminText(liveBis))
}
