import { prisma } from '@/lib/prisma'
import { POSTFACH_TEXT } from '@/lib/postfach'
import type { StapelMail } from '@/lib/email'
import type { EinstellAuftrag } from '@/server/mail-warteschlange'
import type { Verworfen } from '@/server/mail-arten'
import { VORRANG, abrechnungBezugSchema, fadenBezugSchema, hofBezugSchema, nachrichtBezugSchema } from '@/schemas/mail-auftrag'

/*
 * Die Mails an einen Hof (Register N12, N26; Nr. 159): die Freischaltung und
 * die Antwort des Teams im Faden (Wichtig), das Rundschreiben mit dem Haken
 * „Betriebsmitteilung" (Kann warten). Adresse ist die des Inhaberkontos —
 * wie bisher; ein stillgelegter Hof bekommt keine Postfach-Mail mehr
 * (die Renderer unten verwerfen bei `archivedAt`).
 */

/** Freischaltung → Hof. Der Zeitpunkt macht den Schlüssel eindeutig: Nach einer Rücknahme darf eine neue Freischaltung wieder schreiben. */
export function freischaltungAuftrag(farmId: string, freigeschaltetAm: Date): EinstellAuftrag {
  return {
    art: 'freischaltung',
    vorrang: VORRANG.wichtig,
    schluessel: `freischaltung:${farmId}:${freigeschaltetAm.getTime()}`,
    bezug: { farmId },
    farmId,
  }
}

/** Plattformgebühr: Ankündigung des Einzugs → Hof (Nr. 198), genau einmal je Hof. */
export function ankuendigungAuftrag(farmId: string): EinstellAuftrag {
  return { art: 'plattformgebuehr-ankuendigung', vorrang: VORRANG.wichtig, schluessel: `plattformgebuehr-ankuendigung:${farmId}`, bezug: { farmId }, farmId }
}

/** Lastschrift gescheitert → Hof (Nr. 198): je Versuch von Stripe ein Auftrag. */
export function lastschriftGescheitertAuftrag(monatsabrechnungId: string, farmId: string, versuch: number): EinstellAuftrag {
  return {
    art: 'lastschrift-gescheitert',
    vorrang: VORRANG.wichtig,
    schluessel: `lastschrift-gescheitert:${monatsabrechnungId}:${versuch}`,
    bezug: { monatsabrechnungId },
    farmId,
  }
}

/** Antwort des Teams → Hof, je Nachricht ein Auftrag. */
export function postfachAntwortAuftrag(nachrichtId: string, farmId: string): EinstellAuftrag {
  return { art: 'postfach', vorrang: VORRANG.wichtig, schluessel: `postfach:${nachrichtId}`, bezug: { nachrichtId }, farmId }
}

/** Rundschreiben mit Betriebsmitteilung → je Faden (= je Hof) ein Auftrag (Kann warten). */
export function rundschreibenAuftraege(faeden: readonly { id: string; farmId: string }[]): EinstellAuftrag[] {
  return faeden.map((f) => ({
    art: 'rundschreiben',
    vorrang: VORRANG.kannWarten,
    schluessel: `rundschreiben:${f.id}`,
    bezug: { unterhaltungId: f.id },
    farmId: f.farmId,
  }))
}

export async function rendereFreischaltung(bezug: Record<string, string>): Promise<StapelMail | Verworfen> {
  const { farmId } = hofBezugSchema.parse(bezug)
  const hof = await prisma.farm.findUnique({ where: { id: farmId }, select: { name: true, slug: true, approvedAt: true, owner: { select: { email: true } } } })
  if (!hof) return { verworfen: 'hof_fehlt' }
  // Inzwischen zurückgenommen: „Dein Hof ist freigeschaltet" stimmte nicht mehr.
  if (!hof.approvedAt) return { verworfen: 'nicht_freigeschaltet' }
  const { baueFreischaltungEmail } = await import('@/lib/email')
  return baueFreischaltungEmail({ name: hof.name, slug: hof.slug, ownerEmail: hof.owner.email })
}

