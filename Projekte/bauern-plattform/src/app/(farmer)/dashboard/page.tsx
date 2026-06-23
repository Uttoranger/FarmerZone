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
