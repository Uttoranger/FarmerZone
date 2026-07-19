'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, ReceiptText, Users, Home, Tag, BarChart3, SlidersHorizontal, LogOut, MoreHorizontal, X } from 'lucide-react'
import { signOut } from '@/lib/auth-client'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard',  label: 'Übersicht',       icon: LayoutDashboard },
  { href: '/orders',     label: 'Bestellungen',    icon: ReceiptText, badgeKey: 'orders' as const },
  { href: '/customers',  label: 'Kunden',          icon: Users },
  { href: '/farm-page',  label: 'Meine Hof-Seite', icon: Home },
  { href: '/sales',      label: 'Verkauf',         icon: Tag },
  { href: '/analytics',  label: 'Auswertung',      icon: BarChart3 },
]

interface FarmerNavProps {
  farmName: string
  userName: string
  ordersBadge?: number
}

export function FarmerNav({ farmName, userName, ordersBadge }: FarmerNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  // Mobiles "Mehr"-Sheet (Einstellungen + Abmelden)
  const [moreOpen, setMoreOpen] = useState(false)

  async function handleLogout() {
    await signOut()
    router.push('/login')
    router.refresh()
  }

  function getBadgeCount(badgeKey?: 'orders') {
    if (badgeKey === 'orders' && ordersBadge) return ordersBadge
    return undefined
  }

  return (
    <>
      {/* ===== MOBILE: Bottom Tab Bar ===== */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border md:hidden" style={{ background: '#24523A' }}>
        <div className="flex items-stretch h-16">
          {/* Platz-Regel: mit 7 Tabs fielen Tap-Ziele auf 46px (<48) — Auswertung
              wandert daher als einziger Punkt mit ins Mehr-Sheet */}
          {NAV_ITEMS.filter((item) => item.href !== '/analytics').map(({ href, label, icon: Icon, badgeKey }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            const badgeCount = getBadgeCount(badgeKey)
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[56px] text-xs transition-colors duration-[250ms] relative"
                style={{ color: active ? '#F5F3EE' : '#CFE4D6' }}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" strokeWidth={1.7} />
                  {badgeCount && (
                    <span
                      className="absolute -top-1.5 -right-2 min-w-[16px] h-4 flex items-center justify-center rounded-full px-1 text-[9px] font-bold text-white leading-none"
                      style={{ background: '#E8854A' }}
                    >
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </div>
                <span className="leading-none">{label}</span>
              </Link>
            )
          })}
          {/* Mehr-Tab: Einstellungen + Abmelden (fehlten mobil) */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="Mehr"
            aria-expanded={moreOpen}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[56px] text-xs transition-colors duration-[250ms]"
            style={{ color: moreOpen || pathname.startsWith('/settings') || pathname.startsWith('/analytics') ? '#F5F3EE' : '#CFE4D6' }}
          >
            <MoreHorizontal className="h-5 w-5" strokeWidth={1.7} />
            <span className="leading-none">Mehr</span>
          </button>
        </div>
      </nav>

      {/* ===== MOBILE: Mehr-Sheet ===== */}
      {moreOpen && (
        <div className="fixed inset-0 z-[60] md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0" style={{ background: 'rgba(20,30,22,0.45)' }} />
          <div
            className="absolute bottom-16 left-0 right-0 rounded-t-2xl px-3 pt-3 pb-3"
            style={{ background: '#24523A', borderTop: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 -8px 24px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Mehr"
          >
            <div className="flex items-center justify-between px-1 mb-1">
              <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'rgba(207,228,214,0.55)' }}>
                Mehr
              </span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Schließen"
                className="flex items-center justify-center size-8 rounded-full transition-colors hover:bg-white/10"
                style={{ color: '#CFE4D6' }}
              >
                <X className="size-4" strokeWidth={1.7} />
              </button>
            </div>
            <Link
              href="/analytics"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm min-h-[48px]"
              style={
                pathname.startsWith('/analytics')
                  ? { background: '#F5F3EE', color: '#24523A', fontWeight: 600 }
                  : { color: '#CFE4D6' }
              }
            >
              <BarChart3 className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.7} />
              Auswertung
            </Link>
            <Link
              href="/settings"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm min-h-[48px]"
              style={
                pathname.startsWith('/settings')
                  ? { background: '#F5F3EE', color: '#24523A', fontWeight: 600 }
                  : { color: '#CFE4D6' }
              }
            >
              <SlidersHorizontal className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.7} />
              Einstellungen
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm min-h-[48px] transition-colors hover:bg-red-500/15"
              style={{ color: '#FCA5A5' }}
            >
              <LogOut className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.7} />
              Abmelden
            </button>
          </div>
        </div>
      )}

      {/* ===== DESKTOP: Sidebar ===== */}
      <aside
        className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-56 z-40"
        style={{ background: '#24523A', borderRight: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Hof-Name */}
        <div className="px-4 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
          <div className="text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: 'rgba(207,228,214,0.55)' }}>Hof</div>
          <div className="font-heading font-semibold truncate leading-tight" style={{ color: '#F5F3EE' }}>{farmName}</div>
          <div className="text-xs truncate mt-0.5" style={{ color: '#CFE4D6', opacity: 0.7 }}>{userName}</div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 min-h-0 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon, badgeKey }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            const badgeCount = getBadgeCount(badgeKey)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors duration-[250ms] min-h-[44px]',
                )}
                style={
                  active
                    ? {
                        background: '#F5F3EE',
                        color: '#24523A',
                        fontWeight: 600,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.16)',
                      }
                    : { color: '#CFE4D6' }
                }
              >
                <Icon className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.7} />
                <span className="flex-1">{label}</span>
                {badgeCount && (
                  <span
                    className="min-w-[20px] h-5 flex items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white leading-none"
                    style={{ background: '#E8854A' }}
                  >
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer: Settings + Logout */}
        <div className="shrink-0 px-2 py-3 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors duration-[250ms] min-h-[44px]"
            style={
              pathname.startsWith('/settings')
                ? { background: '#F5F3EE', color: '#24523A', fontWeight: 600, boxShadow: '0 1px 4px rgba(0,0,0,0.16)' }
                : { color: '#CFE4D6' }
            }
          >
            <SlidersHorizontal className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.7} />
            Einstellungen
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors duration-[250ms] min-h-[44px] hover:bg-red-500/15 hover:text-red-300"
            style={{ color: '#CFE4D6' }}
          >
            <LogOut className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.7} />
            Abmelden
          </button>
        </div>
      </aside>
    </>
  )
}
