'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidiereProdukte } from '@/server/produkte-schreiben'
import { bildAusschnittSpeichernSchema, type BildAusschnitt, type BildAusschnittSpeichern } from '@/schemas/bild-ausschnitt'
import { AUSSCHNITT_STANDARD, BILD_AUSSCHNITT_TEXT } from '@/lib/bild-ausschnitt'
import { BILD_RAHMEN_TEXT } from '@/lib/bild-rahmen'

/*
 * Speichert den Ausschnitt eines Fotos (Register N13/N17, Nachtlauf Nr. 97).
 * Der Hof kommt aus der Sitzung, nie aus dem Formular — das strenge Schema
 * weist eine mitgeschickte Hof-Kennung ab. Der Besitz steht in der
 * WHERE-Klausel jedes Schreibens (`updateMany`, 0 Zeilen = „gibt es nicht“),
 * nicht in einem vorgelagerten if: Dazwischen bliebe sonst eine Lücke.
 */

type Ergebnis = { ok: true } | { error: string }

/**
 * Alle fünf Ziele sind frei (Titelbild seit Nr. 97; Logo, Produktfoto, Galerie
 * und Beitragsfoto seit Nr. 98, Register N17).
 *
 * Mitte, 100 %, Natürlich ist „wie heute“ (`AUSSCHNITT_STANDARD`): Bei Logo,
 * Produkt, Foto und Beitrag speichert die Aktion dafür `null` — „Passt so“
 * nach dem Upload und „Zurücksetzen“ führen so zurück zum Stand ohne
 * Ausschnitt. Beim Beitrag ist das mehr als Kosmetik: Ohne Ausschnitt steht
 * das Foto ganz (`object-contain`), mit Ausschnitt füllt es den Rahmen.
 * Das Titelbild behält seinen Wert, weil dort die Wahl füllen/ganz mitreist.
 */
function alsSpalte(wert: Omit<BildAusschnitt, 'darstellung'>): Omit<BildAusschnitt, 'darstellung'> | typeof Prisma.DbNull {
  const standard =
    wert.fokusX === AUSSCHNITT_STANDARD.fokusX &&
    wert.fokusY === AUSSCHNITT_STANDARD.fokusY &&
    wert.zoom === AUSSCHNITT_STANDARD.zoom &&
    wert.filter === AUSSCHNITT_STANDARD.filter
  return standard ? Prisma.DbNull : wert
}

export async function speichereBildAusschnittAction(eingabe: unknown): Promise<Ergebnis> {
  const geprueft = bildAusschnittSpeichernSchema.safeParse(eingabe)
  // Zod meldet englisch; der Bauer bekommt einen festen Satz (CODING_STANDARDS §4).
  if (!geprueft.success) return { error: BILD_AUSSCHNITT_TEXT.ungueltig }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: BILD_AUSSCHNITT_TEXT.nichtAngemeldet }

  const hof = await prisma.farm.findUnique({ where: { ownerId: session.user.id }, select: { id: true, slug: true } })
  if (!hof) return { error: BILD_AUSSCHNITT_TEXT.hofFehlt }

  const geschrieben = await schreibeAusschnitt(geprueft.data, hof.id, session.user.id)
  // 0 Zeilen: Titelbild und Logo hängen am Hof selbst; Produkt, Foto und Beitrag sind weg oder gehören einem anderen Hof.
  if (geschrieben === 0) {
    const amHof = geprueft.data.ziel === 'banner' || geprueft.data.ziel === 'logo'
    return { error: amHof ? BILD_AUSSCHNITT_TEXT.hofFehlt : BILD_RAHMEN_TEXT.fotoFehlt }
  }

  // Produktfotos stehen auch in /products, auf /hoefe (eigener Cache) und auf der Produktseite — derselbe Weg wie jede Produktänderung.
  if (geprueft.data.ziel === 'produkt') revalidiereProdukte(hof.slug)
  else {
    revalidatePath(`/${hof.slug}`)
    revalidatePath('/farm-page')
  }
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
      const { count } = await prisma.farm.updateMany({ where: { id: farmId, ownerId }, data: { logoAusschnitt: alsSpalte(daten.wert) } })
      return count
    }
    case 'produkt': {
      const { count } = await prisma.product.updateMany({ where: { id: daten.productId, farmId }, data: { bildAusschnitt: alsSpalte(daten.wert) } })
      return count
    }
    case 'foto': {
      const { count } = await prisma.farmPhoto.updateMany({ where: { id: daten.farmPhotoId, farmId }, data: { ausschnitt: alsSpalte(daten.wert) } })
      return count
    }
    case 'beitrag': {
      const { count } = await prisma.statusPost.updateMany({ where: { id: daten.statusPostId, farmId }, data: { fotoAusschnitt: alsSpalte(daten.wert) } })
      return count
    }
  }
}
