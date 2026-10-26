import { ImageResponse } from 'next/og'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { OEFFENTLICH_SICHTBAR } from '@/server/queries/farm'
import { AKTIVER_BEITRAG } from '@/server/queries/status-posts'
import { stripStatusVariables } from '@/lib/status-body'
import { hofInitialen } from '@/lib/hof-initialen'
import { MARKE } from '@/lib/marke'
import { MARKE_RUNDUNG_PROZENT, ladeMarkeDataUrl } from '@/lib/marke-bild'
import { BEITRAG_ANLASS } from '@/lib/beitrag-anlass'

export const runtime = 'nodejs'

/** Schaut das Konto des Hofs selbst? Nur dann zeigt sich ein Testhof (N21). */
async function istEigenerHof(req: NextRequest, ownerId: string): Promise<boolean> {
  const sitzung = await auth.api.getSession({ headers: req.headers })
  return sitzung?.user.id === ownerId
}

/** Die Bildmarke im Fuß: 64 px, über der Grenze von 48 px, also die volle Fassung. */
const MARKE_KANTE = 64

/*
 * Bild eines Beitrags im Story-Format. Im Code nirgends verlinkt (Vorschlag
 * zum Entfernen: Bericht Nr. 178); bis dahin dieselbe Sichtbarkeit wie die
 * Hofseite: Hof freigeschaltet, aktiv und nicht stillgelegt
 * (OEFFENTLICH_SICHTBAR), Beitrag veröffentlicht, nicht abgelaufen und „Auf
 * der Hofseite zeigen" (AKTIVER_BEITRAG) — sonst 404, gleich ob es den
 * Beitrag gibt. Ein Testhof (N21) nur für sein eigenes Konto: Ein Fremder
 * bekommt über eine geratene Kennung kein Bild aus einem Testhof.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const post = await prisma.statusPost.findFirst({
    where: { id, AND: [AKTIVER_BEITRAG(new Date())], farm: OEFFENTLICH_SICHTBAR },
    select: { title: true, body: true, anlass: true, farm: { select: { name: true, istTesthof: true, ownerId: true } } },
  })

  if (!post || (post.farm.istTesthof && !(await istEigenerHof(req, post.farm.ownerId)))) {
    return new Response('Not found', { status: 404 })
  }

  const anlassLabel = BEITRAG_ANLASS[post.anlass].wort
  const cleanBody = stripStatusVariables(post.body)
  const displayBody = cleanBody.length > 180 ? cleanBody.slice(0, 180) + '…' : cleanBody
  // Die Bildmarke als Bild aus public/marke (Register M1, Nr. 92): Satori zeichnet SVG als <img>, gezeichnet wird sie nirgends.
  const marke = await ladeMarkeDataUrl('voll')

  return new ImageResponse(
    (
      <div
        style={{
          width: '1080px',
          height: '1920px',
          background: 'linear-gradient(160deg, #F4EFE6 0%, #E8F0E8 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            background: 'white',
            borderRadius: '48px',
            padding: '80px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 32px 80px rgba(45,95,63,0.12)',
          }}
        >
          {/* Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: '#E8F0E8',
              borderRadius: '100px',
              padding: '12px 28px',
              marginBottom: '40px',
              width: 'fit-content',
              color: '#2D5F3F',
              fontSize: '36px',
              fontWeight: 600,
            }}
          >
            {anlassLabel}
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: '72px',
              fontWeight: 800,
              color: '#1A2B22',
              lineHeight: 1.15,
              marginBottom: '36px',
            }}
          >
            {post.title}
          </div>

          {/* Body */}
          <div
            style={{
              fontSize: '40px',
              color: '#374151',
              lineHeight: 1.55,
              marginBottom: '60px',
            }}
          >
            {displayBody}
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              paddingTop: '40px',
              borderTop: '2px solid #E8E5DC',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: '#2D5F3F',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                fontWeight: 700,
                // ImageResponse kennt keine CSS-Variablen — Weiß auf dem
                // dunkelgrünen Kästchen wie die übrigen festen Farben der Grafik.
                color: 'white',
              }}
            >
              {/* Die Initialen des Hofs statt eines Emojis — wie in der
                  Navigation, wenn ein Hof noch kein Logo hat. */}
              {hofInitialen(post.farm.name)}
            </div>
            {/* flex 1 + minWidth 0: Die Spalte nimmt den Platz neben dem
                Symbol und keinen Pixel mehr — sonst liefe ein langer Hofname
                über den Kartenrand hinaus. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
              {/* Höchstens zwei Zeilen mit „…" (Satori kappt nur mit
                  display block + lineClamp); wordBreak, damit auch ein Name
                  ohne Leerzeichen umbricht statt über den Rand zu laufen. Ein
                  Bild hat kein title — der volle Name steht auf der Hofseite,
                  zu der das Bild führt. */}
              <div
                style={{
                  display: 'block',
                  lineClamp: 2,
                  wordBreak: 'break-word',
                  fontSize: '36px',
                  fontWeight: 700,
                  color: '#1A2B22',
                }}
              >
                {post.farm.name}
              </div>
              <div style={{ fontSize: '28px', color: '#5C6F65' }}>{`via ${MARKE}`}</div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori (next/og) zeichnet nur <img>, next/image gibt es dort nicht */}
            <img
              src={marke}
              alt=""
              width={MARKE_KANTE}
              height={MARKE_KANTE}
              style={{
                width: `${MARKE_KANTE}px`,
                height: `${MARKE_KANTE}px`,
                borderRadius: `${Math.round((MARKE_KANTE * MARKE_RUNDUNG_PROZENT) / 100)}px`,
                flexShrink: 0,
              }}
            />
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920 }
  )
}
