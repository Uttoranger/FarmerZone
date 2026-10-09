import { NextRequest, NextResponse } from 'next/server'
import { sendRaw } from '@/lib/email'

// GET /api/test-email?to=adresse@example.com
// Diagnose-Route für den E-Mail-Versand — nur in der lokalen Entwicklung aktiv.
// In Produktion antwortet sie mit 404 und gibt keinerlei Konfiguration preis.
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return new NextResponse(null, { status: 404 })
  }

  const to = request.nextUrl.searchParams.get('to')
  if (!to) {
    return NextResponse.json({ error: 'Query-Parameter "to" fehlt' }, { status: 400 })
  }

  const html = `
    <h1>FarmerZone Test-E-Mail</h1>
    <p>Diese Mail wurde um <strong>${new Date().toLocaleString('de-AT')}</strong> gesendet.</p>
    <p>Wenn du diese Mail siehst, funktioniert der E-Mail-Versand korrekt.</p>
  `

  const result = await sendRaw(to, `FarmerZone Test-E-Mail ${new Date().toISOString()}`, html)

  // Gesperrt (Register Z3): Lokal geht Post nur an TEST_EMPFAENGER und
  // @example.com — dann ist nichts verschickt, und die Antwort sagt das.
  const fehler = result.error ?? (result.gesperrt ? 'Nicht verschickt: Die Adresse steht nicht in TEST_EMPFAENGER.' : null)
  return NextResponse.json({ ok: fehler === null, to, error: fehler })
}
