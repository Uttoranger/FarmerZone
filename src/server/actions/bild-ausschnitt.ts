'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { bildAusschnittSpeichernSchema, type BildAusschnittSpeichern, type BildAusschnittZiel } from '@/schemas/bild-ausschnitt'
import { BILD_AUSSCHNITT_TEXT } from '@/lib/bild-ausschnitt'

/*
 * Speichert den Ausschnitt eines Fotos (Register N13/N17, Nachtlauf Nr. 97).
 * Der Hof kommt aus der Sitzung, nie aus dem Formular — das strenge Schema
 * weist eine mitgeschickte Hof-Kennung ab. Der Besitz steht in der
 * WHERE-Klausel jedes Schreibens (`updateMany`, 0 Zeilen = „gibt es nicht“),
 * nicht in einem vorgelagerten if: Dazwischen bliebe sonst eine Lücke.
 */

/**
 * Freigeschaltet ist in Nr. 97 nur das Titelbild. Logo, Produktfoto, Galerie
 * und Beitragsfoto schaltet Nr. 98 frei (Register N17) — bis dahin weist die
 * Aktion sie ab, ohne etwas zu schreiben.
 */
const FREIGESCHALTET: ReadonlySet<BildAusschnittZiel> = new Set<BildAusschnittZiel>(['banner'])

type Ergebnis = { ok: true } | { error: string }

export async function speichereBildAusschnittAction(eingabe: unknown): Promise<Ergebnis> {
  const geprueft = bildAusschnittSpeichernSchema.safeParse(eingabe)
  // Zod meldet englisch; der Bauer bekommt einen festen Satz (CODING_STANDARDS §4).
  if (!geprueft.success) return { error: BILD_AUSSCHNITT_TEXT.ungueltig }
  if (!FREIGESCHALTET.has(geprueft.data.ziel)) return { error: BILD_AUSSCHNITT_TEXT.nochNicht }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: BILD_AUSSCHNITT_TEXT.nichtAngemeldet }

  const hof = await prisma.farm.findUnique({ where: { ownerId: session.user.id }, select: { id: true, slug: true } })
  if (!hof) return { error: BILD_AUSSCHNITT_TEXT.hofFehlt }

  const geschrieben = await schreibeAusschnitt(geprueft.data, hof.id, session.user.id)
  if (geschrieben === 0) return { error: BILD_AUSSCHNITT_TEXT.hofFehlt }

  revalidatePath(`/${hof.slug}`)
  revalidatePath('/farm-page')
  return { ok: true }
}

/** Schreibt den Ausschnitt; gibt die Zahl der geänderten Zeilen zurück. */
async function schreibeAusschnitt(daten: BildAusschnittSpeichern, farmId: string, ownerId: string): Promise<number> {
  switch (daten.ziel) {
    case 'banner': {
      // bannerFocusY schreibt mit (Expand, Register N13): Alter Code im
      // Deploy-Fenster liest nur ihn und zeigt so denselben senkrechten Fokus.
      const { count } = await prisma.farm.updateMany({
        where: { id: farmId, ownerId },
        data: { bannerAusschnitt: daten.wert, bannerFocusY: daten.wert.fokusY },
      })
      return count
    }
    case 'logo': {
      const { count } = await prisma.farm.updateMany({ where: { id: farmId, ownerId }, data: { logoAusschnitt: daten.wert } })
      return count
    }
    case 'produkt': {
      const { count } = await prisma.product.updateMany({ where: { id: daten.productId, farmId }, data: { bildAusschnitt: daten.wert } })
      return count
    }
    case 'foto': {
      const { count } = await prisma.farmPhoto.updateMany({ where: { id: daten.farmPhotoId, farmId }, data: { ausschnitt: daten.wert } })
      return count
    }
    case 'beitrag': {
      const { count } = await prisma.statusPost.updateMany({ where: { id: daten.statusPostId, farmId }, data: { fotoAusschnitt: daten.wert } })
      return count
    }
  }
}
