# Morgenbericht Lauf 29 (2.11.2026) · Gewährleistungs-Mitteilung, Kaufknopf, Nacharbeit aus Lauf 28

Alle fünf Nummern (211, 215, 216, 217, 218) sind gebaut, geprüft und im Sammel-PR. **Ausgangslage:** bei jeder Nummer am Code bestätigt (Abweichung nur bei 211: 48 SVG statt 47 im Ordner, siehe unten). **Nicht begonnen:** keine. **Migration:** keine; Regel 3 auf frischer Wegwerf-DB ohne Unterschied. Kein neues Paket, keine neue Variable.

Der Lauf lief als Cloud-Sitzung auf Linux (4 Kerne). Der erste Start auf dem Windows-Rechner der Projektleitung war vor jedem Gate gestoppt (Stand-Check nur wegen CRLF und Backslash-Pfaden rot) und hat nichts hinterlassen.

**Stand-Check vor dem Start:** main 96a43e30, `public/recht/Legal guarantee_notice DE.svg` vorhanden. `pnpm install --frozen-lockfile` grün; Typecheck grün, nachdem der Prisma-Client erzeugt war (wie der CI-Schritt) und der Node-Speicher auf 6 GB stand; Lint 0 Fehler; voller Testlauf 656 Dateien, 12119 Tests grün. Integration ganz 94 Dateien, 770 Tests grün. Stripe: Produktion meldet in der Kasse `testbetrieb: true` (über Vercel gelesen); die Vorschau sperrt Live-Schlüssel im Code.

**Was in dieser Sitzung fehlte:** agent-browser ist nicht installiert (eine globale Installation wäre ein Paket ohne Freigabe) → **alle Bilder entfallen**; Ersatz über Playwright wäre gegen CLAUDE.md. `TEST_DATABASE_URL` gab es nicht vorab; ein lokales Postgres 16 lief nach dem Start, je Worktree eine eigene Wegwerf-DB auf localhost. Sentry war lesend erreichbar.

## PRs

| Nr. | PR | Basis | Vorschau | Migration | Runden | Kurz |
|---|---|---|---|---|---|---|
| Doku | #441 | main | farmer-zone-9tx38dh9p-bierbaron.vercel.app | nein | – | Freigabe §33 wörtlich, Warteschlange, Status, drei Entscheidungen, Morgenbericht 28, Mockup-Index |
| 211 | #444 | docs/lauf29 | farmer-zone-gcj3bpo8s-bierbaron.vercel.app | nein | 0 | Gewährleistungs-Mitteilung: public/recht aufgeräumt, Grafik in Kasse und drei Mails |
| 216 | #442 | docs/lauf29 | farmer-zone-ccpia87ge-bierbaron.vercel.app | nein | 0 | Sentry-Client verwirft Fehler nur aus Browser-Erweiterungen |
| 217 | #445 | docs/lauf29 | farmer-zone-494kwo3is-bierbaron.vercel.app | nein | 1 | Widerruf-Umfang „alle gestrichen“, Test-Mocks, `formatEuro`-Option |
| 218 | #443 | docs/lauf29 | farmer-zone-ho432xghe-bierbaron.vercel.app | nein | 0 | Rücktritts-Angaben im Familien-Formular |
| 215 | #446 | integration/lauf29 (nach 211) | farmer-zone-o58goc90d-bierbaron.vercel.app | nein | 0 | AGB- und Rücktrittssatz unter jedem Kaufknopf, Abholtermin einmal (bar), Bausteine-Vorschau |
| Sammel 29 | (dieser PR) | main | – | nein | – | alles oben per `--no-ff`, Reihenfolge im Zeitbuch |

CI (ci und integration) grün auf #441–#445; #446 und der Sammel-PR: siehe PR. Vorschau-Adressen jeweils mit `https://`.

## Zu den einzelnen Nummern

