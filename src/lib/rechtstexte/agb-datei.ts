/**
 * Die AGB als Datei für den Anhang der Bestätigungsmails (Nr. 207, Auftrag
 * Punkt 1; § 11 ECG, dauerhafter Datenträger — eine Webseite ist keiner,
 * EuGH C-49/11) — je Fassung (N45): Jede Bestellung bekommt die Fassung ihres
 * Gebührenmodells (agbFassungFuerBestellung in agb-fassung.ts).
 *
 * Erzeugt aus den Daten der Fassung (agb-0-9.ts, agb.ts) — derselbe Text wie
 * /agb/<Fassung>, Wort für Wort: Titel, Stand-Vermerk, Teil A bis D und die
 * Anhänge. Anhang 1 und 2 von 1.0 kommen aus BELEHRUNG (src/lib/widerruf.ts),
 * mit dessen Platzhaltern statt Hofangaben. „Kurz erklärt“ ist
 * kein Teil der AGB und fehlt; die Hinweise für die anwaltliche Prüfung stehen
 * nur in docs/recht/agb.md und nie in agb.ts. Platzhalter füllt dieselbe
 * Quelle wie die Seite (PLATZHALTER_ANGABE), Links zeigen auf die echte Seite.
 *
 * Bewusst eine eigene Datei und nicht agb-einbindung.ts: Die Einbindung lädt
 * Registrierung und Kasse im Browser und darf den AGB-Text nicht mitziehen.
 * Nur Server-Wege (Mail) importieren diese Datei.
 *
 * HTML ohne Farben und ohne fremde Schrift — es öffnet sich in jedem Browser
 * und druckt schwarz auf weiß; je Fassung höchstens AGB_DATEI_MAX_BYTES groß
 * (Test). Der Stand-Vermerk von 1.0 braucht den Stichtag (`kontext`); den lädt
 * der Aufrufer (src/lib/email.ts), diese Datei bleibt ohne Datenbank.
 */
import { AGB_TEXTE } from '@/lib/rechtstexte/agb-texte'
import type { AgbKennung } from '@/lib/rechtstexte/agb-fassung'
import type { AgbBlock } from '@/lib/rechtstexte/agb-bloecke'
import { PLATZHALTER_ANGABE, type AgbKontext, type AgbStueck } from '@/lib/rechtstexte/stuecke'
import { BELEHRUNG } from '@/lib/widerruf'
import { PRODUKTION_ADRESSE } from '@/lib/umgebung'

/** Obergrenze der Datei (Auftrag 207): 300 kB — je Fassung. */
export const AGB_DATEI_MAX_BYTES = 300 * 1024

/**
 * „agb-<marke>-0.9.html“ — der Name der Marke klein, aus der Domain gelesen
 * (Register M1: Name und Domain stehen unter src/ nur als MARKE bzw.
 * PRODUKTION_HOST, tests/marke-name-wache.test.ts).
 */
export function agbDateiname(kennung: AgbKennung): string {
  const marke = new URL(PRODUKTION_ADRESSE).hostname.split('.')[0]
  return `agb-${marke}-${kennung}.html`
}

