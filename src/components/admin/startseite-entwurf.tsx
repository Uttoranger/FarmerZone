'use client'

import { useEffect, useRef, useState } from 'react'
import * as Sentry from '@sentry/nextjs'
import type { StartseiteVorlage } from '@prisma/client'
import {
  NEUER_BLOCK,
  VORLAGE_TEXT,
  felderDerVorlage,
  wienerEingabe,
  zeitpunktAusEingabe,
  type StartseitenBlockDaten,
} from '@/lib/startseite-gestalten'
import { ENTWURF_RUHE_MS, fassungAusEntwurf, vergleicheMitLive, type Aenderung } from '@/lib/startseite-fassung'
import { uhrzeitInWien } from '@/lib/fristen'
import { ABSCHNITT_SPEICHERN_TEXT } from '@/lib/abschnitt-stand'
import { BEZEICHNER, befundVon, istNetzfehler } from '@/lib/upload-diagnose'
import type { FassungInhalt } from '@/schemas/startseite-fassung'
import {
  STARTSEITE_SAETZE,
  startseitenBlockSchema,
  type StartseiteSpeichernEingabe,
  type StartseitenBlockEingabe,
} from '@/schemas/startseite'
import type { AdminStartseitenZeile } from '@/server/queries/startseite'
import type { EntwurfGespeichert } from '@/server/actions/startseite'

/*
 * Der Entwurf von Admin › Startseite im Browser (Register N16, Änderung
 * Nr. 99): Liste und offener Block, das automatische Speichern und der
 * Vergleich mit live.
 *
 * Jede Änderung (Pfeile, Auge, Block-Formular) speichert nach ENTWURF_RUHE_MS
 * Ruhe — eine Speicherung zur Zeit, die letzte gewinnt: Was während einer
 * Speicherung dazukommt, geht danach mit dem dann neuesten Stand hinaus, nie
 * zwei verschränkt. Der Stand liegt in einer Ref (die Wahrheit) und gespiegelt
 * im Zustand (die Anzeige) — so liest eine Speicherung, die nach einem
 * `await` startet, nie den Stand aus einem alten Render.
 */

export type Zeile = AdminStartseitenZeile

/** Der Block im Formular — Felder als Text, wie sie in den Eingaben stehen. */
export type BlockWerte = {
  zeilenId: string
  id?: string
  vorlage: StartseiteVorlage
  ueberzeile: string
  titel: string
  text: string
  bildUrl: string
  linkUrl: string
  linkText: string
  farmIds: string[]
  kategorie: string
  liveAbTag: string
  liveAbUhrzeit: string
  liveBisTag: string
  liveBisUhrzeit: string
  /** So viele gewählte Höfe waren beim Öffnen nicht mehr sichtbar und fielen aus der Auswahl (Nr. 183) — für den Satz darunter. */
  hoefeEntfernt?: number
}

export function neueBlockWerte(vorlage: StartseiteVorlage, jetzt: Date): BlockWerte {
  const { tag, uhrzeit } = wienerEingabe(jetzt)
  return {
    zeilenId: NEUER_BLOCK,
    vorlage,
    ueberzeile: '',
    titel: '',
    text: '',
    bildUrl: '',
    linkUrl: '',
    linkText: '',
    farmIds: [],
    kategorie: '',
    liveAbTag: tag,
    liveAbUhrzeit: uhrzeit,
    liveBisTag: '',
    liveBisUhrzeit: '',
  }
}

export function blockWerteAus(zeile: Zeile): BlockWerte | null {
  const b = zeile.block
  if (!b) return null
  const ab = wienerEingabe(new Date(b.liveAb))
  const bis = b.liveBis ? wienerEingabe(new Date(b.liveBis)) : null
  return {
    zeilenId: zeile.id,
    id: b.id,
    vorlage: b.vorlage,
    ueberzeile: b.ueberzeile ?? '',
    titel: b.titel,
    text: b.text ?? '',
    bildUrl: b.bildUrl ?? '',
    linkUrl: b.linkUrl ?? '',
    linkText: b.linkText ?? '',
    farmIds: b.farmIds,
    kategorie: b.kategorie ?? '',
    liveAbTag: ab.tag,
    liveAbUhrzeit: ab.uhrzeit,
    liveBisTag: bis?.tag ?? '',
    liveBisUhrzeit: bis?.uhrzeit ?? '',
  }
}

