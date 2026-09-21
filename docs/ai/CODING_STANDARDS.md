# CODING_STANDARDS

Bei **jeder** Codeänderung lesen.

---

## 1. Namen

| Gegenstand | Konvention | Beispiel |
|---|---|---|
| Datei | `kebab-case.ts` | `order-totals.ts` |
| React-Komponente (Datei) | `kebab-case.tsx` | `cart-sheet.tsx` |
| React-Komponente (Name) | `PascalCase` | `CartSheet` |
| Hook | `use-*.ts` / `useX` | `use-cart.ts` |
| Funktion | `camelCase`, Verb zuerst | `pruefeWarenkorb` |
| Typ / Interface | `PascalCase`, kein `I`-Präfix | `WarenkorbPosition` |
| Konstante | `SCREAMING_SNAKE_CASE` | `RESERVIERUNG_TTL_MS` |
| Zod-Schema | `*Schema` | `checkoutSchema` |
| Test | `<thema>.test.ts` | `reservierung.test.ts` |

### Sprache in Bezeichnern
- **Fachbegriffe deutsch**, wenn die Domäne deutsch ist: `reservierung`, `warenkorb`, `hof`, `abholung`, `servicegebuehr`. Das ist die gewachsene Konvention der neueren Dateien — fortführen.
- **Technische Begriffe englisch**: `route`, `handler`, `schema`, `token`, `client`.
- **Prisma-Modelle und -Felder bleiben englisch** (`Order`, `stock`, `expiresAt`). Nicht umbenennen.
- **Nie mischen innerhalb eines Bezeichners**: `pruefeWarenkorb` ✅, `checkWarenkorb` ❌.
- Umlaute in Dateinamen und Bezeichnern ausschreiben: `servicegebuehr`, nicht `servicegebühr`.

---

## 2. Typisierung

- `any` ist **verboten**. Auch `as any`, `@ts-ignore`, `@ts-expect-error` ohne Begründungskommentar.
- Unbekanntes ist `unknown` + Zod-Parse, nie `any`.
- Rückgabetyp bei exportierten Funktionen **explizit** annotieren.
- Keine nicht-null-Assertion `!`, außer mit Kommentar, warum es sicher ist.
- Typen aus Prisma ableiten, nicht abschreiben: `Prisma.OrderGetPayload<…>`.
- Keine Typduplikate: Zod-Schema ist die Quelle → `type X = z.infer<typeof xSchema>`.

### Geld
- Prisma speichert Preise als `Decimal(10,2)`.
- **Nie** `Number(decimal)` für Rechnungen, die addiert oder multipliziert werden. Rundungsfehler landen auf der Rechnung des Hofs.
- Rechnen in den vorhandenen Helfern: `src/lib/order-totals.ts`, `src/lib/servicegebuehr.ts`.
- Anzeigen ausschließlich über `src/lib/format.ts` (`formatEuro`, `formatMenge`, `formatPosition`).
- Nie ein eigenes Preisformat erfinden. Nie `toFixed(2) + ' €'`.

### Serialisierung an Client-Komponenten
- `Decimal` und `Date` nicht roh übergeben.
- `Decimal` → in der Query in `string` oder bereits formatiert wandeln.
- `Date` → `toISOString()` oder fertig formatiert.

---

## 3. Validierung an Systemgrenzen

Systemgrenze = API-Route, Server Action, Webhook, URL-Parameter, `localStorage`, externe Antwort.

- **Jede** Systemgrenze validiert mit Zod. Ohne Ausnahme.
- Schemas liegen in `src/schemas/` und werden von Client **und** Server benutzt.
- Clientseitige Validierung ist Komfort, nie Schutz. Serverseitig immer erneut prüfen.
- In API-Routen `safeParse` (Antwort bauen), in Server Actions `parse` oder `safeParse` mit `{ error }`.
- `localStorage`-Inhalte (Warenkorb!) sind Fremddaten: parsen, validieren, bei Bruch verwerfen.

---

## 4. Fehlerbehandlung

### Server Action
```ts
export async function tuWas(input: unknown): Promise<{ ok: true } | { error: string }>
```
- Erwartbarer Fehler → `return { error: 'Verständlicher deutscher Satz.' }`
- Unerwarteter Fehler → werfen lassen, Sentry fängt ihn.
- **Nie** `catch {}` ohne Behandlung. **Nie** einen Fehler verschlucken und `{ ok: true }` zurückgeben.

