'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { approveFarmAction, revokeFarmApprovalAction, rejectFarmAction } from '@/server/actions/admin'
import {
  gruendungshofLabel,
  KEIN_GRUENDUNGSPLATZ,
  GRUENDUNGS_KONDITIONEN,
  MAX_GRUENDUNGSHOEFE,
} from '@/lib/gruendungshof'
import {
  aktivitaetsTeile,
  istOhneInhalt,
  AKTIVITAET_LEER,
  type FarmAktivitaet,
} from '@/lib/farm-aktivitaet'
import { DE_ADMIN_KLAERUNG, LAND_LABEL, type Land } from '@/lib/laender'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

type Farm = {
  id: string
  name: string
  slug: string
  ownerEmail: string
  createdAt: Date
  approvedAt: Date | null
  archivedAt: Date | null
  /** Das Land des Hofes — DE bekommt Marke und Klär-Erinnerung. */
  land: Land
  /** Belegter Platz (1-basiert) oder null — serverseitig berechnet. */
  gruendungsplatz: number | null
  /** Lebenszeichen: was der Bauer seit der Anmeldung angelegt hat. */
  aktivitaet: FarmAktivitaet
}

/**
 * Die Aktivitätszeile. Als einzelne Elemente mit `flex-wrap` statt als eine
 * lange Zeichenkette: bei 375px bricht sie so sauber zwischen den Angaben um,
 * statt mitten in „Abholzeiten". Der Trenner hängt am vorangehenden Element
 * und kann deshalb nie allein am Zeilenanfang landen.
 */
function Aktivitaet({ aktivitaet }: { aktivitaet: FarmAktivitaet }) {
  const teile = aktivitaetsTeile(aktivitaet)

  if (teile.length === 0) {
    // Deutlich sichtbar, aber ohne Alarmfarbe: die Textfarbe des Vordergrunds
    // reicht, um im Grau der übrigen Angaben aufzufallen.
    return <p className="mt-3 text-xs font-medium text-foreground">{AKTIVITAET_LEER}</p>
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      {teile.map((teil, i) => (
        <span key={teil} className="flex items-center gap-2">
          {teil}
          {i < teile.length - 1 && (
            <span aria-hidden="true" className="text-border">
              ·
            </span>
          )}
        </span>
      ))}
    </div>
  )
}

