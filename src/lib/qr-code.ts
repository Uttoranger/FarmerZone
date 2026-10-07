/**
 * QR-Code als SVG-Pfad (Gate 7: klein im Teilen-Bild, groß auf dem Plakat) —
 * rein, ohne DOM. Das Paket `qrcode` rechnet nur die Matrix (Freigabe §3);
 * gezeichnet wird hier selbst, damit Satori (next/og) und das Plakat
 * dieselbe Form bekommen und keine fremde Grafik ins Bild kommt.
 *
 * Der Pfad hat die Einheit „ein Modul" und lässt den Ruhebereich weg: Wer ihn
 * zeichnet, setzt `viewBox="0 0 groesse groesse"` und legt den hellen Rand
 * (mindestens vier Module laut Norm) als Innenabstand darum.
 */
import QRCode from 'qrcode'

export type QrPfad = { groesse: number; pfad: string }

/**
 * Fehlerkorrektur M (15 %): reicht für einen gedruckten Aushang mit Knick
 * oder Fleck, ohne die Module für eine kurze Adresse unnötig klein zu machen.
 */
export function qrPfad(text: string): QrPfad {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const groesse = modules.size
  const teile: string[] = []
  for (let y = 0; y < groesse; y++) {
    let x = 0
    while (x < groesse) {
      if (!modules.get(y, x)) {
        x++
        continue
      }
      // Dunkle Module einer Zeile zu EINEM Rechteck zusammenfassen: kürzerer
      // Pfad, keine Haarlinien zwischen Nachbarn beim Skalieren.
      const start = x
      while (x < groesse && modules.get(y, x)) x++
      teile.push(`M${start} ${y}h${x - start}v1h-${x - start}z`)
    }
  }
  return { groesse, pfad: teile.join('') }
}
