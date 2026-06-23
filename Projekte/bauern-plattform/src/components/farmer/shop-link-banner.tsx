'use client'

import { useState, useEffect } from 'react'
import { Copy, X, MessageCircle, Check, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

const CLOSED_KEY = 'fz_shop_banner_closed'

interface ShopLinkBannerProps {
  farmSlug: string
}

export function ShopLinkBanner({ farmSlug }: ShopLinkBannerProps) {
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shopUrl, setShopUrl] = useState('')

  useEffect(() => {
    const url = `${window.location.origin}/${farmSlug}`
    setShopUrl(url)

    const closed = localStorage.getItem(CLOSED_KEY)
    const today = new Date().toDateString()
    if (closed !== today) setVisible(true)
  }, [farmSlug])

  function handleClose() {
    localStorage.setItem(CLOSED_KEY, new Date().toDateString())
    setVisible(false)
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shopUrl)
      setCopied(true)
      toast.success('Shop-Link kopiert!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Kopieren fehlgeschlagen')
    }
  }

  function handleWhatsApp() {
    const text = `Schau dir unseren Hof-Shop an: ${shopUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  if (!visible) return null

  return (
    <div className="mx-4 mt-4 mb-0">
      <div className="bg-card rounded-2xl ring-1 ring-border/60 shadow-[0_2px_8px_oklch(0.18_0.03_150_/_0.05)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Dein Shop-Link
              </p>
              <a
                href={`/${farmSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="font-mono text-sm text-foreground truncate">
              {shopUrl || `…/${farmSlug}`}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Banner schließen"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <button
            onClick={handleCopy}
            className="flex-1 h-9 rounded-xl bg-muted hover:bg-muted/70 text-foreground text-sm font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-600" />
                Kopiert!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Link kopieren
              </>
            )}
          </button>
          <button
            onClick={handleWhatsApp}
            className="flex-1 h-9 rounded-xl bg-[#25D366] hover:opacity-90 text-white text-sm font-medium flex items-center justify-center gap-1.5 transition-opacity"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Per WhatsApp teilen
          </button>
        </div>
      </div>
    </div>
  )
}
