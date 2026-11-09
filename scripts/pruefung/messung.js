// Messung im Browser (wie Lauf 31, abnahme-lauf31.md „So gemessen“), über
// `agent-browser eval "$(cat scripts/pruefung/messung.js)"`. Ein Ausdruck,
// Ergebnis als JSON-Text:
//   schrift  sichtbare Texte < 12 px (ohne aria-hidden und SVG)
//   ziele    Bedienelemente < 44 px ohne ::before/::after-Vergrößerung
//            (Inline-Links im Fließtext getrennt als zieleImText)
//   h1       Zahl der sichtbaren h1 — oder „Dialog offen“, solange ein
//            sichtbares aria-modal- oder role="dialog"-Element offen ist
//            (Register N48: eine h1 hinter einem offenen Dialog oder Blatt
//            fehlt nicht; role="dialog" auch ohne aria-modal wie das
//            Mehr-Blatt im Hofbereich, Nr. 262b)
//   Inhalte geschlossener <details> zählen nirgends mit (checkVisibility,
//   Rückfall über das nächste <details> ohne open, Nr. 262).
//   felder   Eingabefelder ohne sichtbare Beschriftung (Platzhalter oder
//            aria-label allein zählen nicht)
// Liest nur, ändert nichts an der Seite.
;(() => {
  // Inhalt eines geschlossenen <details> (außer seiner <summary>): Chromium
  // blendet ihn über content-visibility aus, die Box misst trotzdem.
  const inGeschlossenemDetails = (el) => {
    if (typeof el.checkVisibility === 'function') return !el.checkVisibility()
    const details = el.closest('details:not([open])')
    return Boolean(details) && !el.closest('summary')
  }
  const sichtbar = (el) => {
    const r = el.getBoundingClientRect()
    // sr-only (1 × 1 px, z. B. „Zum Inhalt springen“ vor dem Fokus) zählt als unsichtbar.
    if (r.width <= 2 || r.height <= 2) return false
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false
    // sr-only mit Innenabstand misst mehr als 1 px, ist aber weggeschnitten.
    if (s.clip === 'rect(0px, 0px, 0px, 0px)' || s.clipPath === 'inset(50%)') return false
    if (el.closest('[aria-hidden="true"], [hidden], [inert]')) return false
    return !inGeschlossenemDetails(el)
  }
  const kurz = (el) => {
    const t = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.tagName).trim()
    return t.replace(/\s+/g, ' ').slice(0, 40)
  }

  const schrift = []
  const laeufer = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const gesehen = new Set()
  while (laeufer.nextNode()) {
    const knoten = laeufer.currentNode
    const el = knoten.parentElement
    if (!el || gesehen.has(el) || !knoten.textContent.trim()) continue
    gesehen.add(el)
    if (el.closest('svg, script, style, noscript, nextjs-portal')) continue
    if (!sichtbar(el)) continue
    const px = parseFloat(getComputedStyle(el).fontSize)
    if (px < 12) schrift.push({ px, text: kurz(el) })
  }

  const ziele = []
  const zieleImText = []
  const pseudoGross = (el) =>
    ['::before', '::after'].some((p) => {
      const s = getComputedStyle(el, p)
      if (s.content === 'none' || s.content === 'normal') return false
      return s.position === 'absolute' && (parseFloat(s.width) >= 44 || parseFloat(s.height) >= 44 || s.inset !== 'auto')
    })
  for (const el of document.querySelectorAll('a[href], button, [role="button"], input:not([type="hidden"]), select, textarea, summary, [role="tab"], [role="switch"], [role="checkbox"], [role="radio"]')) {
    if (el.closest('nextjs-portal')) continue
    if (!sichtbar(el)) continue
    const r = el.getBoundingClientRect()
    if (r.width >= 44 && r.height >= 44) continue
    if (pseudoGross(el) || [...el.querySelectorAll('*')].some((k) => pseudoGross(k))) continue
    // Ein Kästchen in einem Label zählt mit dem Label.
    const label = el.closest('label')
    if (label) {
      const lr = label.getBoundingClientRect()
      if (lr.width >= 44 && lr.height >= 44) continue
    }
    const eintrag = { b: Math.round(r.width), h: Math.round(r.height), text: kurz(el) }
    const imText = el.tagName === 'A' && getComputedStyle(el).display === 'inline' && /\S/.test(el.parentElement?.textContent?.replace(el.textContent ?? '', '') ?? '')
    ;(imText ? zieleImText : ziele).push(eintrag)
  }

  // Ein offener Dialog oder ein offenes Blatt (aria-modal oder role="dialog",
  // sichtbar): Die h1 der Seite dahinter ist für Vorleseprogramme ausgeblendet
  // bzw. verdeckt — gemeldet wird „Dialog offen“ statt einer Zahl. role="dialog"
  // zählt auch ohne aria-modal: Das Mehr-Blatt im Hofbereich trägt nur die
  // Rolle, und die Messung meldete dort h1 0 (Nr. 262b).
  const dialogOffen = [...document.querySelectorAll('[aria-modal="true"], [role="dialog"]')].some((d) => sichtbar(d))
  const h1Zahl = [...document.querySelectorAll('h1')].filter((h) => {
    const r = h.getBoundingClientRect()
    // sr-only zählt als vorhanden (für Vorleseprogramme), aria-hidden nicht.
    if (h.closest('[aria-hidden="true"], [hidden]') || inGeschlossenemDetails(h)) return false
    return r.width > 0 || h.className.toString().includes('sr-only')
  }).length
  const h1 = dialogOffen ? 'Dialog offen' : h1Zahl

  const felder = []
  for (const el of document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea')) {
    if (!sichtbar(el)) continue
    const id = el.getAttribute('id')
    const mitFor = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null
    const umschliessend = el.closest('label')
    const beschriftet = [mitFor, umschliessend].some((l) => l && sichtbar(l) && l.innerText.trim().length > 0)
    const perAria = (el.getAttribute('aria-labelledby') || '')
      .split(/\s+/)
      .filter(Boolean)
      .some((ref) => {
        const ziel = document.getElementById(ref)
        return ziel && sichtbar(ziel) && ziel.innerText.trim().length > 0
      })
    if (!beschriftet && !perAria) felder.push(`${el.tagName.toLowerCase()}[${el.getAttribute('type') ?? ''}] ${el.getAttribute('name') ?? ''} ${el.getAttribute('aria-label') ?? el.getAttribute('placeholder') ?? ''}`.trim())
  }

  return JSON.stringify({
    url: location.pathname,
    breite: innerWidth,
    dunkel: document.documentElement.classList.contains('dark') || matchMedia('(prefers-color-scheme: dark)').matches,
    schrift: schrift.length,
    ziele: ziele.length,
    zieleImText: zieleImText.length,
    h1,
    felder: felder.length,
    beispiele: { schrift: schrift.slice(0, 8), ziele: ziele.slice(0, 8), felder: felder.slice(0, 8) },
  })
})()
