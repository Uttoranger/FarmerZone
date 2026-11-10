import type { ComponentProps } from 'react'
import { Check } from 'lucide-react'
import { TREFFER_44 } from '@/components/ui/button'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

/*
 * Kästchen (A-8, Morgenbericht 32 A, freigegeben 7.11.2026; Nr. 269) — das EINE
 * Ankreuzfeld des neuen Designs mit eigenen Tokens (globals.css,
 * `--fz-kaestchen-rand`, `-flaeche`, `-haken`; DESIGN_SYSTEM „Komponenten“).
 *
 * Warum ein natives `<input type="checkbox">` und kein Nachbau mit
 * `role="checkbox"`: Formular, Tastatur (Leertaste), Vorleser, `required` und
 * der übermittelte Wert bleiben die des Browsers — eine Umstellung ändert nur
 * das Aussehen. Der Baustein reicht `name`, `value`, `checked`/`defaultChecked`,
 * `onChange`, `required`, `disabled`, `id` und `aria-*` unverändert durch und
 * setzt nie einen eigenen Ausgangswert (eine Einwilligung ist nie vorab
 * angehakt, wenn der Aufrufer es nicht sagt).
 *
 * Gezeichnet: 22 px wie die Boards (`accent-color` dort), Rand im Token
 * `kaestchen-rand` (≥ 3:1 auf Grund und Fläche, WCAG 1.4.11), angehakt die
 * Fläche `kaestchen-flaeche` mit dem Haken `kaestchen-haken` (≥ 4,5:1 darauf);
 * Trefferfläche 44 px über `::before` (`TREFFER_44`), Fokus `FOKUS_RAHMEN`,
 * Feldfehler über `aria-invalid` mit dem Rand in `status-offen` (V17).
 * Kein `'use client'`: ohne Zustand und Hooks, so nimmt ihn auch ein
 * Server-Formular (`defaultChecked`, `name`).
 */

/** Das Kästchen selbst — `appearance-none` nimmt dem Browser die Zeichnung, nicht das Verhalten. */
export const KAESTCHEN_FELD = cn(
  'peer size-[22px] shrink-0 cursor-pointer appearance-none rounded-[6px] border-2 border-kaestchen-rand bg-card transition-colors duration-[250ms]',
  'checked:border-kaestchen-flaeche checked:bg-kaestchen-flaeche aria-[invalid=true]:border-status-offen disabled:cursor-not-allowed',
  TREFFER_44,
  FOKUS_RAHMEN
)

/** Der Haken über dem Kästchen — nur sichtbar, wenn es angehakt ist; Klicks gehen durch ihn hindurch. */
export const KAESTCHEN_HAKEN = 'pointer-events-none absolute inset-0 m-auto size-4 text-kaestchen-haken opacity-0 peer-checked:opacity-100'

/**
 * Ein Kästchen. `className` gilt der Hülle (Lage im Layout); alle übrigen
 * Angaben gehen unverändert an das `<input type="checkbox">`. Die Beschriftung
 * bringt der Aufrufer mit (`<label>` drumherum oder `htmlFor`).
 */
export function Kaestchen({ className, ...eingabe }: Omit<ComponentProps<'input'>, 'type'>): React.JSX.Element {
  return (
    <span className={cn('relative inline-grid size-[22px] shrink-0 place-items-center has-disabled:opacity-60', className)}>
      <input type="checkbox" {...eingabe} className={KAESTCHEN_FELD} />
      <Check className={KAESTCHEN_HAKEN} strokeWidth={3} aria-hidden="true" />
    </span>
  )
}
