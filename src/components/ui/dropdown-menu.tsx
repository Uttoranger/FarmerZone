"use client"

import * as React from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"

import { cn } from "@/lib/utils"
import { useMenueZiel } from "@/components/ui/menue-ziel"

/*
 * Das Aufklappmenü im shadcn-Stil über Base UI (wie sheet.tsx und dialog.tsx):
 * Tastatur — Enter oder Leertaste öffnet, Pfeile wandern, Esc schließt —,
 * Fokusführung und aria-Attribute kommen von Base UI. Hier nur Namen und
 * Aussehen; die Farben sind Tokens (bg-popover, border-border, bg-muted).
 * Dazu nimmt `DropdownMenuContent` den Fokuswächtern des offenen Menüs das
 * `aria-hidden` (`waechterFreigeben`, Axe „aria-hidden-focus“, Nr. 233).
 */

function DropdownMenu({ ...props }: MenuPrimitive.Root.Props): React.JSX.Element {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuTrigger({ ...props }: MenuPrimitive.Trigger.Props): React.JSX.Element {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

function DropdownMenuPortal({ ...props }: MenuPrimitive.Portal.Props): React.JSX.Element {
  return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
}

/** Das Merkmal, mit dem Base UI seine Fokuswächter kennzeichnet (unsichtbare `<span tabindex="0">`). */
export const FOKUS_WAECHTER = "data-base-ui-focus-guard"

/** Was `waechterFreigeben` von einem Kind braucht — ein Element, im Test eine Attrappe. */
export type WaechterKind = { hasAttribute(name: string): boolean; removeAttribute(name: string): void }
/** Ein Elternelement, dessen direkte Kinder Wächter sein können. */
export type WaechterOrt = { readonly children: ArrayLike<WaechterKind> }

/**
 * Nimmt den Fokuswächtern unter `orte` (nur direkte Kinder) das `aria-hidden` und gibt zurück, wie viele es waren.
 *
 * Warum (Axe „aria-hidden-focus“, 6 Knoten bei offenem Menü „Neu“, Nr. 233 UI-Runde 3): Base UI legt um Knopf, Portal
 * und Popup eines offenen Menüs je zwei Wächter — `<span tabindex="0" aria-hidden="true">`, die einen Tab sofort an
 * die richtige Stelle weiterreichen (aus dem Menü zurück hinter den Knopf). Fokussierbar und zugleich versteckt ist
 * genau, was Axe verbietet; hinter dem Menü ist sonst nichts versteckt. Ohne `aria-hidden` sind sie leere Stellen
 * ohne Inhalt, die den Fokus gleich weitergeben — so macht es Base UI in Safari selbst. Die Tab-Folge bleibt.
 * Andere Teile mit `aria-hidden` (Symbole, Pfeile) bleiben, wie sie sind.
 */
export function waechterFreigeben(orte: readonly (WaechterOrt | null | undefined)[]): number {
  let anzahl = 0
  for (const ort of orte) {
    if (!ort) continue
    for (const kind of Array.from(ort.children)) {
      if (kind.hasAttribute(FOKUS_WAECHTER) && kind.hasAttribute("aria-hidden")) {
        kind.removeAttribute("aria-hidden")
        anzahl += 1
      }
    }
  }
  return anzahl
}

/**
 * Wo die Wächter eines offenen Menüs liegen: neben dem Popup (im Positionierer) und neben seinem Knopf — dort stehen
 * auch die Wächter des Portals, denn sie entstehen an der Stelle des Menüs im Baum, nicht am Zielort. Den Knopf
 * findet `aria-controls` mit der ID des Popups. Die Wächter eines Dialogs ringsum gehören nicht dazu.
 */
function waechterOrte(popup: HTMLElement): (HTMLElement | null)[] {
  const knopf = popup.id ? popup.ownerDocument.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(popup.id)}"]`) : null
  return [popup.parentElement, knopf?.parentElement ?? null]
}

/** Einen Ref des Aufrufers bedienen — Funktion oder Objekt, wie React es erlaubt. */
function setzeRef<T>(ref: React.Ref<T> | undefined, wert: T | null): void {
  if (typeof ref === "function") ref(wert)
  else if (ref) ref.current = wert
}

/**
 * Hält die Wächter eines Menüs frei, solange sein Popup steht: einmal beim Einhängen und danach bei jedem neuen Kind
 * an diesen Orten — die Wächter des Portals kommen erst einen Durchgang nach dem Popup.
 *
 * `fremd` ist der Ref, den ein Aufrufer an `DropdownMenuContent` gibt: Er bekommt dasselbe Element mit — vorher
 * überschrieb er den Wächter-Ref (stand in `props` hinter `ref=`) und die Wächter blieben versteckt.
 */
function useWaechterFrei(fremd?: React.Ref<HTMLDivElement>): (popup: HTMLDivElement | null) => void {
  const beobachter = React.useRef<MutationObserver | null>(null)
  return React.useCallback(
    (popup: HTMLDivElement | null) => {
      setzeRef(fremd, popup)
      beobachter.current?.disconnect()
      beobachter.current = null
      if (!popup) return
      const orte = waechterOrte(popup)
      const freigeben = () => {
        waechterFreigeben(orte)
      }
      freigeben()
      const neu = new MutationObserver(freigeben)
      for (const ort of orte) if (ort) neu.observe(ort, { childList: true })
      beobachter.current = neu
    },
    [fremd]
  )
}

/**
 * `container` (Nr. 132): Wohin das Portal das Menü hängt. Ohne Angabe nimmt
 * es den Zielort der Shell aus dem Kontext (`MenueZielAnbieter`, ein Element
 * in ihrer Landmarke), ohne Anbieter wie bisher den `<body>` — also außerhalb
 * jeder Landmarke (Axe „region"). Das Ziel darf nicht in einem Kasten mit
 * `overflow` stecken, sonst wird das Menü abgeschnitten.
 */
function DropdownMenuContent({
  className,
  side = "bottom",
  align = "start",
  sideOffset = 6,
  alignOffset,
  container,
  ref,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, "side" | "align" | "sideOffset" | "alignOffset"> &
  Pick<MenuPrimitive.Portal.Props, "container">): React.JSX.Element {
  const menueZiel = useMenueZiel()
  const waechterFrei = useWaechterFrei(ref)
  return (
    <DropdownMenuPortal container={container === undefined ? (menueZiel ?? undefined) : container}>
      <MenuPrimitive.Positioner side={side} align={align} sideOffset={sideOffset} alignOffset={alignOffset} className="z-50 outline-none">
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "min-w-48 origin-(--transform-origin) rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg outline-none transition-[opacity,transform] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
            className
          )}
          {...props}
          // Nach den props: Der Ref des Aufrufers steckt in useWaechterFrei(ref), nichts überschreibt den Wächter-Ref.
          ref={waechterFrei}
        />
      </MenuPrimitive.Positioner>
    </DropdownMenuPortal>
  )
}