### 211
- **Gelöschte Dateien** (Bytes, Farbe · Schwarz-Weiß, Name „Legal guarantee_notice XX.svg“ bzw. „XX_BW.svg“): BG 581545 · 580183 | CS 504804 · 503425 | DA 562195 · 561262 | DE (nur BW gelöscht) · 642645 | EL 645748 · 644512 | EN 485854 · 484902 | ES 631180 · 629968 | ET 552492 · 551278 | FI 570191 · 568651 | FR 623785 · 622354 | GA 666388 · 665185 | HR 512377 · 511134 | HU 634505 · 633417 | IT 567659 · 566693 | LT 596316 · 595323 | LV 567207 · 565910 | MT 538089 · 537039 | NL 597011 · 595561 | PL 686286 · 684775 | PT 629236 · 628005 | RO 648629 · 647401 | SK 518747 · 517647 | SL 523147 · 522130 | SV 495827 · 494717 | `.gitkeep` 0. Zusammen lagen 49 Dateien mit 27 937 530 Bytes im Ordner (Freigabe: 47 SVG; es waren 48). Keine `__MACOSX`- oder `.DS_Store`-Reste.
- **SHA-256 der SVG** vor und nach dem Umbenennen (DE, Farbe, 644 195 Bytes): `fd39364dbe42fa775ff55fb9b7aa80c377a5d04219929fef86a8522eed486b1a` – gleich.
- **PNG:** 1240 × 1754 px, 322 036 Bytes, weißer Grund, ohne Alphakanal, reine Rasterung (Skript `scripts/gewaehrleistung-png.ts`).
- Kasse: Grafik je Schritt genau einmal, nur Privat, unter der Zusammenfassung und über dem Knopf (Formular bar und online, Zahlungsschritt, Zahlung fortsetzen). Für „Zahlung fortsetzen“ reicht `checkout/page.tsx` die Käuferart weiter (Grenze erweitert, zwingend).
- **Bild der Kasse mit Grafik:** entfällt (agent-browser fehlt) – bitte bei der Abnahme.

### 215
- Sätze unter „Jetzt bezahlen“ und „Erneut bezahlen“ (auch beim Fortsetzen), eine Quelle (`KaufknopfSaetze`), Betrieb ohne Rücktrittssatz. Bar mit gewähltem Termin: Zeile unter dem Knopf entfällt. Online-Formular unverändert (N10).
- **Bild des Zahlungsschritts mit beiden Sätzen:** entfällt (agent-browser fehlt).

### 216
- Ereignisse der letzten 7 Tage, die der Filter verworfen hätte: **1** (JAVASCRIPT-NEXTJS-H, 31.10.). JAVASCRIPT-NEXTJS-8 hatte 2 Ereignisse, zuletzt vor 16 Tagen.

### 217
- Runde 1: zwei Seiten-Tests mockten noch `reorderPhotosAction` (Blocker gegen den Wortlaut 217.2), behoben; jetzt alle elf.

### 218
- Grenze erweitert: `ruecktritt-felder.tsx` (Haken und Euro-Feld als eigene Exporte; das Euro-Feld reicht jetzt `id`/`aria-*` weiter – auch im Produktdialog hängen Beschriftung und Fehler jetzt am Feld) und ein Satz in ARCHITECTURE („Gespeichert …“).
- Vorbelegung: keine Futter- und keine Brennmaterial-Kategorie steht in der Liste aus 214 – der Haken startet in diesen Formularen leer.

## Merge-Reihenfolge

**Gestapelte PRs per Merge-Commit mergen, nicht per Squash.**
1. Doku-PR #441 nach main.
2. Danach der Sammel-PR `integration/lauf29` nach main (enthält 211, 216, 218, 217, 215). Die einzelnen PRs #442–#446 schließen sich damit von selbst bzw. werden danach geschlossen.

## Bitte entscheiden

1. **211 – heller Grund unter der Grafik:** Die amtliche SVG hat einen durchsichtigen Grund; im dunklen Modus stünde schwarze Schrift auf dunkler Karte. Unter dem Bild liegt deshalb `bg-accent-foreground` (in beiden Themes hell, Crème). Die Grafik selbst ist unverändert, kein Filter. So lassen – oder reines Weiß wie in der PNG?
2. **211 – § 8 Abs. 1 FAGG „unmittelbar“:** Zwischen Zusammenfassung und Kaufknopf stehen jetzt rund 460 px Grafik (so beauftragt). Für die Anwältin: reicht das, oder Reihenfolge Grafik → Zusammenfassung → Knopf?
3. **215 – Online-Formular:** Unter „Weiter zur Zahlung“ steht der Abholtermin weiter zweimal (Zusammenfassung und Zeile N10). Soll die Zeile dort nur noch den Zahlweg nennen?
4. **211 – Größe am Handy:** Die Grafik ist kartenbreit (bei 390 px rund 326 × 461 px), nicht 390 × 552. So abnehmen?

## Nacharbeit (Vorschläge, nicht gebaut)

