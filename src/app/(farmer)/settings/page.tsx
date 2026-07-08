import Link from 'next/link'
import type { Metadata } from 'next'
import { CreditCard, MapPin, Clock, PauseCircle, User, Paintbrush } from 'lucide-react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/farmer/page-header'

export const metadata: Metadata = { title: 'Einstellungen — FarmerZone' }

const SECTIONS = [
  {
    href: '/settings/profile',
    icon: MapPin,
    title: 'Hof-Profil',
    description: 'Name, Adresse, Beschreibung, Logo und Banner',
  },
  {
    href: '/settings/appearance',
    icon: Paintbrush,
    title: 'Mein Auftritt',
    description: 'Banner, Tagline, Über-uns-Text, Werte und Galerie',
  },
  {
    href: '/settings/pickup-slots',
    icon: Clock,
    title: 'Abholzeiten',
    description: 'Wochentage und Uhrzeiten für die Abholung verwalten',
  },
  {
    href: '/settings/payments',
    icon: CreditCard,
    title: 'Zahlungen',
    description: 'Stripe Connect einrichten, Online-Zahlung aktivieren',
  },
  {
    href: '/settings/pause',
    icon: PauseCircle,
    title: 'Pause / Urlaub',
    description: 'Shop pausieren und Kunden informieren',
  },
  {
    href: '/settings/account',
    icon: User,
    title: 'Konto',
    description: 'Passwort ändern, Konto verwalten',
  },
]

export default function SettingsPage() {
  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <PageHeader title="Einstellungen" subtitle="Verwalte deinen Hof und dein Konto." />

      <div className="grid gap-3">
        {SECTIONS.map(({ href, icon: Icon, title, description }) => (
          <Link key={href} href={href} className="group">
            <Card size="sm" className="transition-shadow group-hover:shadow-md">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-primary" />
                  <CardTitle>{title}</CardTitle>
                </div>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

