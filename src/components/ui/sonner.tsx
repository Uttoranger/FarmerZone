"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, useSonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"
import { COOKIE_HINWEIS_RAND_PX, UNTEN_FEST_ATTRIBUT, cookieHinweisUnten, leistenMass, type LeistenMass } from "@/lib/cookie-hinweis"

/*
 * Die Meldung (Toast) nach G7 (Nr. 246; Liste Lauf 32, Abschnitt 3.2; Boards s1-/w1-bestellung Bild 2):
 * ein dunkler Balken unten, über der Unter- bzw. Aktionsleiste — nie oben, wo er die h1 verdeckte;
 * „Rückgängig" als oranger Textknopf. Hell `--fz-text`, dunkel `--fz-border` mit dem Feldrand als
 * Linie, Schrift `--fz-on-accent`; der Knopf `--fz-primary` hält auf beiden Flächen 4,5:1
 * (tests/bausteine-246.test.ts rechnet es aus globals.css nach). Ohne bunte Erfolgs-/Fehlerfarben:
 * Fehler gehören an Feld oder Formular (DESIGN_SYSTEM „Zustände"), der Toast ist nur die Bestätigung.
 */

/** Die Klassen des Balkens und seiner Teile — eine Quelle für Toaster, Vorschau und Test. */
export const TOAST_KLASSEN = {
  // `!`: sonner setzt Fläche, Rand und Schrift über eigene Selektoren höherer Spezifität.
  toast:
    "cn-toast min-h-[52px] rounded-[14px]! border! border-[var(--fz-text)]! bg-[var(--fz-text)]! text-[15px]! text-[var(--fz-on-accent)]! dark:border-[var(--fz-feldrand)]! dark:bg-[var(--fz-border)]!",
  actionButton:
    "min-h-11! bg-transparent! px-2! text-[15px]! font-bold! text-[var(--fz-primary)]! hover:underline! focus-visible:outline-2! focus-visible:outline-[var(--fz-on-accent)]!",
  cancelButton: "min-h-11! bg-transparent! px-2! text-[15px]! text-[var(--fz-on-accent)]!",
  closeButton: "border-[var(--fz-feldrand)]! bg-[var(--fz-text)]! text-[var(--fz-on-accent)]! dark:bg-[var(--fz-border)]!",
} as const

/** Wo der Balken steht: unten mittig, immer — auch wenn ein Aufrufer noch „oben" mitgibt (G7). */
export const TOAST_LAGE = "bottom-center" as const

/**
 * Die festen Leisten unten (Unterleiste, Aktionsleiste, Kaufknopf), wie sie gerade im Fenster liegen —
 * dieselbe Regel wie beim Cookie-Hinweis (src/lib/cookie-hinweis.ts): Der Balken steht über der höchsten.
 */
function festeLeisten(): LeistenMass[] {
  return Array.from(document.querySelectorAll<HTMLElement>(`[${UNTEN_FEST_ATTRIBUT}]`))
    .filter((el) => getComputedStyle(el).position === "fixed")
    .map((el) => leistenMass(el.getBoundingClientRect(), Array.from(el.querySelectorAll("*"), (teil) => teil.getBoundingClientRect())))
}

/**
 * Abstand vom unteren Rand, solange eine Meldung steht. Gemessen wird nur dann — ein ständiger
 * Beobachter auf dem ganzen Dokument kostete auf jeder Seite, auch ohne Meldung.
 */
function useAbstandUnten(aktiv: boolean): number {
  const [unten, setUnten] = useState(COOKIE_HINWEIS_RAND_PX)
  useEffect(() => {
    if (!aktiv) return
    let rahmen = 0
    const messen = () => {
      cancelAnimationFrame(rahmen)
      rahmen = requestAnimationFrame(() => setUnten(cookieHinweisUnten(festeLeisten(), window.innerHeight)))
    }
    messen()
    window.addEventListener("resize", messen)
    return () => {
      cancelAnimationFrame(rahmen)
      window.removeEventListener("resize", messen)
    }
  }, [aktiv])
  return unten
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const { toasts } = useSonner()
  const unten = useAbstandUnten(toasts.length > 0)

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // sonner bringt englische Screenreader-Texte mit („Notifications",
      // „Close toast") — hier deutsch, wie Dialog und Sheet („Schließen").
      containerAriaLabel="Benachrichtigungen"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      toastOptions={{
        classNames: TOAST_KLASSEN,
        closeButtonAriaLabel: "Schließen",
      }}
      {...props}
      // Nach dem Spread: Lage und Farbe legt G7 fest, nicht der einzelne Aufrufer (src/app/layout.tsx gibt
      // noch „top-center" und richColors mit; die Datei liegt außerhalb von Nr. 246).
      position={TOAST_LAGE}
      richColors={false}
      offset={{ bottom: unten }}
      mobileOffset={{ bottom: unten, left: 12, right: 12 }}
    />
  )
}

export { Toaster }