/**
 * Beim Öffnen: Gewählte Höfe, die nicht mehr sichtbar sind (pausiert, gesperrt,
 * Testhof), fallen aus der Auswahl (Nr. 183). Das Formular zeigt nur sichtbare
 * Höfe — ein unsichtbarer ließe sich nicht abwählen, und der Server wiese
 * jede Speicherung ab, auch Pfeile und Auge. Seine Prüfung bleibt.
 */
export function nurSichtbareHoefe(werte: BlockWerte, sichtbar: readonly string[]): BlockWerte {
  const farmIds = werte.farmIds.filter((id) => sichtbar.includes(id))
  const entfernt = werte.farmIds.length - farmIds.length
  return entfernt === 0 ? werte : { ...werte, farmIds, hoefeEntfernt: entfernt }
}

/** Der Block als Eingabe des Schemas — leere Felder als null (CODING_STANDARDS §8). */
export function alsEingabe(b: BlockWerte): StartseitenBlockEingabe {
  return {
    ...(b.id ? { id: b.id } : {}),
    vorlage: b.vorlage,
    ueberzeile: b.ueberzeile,
    titel: b.titel,
    text: b.text,
    bildUrl: b.bildUrl === '' ? null : b.bildUrl,
    linkUrl: b.linkUrl,
    linkText: b.linkText,
    farmIds: b.farmIds,
    kategorie: b.kategorie === '' ? null : (b.kategorie as StartseitenBlockEingabe['kategorie']),
    liveAbTag: b.liveAbTag,
    liveAbUhrzeit: b.liveAbUhrzeit,
    liveBisTag: b.liveBisTag === '' ? null : b.liveBisTag,
    liveBisUhrzeit: b.liveBisTag === '' || b.liveBisUhrzeit === '' ? null : b.liveBisUhrzeit,
  }
}

/** Der Block so, wie die Seite ihn bekommt — für Vorschau-Kachel, Liste und Vergleich; nur die Felder der Vorlage. */
export function alsDaten(b: BlockWerte, hofSlugs: readonly string[]): StartseitenBlockDaten & { farmIds: string[] } {
  const ab = zeitpunktAusEingabe(b.liveAbTag, b.liveAbUhrzeit)
  const bis = b.liveBisTag ? zeitpunktAusEingabe(b.liveBisTag, b.liveBisUhrzeit || '23:59') : null
  return felderDerVorlage({
    id: b.id ?? NEUER_BLOCK,
    vorlage: b.vorlage,
    ueberzeile: b.ueberzeile.trim() || null,
    titel: b.titel.trim() || VORLAGE_TEXT[b.vorlage].titel,
    text: b.text.trim() || null,
    bildUrl: b.bildUrl || null,
    linkUrl: b.linkUrl.trim() || null,
    linkText: b.linkText.trim() || null,
    hofSlugs: [...hofSlugs],
    farmIds: b.farmIds,
    kategorie: (b.kategorie || null) as StartseitenBlockDaten['kategorie'],
    liveAb: (ab ?? new Date(0)).toISOString(),
    liveBis: bis?.toISOString() ?? null,
  })
}

/** Die Liste mit dem offenen Block, wie er gerade im Formular steht. */
export function mitOffenemBlock(zeilen: readonly Zeile[], block: BlockWerte | null, hofSlugs: readonly string[] = []): Zeile[] {
  return zeilen.map((z) => (block && z.id === block.zeilenId ? { ...z, block: alsDaten(block, hofSlugs) } : z))
}

/** Der Entwurf im Format einer Fassung — derselbe, den „Veröffentlichen …" aus den Tabellen liest. */
export function entwurfInhalt(zeilen: readonly Zeile[]): FassungInhalt {
  return fassungAusEntwurf(
    zeilen.map((z) => ({
      art: z.art,
      sichtbar: z.sichtbar,
      block: z.block && {
        id: z.block.id,
        vorlage: z.block.vorlage,
        ueberzeile: z.block.ueberzeile,
        titel: z.block.titel,
        text: z.block.text,
        bildUrl: z.block.bildUrl,
        linkUrl: z.block.linkUrl,
        linkText: z.block.linkText,
        farmIds: z.block.farmIds,
        kategorie: z.block.kategorie,
        liveAb: z.block.liveAb,
        liveBis: z.block.liveBis,
      },
    }))
  )
}

