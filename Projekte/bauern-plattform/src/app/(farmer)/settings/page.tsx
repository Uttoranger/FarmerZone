import Link from 'next/link'
import { CreditCard, Settings } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata = { title: 'Einstellungen — Bauernshop' }

const SECTIONS = [
  {
    href: '/settings/payments',
    icon: CreditCard,
    title: 'Zahlungen',
    description: 'Stripe Connect einrichten, Online-Zahlung aktivieren',
  },
  {
    href: '/settings',
    icon: Settings,
    title: 'Hof-Einstellungen',
    description: 'Name, Adresse, Abholzeiten, Zahlungsarten — folgt in Sprint 11',
    disabled: true,
  },
]

export default function SettingsPage() {
  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-800 mb-1">Einstellungen</h1>
      <p className="text-sm text-slate-500 mb-6">Verwalte deinen Hof und Zahlungsoptionen.</p>

      <div className="grid gap-3">
        {SECTIONS.map(({ href, icon: Icon, title, description, disabled }) =>
          disabled ? (
            <div key={title} className="opacity-40 cursor-not-allowed">
              <Card size="sm">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-slate-500" />
                    <CardTitle>{title}</CardTitle>
                  </div>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
              </Card>
            </div>
          ) : (
            <Link key={title} href={href} className="group">
              <Card size="sm" className="transition-shadow group-hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-green-700" />
                    <CardTitle>{title}</CardTitle>
                  </div>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          )
        )}
      </div>
    </div>
  )
}
