"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full bg-muted-foreground/30 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-checked:bg-primary disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        // Weiß in beiden Modi: Der Schieber liegt auf heller wie auf dunkler
        // Schiene; ein Token, das dem Modus folgt, verschwände auf einer davon.
        // Haarlinie, weil Weiß auf der grauen Aus-Schiene nur 1,5:1 erreicht und
        // der Schieber die Zustandsanzeige ist (CODING_STANDARDS §7: 3:1).
        className="block size-5 rounded-full bg-white shadow ring-1 ring-black/15 transition-transform data-unchecked:translate-x-0.5 data-checked:translate-x-[18px]"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
