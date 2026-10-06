import { BestellungenLaden } from '@/components/hof-bestellungen/bestellungen-laden'

/** Ladeansicht von /orders (Nachtlauf Nr. 19): am Handy die Liste, ab 1024 px Liste und Bestellung. */
export default function BestellungenLadenSeite(): React.JSX.Element {
  return <BestellungenLaden modus="liste" />
}