### API-Route
```ts
// Fehler
NextResponse.json({ error: 'Deutscher Satz.', code: 'MASCHINENLESBAR' }, { status: 4xx })
// Erfolg
NextResponse.json({ ok: true, …daten })
```
- `code` setzen, wenn der Browser zwischen Fällen unterscheiden muss (Vorbild: `RESERVIERUNG_ABGELAUFEN`).
- Statuscodes: 400 Validierung, 401 nicht angemeldet, 403 kein Zugriff, 404 nicht gefunden, 409 Konflikt, 429 Rate-Limit, 500 unerwartet.
- **Nie** interne Details nach außen geben: kein Stacktrace, kein SQL, kein Prisma-Fehlertext, keine ID fremder Datensätze.

### Nutzertexte
- Deutsch, geduzt, ohne Fachjargon, mit Ausweg.
- ✅ "Deine Reservierung ist abgelaufen. Wir haben die Verfügbarkeit neu geprüft."
- ❌ "Reservation expired", "Fehler 500", "Constraint violation".

### Konsistenz bei Teilfehlschlag
- Mehrere Schreibvorgänge, die zusammengehören → `prisma.$transaction`.
- Geht das nicht (externer Dienst dazwischen): Kompensation schreiben, wie beim Bestandsabzug.
- Nichts Langsames im Antwortpfad → `nachDerAntwort()`.

---

## 5. Kommentare

- Deutsch. Erklären **warum**, nie was.
- Pflicht bei: nicht offensichtlicher Fachregel, bewusster Abweichung, bekannter Einschränkung, Sicherheitsentscheidung.
- Verboten: auskommentierter Code, `TODO` ohne Namen und Datum, Kommentare, die den Code wiederholen.

---

## 6. Bad vs. Good

### Beispiel 1 — Geld und Formatierung

```ts
// ❌ BAD
const gesamt = Number(order.totalAmount) * 1.049          // Rundungsfehler, Gebühr hart verdrahtet
return <span>{gesamt.toFixed(2)} €</span>                 // eigenes Format, falsche Reihenfolge
```

```ts
// ✅ GOOD
import { berechneServicegebuehr } from '@/lib/servicegebuehr'
import { formatEuro } from '@/lib/format'

const { gesamtCents } = berechneServicegebuehr({
  warenpreis: order.totalAmount,
  prozent: farm.serviceFeePercent,
  minCents: farm.serviceFeeMinCents,
})
return <span>{formatEuro(gesamtCents / 100)}</span>       // € 10,49
```

### Beispiel 2 — Server Action ohne Besitzprüfung

```ts
// ❌ BAD
'use server'
export async function updateStock(productId: string, stock: number) {
  await prisma.product.update({ where: { id: productId }, data: { stock } })
}
// Nicht eingeloggt? Egal. Fremdes Produkt? Egal. Eingabe ungeprüft. Kein revalidate.
```

```ts
// ✅ GOOD
'use server'
export async function updateStock(
  input: unknown
): Promise<{ ok: true } | { error: string }> {
  const v = updateStockSchema.safeParse(input)
  if (!v.success) return { error: 'Ungültige Eingabe.' }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Bitte melde dich neu an.' }

  const farm = await getFarmForUser(session.user.id)
  if (!farm) return { error: 'Kein Hof gefunden.' }

  // Besitz in der WHERE-Klausel, nicht in einem vorherigen if — sonst
  // besteht zwischen Prüfung und Schreiben eine Lücke.
  const { count } = await prisma.product.updateMany({
    where: { id: v.data.productId, farmId: farm.id },
    data: { stock: v.data.stock },
  })
  if (count === 0) return { error: 'Produkt nicht gefunden.' }

  revalidatePath('/products')
  revalidatePath(`/${farm.slug}`)
  return { ok: true }
}
```

### Beispiel 3 — Fachregel in der Komponente

```tsx
// ❌ BAD — Frist lebt im JSX, nicht testbar, nur im Browser wirksam
{Date.now() - new Date(res.createdAt).getTime() < 900_000 && (
  <span>Reserviert</span>
)}
```

```ts
// ✅ GOOD — Entscheidung in src/lib/reservierung.ts, rein und testbar
export function istGueltig(reservierung: EigeneReservierung, jetzt: Date): boolean {
  return reservierung.expiresAt.getTime() > jetzt.getTime()
}
```
```tsx
// Komponente zeigt nur an, was der Server entschieden hat
{position.zustand === 'ok' && <span>Reserviert</span>}
```

---

## 7. Farben

Es gibt **zwei Modi**: hell und dunkel (`next-themes`, Klasse `dark` am `<html>`).
Jede Farbe muss in beiden funktionieren.

### Grundregel
- **Keine Farbe hart in eine Komponente schreiben.** Kein `#2D5F3F`, kein
  `bg-slate-700`, kein `style={{ color: '…' }}`. Farben kommen aus Tokens in
  `src/app/globals.css` (`:root` = hell, `.dark` = dunkel).
- Tokens werden in **oklch** geschrieben, nie in Hex. Der Hex-Wert darf als
  Kommentar danebenstehen.
