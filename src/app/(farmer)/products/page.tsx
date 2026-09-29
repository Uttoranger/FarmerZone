import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getProductsForFarm, getHofBetriebsnummer } from '@/server/queries/products'
import { getMeinHofKopf } from '@/server/queries/farm'
import { ProductList } from '@/components/products/product-list'
import { MeinHofKopf } from '@/components/farmer/mein-hof-kopf'
import { zaehleBeitraege } from '@/server/queries/mein-hof-zahl'

// ?neu=1 und ?edit=<id> liest die Liste selbst (src/lib/use-url-auftrag.ts).
export default async function ProductsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/login')

  const [products, hofBetriebsnummer, kopf, beitraegeZahl] = await Promise.all([
    getProductsForFarm(farm.id),
    getHofBetriebsnummer(farm.id),
    getMeinHofKopf(session.user.id),
    zaehleBeitraege(farm.id),
  ])

  return (
    // Ab lg über die volle Inhaltsbreite: Dort steht die Liste als Tabelle mit
    // fünf Spalten, die in 672 px nicht Platz hätte. Am Handy bleiben Karten.
    <div className="px-4 py-6 max-w-2xl mx-auto lg:max-w-none lg:px-8">
      <MeinHofKopf hof={kopf} aktiv="produkte" produktZahl={products.length} beitraegeZahl={beitraegeZahl} />
      <ProductList products={products} hofBetriebsnummer={hofBetriebsnummer} />
    </div>
  )
}
