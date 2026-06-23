'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Mail, MessageCircle, Trash2, Bell, BellOff, ExternalLink, LogOut } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { updateSubscription, deleteCustomerAccount } from '@/server/actions/subscriptions'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface SubscriptionRow {
  farmId: string
  farmName: string
  farmSlug: string
  optInEmail: boolean
  optInWhatsApp: boolean
  customerPhone: string | null
}

interface Props {
  user: { id: string; name: string; email: string }
  subscriptions: SubscriptionRow[]
}

export function ProfileClient({ user, subscriptions: initialSubs }: Props) {
  const [subs, setSubs] = useState(initialSubs)
  const [isPending, startTransition] = useTransition()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  function toggleEmail(farmId: string) {
    const sub = subs.find((s) => s.farmId === farmId)
    if (!sub) return
    const newOptIn = !sub.optInEmail
    setSubs((prev) =>
      prev.map((s) => (s.farmId === farmId ? { ...s, optInEmail: newOptIn } : s)),
    )
    startTransition(async () => {
      const result = await updateSubscription(farmId, newOptIn, sub.optInWhatsApp)
      if (result.error) {
        toast.error(result.error)
        setSubs((prev) =>
          prev.map((s) => (s.farmId === farmId ? { ...s, optInEmail: !newOptIn } : s)),
        )
      } else {
        toast.success(newOptIn ? 'E-Mail-Abo aktiviert' : 'E-Mail-Abo deaktiviert')
      }
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
      const result = await updateSubscription(farmId, sub.optInEmail, newOptIn)
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
    <div className="min-h-screen bg-background px-4 py-10 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Mein Konto</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{user.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Abmelden
        </button>
      </div>

      {/* Subscriptions */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Meine Abonnements
        </h2>

        {subs.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <BellOff className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Du hast noch keine Benachrichtigungen abonniert.
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Beim nächsten Einkauf kannst du dich für Neuigkeiten anmelden.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {subs.map((sub) => (
              <Card key={sub.farmId} className={isPending ? 'opacity-70' : ''}>
                <CardContent className="py-4 px-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-medium text-foreground">{sub.farmName}</p>
                    </div>
                    <Link
                      href={`/${sub.farmSlug}`}
                      target="_blank"
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <div className="flex flex-col gap-2">
                    <ToggleRow
                      icon={<Mail className="w-4 h-4" />}
                      label="E-Mail-Neuigkeiten"
                      active={sub.optInEmail}
                      onToggle={() => toggleEmail(sub.farmId)}
                    />
                    <ToggleRow
                      icon={<MessageCircle className="w-4 h-4" />}
                      label="WhatsApp-Neuigkeiten"
                      active={sub.optInWhatsApp}
                      disabled={!sub.customerPhone}
                      disabledNote="Keine Telefonnummer hinterlegt"
                      onToggle={() => toggleWhatsApp(sub.farmId)}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Konto löschen */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Konto
        </h2>
        <button
          onClick={() => setDeleteDialogOpen(true)}
          className="flex items-center gap-2 text-sm text-destructive hover:opacity-80 transition-opacity"
        >
          <Trash2 className="w-4 h-4" />
          Konto und alle Abos löschen (DSGVO)
        </button>
        <p className="text-xs text-muted-foreground mt-1">
          Deine Bestellungen bleiben aus steuerlichen Gründen gespeichert.
        </p>
      </section>

      {/* Delete confirm */}
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
            <Button variant="destructive" onClick={handleDeleteAccount} disabled={isDeleting}>
              {isDeleting ? 'Lösche…' : 'Konto löschen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ToggleRow({
  icon,
  label,
  active,
  disabled,
  disabledNote,
  onToggle,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  disabled?: boolean
  disabledNote?: string
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2.5">
        <span className={disabled ? 'text-muted-foreground/40' : 'text-muted-foreground'}>
          {icon}
        </span>
        <div>
          <span className={`text-sm ${disabled ? 'text-muted-foreground/50' : 'text-foreground'}`}>
            {label}
          </span>
          {disabled && disabledNote && (
            <p className="text-xs text-muted-foreground/50">{disabledNote}</p>
          )}
        </div>
      </div>
      <button
        onClick={onToggle}
        disabled={disabled}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 disabled:opacity-30 ${
          active ? 'bg-primary' : 'bg-muted-foreground/20'
        }`}
        aria-label={active ? 'Deaktivieren' : 'Aktivieren'}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
            active ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
