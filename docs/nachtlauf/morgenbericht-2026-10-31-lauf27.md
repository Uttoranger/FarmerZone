# Morgenbericht Lauf 27 (30./31.10.2026) · Go-Live: Code-Blocker

Alle acht Nummern (199–206) sind gebaut, geprüft und im Sammel-PR. Nicht begonnen: keine. **Ausgangslage:** bei jeder Nummer am Code bestätigt (je Bericht Zeile 3; einzige kleine Abweichung 203: `OEFFENTLICH_SICHTBAR` kannte `HOF_SICHTBAR_WO` schon, die Route prüfte den Hof aber nicht mit `hofSichtbar`). **Migration:** genau eine, `20261030100000_widerruf` (Nr. 200, nur Expand: neue Tabelle, kein Fremdschlüssel, RLS). **Regel 3:** auf frischer Wegwerf-DB alle Migrationen angewandt, `migrate diff --exit-code` ohne Unterschied. Kein neues Paket, keine neue Variable.

**Wichtigster offener Punkt: Die Rücktrittsbelehrung (Nr. 200) ist ein Platzhalter.** Das RIS war aus der Bauumgebung nicht erreichbar; nach Freigabe STOPP nur für die Belehrung. Vor dem Live-Gang nachtragen (Wortlaut Anhang I FAGG Teil A und B, Quelle und Abrufdatum in `src/lib/widerruf.ts`).

## PRs

| Nr. | PR | Basis | Runden | Kurz |
|---|---|---|---|---|
| Doku | #422 | main | – | Freigabe §31, Register N39/N40, G8-Ergänzung, Status, Testumgebung, Stripe-live |
| 199 | #423 | main | 0 | `setFarmerRole` entfernt, Aufrufer-Wache für Server Actions |
| 201 | #424 | main | 0 | Signal „Stripe live ohne Hofpreis-Modell“ in Heute und Betriebsleiste |
| 203 | #425 | main | 0 | Webhook: 400 ohne Detail, Zod je Ereignistyp; Statusbild nur sichtbare Höfe |
| 202 | #426 | main | 1 | Korb bleibt nach gescheiterter Zahlung, „Erneut versuchen“ zahlt dieselbe Bestellung |
| 206 | #427 | main | 1 | Alte Bilder beim Ersetzen und Löschen aus dem Speicher |
| 205 | #428 | main | 1 | Mini-Warenkorb mit Grund, Hof-Unterleiste bei 320 px |
| 200 | #429 | main | 1 + 2 Nachbesserungen | Widerruf online, Rücktrittssatz in der Kasse, Admin-Zuordnen (Migration) |
| 204 | #430 | integration/lauf27 | 2 | CSP erzwingend |
| Sammel 27 | (dieser PR) | main | – | alles oben per `--no-ff`, Reihenfolge im Zeitbuch |

**Abweichung von §1:** Nr. 204 startete vom Zwischenstand **ohne** 200 (200 lief noch in der Nachbesserung, 204 berührt nur die CSP-Dateien). /widerruf ist deshalb nicht im CSP-Durchgang von 204 — bitte in der Vorschau mitprüfen (unten).

Dirigent-Eingriffe (Sollte → Blocker oder kleine Korrektur selbst):
- 199: Ein Eigenschaftsname zählt in der Wache nicht als Aufruf.
- 201: Ohne `STRIPE_LIVE_AB` ist die Aufgabe sofort überfällig.
- 203: Die Sentry-Meldung kommt erst nach der Antwort an Stripe.
- 202: Pause des Hofs hält die Fortsetzung nicht an (wie `/api/checkout`), Admin-Sperre schon.
- 206: ARCHITECTURE nachgezogen.
- 200: Die Grenze war um Punkt 6 zu eng; Admin-Ansicht und Zuordnen als Nachbesserung 2, der hängende Rest eines Teilwiderrufs als Nachbesserung 3.
- 204: Grenze bestätigt, Hinweis vor dem Revert ergänzt.

## Zu den einzelnen Nummern

### 199 – Actions ohne Aufrufer
- Exportierte Server Actions: 150 in 41 Dateien (vorher 151). Alle Einstiege geprüft.
- Ohne Aufrufer: `src/server/actions/farm-photos.ts#reorderPhotosAction`, **Rechtewirkung nein** (setzt nur die Reihenfolge der eigenen Hoffotos). Im Bestand der Wache als „Fund Lauf 27“; Löschen oder intern machen ist Nacharbeit.

