import { NextRequest, NextResponse } from 'next/server'
import { sendRaw } from '@/lib/email'

// GET /api/test-email?to=deine@email.at
// Sendet eine Test-E-Mail und gibt das Ergebnis als JSON zurück.
// NUR für lokale Diagnose — in Produktion entfernen oder absichern.
export async function GET(request: NextRequest) {
  const to = request.nextUrl.searchParams.get('to') ?? 'j.f.briewasser@gmail.com'

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM ?? 'onboarding@resend.dev'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const html = `
    <h1>FarmerZone Test-E-Mail</h1>
    <p>Diese Mail wurde um <strong>${new Date().toLocaleString('de-AT')}</strong> gesendet.</p>
    <p><strong>RESEND_API_KEY:</strong> ${apiKey ? `gesetzt (${apiKey.slice(0, 8)}…)` : '❌ FEHLT'}</p>
    <p><strong>EMAIL_FROM:</strong> ${from}</p>
    <p><strong>APP_URL:</strong> ${appUrl}</p>
    <hr/>
    <p>Wenn du diese Mail siehst, funktioniert der E-Mail-Versand korrekt.</p>
  `

  const result = await sendRaw(to, `FarmerZone Test-E-Mail ${new Date().toISOString()}`, html)

  return NextResponse.json({
    to,
    from,
    apiKeySet: !!apiKey,
    apiKeyPrefix: apiKey ? apiKey.slice(0, 8) + '…' : null,
    result,
  })
}
