import { BestellungenLaden } from '@/components/hof-bestellungen/bestellungen-laden'

/** Ladeansicht von /orders/[orderId] (Nachtlauf Nr. 19): am Handy die Bestellung, ab 1024 px Liste und Bestellung. */
export default function BestellungLadenSeite(): React.JSX.Element {
  return <BestellungenLaden modus="detail" />
}