- **211:** Desktop ab 1024 px – die klebende rechte Spalte (`KassenRaster`, `lg:sticky` in kasse-teile.tsx) wird mit der Grafik höher als der Bildschirm; ist die linke Spalte länger, ist der Knopf erst am Seitenende zu sehen (erreichbar bleibt er). Kleinste Änderung: `lg:sticky` bei Privat weglassen. Mit Tastatur bei 1440 × 900 prüfen.
- **211:** `width={600}` als Attribut am Mail-Bild (Outlook am Rechner beachtet `max-width` nicht).
- **215:** Bei Kaufsperre mit gewähltem Termin wird die Bar-Zeile ganz leer; DESIGN_SYSTEM sagt „nur der Zahlweg“ (`&& sperre === null` in `barMitTermin`).
- **215:** Leistenhöhe am Handy nur geschätzt (Zahlungsschritt rund 205 px gegen 224 px Platz; Formular `max-md:mb-8` für eine kleinere Leiste bemessen) – bei 390 px messen, auch Safe-Area.
- **215:** `tests/kauf-zusammenfassung.test.ts` prüft „keine Fußzeile“ mit `kaufknopfSaetze: null`; der Test für „Erneut bezahlen“ hängt an der Reihenfolge der Hooks.
- **216:** Frame mit Erweiterungs-`filename` und eigenem `abs_path` zählt als Erweiterung (besser: eigen); Init-Wache nur für `src/instrumentation-client.ts` lockern; Randfall-Tests (mehrere `exception.values`, Großschreibung).
- **217:** Bestell-Detail des Hofs und Hof-Mail zeigen bei leerem Rest `w.nachricht ?? WIDERRUF_TEXT.teil` (Freitext als Umfang).
- **218:** Brennmaterial-Schema `...ruecktrittFelder` hinter `groessen` (Fokus springt sonst zuerst zur Schätzung); Formular-Test „negativer Betrag“ gerendert; DEVELOPMENT.md Eintrag 214 („Futter-Familie hat die zwei Felder noch nicht“) ist überholt.

## Regelvorschläge

- **211 (Umsetzer):** DESIGN_SYSTEM „Eine amtliche Grafik mit durchsichtigem Grund liegt auf `bg-accent-foreground`, nie auf der Karte allein.“ – erst nach Entscheidung 1.
- **Dirigent:** In einer Cloud-Sitzung gehört `NODE_OPTIONS=--max-old-space-size=6144` (oder 4096) und `pnpm exec prisma generate` zum Stand-Check, sonst ist der Typecheck aus Umgebungsgründen rot. Ort: docs/nachtlauf.md §8 (Starten). Prüfung statt Text: ein Skript `scripts/stand-check.sh`, das beides setzt.
- **Dirigent:** agent-browser fehlt in frischen Cloud-Containern. Vorschlag: Installation im Setup-Skript der Umgebung (Freigabe der Projektleitung), damit Bilder nicht ausfallen.

## Für dich zu tun

- [ ] **Abnahme in der Testumgebung test.agrilo.at** (nach dem Merge): Kasse bar und online mit Grafik und den Sätzen unter dem Kaufknopf, als Privat und als Betrieb (Betrieb: keine Grafik, kein Rücktrittssatz); 390 und 1440 px, hell und dunkel – die Bilder dieses Laufs fehlen. Bestätigungsmail (online, bar, „Bitte bestätige“) mit PNG. Familien-Formular (Futter, Brennmaterial) mit den zwei Feldern. Admin › Bestellungen und Hof-Akte mit einem Widerruf, dessen Positionen alle gestrichen sind. Bausteine-Vorschau (`/intern/bausteine`) mit `KaufZusammenfassung`.
- [ ] Sentry: JAVASCRIPT-NEXTJS-8 als „ignoriert“ schließen; -H schließt der Commit (`Fixes JAVASCRIPT-NEXTJS-H`).
- [ ] Resend-Schlüssel bzw. `TEST_EMPFAENGER` der Testumgebung prüfen (JAVASCRIPT-NEXTJS-G).
- [ ] Nach dem Merge: Produktion zeigt die Grafik in der Kasse; Testmails zeigen das Bild erst, wenn es in der Produktion liegt (absolute Adresse). Datum T für den AGB-Fix festlegen.
- [ ] Die vier Punkte unter „Bitte entscheiden“.
- [ ] Merge per Merge-Commit: zuerst Doku-PR #441, dann der Sammel-PR.
- [ ] Zur Kenntnis: JAVASCRIPT-NEXTJS-7 („Stripe TEST in Produktion … kein STRIPE_CONNECT_WEBHOOK_SECRET“) meldet weiter, 18 Ereignisse in 6 Tagen – erwartet bis Stripe live.

## Bilder

Keine (agent-browser fehlt in dieser Sitzung). Die Bilder aus §0 der Freigabe (211, 215, 218) gehören in die Abnahme.

## Zeitbuch

docs/nachtlauf/berichte/zeitbuch-lauf29.md
