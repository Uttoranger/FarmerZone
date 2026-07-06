import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { MapPin, Phone, Mail, Clock, CreditCard, Banknote } from 'lucide-react'
import { getPublicFarm } from '@/server/queries/farm'
import { getActiveStatusPost } from '@/server/queries/status-posts'
import { ProductGrid } from '@/components/farm/product-grid'
import { verifyReorderToken } from '@/lib/reorder-token'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ farmSlug: string }>; searchParams: Promise<{ reorder?: string }> }

const DAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

const BANNER_GRADIENTS: Record<string, string> = {
  tannengruen: 'linear-gradient(135deg, #1F4732 0%, #3D7B58 60%, #E8F0E8 100%)',
  wiese:       'linear-gradient(135deg, #2D6A4F 0%, #52B788 50%, #D8F3DC 100%)',
  erde:        'linear-gradient(135deg, #6B4226 0%, #A0663E 55%, #F5E6D8 100%)',
  herbst:      'linear-gradient(135deg, #7B4F00 0%, #D4900A 55%, #FFF3CC 100%)',
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { farmSlug } = await params
  const farm = await getPublicFarm(farmSlug)
  if (!farm) return { title: 'Hof nicht gefunden' }

  const desc = (farm.aboutText ?? farm.description).slice(0, 155)

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

type ReorderItem = { productId: string; productName: string; quantity: number }

async function loadReorderItems(token: string, farmId: string): Promise<ReorderItem[]> {
  const parsed = verifyReorderToken(token)
  if (!parsed || parsed.farmId !== farmId) return []

  const order = await prisma.order.findFirst({
    where: { id: parsed.orderId, farmId },
    select: {
      items: {
        select: { productId: true, productName: true, quantity: true },
      },
    },
  })

  return order?.items ?? []
}

export default async function FarmPage({ params, searchParams }: Props) {
  const { farmSlug } = await params
  const { reorder } = await searchParams
  const farm = await getPublicFarm(farmSlug)

  if (!farm) notFound()

  const activeStatus = await getActiveStatusPost(farm.id)
  const reorderItems = reorder ? await loadReorderItems(reorder, farm.id) : []

  // Derive banner background
  const bannerBg =
    farm.bannerType === 'PHOTO' && farm.bannerUrl
      ? null // use <img> instead
      : BANNER_GRADIENTS[farm.bannerValue ?? 'tannengruen'] ??
        BANNER_GRADIENTS.tannengruen

  // Section visibility helpers
  const sections = farm.sectionsConfig
  function isSectionVisible(key: string) {
    const s = sections.find((s) => s.key === key)
    return s ? s.visible : true
  }

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

  /* ── Setup placeholder — no products AND no slots yet ─────────── */
  if (farm.products.length === 0 && farm.pickupSlots.length === 0) {
    return (
      <main
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: 'linear-gradient(160deg, #F4EFE6 0%, #E8F0E8 100%)' }}
      >
        <div className="text-center max-w-sm bg-card rounded-3xl p-10 shadow-[0_8px_24px_oklch(0.18_0.03_150_/_0.08)]">
          <div className="text-5xl mb-5">🌱</div>
          <h1 className="font-heading text-xl font-semibold text-foreground mb-3">{farm.name}</h1>
          <p className="text-muted-foreground leading-relaxed">
            Dieser Hof richtet gerade seinen Shop ein. Schau bald wieder vorbei!
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Banner ─────────────────────────────────────────────────── */}
      <div className="h-52 md:h-72 relative overflow-hidden">
        {bannerBg === null ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={farm.bannerUrl!} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="h-full" style={{ background: bannerBg }} />
        )}
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
        {farm.tagline && (
          <p className="font-heading text-base italic text-muted-foreground mt-0.5 leading-snug">
            {farm.tagline}
            {farm.foundedYear && (
              <span className="not-italic ml-2 text-sm">· seit {farm.foundedYear}</span>
            )}
          </p>
        )}
        {!farm.tagline && farm.foundedYear && (
          <p className="text-sm text-muted-foreground mt-0.5">seit {farm.foundedYear}</p>
        )}
        <div className="flex items-center gap-1.5 text-muted-foreground text-sm mt-1.5">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span>
            {farm.address}, {farm.postalCode} {farm.city}
          </span>
        </div>
      </div>

      {/* ── Über uns ─────────────────────────────────────────────────── */}
      {isSectionVisible('about') && (farm.aboutText ?? farm.description) && (
        <section className="px-4 pb-6 max-w-4xl mx-auto">
          <h2 className="font-heading text-lg font-semibold text-foreground mb-2">Über uns</h2>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">
            {farm.aboutText ?? farm.description}
          </p>
        </section>
      )}

      {/* ── Werte ────────────────────────────────────────────────────── */}
      {isSectionVisible('values') && farm.farmValues.length > 0 && (
        <section className="px-4 pb-8 max-w-4xl mx-auto">
          <h2 className="font-heading text-lg font-semibold text-foreground mb-3">Unsere Werte</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {farm.farmValues.map((v) => (
              <div
                key={v.id}
                className="bg-card rounded-2xl p-4 ring-1 ring-border/60 shadow-[0_2px_8px_oklch(0.18_0.03_150_/_0.05)]"
              >
                <div className="text-2xl mb-2">{v.icon}</div>
                <div className="font-semibold text-sm text-foreground">{v.title}</div>
                {v.subtitle && (
                  <div className="text-xs text-muted-foreground mt-0.5">{v.subtitle}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Info cards ──────────────────────────────────────────────── */}
      <section className="px-4 pb-8 max-w-4xl mx-auto">
        <div className={`grid gap-3 ${farm.pickupSlots.length > 0 ? 'sm:grid-cols-2' : ''}`}>

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

      {/* ── Active status post ──────────────────────────────────────── */}
      {isSectionVisible('status') && activeStatus && (
        <section className="px-4 pb-6 max-w-4xl mx-auto">
          {(() => {
            const ANLASS_META: Record<string, { label: string; color: string }> = {
              FRESH_PRODUCT: { label: '🥬 Frisches Produkt', color: 'bg-green-100 text-green-800' },
              NEW_SEASON:    { label: '🌱 Neue Saison',      color: 'bg-emerald-100 text-emerald-800' },
              PROMOTION:     { label: '🏷️ Aktion',          color: 'bg-amber-100 text-amber-800' },
              ANNOUNCEMENT:  { label: '📢 Mitteilung',       color: 'bg-blue-100 text-blue-800' },
            }
            const meta = ANLASS_META[activeStatus.anlass] ?? ANLASS_META.ANNOUNCEMENT
            const hoursAgo = Math.floor(
              (Date.now() - new Date(activeStatus.publishedAt).getTime()) / (1000 * 60 * 60),
            )
            const timeStr =
              hoursAgo < 1
                ? 'gerade eben'
                : hoursAgo < 24
                  ? `vor ${hoursAgo} Stunden`
                  : `vor ${Math.floor(hoursAgo / 24)} Tagen`

            return (
              <div className="bg-card rounded-2xl p-5 ring-1 ring-border/60 shadow-[0_2px_8px_oklch(0.18_0.03_150_/_0.05)]">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${meta.color}`}>
                    {meta.label}
                  </span>
                  <span className="text-xs text-muted-foreground">Aktuell · {timeStr}</span>
                </div>
                <h2 className="font-heading text-lg font-semibold text-foreground mb-2">
                  {activeStatus.title}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {activeStatus.body}
                </p>
                {activeStatus.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeStatus.photoUrl}
                    alt={activeStatus.title}
                    className="w-full rounded-xl mt-3 object-cover max-h-48"
                  />
                )}
              </div>
            )
          })()}
        </section>
      )}

      {/* ── Products (client component with cart) ─────────────────── */}
      <ProductGrid
        products={farm.products}
        farmId={farm.id}
        farmSlug={farm.slug}
        initialReorderItems={reorderItems.length > 0 ? reorderItems : undefined}
      />

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
          <Link href="/account/profile" className="hover:text-foreground transition-colors">
            Mein Konto
          </Link>
        </div>
      </footer>
    </div>
  )
}
