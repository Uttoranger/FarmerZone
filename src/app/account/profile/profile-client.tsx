'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Mail, MessageCircle, Trash2, BellOff, ExternalLink, LogOut } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import { updateSubscription, deleteCustomerAccount } from '@/server/actions/subscriptions'
import { ABO_TEXT } from '@/lib/abo-bestaetigung'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { KARTE, KNOPF_GRUEN, KNOPF_RAHMEN } from '@/components/bestaetigung/bestaetigung-teile'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

/*
 * „Mein Konto" der freiwilligen Kunden-Anmeldung — seit Nr. 14 im neuen Design
 * (KundeShell, Tokens), inhaltlich unverändert (E8: keine neuen
 * Konto-Funktionen): Abonnements je Hof, Abmelden, Konto löschen.
 * Zerstörendes steht orange umrandet, nie grün (DESIGN_SYSTEM, „Dialoge").
 */

interface SubscriptionRow {
  farmId: string
  farmName: string
  farmSlug: string
  optInEmail: boolean
  /** Anmeldung angefragt, Link noch gültig (Double-Opt-in, S11). */
  emailWartet: boolean
  optInWhatsApp: boolean
  customerPhone: string | null
}

interface Props {
  user: { id: string; email: string }
  subscriptions: SubscriptionRow[]
}

const ETIKETT = 'text-[11px] font-semibold tracking-[1.1px] text-muted-foreground uppercase'

/** Zerstörende Aktion: orange Rahmen, oranger Text (text-status-offen hält 4,5:1 in beiden Themes). */
const KNOPF_ZERSTOEREND = cn(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-primary/60 px-[18px] text-[14px] font-semibold text-status-offen transition-colors duration-[250ms] hover:bg-primary/12',
  FOKUS_RAHMEN
)

