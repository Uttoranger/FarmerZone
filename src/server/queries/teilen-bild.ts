import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { decimalZuCents } from '@/lib/order-totals'
import type { HeuteFenster } from '@/lib/heute'
import {
  beitragDarfInsBild,
  plakatBezahlen,
  teilenAuswahl,
  teilenBildDaten,
  teilenBildVersion,
  teilenTextVorschlag,
  type TeilenBildDaten,
  type TeilenBildHof,
  type TeilenBildProdukt,
} from '@/lib/teilen-bild'
import { heldKandidaten, produktBildQuelle, type BildQuelle } from '@/lib/teilen-bild-quellen'
import { hofAdresse } from '@/lib/mein-hof'
import {
  beitragLink,
  beitragTextVorschlag,
  beitragVorbelegung,
  beitragWhatsApp,
  type TeilenFensterBeitrag,
  type TeilenFensterHof,
} from '@/lib/teilen-fenster'
import { APP_URL } from '@/lib/umgebung-server'
import { teilenLink } from '@/lib/teilen-kanal'
import { abholzeitenKurz } from '@/lib/hofseite-fortschritt'
import { einzeiligerFremdtext } from '@/lib/fremdtext'
import { BEITRAG_TITEL_MAX, HOFNAME_MAX } from '@/lib/eingabegrenzen'
import { istEigenesBild } from '@/server/bild-url'
import { zeigtAbzeichen } from '@/lib/gruendungshof'
import { ABZEICHEN_SELECT, OEFFENTLICH_SICHTBAR } from '@/server/queries/farm'
import { PRODUCT_ORDER_BY } from '@/server/queries/products'
import { zaehleWhatsAppAbonnentinnen } from '@/server/queries/status-posts'

export type TeilenBildQuelle = {
  farmId: string
  hof: TeilenBildHof
  produkte: TeilenBildProdukt[]
  /** Produkt → Adresse seines Fotos (nur Produkte mit Foto); ob es ins Bild darf, entscheidet `bildQuellen`. */
  fotos: ReadonlyMap<string, string>
  slots: HeuteFenster[]
}

/**
 * Die Rohdaten für Teilen-Bild, Teilen-Fenster und Plakat (Gate 7) — NUR
 * öffentlich sichtbare Höfe (dieselbe Bedingung wie die Hofseite,
 * OEFFENTLICH_SICHTBAR). Ein nicht freigeschalteter oder stillgelegter Hof
 * ergibt null: Für ihn gibt es kein Bild und nichts zu teilen (S9). Was davon
 * ins Bild darf, entscheidet `src/lib/teilen-bild.ts`.
 *
 * Nur öffentliche Felder; Geld einmal an der Servergrenze in Cent.
 */
export async function ladeTeilenBildQuelle(wo: { slug: string } | { id: string }): Promise<TeilenBildQuelle | null> {
  const farm = await prisma.farm.findFirst({
    where: { ...wo, ...OEFFENTLICH_SICHTBAR },
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      isPaused: true,
      betriebsnummer: true,
      betriebsstatus: true,
      // Abzeichen (Register K2, Nr. 116): gelesen für das Ja/Nein unten, die Nummer verlässt den Lader nicht.
      ...ABZEICHEN_SELECT,
      products: {
        orderBy: PRODUCT_ORDER_BY,
        select: {
          id: true,
          name: true,
          price: true,
          isAvailable: true,
          stock: true,
          familieId: true,
          category: true,
          verpackung: true,
          imageUrl: true,
        },
      },
      pickupSlots: { where: { isActive: true }, select: { dayOfWeek: true, startTime: true, endTime: true } },
    },
  })
  if (!farm) return null
  return {
    farmId: farm.id,
    hof: {
      name: farm.name,
      slug: farm.slug,
      city: farm.city,
      isPaused: farm.isPaused,
      betriebsnummer: farm.betriebsnummer,
      betriebsstatus: farm.betriebsstatus,
      gruendungshof: zeigtAbzeichen(farm),
    },
    produkte: farm.products.map((p) => ({
      id: p.id,
      name: p.name,
      preisCents: decimalZuCents(p.price),
      isAvailable: p.isAvailable,
      stock: p.stock,
      familieId: p.familieId,
      category: p.category,
      verpackung: p.verpackung,
    })),
    fotos: new Map(farm.products.flatMap((p) => (p.imageUrl ? [[p.id, p.imageUrl] as const] : []))),
    slots: farm.pickupSlots,
  }
}

/** Was die Bild-Route von einem Beitrag braucht — ob er ins Bild darf, entscheidet `beitragDarfInsBild`. */
const TEILEN_BILD_BEITRAG_FELDER = {
  farmId: true,
  anlass: true,
  title: true,
  body: true,
  photoUrl: true,
  linkedProductIds: true,
  publishedAt: true,
  expiresAt: true,
  showOnFarmPage: true,
} as const satisfies Prisma.StatusPostSelect

