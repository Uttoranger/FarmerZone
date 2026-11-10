/**
 * Die Rechtsblöcke einer gerenderten Mail (Nr. 280, Auftrag 23.3): die Stellen,
 * deren Wortlaut Recht ist und die eine Darstellungs-Nummer nie ändern darf —
 * Belehrung samt Muster-Formular und Gewährleistungs-Mitteilung, Rücktritts-
 * und N39/N43-Sätze, AGB-Zeile, Anbieterzeile mit Impressum, Gebühren-Sätze
 * nach N38.
 *
 * Abgrenzung (bewusst grob, damit nichts durchrutscht):
 *  1. „belehrung“: das HTML vom Absatz mit dem Titel von Teil A der Belehrung
 *     bis zum Ende des Bilds der Gewährleistungs-Mitteilung, am Stück.
 *  2. jedes Element `<p>`, `<a>` oder `<h1>`, das
 *     - auf das Impressum zeigt (Anbieterzeile), oder
 *     - einen Satz aus WIDERRUF_TEXT enthält (N39-Beschriftung, Rücktritt;
 *       kurze Beschriftungen nur als ganzer Text), oder
 *     - eines der Rechtswörter enthält (FAGG, Rücktritt, Widerruf, AGB,
 *       Gewährleistung, Belehrung, Verbraucher, Muster-Formular), oder
 *     - „Gebühr“ in einem ganzen Satz (ab acht Wörtern) nennt — eine
 *       Betragszeile „Plattformgebühr € 0,60“ ist Geld-Darstellung, kein Satz.
 * Verglichen wird je Mail die Liste dieser Blöcke in ihrer Reihenfolge, als
 * SHA-256 des HTML byteweise; dazu der Anfang des Texts, damit eine Abweichung
 * lesbar ist.
 */
import { createHash } from 'node:crypto'
import { BELEHRUNG, WIDERRUF_TEXT } from '@/lib/widerruf'
import { GEWAEHRLEISTUNG_MITTEILUNG } from '@/lib/rechtstexte/gewaehrleistung-mitteilung'
import { MARKE } from '@/lib/marke'
import { PRODUKTION_HOST } from '@/lib/umgebung'

export type Rechtsblock = { anfang: string; sha256: string }

const RECHTSWORT = /FAGG|Rücktritt|zurückgetreten|zurücktreten|[Ww]iderruf|AGB|Gewährleistung|Belehrung|Verbraucher|Muster-?[Ff]ormular/

function klartext(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;|&#xA0;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Alle Zeichenketten aus WIDERRUF_TEXT (auch in Feldern und Listen), ab sechs Zeichen. */
function saetze(wert: unknown): string[] {
  if (typeof wert === 'string') return wert.length >= 6 ? [wert] : []
  if (Array.isArray(wert)) return wert.flatMap(saetze)
  if (wert && typeof wert === 'object') return Object.values(wert).flatMap(saetze)
  return []
}

const WIDERRUF_SAETZE = saetze(WIDERRUF_TEXT)

function block(html: string): Rechtsblock {
  // Marke und Domain als Platzhalter (tests/marke-name-wache.test.ts); der Hash nimmt das HTML, wie es ist.
  const anfang = klartext(html).slice(0, 60).replaceAll(PRODUKTION_HOST, '{{DOMAIN}}').replaceAll(MARKE, '{{MARKE}}')
  return { anfang, sha256: createHash('sha256').update(html).digest('hex') }
}

function istRecht(element: string): boolean {
  if (/href="[^"]*\/impressum"/.test(element)) return true
  const t = klartext(element)
  if (!t) return false
  // Kurze Beschriftungen nur als ganzer Text und nie ein einzelnes Wort (sonst zählt „Bestellnummer“ mit), Sätze auch mitten im Absatz.
  if (WIDERRUF_SAETZE.some((s) => (t === s && s.includes(' ')) || (s.length >= 25 && t.includes(s)))) return true
  if (RECHTSWORT.test(t)) return true
  return /gebühr/i.test(t) && t.split(' ').length >= 8
}

/** Die Rechtsblöcke einer Mail in ihrer Reihenfolge. */
export function rechtsbloecke(html: string): Rechtsblock[] {
  const bloecke: Rechtsblock[] = []
  let rest = html
  const titel = BELEHRUNG.teilA.titel
  const anfangTitel = rest.indexOf(`>${titel}<`)
  if (anfangTitel >= 0) {
    const start = rest.lastIndexOf('<p', anfangTitel)
    const bild = rest.indexOf(GEWAEHRLEISTUNG_MITTEILUNG.pngPfad, anfangTitel)
    const ende = bild >= 0 ? rest.indexOf('>', bild) + 1 : rest.indexOf('</p>', anfangTitel) + 4
    bloecke.push(block(rest.slice(start, ende)))
    // Der Rest ohne die Belehrung, damit ihre Absätze nicht doppelt zählen.
    rest = rest.slice(0, start) + rest.slice(ende)
  }
  for (const m of rest.matchAll(/<(p|a|h1)\b[^>]*>[\s\S]*?<\/\1>/g)) {
    if (istRecht(m[0])) bloecke.push(block(m[0]))
  }
  return bloecke
}
