import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getDashboardStats, getFarmForUser } from '@/server/queries/dashboard'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ShoppingBag, Package, PlusCircle, BarChart2, AlertTriangle, Euro, ExternalLink } from 'lucide-react'

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/login')

  const { offeneBestellungen, heutigeBestellungen, aktivProdukte, umsatzWoche } =
    await getDashboardStats(farm.id)

  const vorname = session.user.name?.split(' ')[0] ?? 'Hallo'

  const uhrzeit = new Date().getHours()
  const gruss =
    uhrzeit < 12 ? 'Guten Morgen' : uhrzeit < 18 ? 'Guten Tag' : 'Guten Abend'

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      {/* Begrüßung */}
      <div className="mb-6">
        <h1 className="text-2xl font-medium text-slate-800">
          {gruss}, {vorname}! 👋
        </h1>
        <p className="text-slate-500 text-sm mt-1">{farm.name}</p>
      </div>

      {/* Warnung: Bestellungen heute */}
      {heutigeBestellungen.length > 0 && (
        <Alert className="mb-6 border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <span className="font-medium">
              {heutigeBestellungen.length}{' '}
              {heutigeBestellungen.length === 1 ? 'Bestellung' : 'Bestellungen'} zur Abholung heute
            </span>
            {' — '}
            {heutigeBestellungen[0].pickupTimeStart} bis{' '}
            {heutigeBestellungen[heutigeBestellungen.length - 1].pickupTimeEnd} Uhr.{' '}
            <Link href="/orders" className="underline font-medium">
              Jetzt ansehen
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats-Kacheln */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <Card className="text-center">
          <CardContent className="pt-4 pb-4 px-2">
            <div className="text-2xl font-medium text-slate-800">{offeneBestellungen}</div>
            <div className="text-xs text-slate-500 mt-0.5 leading-tight">Offene Bestellungen</div>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="pt-4 pb-4 px-2">
            <div className="text-2xl font-medium text-slate-800">
              {umsatzWoche.toFixed(0)} €
            </div>
            <div className="text-xs text-slate-500 mt-0.5 leading-tight">Umsatz Woche</div>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="pt-4 pb-4 px-2">
            <div className="text-2xl font-medium text-slate-800">{aktivProdukte}</div>
            <div className="text-xs text-slate-500 mt-0.5 leading-tight">Aktive Produkte</div>
          </CardContent>
        </Card>
      </div>

      {/* Hauptaktionen */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <Link href="/orders">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="flex flex-col items-center justify-center gap-2 py-6 px-4 text-center min-h-[100px]">
              <ShoppingBag className="h-8 w-8 text-green-700" strokeWidth={1.5} />
              <div>
                <div className="font-medium text-slate-800 text-sm">Bestellungen</div>
                {offeneBestellungen > 0 && (
                  <Badge className="mt-1 bg-amber-100 text-amber-800 text-xs border-0">
                    {offeneBestellungen} offen
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/products">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="flex flex-col items-center justify-center gap-2 py-6 px-4 text-center min-h-[100px]">
              <Package className="h-8 w-8 text-green-700" strokeWidth={1.5} />
              <div className="font-medium text-slate-800 text-sm">Produkte verwalten</div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/sales">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="flex flex-col items-center justify-center gap-2 py-6 px-4 text-center min-h-[100px]">
              <PlusCircle className="h-8 w-8 text-green-700" strokeWidth={1.5} />
              <div className="font-medium text-slate-800 text-sm">Verkauf eintragen</div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/analytics">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="flex flex-col items-center justify-center gap-2 py-6 px-4 text-center min-h-[100px]">
              <BarChart2 className="h-8 w-8 text-green-700" strokeWidth={1.5} />
              <div className="font-medium text-slate-800 text-sm">Auswertung</div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Link zum Shop */}
      <div className="text-center">
        <Link
          href={`/${farm.slug}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 text-sm text-green-700 hover:text-green-800 underline underline-offset-2"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Meinen Shop ansehen
        </Link>
      </div>
    </div>
  )
}