export type TeilenBildBeitragRoh = Prisma.StatusPostGetPayload<{ select: typeof TEILEN_BILD_BEITRAG_FELDER }>

/**
 * Alles aus der Datenbank, was die Bild-Route (`/[farmSlug]/opengraph-image`)
 * braucht: Hof, Produkte und ihre Fotos aus EINER Abfrage
 * (`ladeTeilenBildQuelle`; vorher las die Route die Fotos ein zweites Mal)
 * und mit `beitragId` den Beitrag — nur von DIESEM Hof, Besitz in der
 * WHERE-Klausel (Nr. 75, Defense in Depth: `beitragDarfInsBild` prüft den Hof
 * trotzdem weiter). null: kein öffentlicher Hof.
 */
export async function ladeTeilenBild(
  slug: string,
  beitragId: string | undefined
): Promise<{ quelle: TeilenBildQuelle; beitrag: TeilenBildBeitragRoh | null } | null> {
  const quelle = await ladeTeilenBildQuelle({ slug })
  if (!quelle) return null
  const beitrag = beitragId
    ? await prisma.statusPost.findFirst({ where: { id: beitragId, farmId: quelle.farmId }, select: TEILEN_BILD_BEITRAG_FELDER })
    : null
  return { quelle, beitrag }
}

/**
 * Die Bildquelle je Eintrag — dieselbe Regel wie die Bild-Route
 * (`/[farmSlug]/opengraph-image`): eigenes Foto aus unserem Speicher und dem
 * Ordner dieses Hofs, sonst die Illustration der Kategorie.
 */
function bildQuellen(quelle: TeilenBildQuelle, ids: readonly string[]): BildQuelle[] {
  const istEigen = (url: string): boolean => istEigenesBild(url, quelle.farmId)
  const kategorien = new Map(quelle.produkte.map((p) => [p.id, p.category]))
  return ids.map((id) => produktBildQuelle({ imageUrl: quelle.fotos.get(id) ?? null, category: kategorien.get(id) ?? null }, istEigen))
}

/**
 * Was das Teilen-Bild eines öffentlichen Hofs gerade zeigt, samt Prüfsumme
 * für die Bildadresse in den Metadaten der Hofseite (`?v=`). Dieselben Daten
 * und dieselbe Regel wie die Bild-Route — so ändert sich die Adresse genau
 * dann, wenn sich das Bild ändert (S9). null: kein öffentlicher Hof.
 */
export async function ladeTeilenVorschau(slug: string, jetzt: Date): Promise<{ daten: TeilenBildDaten; version: string } | null> {
  const quelle = await ladeTeilenBildQuelle({ slug })
  if (!quelle) return null
  const daten = teilenBildDaten({
    hof: quelle.hof,
    produkte: quelle.produkte,
    slots: quelle.slots,
    auswahl: null,
    adresse: hofAdresse(APP_URL, quelle.hof.slug).anzeige,
    jetzt,
  })
  // Samt der Fotos wie die Route (Befund aus Nr. 69): Ohne sie passte `v` bei
  // Höfen mit eigenem Produktfoto nie, und das Bild lag nur 60 s im CDN.
  const fotos = heldKandidaten(
    null,
    bildQuellen(
      quelle,
      daten.produkte.map((e) => e.id)
    )
  )
  return { daten, version: teilenBildVersion(daten, fotos) }
}

/**
 * Die Daten des Teilen-Fensters für den eigenen Hof (Heute): Auswahl „Im
 * Bild", vorgeschlagener Text, Adresse. Nur, solange der Hof öffentlich ist —
 * sonst null, und es gibt nichts zu teilen. Die Seite fragt mit der farmId
 * aus der Sitzung, nie aus der Eingabe.
 */
export async function getTeilenFensterDaten(farmId: string, jetzt: Date): Promise<TeilenFensterHof | null> {
  const quelle = await ladeTeilenBildQuelle({ id: farmId })
  if (!quelle) return null
  const { anzeige: adresse, url: link } = hofAdresse(APP_URL, quelle.hof.slug)
  const daten = teilenBildDaten({ hof: quelle.hof, produkte: quelle.produkte, slots: quelle.slots, auswahl: null, adresse, jetzt })
  return {
    art: 'hof',
    hofName: daten.hofName,
    slug: quelle.hof.slug,
    link,
    adresse,
    auswahl: quelle.hof.isPaused ? [] : teilenAuswahl(quelle.produkte, quelle.hof),
    textVorschlag: teilenTextVorschlag(
      daten.produkte.map((p) => p.name),
      daten.abholung
    ),
  }
}

