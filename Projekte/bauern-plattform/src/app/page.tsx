import Link from 'next/link'
import type { Metadata } from 'next'
import { Leaf, ShoppingBasket, Users } from 'lucide-react'

export const metadata: Metadata = {
  title: 'FarmerZone — Regionale Lebensmittel direkt vom Bauern',
  description: 'Regionale Lebensmittel direkt vom Bauern bestellen und abholen. Pilotbetrieb mit ausgewählten Höfen.',
}

const FEATURES = [
  {
    icon: Leaf,
    title: 'Frisch vom Hof',
    desc: 'Produkte direkt von lokalen Landwirtschaftsbetrieben in deiner Region.',
    iconBg: '#E8F0E8',
    iconColor: '#2D5F3F',
  },
  {
    icon: ShoppingBasket,
    title: 'Einfach bestellen',
    desc: 'Online reservieren und zur vereinbarten Zeit bequem abholen.',
    iconBg: '#F4EFE6',
    iconColor: '#B86A2E',
  },
  {
    icon: Users,
    title: 'Regional stärken',
    desc: 'Unterstütze Bauern in deiner Umgebung und stärke die lokale Wirtschaft.',
    iconBg: '#E8F0E8',
    iconColor: '#2D5F3F',
  },
]

export default function HomePage() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(160deg, #F4EFE6 0%, #E8F0E8 55%, #FAFAF7 100%)' }}
    >
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">

        {/* Organic leaf SVG */}
        <div className="mb-8">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="40" cy="40" r="40" fill="#E8F0E8" />
            <path
              d="M40 64 C40 64 22 53 22 35 C22 24 30 16 40 16 C50 16 58 24 58 35 C58 53 40 64 40 64Z"
              fill="#2D5F3F"
            />
            <path
              d="M40 64 L40 44"
              stroke="#7BAE85"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M40 50 C35 47 27 46 24 39"
              stroke="#7BAE85"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M40 44 C45 41 53 40 56 33"
              stroke="#7BAE85"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Wordmark */}
        <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase mb-3">
          FarmerZone
        </p>

        {/* Headline */}
        <h1 className="font-heading text-4xl sm:text-5xl font-semibold text-foreground mb-4 leading-tight max-w-sm">
          Frisch vom Hof.<br />Direkt zu dir.
        </h1>

        {/* Subline */}
        <p className="text-lg text-muted-foreground max-w-xs mb-5 leading-relaxed">
          Regionale Lebensmittel von lokalen Bauern — bestellen, abholen, genießen.
        </p>

        {/* Pilot badge */}
        <div className="inline-flex items-center gap-2 bg-card/80 border border-border rounded-full px-3.5 py-1.5 text-xs text-muted-foreground mb-14">
          <span className="size-1.5 rounded-full bg-[#E8854A] animate-pulse" />
          Pilotbetrieb mit ausgewählten Höfen
        </div>

        {/* Feature cards */}
        <div className="grid sm:grid-cols-3 gap-5 max-w-2xl w-full mb-14">
          {FEATURES.map(({ icon: Icon, title, desc, iconBg, iconColor }, i) => (
            <div
              key={title}
              className="bg-card rounded-2xl p-6 text-left transition-[transform,box-shadow] duration-[250ms] ease-out hover:-translate-y-1.5"
              style={{
                boxShadow: '0 4px 16px oklch(0.38 0.089 150 / 0.06), 0 1px 3px oklch(0.38 0.089 150 / 0.04)',
                transitionDelay: `${i * 30}ms`,
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                style={{ backgroundColor: iconBg }}
              >
                <Icon className="w-5 h-5" style={{ color: iconColor }} strokeWidth={1.75} />
              </div>
              <h3 className="font-heading font-semibold text-foreground mb-2 text-base">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-primary-foreground font-semibold text-sm transition-[transform,opacity,box-shadow] duration-[250ms] ease-out hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0"
          style={{
            backgroundColor: '#2D5F3F',
            boxShadow: '0 4px 16px oklch(0.38 0.089 150 / 0.3), 0 2px 4px oklch(0.38 0.089 150 / 0.15)',
          }}
        >
          Hofbetreiber-Login
        </Link>
      </main>

      <footer className="py-6 px-6 border-t border-border/50">
        <div className="max-w-2xl mx-auto flex flex-wrap justify-center gap-5 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} FarmerZone</span>
          <Link href="/impressum" className="hover:text-foreground transition-colors duration-[250ms]">
            Impressum
          </Link>
          <Link href="/datenschutz" className="hover:text-foreground transition-colors duration-[250ms]">
            Datenschutz
          </Link>
        </div>
      </footer>
    </div>
  )
}
