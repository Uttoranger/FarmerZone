'use client'

// Segment-Control nach Referenz 19: Wanne #F0EDE5 (radius 10, padding 4),
// aktives Segment #24523A mit weißer Schrift, inaktiv #5C6052.
export function SegmentControl<K extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: { key: K; label: string }[]
  value: K
  onChange: (key: K) => void
  className?: string
}) {
  return (
    // Mobil scrollen die Pillen horizontal IN der Leiste (Scrollbar versteckt),
    // ab md verhalten sie sich wie bisher (flex-1, kein Scroll nötig)
    <div
      className={`flex gap-1.5 rounded-[10px] p-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      style={{ background: 'var(--app-trough)' }}
    >
      {options.map((o) => {
        const active = o.key === value
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className="flex-none md:flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors min-h-[38px]"
            style={
              active
                ? { background: 'var(--app-bar)', color: '#fff' }
                : { color: 'var(--app-ink-soft)' }
            }
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
