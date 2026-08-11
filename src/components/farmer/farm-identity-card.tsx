'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Eye } from 'lucide-react'
import { hofInitialen } from '@/lib/hof-initialen'

/**
 * Hof-Identitätskarte am Kopf der Bauern-Navigation.
 *
 * Der Bauer tritt mit seinem Hof auf, nicht mit einem Konto — die Navigation
 * soll das zeigen. Deshalb steht der Hofname hier als größtes Textelement der
 * ganzen Leiste, mit Logo daneben und einer Vorschau-Schaltfläche darunter.
 *
 * Sie sitzt an ZWEI Stellen (Desktop-Seitenleiste und mobiles „Mehr"-Menü),
 * beide auf demselben dunkelgrünen Grund (#24523A) — deshalb genau eine
 * Farbfassung, keine Varianten.
 *
 * Was sie bewusst NICHT tut:
 *  - Sie zeigt nicht die öffentliche Hof-URL. Die trägt der Shop-Link-Balken
 *    (shop-link-banner.tsx) mit Kopieren und Teilen; hier führt die
 *    Schaltfläche in die Eigentümer-Vorschau /farm-page.
 *  - Sie ersetzt den Freigabe-Balken nicht. Der Punkt „Wartet auf
 *    Freischaltung" ist eine Zustandsanzeige an der Identität, die Erklärung
 *    samt Hof-ID und Rückfrage-Link bleibt beim Balken
 *    (pending-approval-banner.tsx).
 */
export function FarmIdentityCard({
  farmName,
  logoUrl,
  wartetAufFreigabe,
  onNavigate,
}: {
  farmName: string
  logoUrl: string | null
  wartetAufFreigabe: boolean
  /** Nur im mobilen Sheet gesetzt: der Klick muss es auch schließen. */
  onNavigate?: () => void
}) {
  const initialen = hofInitialen(farmName)

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-3 min-w-0">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt=""
            width={80}
            height={80}
            className="size-10 shrink-0 rounded-full object-cover"
            style={{ boxShadow: '0 0 0 1.5px rgba(255,255,255,0.25)' }}
          />
        ) : (
          /* Kein kaputtes Bild-Symbol: Initialen auf Sandfläche sehen aus wie
             eine Entscheidung, ein Platzhalter-Icon wie ein Fehler. */
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-full font-heading text-sm font-semibold"
            style={{ background: '#F2E5D3', color: '#8B6B4F' }}
            aria-hidden="true"
          >
            {initialen}
          </span>
        )}

        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'rgba(207,228,214,0.55)' }}>
            Mein Hof
          </div>
          {/* Größtes Textelement der Navigation. Kein truncate: ein langer
              Hofname darf bei 375px umbrechen, statt abgeschnitten zu werden —
              er ist der Name des Betriebs, nicht eine Beschriftung. */}
          <div
            className="font-heading text-[15px] font-semibold leading-snug break-words"
            style={{ color: '#F5F3EE' }}
          >
            {farmName}
          </div>
        </div>
      </div>

      {wartetAufFreigabe && (
        <div className="mt-2 flex items-center gap-1.5">
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ background: '#A9CFE3' }}
            aria-hidden="true"
          />
          <span className="text-[11px] leading-tight" style={{ color: 'rgba(207,228,214,0.75)' }}>
            Wartet auf Freischaltung
          </span>
        </div>
      )}

      {/* Outline-Stil auf dunklem Grund: heller Rahmen statt Fläche, damit die
          Schaltfläche nicht mit dem aktiven Menüpunkt (helle Fläche) verwechselt
          wird. min-h-11 = 44px — dasselbe Tippmaß wie die Menüpunkte der
          Seitenleiste; 36px waren am Telefon gemessen zu knapp. */}
      <Link
        href="/farm-page"
        onClick={onNavigate}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition-colors hover:bg-white/10"
        style={{ borderColor: 'rgba(255,255,255,0.28)', color: '#F5F3EE' }}
      >
        <Eye className="size-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
        Hofseite ansehen
      </Link>
    </div>
  )
}
