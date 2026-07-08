'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, ChevronUp, ChevronDown, Trash2, Loader2, ExternalLink, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { saveAppearanceAction } from '@/server/actions/appearance'
import { cn } from '@/lib/utils'
import type { SectionConfig } from '@/server/queries/appearance'

// ── Design constants ──────────────────────────────────────────────────────────

const BANNER_PRESETS = [
  {
    key: 'tannengruen',
    label: 'Tannengrün',
    gradient: 'linear-gradient(135deg, #1F4732 0%, #3D7B58 60%, #E8F0E8 100%)',
  },
  {
    key: 'wiese',
    label: 'Frühlingswiese',
    gradient: 'linear-gradient(135deg, #2D6A4F 0%, #52B788 50%, #D8F3DC 100%)',
  },
  {
    key: 'erde',
    label: 'Ackererde',
    gradient: 'linear-gradient(135deg, #6B4226 0%, #A0663E 55%, #F5E6D8 100%)',
  },
  {
    key: 'herbst',
    label: 'Herbst',
    gradient: 'linear-gradient(135deg, #7B4F00 0%, #D4900A 55%, #FFF3CC 100%)',
  },
]

const VALUE_CATALOG = [
  { icon: '🐄', title: 'Tierwohl' },
  { icon: '🌿', title: 'Bio-zertifiziert' },
  { icon: '🌸', title: 'Saisonal' },
  { icon: '📍', title: 'Regional' },
  { icon: '👐', title: 'Handarbeit' },
  { icon: '🏡', title: 'Familienbetrieb' },
]

const SECTION_LABELS: Record<string, string> = {
  status:   'Aktuelle Updates',
  about:    'Über uns',
  values:   'Unsere Werte',
  gallery:  'Galerie',
  products: 'Produkte (immer sichtbar)',
}

// ── Types ─────────────────────────────────────────────────────────────────────

type FarmValueInput = { icon: string; title: string; subtitle: string }