/**
 * Die Daten des Teilen-Fensters für EINEN eigenen Beitrag (Register T5):
 * Bild und Text aus dem Beitrag, Link auf den Reiter „Beiträge", die
 * verknüpften Produkte vorbelegt, die WhatsApp-Abonnentinnen live (dieselbe
 * Zahl wie der Knopf im Reiter, W1) und die Mail-Empfänger vom
 * Veröffentlichen. Der Beitrag muss dem Hof der Sitzung gehören (Besitz in
 * der WHERE-Klausel) und ins Bild dürfen (veröffentlicht, auf der Hofseite,
 * nicht abgelaufen — `beitragDarfInsBild`, dieselbe Regel wie die Bild-Route);
 * sonst null. Nur lesen: Teilen legt keinen Beitrag an (Teilen (d)).
 */
export async function ladeTeilenFensterBeitrag(farmId: string, postId: string, jetzt: Date): Promise<TeilenFensterBeitrag | null> {
  const [quelle, beitrag, abonnentinnen] = await Promise.all([
    ladeTeilenBildQuelle({ id: farmId }),
    prisma.statusPost.findFirst({
      where: { id: postId, farmId },
      select: {
        id: true,
        farmId: true,
        title: true,
        body: true,
        linkedProductIds: true,
        publishedAt: true,
        expiresAt: true,
        showOnFarmPage: true,
        sentViaEmail: true,
        emailRecipientCount: true,
        whatsappGetippt: true,
      },
    }),
    zaehleWhatsAppAbonnentinnen(farmId),
  ])
  if (!quelle || !beitrag || !beitragDarfInsBild(beitrag, farmId, jetzt)) return null
  const hof = hofAdresse(APP_URL, quelle.hof.slug)
  const daten = teilenBildDaten({ hof: quelle.hof, produkte: quelle.produkte, slots: quelle.slots, auswahl: null, adresse: hof.anzeige, jetzt })
  const auswahl = quelle.hof.isPaused ? [] : teilenAuswahl(quelle.produkte, quelle.hof)
  const quellen = bildQuellen(
    quelle,
    auswahl.map((e) => e.id)
  )
  return {
    art: 'beitrag',
    hofName: daten.hofName,
    slug: quelle.hof.slug,
    link: beitragLink(hof.url),
    adresse: beitragLink(hof.anzeige),
    auswahl,
    textVorschlag: beitragTextVorschlag(beitrag.title, beitrag.body, daten.abholung),
    beitragId: beitrag.id,
    titel: einzeiligerFremdtext(beitrag.title, BEITRAG_TITEL_MAX),
    vorbelegt: beitragVorbelegung(auswahl, quelle.produkte, beitrag.linkedProductIds),
    ohneFoto: auswahl.filter((_, i) => quellen[i].art !== 'foto').map((e) => e.id),
    ...beitragWhatsApp(beitrag.id, abonnentinnen, beitrag.whatsappGetippt.length),
    email: beitrag.sentViaEmail && beitrag.emailRecipientCount > 0 ? { anzahl: beitrag.emailRecipientCount } : null,
  }
}

export type PlakatDaten = {
  hofName: string
  ort: string
  /** Host und Pfad ohne https:// (Domain/hof-test) — gedruckt unter dem Code. */
  adresse: string
  /** Die statische Hofseiten-Adresse mit `?k=qr` — Inhalt des QR-Codes. */
  link: string
  /** „Mi 15–18 · Sa 9–12 Uhr"; null ohne Abholzeiten. */
  abholzeiten: string | null
  bezahlen: string | null
}

/**
 * Die Daten des QR-Plakats (Gate 7 Aufgabe 3) für den eigenen Hof — nur
 * öffentliche Angaben und nur, solange der Hof öffentlich ist (S9). Der
 * QR-Code trägt die feste Adresse der Hofseite mit `?k=qr`; ein gedrucktes
 * Plakat bleibt so gültig, egal was sich am Angebot ändert.
 */
export async function getPlakatDaten(farmId: string): Promise<PlakatDaten | null> {
  const farm = await prisma.farm.findFirst({
    where: { id: farmId, ...OEFFENTLICH_SICHTBAR },
    select: {
      name: true,
      slug: true,
      city: true,
      acceptsOnline: true,
      acceptsOnsite: true,
      stripeAccountReady: true,
      pickupSlots: { where: { isActive: true }, select: { dayOfWeek: true, startTime: true, endTime: true } },
    },
  })
  if (!farm) return null
  const zeiten = abholzeitenKurz(farm.pickupSlots)
  return {
    hofName: einzeiligerFremdtext(farm.name, HOFNAME_MAX),
    ort: einzeiligerFremdtext(farm.city, HOFNAME_MAX),
    adresse: hofAdresse(APP_URL, farm.slug).anzeige,
    link: teilenLink(APP_URL, farm.slug, 'qr'),
    abholzeiten: zeiten ? `${zeiten} Uhr` : null,
    // Online nur, wenn Stripe fertig ist — sonst stünde auf dem Plakat etwas, das gerade nicht geht.
    bezahlen: plakatBezahlen({ online: farm.acceptsOnline && farm.stripeAccountReady, bar: farm.acceptsOnsite }),
  }
}