function maskiere(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Ein relativer Link zeigt in der Datei auf die echte Seite — die Datei liegt beim Lesen nicht auf unserem Server. */
function ziel(href: string): string {
  return href.startsWith('/') ? `${PRODUKTION_ADRESSE}${href}` : href
}

function stueckeAlsHtml(stuecke: readonly AgbStueck[], kontext: AgbKontext): string {
  return stuecke
    .map((s) => {
      if (typeof s === 'string') return maskiere(s)
      switch (s.art) {
        case 'fett':
          return `<strong>${stueckeAlsHtml(s.stuecke, kontext)}</strong>`
        case 'kursiv':
          return `<em>${maskiere(s.text)}</em>`
        case 'link':
          return `<a href="${maskiere(ziel(s.ziel))}">${maskiere(s.text)}</a>`
        case 'mail':
          return `<a href="mailto:${maskiere(s.adresse)}">${maskiere(s.adresse)}</a>`
        case 'platzhalter':
          return stueckeAlsHtml(PLATZHALTER_ANGABE(kontext)[s.was], kontext)
      }
    })
    .join('')
}

/**
 * Das gesetzliche Muster steht in der Datei in einem eigenen Rahmen
 * (`class="muster"`): So sieht man, wo es beginnt und endet, und
 * tests/agb-wortgleich.test.ts erkennt die Stelle, an der der Text der AGB
 * nur auf src/lib/widerruf.ts verweist.
 */
function musterAlsHtml(art: 'belehrung' | 'formular'): string {
  if (art === 'belehrung') {
    const abschnitte = BELEHRUNG.teilA.abschnitte
      .map((a) => `<h4>${maskiere(a.titel)}</h4>${a.absaetze.map((t) => `<p>${maskiere(t)}</p>`).join('')}`)
      .join('')
    return `<div class="muster">${abschnitte}</div>`
  }
  const b = BELEHRUNG.teilB
  return `<div class="muster"><p>${maskiere(b.einleitung)}</p><p>${b.zeilen.map(maskiere).join('<br>')}</p><p>${maskiere(b.fussnote)}</p></div>`
}

function blockAlsHtml(b: AgbBlock, kontext: AgbKontext): string {
  switch (b.art) {
    case 'absatz':
      return `<p>${b.nummer ? `<b>${maskiere(b.nummer)}</b> ` : ''}${stueckeAlsHtml(b.stuecke, kontext)}</p>`
    case 'liste':
      return `<ul>${b.eintraege.map((e) => `<li>${stueckeAlsHtml(e, kontext)}</li>`).join('')}</ul>`
    case 'tabelle':
      return `<table><thead><tr>${b.kopf.map((k) => `<th>${maskiere(k)}</th>`).join('')}</tr></thead><tbody>${b.zeilen
        .map((z) => `<tr>${z.map((zelle) => `<td>${maskiere(zelle)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`
    case 'zeilen':
      return `<p>${b.zeilen.map((z) => stueckeAlsHtml(z, kontext)).join('<br>')}</p>`
    case 'hinweis':
      return b.kursiv ? `<p><em>${stueckeAlsHtml(b.stuecke, kontext)}</em></p>` : `<p>${stueckeAlsHtml(b.stuecke, kontext)}</p>`
    case 'belehrung':
    case 'formular':
      return musterAlsHtml(b.art)
  }
}

/**
 * Die AGB einer Fassung als eigenständige HTML-Datei (UTF-8). `kontext` füllt
 * den Tag des Inkrafttretens von 1.0; ohne geladenen Stichtag
 * (`inkrafttreten: null`) steht der Ersatzwert da — die Mail geht trotzdem.
 */
export function agbAlsHtml(kennung: AgbKennung, kontext: AgbKontext): string {
  const fassung = AGB_TEXTE[kennung]
  const teile = fassung.teile
    .map(
      (teil) =>
        `<h2>${maskiere(teil.titel)}</h2>${teil.punkte
          .map((p) => `<h3>${p.nummer}. ${maskiere(p.titel)}</h3>${p.bloecke.map((b) => blockAlsHtml(b, kontext)).join('')}`)
          .join('')}`
    )
    .join('')
  const anhaenge = fassung.anhaenge.map((a) => `<h2>${maskiere(a.titel)}</h2>${a.bloecke.map((b) => blockAlsHtml(b, kontext)).join('')}`).join('')
  return [
    '<!doctype html>',
    '<html lang="de"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${maskiere(fassung.titel)}</title>`,
    '<style>body{font-family:system-ui,sans-serif;line-height:1.5;max-width:46rem;margin:2rem auto;padding:0 1rem}table{border-collapse:collapse}th,td{border:1px solid;padding:.25rem .5rem;text-align:left;vertical-align:top}.muster{border-left:2px solid;padding-left:1rem}</style>',
    '</head><body>',
    `<h1>${maskiere(fassung.titel)}</h1>`,
    `<p><i>${maskiere(fassung.vermerk(kontext))}</i></p>`,
    teile,
    anhaenge,
    '</body></html>',
  ].join('\n')
}
