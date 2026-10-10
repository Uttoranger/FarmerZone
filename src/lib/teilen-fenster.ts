/**
 * Das Teilen-Fenster (Gate 7 Aufgabe 2; Mockups web-h4-teilen-fenster-mit-bild,
 * mobil-h4-teilen-ueber-das-telefon) — die reinen Regeln: welche Produkte
 * anfangs im Bild sind, wie die Auswahl umschaltet und wohin jeder Kanal führt.
 * Die Komponente (src/components/teilen/teilen-fenster.tsx) führt nur aus.
 */
import { TEILEN_BILD_PRODUKTE_MAX, type TeilenAuswahlEintrag } from '@/lib/teilen-bild'
import { teilenLink, type TeilenKanalCode } from '@/lib/teilen-kanal'

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
 * Wohin ein Kanal führt. Jeder Link trägt sein Kürzel (`?k=`), damit die
 * Zählung weiß, woher ein Besuch kam — sonst nichts (S8).
 */
export function kanalZiel(
  kanal: (typeof FENSTER_KANAELE)[number]['kanal'],
  { basis, slug, text, hofName }: { basis: string; slug: string; text: string; hofName: string }
): KanalZiel {
  const link = teilenLink(basis, slug, kanal)
  const mitLink = text.trim() ? `${text.trim()}\n${link}` : link
  switch (kanal) {
    case 'wa':
      return { art: 'oeffnen', href: `https://wa.me/?text=${encodeURIComponent(mitLink)}` }
    case 'fb':
      return { art: 'oeffnen', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}` }
    case 'mail':
      return {
        art: 'oeffnen',
        href: `mailto:?subject=${encodeURIComponent(hofName)}&body=${encodeURIComponent(mitLink)}`,
      }
    case 'wa-status':
    case 'ig':
      return { art: 'bild', text: mitLink, link }
  }
}

/** Was das Fenster vom Server bekommt — nur öffentliche Hofdaten, fertig formatiert. */
export type TeilenFensterDaten = {
  hofName: string
  slug: string
  /** Ursprung der App (APP_URL), für die Links mit `?k=`. */
  basis: string
  /** „farmerzone.at/hof-test" — so steht die Adresse im Feld. */
  adresse: string
  auswahl: TeilenAuswahlEintrag[]
  textVorschlag: string
}