### 200 – Widerruf
- **Quelle der Belehrung:** keine. RIS (ris.bka.gv.at) am 30./31.10. aus der Bauumgebung nicht erreichbar (Proxy). Platzhalter mit Vermerk; daneben ein Hinweis auf AGB Punkt 12.
- **`ausnahmeHinweis` je Kategorie** (für die Anwältin):
  - MILCH, EIER, FLEISCH, FISCH, GEMUESE, OBST, BROT: „Frische Lebensmittel verderben schnell – hier gilt das Rücktrittsrecht wahrscheinlich nicht (§ 18 Abs. 1 Z 4 FAGG). Der Hof prüft das im Einzelfall.“
  - HONIG, FUTTERMITTEL, HEU_STROH, GETREIDE_KOERNER, MISCHFUTTER, ERGAENZUNGSFUTTER, BRENNHOLZ: „Diese Ware ist meist haltbar – der Rücktritt ist hier wahrscheinlich möglich. Der Hof prüft das im Einzelfall.“
  - GETRAENKE, SONSTIGES: „Ob du hier zurücktreten kannst, hängt von der Ware ab (etwa ob sie schnell verdirbt oder versiegelt war). Der Hof prüft das im Einzelfall.“
- **Offene Rechtsfragen (Anwältin):**
  1. Wortlaut von Belehrung und Formular (Anhang I FAGG).
  2. Die drei Sätze je Kategorie oben.
  3. Der Satz in der Kasse („Du kannst vom Kauf innerhalb von 14 Tagen nach der Abholung zurücktreten – außer bei schnell verderblicher Ware. So geht’s: Rücktritt“).
  4. Der Hinweis auf AGB Punkt 12 neben dem Platzhalter (zusätzlicher Satz, nicht in der Freigabe).
  5. Der Satz „bring sie bitte innerhalb von 14 Tagen zum Hof zurück“ (`WIDERRUF_TEXT.naechsteSchritte`).
  6. Widerruf bei „nicht abgeholt“: Der Link erscheint dort jetzt (nur `widerrufMoeglich` entscheidet).
  7. Ob die Servicegebühr bei einem Widerruf nach der Abholung erstattet wird (heute: ja, wie AGB 12.5).
- Admin-Zuordnen braucht frischen Passkey und das Recht `hof_sperren_storno` (es kann ein Storno mit Erstattung auslösen).

### 204 – CSP
| Direktive | blockierte Quelle | Anzahl | zuletzt | erwartet | Erklärung |
|---|---|---|---|---|---|
| script-src | eval | 98 | 27.10. 11:40 | ja, ohne Wirkung | Probe von Zod 4 (`new Function('')` in try/catch) bei Formularen mit zodResolver; asn1.js im Admin-Bündel. Fallen ohne eval zurück. |
| frame-src | https://agrilo.at | 2 | 22.10. | ja, behoben | Vorschau-Rahmen in Mein Hof vor Nr. 155 (`'self'` in frame-src kam am 23.10.) |

- **Geprüfte Seiten** (lokal, Produktions-Build, `securitypolicyviolation`):
  - Ohne Verstoß: Startseite, /hoefe, Hofseite mit Korb, Kasse mit Korb und Abholzeiten, Vorschau-Rahmen in Mein Hof.
  - Nur die erwartete eval-Probe: /register und /login (beide funktionieren), /farm-page, /products, /status/new, /admin/einrichten.
- **Nicht lokal prüfbar:** Kasse mit Stripe, echter Upload, Admin › Startseite, /widerruf (siehe „Für dich zu tun“).
- **Weg zurück:** in `src/lib/csp.ts` `CSP_HEADER` auf `'Content-Security-Policy-Report-Only'` setzen (dazu die Erwartungen in `tests/csp.test.ts` und `tests/sicherheits-header.test.ts`), Branch, PR, Merge. Revert-Weg und Hinweis im Bericht 204.

### 206 – verwaiste Bilder
Keine Zahl: Dafür braucht es die Liste des echten Speichers, und darauf hatte der Lauf bewusst keinen Zugriff. Ablesen unter **Admin › Betrieb › „Bilder ohne Verwendung“** (bzw. CSV `/admin/betrieb/bilder-export`) und hier nachtragen: ____ .

## Bitte entscheiden

1. **Register N17** (Ergänzung 16.10.2026: ein ersetztes Foto bleibt als „Bild ohne Verwendung“ liegen) widerspricht Nr. 206 für Logo, Titel- und Produktbild. Ergänzen?
   Entschieden 31.10.2026: Ergänzung zu N17 (31.10.2026, Nr. 206): Logo, Titel- und Produktbild werden nach erfolgreichem Speichern des Ersatzes gelöscht; nur Beitragsfotos und Startseiten-Bilder bleiben als ‚Bilder ohne Verwendung‘ liegen. Der Schutzgrund von N17 bleibt erfüllt, weil erst nach dem Schreiben gelöscht wird. Altbestand vor 206 über Admin › Betrieb aufräumen (eigener Auftrag mit Freigabe).
2. **CSP-Meldungen `eval`:** so annehmen, oder als nächste Nummer `z.config({ jitless: true })` in einem Client-Einstieg (dann keine Meldungen mehr)?
   Entschieden 31.10.2026: Ergänzung zu G8 (31.10.2026): Die eval-Probe von Zod 4 (`new Function('')`) wird mit `z.config({ jitless: true })` in einem Client-Einstieg abgestellt, damit der CSP-Bericht echte Treffer zeigt; kein Sicherheitsgewinn, nur Signalqualität. asn1.js im Admin-Bündel wird dabei geprüft.
