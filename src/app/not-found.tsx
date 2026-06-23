import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '404 — FarmerZone' }

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 text-center">
      <span className="text-6xl mb-6">🌾</span>
      <h1 className="text-3xl font-bold text-slate-800 mb-3">Seite nicht gefunden</h1>
      <p className="text-slate-500 mb-8 max-w-sm leading-relaxed">
        Diese Seite existiert nicht oder wurde verschoben.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/"
          className="bg-green-700 hover:bg-green-800 text-white font-semibold rounded-xl px-5 py-2.5 transition-colors"
        >
          Zur Startseite
        </Link>
        <Link
          href="/login"
          className="border border-slate-200 hover:border-slate-300 text-slate-700 font-medium rounded-xl px-5 py-2.5 transition-colors"
        >
          Hofbetreiber-Login
        </Link>
      </div>
    </div>
  )
}
