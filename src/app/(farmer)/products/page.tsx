import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getProductsForFarm } from '@/server/queries/products'
import { ProductList } from '@/components/products/product-list'

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/login')

  const products = await getProductsForFarm(farm.id)
  const { edit } = await searchParams

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <ProductList products={products} initialEditId={edit} />
    </div>
  )
}
