import type { ReactNode } from 'react'

/**
 * Removes {Vorname} from status body text and cleans up leftover punctuation/spaces.
 * Used for public page and OG image rendering (customer-facing contexts).
 */
export function stripStatusVariables(body: string): string {
  let text = body
  text = text.replace(/\{Vorname\}/g, '')
  // space(s) before punctuation → just the punctuation
  text = text.replace(/\s+([,!?;:])/g, '$1')
  // multiple spaces → single space
  text = text.replace(/ {2,}/g, ' ')
  // consecutive commas → single comma
  text = text.replace(/,+/g, ',')
  // dangling comma before sentence end ("…, ." after token removal) → just the punctuation
  text = text.replace(/,\s*([.!?])/g, '$1')
  // leading comma or space artifact
  text = text.replace(/^[, ]+/, '')
  return text.trim()
}

/**
 * Renders status body with {Vorname} shown as a neutral chip.
 * Used in the farmer's own views (status list, editor) so they can
 * see the placeholder variable is present.
 */
export function renderStatusBodyWithChip(body: string): ReactNode {
  if (!body.includes('{Vorname}')) return body
  const parts = body.split('{Vorname}')
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <span className="inline-flex items-center rounded bg-muted px-1 py-0.5 text-[11px] font-mono text-muted-foreground mx-0.5 align-middle">
              {'{Vorname}'}
            </span>
          )}
        </span>
      ))}
    </>
  )
}
