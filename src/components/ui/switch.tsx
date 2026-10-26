"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    // Aus-Zustand in --input (im neuen Design --fz-feldrand, ≥ 3:1 auf Grund und
    // Fläche): Mit muted-foreground/30 lag die Schiene bei 1,5:1 und war als
    // Bedienelement kaum zu sehen (WCAG 1.4.11).
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full bg-input transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-checked:bg-primary disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        // Weiß in beiden Modi: Der Schieber liegt auf heller wie auf dunkler
        // Schiene; ein Token, das dem Modus folgt, verschwände auf einer davon.
        className="block size-5 rounded-full bg-white shadow transition-transform data-unchecked:translate-x-0.5 data-checked:translate-x-[18px]"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
