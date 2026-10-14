import type { CSSProperties } from 'react'
import { TEILEN_BILD_MASSE, type TeilenBildDaten, type TeilenBildEintrag } from '@/lib/teilen-bild'
import type { TeilenBildFormat } from '@/lib/teilen-kanal'
import type { QrPfad } from '@/lib/qr-code'
import type { GeladeneBilder } from '@/lib/teilen-bild-quellen'
import { MARKE } from '@/lib/marke'
import { MARKE_RUNDUNG_PROZENT } from '@/lib/marke-bild'

/*
 * Das Teilen-Bild als Satori-Grafik (next/og; Register T6, Nr. 69; Mockups
 * system-teilen-bild-varianten — A gilt, B mit Foto — und
 * system-teilen-bild-story-und-beitrag). Nur Darstellung: Was hineinkommt,
 * entscheiden `teilenBildDaten` (src/lib/teilen-bild.ts) und die Bildquellen
 * (src/lib/teilen-bild-quellen.ts).
 *
 *  - Variante A „Marktkarte": Creme, grüne Kante (1:1 links, Story oben),
 *    Titel in Fraunces, bis zu drei Produktzeilen mit rundem Bild (Foto oder
 *    Illustration), Abhol-Streifen, Link-Pille.
 *  - Variante B „Foto-Held", sobald ein Foto geladen ist (`bilder.held`):
 *    Foto als Grund mit dunklem Verlauf unten, Titel, Produkt-Chips,
 *    Abholung und Link.
 *  - Der QR-Code steht nur in der Story (9:16) — dort ist kein Link
 *    klickbar; im 1:1 nie (im Beitrag ist der Link klickbar).
 *  - Variante A zeigt drei Produktzeilen, im Beitrag-Modus und bei einem
 *    Titel, der voraussichtlich zwei Zeilen braucht, zwei (`zeilenMax`):
 *    Satori misst nicht vorab, und eine halbe Zeile am Rand sähe kaputt aus.
 *
 * Die Bildmarke (Register M1, Nr. 92) ist ein Bild, keine Zeichnung: Die Route
 * lädt die volle Fassung aus public/marke als data-URL (`ladeMarkeDataUrl`)
 * und reicht sie als `marke` herein; Satori zeichnet sie als <img> mit 22 %
 * Rundung — 50 px im 1:1, 59 px in der Story, beides über der Grenze von 48 px.
 *
 * Satori kennt keine CSS-Variablen und keine Klassen — die Farben stehen
 * deshalb hier als Werte (Register T1), die Token-Werte aus
 * docs/ai/DESIGN_SYSTEM.md im HELLEN Theme wie im Mockup (ein Bild hat kein
 * Theme, es wird verschickt). Herkunft je Wert: `grund` = --surface (hell),
 * `tinte` = --text (hell), `leise` = --text-muted (hell), `gruen` = --accent,
 * `aufGruen` = --on-accent, `linie` = --border (hell), `fotoLeise` =
 * --status-fertig (dunkel) für Zweittext auf dem dunklen Verlauf. Abgeleitet:
 * `streifen` (#F1EDE0 aus dem Mockup) ist --bg (hell) mit etwa einem Fünftel
 * --border (hell) — eine Stufe unter dem Grund, damit der Abhol-Streifen sich
 * ohne Rahmen abhebt; `markeKreis` ist --accent mit 16 % Deckkraft (leerer
 * Bildkreis); `cremeAufFoto` und `linieFoto` sind --surface (hell) mit 95
 * und 24 % auf dem Foto; `schleier`/`schleierStory` und
 * `titelSchatten` sind --bg (dunkel) als Verlauf bzw. Schatten über dem Foto
 * (dichter als im Mockup: Auf hellen Fotos trügen Marke und Vorzeile sonst nicht). Grüne Schrift (Titel,
 * Preise, Marke) nimmt --accent statt des dunkleren Grüns im Mockup — dafür
 * gibt es kein Token. tests/teilen-bild.test.ts gleicht die Token-Werte mit
 * der Tabelle in docs/ai/DESIGN_SYSTEM.md ab. Jede Zeile mit eigener Ausnahme
 * für die Lint-Regel; das ist die EINE Stelle für Farben des Teilen-Bilds.
 * Alles Fremde (Hof-, Produkt-, Ortsname, Beitrag) steht nur als Text-Kind,
 * nie als HTML — Satori setzt Text, es parst nichts.
 */
