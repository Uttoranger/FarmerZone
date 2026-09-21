'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, ReceiptText, Users, Home, Tag, BarChart3, SlidersHorizontal, LogOut, MoreHorizontal, X, Bug, Inbox, ShieldCheck } from 'lucide-react'
import { signOut } from '@/lib/auth-client'
import { FarmIdentityCard } from '@/components/farmer/farm-identity-card'
import { ThemeUmschalter, ThemeUmschalterZeile } from '@/components/shared/theme-umschalter'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard',  label: 'Übersicht',       icon: LayoutDashboard },
  { href: '/orders',     label: 'Bestellungen',    icon: ReceiptText, badgeKey: 'orders' as const },
  { href: '/customers',  label: 'Kunden',          icon: Users },
  { href: '/farm-page',  label: 'Meine Hof-Seite', icon: Home },
  { href: '/sales',      label: 'Verkauf',         icon: Tag },
  { href: '/analytics',  label: 'Auswertung',      icon: BarChart3 },
]

/**
 * Fehlerbriefkasten: „Fehler melden" und „Meine Meldungen" liegen im Mehr-Sheet
 * (mobil) bzw. ab md in der Fußzeile der Seitenleiste — nicht in der unteren
 * Tab-Leiste, deren Platz-Regel (max. 6 Tap-Ziele) sonst bräche.
 */
const BRIEFKASTEN_ITEMS = [
  { href: '/fehler-melden', label: 'Fehler melden',   icon: Bug },
  { href: '/meldungen',     label: 'Meine Meldungen', icon: Inbox },
]

/** Pfade, bei denen der Mehr-Tab als aktiv gilt (weil ihr Ziel im Sheet liegt). */
const MEHR_PFADE = ['/settings', '/analytics', '/fehler-melden', '/meldungen', '/admin']

interface FarmerNavProps {
  farmName: string
  userName: string
  ordersBadge?: number
  /** Hof-Logo für die Identitätskarte; null = Initialen. */
  farmLogoUrl?: string | null
  /** approvedAt === null — für den ruhigen Status-Punkt an der Karte. */
  farmPending?: boolean
  /** Betreiber-Konto: zeigt den Menüpunkt „Admin" (frisch aus der DB, nie aus der Sitzung). */
  isAdmin?: boolean
}

