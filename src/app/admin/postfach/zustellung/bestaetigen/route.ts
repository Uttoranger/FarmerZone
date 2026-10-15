import { NextResponse, type NextRequest } from 'next/server'
import { BESTAETIGEN_TEXT, ZUSTELLUNG_BESTAETIGEN_PFAD } from '@/lib/zustellung'
import { MARKE } from '@/lib/marke'
import { empfaengerTokenSchema } from '@/schemas/postfach'
import { ladeEmpfaengerBestaetigung } from '@/server/queries/postfach'
import { bestaetigeEmpfaenger } from '@/server/zustellung-bestaetigen'

/*
 * Der Link aus der Bestätigungsmail der Zustellung (Register N14, Nr. 95):
 * /admin/postfach/zustellung/bestaetigen?token=… — OHNE Anmeldung, denn die
 * Adresse gehört oft jemandem ohne Konto. Eine Seite unter /admin hängt immer
 * im Admin-Layout, und das schickt ohne Sitzung zum Login
 * (src/app/admin/layout.tsx → verlangeAdminSeite); eine Routengruppe darunter
 * entkommt ihm nicht. Deshalb ist das hier ein Route Handler: Er steht unter
 * keinem Layout, bleibt an der Adresse der Freigabe und braucht keine Datei
 * außerhalb von src/app/admin/postfach.
 *
 * GET liest nur und zeigt den Knopf — Link-Scanner der Mailprogramme öffnen
 * Links ungefragt (ARCHITECTURE §5). Bestätigt wird erst per POST (Formular
 * auf derselben Adresse, der Token im Körper statt in der Adresse) über
 * bestaetigeEmpfaenger (src/server/zustellung-bestaetigen.ts, bewusst keine
 * Server Action): einmalig, Frist beim Lesen. Die Seite ist schlicht und
 * folgt dem Farbschema des Geräts (color-scheme), weil sie außerhalb der App
 * steht — ohne eigene Farben. Kein Referrer, kein Suchindex, kein Cache.
 */

function html(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function seite(titel: string, satz: string, token: string | null): NextResponse {
  const formular = token
    ? `<form method="post" action="${html(ZUSTELLUNG_BESTAETIGEN_PFAD)}"><input type="hidden" name="token" value="${html(token)}"><button type="submit">${html(BESTAETIGEN_TEXT.knopf)}</button></form>`
    : ''
  const dokument = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex, nofollow">
<title>${html(titel)} · ${html(MARKE)}</title>
<style>body{margin:0;padding:32px 16px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.5}main{max-width:32rem;margin:0 auto}h1{margin:0 0 8px;font-size:1.5rem;line-height:1.25}p{margin:0 0 20px}button{min-height:44px;padding:0 22px;border-radius:999px;font:inherit;font-weight:600;cursor:pointer}</style>
</head>
<body><main><p>${html(MARKE)}</p><h1>${html(titel)}</h1><p>${html(satz)}</p>${formular}</main></body>
</html>`
  return new NextResponse(dokument, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}

function fehlerSeite(zustand: 'abgelaufen' | 'ungueltig'): NextResponse {
  return zustand === 'abgelaufen'
    ? seite(BESTAETIGEN_TEXT.abgelaufenTitel, BESTAETIGEN_TEXT.abgelaufenSatz, null)
    : seite(BESTAETIGEN_TEXT.ungueltigTitel, BESTAETIGEN_TEXT.ungueltigSatz, null)
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = empfaengerTokenSchema.safeParse(request.nextUrl.searchParams.get('token'))
  if (!token.success) return fehlerSeite('ungueltig')
  const stand = await ladeEmpfaengerBestaetigung(token.data, new Date())
  if (stand.zustand !== 'offen') return fehlerSeite(stand.zustand)
  return seite(BESTAETIGEN_TEXT.titel, BESTAETIGEN_TEXT.offenSatz, token.data)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const formular = await request.formData().catch(() => null)
  const ergebnis = await bestaetigeEmpfaenger(formular?.get('token'))
  if ('error' in ergebnis) return fehlerSeite(ergebnis.error)
  return seite(BESTAETIGEN_TEXT.dankeTitel, BESTAETIGEN_TEXT.dankeSatz, null)
}
