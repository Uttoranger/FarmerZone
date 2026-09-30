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

  const [products, hofBetriebsnummer] = await Promise.all([getProductsForFarm(farm.id), getHofBetriebsnummer(farm.id)])

  return (
    // Ab lg über die volle Inhaltsbreite: Dort steht die Liste als Tabelle mit
    // fünf Spalten, die in 672 px nicht Platz hätte. Am Handy bleiben Karten.
    <div className="px-4 py-6 max-w-2xl mx-auto lg:max-w-none lg:px-8">
      {/* Produkte sind Tagesgeschäft mit eigenem Platz in der Leiste — kein
          Kopf von „Mein Hof" mehr darüber (Mockup hof-sidebar-komponente.html). */}
      <header className="mb-6 print:hidden">
        <h1 className="font-heading text-2xl font-semibold text-app-ink">Produkte</h1>
        <p className="mt-1 text-sm text-app-ink-soft">
          {products.length === 1 ? 'Ein Produkt' : `${products.length} Produkte`} · Foto, Preis, Lagerstand.
        </p>
      </header>
      <ProductList products={products} hofBetriebsnummer={hofBetriebsnummer} />
    </div>
  )
}
