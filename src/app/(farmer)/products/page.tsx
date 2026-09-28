import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getProductsForFarm, getHofBetriebsnummer } from '@/server/queries/products'
import { ProductList } from '@/components/products/product-list'

// ?neu=1 und ?edit=<id> liest die Liste selbst (src/lib/use-url-auftrag.ts).
export default async function ProductsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/login')

  const [products, hofBetriebsnummer] = await Promise.all([
    getProductsForFarm(farm.id),
    getHofBetriebsnummer(farm.id),
  ])

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <ProductList products={products} hofBetriebsnummer={hofBetriebsnummer} />
    </div>
  )
}