3. **202 Pause des Hofs:** Die Zahlung einer bestehenden Bestellung geht bei Pause weiter (wie `/api/checkout` heute). So lassen?
   Entschieden 31.10.2026: Ergänzung zu N2/E5 (31.10.2026, Nr. 202): Pausiert ein Hof, nachdem eine Bestellung angenommen und reserviert wurde, darf die Kundin die Zahlung dieser Bestellung noch abschließen; nur neue Bestellungen sind gesperrt. Die Admin-Sperre hält auch bestehende Zahlungen an.
4. **205 `form.watch`:** eigene Nummer „Formulare Kasse und Produkt für React Compiler aufräumen“ (Geld-Pfad, mit Integrationsprobe)?
   Entschieden 31.10.2026: Nacharbeit nach dem Go-live (31.10.2026): Formulare Kasse und Produkt für den React Compiler aufräumen (`form.watch` → `useWatch`), mit Integrationsprobe im Geld-Pfad. Nicht vor dem Go-live (Nr. 209, vorgemerkt).

## Nacharbeit (Vorschläge, nicht gebaut)
- 200/186: Beim Zuordnen und beim Notfall-Storno entsteht der Protokolleintrag erst nach der Erstattung. Bricht der Aufruf bei Stripe ab, ist gebucht, aber nicht protokolliert. Protokoll direkt nach dem bedingten Schreiben.
- 200: Nach einem teilweisen Teilstorno vor der Abholung stehen im Widerruf noch alle gewählten Positionen (Anzeige und Erstattung nehmen nur den Rest).
- 203: Das Muster „einmal je Tag“ steht zweimal (`erstmalsHeute` und Webhook). Einen Helfer mit freiem Art-Schlüssel herausziehen.
- 206: `entferneAltesBild` steht doppelt (eine `'use server'`-Datei darf sie nicht exportieren) → `src/server/bild-loeschen.ts`. Beitragsfotos und Startseiten-Bilder löschen ersetzte Bilder weiterhin nicht.
- 199: `reorderPhotosAction` löschen oder intern machen.
- 204: asn1.js im Admin-Bündel prüfen; Kommentar in `tests/sicherheits-header.test.ts` nennt den Rahmen-Test beim Namen.
- 202: eigener Header `no-referrer` für die Kasse mit `?zahlung=&sig=`.

## Für dich zu tun

1. **Abnahme auf test.agrilo.at** (Vorschau des Sammel-PR), jeweils mit offener Konsole (keine CSP-Meldung außer der eval-Probe):
   - **Widerruf vor der Abholung** mit Link (aus der Bestätigungsmail): ganze Bestellung und einzelne Artikel → Storno, Erstattung, Mail.
   - **Widerruf nach der Abholung** mit Link: Karte in Hof-Heute, „Rückgabe erhalten – erstatten …“ bzw. „Ablehnen …“.
   - **Widerruf ohne Link** über /widerruf: mit passender Bestellnummer und Adresse, und mit einer erfundenen Nummer (gleiche Antwort; Admin › Bestellungen › „Widerrufe ohne Bestellung“ → Zuordnen mit Passkey).
   - **Gescheiterte EPS-Zahlung** (Testmodus „fehlgeschlagen“) → Bestätigungsseite „Zahlung fehlgeschlagen“, Korb bleibt, „Erneut versuchen“ → dieselbe Bestellung bezahlen.
   - **Kasse** mit dem Rücktrittssatz unter dem AGB-Satz (bei „Betrieb“ ohne).
   - **CSP mit 3-D-Secure**: Testkarte 4000 0027 6000 3184, EPS mit Weiterleitung und Rückkehr; dazu ein echter Upload und Admin › Startseite mit dem Rahmen „So sieht's die Kundin“.
   - Admin-Bilder (Heute mit „Stripe live …“ ist in der Vorschau nicht sichtbar, nur der Hinweis in der Karte „Hofpreis-Modell ab“; Widerrufe in Admin › Bestellungen und Hof-Akte).
2. **Texte an die Anwältin:** die Rechtsfragen 1–7 unter Nr. 200 samt Belehrung (Wortlaut aus dem RIS, sobald nachgetragen).
3. **Belehrung nachtragen** (oder als Auftrag geben): Wortlaut Anhang I FAGG aus dem RIS, Quelle und Abrufdatum in `src/lib/widerruf.ts`.
4. **Zahl der verwaisten Bilder** unter Admin › Betrieb ablesen und oben bei 206 eintragen.
5. **Merge per Merge-Commit** (nicht Squash), zuerst Doku-PR #422, dann der Sammel-PR. Die Einzel-PRs #423–#430 schließen sich danach von selbst oder werden geschlossen. Die Migration spielt `vercel-build` beim Merge auf main ein.
