'use client'

import { useState, useEffect } from 'react'
import { Copy, X, Check } from 'lucide-react'
import { toast } from 'sonner'

const CLOSED_KEY = 'fz_shop_banner_closed'

// Official WhatsApp logo path (simplified bubble + phone mark)
const WA_ICON_PATH =
  'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z'

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
    <div className="mx-4 mt-3 mb-0">
      <div className="bg-card rounded-xl ring-1 ring-border/60 shadow-[0_1px_4px_oklch(0.18_0.03_150_/_0.04)] h-14 px-3 flex items-center gap-2">
        {/* Left: label + url */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0 hidden sm:block">
            Shop
          </span>
          <a
            href={`/${farmSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-sm text-foreground truncate hover:text-primary transition-colors"
          >
            {shopUrl || `…/${farmSlug}`}
          </a>
        </div>

        {/* Right: copy + share + close */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleCopy}
            className="h-8 px-2.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{copied ? 'Kopiert' : 'Kopieren'}</span>
          </button>

          <button
            onClick={handleWhatsApp}
            className="h-8 px-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1.5 hover:opacity-90 transition-opacity"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
              <path d={WA_ICON_PATH} />
            </svg>
            <span className="hidden sm:inline">Teilen</span>
          </button>

          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Banner schließen"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
