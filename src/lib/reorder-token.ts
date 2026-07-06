import { createHmac } from 'crypto'

const SECRET = process.env.BETTER_AUTH_SECRET ?? 'dev-secret-change-in-production'

export function generateReorderToken(orderId: string, farmId: string): string {
  const payload = `${orderId}:${farmId}`
  const hmac = createHmac('sha256', SECRET).update(payload).digest('hex')
  const b64 = Buffer.from(payload).toString('base64url')
  return `${b64}.${hmac}`
}

export function verifyReorderToken(token: string): { orderId: string; farmId: string } | null {
  try {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx < 0) return null
    const b64 = token.slice(0, dotIdx)
    const hmac = token.slice(dotIdx + 1)
    const payload = Buffer.from(b64, 'base64url').toString()
    const expectedHmac = createHmac('sha256', SECRET).update(payload).digest('hex')
    if (hmac !== expectedHmac) return null
    const colonIdx = payload.indexOf(':')
    if (colonIdx < 0) return null
    return {
      orderId: payload.slice(0, colonIdx),
      farmId: payload.slice(colonIdx + 1),
    }
  } catch {
    return null
  }
}
