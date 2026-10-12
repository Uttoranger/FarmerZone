/**
 * Der Knopf der Beispiel-Seite, z. B. zum Bestellen. Dieser zweite Satz steht nicht im Verzeichnis.
 */
export function Knopf({ text }: { text: string }): React.JSX.Element {
  return <button type="button">{text}</button>
}
