'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, ShoppingBag, Users, PlusCircle, BarChart2, Settings, LogOut, Home } from 'lucide-react'
import { signOut } from '@/lib/auth-client'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard',  label: 'Übersicht',       icon: LayoutDashboard },
  { href: '/orders',     label: 'Bestellungen',    icon: ShoppingBag },
  { href: '/customers',  label: 'Kunden',          icon: Users },
  { href: '/farm-page',  label: 'Meine Hof-Seite', icon: Home },
  { href: '/sales',      label: 'Verkauf',         icon: PlusCircle },
  { href: '/analytics',  label: 'Auswertung',      icon: BarChart2 },
]

interface FarmerNavProps {
  farmName: string
  userName: string
}

export function FarmerNav({ farmName, userName }: FarmerNavProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* ===== MOBILE: Bottom Tab Bar ===== */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border md:hidden">
        <div className="flex items-stretch h-16">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[56px] text-xs transition-colors duration-[250ms]',
                  active
                    ? 'text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
                <span className="leading-none">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* ===== DESKTOP: Sidebar ===== */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-56 bg-sidebar border-r border-border z-40">
        {/* Hof-Name */}
        <div className="px-4 py-5 border-b border-sidebar-border">
          <div className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest font-semibold mb-1">Hof</div>
          <div className="font-heading font-semibold text-sidebar-foreground truncate leading-tight">{farmName}</div>
          <div className="text-xs text-sidebar-foreground/60 truncate mt-0.5">{userName}</div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 min-h-0 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors duration-[250ms] min-h-[44px]',
                  active
                    ? 'bg-white/20 text-sidebar-foreground font-semibold'
                    : 'text-sidebar-foreground/60 hover:bg-white/10 hover:text-sidebar-foreground',
                )}
              >
                <Icon className="h-4.5 w-4.5 flex-shrink-0" strokeWidth={active ? 2.25 : 1.75} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Footer: Settings + Logout */}
        <div className="shrink-0 px-2 py-3 border-t border-sidebar-border space-y-0.5">
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors duration-[250ms] min-h-[44px]',
              pathname.startsWith('/settings')
                ? 'bg-white/20 text-sidebar-foreground font-semibold'
                : 'text-sidebar-foreground/60 hover:bg-white/10 hover:text-sidebar-foreground',
            )}
          >
            <Settings className="h-4.5 w-4.5 flex-shrink-0" strokeWidth={1.75} />
            Einstellungen
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-sidebar-foreground/60 hover:bg-red-500/15 hover:text-red-300 transition-colors duration-[250ms] min-h-[44px]"
          >
            <LogOut className="h-4.5 w-4.5 flex-shrink-0" strokeWidth={1.75} />
            Abmelden
          </button>
        </div>
      </aside>
    </>
  )
}
