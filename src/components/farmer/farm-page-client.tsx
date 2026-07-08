'use client'

import { useState } from 'react'
import { Pencil, Eye, Copy, Share2, Check } from 'lucide-react'
import { FarmPageView } from '@/components/farm/farm-page-view'
import type { PublicFarm } from '@/server/queries/farm'
import type { ActiveStatusPost } from '@/server/queries/status-posts'

type Mode = 'edit' | 'preview'

interface Props {
  farm: PublicFarm
  activeStatus: ActiveStatusPost | null
}

export function FarmPageClient({ farm, activeStatus }: Props) {
  const [mode, setMode] = useState<Mode>('edit')
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const url = `${window.location.origin}/${farm.slug}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard not available
    }
  }

  function handleShare() {
    const url = `${window.location.origin}/${farm.slug}`
    const text = `Schau dir unseren Hof-Shop an: ${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <>
      {/* v3 Top bar — only on /farm-page */}
      <div
        className="flex items-center gap-2.5 flex-wrap"
        style={{
          background: '#fff',
          borderBottom: '1px solid #ECE8DF',
          padding: '13px 28px',
        }}
      >
        <span
          className="text-[11px] font-bold uppercase tracking-[0.06em]"
          style={{ color: '#9AA08F' }}
        >
          Shop
        </span>
        <span className="text-sm mr-1.5" style={{ color: '#2D3027' }}>
          farmerzone.at/<strong>{farm.slug}</strong>
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 h-[38px] px-3.5 rounded-lg text-[13px] font-semibold transition-colors hover:opacity-90"
          style={{
            border: '1px solid #E4E0D6',
            background: '#fff',
            color: '#5C6052',
          }}
        >
          {copied
            ? <Check className="size-[15px]" strokeWidth={1.7} />
            : <Copy className="size-[15px]" strokeWidth={1.7} />
          }
          {copied ? 'Kopiert' : 'Kopieren'}
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 h-[38px] px-3.5 rounded-lg text-[13px] font-semibold transition-colors hover:opacity-90"
          style={{
            border: '1px solid #E4E0D6',
            background: '#fff',
            color: '#5C6052',
          }}
        >
          <Share2 className="size-[15px]" strokeWidth={1.7} />
          Teilen
        </button>

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setMode('edit')}
            className="flex items-center gap-1.5 h-[38px] px-4 rounded-lg text-[13px] font-semibold transition-colors"
            style={
              mode === 'edit'
                ? { background: '#24523A', color: '#fff', border: '1px solid #24523A' }
                : { background: '#fff', color: '#5C6052', border: '1px solid #E4E0D6' }
            }
          >
            <Pencil className="size-3.5" strokeWidth={1.7} />
            Bearbeiten
          </button>
          <button
            onClick={() => setMode('preview')}
            className="flex items-center gap-1.5 h-[38px] px-4 rounded-lg text-[13px] font-semibold transition-colors"
            style={
              mode === 'preview'
                ? { background: '#24523A', color: '#fff', border: '1px solid #24523A' }
                : { background: '#fff', color: '#5C6052', border: '1px solid #E4E0D6' }
            }
          >
            <Eye className="size-3.5" strokeWidth={1.7} />
            Kundenansicht
          </button>
        </div>
      </div>

      <FarmPageView
        farm={farm}
        activeStatus={activeStatus}
        ownerMode={true}
        mode={mode}
      />
    </>
  )
}
