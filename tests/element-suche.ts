/**
 * Hilfsmittel für die Tests auf die Props einer Client-Komponente
 * (TESTING_GUIDELINES §2): sucht im Baum, den eine Server-Seite als Funktion
 * zurückgibt, das erste Element eines Typs — in Kindern und Listen, auf jeder
 * Tiefe. Gerendert wird nichts. Eine Stelle für Hofseite und Produktseite
 * (vorher je eine Kopie, Nacharbeit Nr. 70 in Nr. 75).
 */
export function findeElement(knoten: unknown, typ: unknown): { props: Record<string, unknown> } | null {
  if (knoten == null || typeof knoten !== 'object') return null
  if (Array.isArray(knoten)) {
    for (const kind of knoten) {
      const fund = findeElement(kind, typ)
      if (fund) return fund
    }
    return null
  }
  const element = knoten as { type?: unknown; props?: Record<string, unknown> }
  if (!element.props) return null
  if (element.type === typ) return { props: element.props }
  return findeElement(element.props.children, typ)
}