export const TEILEN_BILD_FARBE = {
  // eslint-disable-next-line no-restricted-syntax -- Satori: --surface (hell), Grund der Marktkarte, QR-Grund, Schrift auf dem Foto
  grund: '#fbf9f2',
  // eslint-disable-next-line no-restricted-syntax -- Satori: --text (hell), Schrift und QR-Module
  tinte: '#1c241d',
  // eslint-disable-next-line no-restricted-syntax -- Satori: --text-muted (hell), Zweittext
  leise: '#5d6a5c',
  // eslint-disable-next-line no-restricted-syntax -- Satori: --accent, Kante, Titel, Preise, Link-Pille
  gruen: '#2e6b45',
  // eslint-disable-next-line no-restricted-syntax -- Satori: --on-accent, Schrift und Symbol auf Grün
  aufGruen: '#f6f4ea',
  // eslint-disable-next-line no-restricted-syntax -- Satori: --border (hell), Trennlinien und Rahmen des QR-Codes
  linie: '#e2ddc9',
  // eslint-disable-next-line no-restricted-syntax -- Satori: abgeleitet (Kopfkommentar), Abhol-Streifen
  streifen: '#f1ede0',
  // eslint-disable-next-line no-restricted-syntax -- Satori: --accent mit 16 % Deckkraft, leerer Bildkreis
  markeKreis: 'rgba(46,107,69,0.16)',
  // eslint-disable-next-line no-restricted-syntax -- Satori: --status-fertig (dunkel), Zweittext auf dem dunklen Verlauf
  fotoLeise: '#9fd0af',
  // eslint-disable-next-line no-restricted-syntax -- Satori: --surface (hell) mit 95 % Deckkraft, Chips und QR-Streifen auf dem Foto
  cremeAufFoto: 'rgba(251,249,242,0.95)',
  // eslint-disable-next-line no-restricted-syntax -- Satori: --surface (hell) mit 24 % Deckkraft, Trennlinie auf dem Foto
  linieFoto: 'rgba(251,249,242,0.24)',
  // eslint-disable-next-line no-restricted-syntax -- Satori: --bg (dunkel) als Verlauf im 1:1, oben für die Marke, unten dicht für die Schrift
  schleier: 'linear-gradient(180deg, rgba(11,16,12,0.55) 0%, rgba(11,16,12,0.35) 10%, rgba(11,16,12,0) 22%, rgba(11,16,12,0) 32%, rgba(11,16,12,0.86) 64%, rgba(11,16,12,0.96) 100%)',
  // eslint-disable-next-line no-restricted-syntax -- Satori: --bg (dunkel) als Verlauf in der Story; die Schrift beginnt dort schon bei gut einem Drittel der Höhe
  schleierStory: 'linear-gradient(180deg, rgba(11,16,12,0.55) 0%, rgba(11,16,12,0.35) 16%, rgba(11,16,12,0) 26%, rgba(11,16,12,0.5) 36%, rgba(11,16,12,0.88) 56%, rgba(11,16,12,0.96) 100%)',
  // eslint-disable-next-line no-restricted-syntax -- Satori: --bg (dunkel) als Schatten des Titels auf dem Foto
  titelSchatten: '0 4px 24px rgba(11,16,12,0.45)',
} as const

const F = TEILEN_BILD_FARBE