export async function renderePostfachAntwort(bezug: Record<string, string>): Promise<StapelMail | Verworfen> {
  const { nachrichtId } = nachrichtBezugSchema.parse(bezug)
  const n = await prisma.nachricht.findUnique({
    where: { id: nachrichtId },
    select: {
      text: true,
      linkUrl: true,
      unterhaltungId: true,
      unterhaltung: { select: { rundschreiben: { select: { titel: true } }, farm: { select: { archivedAt: true, owner: { select: { email: true } } } } } },
    },
  })
  if (!n) return { verworfen: 'nachricht_fehlt' }
  if (n.unterhaltung.farm.archivedAt) return { verworfen: 'hof_stillgelegt' }
  const { bauePostfachMail } = await import('@/lib/email')
  return bauePostfachMail({
    art: 'antwort',
    an: n.unterhaltung.farm.owner.email,
    titel: n.unterhaltung.rundschreiben?.titel ?? POSTFACH_TEXT.ohneTitel,
    text: n.text,
    link: n.linkUrl,
    unterhaltungId: n.unterhaltungId,
  })
}

export async function rendereRundschreiben(bezug: Record<string, string>): Promise<StapelMail | Verworfen> {
  const { unterhaltungId } = fadenBezugSchema.parse(bezug)
  const faden = await prisma.unterhaltung.findUnique({
    where: { id: unterhaltungId },
    select: { rundschreiben: { select: { titel: true, text: true, linkUrl: true } }, farm: { select: { archivedAt: true, owner: { select: { email: true } } } } },
  })
  if (!faden?.rundschreiben) return { verworfen: 'rundschreiben_fehlt' }
  if (faden.farm.archivedAt) return { verworfen: 'hof_stillgelegt' }
  const { bauePostfachMail } = await import('@/lib/email')
  return bauePostfachMail({
    art: 'rundschreiben',
    an: faden.farm.owner.email,
    titel: faden.rundschreiben.titel,
    text: faden.rundschreiben.text,
    link: faden.rundschreiben.linkUrl,
    unterhaltungId,
  })
}

/** Plattformgebühr: Ankündigung des Einzugs (Nr. 198) — Datum, Satz und Mandat frisch aus der Datenbank. */
export async function renderePlattformgebuehrAnkuendigung(bezug: Record<string, string>): Promise<StapelMail | Verworfen> {
  const { farmId } = hofBezugSchema.parse(bezug)
  const { ankuendigungDaten } = await import('@/server/plattformgebuehr-abrechnung')
  const daten = await ankuendigungDaten(farmId)
  if (!daten) return { verworfen: 'hof_fehlt' }
  if (daten.archiviert) return { verworfen: 'hof_stillgelegt' }
  const { bauePlattformgebuehrAnkuendigung } = await import('@/lib/email')
  return bauePlattformgebuehrAnkuendigung({ an: daten.an, text: daten.text, datum: daten.datum })
}

/** Lastschrift gescheitert (Nr. 198). Inzwischen bezahlt: Die Mail stimmte nicht mehr. */
export async function rendereLastschriftGescheitert(bezug: Record<string, string>): Promise<StapelMail | Verworfen> {
  const { monatsabrechnungId } = abrechnungBezugSchema.parse(bezug)
  const abr = await prisma.monatsabrechnung.findUnique({
    where: { id: monatsabrechnungId },
    select: { stand: true, monat: true, farm: { select: { archivedAt: true, barSperreNachTagen: true, owner: { select: { email: true } } } } },
  })
  if (!abr) return { verworfen: 'abrechnung_fehlt' }
  if (abr.farm.archivedAt) return { verworfen: 'hof_stillgelegt' }
  if (abr.stand === 'bezahlt') return { verworfen: 'schon_bezahlt' }
  const { monatText } = await import('@/lib/plattformgebuehr')
  const { lastschriftGescheitertText } = await import('@/lib/konditionen')
  const monat = monatText(abr.monat.toISOString().slice(0, 7))
  const { baueLastschriftGescheitert } = await import('@/lib/email')
  return baueLastschriftGescheitert({ an: abr.farm.owner.email, text: lastschriftGescheitertText({ monat, tage: abr.farm.barSperreNachTagen }), monat })
}