- Beim Ersetzen einer alten Hex-Farbe: das Token nehmen, das im **hellen** Modus
  denselben Wert hat. `bg-white` auf einer Karte wird `bg-card`, **nicht**
  `bg-background`. Passt kein Token: **fragen**, nicht raten.

### Welches Token wofür

| Zweck | Token |
|---|---|
| Seitengrund | `background` |
| Fläche einer Karte, eines Dialogs | `card` / `popover` |
| Fließtext | `foreground`, leiser: `muted-foreground` |
| Hauptknopf (Fläche) | `primary` + `primary-foreground` |
| **Markenfarbe für Text und Symbole** | **`brand-text`** |
| Handlungsknopf (CTA, max. 1× pro Seite) | `accent` + `accent-foreground`, Hover `accent-hover` |
| Rahmen, Trennlinien | `border`, Eingabefelder `input` |
| Fokusring | `ring` |

Hofseite, Produktraster und Bauern-Bereich tragen zusätzlich die gewachsene
Palette `--app-*` (`app-page`, `app-ink`, `app-ink-soft`, `app-ink-faint`,
`app-chip`, `app-chip-ink`, `app-chip-green`, `app-line-firm`, `app-button`,
`app-bar`, `app-trough`) und den Hinweis-Kasten `--notice*`. Wer dort etwas neu
baut, nimmt diese Tokens — nicht `foreground`/`card`, sonst stehen zwei
Grautöne nebeneinander. Begründung in `DEVELOPMENT.md`.

**`--brand-text` ist neu und nicht dasselbe wie `--primary`.** `--primary` ist die
*Fläche* des Hauptknopfs und wird im Dunkeln hell (heller Salbei, damit dunkle
Schrift darauf sitzt). Markentext braucht den umgekehrten Weg: hell ist er das
dunkle Waldgrün, dunkel ist er ein helles Salbeigrün. Im **hellen** Modus sind
beide Werte identisch — der Unterschied entsteht erst im Dunkeln. Also:
`text-brand-text` für Überschriften, Wortmarke, Symbole; `bg-primary` für Flächen.

### Tiefe
Im Dunkeln trägt der **Rahmen**, nicht der Schatten: Ein Schatten auf fast
schwarzem Grund ist unsichtbar. Karten bekommen dort `dark:ring-1 dark:ring-border`.

### Bedeutungsfarben (grün/bernstein/rot)
Für „erledigt", „Achtung", „schiefgegangen" gibt es außer `destructive` **kein**
Token. Hier bleibt der helle Wert stehen und bekommt eine `dark:`-Entsprechung:

```tsx
// ✅ GOOD — heller Wert unverändert, dunkler Wert ergänzt
<div className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200">
```

Keine neuen Bedeutungs-Tokens erfinden, ohne zu fragen — das wäre ein neues
Farbschema.

### Was dem Modus NICHT folgt
Fotos und Hof-Banner werden nicht abgedunkelt. Schleier über Fotos, weiße
Schrift auf Fotos, Kartenkacheln samt Pins (siehe `hoefe-karte.tsx`), die
Bildmarke und fremde Markenfarben (WhatsApp-Grün, Stripes Eingabemaske) bleiben,
wie sie sind. Wo das so ist, gehört ein Kommentar daneben, der es begründet.

### Diagramme
Recharts schreibt Farben als SVG-Attribute — `var(--token)` greift dort **nicht**.
Farbsätze je Modus in JavaScript halten und über `resolvedTheme` (next-themes)
umschalten. Nur `contentStyle`/`labelStyle`/`itemStyle` des Tooltips sind
React-Style-Objekte; dort gehören die Tokens hin.

### Kontrast
Fließtext ≥ 4,5:1, große Schrift und Symbole ≥ 3:1 — **in beiden Modi** messen,
gegen `background` **und** gegen `card`.

---

## 8. Checkliste vor dem Bericht

- [ ] Kein `any`, kein `@ts-ignore`, keine unbegründete `!`-Assertion
- [ ] Zod an jeder neuen Systemgrenze
- [ ] Auth **und** Besitzprüfung in jeder schreibenden Server Action
- [ ] Besitz in der `WHERE`-Klausel, nicht in einem vorgelagerten `if`
- [ ] Geld über die Helfer, Anzeige über `format.ts`
- [ ] Fehlermeldungen deutsch, geduzt, mit Ausweg
- [ ] `revalidatePath` für jede betroffene Route
- [ ] Nichts Langsames im Antwortpfad
- [ ] `Decimal`/`Date` nicht roh an Client-Komponenten
- [ ] Keine harte Farbe im Bauteil; in beiden Modi angesehen (→ Abschnitt 7)
- [ ] `pnpm typecheck && pnpm lint && pnpm test` grün
