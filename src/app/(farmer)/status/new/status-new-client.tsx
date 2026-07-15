'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Leaf, CalendarDays, Tag, MessageCircle,
  Home, Mail, MessageSquare, CircleDot,
  Mic, Sparkles, ArrowRight, CheckCircle, Check,
  Camera, Loader2, X,
} from 'lucide-react'
import { publishStatusPost } from '@/server/actions/status-posts'
import { useImageUpload } from '@/components/shared/image-upload'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { stripStatusVariables } from '@/lib/status-body'

type Anlass = 'FRESH_PRODUCT' | 'NEW_SEASON' | 'PROMOTION' | 'ANNOUNCEMENT'

const ANLASS_OPTIONS: { value: Anlass; label: string; icon: React.ReactNode }[] = [
  { value: 'FRESH_PRODUCT', label: 'Frisches Produkt', icon: <Leaf className="size-5" /> },
  { value: 'NEW_SEASON',    label: 'Neue Saison',      icon: <CalendarDays className="size-5" /> },
  { value: 'PROMOTION',     label: 'Aktion',           icon: <Tag className="size-5" /> },
  { value: 'ANNOUNCEMENT',  label: 'Mitteilung',       icon: <MessageCircle className="size-5" /> },
]

// Badge colors for preview (read-only, not used for active state)
const ANLASS_COLOR: Record<Anlass, string> = {
  FRESH_PRODUCT: 'text-primary bg-primary/10',
  NEW_SEASON:    'text-emerald-700 bg-emerald-50',
  PROMOTION:     'text-amber-700 bg-amber-50',
  ANNOUNCEMENT:  'text-blue-700 bg-blue-50',
}

interface Props {
  products: { id: string; name: string; price: number }[]
  emailCount: number
  whatsAppCount: number
  recentEmailSentAt: string | null
  farmSlug: string
}

