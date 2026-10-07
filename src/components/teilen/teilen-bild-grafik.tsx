import type { TeilenBildDaten } from '@/lib/teilen-bild'
import type { TeilenBildFormat } from '@/lib/teilen-kanal'
import type { QrPfad } from '@/lib/qr-code'

/*
 * Das Teilen-Bild als Satori-Grafik (next/og, Gate 7 Aufgabe 1; Mockups
 * web-h4-teilen-fenster-mit-bild, mobil-h4-teilen-ueber-das-telefon,
 * mobil-k1-ueber-einen-geteilten-link). Nur Darstellung: Was hineinkommt,
 * entscheidet `teilenBildDaten` (src/lib/teilen-bild.ts).
 *
 * Satori kennt keine CSS-Variablen und keine Klassen — die Farben stehen
 * deshalb hier als Werte, genau die Token-Werte aus docs/ai/DESIGN_SYSTEM.md
 * (dunkles Theme, wie das Mockup; ein Bild hat kein Theme, es wird
 * verschickt). Jede Zeile mit eigener Ausnahme für die Lint-Regel.
 * Alles Fremde (Hof-, Produkt-, Ortsname) steht nur als Text-Kind, nie als
 * HTML — Satori setzt Text, es parst nichts.
 */
const FARBE = {
  // eslint-disable-next-line no-restricted-syntax -- Satori (next/og) kennt keine CSS-Variablen; Grün-Verlauf aus --accent wie im Mockup
  grund: 'linear-gradient(160deg, #24432f 0%, #2e6b45 55%, #1a3324 100%)',
  // eslint-disable-next-line no-restricted-syntax -- Satori: --text (dunkles Theme)
  text: '#f1eee3',
  // eslint-disable-next-line no-restricted-syntax -- Satori: helles Salbei aus dem Mockup (--status-fertig, aufgehellt) für Zweittext auf Grün
  leise: '#c9e4d2',
  // eslint-disable-next-line no-restricted-syntax -- Satori: --bg (dunkel) mit 55 % Deckkraft als Zeilenfläche auf dem Verlauf
  zeile: 'rgba(11,16,12,0.55)',
  // eslint-disable-next-line no-restricted-syntax -- Satori: helles Salbei mit 22 % Deckkraft als Platzhalter-Kachel der Produkte
  kachel: 'rgba(201,228,210,0.22)',
  // eslint-disable-next-line no-restricted-syntax -- Satori: --surface (hell) als ruhiger Grund des QR-Codes, damit jede Kamera ihn liest
  qrGrund: '#fbf9f2',
  // eslint-disable-next-line no-restricted-syntax -- Satori: --text (hell) für die dunklen QR-Module
  qrModul: '#1c241d',
} as const

/** Maßstab gegenüber dem Mockup (340 px breit) auf 1080 px. */
const M = 1080 / 340

const px = (n: number): number => Math.round(n * M)

export function TeilenBildGrafik({
  daten,
  format,
  qr,
}: {
  daten: TeilenBildDaten
  format: TeilenBildFormat
  qr: QrPfad
}): React.JSX.Element {
  const story = format === 'story'
  const mitProdukten = daten.produkte.length > 0
  const qrKante = px(story ? 64 : 46)
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundImage: FARBE.grund,
        color: FARBE.text,
        padding: px(story ? 26 : 18),
        gap: px(story ? 14 : 9),
      }}
    >
      <div
        style={{
          display: 'flex',
          fontSize: px(story ? 13 : 10.5),
          fontWeight: 700,
          letterSpacing: px(1.4),
          textTransform: 'uppercase',
          color: FARBE.leise,
          marginTop: story ? px(40) : 0,
        }}
      >
        {mitProdukten ? 'Frisch diese Woche' : 'Direkt vom Hof'}
      </div>
      {/* Höchstens zwei Zeilen mit „…" (Satori kappt nur mit display block + lineClamp). */}
      <div
        style={{
          display: 'block',
          lineClamp: 2,
          wordBreak: 'break-word',
          fontSize: px(story ? 34 : 25),
          fontWeight: 700,
          lineHeight: 1.08,
        }}
      >
        {daten.hofName}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: px(story ? 8 : 5), marginTop: px(story ? 14 : 2) }}>
        {mitProdukten ? (
          daten.produkte.map((p) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: px(8),
                padding: `${px(story ? 9 : 6)}px ${px(8)}px`,
                backgroundColor: FARBE.zeile,
                borderRadius: px(9),
              }}
            >
              <div style={{ display: 'flex', width: px(22), height: px(22), borderRadius: px(6), backgroundColor: FARBE.kachel }} />
              <div
                style={{
                  display: 'block',
                  flex: 1,
                  minWidth: 0,
                  lineClamp: 1,
                  wordBreak: 'break-word',
                  fontSize: px(story ? 14 : 12),
                  fontWeight: 600,
                }}
              >
                {p.name}
              </div>
              <div style={{ display: 'flex', fontSize: px(story ? 13 : 11), color: FARBE.leise }}>{p.preis}</div>
            </div>
          ))
        ) : (
          <div style={{ display: 'flex', fontSize: px(story ? 15 : 12.5), color: FARBE.leise, lineHeight: 1.4 }}>
            Regional einkaufen und am Hof abholen.
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexGrow: 1 }} />
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: px(10) }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: px(2) }}>
          {daten.abholung && (
            <div style={{ display: 'flex', fontSize: px(story ? 14 : 11.5), fontWeight: 600 }}>{daten.abholung}</div>
          )}
          <div style={{ display: 'block', lineClamp: 2, wordBreak: 'break-word', fontSize: px(story ? 12 : 10), color: FARBE.leise }}>
            {daten.ort ? `${daten.ort} · ${daten.adresse}` : daten.adresse}
          </div>
        </div>
        <div style={{ display: 'flex', padding: px(5), backgroundColor: FARBE.qrGrund, borderRadius: px(8) }}>
          <svg width={qrKante} height={qrKante} viewBox={`-2 -2 ${qr.groesse + 4} ${qr.groesse + 4}`}>
            <path d={qr.pfad} fill={FARBE.qrModul} />
          </svg>
        </div>
      </div>
    </div>
  )
}
