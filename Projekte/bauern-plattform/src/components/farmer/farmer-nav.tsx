'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, ShoppingBag, Package, PlusCircle, BarChart2, Settings, LogOut } from 'lucide-react'
import { signOut } from '@/lib/auth-client'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard',  label: 'Übersicht',  icon: LayoutDashboard },
  { href: '/orders',     label: 'Bestellungen', icon: ShoppingBag },
  { href: '/products',   label: 'Produkte',   icon: Package },
  { href: '/sales',      label: 'Verkauf',    icon: PlusCircle },
  { href: '/analytics',  label: 'Auswertung', icon: BarChart2 },
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
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 md:hidden">
        <div className="flex items-stretch h-16">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[44px] text-xs transition-colors',
                  active
                    ? 'text-green-700 font-medium'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 1.75} />
                <span className="leading-none">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* ===== DESKTOP: Sidebar ===== */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-56 bg-white border-r border-slate-200 z-40">
        {/* Hof-Name */}
        <div className="px-4 py-5 border-b border-slate-100">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Hof</div>
          <div className="font-medium text-slate-800 truncate">{farmName}</div>
          <div className="text-xs text-slate-500 truncate">{userName}</div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors min-h-[44px]',
                  active
                    ? 'bg-green-50 text-green-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800',
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" strokeWidth={active ? 2.5 : 1.75} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Footer: Einstellungen + Abmelden */}
        <div className="px-2 py-3 border-t border-slate-100 space-y-0.5">
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors min-h-[44px]',
              pathname.startsWith('/settings')
                ? 'bg-green-50 text-green-700 font-medium'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800',
            )}
          >
            <Settings className="h-5 w-5 flex-shrink-0" strokeWidth={1.75} />
            Einstellungen
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors min-h-[44px]"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" strokeWidth={1.75} />
            Abmelden
          </button>
        </div>
      </aside>
    </>
  )
}