function DropdownMenuGroup({ ...props }: MenuPrimitive.Group.Props): React.JSX.Element {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
}

function DropdownMenuLabel({ className, ...props }: MenuPrimitive.GroupLabel.Props): React.JSX.Element {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      className={cn("px-2.5 py-1.5 text-xs font-semibold text-muted-foreground", className)}
      {...props}
    />
  )
}

// Mindesthöhe 44 px gilt für jedes Menü hier im Baustein, nie je Menü (Tippflächen, DESIGN_SYSTEM).
const ITEM =
  "flex min-h-11 cursor-default items-center gap-3 rounded-lg px-2.5 py-2 text-sm outline-none select-none data-disabled:opacity-50 data-highlighted:bg-muted"

function DropdownMenuItem({ className, ...props }: MenuPrimitive.Item.Props): React.JSX.Element {
  return <MenuPrimitive.Item data-slot="dropdown-menu-item" className={cn(ITEM, className)} {...props} />
}

/** Ein Eintrag, der eine Seite öffnet — mit `render={<Link href=… />}` als Next-Link. */
function DropdownMenuLinkItem({ className, ...props }: MenuPrimitive.LinkItem.Props): React.JSX.Element {
  return (
    <MenuPrimitive.LinkItem data-slot="dropdown-menu-link-item" closeOnClick className={cn(ITEM, className)} {...props} />
  )
}

function DropdownMenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props): React.JSX.Element {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1.5 my-1.5 h-px bg-border", className)}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
}
