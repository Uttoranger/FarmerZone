"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
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
 *
 * Nur im Geltungsbereich data-design="neu" (Runde 1): Der Toaster hängt im Root-Layout, also auf jeder
 * Route. Das Redesign kommt Route für Route (CLAUDE.md §2, kein Big Bang) — G7 gilt deshalb nur, wenn die
 * aktuelle Seite die Marke trägt (dieselbe wie in globals.css); ohne sie bleibt der Bestand, mit Lage und
 * Farben vom Aufrufer (src/app/layout.tsx: oben mittig, richColors).
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

/** Wo der Balken im Geltungsbereich steht: unten mittig — auch wenn ein Aufrufer noch „oben" mitgibt (G7). */
export const TOAST_LAGE = "bottom-center" as const

/** Die Marke des neuen Designs — dieselbe, an der globals.css die Tokens im ganzen Dokument umschaltet. */
const NEUES_DESIGN = '[data-design="neu"]'

const ohneAbo = () => () => {}
const liesNeuesDesign = () => document.querySelector(NEUES_DESIGN) !== null
const vomServer = () => false

/**
 * Ob die aktuelle Seite im Geltungsbereich data-design="neu" steht. Kein Abo auf das Dokument: Gelesen wird bei
 * jedem Zeichnen des Toasters, und der zeichnet neu, sobald eine Meldung kommt oder geht — nur dann zählt die
 * Gestalt. Vom Server und beim Hydrieren `false` (tests/hydrieren.test.ts); dann steht ohnehin keine Meldung.
 */
export function useImNeuenDesign(): boolean {
  return useSyncExternalStore(ohneAbo, liesNeuesDesign, vomServer)
}

/** Der Bestand außerhalb des Geltungsbereichs (Stand vor Nr. 246): Fläche aus den shadcn-Variablen. */
const BESTAND_STIL = {
  "--normal-bg": "var(--popover)",
  "--normal-text": "var(--popover-foreground)",
  "--normal-border": "var(--border)",
  "--border-radius": "var(--radius)",
} as React.CSSProperties

/**
 * Was der Toaster außer Theme und Symbolen bekommt. Außerhalb: der Bestand, Lage und richColors vom Aufrufer.
 * Innen: G7 — Lage und Farbe stehen NACH den Aufrufer-Props, sie legt der Baustein fest, nicht das Layout.
 */
export function toastEinstellung(neu: boolean, props: ToasterProps, unten: number): ToasterProps {
  if (!neu) return { style: BESTAND_STIL, toastOptions: { classNames: { toast: "cn-toast" }, closeButtonAriaLabel: "Schließen" }, ...props }
  return {
    toastOptions: { classNames: TOAST_KLASSEN, closeButtonAriaLabel: "Schließen" },
    ...props,
    position: TOAST_LAGE,
    richColors: false,
    offset: { bottom: unten },
    mobileOffset: { bottom: unten, left: 12, right: 12 },
  }
}

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
  const neu = useImNeuenDesign()
  const unten = useAbstandUnten(neu && toasts.length > 0)

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
      {...toastEinstellung(neu, props, unten)}
    />
  )
}

export { Toaster }
