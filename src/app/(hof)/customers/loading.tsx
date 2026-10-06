import { KundenLaden } from '@/components/hof-kunden/kunden-laden'

/** Ladeansicht von /customers (Nachtlauf Nr. 22a): Kopf, Filter, Sortierung, Tabelle bzw. Zeilen. */
export default function KundenLadenSeite(): React.JSX.Element {
  return <KundenLaden modus="liste" />
}