const BESTELLEN = 'Online bestellen · am Hof abholen'

/** Maße stehen wie im Mockup (1:1 auf 480 px, Story auf 405 px Breite) und werden auf 1080 px umgerechnet. */
type Mass = (quadrat: number, story?: number) => number

function massstab(story: boolean): Mass {
  return (quadrat, storyWert = quadrat) => Math.round(story ? (storyWert * 1080) / 405 : (quadrat * 1080) / 480)
}

function kleineZeile(groesse: number, farbe: string, abstand: number): CSSProperties {
  return {
    display: 'block',
    lineClamp: 1,
    fontSize: groesse,
    fontWeight: 600,
    letterSpacing: abstand,
    textTransform: 'uppercase',
    color: farbe,
  }
}

function Marke({ m, aufFoto, marke }: { m: Mass; aufFoto: boolean; marke: string }): React.JSX.Element {
  const farbe = aufFoto ? F.grund : F.gruen
  // 22 im Mockup-Maß sind 50 px im 1:1 und 59 px in der Story — über der Grenze von 48 px, also die volle Fassung.
  const kante = m(22)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: m(6),
        fontFamily: 'Fraunces',
        fontSize: m(13, 14),
        fontWeight: 600,
        color: farbe,
        // Auf einem hellen Foto (Himmel) trüge die helle Schrift sonst nicht.
        ...(aufFoto ? { textShadow: F.titelSchatten } : {}),
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori (next/og) zeichnet nur <img>, next/image gibt es dort nicht */}
      <img
        src={marke}
        alt=""
        width={kante}
        height={kante}
        style={{ flexShrink: 0, width: kante, height: kante, borderRadius: Math.round((kante * MARKE_RUNDUNG_PROZENT) / 100) }}
      />
      <div style={{ display: 'flex' }}>{MARKE}</div>
    </div>
  )
}

function Rund({ src, kante }: { src: string | undefined; kante: number }): React.JSX.Element {
  if (!src) {
    return <div style={{ display: 'flex', flexShrink: 0, width: kante, height: kante, borderRadius: kante, backgroundColor: F.markeKreis }} />
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Satori (next/og) zeichnet nur <img>, next/image gibt es dort nicht
    <img src={src} alt="" width={kante} height={kante} style={{ flexShrink: 0, width: kante, height: kante, borderRadius: kante, objectFit: 'cover' }} />
  )
}

function Kalender({ kante, farbe }: { kante: number; farbe: string }): React.JSX.Element {
  return (
    <svg width={kante} height={kante} viewBox="0 0 24 24" fill="none" stroke={farbe} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 2v4M16 2v4M3 9h18" />
    </svg>
  )
}

function QrKasten({ qr, kante, rand, m }: { qr: QrPfad; kante: number; rand: number; m: Mass }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexShrink: 0, padding: rand, borderRadius: m(8), backgroundColor: F.grund, border: `${m(1)}px solid ${F.linie}` }}>
      <svg width={kante} height={kante} viewBox={`-2 -2 ${qr.groesse + 4} ${qr.groesse + 4}`}>
        <path d={qr.pfad} fill={F.tinte} />
      </svg>
    </div>
  )
}

