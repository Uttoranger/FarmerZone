'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { Leaf, CalendarDays, Tag, MessageCircle, Mail, MessageSquare, CheckCircle, Clock, FileText, Trash2, XCircle } from 'lucide-react'
import { expireStatusPost, deleteStatusPost } from '@/server/actions/status-posts'
import type { StatusPostSummary } from '@/server/queries/status-posts'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { renderStatusBodyWithChip } from '@/lib/status-body'

const ANLASS_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  FRESH_PRODUCT: { label: 'Frisches Produkt', icon: <Leaf className="size-3.5" />, color: 'bg-green-100 text-green-800' },
  NEW_SEASON: { label: 'Neue Saison', icon: <CalendarDays className="size-3.5" />, color: 'bg-emerald-100 text-emerald-800' },
  PROMOTION: { label: 'Aktion', icon: <Tag className="size-3.5" />, color: 'bg-amber-100 text-amber-800' },
  ANNOUNCEMENT: { label: 'Mitteilung', icon: <MessageCircle className="size-3.5" />, color: 'bg-blue-100 text-blue-800' },
}

export function StatusPostCard({ post }: { post: StatusPostSummary }) {
  const [pending, startTransition] = useTransition()
  const meta = ANLASS_META[post.anlass] ?? ANLASS_META.ANNOUNCEMENT

  function handleExpire() {
    startTransition(async () => {
      const res = await expireStatusPost(post.id)
      if (res.error) toast.error(res.error)
      else toast.success('Status deaktiviert')
    })
  }

  function handleDelete() {
    if (!confirm('Status wirklich löschen?')) return
    startTransition(async () => {
      const res = await deleteStatusPost(post.id)
      if (res.error) toast.error(res.error)
      else toast.success('Status gelöscht')
    })
  }

  const statusBadge = post.isActive
    ? { label: 'Aktiv', icon: <CheckCircle className="size-3" />, cls: 'bg-green-100 text-green-800' }
    : post.isDraft
    ? { label: 'Entwurf', icon: <FileText className="size-3" />, cls: 'bg-slate-100 text-slate-600' }
    : { label: 'Abgelaufen', icon: <Clock className="size-3" />, cls: 'bg-slate-100 text-slate-500' }

  const timeAgo = post.publishedAt
    ? (() => {
        const days = Math.floor((Date.now() - new Date(post.publishedAt).getTime()) / (1000 * 60 * 60 * 24))
        return days === 0 ? 'heute' : days === 1 ? 'gestern' : `vor ${days} Tagen`
      })()
    : null

  return (
    <div className={cn('bg-card rounded-xl border border-border p-4', pending && 'opacity-50')}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 font-medium', meta.color)}>
            {meta.icon}
            {meta.label}
          </span>
          <span className={cn('inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 font-medium', statusBadge.cls)}>
            {statusBadge.icon}
            {statusBadge.label}
          </span>
          {timeAgo && (
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {post.isActive && (
            <button
              onClick={handleExpire}
              disabled={pending}
              className="size-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
              title="Deaktivieren"
            >
              <XCircle className="size-4" />
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={pending}
            className="size-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            title="Löschen"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <h3 className="font-semibold text-foreground mb-1">{post.title}</h3>
      <p className="text-sm text-muted-foreground line-clamp-2">{renderStatusBodyWithChip(post.body)}</p>

      {/* Stats */}
      {!post.isDraft && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
          {post.sentViaEmail && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="size-3.5" />
              {post.emailRecipientCount} per E-Mail
            </span>
          )}
          {post.sentViaWhatsApp && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MessageSquare className="size-3.5" />
              {post.whatsappSentCount}/{post.whatsappRecipientCount} per WhatsApp
            </span>
          )}
          {!post.sentViaEmail && !post.sentViaWhatsApp && (
            <span className="text-xs text-muted-foreground">Nur auf Hof-Seite</span>
          )}
          {post.sentViaWhatsApp && post.whatsappSentCount < post.whatsappRecipientCount && (
            <Link
              href={`/status/${post.id}/send-whatsapp`}
              className="text-xs text-primary hover:underline underline-offset-2 ml-auto"
            >
              WhatsApp fortsetzen →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