export function FarmerNav({
  farmName,
  userName,
  ordersBadge,
  farmLogoUrl = null,
  farmPending = false,
  isAdmin = false,
}: FarmerNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  // Mobiles "Mehr"-Sheet (Einstellungen + Abmelden)
  const [moreOpen, setMoreOpen] = useState(false)
  const mehrAktiv = MEHR_PFADE.some((p) => pathname === p || pathname.startsWith(p + '/'))

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
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border md:hidden print:hidden" style={{ background: 'var(--app-bar)' }}>
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
                style={{ color: active ? 'var(--app-bar-ink)' : 'var(--app-bar-ink-soft)' }}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" strokeWidth={1.7} />
                  {badgeCount && (
                    <span
                      className="absolute -top-1.5 -right-2 min-w-[16px] h-4 flex items-center justify-center rounded-full px-1 text-[9px] font-bold text-white leading-none"
                      style={{ background: 'var(--accent)' }}
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
            style={{ color: moreOpen || mehrAktiv ? 'var(--app-bar-ink)' : 'var(--app-bar-ink-soft)' }}
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
            style={{ background: 'var(--app-bar)', borderTop: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 -8px 24px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Mehr"
          >
            {/* Kopfzeile des Sheets: die Hof-Identitätskarte. Sie tritt an die
                Stelle der bisherigen „Mehr"-Versalzeile — der Name des Dialogs
                steckt weiterhin im aria-label des Containers, es geht also
                nichts für Screenreader verloren. Die untere Leiste selbst
                bleibt davon unberührt. */}
            <div className="flex items-start justify-between gap-2 px-1 mb-2 pt-1">
              <div className="min-w-0 flex-1">
                <FarmIdentityCard
                  farmName={farmName}
                  logoUrl={farmLogoUrl}
                  wartetAufFreigabe={farmPending}
                  onNavigate={() => setMoreOpen(false)}
                />
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {/* Hell/Dunkel hier statt als siebter Tab: Die Leiste hält
                    ihre Platz-Regel (6 Ziele), der Umschalter ist trotzdem von
                    jeder Bauern-Seite aus über „Mehr" erreichbar. */}
                <ThemeUmschalter
                  className="rounded-full hover:bg-white/10"
                  style={{ color: 'var(--app-bar-ink-soft)' }}
                />
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  aria-label="Schließen"
                  className="flex shrink-0 items-center justify-center size-8 rounded-full transition-colors hover:bg-white/10"
                  style={{ color: 'var(--app-bar-ink-soft)' }}
                >
                  <X className="size-4" strokeWidth={1.7} />
                </button>
              </div>
            </div>
            <Link
              href="/analytics"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm min-h-[48px]"
              style={
                pathname.startsWith('/analytics')
                  ? { background: 'var(--app-bar-ink)', color: 'var(--app-bar)', fontWeight: 600 }
                  : { color: 'var(--app-bar-ink-soft)' }
              }
            >
              <BarChart3 className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.7} />
              Auswertung
            </Link>
            {BRIEFKASTEN_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm min-h-[48px]"
                style={
                  pathname === href || pathname.startsWith(href + '/')
                    ? { background: 'var(--app-bar-ink)', color: 'var(--app-bar)', fontWeight: 600 }
                    : { color: 'var(--app-bar-ink-soft)' }
                }
              >
                <Icon className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.7} />
                {label}
              </Link>
            ))}
            <Link
              href="/settings"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm min-h-[48px]"
              style={
                pathname.startsWith('/settings')
                  ? { background: 'var(--app-bar-ink)', color: 'var(--app-bar)', fontWeight: 600 }
                  : { color: 'var(--app-bar-ink-soft)' }
              }
            >
              <SlidersHorizontal className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.7} />
              Einstellungen
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm min-h-[48px]"
                style={
                  pathname.startsWith('/admin')
                    ? { background: 'var(--app-bar-ink)', color: 'var(--app-bar)', fontWeight: 600 }
                    : { color: 'var(--app-bar-ink-soft)' }
                }
              >
                <ShieldCheck className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.7} />
                Admin
              </Link>
            )}
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
        className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-56 z-40 print:hidden"
        style={{ background: 'var(--app-bar)', borderRight: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Hof-Identitätskarte am Kopf der Seitenleiste. Sie tritt an die
            Stelle der bisherigen Namenszeile („Hof" + Name + Nutzer): dieselbe
            Information, dazu Logo, Vorschau-Schaltfläche und Freigabe-Zustand.
            Der Nutzername bleibt darunter stehen — er sagt, WER angemeldet ist,
            und das beantwortet die Karte nicht. */}
        <div className="px-4 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
          <FarmIdentityCard
            farmName={farmName}
            logoUrl={farmLogoUrl}
            wartetAufFreigabe={farmPending}
          />
          <div className="text-xs truncate mt-2.5" style={{ color: 'var(--app-bar-ink-soft)', opacity: 0.7 }}>{userName}</div>
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
                        background: 'var(--app-bar-ink)',
                        color: 'var(--app-bar)',
                        fontWeight: 600,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.16)',
                      }
                    : { color: 'var(--app-bar-ink-soft)' }
                }
              >
                <Icon className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.7} />
                <span className="flex-1">{label}</span>
                {badgeCount && (
                  <span
                    className="min-w-[20px] h-5 flex items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white leading-none"
                    style={{ background: 'var(--accent)' }}
                  >
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer: Briefkasten + Settings (+ Admin) + Logout */}
        <div className="shrink-0 px-2 py-3 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
          {BRIEFKASTEN_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors duration-[250ms] min-h-[44px]"
              style={
                pathname === href || pathname.startsWith(href + '/')
                  ? { background: 'var(--app-bar-ink)', color: 'var(--app-bar)', fontWeight: 600, boxShadow: '0 1px 4px rgba(0,0,0,0.16)' }
                  : { color: 'var(--app-bar-ink-soft)' }
              }
            >
              <Icon className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.7} />
              {label}
            </Link>
          ))}
          {/* Hell/Dunkel als Zeile wie die Nachbarn — ein Klick von jeder
              Bauern-Seite, ohne den Weg über Einstellungen → Konto. */}
          <ThemeUmschalterZeile
            className="duration-[250ms] hover:bg-white/10"
            style={{ color: 'var(--app-bar-ink-soft)' }}
          />
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors duration-[250ms] min-h-[44px]"
            style={
              pathname.startsWith('/settings')
                ? { background: 'var(--app-bar-ink)', color: 'var(--app-bar)', fontWeight: 600, boxShadow: '0 1px 4px rgba(0,0,0,0.16)' }
                : { color: 'var(--app-bar-ink-soft)' }
            }
          >
            <SlidersHorizontal className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.7} />
            Einstellungen
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors duration-[250ms] min-h-[44px]"
              style={
                pathname.startsWith('/admin')
                  ? { background: 'var(--app-bar-ink)', color: 'var(--app-bar)', fontWeight: 600, boxShadow: '0 1px 4px rgba(0,0,0,0.16)' }
                  : { color: 'var(--app-bar-ink-soft)' }
              }
            >
              <ShieldCheck className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.7} />
              Admin
            </Link>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors duration-[250ms] min-h-[44px] hover:bg-red-500/15 hover:text-red-300"
            style={{ color: 'var(--app-bar-ink-soft)' }}
          >
            <LogOut className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.7} />
            Abmelden
          </button>
        </div>
      </aside>
    </>
  )
}