/** Der Streifen der Story: QR-Code, Abholung, „Code scannen oder <Adresse>" (auf Creme bzw. halbdeckend auf dem Foto). */
function QrStreifen({ daten, qr, m, aufFoto }: { daten: TeilenBildDaten; qr: QrPfad; m: Mass; aufFoto: boolean }): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        gap: m(14),
        padding: m(aufFoto ? 12 : 14),
        borderRadius: m(16),
        backgroundColor: aufFoto ? F.cremeAufFoto : F.streifen,
        color: F.tinte,
      }}
    >
      <QrKasten qr={qr} kante={m(aufFoto ? 72 : 84)} rand={m(aufFoto ? 3 : 4)} m={m} />
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
        {daten.abholTermin && <div style={kleineZeile(m(aufFoto ? 10.5 : 11), F.leise, m(1.2))}>Abholung</div>}
        {daten.abholTermin && (
          <div style={{ display: 'block', lineClamp: 1, fontSize: m(aufFoto ? 14.5 : 15.5), fontWeight: 600, lineHeight: 1.3 }}>{daten.abholTermin}</div>
        )}
        <div
          style={{
            display: 'block',
            lineClamp: 2,
            marginTop: daten.abholTermin ? m(aufFoto ? 5 : 6) : 0,
            fontSize: m(aufFoto ? 12 : 12.5),
            color: F.leise,
          }}
        >
          {`Code scannen oder ${daten.adresse}`}
        </div>
      </div>
    </div>
  )
}

/**
 * Wie viele Produktzeilen Variante A zeigt: drei; zwei im Beitrag-Modus (Text
 * unter dem Titel, wie im Mockup) und wenn der Titel voraussichtlich umbricht.
 * Geschätzt über die Zeichenzahl — Fraunces SemiBold braucht im 1:1 rund
 * 40 px je Zeichen auf 944 px, in der Story rund 56 px auf 942 px; die
 * Schwellen lassen Luft für breite Buchstaben.
 */
function zeilenMax(daten: TeilenBildDaten, story: boolean): number {
  if (daten.beitrag) return 2
  return daten.hofName.length > (story ? 14 : 20) ? 2 : 3
}

function Zeilen({ produkte, bilder, m, abstand }: { produkte: readonly TeilenBildEintrag[]; bilder: GeladeneBilder; m: Mass; abstand: number }): React.JSX.Element {
  return (
    // overflow und flexShrink nur als Netz, falls die Schätzung in zeilenMax danebenliegt.
    <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 1, minHeight: 0, overflow: 'hidden', marginTop: abstand }}>
      {produkte.map((p, i) => (
        <div
          key={p.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            flexShrink: 0,
            gap: m(12),
            padding: `${m(8, 10)}px 0`,
            ...(i > 0 ? { borderTop: `${m(1)}px dashed ${F.linie}` } : {}),
          }}
        >
          <Rund src={bilder.produkte[p.id]} kante={m(44, 48)} />
          <div style={{ display: 'block', flexGrow: 1, flexShrink: 1, minWidth: 0, lineClamp: 1, fontSize: m(16), fontWeight: 600, color: F.tinte }}>{p.name}</div>
          <div style={{ display: 'flex', flexShrink: 0, fontSize: m(16), fontWeight: 600, color: F.gruen }}>{p.preis}</div>
        </div>
      ))}
    </div>
  )
}

function QuadratFuss({ daten, m }: { daten: TeilenBildDaten; m: Mass }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, gap: m(10) }}>
      {daten.abholTermin && (
        <div style={{ display: 'flex', alignItems: 'center', gap: m(12), padding: `${m(11)}px ${m(14)}px`, borderRadius: m(14), backgroundColor: F.streifen }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              width: m(36),
              height: m(36),
              borderRadius: m(10),
              backgroundColor: F.gruen,
            }}
          >
            <Kalender kante={m(18)} farbe={F.aufGruen} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
            <div style={kleineZeile(m(10.5), F.leise, m(1.2))}>Abholung am Hof</div>
            <div style={{ display: 'block', lineClamp: 1, fontSize: m(15.5), fontWeight: 600 }}>{daten.abholTermin}</div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: m(10) }}>
        <div style={{ display: 'block', lineClamp: 2, flexShrink: 1, minWidth: 0, fontSize: m(12), color: F.leise }}>{BESTELLEN}</div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            height: m(34),
            padding: `0 ${m(14)}px`,
            borderRadius: m(34),
            backgroundColor: F.gruen,
            color: F.aufGruen,
            fontSize: m(13),
            fontWeight: 600,
          }}
        >
          {daten.adresse}
        </div>
      </div>
    </div>
  )
}

