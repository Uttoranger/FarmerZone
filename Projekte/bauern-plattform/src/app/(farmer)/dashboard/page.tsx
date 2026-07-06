import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getDashboardStats, getFarmForUser } from '@/server/queries/dashboard'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  ShoppingBag,
  Package,
  PlusCircle,
  BarChart2,
  AlertTriangle,
  ExternalLink,
  Printer,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'

function formatEuro(amount: number) {
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(amount)
}

function todayLabel(): string {
  return new Date().toLocaleDateString('de-AT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/login')

  const {
    offeneBestellungen,
    heutigeBestellungen,
    aktivProdukte,
    umsatzWoche,
    umsatzChangePercent,
    bestellungenWocheCount,
  } = await getDashboardStats(farm.id)

  const vorname = session.user.name?.split(' ')[0] ?? 'Hallo'
  const uhrzeit = new Date().getHours()
  const gruss = uhrzeit < 12 ? 'Guten Morgen' : uhrzeit < 18 ? 'Guten Tag' : 'Guten Abend'

  // Aggregate pack list from today's orders
  const packList = new Map<string, number>()
  for (const order of heutigeBestellungen) {
    for (const item of order.items) {
      packList.set(item.productName, (packList.get(item.productName) ?? 0) + item.quantity)
    }
  }
  const packListEntries = Array.from(packList.entries()).sort((a, b) => a[0].localeCompare(b[0]))

  // Customer names for today
  const todayCustomers = heutigeBestellungen.map((o) => o.customerName)

  // Pick up time window
  const firstTime = heutigeBestellungen[0]?.pickupTimeStart
  const lastTime = heutigeBestellungen[heutigeBestellungen.length - 1]?.pickupTimeEnd

  return (
    <div className="px-4 py-8 max-w-2xl mx-auto">
      {/* Begrüßung + Datum */}
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          {gruss}, {vorname}! 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1 capitalize">{todayLabel()}</p>
      </div>

      {/* ── Tages-Aufgabe ─────────────────────────────────────────── */}
      {heutigeBestellungen.length > 0 ? (
        <Card className="mb-6 border-l-4 border-l-primary">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  Heute: {heutigeBestellungen.length}{' '}
                  {heutigeBestellungen.length === 1 ? 'Bestellung' : 'Bestellungen'} zur Abholung
                </p>
                <p className="text-sm text-muted-foreground">
                  {firstTime}–{lastTime} Uhr ·{' '}
                  {todayCustomers.slice(0, 3).join(' · ')}
                  {todayCustomers.length > 3 && ` · +${todayCustomers.length - 3} weitere`}
                </p>
              </div>
            </div>

            {/* Packliste */}
            {packListEntries.length > 0 && (
              <div className="bg-muted rounded-xl p-3 mb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Heute vorbereiten
                </p>
                <p className="text-sm text-foreground leading-relaxed">
                  {packListEntries.map(([name, qty]) => `${qty}× ${name}`).join(', ')}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Link
                href="/orders"
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold transition-opacity hover:opacity-90"
              >
                <ShoppingBag className="h-4 w-4" />
                Zu den Bestellungen
              </Link>
              <Link
                href="/orders/today/print"
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-muted text-foreground text-sm font-medium transition-colors hover:bg-muted/70 print:hidden"
              >
                <Printer className="h-4 w-4" />
                Packliste drucken
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Alert className="mb-6 border-border bg-muted/30">
          <AlertDescription className="text-muted-foreground">
            Heute keine Abholungen geplant. Schöner Tag! ☀️{' '}
            <span className="block text-xs mt-0.5">
              Teile deinen Shop-Link, um neue Kunden zu erreichen.
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* ── Woche-Statistik ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <Card>
          <CardContent className="pt-5 pb-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Umsatz diese Woche
            </p>
            <div className="font-heading text-2xl font-semibold text-foreground">
              {formatEuro(umsatzWoche)}
            </div>
            {umsatzChangePercent !== null && (
              <div
                className={`flex items-center gap-1 text-xs mt-1 font-medium ${
                  umsatzChangePercent > 0
                    ? 'text-green-600'
                    : umsatzChangePercent < 0
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                }`}
              >
                {umsatzChangePercent > 2 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : umsatzChangePercent < -2 ? (
                  <TrendingDown className="w-3.5 h-3.5" />
                ) : (
                  <Minus className="w-3.5 h-3.5" />
                )}
                {umsatzChangePercent > 0 ? '+' : ''}
                {umsatzChangePercent} % vs. Vorwoche
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Bestellungen diese Woche
            </p>
            <div className="font-heading text-2xl font-semibold text-foreground">
              {bestellungenWocheCount}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {offeneBestellungen > 0
                ? `${offeneBestellungen} noch offen`
                : 'Alle erledigt'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Hauptaktionen ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <Link href="/orders">
          <Card className="hover:shadow-[0_8px_20px_oklch(0.18_0.03_150_/_0.1)] transition-shadow duration-[250ms] cursor-pointer h-full">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-7 px-4 text-center min-h-[110px]">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                <ShoppingBag className="h-6 w-6 text-primary" strokeWidth={1.75} />
              </div>
              <div>
                <div className="font-medium text-foreground text-sm">Bestellungen</div>
                {offeneBestellungen > 0 && (
                  <Badge className="mt-1.5 bg-amber-100 text-amber-800 text-xs border-0">
                    {offeneBestellungen} offen
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/products">
          <Card className="hover:shadow-[0_8px_20px_oklch(0.18_0.03_150_/_0.1)] transition-shadow duration-[250ms] cursor-pointer h-full">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-7 px-4 text-center min-h-[110px]">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                <Package className="h-6 w-6 text-primary" strokeWidth={1.75} />
              </div>
              <div>
                <div className="font-medium text-foreground text-sm">Produkte</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {aktivProdukte} aktiv
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/sales">
          <Card className="hover:shadow-[0_8px_20px_oklch(0.18_0.03_150_/_0.1)] transition-shadow duration-[250ms] cursor-pointer h-full">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-7 px-4 text-center min-h-[110px]">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                <PlusCircle className="h-6 w-6 text-primary" strokeWidth={1.75} />
              </div>
              <div className="font-medium text-foreground text-sm">Verkauf eintragen</div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/analytics">
          <Card className="hover:shadow-[0_8px_20px_oklch(0.18_0.03_150_/_0.1)] transition-shadow duration-[250ms] cursor-pointer h-full">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-7 px-4 text-center min-h-[110px]">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                <BarChart2 className="h-6 w-6 text-primary" strokeWidth={1.75} />
              </div>
              <div className="font-medium text-foreground text-sm">Auswertung</div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* WhatsApp Einladungskarte */}
      {(() => {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
        const shopUrl = `${appUrl}/${farm.slug}`
        const text = encodeURIComponent(
          `Hey! Ich biete frische Produkte direkt vom Hof an. Hier kannst du einfach online bestellen: ${shopUrl}`
        )
        return (
          <div className="rounded-2xl border border-border bg-card p-5 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: '#25D366' }}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">Kunden einladen</p>
                <p className="text-xs text-muted-foreground">Teile deinen Shop direkt per WhatsApp</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-3 font-mono truncate">{shopUrl}</p>
            <a
              href={`https://wa.me/?text=${text}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#25D366' }}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Per WhatsApp teilen
            </a>
          </div>
        )
      })()}

      {/* Shop-Link */}
      <div className="text-center">
        <Link
          href={`/${farm.slug}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-2 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Meinen Shop ansehen
        </Link>
      </div>
    </div>
  )
}
