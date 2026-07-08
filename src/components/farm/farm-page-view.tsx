import type { ReactNode } from 'react'
import Link from 'next/link'
import { MapPin, Phone, Mail, Clock, CreditCard, Banknote, Pencil, Eye, Leaf, CalendarDays, Tag, MessageCircle } from 'lucide-react'
import type { PublicFarm } from '@/server/queries/farm'
import type { ActiveStatusPost } from '@/server/queries/status-posts'
import { ProductGrid } from './product-grid'
import { stripStatusVariables } from '@/lib/status-body'

const DAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

const BANNER_GRADIENTS: Record<string, string> = {
  tannengruen: 'linear-gradient(135deg, #1F4732 0%, #3D7B58 60%, #E8F0E8 100%)',
  wiese:       'linear-gradient(135deg, #2D6A4F 0%, #52B788 50%, #D8F3DC 100%)',
  erde:        'linear-gradient(135deg, #6B4226 0%, #A0663E 55%, #F5E6D8 100%)',
  herbst:      'linear-gradient(135deg, #7B4F00 0%, #D4900A 55%, #FFF3CC 100%)',
}

const ANLASS_META: Record<string, { label: string; icon: ReactNode; color: string }> = {
  FRESH_PRODUCT: { label: 'Frisches Produkt', icon: <Leaf className="size-3.5" />,        color: 'bg-green-100 text-green-800' },
  NEW_SEASON:    { label: 'Neue Saison',       icon: <CalendarDays className="size-3.5" />, color: 'bg-emerald-100 text-emerald-800' },
  PROMOTION:     { label: 'Aktion',            icon: <Tag className="size-3.5" />,          color: 'bg-amber-100 text-amber-800' },
  ANNOUNCEMENT:  { label: 'Mitteilung',        icon: <MessageCircle className="size-3.5" />, color: 'bg-blue-100 text-blue-800' },
}

type ReorderItem = { productId: string; productName: string; quantity: number }

type Props = {
  farm: PublicFarm
  activeStatus: ActiveStatusPost | null
  reorderItems?: ReorderItem[]
  ownerMode?: boolean
}

function EditButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="w-9 h-9 rounded-full bg-card shadow-sm border border-border/60 flex items-center justify-center hover:bg-muted transition-colors shrink-0"
      aria-label={label}
    >
      <Pencil className="size-3.5 text-foreground" />
    </Link>
  )
}

function EditPill({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-card/90 shadow-sm border border-border/40 text-xs font-medium text-foreground hover:bg-card transition-colors"
      aria-label={label}
    >
      <Pencil className="size-3 shrink-0" />
      {label}
    </Link>
  )
}

