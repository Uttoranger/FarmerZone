import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Called by Vercel Cron every 5 minutes (see vercel.json)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // Require secret in production
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await prisma.stockReservation.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })

  return NextResponse.json({ deleted: result.count, at: new Date().toISOString() })
}
