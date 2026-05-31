import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { MapPin, Phone, Mail, Clock, CreditCard, Banknote } from 'lucide-react'
import { getPublicFarm } from '@/server/queries/farm'
import { ProductGrid } from '@/components/farm/product-grid'

export const revalidate = 60

type Props = { params: Promise<{ farmSlug: string }> }

const DAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { farmSlug } = await params
  const farm = await getPublicFarm(farmSlug)
  if (!farm) return { title: 'Hof nicht gefunden' }

  const desc = farm.description.slice(0, 155) + (farm.description.length > 155 ? '…' : '')

  return {
    title: `${farm.name} — Frische Produkte direkt vom Hof`,
    description: desc,
    openGraph: {
      title: farm.name,
      description: desc,
      type: 'website',
      ...(farm.bannerUrl ? { images: [{ url: farm.bannerUrl }] } : {}),
    },
  }
}

export default async function FarmPage({ params }: Props) {
  const { farmSlug } = await params
  const farm = await getPublicFarm(farmSlug)

  if (!farm) notFound()

  /* ── Paused state ─────────────────────────────────────────────── */
  if (farm.isPaused) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🏡</div>
          <h1 className="text-xl font-semibold text-slate-800 mb-2">{farm.name}</h1>
          <p className="text-slate-600 leading-relaxed">
            {farm.pauseMessage ??
              'Der Hof ist gerade nicht erreichbar. Bitte versuche es etwas später noch einmal.'}
          </p>
          <a
            href={`tel:${farm.phone}`}
            className="mt-5 inline-block text-sm text-green-700 underline underline-offset-2"
          >
            {farm.phone}
          </a>
        </div>
      </main>
    )
  }

  /* ── JSON-LD ──────────────────────────────────────────────────── */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: farm.name,
    description: farm.description,
    telephone: farm.phone,
    email: farm.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: farm.address,
      postalCode: farm.postalCode,
      addressLocality: farm.city,
      addressCountry: 'AT',
    },
  }

  return (
    <div className="min-h-screen bg-white">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Banner ────────────────────────────────────────────────── */}
      <div className="h-44 md:h-64 relative overflow-hidden">
        {farm.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={farm.bannerUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="h-full bg-gradient-to-br from-green-700 via-green-800 to-green-950" />
        )}
        {/* Gradient overlay at bottom for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
      </div>

      {/* ── Farm header ───────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3 max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold text-slate-900">{farm.name}</h1>
        <div className="flex items-center gap-1.5 text-slate-500 text-sm mt-1">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span>
            {farm.address}, {farm.postalCode} {farm.city}
          </span>
        </div>
      </div>

      {/* ── About ─────────────────────────────────────────────────── */}
      <section className="px-4 pb-5 max-w-4xl mx-auto">
        <p className="text-slate-600 text-sm leading-relaxed">{farm.description}</p>
      </section>

      {/* ── Info box ──────────────────────────────────────────────── */}
      <section className="px-4 pb-6 max-w-4xl mx-auto">
        <div className="bg-slate-50 rounded-2xl p-4 space-y-4">
          {/* Pickup slots */}
          {farm.pickupSlots.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                <Clock className="w-3.5 h-3.5" />
                Abholzeiten
              </div>
              <ul className="space-y-1">
                {farm.pickupSlots.map((slot, i) => (
                  <li key={i} className="text-sm text-slate-700">
                    <span className="font-medium">{DAY_NAMES[slot.dayOfWeek]}</span>{' '}
                    {slot.startTime}–{slot.endTime} Uhr
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Payment */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              <CreditCard className="w-3.5 h-3.5" />
              Zahlung
            </div>
            <div className="flex flex-wrap gap-2">
              {farm.acceptsOnline && (
                <span className="inline-flex items-center gap-1 text-xs bg-white border border-slate-200 rounded-full px-2.5 py-1">
                  <CreditCard className="w-3 h-3 text-blue-500" />
                  Online (Karte)
                </span>
              )}
              {farm.acceptsOnsite && (
                <span className="inline-flex items-center gap-1 text-xs bg-white border border-slate-200 rounded-full px-2.5 py-1">
                  <Banknote className="w-3 h-3 text-green-600" />
                  Vor Ort (Bar & Karte)
                </span>
              )}
            </div>
          </div>

          {/* Contact */}
          <div className="flex flex-wrap gap-3 text-sm">
            <a
              href={`tel:${farm.phone}`}
              className="flex items-center gap-1.5 text-green-700 hover:underline"
            >
              <Phone className="w-3.5 h-3.5" />
              {farm.phone}
            </a>
            <a
              href={`mailto:${farm.email}`}
              className="flex items-center gap-1.5 text-green-700 hover:underline"
            >
              <Mail className="w-3.5 h-3.5" />
              {farm.email}
            </a>
          </div>
        </div>
      </section>

      {/* ── Products (client component with cart) ─────────────────── */}
      <ProductGrid products={farm.products} farmId={farm.id} farmSlug={farm.slug} />

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="px-4 py-6 border-t border-slate-100 max-w-4xl mx-auto mt-4">
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
          <span>© {new Date().getFullYear()} {farm.name}</span>
          <Link href="/impressum" className="hover:text-slate-600 underline underline-offset-2">
            Impressum
          </Link>
          <Link href="/datenschutz" className="hover:text-slate-600 underline underline-offset-2">
            Datenschutz
          </Link>
        </div>
      </footer>
    </div>
  )
}
