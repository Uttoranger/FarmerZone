'use client'

import { useTheme } from 'next-themes'
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatEuro } from '@/lib/format'
import { centsAlsEuro } from '@/lib/servicegebuehr'
import type { FinanzenVerlaufPunkt } from '@/server/queries/finanzen'

/**
 * Einnahmen und Kosten je Monat als Balkenpaar — seit der ersten Bestellung,
 * höchstens zwölf Monate.
 *
 * Dasselbe Muster wie die Auswertung des Bauern-Bereichs
 * (src/components/analytics/analytics-dashboard.tsx): Recharts schreibt Farben
 * als SVG-Attribute, dort greift `var(--token)` NICHT. Deshalb zwei Farbsätze
 * in JavaScript und eine Umschaltung über `resolvedTheme` (CODING_STANDARDS §7,
 * Abschnitt Diagramme). Nur die Style-Objekte des Tooltips sind React-Styles —
 * dort stehen die Tokens direkt.
 *
 * Gerechnet wird in ganzen Cent; in Euro umgerechnet wird erst für die Anzeige.
 */

const FARBEN = {
  hell: {
    einnahmen: '#2D5F3F', // Waldgrün der Marke
    kosten: '#B86A2E', // das Bernstein der Hinweis-Kästen
    achse: '#94a3b8',
    fadenkreuz: '#f1f5f9',
  },
  dunkel: {
    // Dieselben Töne eine Stufe heller — ein Waldgrün verschwindet auf fast
    // schwarzem Grund.
    einnahmen: '#7FBF95',
    kosten: '#E8A567',
    achse: '#8b9a90',
    fadenkreuz: '#ffffff14',
  },
}

export function FinanzenDiagramm({ punkte }: { punkte: FinanzenVerlaufPunkt[] }) {
  // resolvedTheme ist vor der Hydration undefined — dann gilt der Tagsatz und
  // das Diagramm zeichnet danach einmal neu. Im Admin-Bereich unkritisch.
  const { resolvedTheme } = useTheme()
  const farben = resolvedTheme === 'dark' ? FARBEN.dunkel : FARBEN.hell

  const daten = punkte.map((p) => ({
    kurz: p.kurz,
    Einnahmen: centsAlsEuro(p.einnahmenCents),
    Kosten: centsAlsEuro(p.kostenCents),
  }))

  const alleNull = punkte.every((p) => p.einnahmenCents === 0 && p.kostenCents === 0)

  return (
    <section className="mb-5 rounded-xl border border-border bg-card px-2 py-4">
      <h2 className="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Einnahmen und Kosten je Monat
      </h2>

      {alleNull ? (
        <p className="px-2 pb-2 text-sm text-muted-foreground">
          Noch nichts zu zeigen — sobald Bestellungen eingehen oder Kosten eingetragen sind, stehen
          hier die Monate nebeneinander.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={daten} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="kurz"
              tick={{ fontSize: 11, fill: farben.achse }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              width={52}
              tickFormatter={(v) => formatEuro(Number(v ?? 0))}
              tick={{ fontSize: 10, fill: farben.achse }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(v, name) => [formatEuro(Number(v ?? 0)), String(name)]}
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                background: 'var(--card)',
                border: '1px solid var(--border)',
                color: 'var(--card-foreground)',
              }}
              labelStyle={{ color: 'var(--card-foreground)' }}
              itemStyle={{ color: 'var(--card-foreground)' }}
              cursor={{ fill: farben.fadenkreuz }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
            <Bar dataKey="Einnahmen" fill={farben.einnahmen} radius={[3, 3, 0, 0]} maxBarSize={18} />
            <Bar dataKey="Kosten" fill={farben.kosten} radius={[3, 3, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  )
}
