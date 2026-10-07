import { KundenLaden } from '@/components/hof-kunden/kunden-laden'

/** Ladeansicht von /customers/[kundeId] (Nachtlauf Nr. 22a): Kopfkarte, Kennzahlen, Bestellungen. */
export default function KundinLadenSeite(): React.JSX.Element {
  return <KundenLaden modus="detail" />
}
