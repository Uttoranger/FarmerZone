/**
 * Die AGB als Datei für den Anhang der Bestätigungsmails (Nr. 207, Auftrag
 * Punkt 1; § 11 ECG, dauerhafter Datenträger — eine Webseite ist keiner,
 * EuGH C-49/11) und die Kennung der Fassung, der ein Hof zustimmt (Punkt 4).
 *
 * Erzeugt aus src/lib/rechtstexte/agb.ts — derselbe Text wie /agb, Wort für
 * Wort: Titel, Stand-Vermerk, Teil A bis D und der Anhang. „Kurz erklärt“ ist
 * kein Teil der AGB und fehlt; die Hinweise für die anwaltliche Prüfung stehen
 * nur in docs/recht/agb.md und nie in agb.ts. Platzhalter füllt dieselbe
 * Quelle wie die Seite (PLATZHALTER_ANGABE), Links zeigen auf die echte Seite.
 *
 * Bewusst eine eigene Datei und nicht agb-einbindung.ts: Die Einbindung lädt
 * Registrierung und Kasse im Browser und darf den AGB-Text nicht mitziehen.
 * Nur Server-Wege (Mail, Zustimmung) importieren diese Datei.
 *
 * HTML ohne Farben und ohne fremde Schrift — es öffnet sich in jedem Browser
 * und druckt schwarz auf weiß; höchstens AGB_DATEI_MAX_BYTES groß (Test).
 */
import { AGB_ANHANG, AGB_STAND_VERMERK, AGB_TEILE, AGB_TITEL, type AgbBlock } from '@/lib/rechtstexte/agb'
import { PLATZHALTER_ANGABE, type AgbStueck } from '@/lib/rechtstexte/stuecke'
import { PRODUKTION_ADRESSE } from '@/lib/umgebung'

/** Obergrenze der Datei (Auftrag 207): 300 kB. */
export const AGB_DATEI_MAX_BYTES = 300 * 1024

/**
 * Die Kennung der Fassung aus dem Stand-Vermerk: „Fassung 0.9 – Entwurf, …“
 * → „0.9“, später „1.0“. Eine Quelle: Ändert die Projektleitung den Vermerk,
 * folgen Dateiname und Zustimmung von selbst. Ohne lesbare Kennung wirft die
 * Funktion — eine Zustimmung zu „irgendeiner“ Fassung gibt es nicht
 * (tests/agb-zustimmung.test.ts hält den Vermerk fest).
 */
export function agbFassung(vermerk: string = AGB_STAND_VERMERK): string {
  const treffer = /Fassung\s+(\d+(?:\.\d+)*)/.exec(vermerk)
  if (!treffer?.[1]) throw new Error('AGB-Stand-Vermerk ohne Kennung der Fassung')
  return treffer[1]
}

/**
 * „agb-<marke>-0.9.html“ — der Name der Marke klein, aus der Domain gelesen
 * (Register M1: Name und Domain stehen unter src/ nur als MARKE bzw.
 * PRODUKTION_HOST, tests/marke-name-wache.test.ts).
 */
export function agbDateiname(fassung: string = agbFassung()): string {
  const marke = new URL(PRODUKTION_ADRESSE).hostname.split('.')[0]
  return `agb-${marke}-${fassung}.html`
}

function maskiere(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Ein relativer Link zeigt in der Datei auf die echte Seite — die Datei liegt beim Lesen nicht auf unserem Server. */
function ziel(href: string): string {
  return href.startsWith('/') ? `${PRODUKTION_ADRESSE}${href}` : href
}

function stueckeAlsHtml(stuecke: readonly AgbStueck[]): string {
  return stuecke
    .map((s) => {
      if (typeof s === 'string') return maskiere(s)
      switch (s.art) {
        case 'fett':
          return `<strong>${stueckeAlsHtml(s.stuecke)}</strong>`
        case 'kursiv':
          return `<em>${maskiere(s.text)}</em>`
        case 'link':
          return `<a href="${maskiere(ziel(s.ziel))}">${maskiere(s.text)}</a>`
        case 'mail':
          return `<a href="mailto:${maskiere(s.adresse)}">${maskiere(s.adresse)}</a>`
        case 'platzhalter':
          return stueckeAlsHtml(PLATZHALTER_ANGABE[s.was])
      }
    })
    .join('')
}

function blockAlsHtml(b: AgbBlock): string {
  switch (b.art) {
    case 'absatz':
      return `<p>${b.nummer ? `<b>${maskiere(b.nummer)}</b> ` : ''}${stueckeAlsHtml(b.stuecke)}</p>`
    case 'liste':
      return `<ul>${b.eintraege.map((e) => `<li>${stueckeAlsHtml(e)}</li>`).join('')}</ul>`
    case 'tabelle':
      return `<table><thead><tr>${b.kopf.map((k) => `<th>${maskiere(k)}</th>`).join('')}</tr></thead><tbody>${b.zeilen
        .map((z) => `<tr>${z.map((zelle) => `<td>${maskiere(zelle)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`
    case 'zeilen':
      return `<p>${b.zeilen.map((z) => stueckeAlsHtml(z)).join('<br>')}</p>`
  }
}

/** Die AGB als eigenständige HTML-Datei (UTF-8). */
export function agbAlsHtml(): string {
  const teile = AGB_TEILE.map(
    (teil) =>
      `<h2>${maskiere(teil.titel)}</h2>${teil.punkte
        .map((p) => `<h3>${p.nummer}. ${maskiere(p.titel)}</h3>${p.bloecke.map(blockAlsHtml).join('')}`)
        .join('')}`
  ).join('')
  const anhang = `<h2>${maskiere(AGB_ANHANG.titel)}</h2>${AGB_ANHANG.bloecke.map(blockAlsHtml).join('')}`
  return [
    '<!doctype html>',
    '<html lang="de"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${maskiere(AGB_TITEL)}</title>`,
    '<style>body{font-family:system-ui,sans-serif;line-height:1.5;max-width:46rem;margin:2rem auto;padding:0 1rem}table{border-collapse:collapse}th,td{border:1px solid;padding:.25rem .5rem;text-align:left;vertical-align:top}</style>',
    '</head><body>',
    `<h1>${maskiere(AGB_TITEL)}</h1>`,
    `<p><i>${maskiere(AGB_STAND_VERMERK)}</i></p>`,
    teile,
    anhang,
    '</body></html>',
  ].join('\n')
}