/**
 * Was hinausgeht: Reihenfolge und Auge immer, der offene Block nur, wenn er
 * das Schema besteht. Sonst bleibt er draußen — ein neuer samt seiner Zeile —,
 * die übrigen Änderungen gehen trotzdem, und der Satz des Schemas steht als
 * Fehlerzeile da.
 */
export function speicherEingabe(zeilen: readonly Zeile[], block: BlockWerte | null): { eingabe: StartseiteSpeichernEingabe; fehler: string | null } {
  let blockEingabe: StartseitenBlockEingabe | null = null
  let fehler: string | null = null
  if (block) {
    const eingabe = alsEingabe(block)
    const geprueft = startseitenBlockSchema.safeParse(eingabe)
    if (geprueft.success) blockEingabe = eingabe
    else fehler = geprueft.error.issues[0]?.message ?? STARTSEITE_SAETZE.ungueltig
  }
  // Die Zeile NEUER_BLOCK geht nur mit, wenn der offene, gültige Block genau dieser neue ist — sonst wiese der Server alles ab.
  const neuGeht = blockEingabe !== null && block?.zeilenId === NEUER_BLOCK
  const reihenfolge = zeilen.filter((z) => neuGeht || z.id !== NEUER_BLOCK).map((z) => ({ id: z.id, sichtbar: z.sichtbar }))
  return { eingabe: { reihenfolge, block: blockEingabe }, fehler }
}

export type SpeicherStand =
  | { art: 'ruhe' }
  | { art: 'speichert' }
  | { art: 'gespeichert'; um: string }
  | { art: 'fehler'; text: string }

type Speichern = (eingabe: StartseiteSpeichernEingabe) => Promise<EntwurfGespeichert | { error: string }>

/** Was „Speichern vor dem nächsten Schritt“ ergab — der Grund kommt aus DIESEM Lauf, nicht aus einem alten Render (Nr. 183). */
export type SofortGespeichert = { ok: boolean; fehler: string | null }

/** „Block löschen“ bzw. „Verwerfen“ — die Action wird übergeben, damit der Prüfstand sie ersetzen kann. */
type Loeschen = (blockId: string) => Promise<{ ok: true } | { error: string }>

export type BlockEntfernt = { art: 'verworfen' } | { art: 'geloescht' } | { art: 'fehler'; text: string }

/**
 * Woran die letzte Speicherung scheiterte: am offenen Block (Schema) oder an
 * der Speicherung selbst (Server, Netz). Ein Block-Fehler endet, sobald der
 * Block weg ist; ein Speicher-Fehler erst mit der nächsten gelungenen Speicherung.
 */
type Fehler = { art: 'block' | 'speichern'; text: string }

/** Ein gefangener Wurf geht trotzdem nach Sentry (CODING_STANDARDS §4) — fester Text, Klasse als Name, nie Formularwerte. */
function meldeGescheitert(fehler: unknown): void {
  try {
    const { klasse, meldung } = befundVon(fehler)
    const name = BEZEICHNER.test(klasse) ? klasse : 'Unbekannt'
    if (istNetzfehler(fehler)) {
      Sentry.addBreadcrumb({ category: 'startseite', level: 'warning', message: 'Entwurf: Verbindung abgebrochen', data: { klasse: name } })
      return
    }
    const ereignis = new Error('Startseite: Entwurf speichern gescheitert')
    ereignis.name = name
    Sentry.captureException(ereignis, { level: 'error', tags: { bereich: 'startseite-entwurf', klasse: name }, extra: { fehlertext: meldung } })
  } catch {
    // Absichtlich leer: Telemetrie scheitert leise, der Satz kommt trotzdem.
  }
}

