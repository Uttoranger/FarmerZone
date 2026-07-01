import { ImageResponse } from 'next/og'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

const ANLASS_EMOJI: Record<string, string> = {
  FRESH_PRODUCT: '🥬',
  NEW_SEASON: '🌱',
  PROMOTION: '🏷️',
  ANNOUNCEMENT: '📢',
}

const ANLASS_LABEL: Record<string, string> = {
  FRESH_PRODUCT: 'Frisches Produkt',
  NEW_SEASON: 'Neue Saison',
  PROMOTION: 'Aktion',
  ANNOUNCEMENT: 'Mitteilung',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const post = await prisma.statusPost.findUnique({
    where: { id },
    select: { title: true, body: true, anlass: true, farm: { select: { name: true } } },
  })

  if (!post) {
    return new Response('Not found', { status: 404 })
  }

  const emoji = ANLASS_EMOJI[post.anlass] ?? '📢'
  const anlassLabel = ANLASS_LABEL[post.anlass] ?? 'Mitteilung'
  const displayBody = post.body.length > 180 ? post.body.slice(0, 180) + '…' : post.body

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
            {emoji} {anlassLabel}
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
                fontSize: '36px',
              }}
            >
              🌱
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontSize: '36px', fontWeight: 700, color: '#1A2B22' }}>
                {post.farm.name}
              </div>
              <div style={{ fontSize: '28px', color: '#5C6F65' }}>via FarmerZone</div>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920 }
  )
}
