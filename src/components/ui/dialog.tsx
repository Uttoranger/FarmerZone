"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { MenueZielAnbieter } from "@/components/ui/menue-ziel"
import { FOKUS_RAHMEN } from "@/components/ui/fokus"
import { XIcon } from "lucide-react"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/8 dark:bg-black/60 backdrop-blur-[2px] duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      {/* Kein Ziel der Shell: Ein Menü im modalen Dialog bleibt im Popup (Nr. 140, menue-ziel.tsx). */}
      <MenueZielAnbieter ziel={null}>
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-3xl bg-popover p-6 text-sm text-popover-foreground shadow-[0_16px_40px_oklch(0.18_0.03_150_/_0.12)] ring-1 ring-border/60 duration-150 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              render={
                // 44-px-Knopf, der sichtbare Kreis von 28 px als Span darin
                // (DESIGN_SYSTEM „Qualität"): Die Mitte bleibt, wo das alte
                // Kreuz saß, die Trefferfläche wächst.
                <Button
                  variant="ghost"
                  className="absolute top-0 right-0 rounded-full hover:bg-transparent dark:hover:bg-transparent"
                  size="icon"
                />
              }
            >
              <span
                data-slot="schliessen-kreis"
                aria-hidden="true"
                className="flex size-7 items-center justify-center rounded-full transition-colors group-hover/button:bg-muted"
              >
                <XIcon />
              </span>
              <span className="sr-only">Schließen</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Popup>
      </MenueZielAnbieter>
    </DialogPortal>
  )
}

/**
 * Der Text des einen Schließen-Elements, wenn der Aufrufer keinen eigenen nennt
 * (DESIGN_SYSTEM „Dialoge und Blätter"; deutsch, nie „Close").
 */
const SCHLIESSEN_TEXT = "Schließen"

/**
 * Zentrierter Dialog im Web (Register N41 d, DESIGN_SYSTEM „Dialoge und
 * Blätter"; Boards w1-bestellung, w1-produkte): höchstens 560 px breit, in der
 * Mitte über abgedunkeltem Grund, Ecken 20 px. Oben der Titel links und GENAU
 * EIN Schließen-Element rechts — ein Textknopf mit 44 px („Schließen" oder
 * „Abbrechen"), kein zusätzliches Kreuz. Darunter der Inhalt; Aktionen setzt
 * der Aufrufer ans Ende (Hauptaktion orange im Hofbereich, grün bei der
 * Kundschaft). Eine zusätzliche Variante — DialogContent bleibt, wie es ist.
 * Am Handy nimmt der Aufrufer das Blatt (SheetBlatt); ist der Inhalt höher als
 * das Fenster, scrollt der Dialog innen.
 *
 * Startfokus (Nr. 246): Fragt der Dialog nach etwas, das sich nicht mit einem
 * Tipp zurücknehmen lässt (löschen, stornieren, pausieren, stilllegen — der
 * Hauptknopf ist orange), setzt der Aufrufer `initialFocus` auf „Abbrechen“.
 * Wache tests/startfokus-wache.test.ts (Bestandsliste, die nur schrumpft).
 */
function DialogMitte({
  className,
  children,
  titel,
  schliessen = SCHLIESSEN_TEXT,
  aktionen,
  ...props
}: DialogPrimitive.Popup.Props & {
  /** Der Name des Dialogs, als h2 links oben. */
  titel: React.ReactNode
  /** Der Text des einen Schließen-Elements. */
  schliessen?: string
  /**
   * Die Aktionen am Ende des Dialogs, gleich breit nebeneinander (Board w2-kundenkonto, Bild 4: „Abbrechen“ |
   * „Konto löschen“; seit Nr. 242). Dann trägt eine davon das eine Schließen-Element („Abbrechen“, als
   * `DialogClose` oder Knopf mit Handler), und der Kopf hat keinen eigenen Knopf — sonst stünden zwei da.
   */
  aktionen?: React.ReactNode
}) {
  return (
    <DialogPortal>
      {/* Hell die Textfarbe zu 55 % (Boards: rgba(28,36,29,.55)), dunkel bleibt der Schleier von DialogOverlay. */}
      <DialogOverlay className="bg-foreground/55 backdrop-blur-none" />
      <MenueZielAnbieter ziel={null}>
        <DialogPrimitive.Popup
          data-slot="dialog-mitte"
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[560px] -translate-x-1/2 -translate-y-1/2 flex-col gap-2.5 overflow-y-auto rounded-[20px] bg-popover px-7 pt-6 pb-7 text-[15px] text-popover-foreground shadow-xl ring-1 ring-border/60 duration-150 outline-none *:shrink-0 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          <div data-slot="dialog-mitte-kopf" className="flex items-start justify-between gap-2">
            <DialogPrimitive.Title data-slot="dialog-title" className="min-w-0 pt-2 font-heading text-[21px] leading-tight font-semibold text-foreground">
              {titel}
            </DialogPrimitive.Title>
            {aktionen === undefined && (
              <DialogPrimitive.Close
                data-slot="dialog-close"
                className={cn(
                  "-mr-2 inline-flex min-h-11 shrink-0 items-center rounded-full px-2 text-[15px] font-semibold text-foreground hover:bg-muted",
                  FOKUS_RAHMEN
                )}
              >
                {schliessen}
              </DialogPrimitive.Close>
            )}
          </div>
          {children}
          {aktionen !== undefined && (
            <div data-slot="dialog-mitte-aktionen" className="mt-2 grid auto-cols-fr grid-flow-col gap-2.5">
              {aktionen}
            </div>
          )}
        </DialogPrimitive.Popup>
      </MenueZielAnbieter>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-6 -mb-6 flex flex-col-reverse gap-2 rounded-b-3xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Schließen
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogMitte,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
