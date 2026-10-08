import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { getPublicFarmGeteilt } from '@/server/queries/farm'
import { getBetriebsVorbelegung, getNurBetriebeProduktIds } from '@/server/queries/products'
import { CheckoutForm } from '@/components/checkout/checkout-form'
import { ausgebuchteAbholfenster } from '@/server/abholfenster'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'
import { kassenVorbelegung } from '@/lib/kasse'
import { KAEUFER_PARAMETER, leseKaeuferVorbelegung } from '@/schemas/kaeufer-vorbelegung'

interface Props {
  params: Promise<{ farmSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { farmSlug } = await params
  // Dieselbe Abfrage wie die Seite, einmal je Anfrage (Nr. 47): Zwei getrennte
  // Aufrufe liefen in einer Prisma-Transaktion gleichzeitig über eine Verbindung.
  const farm = await getPublicFarmGeteilt(farmSlug)
  return { title: farm ? `Bestellen — ${farm.name}` : 'Bestellen' }
}

export default async function CheckoutPage({ params, searchParams }: Props) {
  const { farmSlug } = await params
  // `?kaeufer=betrieb` aus „Region › Futter kaufen" (Nr. 29): nur der Startwert
  // des Hakens „Betrieb" — Ungültiges fällt im Schema still weg.
  const suche = await searchParams
  const kaeufer = leseKaeuferVorbelegung(suche[KAEUFER_PARAMETER])
  const farm = await getPublicFarmGeteilt(farmSlug)

  if (!farm || farm.isPaused) notFound()

  // Abschnitt „Betrieb" (Sprint Bereiche 1): welche Produkte nur an Betriebe
  // gehen, und — ist der Besteller selbst ein Hof — die Vorbelegung. Die
  // Session wird hier auf dem Server gelesen wie im Bauern-Bereich; kein
  // zusätzlicher Request aus dem Browser. Gast bleibt Gast.
  const session = await auth.api.getSession({ headers: await headers() })
  // Frist gilt beim Lesen (src/lib/fristen.ts): Verwaiste Bestellungen geben
  // ihren Platz im Abholfenster frei, BEVOR gezählt wird — sonst stünde ein
  // Fenster als „ausgebucht" da, das /api/checkout annehmen würde.
  await gibVerwaisteFreiOhneRisiko(farm.id)

  // Volle Abholfenster (maxOrders erreicht) zeigt das Formular ausgegraut —
  // dieselbe Zählung, mit der /api/checkout ablehnt (src/server/abholfenster.ts).
  const [nurBetriebeIds, ausHof, ausgebucht] = await Promise.all([
    getNurBetriebeProduktIds(farm.id),
    session?.user ? getBetriebsVorbelegung(session.user.id) : Promise.resolve(null),
    ausgebuchteAbholfenster(farm.id, new Date()),
  ])

  // Die Fokus-Shell (Nachtlauf Nr. 12) rendert CheckoutForm selbst: Ihr
  // „Zurück" hängt am Zustand im Browser — hinaus zum Hof nur, solange keine
  // Bestellung steht (kassenZurueck, src/lib/kasse.ts).
  return (
    <CheckoutForm
      farm={farm}
      nurBetriebeIds={nurBetriebeIds}
      vorbelegung={kassenVorbelegung(ausHof, kaeufer)}
      ausgebuchteAbholfenster={ausgebucht}
    />
  )
}
