'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PowerOff, Power } from 'lucide-react'
import { archiveFarm, reactivateFarm } from '@/server/actions/farm-archive'
import {
  FARM_ARCHIVE_TITLE,
  FARM_ARCHIVE_EXPLANATION,
  FARM_ARCHIVED_EXPLANATION,
  farmArchiveBlockedMessage,
} from '@/lib/farm-archive'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface Props {
  farmSlug: string
  isArchived: boolean
}

export function ArchiveFarmCard({ farmSlug, isArchived }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  // Zahl offener Bestellungen, wenn der Guard die Stilllegung verhindert hat.
  const [blockedBy, setBlockedBy] = useState<number | null>(null)
  const router = useRouter()

  async function handleArchive() {
    setIsBusy(true)
    const result = await archiveFarm()
    setIsBusy(false)

    if (result.error) {
      toast.error(result.error)
      return
    }
    if (result.openOrders) {
      // Guard hat gegriffen: Dialog zu, Hinweis mit Anzahl in den Kasten.
      setBlockedBy(result.openOrders)
      setDialogOpen(false)
      return
    }

    setBlockedBy(null)
    setDialogOpen(false)
    toast.success('Hof stillgelegt')
    router.refresh()
  }

  async function handleReactivate() {
    setIsBusy(true)
    const result = await reactivateFarm()
    setIsBusy(false)

    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Hof wieder aktiv')
    router.refresh()
  }

  if (isArchived) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Power className="size-4 text-primary" />
            <CardTitle>Hof reaktivieren</CardTitle>
          </div>
          <CardDescription>Dein Hof ist derzeit stillgelegt.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{FARM_ARCHIVED_EXPLANATION}</p>
          <Button onClick={handleReactivate} disabled={isBusy} className="w-full sm:w-auto">
            {isBusy ? 'Wird aktiviert…' : 'Hof wieder aktivieren'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <PowerOff className="size-4 text-primary" />
            <CardTitle>{FARM_ARCHIVE_TITLE}</CardTitle>
          </div>
          <CardDescription>Deinen Hofladen dauerhaft schließen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{FARM_ARCHIVE_EXPLANATION}</p>

          <p className="text-sm text-muted-foreground">
            Nur vorübergehend zusperren? Dann nutze lieber{' '}
            <Link href="/settings/pause" className="text-primary underline underline-offset-2">
              Pause / Urlaub
            </Link>{' '}
            — dabei bleibt deine Hofseite mit einem Hinweis sichtbar.
          </p>

          {blockedBy !== null && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-800">{farmArchiveBlockedMessage(blockedBy)}</p>
              <Link
                href="/orders"
                className="mt-2 inline-block text-sm font-medium text-amber-900 underline underline-offset-2"
              >
                Zu den Bestellungen
              </Link>
            </div>
          )}

          <Button
            variant="destructive"
            onClick={() => setDialogOpen(true)}
            disabled={isBusy}
            className="w-full sm:w-auto"
          >
            Hof stilllegen
          </Button>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hof wirklich stilllegen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deine Hofseite <strong className="break-all">/{farmSlug}</strong> ist danach nicht
            mehr erreichbar und es sind keine Bestellungen mehr möglich. Es wird nichts gelöscht —
            du kannst dich weiterhin anmelden und den Hof jederzeit hier wieder aktivieren.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={isBusy}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleArchive} disabled={isBusy}>
              {isBusy ? 'Wird stillgelegt…' : 'Hof stilllegen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
