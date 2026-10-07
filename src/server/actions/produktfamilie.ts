'use server'

import { randomUUID } from 'node:crypto'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFarmForUser } from '@/server/queries/dashboard'
import { futterDaten, ladeHofRegistrierung, revalidiereProdukte } from '@/server/produkte-schreiben'
import { brennmaterialFamilieSchema, futterFamilieSchema } from '@/schemas/produktfamilie'
import { gebindeSperre } from '@/lib/futter-registrierung'
import { RESTFEUCHTE_JE_TROCKNUNG, gelagertSeitAus, groessenProduktname } from '@/lib/verkaufsgroessen'
import { mwstStandard } from '@/lib/mwst'

/*
 * Futter und Brennmaterial mit Verkaufsgrößen anlegen (Register E3, E10, E11;
 * Gate 6, Nachtlauf Nr. 20). EIN Formular, je Größe EIN Produkt: eigener
 * Preis, eigener Vorrat, bei Futter eigene Kennzeichnung (Nettomenge je
 * Gebinde) — zusammengehalten von derselben `familieId`. Alle Größen
 * entstehen in EINER Transaktion: entweder die ganze Familie oder nichts.
 *
 * SPERRE JE GEBINDE (S7): Welche Größe in den Shop geht, entscheidet der
 * Server mit dem Stand des Hofs von JETZT (`ladeHofRegistrierung`), nie das
 * Formular. Eine Größe ohne die nötige Registrierung entsteht als Entwurf
 * (`isAvailable` false), der Rest geht online. Dieselbe Regel prüfen der
 * Schalter „Sichtbar", das Bearbeiten und der Warenkorb vor dem Checkout.
 */

export type FamilieErgebnis =
  | {
      ok: true
      /** Wie viele Größen sofort im Shop stehen. */
      online: number
      /** Größen, die als Entwurf warten — mit dem Grund. */
      wartend: { bezeichnung: string; grund: string }[]
    }
  | { error: string }

const EINGABE_FEHLER = 'Bitte prüfe deine Eingaben.'

async function angemeldeterHof(): Promise<{ id: string; slug: string } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Bitte melde dich neu an.' }
  const farm = await getFarmForUser(session.user.id)
  if (!farm) return { error: 'Kein Hof gefunden.' }
  return farm
}

/**
 * Ein Futtermittel mit seinen Verkaufsgrößen. Kennzeichnung für alle Größen
 * gleich, bestätigt mit diesem Speichern (bestaetigtAm = jetzt); die
 * Nettomenge je Größe aus der Tabelle. Die Betriebsnummer steht am Hof, nicht
 * in der Kennzeichnung (Rückfrage F6).
 */
export async function legeFutterFamilieAn(eingabe: unknown): Promise<FamilieErgebnis> {
  const geprueft = futterFamilieSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: EINGABE_FEHLER }
  const v = geprueft.data

  const farm = await angemeldeterHof()
  if ('error' in farm) return farm

  const hof = await ladeHofRegistrierung(farm.id)
  const familieId = randomUUID()
  const jetzt = new Date()
  const { futtermittelart } = v.kennzeichnung
  // Das Schema lässt keine Familie ohne passende Futtermittelart durch.
  if (futtermittelart === null) return { error: EINGABE_FEHLER }

  const groessen = v.groessen.map((g) => ({ ...g, sperre: gebindeSperre({ category: v.category, verpackung: g.verpackung }, hof) }))

  await prisma.$transaction(
    groessen.map((g) =>
      prisma.product.create({
        data: {
          farmId: farm.id,
          familieId,
          name: groessenProduktname(v.name, g.bezeichnung),
          description: v.description || null,
          category: v.category,
          subcategory: v.subcategory,
          labels: v.bio ? ['BIO'] : [],
          abgabe: v.abgabe,
          price: g.price,
          vatRate: mwstStandard(v.category),
          unit: g.unit,
          // Futter trägt sein Gewicht in der Kennzeichnung, nie als Gebindegröße.
          unitSize: null,
          stock: g.stock,
          verpackung: g.verpackung,
          isAvailable: g.sperre === null,
          futter: {
            create: futterDaten(
              { ...v.kennzeichnung, futtermittelart, nettoMenge: g.nettoMenge, nettoEinheit: 'KG' },
              jetzt
            ),
          },
        },
      })
    )
  )

  revalidiereProdukte(farm.slug)
  return {
    ok: true,
    online: groessen.filter((g) => g.sperre === null).length,
    wartend: groessen.flatMap((g) => (g.sperre ? [{ bezeichnung: g.bezeichnung, grund: g.sperre.grund }] : [])),
  }
}

/**
 * Brennmaterial mit seinen Verkaufsgrößen (E11). Keine Futtermittel-
 * Registrierung, also keine Sperre: Alle Größen gehen online. Die Angaben
 * (Holzart, Scheitlänge, Trocknung …) bekommt jede Größe als eigene Zeile —
 * BrennmaterialAngaben ist 1:1 zum Produkt.
 */
export async function legeBrennmaterialFamilieAn(eingabe: unknown): Promise<FamilieErgebnis> {
  const geprueft = brennmaterialFamilieSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: EINGABE_FEHLER }
  const v = geprueft.data

  const farm = await angemeldeterHof()
  if ('error' in farm) return farm

  const familieId = randomUUID()
  const gelagertSeit = v.gelagertJahre === null ? null : new Date(`${gelagertSeitAus(v.gelagertJahre, new Date())}T00:00:00.000Z`)
  const angaben = {
    holzart: v.holzart,
    scheitlaengeCm: v.scheitlaengeCm,
    trocknung: v.trocknung,
    restfeuchteMax: RESTFEUCHTE_JE_TROCKNUNG[v.trocknung],
    wassergehalt: v.wassergehalt,
    koernung: v.koernung,
    gelagertSeit,
    ueberdacht: v.ueberdacht,
  }

  await prisma.$transaction(
    v.groessen.map((g) =>
      prisma.product.create({
        data: {
          farmId: farm.id,
          familieId,
          name: groessenProduktname(v.name, g.bezeichnung),
          description: v.description || null,
          category: 'BRENNHOLZ',
          subcategory: v.art,
          price: g.price,
          vatRate: mwstStandard('BRENNHOLZ'),
          unit: g.unit,
          unitSize: null,
          stock: g.stock,
          isAvailable: true,
          brennmaterial: { create: angaben },
        },
      })
    )
  )

  revalidiereProdukte(farm.slug)
  return { ok: true, online: v.groessen.length, wartend: [] }
}
