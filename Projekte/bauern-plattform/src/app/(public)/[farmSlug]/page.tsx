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
      <main
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: 'linear-gradient(160deg, #F4EFE6 0%, #E8F0E8 100%)' }}
      >
        <div className="text-center max-w-sm bg-card rounded-3xl p-10 shadow-[0_8px_24px_oklch(0.18_0.03_150_/_0.08)]">
          <div className="text-5xl mb-5">🏡</div>
          <h1 className="font-heading text-xl font-semibold text-foreground mb-3">{farm.name}</h1>
          <p className="text-muted-foreground leading-relaxed">
            {farm.pauseMessage ??
              'Der Hof ist gerade nicht erreichbar. Bitte versuche es etwas später noch einmal.'}
          </p>
          <a
            href={`tel:${farm.phone}`}
            className="mt-6 inline-flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-2"
          >
            <Phone className="w-3.5 h-3.5" />
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
    <div className="min-h-screen bg-background">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Banner ─────────────────────────────────────────────────── */}
      <div className="h-52 md:h-72 relative overflow-hidden">
        {farm.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={farm.bannerUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div
            className="h-full"
            style={{ background: 'linear-gradient(135deg, #2D5F3F 0%, #7BAE85 60%, #E8F0E8 100%)' }}
          />
        )}
        {/* Soft fade at the bottom to blend into page */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* ── Farm header ─────────────────────────────────────────────── */}
      <div className="px-4 pt-2 pb-4 max-w-4xl mx-auto">
        {farm.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={farm.logoUrl}
            alt={farm.name}
            className="w-16 h-16 rounded-2xl object-cover border-2 border-card shadow-md -mt-6 mb-3"
          />
        )}
        <h1 className="font-heading text-3xl font-semibold text-foreground leading-tight">
          {farm.name}
        </h1>
        <div className="flex items-center gap-1.5 text-muted-foreground text-sm mt-1.5">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span>
            {farm.address}, {farm.postalCode} {farm.city}
          </span>
        </div>
      </div>

      {/* ── About ───────────────────────────────────────────────────── */}
      {farm.description && (
        <section className="px-4 pb-6 max-w-4xl mx-auto">
          <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">{farm.description}</p>
        </section>
      )}

      {/* ── Info cards ──────────────────────────────────────────────── */}
      <section className="px-4 pb-8 max-w-4xl mx-auto">
        <div className={`grid gap-3 ${farm.pickupSlots.length > 0 ? 'sm:grid-cols-2' : ''}`}>

          {/* Pickup slots card */}
          {farm.pickupSlots.length > 0 && (
            <div className="bg-card rounded-2xl p-5 ring-1 ring-border/60 shadow-[0_2px_8px_oklch(0.18_0.03_150_/_0.05)]">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                </div>
                Abholzeiten
              </div>
              <ul className="space-y-1.5">
                {farm.pickupSlots.map((slot, i) => (
                  <li key={i} className="text-sm text-foreground">
                    <span className="font-medium">{DAY_NAMES[slot.dayOfWeek]}</span>
                    <span className="text-muted-foreground ml-1.5">
                      {slot.startTime}–{slot.endTime} Uhr
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Payment + contact card */}
          <div className="bg-card rounded-2xl p-5 ring-1 ring-border/60 shadow-[0_2px_8px_oklch(0.18_0.03_150_/_0.05)]">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
                <CreditCard className="w-3.5 h-3.5 text-primary" />
              </div>
              Zahlung & Kontakt
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {farm.acceptsOnline && (
                <span className="inline-flex items-center gap-1.5 text-xs bg-muted rounded-full px-3 py-1 text-foreground">
                  <CreditCard className="w-3 h-3 text-primary" />
                  Online (Karte)
                </span>
              )}
              {farm.acceptsOnsite && (
                <span className="inline-flex items-center gap-1.5 text-xs bg-muted rounded-full px-3 py-1 text-foreground">
                  <Banknote className="w-3 h-3 text-primary" />
                  Vor Ort (Bar & Karte)
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <a
                href={`tel:${farm.phone}`}
                className="flex items-center gap-2 text-primary hover:underline underline-offset-2"
              >
                <Phone className="w-3.5 h-3.5 shrink-0" />
                {farm.phone}
              </a>
              <a
                href={`mailto:${farm.email}`}
                className="flex items-center gap-2 text-primary hover:underline underline-offset-2"
              >
                <Mail className="w-3.5 h-3.5 shrink-0" />
                {farm.email}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Products (client component with cart) ─────────────────── */}
      <ProductGrid products={farm.products} farmId={farm.id} farmSlug={farm.slug} />

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="px-4 py-8 border-t border-border/50 max-w-4xl mx-auto mt-4">
        <div className="flex flex-wrap items-center gap-5 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} {farm.name}</span>
          <Link href="/impressum" className="hover:text-foreground transition-colors">
            Impressum
          </Link>
          <Link href="/datenschutz" className="hover:text-foreground transition-colors">
            Datenschutz
          </Link>
        </div>
      </footer>
    </div>
  )
}