/** Variante A „Marktkarte" — ohne Foto. */
function MarktKarte({
  daten,
  story,
  qr,
  bilder,
  marke,
  m,
}: {
  daten: TeilenBildDaten
  story: boolean
  qr: QrPfad
  bilder: GeladeneBilder
  marke: string
  m: Mass
}): React.JSX.Element {
  const { beitrag } = daten
  const mitProdukten = daten.produkte.length > 0
  const vorzeile = beitrag ? `${beitrag.anlass} · ${daten.hofName}` : mitProdukten ? 'Frisch diese Woche' : 'Direkt vom Hof'
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        backgroundColor: F.grund,
        color: F.tinte,
        fontFamily: 'Instrument Sans',
        padding: story ? `${m(0, 26)}px ${m(0, 26)}px ${m(0, 90)}px` : m(30),
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          display: 'flex',
          backgroundColor: F.gruen,
          ...(story ? { right: 0, height: m(0, 10) } : { bottom: 0, width: m(10) }),
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: m(10), marginTop: story ? m(0, 90) : 0 }}>
        <Marke m={m} aufFoto={false} marke={marke} />
        <div style={{ display: 'block', lineClamp: 1, flexShrink: 1, minWidth: 0, fontSize: m(11.5), color: F.leise }}>
          {story ? BESTELLEN : beitrag ? daten.ort : ''}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, marginTop: m(20, 26) }}>
        <div style={kleineZeile(m(11, 11.5), F.leise, m(1.6))}>{vorzeile}</div>
        {/* Höchstens zwei Zeilen mit „…" (Satori kappt nur mit display block + lineClamp). */}
        <div
          style={{
            display: 'block',
            lineClamp: 2,
            marginTop: m(6),
            fontFamily: 'Fraunces',
            fontSize: beitrag ? m(30, 36) : m(34, 40),
            lineHeight: beitrag ? 1.08 : 1.05,
            fontWeight: 600,
            color: F.gruen,
          }}
        >
          {beitrag ? beitrag.titel : daten.hofName}
        </div>
        {beitrag ? (
          <div style={{ display: 'block', lineClamp: 2, marginTop: m(8), fontSize: m(13.5, 15), lineHeight: 1.4, color: F.leise }}>{beitrag.text}</div>
        ) : daten.ort ? (
          <div style={{ display: 'block', lineClamp: 1, marginTop: m(4), fontSize: m(14, 15), color: F.leise }}>{`${daten.ort} · direkt vom Hof`}</div>
        ) : null}
      </div>
      {mitProdukten ? (
        <Zeilen produkte={daten.produkte.slice(0, zeilenMax(daten, story))} bilder={bilder} m={m} abstand={m(16, 22)} />
      ) : (
        <div style={{ display: 'flex', flexShrink: 0, marginTop: m(16, 22), fontSize: m(15, 16), lineHeight: 1.4, color: F.leise }}>
          Regional einkaufen und am Hof abholen.
        </div>
      )}
      <div style={{ display: 'flex', flexGrow: 1 }} />
      {story ? <QrStreifen daten={daten} qr={qr} m={m} aufFoto={false} /> : <QuadratFuss daten={daten} m={m} />}
    </div>
  )
}