interface Props {
  initialData: {
    tagline: string
    foundedYear: string
    aboutText: string
    bannerValue: string
    sectionsConfig: SectionConfig[]
    farmValues: FarmValueInput[]
    farmSlug: string
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AppearanceClient({ initialData }: Props) {
  const [bannerValue, setBannerValue] = useState(initialData.bannerValue || 'tannengruen')
  const [tagline, setTagline] = useState(initialData.tagline)
  const [foundedYear, setFoundedYear] = useState(initialData.foundedYear)
  const [aboutText, setAboutText] = useState(initialData.aboutText)
  const [sectionsConfig, setSectionsConfig] = useState<SectionConfig[]>(initialData.sectionsConfig)
  const [farmValues, setFarmValues] = useState<FarmValueInput[]>(initialData.farmValues)
  const [saving, setSaving] = useState(false)

  const currentPreset = BANNER_PRESETS.find((p) => p.key === bannerValue) ?? BANNER_PRESETS[0]

  // ── Values helpers ──────────────────────────────────────────────────────────

  function toggleCatalogValue(item: { icon: string; title: string }) {
    const exists = farmValues.some((v) => v.icon === item.icon && v.title === item.title)
    if (exists) {
      setFarmValues((prev) => prev.filter((v) => !(v.icon === item.icon && v.title === item.title)))
    } else {
      if (farmValues.length >= 4) {
        toast.error('Maximal 4 Werte möglich.')
        return
      }
      setFarmValues((prev) => [...prev, { icon: item.icon, title: item.title, subtitle: '' }])
    }
  }

  function moveValue(i: number, dir: -1 | 1) {
    setFarmValues((prev) => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return next
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  function updateSubtitle(i: number, subtitle: string) {
    setFarmValues((prev) => prev.map((v, idx) => (idx === i ? { ...v, subtitle } : v)))
  }

  function removeValue(i: number) {
    setFarmValues((prev) => prev.filter((_, idx) => idx !== i))
  }

  // ── Section config helpers ──────────────────────────────────────────────────

  function toggleSection(key: string) {
    if (key === 'products') return
    setSectionsConfig((prev) =>
      prev.map((s) => (s.key === key ? { ...s, visible: !s.visible } : s)),
    )
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true)
    const result = await saveAppearanceAction({
      tagline: tagline || null,
      foundedYear: foundedYear ? parseInt(foundedYear, 10) : null,
      aboutText: aboutText || null,
      bannerValue,
      sectionsConfig,
      farmValues: farmValues.map((v, i) => ({
        icon: v.icon,
        title: v.title,
        subtitle: v.subtitle || null,
        sortOrder: i,
      })),
    })
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Auftritt gespeichert!')
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Mein Auftritt</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestalte deine öffentliche Hof-Seite
          </p>
        </div>
        <Link
          href={`/${initialData.farmSlug}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ExternalLink className="size-3.5" />
          Vorschau
        </Link>
      </div>

      {/* ── Banner section ─────────────────────────────────────────────────── */}
      <section className="bg-card rounded-2xl shadow-[0_2px_8px_oklch(0.18_0.03_150_/_0.05)] p-6">
        <h2 className="font-semibold text-foreground mb-1">Banner</h2>
        <p className="text-xs text-muted-foreground mb-4">Wähle ein Farbthema für den Seiten-Header</p>

        {/* Preview */}
        <div
          className="h-20 rounded-xl mb-4"
          style={{ background: currentPreset.gradient }}
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {BANNER_PRESETS.map((preset) => (
            <button
              key={preset.key}
              onClick={() => setBannerValue(preset.key)}
              className={cn(
                'group relative h-12 rounded-xl overflow-hidden ring-2 transition-all',
                bannerValue === preset.key ? 'ring-primary' : 'ring-transparent hover:ring-border',
              )}
            >
              <div className="absolute inset-0" style={{ background: preset.gradient }} />
              <div className="absolute inset-0 flex items-end justify-start p-1.5">
                <span className="text-[10px] font-semibold text-white drop-shadow leading-none">
                  {preset.label}
                </span>
              </div>
              {bannerValue === preset.key && (
                <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-primary-foreground" />
                </div>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ── Tagline + Founded year ─────────────────────────────────────────── */}
      <section className="bg-card rounded-2xl shadow-[0_2px_8px_oklch(0.18_0.03_150_/_0.05)] p-6 space-y-4">
        <h2 className="font-semibold text-foreground mb-1">Hofprofil</h2>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-foreground">Tagline</label>
            <span className="text-xs text-muted-foreground">{tagline.length}/60</span>
          </div>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value.slice(0, 60))}
            placeholder="z.B. Frische Produkte direkt vom Feld"
            className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Kurze Beschreibung unter dem Hofnamen
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Gründungsjahr <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <input
            type="number"
            value={foundedYear}
            onChange={(e) => setFoundedYear(e.target.value)}
            placeholder="z.B. 1987"
            min={1800}
            max={2030}
            className="w-32 h-11 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="text-xs text-muted-foreground mt-1">Wird als „seit {foundedYear || '…'}" angezeigt</p>
        </div>
      </section>

      {/* ── About text ─────────────────────────────────────────────────────── */}
      <section className="bg-card rounded-2xl shadow-[0_2px_8px_oklch(0.18_0.03_150_/_0.05)] p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-foreground">Über uns</h2>
          <span className="text-xs text-muted-foreground">{aboutText.length}/1000</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Erzähle deinen Kunden etwas über deinen Hof
        </p>
        <textarea
          value={aboutText}
          onChange={(e) => setAboutText(e.target.value.slice(0, 1000))}
          placeholder="Unser Hof liegt idyllisch am Rand des Dorfes…"
          rows={5}
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
      </section>

      {/* ── Values ─────────────────────────────────────────────────────────── */}
      <section className="bg-card rounded-2xl shadow-[0_2px_8px_oklch(0.18_0.03_150_/_0.05)] p-6">
        <h2 className="font-semibold text-foreground mb-1">Unsere Werte</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Wähle bis zu 4 Werte — sie erscheinen als Kacheln auf deiner Seite
        </p>

        {/* Catalog */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {VALUE_CATALOG.map((item) => {
            const selected = farmValues.some(
              (v) => v.icon === item.icon && v.title === item.title,
            )
            return (
              <button
                key={item.title}
                onClick={() => toggleCatalogValue(item)}
                className={cn(
                  'flex items-center gap-2 p-2.5 rounded-xl border-2 text-sm transition-all text-left',
                  selected
                    ? 'bg-[#E8F0E8] border-primary text-primary'
                    : 'border-border text-muted-foreground hover:border-border/80 hover:bg-muted/40',
                )}
              >
                <span className="text-lg leading-none">{item.icon}</span>
                <span className="text-xs font-medium flex-1">{item.title}</span>
                {selected && <Check className="size-3.5 shrink-0" />}
              </button>
            )
          })}
        </div>

        {/* Selected values with subtitle editing */}
        {farmValues.length > 0 && (
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Ausgewählt ({farmValues.length}/4)
            </p>
            {farmValues.map((v, i) => (
              <div
                key={`${v.icon}-${i}`}
                className="flex items-start gap-2 bg-muted/40 rounded-xl p-3"
              >
                <span className="text-xl leading-none mt-0.5">{v.icon}</span>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="text-sm font-semibold text-foreground">{v.title}</div>
                  <input
                    type="text"
                    value={v.subtitle}
                    onChange={(e) => updateSubtitle(i, e.target.value.slice(0, 100))}
                    placeholder="Kurze Beschreibung (optional)"
                    className="w-full h-8 px-2 rounded-lg border border-border bg-card text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => moveValue(i, -1)}
                    disabled={i === 0}
                    className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center disabled:opacity-30"
                  >
                    <ChevronUp className="size-3.5" />
                  </button>
                  <button
                    onClick={() => moveValue(i, 1)}
                    disabled={i === farmValues.length - 1}
                    className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center disabled:opacity-30"
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                </div>
                <button
                  onClick={() => removeValue(i)}
                  className="w-6 h-6 rounded-md hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive shrink-0"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Sections config ────────────────────────────────────────────────── */}
      <section className="bg-card rounded-2xl shadow-[0_2px_8px_oklch(0.18_0.03_150_/_0.05)] p-6">
        <h2 className="font-semibold text-foreground mb-1">Bereiche</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Wähle, welche Bereiche auf deiner öffentlichen Seite sichtbar sind
        </p>
        <div className="space-y-2">
          {sectionsConfig
            .slice()
            .sort((a, b) => a.order - b.order)
            .filter((section) => section.key !== 'gallery')
            .map((section) => {
              const isProducts = section.key === 'products'
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => toggleSection(section.key)}
                  disabled={isProducts}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all',
                    section.visible && !isProducts
                      ? 'border-primary bg-primary/5'
                      : isProducts
                        ? 'border-border bg-muted/30 cursor-not-allowed'
                        : 'border-border hover:border-border/80',
                  )}
                >
                  <div
                    className={cn(
                      'size-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                      section.visible ? 'bg-primary border-primary' : 'border-border',
                    )}
                  >
                    {section.visible && <Check className="size-3 text-primary-foreground" />}
                  </div>
                  <span
                    className={cn(
                      'text-sm font-medium',
                      isProducts ? 'text-muted-foreground' : 'text-foreground',
                    )}
                  >
                    {SECTION_LABELS[section.key] ?? section.key}
                  </span>
                </button>
              )
            })}
        </div>
      </section>

      {/* ── Galerie placeholder ─────────────────────────────────────────────── */}
      <section className="bg-card rounded-2xl shadow-[0_2px_8px_oklch(0.18_0.03_150_/_0.05)] p-6">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Plus className="size-4 text-muted-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Galerie</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Foto-Upload wird nach der Vercel Blob-Einrichtung verfügbar (max. 8 Fotos, je 5 MB).
            </p>
          </div>
        </div>
      </section>

      {/* ── Save button ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 pb-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-12 px-8 rounded-xl bg-accent text-accent-foreground font-semibold hover:bg-accent-hover transition-colors disabled:opacity-60 flex items-center gap-2"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {saving ? 'Wird gespeichert…' : 'Speichern & veröffentlichen'}
        </button>
        <Link
          href={`/${initialData.farmSlug}`}
          target="_blank"
          className="text-sm text-primary hover:underline underline-offset-2 flex items-center gap-1"
        >
          <ExternalLink className="size-3.5" />
          Seite ansehen
        </Link>
      </div>
    </div>
  )
}