// ── Visual stepper ──────────────────────────────────────────────────────────
function Stepper({ step }: { step: number }) {
  const steps = ['Inhalt', 'Empfänger', 'Versand']
  return (
    <div className="flex items-start mb-7">
      {steps.map((label, i) => {
        const num = i + 1
        const isDone = step > num
        const isActive = step === num
        const isLast = i === steps.length - 1
        return (
          <div key={label} className="contents">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all shrink-0',
                  isDone || isActive
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground',
                )}
              >
                {isDone ? <Check className="w-3.5 h-3.5" /> : num}
              </div>
              <span
                className={cn(
                  'text-[11px] font-medium leading-none',
                  isActive ? 'text-foreground' : isDone ? 'text-primary/70' : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
            </div>
            {!isLast && (
              <div className={cn('flex-1 h-0.5 mt-3.5 mx-1', isDone ? 'bg-primary/50' : 'bg-border')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function StatusNewClient({ products, emailCount, whatsAppCount, recentEmailSentAt }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [step, setStep] = useState(1)

  // Form state
  const [anlass, setAnlass] = useState<Anlass>('FRESH_PRODUCT')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [linkedProductIds, setLinkedProductIds] = useState<string[]>([])

  const photoUpload = useImageUpload({
    variant: 'status',
    oldUrl: photoUrl ?? undefined,
    onUploaded: (url) => setPhotoUrl(url),
  })

  // A3: field validation errors
  const [fieldErrors, setFieldErrors] = useState<{ title?: boolean; body?: boolean }>({})

  // Channel state
  const [showOnFarmPage, setShowOnFarmPage] = useState(true)
  const [sendEmail, setSendEmail] = useState(emailCount > 0)
  const [sendWhatsApp, setSendWhatsApp] = useState(false)
  const [sendWhatsAppStatus, setSendWhatsAppStatus] = useState(false)

  const recentEmailDaysAgo = recentEmailSentAt
    ? Math.floor((Date.now() - new Date(recentEmailSentAt).getTime()) / (1000 * 60 * 60 * 24))
    : null
  const emailBlocked = recentEmailDaysAgo !== null && recentEmailDaysAgo < 7

  // A3: validate step 1 on click, show field errors instead of silent disabled
  function handleTryNext() {
    const errs: { title?: boolean; body?: boolean } = {}
    if (!title.trim()) errs.title = true
    if (!body.trim()) errs.body = true

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      const firstId = errs.title ? 'status-title' : 'status-body'
      document.getElementById(firstId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      toast.error('Bitte alle Pflichtfelder ausfüllen.')
      return
    }

    setFieldErrors({})
    setStep(2)
  }

  function handlePublish() {
    startTransition(async () => {
      const res = await publishStatusPost({
        title: title.trim(),
        body: body.trim(),
        anlass,
        photoUrl: photoUrl ?? undefined,
        linkedProductIds,
        showOnFarmPage,
        sendEmail: sendEmail && !emailBlocked,
        sendWhatsApp,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      if (sendWhatsApp && whatsAppCount > 0 && res.postId) {
        router.push(`/status/${res.postId}/send-whatsapp`)
      } else {
        const parts: string[] = []
        if (showOnFarmPage) parts.push('auf der Hof-Seite')
        if (sendEmail && !emailBlocked && (res.emailCount ?? 0) > 0)
          parts.push(`${res.emailCount} E-Mails versendet`)
        toast.success(`Status veröffentlicht${parts.length ? ' — ' + parts.join(', ') : ''}`)
        router.push('/status')
      }
    })
  }

  const anlassMeta = ANLASS_OPTIONS.find((o) => o.value === anlass)!

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-2xl shadow-[0_4px_16px_oklch(0.18_0.03_150_/_0.06)] p-6 md:p-8">
        <Stepper step={step} />

        {/* ── Step 1: Content ─────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <div className="mb-6">
              <h1 className="font-heading text-xl font-semibold text-foreground">Neuer Status</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Inhalt erstellen</p>
            </div>

            {/* Anlass — A6: active = soft-green fill + dark green border + check */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-foreground mb-2">Anlass</label>
              <div className="grid grid-cols-2 gap-2">
                {ANLASS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAnlass(opt.value)}
                    className={cn(
                      'relative flex items-center gap-2.5 p-3 rounded-xl border-2 text-sm font-medium transition-all text-left',
                      anlass === opt.value
                        ? 'bg-[#E8F0E8] border-primary text-primary'
                        : 'border-border text-muted-foreground hover:border-border/80 hover:bg-muted/40',
                    )}
                  >
                    {opt.icon}
                    <span className="flex-1">{opt.label}</span>
                    {anlass === opt.value && <Check className="size-4 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="status-title" className="text-sm font-medium text-foreground">
                  Titel *
                </label>
                <span className="text-xs text-muted-foreground">{title.length}/80</span>
              </div>
              <input
                id="status-title"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value.slice(0, 80))
                  if (fieldErrors.title) setFieldErrors((p) => ({ ...p, title: false }))
                }}
                placeholder="z.B. Frisches Rindfleisch ab Samstag"
                className={cn(
                  'w-full h-11 px-3 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 transition-colors',
                  fieldErrors.title
                    ? 'border-destructive focus:ring-destructive/30'
                    : 'border-border focus:ring-primary/30',
                )}
              />
              {fieldErrors.title && (
                <p className="text-xs text-destructive mt-1">Bitte einen Titel eingeben.</p>
              )}
            </div>

            {/* Body */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="status-body" className="text-sm font-medium text-foreground">
                  Nachricht *
                </label>
                <span className="text-xs text-muted-foreground">{body.length}/500</span>
              </div>
              <textarea
                id="status-body"
                value={body}
                onChange={(e) => {
                  setBody(e.target.value.slice(0, 500))
                  if (fieldErrors.body) setFieldErrors((p) => ({ ...p, body: false }))
                }}
                placeholder="Schreibe hier deine Neuigkeit…"
                rows={5}
                className={cn(
                  'w-full px-3 py-2.5 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 resize-none transition-colors',
                  fieldErrors.body
                    ? 'border-destructive focus:ring-destructive/30'
                    : 'border-border focus:ring-primary/30',
                )}
              />
              {fieldErrors.body && (
                <p className="text-xs text-destructive mt-1">Bitte eine Nachricht eingeben.</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Tipp:{' '}
                <code className="bg-muted px-1 rounded">{'{Vorname}'}</code> wird automatisch
                ersetzt.
              </p>
            </div>

            {/* Optionales Foto */}
            {photoUpload.fileInput}
            {photoUrl && (
              <div className="relative w-full aspect-[3/2] max-h-48 mb-3 rounded-xl overflow-hidden border border-border">
                <Image
                  src={photoUrl}
                  alt="Status-Foto"
                  fill
                  sizes="(min-width: 768px) 640px, 100vw"
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  aria-label="Foto entfernen"
                  className="absolute top-2 right-2 flex items-center justify-center size-7 rounded-full text-white transition-opacity hover:opacity-90"
                  style={{ background: 'rgba(45,48,39,0.85)' }}
                >
                  <X className="size-4" />
                </button>
              </div>
            )}

            {/* Feature buttons */}
            <div className="flex gap-2 mb-5">
              <button
                type="button"
                onClick={photoUpload.openFilePicker}
                disabled={photoUpload.isUploading}
                className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-xs text-foreground hover:bg-muted/40 disabled:opacity-60"
              >
                {photoUpload.isUploading
                  ? <Loader2 className="size-3.5 animate-spin" />
                  : <Camera className="size-3.5" />}
                {photoUpload.isUploading ? 'Lädt…' : photoUrl ? 'Foto ersetzen' : 'Foto hinzufügen'}
              </button>
              <button
                className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-xs text-muted-foreground cursor-not-allowed opacity-50"
                disabled
                title="Kommt bald"
              >
                <Mic className="size-3.5" />
                Sprachnotiz
              </button>
              <button
                className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-xs text-muted-foreground cursor-not-allowed opacity-50"
                disabled
                title="Kommt bald"
              >
                <Sparkles className="size-3.5" />
                KI-Hilfe
              </button>
            </div>

            {/* Product links */}
            {products.length > 0 && (
              <div className="mb-5">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Produkte verlinken{' '}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      onClick={() =>
                        setLinkedProductIds((prev) =>
                          prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id],
                        )
                      }
                      className={cn(
                        'text-xs px-3 py-1.5 rounded-full border transition-colors',
                        linkedProductIds.includes(p.id)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-muted-foreground hover:border-foreground/30',
                      )}
                    >
                      {p.name} — € {p.price.toFixed(2).replace('.', ',')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* A2: orange CTA, A3: always clickable — validates on click */}
            <button
              onClick={handleTryNext}
              className="w-full h-12 rounded-xl bg-accent text-accent-foreground font-semibold flex items-center justify-center gap-2 hover:bg-accent-hover transition-colors"
            >
              Weiter zu Empfängern
              <ArrowRight className="size-4" />
            </button>
          </div>
        )}

        {/* ── Step 2: Channels ────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <div className="mb-6">
              <button
                onClick={() => setStep(1)}
                className="text-sm text-muted-foreground hover:text-foreground mb-3 block"
              >
                ← Zurück
              </button>
              <h1 className="font-heading text-xl font-semibold text-foreground">
                Empfänger wählen
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">Kanäle auswählen</p>
            </div>

            <div className="space-y-3 mb-5">
              <ChannelCard
                icon={<Home className="size-5" />}
                title="Auf meiner Hof-Seite anzeigen"
                subtitle="Alle Besucher sehen es · für 7 Tage prominent"
                checked={showOnFarmPage}
                onChange={setShowOnFarmPage}
              />
              <ChannelCard
                icon={<Mail className="size-5" />}
                title="Per E-Mail an Abonnenten"
                subtitle={
                  emailBlocked
                    ? `Du hast vor ${recentEmailDaysAgo} Tagen bereits E-Mails versendet (Limit: 1× pro 7 Tage)`
                    : emailCount > 0
                      ? `${emailCount} ${emailCount === 1 ? 'Kunde hat' : 'Kunden haben'} E-Mail-Updates abonniert`
                      : 'Noch keine Abonnenten'
                }
                checked={sendEmail && !emailBlocked}
                onChange={emailBlocked ? undefined : setSendEmail}
                disabled={emailCount === 0 || emailBlocked}
              />
              <ChannelCard
                icon={<MessageSquare className="size-5" />}
                title="Per WhatsApp an Abonnenten"
                subtitle={
                  whatsAppCount > 0
                    ? `${whatsAppCount} ${whatsAppCount === 1 ? 'Kunde' : 'Kunden'} · je 1 Tap auf "Senden"`
                    : 'Noch keine Abonnenten'
                }
                checked={sendWhatsApp}
                onChange={setSendWhatsApp}
                disabled={whatsAppCount === 0}
              />
              <ChannelCard
                icon={<CircleDot className="size-5" />}
                title="Als WhatsApp-Status-Bild teilen"
                subtitle="Wir erstellen ein Bild — du postest es 1× in deinen Status"
                checked={sendWhatsAppStatus}
                onChange={setSendWhatsAppStatus}
              />
            </div>

            <div className="bg-muted rounded-xl p-4 mb-5 text-sm text-muted-foreground">
              Nur Kunden, die selbst angehakt haben, dass sie informiert werden möchten, bekommen
              E-Mail oder WhatsApp.
            </div>

            {/* A2: orange CTA */}
            <button
              onClick={() => setStep(3)}
              className="w-full h-12 rounded-xl bg-accent text-accent-foreground font-semibold flex items-center justify-center gap-2 hover:bg-accent-hover transition-colors"
            >
              Vorschau ansehen
              <ArrowRight className="size-4" />
            </button>
          </div>
        )}

        {/* ── Step 3: Preview + Send ──────────────────────────────────── */}
        {step === 3 && (
          <div>
            <div className="mb-6">
              <button
                onClick={() => setStep(2)}
                className="text-sm text-muted-foreground hover:text-foreground mb-3 block"
              >
                ← Zurück
              </button>
              <h1 className="font-heading text-xl font-semibold text-foreground">
                Vorschau & Versand
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">Überprüfen und absenden</p>
            </div>

            {/* Preview card */}
            <div className="bg-card rounded-xl border border-border p-4 mb-5">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 font-medium mb-3',
                  ANLASS_COLOR[anlass],
                )}
              >
                {anlassMeta.icon}
                {anlassMeta.label}
              </span>
              <h2 className="font-heading text-lg font-semibold text-foreground mb-2">{title}</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{stripStatusVariables(body)}</p>
              {linkedProductIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/50">
                  {products
                    .filter((p) => linkedProductIds.includes(p.id))
                    .map((p) => (
                      <span
                        key={p.id}
                        className="text-xs bg-muted rounded-full px-3 py-1 text-foreground"
                      >
                        {p.name} — € {p.price.toFixed(2).replace('.', ',')}
                      </span>
                    ))}
                </div>
              )}
            </div>

            {/* Recipient summary */}
            <div className="bg-muted rounded-xl p-4 mb-5 space-y-2">
              <h3 className="text-sm font-semibold text-foreground mb-2">Empfänger</h3>
              {showOnFarmPage && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="size-4 text-green-600 shrink-0" />
                  Auf Hof-Seite für 7 Tage anzeigen
                </div>
              )}
              {sendEmail && !emailBlocked && emailCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="size-4 text-green-600 shrink-0" />
                  {emailCount} E-Mails werden automatisch versendet
                </div>
              )}
              {sendWhatsApp && whatsAppCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="size-4 text-green-600 shrink-0" />
                  {whatsAppCount} WhatsApp-Nachrichten (je 1 Tap)
                </div>
              )}
              {sendWhatsAppStatus && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="size-4 text-green-600 shrink-0" />
                  WhatsApp-Status-Bild zum Download
                </div>
              )}
            </div>

            {/* A2: orange CTA */}
            <button
              onClick={handlePublish}
              disabled={pending}
              className="w-full h-12 rounded-xl bg-accent text-accent-foreground font-semibold hover:bg-accent-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {pending ? 'Wird versendet…' : 'Versand starten'}
            </button>

            {sendWhatsAppStatus && (
              <p className="text-xs text-muted-foreground text-center mt-3">
                Das Status-Bild wird nach dem Versand zum Download bereitstehen.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ChannelCard({
  icon,
  title,
  subtitle,
  checked,
  onChange,
  disabled = false,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  checked: boolean
  onChange?: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange?.(!checked)}
      disabled={disabled}
      className={cn(
        'w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all',
        checked && !disabled ? 'border-primary bg-primary/5' : 'border-border hover:border-border/80',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <div
        className={cn(
          'size-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
          checked && !disabled ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
      </div>
      <div
        className={cn(
          'size-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-1 transition-colors',
          checked && !disabled ? 'bg-primary border-primary' : 'border-border',
        )}
      >
        {checked && !disabled && <CheckCircle className="size-3.5 text-primary-foreground" />}
      </div>
    </button>
  )
}
