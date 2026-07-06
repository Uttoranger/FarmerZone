export const RESERVED_SLUGS = new Set([
  'login', 'register', 'onboarding', 'account', 'api',
  'impressum', 'datenschutz', 'settings', 'orders', 'customers',
  'status', 'products', 'sales', 'analytics', 'dashboard', 'admin',
])

export function generateSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'hof'
}
