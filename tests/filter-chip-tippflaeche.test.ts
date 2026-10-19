/**
 * Die Trefferfläche eines Filter-Chips ist mindestens 44 px hoch (Nr. 118, Nacharbeit zu Nr. 105).
 *
 * Ursache: Der Chip ist 36 px hoch und hat einen Rahmen; sein unsichtbares ::before sitzt aber im INNENrand
 * des Rahmens (36 − 2 = 34 px) und ragte je Seite nur 4 px hinaus — 42 px statt 44. Gemessen wird am echten
 * Chip, nicht an einer Zahl im Test: Höhe, Rahmen und Überstand kommen aus seinen Klassen.
 */
import { describe, it, expect } from 'vitest'
import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FilterChip } from '@/components/ui/chip'

/** Höhe der Trefferfläche aus den Klassen: Höhe − Rahmen (innen) + Überstand oben und unten. */
function trefferflaeche(klassen: string): number {
  const hoehe = /(?:^|\s)h-(\d+)(?=\s|$)/.exec(klassen)
  const rahmen = /(?:^|\s)border(?=\s|$)/.test(klassen) ? 2 : 0
  const ueberstand = /before:-inset-y-(?:(\d+)|\[(\d+)px\])(?=\s|$)/.exec(klassen)
  const px = ueberstand ? (ueberstand[1] ? Number(ueberstand[1]) * 4 : Number(ueberstand[2])) : 0
  return (hoehe ? Number(hoehe[1]) * 4 : 0) - rahmen + px * 2
}

describe('Filter-Chip: Trefferfläche', () => {
  it('Gegenprobe: die Messung zählt den Rahmen — mit 4 px Überstand wären es nur 42 px', () => {
    expect(trefferflaeche("relative inline-flex h-9 border px-4 before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']")).toBe(42)
    expect(trefferflaeche("relative inline-flex h-9 px-4 before:absolute before:-inset-y-1 before:content-['']")).toBe(44)
    expect(trefferflaeche('inline-flex h-9 border px-4')).toBe(34)
  })

  it('der Chip (gewählt und nicht gewählt) trifft auf mindestens 44 px', () => {
    for (const aktiv of [false, true]) {
      const eigenschaften: ComponentProps<typeof FilterChip> = { href: '/x?filter=a', aktiv, children: 'Offen' }
      const html = renderToStaticMarkup(createElement(FilterChip, eigenschaften))
      const klassen = /class="([^"]*)"/.exec(html)?.[1] ?? ''
      expect(klassen, 'Chip ohne Klassen').not.toBe('')
      expect(trefferflaeche(klassen), klassen).toBeGreaterThanOrEqual(44)
    }
  })
})