export function ProfileClient({ user, subscriptions: initialSubs }: Props): React.JSX.Element {
  const [subs, setSubs] = useState(initialSubs)
  const [isPending, startTransition] = useTransition()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  function toggleEmail(farmId: string) {
    const sub = subs.find((s) => s.farmId === farmId)
    if (!sub) return
    // Wartet die Anmeldung auf den Link, schaltet ein Tipp sie ab (wie „an").
    const newOptIn = !(sub.optInEmail || sub.emailWartet)
    const vorher = { optInEmail: sub.optInEmail, emailWartet: sub.emailWartet }
    setSubs((prev) =>
      prev.map((s) => (s.farmId === farmId ? { ...s, optInEmail: newOptIn, emailWartet: false } : s)),
    )
    startTransition(async () => {
      const result = await updateSubscription(farmId, newOptIn, sub.optInWhatsApp)
      if (result.error) {
        toast.error(result.error)
        setSubs((prev) => prev.map((s) => (s.farmId === farmId ? { ...s, ...vorher } : s)))
        return
      }
      // E-Mail an heißt bei einer neuen Anmeldung: erst bestätigen (S11).
      setSubs((prev) =>
        prev.map((s) =>
          s.farmId === farmId ? { ...s, optInEmail: result.email === 'an', emailWartet: result.email === 'wartet' } : s,
        ),
      )
      if (result.email === 'wartet') toast.success(ABO_TEXT.profilWartet)
      else toast.success(result.email === 'an' ? 'E-Mail-Abo aktiviert' : 'E-Mail-Abo deaktiviert')
    })
  }

  function toggleWhatsApp(farmId: string) {
    const sub = subs.find((s) => s.farmId === farmId)
    if (!sub) return
    const newOptIn = !sub.optInWhatsApp
    setSubs((prev) =>
      prev.map((s) => (s.farmId === farmId ? { ...s, optInWhatsApp: newOptIn } : s)),
    )
    startTransition(async () => {
      // E-Mail bleibt, wie sie ist: Eine wartende Anmeldung zählt als „an",
      // sonst stellte der WhatsApp-Schalter sie still ab.
      const result = await updateSubscription(farmId, sub.optInEmail || sub.emailWartet, newOptIn)
      if (result.error) {
        toast.error(result.error)
        setSubs((prev) =>
          prev.map((s) => (s.farmId === farmId ? { ...s, optInWhatsApp: !newOptIn } : s)),
        )
      } else {
        toast.success(newOptIn ? 'WhatsApp-Abo aktiviert' : 'WhatsApp-Abo deaktiviert')
      }
    })
  }

  async function handleDeleteAccount() {
    setIsDeleting(true)
    const result = await deleteCustomerAccount()
    if (result.error) {
      toast.error(result.error)
      setIsDeleting(false)
      return
    }
    await authClient.signOut()
    router.push('/')
  }

  async function handleLogout() {
    await authClient.signOut()
    router.push('/account/login')
  }

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-8 px-4 pt-6 pb-12 md:pt-10">
      {/* Kopf */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-[26px] leading-tight font-semibold md:text-[30px]">Mein Konto</h1>
          <p className="mt-0.5 text-[13.5px] break-words text-muted-foreground [overflow-wrap:anywhere]">{user.email}</p>
        </div>
        <button type="button" onClick={handleLogout} className={KNOPF_RAHMEN}>
          <LogOut className="size-4" strokeWidth={1.7} aria-hidden="true" />
          Abmelden
        </button>
      </div>

      {/* Abonnements */}
      <section aria-labelledby="abos-titel" className="flex flex-col gap-3">
        <h2 id="abos-titel" className={ETIKETT}>
          Meine Abonnements
        </h2>

        {subs.length === 0 ? (
          <EmptyState
            symbol={BellOff}
            titel="Du hast noch keine Benachrichtigungen abonniert."
            satz="Beim nächsten Einkauf kannst du dich für Neuigkeiten anmelden."
            aktion={
              <Link href="/hoefe" className={KNOPF_GRUEN}>
                Höfe entdecken
              </Link>
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {subs.map((sub) => (
              <li key={sub.farmId} className={cn(KARTE, 'transition-opacity', isPending && 'opacity-70')}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-semibold" title={sub.farmName}>
                    {sub.farmName}
                  </p>
                  <Link
                    href={`/${sub.farmSlug}`}
                    target="_blank"
                    aria-label={`Hofseite von ${sub.farmName} öffnen (neuer Tab)`}
                    className={cn(
                      'flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                      FOKUS_RAHMEN
                    )}
                  >
                    <ExternalLink className="size-4" strokeWidth={1.7} aria-hidden="true" />
                  </Link>
                </div>

                <div className="flex flex-col">
                  <ToggleRow
                    icon={Mail}
                    label="E-Mail-Neuigkeiten"
                    hof={sub.farmName}
                    active={sub.optInEmail || sub.emailWartet}
                    hinweis={sub.emailWartet ? 'Wartet auf deine Bestätigung – schau in dein Postfach.' : undefined}
                    onToggle={() => toggleEmail(sub.farmId)}
                  />
                  <ToggleRow
                    icon={MessageCircle}
                    label="WhatsApp-Neuigkeiten"
                    hof={sub.farmName}
                    active={sub.optInWhatsApp}
                    disabled={!sub.customerPhone}
                    disabledNote="Keine Telefonnummer hinterlegt"
                    onToggle={() => toggleWhatsApp(sub.farmId)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Konto löschen */}
      <section aria-labelledby="konto-titel" className="flex flex-col gap-3">
        <h2 id="konto-titel" className={ETIKETT}>
          Konto
        </h2>
        <div className={cn(KARTE, 'flex flex-col items-start gap-2')}>
          <button type="button" onClick={() => setDeleteDialogOpen(true)} className={KNOPF_ZERSTOEREND}>
            <Trash2 className="size-4" strokeWidth={1.7} aria-hidden="true" />
            Konto und alle Abos löschen (DSGVO)
          </button>
          <p className="text-[12.5px] leading-normal text-muted-foreground">
            Deine Bestellungen bleiben aus steuerlichen Gründen gespeichert.
          </p>
        </div>
      </section>

      {/* Löschen bestätigen */}
      <Dialog open={deleteDialogOpen} onOpenChange={(o) => !o && setDeleteDialogOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Konto wirklich löschen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Dein Konto und alle Benachrichtigungs-Abonnements werden gelöscht. Bestehende
            Bestellungen bleiben aus steuerlichen Gründen erhalten.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Abbrechen
            </Button>
            <button type="button" onClick={handleDeleteAccount} disabled={isDeleting} className={cn(KNOPF_ZERSTOEREND, 'disabled:opacity-60')}>
              {isDeleting ? 'Lösche…' : 'Konto löschen'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ToggleRow({
  icon: Symbol,
  label,
  hof,
  active,
  disabled,
  disabledNote,
  hinweis,
  onToggle,
}: {
  icon: typeof Mail
  label: string
  hof: string
  active: boolean
  disabled?: boolean
  disabledNote?: string
  /** Kurzer Satz unter dem Namen, z. B. „Wartet auf deine Bestätigung" (S11). */
  hinweis?: string
  onToggle: () => void
}) {
  const hinweisId = useId()
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 py-1">
      <div className="flex min-w-0 items-center gap-2.5">
        <Symbol className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
        <div className="min-w-0">
          <span className={cn('text-[14px]', disabled ? 'text-muted-foreground' : 'text-foreground')}>{label}</span>
          {disabled && disabledNote && <p className="text-[12px] text-muted-foreground">{disabledNote}</p>}
          {hinweis && (
            <p id={hinweisId} className="text-[12px] text-status-offen">
              {hinweis}
            </p>
          )}
        </div>
      </div>
      {/* Ein Schalter: Rolle „switch" sagt dem Screenreader Zustand und Zweck.
          Sichtbar 24 px hoch, die Trefferfläche über ::before 44 px. */}
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-describedby={hinweis ? hinweisId : undefined}
        aria-label={`${label} von ${hof}`}
        onClick={onToggle}
        disabled={disabled}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 before:absolute before:-inset-x-0 before:-inset-y-2.5 before:content-[''] disabled:cursor-not-allowed disabled:opacity-40",
          active ? 'bg-accent' : 'bg-muted-foreground/45',
          FOKUS_RAHMEN
        )}
      >
        {/* Der Schieber in Crème (accent-foreground): im neuen Design in beiden
            Themes hell — er liegt auf grüner wie auf grauer Schiene sichtbar. */}
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-5 rounded-full bg-accent-foreground shadow transition-transform duration-200',
            active ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  )
}
