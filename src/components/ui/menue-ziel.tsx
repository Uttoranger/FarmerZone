'use client'

import * as React from 'react'

/*
 * Der Zielort für das Portal der Menüs (Regelvorschlag 132 aus Morgenbericht 20, freigegeben 21.10.2026).
 *
 * Base UI hängt den Inhalt eines Aufklappmenüs an den <body> — außerhalb jeder Landmarke (Axe „region").
 * Eine Shell stellt deshalb ein Element in ihrer Landmarke bereit und gibt es mit `MenueZielAnbieter` an
 * alle Menüs darunter weiter; `DropdownMenuContent` nimmt es, wenn kein `container` übergeben ist.
 * Ohne Anbieter bleibt es beim <body>, wie vor Nr. 132.
 *
 * `ziel={null}` heißt „kein Ziel“ und gilt für alles darunter: In einem modalen Dialog oder Blatt muss ein Menü
 * im Popup bleiben — das Ziel der Shell läge außerhalb und wäre mit der übrigen Seite gesperrt.
 */

export type MenueZiel = React.RefObject<HTMLElement | null>

const MenueZielKontext = React.createContext<MenueZiel | null>(null)

/** Stellt das Ziel für die Menüs bereit, die darunter rendern (`null`: dort kein Ziel, das Menü hängt am <body>). */
export function MenueZielAnbieter({ ziel, children }: { ziel: MenueZiel | null; children: React.ReactNode }): React.JSX.Element {
  return <MenueZielKontext.Provider value={ziel}>{children}</MenueZielKontext.Provider>
}

/** Das Ziel des nächsten Anbieters darüber; `null` ohne Anbieter oder unter einem Anbieter mit `ziel={null}`. */
export function useMenueZiel(): MenueZiel | null {
  return React.useContext(MenueZielKontext)
}