/** Nach einem neu angelegten Block: seine Zeile heißt nicht mehr NEUER_BLOCK, der Block hat seine Kennung. */
function mitNeuerKennung(
  stand: { zeilen: Zeile[]; block: BlockWerte | null },
  zeilenId: string,
  blockId: string
): { zeilen: Zeile[]; block: BlockWerte | null } {
  const zeilen = stand.zeilen.map((z) => (z.id === NEUER_BLOCK ? { ...z, id: zeilenId } : z))
  const block = stand.block?.zeilenId === NEUER_BLOCK ? { ...stand.block, zeilenId, id: blockId } : stand.block
  return { zeilen, block }
}

export function useStartseitenEntwurf({
  start,
  live,
  speichere,
  ruheMs = ENTWURF_RUHE_MS,
}: {
  start: readonly Zeile[]
  live: FassungInhalt
  speichere: Speichern
  ruheMs?: number
}): {
  zeilen: Zeile[]
  block: BlockWerte | null
  stand: SpeicherStand
  /**
   * Zählt die gespeicherten Stände — die Vorschau des Entwurfs lädt danach neu.
   * Jede Art, die den Entwurf in der Datenbank ändert, zählt: Pfeil, Auge,
   * Block-Formular, Löschen, Verwerfen bzw. Übernehmen (Register N16, Nr. 106).
   */
  speicherungen: number
  aenderungen: Aenderung[]
  aendereZeilen: (neu: Zeile[]) => void
  aendereBlock: (neu: BlockWerte) => void
  /**
   * Öffnet bzw. schließt das Formular — ohne zu speichern. Ein neuer Block
   * bekommt seine leere Zeile nach `nachIndex`, eingefügt in den Stand der Ref
   * (nie in eine Liste aus einem alten Render, Nr. 183).
   */
  oeffneBlock: (neu: BlockWerte | null, nachIndex?: number) => void
  /** Erst speichern, was wartet, dann `oeffneBlock` — false (und nichts geöffnet), wenn danach nicht alles im Entwurf steht. */
  wechsleBlock: (neu: BlockWerte | null, nachIndex?: number) => Promise<boolean>
  /**
   * „Block löschen“ bzw. „Verwerfen“: erst eine laufende Speicherung abwarten;
   * hat der Block danach eine Kennung, löscht ihn `loesche` — sonst fällt nur
   * seine Zeile weg (Nr. 183, Fund 2).
   */
  entferneBlock: (loesche: Loeschen) => Promise<BlockEntfernt | null>
  /**
   * Vor einer Action, die den Entwurf ersetzt: Uhr löschen, laufende Speicherung abwarten (Nr. 183, Fund 7).
   * Gibt `fahreFort` zurück: Scheitert die Action, reiht es die angehaltene Änderung wieder ein.
   */
  halteAn: () => Promise<() => void>
  setzeZurueck: (zeilen: readonly Zeile[]) => void
  /** Nach „Block löschen“: Die Action hat den Entwurf schon geändert — Formular zu, Zeile weg, Vorschau lädt neu. */
  blockGeloescht: (blockId: string) => void
  speichereSofort: () => Promise<SofortGespeichert>
} {
  const [zeilen, setZeilen] = useState<Zeile[]>(() => [...start])
  const [block, setBlock] = useState<BlockWerte | null>(null)
  const [stand, setStand] = useState<SpeicherStand>({ art: 'ruhe' })
  const [speicherungen, setSpeicherungen] = useState(0)
  const aktuell = useRef<{ zeilen: Zeile[]; block: BlockWerte | null }>({ zeilen: [...start], block: null })
  const uhr = useRef<ReturnType<typeof setTimeout> | null>(null)
  const kette = useRef<Promise<void>>(Promise.resolve())
  const eingereiht = useRef(false)
  const version = useRef(0)
  const fehler = useRef<Fehler | null>(null)

  // Beim Verlassen keine Uhr stehen lassen — läuft sie noch, geht die letzte Änderung sofort hinaus (Nr. 183, Fund 6).
  useEffect(
    () => () => {
      if (!uhr.current) return
      clearTimeout(uhr.current)
      uhr.current = null
      void reiheEin()
    },
    // Absichtlich nur beim Aushängen: reiheEin liest alles aus Refs, `speichere` ist eine feste Server Action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // Schließen oder Neuladen des Tabs hängt nichts aus: Der Browser fragt nach, solange etwas noch nicht im Entwurf steht —
  // „Speichert …“ oder ein nie gültiger neuer Block. Ein gültiger neuer Block ohne Kennung wartet auf seine Speicherung
  // und ist damit schon über „Speichert …“ abgedeckt; ohne Kennung bleibt also nur der, den der Server nie annehmen konnte.
  const nieGueltigerNeuerBlock = block !== null && !block.id
  const warnen = stand.art === 'speichert' || nieGueltigerNeuerBlock
  useEffect(() => {
    if (!warnen) return
    const halte = (ereignis: BeforeUnloadEvent): void => {
      ereignis.preventDefault()
      // Ältere Browser fragen nur nach, wenn returnValue gesetzt ist.
      ereignis.returnValue = ''
    }
    window.addEventListener('beforeunload', halte)
    return () => window.removeEventListener('beforeunload', halte)
  }, [warnen])

  function uebernimm(neu: { zeilen?: Zeile[]; block?: BlockWerte | null }): void {
    aktuell.current = { ...aktuell.current, ...neu }
    if (neu.zeilen) setZeilen(neu.zeilen)
    if (neu.block !== undefined) setBlock(neu.block)
  }

  async function speichereStand(): Promise<void> {
    const gestartet = version.current
    const { eingabe, fehler: blockFehler } = speicherEingabe(aktuell.current.zeilen, aktuell.current.block)
    let antwort: EntwurfGespeichert | { error: string }
    try {
      antwort = await speichere(eingabe)
    } catch (wurf) {
      meldeGescheitert(wurf)
      antwort = { error: ABSCHNITT_SPEICHERN_TEXT.gingNicht }
    }
    if ('error' in antwort) {
      fehler.current = { art: 'speichern', text: antwort.error }
      setStand({ art: 'fehler', text: antwort.error })
      return
    }
    if (antwort.zeilenId && antwort.blockId) uebernimm(mitNeuerKennung(aktuell.current, antwort.zeilenId, antwort.blockId))
    // Ein hinzugefügter Zusatz-Abschnitt (Nr. 129) trägt ab jetzt die Kennung seiner Zeile — sonst legte die nächste Speicherung ihn noch einmal an.
    if (Object.keys(antwort.neueAbschnitte).length > 0) {
      uebernimm({ zeilen: aktuell.current.zeilen.map((z) => ({ ...z, id: antwort.neueAbschnitte[z.id] ?? z.id })) })
    }
    setSpeicherungen((n) => n + 1)
    fehler.current = blockFehler === null ? null : { art: 'block', text: blockFehler }
    if (blockFehler) setStand({ art: 'fehler', text: blockFehler })
    // Kam während der Speicherung etwas dazu, ist es schon eingereiht — bis dahin „Speichert …".
    else if (version.current === gestartet && !uhr.current) setStand({ art: 'gespeichert', um: uhrzeitInWien(new Date(antwort.gespeichertAm)) })
  }

  /** Höchstens eine Speicherung wartet; sie liest beim Start den dann neuesten Stand. */
  function reiheEin(): Promise<void> {
    if (!eingereiht.current) {
      eingereiht.current = true
      kette.current = kette.current.then(() => {
        eingereiht.current = false
        return speichereStand()
      })
    }
    return kette.current
  }

  /** Vor „Veröffentlichen …", einem Blockwechsel, Löschen: was noch wartet, sofort speichern. */
  async function speichereSofort(): Promise<SofortGespeichert> {
    if (uhr.current) {
      clearTimeout(uhr.current)
      uhr.current = null
      await reiheEin()
    } else if (fehler.current) {
      // Nach einem Fehler ist der Stand nicht sicher im Entwurf: neu speichern statt den alten Fehler zurückzugeben (Nr. 183, Fund 1).
      await reiheEin()
    } else {
      await kette.current
    }
    return { ok: fehler.current === null, fehler: fehler.current?.text ?? null }
  }

  /**
   * Der offene Block ist weg (verworfen, gelöscht), danach ist kein ungültiger Block mehr offen: Der Editor ist wieder frei,
   * gleich welcher Fehler vorher stand (Wortlaut Freigabe Nr. 183, Fund 1). Nach einem Speicher-Fehler (Server, Netz)
   * hat `speichereSofort` es gerade noch einmal versucht; jede weitere Änderung schickt den ganzen Stand neu.
   */
  function nachBlockWeg(): void {
    fehler.current = null
    // Läuft noch eine Uhr, wartet eine Änderung: „Speichert …“ ist dann wahrer als „Ruhe“ (über entferneBlock nie der Fall).
    if (!uhr.current) setStand({ art: 'ruhe' })
  }

  function oeffneBlock(neu: BlockWerte | null, nachIndex?: number): void {
    // Wer einen nie gespeicherten neuen Block verlässt, lässt seine leere Zeile nicht stehen.
    // Der Block, der zugeht, bleibt mit seinem Stand in der Liste (Nr. 106): Sonst zeigte sie nach „Fertig“
    // seine alten Daten (ein neuer: keine) und zählte ihn nicht als Änderung, bis die Seite neu lädt.
    const liste = mitOffenemBlock(aktuell.current.zeilen, aktuell.current.block).filter((z) => z.id !== NEUER_BLOCK)
    if (neu?.zeilenId === NEUER_BLOCK && nachIndex !== undefined) {
      liste.splice(nachIndex + 1, 0, { id: NEUER_BLOCK, art: 'BLOCK', sichtbar: true, block: null })
    }
    uebernimm({ block: neu, zeilen: liste })
    // Fielen beim Öffnen unsichtbare Höfe aus der Auswahl (Nr. 183, Fund 5), ist das eine Änderung am Entwurf.
    if (neu?.hoefeEntfernt) geaendert()
  }

  function blockGeloescht(blockId: string): void {
    // Auch über die Zeile des offenen Blocks: Ein in dieser Sitzung angelegter Block steht in `zeilen` ohne Daten (block: null).
    const zeilenId = aktuell.current.block?.zeilenId
    uebernimm({ block: null, zeilen: aktuell.current.zeilen.filter((z) => z.id !== zeilenId && z.block?.id !== blockId) })
    setSpeicherungen((n) => n + 1)
    nachBlockWeg()
  }

  function geaendert(): void {
    version.current += 1
    setStand({ art: 'speichert' })
    if (uhr.current) clearTimeout(uhr.current)
    uhr.current = setTimeout(() => {
      uhr.current = null
      void reiheEin()
    }, ruheMs)
  }

  return {
    zeilen,
    block,
    stand,
    speicherungen,
    aenderungen: vergleicheMitLive(live, entwurfInhalt(mitOffenemBlock(zeilen, block))),
    aendereZeilen(neu) {
      uebernimm({ zeilen: neu })
      geaendert()
    },
    aendereBlock(neu) {
      uebernimm({ block: neu })
      geaendert()
    },
    oeffneBlock,
    async wechsleBlock(neu, nachIndex) {
      const { ok } = await speichereSofort()
      if (ok) oeffneBlock(neu, nachIndex)
      return ok
    },
    async entferneBlock(loesche) {
      if (!aktuell.current.block) return null
      // Erst abwarten: Legt eine laufende Speicherung den Block gerade an, hat er danach seine Kennung (Fund 2).
      await speichereSofort()
      const offen = aktuell.current.block
      if (!offen) return null
      if (!offen.id) {
        // Ein neuer Block, der nie gespeichert wurde: nur die Zeile weg.
        oeffneBlock(null)
        nachBlockWeg()
        return { art: 'verworfen' }
      }
      const ergebnis = await loesche(offen.id)
      if ('error' in ergebnis) return { art: 'fehler', text: ergebnis.error }
      blockGeloescht(offen.id)
      return { art: 'geloescht' }
    },
    async halteAn() {
      const angehalten = uhr.current !== null
      if (uhr.current) {
        clearTimeout(uhr.current)
        uhr.current = null
      }
      await kette.current
      // Scheitert die Action danach, geht die angehaltene Änderung wieder hinaus — sonst stünde „Speichert …“ ohne Speicherung.
      return () => {
        if (angehalten) void reiheEin()
      }
    },
    setzeZurueck(neu) {
      // Der Entwurf kommt ganz vom Server: kein offener Block, kein alter Fehler.
      uebernimm({ zeilen: [...neu], block: null })
      fehler.current = null
      setStand({ art: 'ruhe' })
      setSpeicherungen((n) => n + 1)
    },
    blockGeloescht,
    speichereSofort,
  }
}