/** Variante B „Foto-Held" — ein Foto trägt das Bild. */
function FotoHeld({
  daten,
  story,
  qr,
  bilder,
  held,
  marke,
  m,
}: {
  daten: TeilenBildDaten
  story: boolean
  qr: QrPfad
  bilder: GeladeneBilder
  held: string
  marke: string
  m: Mass
}): React.JSX.Element {
  const { beitrag } = daten
  const masse = TEILEN_BILD_MASSE[story ? 'story' : 'quadrat']
  const vorzeile = beitrag ? `${beitrag.anlass} · ${daten.hofName}` : daten.ort ? `${daten.hofName} · ${daten.ort}` : daten.hofName
  const titel = beitrag ? beitrag.titel : daten.produkte.length > 0 ? 'Frisch diese Woche' : 'Direkt vom Hof'
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', backgroundColor: F.tinte, color: F.grund, fontFamily: 'Instrument Sans' }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori (next/og) zeichnet nur <img>, next/image gibt es dort nicht */}
      <img src={held} alt="" width={masse.width} height={masse.height} style={{ position: 'absolute', left: 0, top: 0, width: masse.width, height: masse.height, objectFit: 'cover' }} />
      <div style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, display: 'flex', backgroundImage: story ? F.schleierStory : F.schleier }} />
      <div style={{ position: 'absolute', left: m(24), top: m(22, 100), display: 'flex' }}>
        <Marke m={m} aufFoto marke={marke} />
      </div>
      <div style={{ position: 'absolute', left: m(26), right: m(26), bottom: m(26, 120), display: 'flex', flexDirection: 'column', gap: m(12, 14) }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ ...kleineZeile(m(11, 11.5), F.fotoLeise, m(1.6)), textShadow: F.titelSchatten }}>{vorzeile}</div>
          <div
            style={{
              display: 'block',
              lineClamp: 2,
              marginTop: m(6),
              fontFamily: 'Fraunces',
              fontSize: m(32, 38),
              lineHeight: 1.06,
              fontWeight: 600,
              color: F.grund,
              textShadow: F.titelSchatten,
            }}
          >
            {titel}
          </div>
        </div>
        {daten.produkte.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: m(8) }}>
            {daten.produkte.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: m(8),
                  maxWidth: '100%',
                  height: m(40, 42),
                  padding: `0 ${m(12)}px 0 ${m(5)}px`,
                  borderRadius: m(42),
                  backgroundColor: F.cremeAufFoto,
                  color: F.tinte,
                  fontSize: m(13, 13.5),
                  fontWeight: 600,
                }}
              >
                <Rund src={bilder.produkte[p.id]} kante={m(30, 32)} />
                <div style={{ display: 'block', lineClamp: 1, flexShrink: 1, minWidth: 0 }}>{p.name}</div>
                <div style={{ display: 'flex', flexShrink: 0, color: F.gruen }}>{p.preis}</div>
              </div>
            ))}
          </div>
        )}
        {story ? (
          <QrStreifen daten={daten} qr={qr} m={m} aufFoto />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: m(6), paddingTop: m(12), borderTop: `${m(1)}px solid ${F.linieFoto}` }}>
            {daten.abholTermin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: m(8), fontSize: m(14), fontWeight: 600, color: F.grund }}>
                <Kalender kante={m(16)} farbe={F.fotoLeise} />
                <div style={{ display: 'flex' }}>{`Abholung ${daten.abholTermin}`}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: m(5), fontSize: m(12.5), color: F.fotoLeise }}>
              <div style={{ display: 'flex' }}>Online bestellen ·</div>
              <div style={{ display: 'flex', fontWeight: 600, color: F.grund }}>{daten.adresse}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function TeilenBildGrafik({
  daten,
  format,
  qr,
  bilder,
  marke,
}: {
  daten: TeilenBildDaten
  format: TeilenBildFormat
  qr: QrPfad
  bilder: GeladeneBilder
  /** Die Bildmarke (volle Fassung) als data-URL — `ladeMarkeDataUrl('voll')` in der Route. */
  marke: string
}): React.JSX.Element {
  const story = format === 'story'
  const m = massstab(story)
  return bilder.held ? (
    <FotoHeld daten={daten} story={story} qr={qr} bilder={bilder} held={bilder.held} marke={marke} m={m} />
  ) : (
    <MarktKarte daten={daten} story={story} qr={qr} bilder={bilder} marke={marke} m={m} />
  )
}
