import Link from 'next/link'

export const metadata = { title: 'Datenschutz — Bauernshop' }

export default function DatenschutzPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link href="javascript:history.back()" className="text-sm text-green-700 hover:underline mb-6 inline-block">
        ← Zurück
      </Link>
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Datenschutzerklärung</h1>
      <div className="prose prose-slate prose-sm max-w-none space-y-4 text-slate-600">
        <p>
          <strong>Gemäß DSGVO / DSG Österreich</strong>
        </p>
        <p>
          Diese Datenschutzerklärung wird noch ausgefüllt. Sie informiert über die Verarbeitung
          personenbezogener Daten im Rahmen der Bestellabwicklung.
        </p>
        <p className="text-slate-400 text-xs mt-8">Platzhalter — Inhalte folgen in Sprint 8.</p>
      </div>
    </div>
  )
}
