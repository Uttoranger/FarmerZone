import Link from 'next/link'
import { Wheat } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '404 — FarmerZone' }

export default function NotFound() {
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center px-4 text-center">
      <Wheat className="mb-6 size-12 text-brand-text" strokeWidth={1.5} aria-hidden="true" />
      <h1 className="text-3xl font-bold text-foreground mb-3">Seite nicht gefunden</h1>
      <p className="text-muted-foreground mb-8 max-w-sm leading-relaxed">
        Diese Seite existiert nicht oder wurde verschoben.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/"
          className="bg-primary text-primary-foreground hover:opacity-90 font-semibold rounded-xl px-5 py-2.5 transition-colors"
        >
          Zur Startseite
        </Link>
        <Link
          href="/login"
          className="border border-border hover:border-border text-foreground font-medium rounded-xl px-5 py-2.5 transition-colors"
        >
          Hofbetreiber-Login
        </Link>
      </div>
    </div>
  )
}

