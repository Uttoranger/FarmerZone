import { AlterKnopf } from '../components/ui/alter-knopf'
import { Knopf } from '../components/ui/knopf'
import { OhneZweck } from '../components/ui/ohne-zweck'
import { legeBestellungAn } from '../server/aktion'

export async function ladePreis(): Promise<number> {
  const { inCent } = await import('../lib/preis')
  return inCent('1,00')
}

export async function bestelle(): Promise<string> {
  const antwort = await legeBestellungAn('Hof Test')
  return antwort.name
}

export default function Seite(): React.JSX.Element {
  return (
    <main>
      <Knopf text="Bestellen" />
      <AlterKnopf />
      <OhneZweck />
    </main>
  )
}