function statusOf(farm: Farm): { label: string; className: string } {
  if (farm.archivedAt) return { label: 'stillgelegt', className: 'bg-muted text-muted-foreground' }
  if (farm.approvedAt === null) return { label: 'wartet', className: 'bg-sky-100 text-sky-900' }
  return { label: 'freigeschaltet', className: 'bg-primary/10 text-primary' }
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function AdminFarmList({
  farms,
  vergebenePlaetze,
}: {
  farms: Farm[]
  vergebenePlaetze: number
}) {
  // Bekäme ein jetzt freigeschalteter Hof noch einen Platz? Die 12 sind eine
  // Konditions-, keine Zugangsgrenze — Freischalten bleibt in jedem Fall
  // möglich, der Dialog sagt nur, was es für die Konditionen bedeutet.
  const plaetzeFrei = vergebenePlaetze < MAX_GRUENDUNGSHOEFE
  const [isPending, startTransition] = useTransition()
  // Der Hof, für den gerade eine Rückfrage offen ist — plus die Richtung.
  const [dialog, setDialog] = useState<{
    farm: Farm
    action: 'approve' | 'revoke' | 'reject'
  } | null>(null)

  function run() {
    if (!dialog) return
    const { farm, action } = dialog
    startTransition(async () => {
      const result =
        action === 'approve'
          ? await approveFarmAction(farm.id)
          : action === 'revoke'
            ? await revokeFarmApprovalAction(farm.id)
            : await rejectFarmAction(farm.id)
      if (result.error) {
        // Die Ablehnung kann an einem Guard scheitern (Bestellungen am Hof,
        // Betreiber-Konto) — dann steht der Grund in der Meldung und der
        // Betreiber weiß, warum nichts passiert ist.
        toast.error(result.error)
      } else {
        toast.success(
          action === 'approve'
            ? `${farm.name} freigeschaltet`
            : action === 'revoke'
              ? `Freigabe für ${farm.name} zurückgenommen`
              : `${farm.name} abgelehnt und gelöscht`
        )
      }
      setDialog(null)
    })
  }

  if (farms.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch kein Hof registriert.</p>
  }

  return (
    <>
      {/* Am Telefon stapeln die Höfe als Karten, ab sm steht mehr nebeneinander —
          bewusst keine echte Tabelle, die bei 375px seitlich wegläuft. */}
      <ul className="space-y-3">
        {farms.map((farm) => {
          const status = statusOf(farm)
          return (
            <li key={farm.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-foreground break-words">{farm.name}</p>
                  <p className="text-xs text-muted-foreground break-all">/{farm.slug}</p>
                </div>
                {/* Zwei Marken nebeneinander. `shrink-0` hält die Gruppe
                    zusammen; wird es eng, wandert sie als Ganzes unter den
                    Hofnamen (flex-wrap am Elternteil) — die Zeile bricht
                    also nie mitten in einer Marke. Ruhig, aber deutlich:
                    Sandfläche mit dunkler Schrift (rund 6,4:1), keine
                    Alarmfarbe. */}
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {farm.land === 'DE' && (
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-semibold"
                      style={{ background: '#F3EFE6', color: '#2D5F3F' }}
                    >
                      {LAND_LABEL.DE}
                    </span>
                  )}
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>
                    {status.label}
                  </span>
                </div>
              </div>

              <dl className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <div className="flex gap-1.5 min-w-0">
                  <dt className="shrink-0">Hof-ID:</dt>
                  <dd className="font-mono break-all">{farm.id}</dd>
                </div>
                <div className="flex gap-1.5 min-w-0">
                  <dt className="shrink-0">Inhaber:</dt>
                  <dd className="break-all">{farm.ownerEmail}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="shrink-0">Registriert:</dt>
                  <dd>{formatDate(farm.createdAt)}</dd>
                </div>
                {farm.approvedAt && (
                  <div className="flex gap-1.5">
                    <dt className="shrink-0">Freigeschaltet:</dt>
                    <dd>{formatDate(farm.approvedAt)}</dd>
                  </div>
                )}
                {/* Nur bei freigeschalteten Höfen: ein wartender Hof hat noch
                    keinen Platz, ein stillgelegter belegt keinen mehr. */}
                {farm.approvedAt && !farm.archivedAt && (
                  <div className="flex gap-1.5 min-w-0">
                    <dt className="shrink-0">Gründungsplatz:</dt>
                    <dd
                      className={
                        farm.gruendungsplatz !== null && farm.gruendungsplatz <= MAX_GRUENDUNGSHOEFE
                          ? 'font-medium text-primary'
                          : undefined
                      }
                    >
                      {farm.gruendungsplatz !== null && farm.gruendungsplatz <= MAX_GRUENDUNGSHOEFE
                        ? gruendungshofLabel(farm.gruendungsplatz)
                        : KEIN_GRUENDUNGSPLATZ}
                    </dd>
                  </div>
                )}
              </dl>

              <Aktivitaet aktivitaet={farm.aktivitaet} />

              {/* Ein wartender Hof, an dem seit der Anmeldung nichts passiert
                  ist. Bewusst leise: gedeckte Farben, gestrichelter Rahmen,
                  kein Orange — der Akzent gehört der Startseite. Es steht auch
                  bewusst nur ein Sachverhalt da und keine Empfehlung; wer
                  abgelehnt wird, entscheidet der Betreiber. */}
              {farm.approvedAt === null && istOhneInhalt(farm.aktivitaet) && (
                <p className="mt-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Seit der Anmeldung am {formatDate(farm.createdAt)} wurde nichts eingerichtet.
                </p>
              )}

              {/* flex-wrap statt einer festen Zeile: bei 375px rutscht die
                  zweite Schaltfläche unter die erste, statt schmal gequetscht
                  danebenzustehen. */}
              {/* Die Erinnerung vor der Freischaltung — KEINE Sperre: Die
                  Schaltfläche darunter bleibt unverändert bedienbar. */}
              {farm.approvedAt === null && farm.land === 'DE' && (
                <p className="mt-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  {DE_ADMIN_KLAERUNG}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {farm.approvedAt === null ? (
                  <>
                    <Button
                      size="sm"
                      disabled={isPending}
                      onClick={() => setDialog({ farm, action: 'approve' })}
                    >
                      Freischalten
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDialog({ farm, action: 'reject' })}
                    >
                      Ablehnen &amp; löschen
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => setDialog({ farm, action: 'revoke' })}
                  >
                    Freigabe zurücknehmen
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {dialog?.action === 'approve'
                ? 'Hof freischalten?'
                : dialog?.action === 'revoke'
                  ? 'Freigabe zurücknehmen?'
                  : 'Endgültig löschen?'}
            </DialogTitle>
          </DialogHeader>
          {dialog?.action === 'reject' ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">{dialog.farm.name}</strong> wird gelöscht — samt
                dem Konto <span className="break-all">{dialog.farm.ownerEmail}</span>, den Produkten,
                Abholzeiten und Fotos.
              </p>
              <p className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-foreground">
                Endgültig, nicht umkehrbar. Für echte Höfe gibt es das Zurücknehmen der Freigabe —
                das löscht nichts.
              </p>
              <p>Höfe mit Bestellungen oder Verkäufen lehnt der Server ab.</p>
            </div>
          ) : dialog?.action === 'approve' ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">{dialog.farm.name}</strong> wird sofort
                öffentlich erreichbar und kann Bestellungen entgegennehmen.
              </p>
              {plaetzeFrei ? (
                <p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-foreground">
                  Dieser Hof belegt {gruendungshofLabel(vergebenePlaetze + 1)}.
                  <br />
                  {GRUENDUNGS_KONDITIONEN}
                </p>
              ) : (
                <p className="rounded-lg border border-border bg-muted p-3">
                  Alle {MAX_GRUENDUNGSHOEFE} Gründungsplätze sind vergeben — dieser Hof bekommt
                  keinen Gründungsplatz. Freischalten ist trotzdem möglich.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Die Hofseite von <strong className="text-foreground">{dialog?.farm.name}</strong> ist
              danach nicht mehr erreichbar und Bestellungen werden abgelehnt. Es wird nichts
              gelöscht — der Bauer behält Zugang zu allen Daten.
              {dialog !== null &&
                dialog.farm.gruendungsplatz !== null &&
                dialog.farm.gruendungsplatz <= MAX_GRUENDUNGSHOEFE && (
                  <>
                    {' '}
                    Sein Gründungsplatz wird frei, die nachfolgenden Höfe rücken auf.
                  </>
                )}
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={isPending}>
              Abbrechen
            </Button>
            <Button
              variant={dialog?.action === 'approve' ? 'default' : 'destructive'}
              onClick={run}
              disabled={isPending}
            >
              {isPending
                ? 'Moment…'
                : dialog?.action === 'approve'
                  ? 'Freischalten'
                  : dialog?.action === 'revoke'
                    ? 'Zurücknehmen'
                    : 'Endgültig löschen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