export function FarmPageView({ farm, activeStatus, reorderItems, ownerMode = false }: Props) {
  const bannerBg =
    farm.bannerType === 'PHOTO' && farm.bannerUrl
      ? null
      : BANNER_GRADIENTS[farm.bannerValue ?? 'tannengruen'] ?? BANNER_GRADIENTS.tannengruen

  const sections = farm.sectionsConfig
  function isSectionVisible(key: string) {
    const s = sections.find((s) => s.key === key)
    return s ? s.visible : true
  }

  // Public-only early returns — bypassed in ownerMode
  if (!ownerMode) {
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
              {farm.pauseMessage ?? 'Der Hof ist gerade nicht erreichbar. Bitte versuche es etwas später noch einmal.'}
            </p>
            <a href={`tel:${farm.phone}`} className="mt-6 inline-flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-2">
              <Phone className="w-3.5 h-3.5" />
              {farm.phone}
            </a>
          </div>
        </main>
      )
    }
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
            <a href={`tel:${farm.phone}`} className="mt-6 inline-flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-2">
              <Phone className="w-3.5 h-3.5" />
              {farm.phone}
            </a>
          </div>
        </main>
      )
    }
  }

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
      {!ownerMode && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      {/* ── Owner hint bar ──────────────────────────────────────────── */}
      {ownerMode && (
        <div className="px-4 pt-4 pb-2 max-w-4xl mx-auto">
          <div className="flex items-center justify-between gap-4 bg-primary/10 border border-primary/20 rounded-2xl px-4 py-3">
            <p className="text-sm text-foreground">
              Das ist deine Hof-Seite, wie Kunden sie sehen. Jeder Stift bringt dich zum passenden Editor.
            </p>
            <Link
              href={`/${farm.slug}`}
              target="_blank"
              className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Eye className="size-3.5" />
              Kundenansicht
            </Link>
          </div>
        </div>
      )}

      {/* ── Banner ─────────────────────────────────────────────────── */}
      <div className="h-52 md:h-72 relative overflow-hidden">
        {bannerBg === null ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={farm.bannerUrl!} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="h-full" style={{ background: bannerBg }} />
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background to-transparent" />
        {ownerMode && (
          <div className="absolute top-3 right-3">
            <EditPill href="/settings/appearance" label="Titelbild ändern" />
          </div>
        )}
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
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
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
          </div>
          {ownerMode && (
            <EditButton href="/settings/appearance" label="Hofname & Tagline bearbeiten" />
          )}
        </div>
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
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="font-heading text-lg font-semibold text-foreground">Über uns</h2>
            {ownerMode && <EditButton href="/settings/appearance" label="Über-uns-Text bearbeiten" />}
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">
            {farm.aboutText ?? farm.description}
          </p>
        </section>
      )}

      {/* ── Werte ────────────────────────────────────────────────────── */}
      {isSectionVisible('values') && farm.farmValues.length > 0 && (
        <section className="px-4 pb-8 max-w-4xl mx-auto">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-heading text-lg font-semibold text-foreground">Unsere Werte</h2>
            {ownerMode && <EditButton href="/settings/appearance" label="Werte bearbeiten" />}
          </div>
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
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                  </div>
                  Abholzeiten
                </div>
                {ownerMode && <EditButton href="/settings" label="Abholzeiten bearbeiten" />}
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
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
                  <CreditCard className="w-3.5 h-3.5 text-primary" />
                </div>
                Zahlung & Kontakt
              </div>
              {ownerMode && <EditButton href="/settings" label="Zahlung & Kontakt bearbeiten" />}
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
              <a href={`tel:${farm.phone}`} className="flex items-center gap-2 text-primary hover:underline underline-offset-2">
                <Phone className="w-3.5 h-3.5 shrink-0" />
                {farm.phone}
              </a>
              <a href={`mailto:${farm.email}`} className="flex items-center gap-2 text-primary hover:underline underline-offset-2">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                {farm.email}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Active status post ──────────────────────────────────────── */}
      {/* ownerMode bypasses the section-visibility toggle so /status is always reachable */}
      {(isSectionVisible('status') || ownerMode) && (
        <section className="px-4 pb-6 max-w-4xl mx-auto">
          {activeStatus ? (
            <>
              {(() => {
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
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 ${meta.color}`}>
                          {meta.icon}
                          {meta.label}
                        </span>
                        <span className="text-xs text-muted-foreground">Aktuell · {timeStr}</span>
                      </div>
                      {ownerMode && <EditButton href="/status" label="Status bearbeiten" />}
                    </div>
                    <h2 className="font-heading text-lg font-semibold text-foreground mb-2">
                      {activeStatus.title}
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {stripStatusVariables(activeStatus.body)}
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
              {ownerMode && (
                <Link
                  href="/status/new"
                  className="mt-2 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-colors text-xs text-muted-foreground hover:text-foreground"
                >
                  <span className="font-semibold">+</span>
                  Neuer Status
                </Link>
              )}
            </>
          ) : ownerMode ? (
            <div className="flex flex-col gap-2">
              <Link
                href="/status/new"
                className="flex items-center gap-3 px-4 py-4 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-colors text-muted-foreground hover:text-foreground"
              >
                <div className="w-8 h-8 rounded-full border-2 border-dashed border-current flex items-center justify-center shrink-0 text-lg leading-none">
                  +
                </div>
                <div>
                  <div className="text-sm font-medium">Neuer Status</div>
                  <div className="text-xs mt-0.5">Informiere Kunden über Neuigkeiten vom Hof</div>
                </div>
              </Link>
              <Link
                href="/status"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center py-1"
              >
                Frühere Status ansehen →
              </Link>
            </div>
          ) : null}
        </section>
      )}

      {/* ── Products (client component with cart) ─────────────────── */}
      <ProductGrid
        products={farm.products}
        farmId={farm.id}
        farmSlug={farm.slug}
        initialReorderItems={reorderItems && reorderItems.length > 0 ? reorderItems : undefined}
        ownerMode={ownerMode}
      />

      {/* ── Footer — public only ─────────────────────────────────────── */}
      {!ownerMode && (
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
      )}
    </div>
  )
}
