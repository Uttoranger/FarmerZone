'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { archiveFarm, reactivateFarm } from '@/server/actions/farm-archive'
import {
  FARM_ARCHIVE_TITLE,
  FARM_ARCHIVE_EXPLANATION,
  FARM_ARCHIVED_EXPLANATION,
  FARM_ARCHIVE_BLOCKED_SATZ,
  farmArchiveBlockedTitel,
} from '@/lib/farm-archive'
import { KONTO_TEXT, URLAUB_UND_PAUSE } from '@/lib/hof-einstellungen'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { HinweiskarteFehler } from '@/components/ui/hinweiskarte'
import { KNOPF_ORANGE_RAHMEN } from '@/components/hof-bestellungen/stil'
import { HELLER_KNOPF, EINSTELLUNG_KARTE, KARTEN_TITEL } from '@/components/hof-einstellungen/knopf'
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
  /** Offene Bestellungen beim Laden der Seite — dieselbe Zählung wie der Server (getOpenOrdersCount). */
  offeneBestellungen: number
}

/**
 * Hof stilllegen bzw. reaktivieren. Seit Nr. 250 (Liste Lauf 32, konto-hof): Solange offene Bestellungen da
 * sind, steht statt des Knopfs der Hinweis mit „Zu den Bestellungen“ — der Server lehnt ohnehin ab
 * (archiveFarm), der Knopf führte ins Leere. Kommt die Sperre erst beim Absenden (eine Bestellung kam
 * zwischen Laden und Tipp dazu), zeigt die Karte denselben Hinweis mit der Zahl des Servers.
 */
export function ArchiveFarmCard({ farmSlug, isArchived, offeneBestellungen }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  // Zahl offener Bestellungen, wenn der Guard die Stilllegung verhindert hat.
  const [blockedBy, setBlockedBy] = useState<number | null>(null)
  const gesperrt = blockedBy ?? (offeneBestellungen > 0 ? offeneBestellungen : null)
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
      <Card className={EINSTELLUNG_KARTE}>
        <CardHeader>
          <CardTitle className={KARTEN_TITEL}>Hof reaktivieren</CardTitle>
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
      <Card className={EINSTELLUNG_KARTE}>
        <CardHeader>
          <CardTitle className={KARTEN_TITEL}>{FARM_ARCHIVE_TITLE}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Ein Absatz wörtlich nach Board s2-/w2-konto-hof (vorher drei); der Erklärtext kommt aus farm-archive.ts. */}
          <p className="text-sm text-muted-foreground">
            {KONTO_TEXT.stilllegenSatz} {FARM_ARCHIVE_EXPLANATION} {KONTO_TEXT.nurVoruebergehend}{' '}
            <Link href="/settings/pause" className="font-medium text-brand-text underline underline-offset-2">
              {URLAUB_UND_PAUSE}
            </Link>{' '}
            {KONTO_TEXT.nurVoruebergehendNach}
          </p>

          {gesperrt !== null ? (
            // Titel fett in der Warnfarbe, Knopf über die volle Breite (Board Bild 4); kein „Hof stilllegen“.
            <HinweiskarteFehler titel={farmArchiveBlockedTitel(gesperrt)}>
              <p>{FARM_ARCHIVE_BLOCKED_SATZ}</p>
              <Link href="/orders" className={`${HELLER_KNOPF} mt-3`}>
                Zu den Bestellungen
              </Link>
            </HinweiskarteFehler>
          ) : (
            // Zerstörend: Orange-Umriss statt Rot (DESIGN_SYSTEM „Dialoge und Blätter").
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              disabled={isBusy}
              className={`${KNOPF_ORANGE_RAHMEN} w-full sm:w-auto`}
            >
              Hof stilllegen
            </button>
          )}
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
            <button type="button" onClick={handleArchive} disabled={isBusy} className={KNOPF_ORANGE_RAHMEN}>
              {isBusy ? 'Wird stillgelegt…' : 'Hof stilllegen'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
