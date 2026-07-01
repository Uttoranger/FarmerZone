'use client'

import { useState, useTransition } from 'react'
import { Check, MessageSquare } from 'lucide-react'
import { markWhatsAppSent } from '@/server/actions/status-posts'
import { cn } from '@/lib/utils'

interface Subscriber {
  email: string
  phone: string
  name: string
}

interface Props {
  postId: string
  title: string
  body: string
  farmName: string
  farmSlug: string
  subscribers: Subscriber[]
  initialSentCount: number
}

function toWaPhone(phone: string): string {
  const digits = phone.replace(/[\s\-().+]/g, '')
  if (digits.startsWith('0')) return '43' + digits.slice(1)
  return digits
}

const APP_URL = typeof window !== 'undefined' ? window.location.origin : 'https://farmerzone.at'

export function WhatsAppTapClient({
  postId,
  title,
  body,
  farmName,
  farmSlug,
  subscribers,
  initialSentCount,
}: Props) {
  const [sent, setSent] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  const total = subscribers.length
  const sentCount = sent.size

  function markSent(email: string) {
    setSent((prev) => {
      const next = new Set(prev)
      next.add(email)
      // Persist count to server
      startTransition(async () => {
        await markWhatsAppSent(postId, next.size + initialSentCount)
      })
      return next
    })
  }

  function buildWaUrl(sub: Subscriber): string {
    const phone = toWaPhone(sub.phone)
    const firstName = sub.name.split(' ')[0]
    const farmUrl = `${APP_URL}/${farmSlug}`
    const message = `Hallo ${firstName}! 🌿\n\n*${title}*\n\n${body}\n\nMehr auf: ${farmUrl}`
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
  }

  if (total === 0) {
    return (
      <div className="text-center py-16">
        <p className="font-medium text-foreground mb-1">Keine WhatsApp-Abonnenten</p>
        <p className="text-sm text-muted-foreground">Es gibt noch keine Kunden mit WhatsApp-Opt-in.</p>
      </div>
    )
  }

  if (sentCount >= total) {
    return (
      <div className="text-center py-12">
        <div className="size-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <Check className="size-8 text-green-700" />
        </div>
        <h2 className="font-heading text-xl font-semibold text-foreground mb-1">
          Alle {total} Nachrichten versendet!
        </h2>
        <p className="text-sm text-muted-foreground">
          Du hast alle WhatsApp-Abonnenten kontaktiert.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-heading text-2xl font-semibold text-foreground">WhatsApp versenden</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tippe auf &quot;Senden&quot; — WhatsApp öffnet sich mit der fertigen Nachricht.
        </p>
      </div>

      {/* Preview */}
      <div className="bg-muted rounded-xl p-4 mb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Dein Status</p>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{body}</p>
      </div>

      {/* Progress */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-medium text-foreground">{sentCount} von {total} gesendet</span>
          <span className="text-muted-foreground">{total - sentCount} ausstehend</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-green-600 rounded-full transition-all duration-300"
            style={{ width: `${(sentCount / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Subscriber list */}
      <div className="flex flex-col gap-2">
        {subscribers.map((sub) => {
          const isSent = sent.has(sub.email)
          return (
            <div
              key={sub.email}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                isSent ? 'border-border bg-muted/40 opacity-60' : 'border-border bg-card'
              )}
            >
              {/* Avatar */}
              <div className={cn(
                'size-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
                isSent ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
              )}>
                {isSent ? <Check className="size-4" /> : sub.name.charAt(0).toUpperCase()}
              </div>

              {/* Name + phone */}
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium', isSent ? 'line-through text-muted-foreground' : 'text-foreground')}>
                  {sub.name}
                </p>
                <p className="text-xs text-muted-foreground">{sub.phone}</p>
              </div>

              {/* Action */}
              {isSent ? (
                <span className="text-xs text-green-700 font-medium shrink-0">Gesendet</span>
              ) : (
                <a
                  href={buildWaUrl(sub)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setTimeout(() => markSent(sub.email), 1000)}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors shrink-0"
                >
                  <MessageSquare className="size-3.5" />
                  Tippen
                </a>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center mt-5">
        Fortschritt wird automatisch gespeichert — du kannst jederzeit pausieren.
      </p>
    </div>
  )
}
