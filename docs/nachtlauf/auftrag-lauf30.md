# Auftrag Nachtlauf 30

## Hintergrund

Projekt FarmerZone/Agrilo (Next.js 16, Prisma 7, pnpm 10.33.0, Produktivsystem mit echtem Geld, öffentliches Repo Uttoranger). Die Projektleitung hat Nachtlauf 30 im Chat freigegeben; die Freigabe unten ist ihr wörtlicher Text. Sie schrieb zuerst „Ort: lokal“, hat dann aber am 3.11.2026 nach dem Stand-Check auf ihrem Windows-Rechner (34 Testdateien nur wegen Windows rot, kein agent-browser, keine Test-Datenbank) entschieden: Der Lauf läuft in der Cloud auf Linux, und agent-browser wird im Container installiert. Die Mockups liegen deshalb schon committet auf `origin/docs/lauf30` (Commit `6ce5aa98`, von main `056a321e`). Keine andere Sitzung arbeitet an Kasse, Webhook, Schema oder Shells; offen ist nur PR #448 (Impressum), den Lauf 30 nicht berührt. Diese Sitzung ist der Dirigent und hält alle Zonen, die der Lauf berührt, bis der Sammel-PR offen ist.

## Auftrag

Du bist der Dirigent des Nachtlaufs. Lies zuerst CLAUDE.md, dann docs/entscheidungen.md, docs/nachtlauf.md, docs/nachtlauf/freigabe.md und docs/nachtlauf/status.md. Hole vor dem ersten Gate origin/main; der Lauf setzt auf `origin/docs/lauf30` auf (siehe Hinweis der Schaltzentrale ganz unten). Arbeite die Warteschlange aus docs/nachtlauf.md Abschnitt 3 ab der ersten offenen Nummer bis zum Haltepunkt aus freigabe.md ab, genau nach dem Ablauf in Abschnitt 4: je Gate ein frischer Unteragent als Umsetzer, danach tester und pruefer, höchstens zwei Nachbesserungsrunden, dann pushen und gestapelten PR öffnen, status.md aktualisieren. Nur tun, was freigabe.md erlaubt; fehlende Freigaben überspringen und notieren. Nie mergen, nie auf main committen, Migrationen nur nach Abschnitt 2 Regel 3: ohne Datenbank mit `pnpm exec prisma migrate diff --from-schema <Schema von origin/main> --to-schema prisma/schema.prisma --script`, geprüft mit pnpm test:integration und nur, wenn TEST_DATABASE_URL auf localhost zeigt. Stoppe sauber nach den Regeln in Abschnitt 5. Schreibe zum Schluss den Morgenbericht nach Abschnitt 6. Stelle keine Rückfragen – es ist niemand da; alles Offene gehört in den Morgenbericht.

Die Freigabe für diesen Lauf ist der folgende Text der Projektleitung. Der Doku-PR übernimmt ihn wörtlich als „## 34. Lauf 30 (uttoranger, im Chat erteilt, 3.11.2026)“ in docs/nachtlauf/freigabe.md, zwischen den Markierungen ===ANFANG=== und ===ENDE=== (die Markierungen selbst nicht übernehmen):

===ANFANG===
Nachtlauf 30
Ort: lokal (agent-browser, lokales Postgres und die Mockup-Dateien im Arbeitsordner sind nötig; in der Cloud fehlte agent-browser in Lauf 29)
Basis: main (056a321e oder später); die Nummern stapeln auf docs/lauf30 bzw. dem Zwischenstand integration/lauf30
Berührt: Kasse (nur Texte und Darstellung, nie /api/**) · Webhook: nein · Schema: nein (keine Migration) · Geldberechnung: nein (nur Anzeige) · Geschäftsregel: ja (221: „Monate nur erhöhen“ erst nach dem Festschreiben; wirkt über das Gründungs-Ende auf Grundgebühr und Einzug der Bargebühr)

Arbeite als Dirigent nach docs/nachtlauf.md: §2 Regeln, §4 Ablauf je Gate (mit Regel-Inventur), 4a Tempo, §5 Stoppen, §6 Morgenbericht, §7 Fortsetzen. Dieser Text ist die Freigabe. Der Doku-PR trägt ihn wörtlich als „## 34. Lauf 30 (uttoranger, im Chat erteilt, 3.11.2026)“ in docs/nachtlauf/freigabe.md ein. Zeitbuch: docs/nachtlauf/berichte/zeitbuch-lauf30.md.

Kennungen: Die Entscheidungen dieses Laufs heißen im Register N41–N44 (in den Projekt-Dokumenten E-014, E-015, E-017, E-018). Offene Punkte ohne Register-Eintrag stehen hier im Klartext.

══════════════════════════════════════════════════════════════════════
ANTWORTEN DER PROJEKTLEITUNG (Vorgabe = Empfehlung des Teams; gilt, wenn hier nichts geändert ist)
══════════════════════════════════════════════════════════════════════
A1 Knopf „Servicegebühr …“ in der Akte:
   - Ab dem Stichtag „Hofpreis-Modell ab“ nicht mehr zeigen. Der eine Weg zum Satz ist die Karte „Plattformgebühr“.
   - Grund: Der Knopf schreibt den Satz des alten Modells (servicegebuehr-dialog.tsx), also ein anderes Feld. Ein Umbenennen würde in die Irre führen.
A2 Gründungszeit 12 Monate (N44):
   - Bestätigt, mit der Folge für den Einzug der Bargebühr (siehe Entschieden).
   - Wert setzen und Festschreiben macht die Projektleitung nach dem Merge, vor dem Tarifstart am 1.2.2027.
   - Der Lauf ändert keine Daten.
A3 Mindestbestellwert-Satz:
   „Mindestbestellwert: Waren für 10 € (mit Plattformgebühr ab € 10,60). Dir fehlen noch Waren für € X.“
   Ohne Gebührenbetrag beim Fehlbetrag, weil die Gebühr je Stück aufgerundet wird und jede Zahl dort nur ungefähr stimmt.
   Im PR unter „Offen für Recht“ (Preisangabe).

══════════════════════════════════════════════════════════════════════
AUSGANGSLAGE (geprüft 03.11.2026, main 056a321e, nur gelesen)
══════════════════════════════════════════════════════════════════════

Stand allgemein
- Alle Routen tragen schon data-design="neu" (Shells in src/components/shells/kunde-shell.tsx, hof-shell.tsx, admin-shell.tsx; die letzten Altrouten zog Nr. 181 um). Der Lauf zieht die Darstellung der neuen Mockups nach, er baut keinen Umzug.
- Die neuen Mockups liegen noch nicht im Repo. docs/mockups/README.md kennt nur die älteren web-/mobil-Dateien. Nach CLAUDE.md §2 müssen die neuen zuerst dort liegen und Vorrang haben.
- tests/telefonnummern-wache.test.ts liest alle .html-Dateien unter docs/, auch unversionierte im Arbeitsordner. Am Export (3.11.2026) hatten 16 Dateien Nummern mit Ziffern 1–9 im Teilnehmerteil:
  - s1/w1-bestellung (je hell und dunkel)
  - s1/w1-kasse (je hell und dunkel)
  - s2/w2-druck
  - s2/w2-kunden (je hell und dunkel)
  - w-l-kundenseite (hell und dunkel)
  Die Projektleitung lässt sie vor der Übergabe nullen; sonst STOPP (siehe Stand).
- N38-Geld ist in der Logik umgesetzt; das bleibt unberührt:
  - src/lib/plattformgebuehr.ts: gebuehrJeStueckCents Z. 105 (je Stück aufgerundet), bestellGebuehr Z. 133, mindestbestellwertErreicht Z. 150, einzugAbFuer Z. 163
  - src/lib/konditionen.ts: MINDESTBESTELLWERT_CENTS Z. 204, PLATTFORMGEBUEHR_PROZENT Z. 201
  - src/app/api/checkout/route.ts: Z. 687–697, on_behalf_of nur im Hofpreis-Modell Z. 226
  - Umschaltung: gebuehrModellFuer, preisAnzeigeFuer
  Falsch sind nur Texte und eine Anzeige-Rechnung.

Gebühren-Texte, die nach dem Stichtag „Hofpreis-Modell ab“ noch das alte Modell nennen
- src/components/produkte/futter-formular.tsx Z. 647: „Die Servicegebühr zahlt die Kundin zusätzlich. Du bekommst genau deinen Preis.“ (ohne Bedingung)
- src/components/hof-bestellungen/storno-dialog.tsx Z. 91 und 103 („Warenpreis … + Servicegebühr …“, „Die Servicegebühr erstattet Agrilo.“). Die Hilfslogik liegt in src/lib/storno.ts Z. 49–60, 84; den Geldweg (refund_application_fee im Hofpreis-Modell) zeigt src/server/stornieren.ts Z. 323–333.
- src/lib/startseite.ts Z. 310–320: beispielRechnung rechnet immer mit berechneServicegebuehr (5 %, online).
- src/lib/konditionen.ts:
  - Z. 343–354: SERVICEGEBUEHR_ZAHLT_KUNDE auf /konditionen und /fuer-hoefe
  - Z. 396: KONDITIONEN_DERZEIT „In der Startphase kostenlos …“ im Freischalt-Dialog src/components/admin/hof-aktion-dialog.tsx Z. 106
  - Z. 227: MINDESTBESTELLWERT_SATZ, auch Fehlermeldung von /api/checkout (route.ts Z. 26, 688), geprüft wörtlich in tests/plattformgebuehr.test.ts Z. 92, tests/plattformgebuehr-checkout.test.ts Z. 262 und in der Kasse von tests/kaufknopf-saetze.test.ts Z. 296
- src/lib/kasse.ts Z. 236–239: mindestbestellwertGrund gibt vor dem Stichtag null (kein Mindestbestellwert), danach MINDESTBESTELLWERT_SATZ; Aufruf in src/components/checkout/checkout-form.tsx Z. 352.
- Admin:
  - src/lib/admin-bestellung.ts Z. 250–251
  - src/app/admin/geld/page.tsx Z. 158
  - src/components/admin/hof-akte-ansicht.tsx Z. 140, 195
  - src/lib/admin-rechte.ts Z. 40
  - src/lib/servicegebuehr.ts Z. 58 (SERVICEGEBUEHR_BEZEICHNUNG, Geld-Kachel in src/lib/admin-aufgaben.ts)
  - src/lib/finanzen.ts Z. 471–472 (EINNAHMEN_ONLINE_LABEL, EINNAHMEN_VOR_ORT_LABEL) und Z. 816–888 (Jahresdiagramm „Servicegebühren“)
  - src/lib/plattform-einstellung.ts Z. 341 („Vorher bleibt alles wie heute.“)
- Ein Helfer je Bestellung existiert: gebuehrBezeichnungFuer (src/lib/plattformgebuehr.ts Z. 298); der Admin nutzt ihn nicht.
- Die vollständige Liste der Fundstellen zählt die Wache aus 221 (git grep), nicht diese Aufzählung.

Gründungszeit (N44)
- Feld vorhanden:
  - prisma/schema.prisma Z. 1446 gruendungMonate Int @default(24), Z. 1448 gruendungFestAm
  - Admin-Feld „Monate ohne Grundgebühr“ (src/lib/plattform-einstellung.ts Z. 251)
  - GRUENDUNG_MONATE_STANDARD = 24 (src/lib/gruendungshof.ts Z. 321)
- Beginn „später von Tarifstart und Freischaltung“ ist gebaut (zusageEnde, gruendungshof.ts Z. 488).
- Hindernis: die Regel „Monate nur erhöhen“, src/lib/plattform-einstellung.ts Z. 184 (monateNurMehr).
- Vor dem Festschreiben (gruendungFestAm = null) gilt Art „bisher“ mit festem Ende gruendungBisStandard. Ein dann freigeschalteter Hof bekommt schon eine Zusage auf dieses Ende samt Postfach-Nachricht (gruendungshof.ts Z. 440–454). festschreibenListe (Z. 611–620) nimmt beim Festschreiben immer den späteren Tag von bisherigem und neuem Ende; niemand verliert etwas.
- Das Gründungs-Ende bestimmt auch den Einzug der Bargebühr: einzugAbFuer (plattformgebuehr.ts Z. 157–172) = der spätere Tag von Stichtag und Tag nach gruendungBis (Register K2, Ergänzung 26.10.2026).
- Register K2 sagt noch 24 Monate und „Monate nur erhöhen“ (docs/entscheidungen.md Z. 316 ff.). Die Aktion zählt die Freischaltung bis „Aktion bis“, nicht die Anmeldung (Z. 327).

Wortliste und Texte (Register N8)
- „Widerruf“ in Nutzertexten. Die Texte stehen in src/lib/widerruf.ts (WIDERRUF_TEXT Z. 238 ff.).
  N39 legt wörtlich fest:
  - den Einstieg „Vertrag widerrufen“ (fussLink Z. 241, Links in Mails, Bestätigung, Bestellseite)
  - die Knöpfe „Vertrag widerrufen“ (knopfWiderrufen Z. 239) und „Widerruf bestätigen“
  Die Belehrung Teil A/B (Z. 318–346) ist das Muster aus Anhang I FAGG.
  Die Datenschutzerklärung verwendet „Widerruf“ auch für Einwilligungen (src/app/(public)/datenschutz/page.tsx Z. 61–64, 205).
- „Login-E-Mail“: src/app/(hof)/settings/account/page.tsx Z. 90.
- „Hofladen“ für den Hof beim Stilllegen: archive-farm-card.tsx Z. 102, account/page.tsx Z. 138.
- „Hof-Profil“ / „Profil speichern“ / „Profil gespeichert“: src/app/(hof)/settings/profile/page.tsx Z. 11; src/components/settings/profile-form.tsx Z. 166, 488.
- Anlass „Mitteilung“: src/lib/beitrag-anlass.ts Z. 32 (Ausnahme im Test).
- Balken mit langem Strich, immer derselbe Text:
  - Text: src/lib/farm-approval.ts Z. 30–31
  - gerendert in src/components/hofbereich/hof-balken.tsx und src/components/farmer/pending-approval-banner.tsx
  - Schritte: src/lib/einrichten.ts
- Postfach-Satz „Du kannst auf jede Nachricht antworten.“: src/lib/postfach.ts Z. 180 (widerspricht N14).
- „In den Warenkorb“: src/lib/notbremse.ts Z. 165.
- Jahresansicht „Finanzen“ statt „Geld“ (N32): src/lib/admin-finanzen-seite.ts Z. 14.

Zähler „Bestellungen“ (N41 e)
- Die Navigation zählt nach src/server/queries/orders.ts Z. 110 (OPEN_STATUSES, nicht exportiert).
- Die Unterleiste der Kundschaft kommt aus src/lib/kunden-navigation.ts.

E-Mails
- Standard-Fuß „Versandt von Agrilo im Auftrag eines Hofes.“ (src/emails/_layout.tsx Z. 119), auch bei Code-, Passwort-, Sicherheits-, Freischalt-, Lastschrift- und Team-Mails.
- Eigene Füße haben schon: Betriebs-Mails, Postfach (src/lib/zustellung.ts Z. 215), Widerruf-Eingang (src/emails/widerruf.tsx Z. 29).
- Knöpfe 41 px: ctaButton padding '11px 18px', _layout.tsx Z. 221.
- Kein Reply-To unter src/; Versand über sendRaw (src/lib/email.ts Z. 243) und versendeStapel (Z. 314).
- Bar-Frist: Die Mail nennt die richtige Frist schon heute über fristVon (src/emails/onsite-confirmation.tsx Z. 42; Regel src/lib/fristen.ts: 2 Stunden ab Bestellung, spätestens Beginn des Abholfensters). Z. 105 wiederholt sie als „… nach spätestens zwei Stunden wieder frei“.
- „Im Dashboard ansehen →“: new-order-notification.tsx Z. 81, order-confirmed.tsx Z. 92.
- „Vor-Ort-Bestellung“: order-confirmed.tsx Z. 37–38, src/lib/email.ts Z. 1128.
- „Klicke auf den Button“: src/emails/password-reset.tsx Z. 18.
- „E-Mail-Updates“ / „Mehr ansehen beim …“: src/emails/status-update.tsx Z. 100–106. Der Abmelde-Link, manageUrl und List-Unsubscribe/-Post stehen in status-update.tsx Z. 104–107, _layout.tsx Z. 120–123 und src/lib/abmelde-link.ts.
- Hof-E-Mail: hofKontaktEmail (src/lib/hof-kontakt.ts) ist nur zum Anschreiben des Hofs; sie fällt auf die Anmelde-Adresse zurück. Wo Kundinnen eine Adresse sehen, gilt nur das Profilfeld (Kopfkommentar, tests/hof-kontakt-wache.test.ts; hofEmailFehlt Z. 32).
- Mail-Vorschau:
  - Admin › Betrieb › Alle Mails zeigt einzelne Aufträge (N27, hinter Passkey, nicht alle Arten), über RENDERER (src/server/mail-arten, vorschau.ts).
  - Für Bilder aller Vorlagen gibt es kein Skript.

Rechtstexte
- /agb: „Fassung 0.9 – Entwurf“ (src/lib/rechtstexte/agb.ts Z. 65), gerendert über src/components/rechtstexte/agb-ansicht.tsx. AGB 1.0 ist ein eigener /fix.
- /impressum: „Pilotbetrieb … Kein kommerzieller Betrieb.“ (impressum/page.tsx Z. 38). Inhalte laufen über den Projektauftrag A001. Es nutzt src/components/shared/infoseite-stil.ts wie /agb, /datenschutz, /konditionen.

Werkzeug
- Kein Unteragent „sichter“. Die Bilder macht der Umsetzer selbst (4a Punkt 6 b).

══════════════════════════════════════════════════════════════════════
STAND – vor dem Start prüfen, sonst STOPP und melden
══════════════════════════════════════════════════════════════════════
- main enthält 056a321e oder später. Ist etwas dazugekommen, die Ausgangslage je Nummer am Code neu bestätigen (Morgenbericht ganz oben).
- Mockups (Übergabe ohne Henne-Ei):
  - Die Projektleitung hat vor dem Start im lokalen Arbeitsordner auf main die 304 Dateien der Soll-Liste unten nach docs/mockups/redesign-2026-11/ entpackt (unversioniert, kein ZIP im Repo).
  - Der Dirigent legt docs/lauf30 von main an. Unversionierte Dateien bleiben beim Anlegen erhalten.
  - Er vergleicht den Ordner mit der Soll-Liste: genau diese 304 Namen, nichts mehr, nichts weniger. Kein canvas.json, kein Main/h*/k*/hof-vorher/kunde-vorher.
  - Abweichung: STOPP.
  - Erst der Doku-PR committet sie. Keine Nummer startet vor dem Commit.
- Prüfung der Mockups vor dem Commit, sonst STOPP:
  - `pnpm vitest run tests/telefonnummern-wache.test.ts` grün (keine Ausnahmen für Mockups anlegen)
  - Namen nur aus der Beispielwelt
  - E-Mail-Adressen nur @beispiel.at bzw. Plattform-Adressen @agrilo.at
  - Skripte nur `<script src="./support.js">` und `<script type="text/x-dc">`; externe Verweise nur der Google-Fonts-Link (wie in den bestehenden Mockups)
- agent-browser läuft lokal; `TEST_DATABASE_URL` zeigt auf localhost.
- `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint` (0 Fehler) und `pnpm test` sind grün. pnpm test sieht die unversionierten Mockups schon (Telefonnummern-Wache).
- Stripe ist in Vorschau und Produktion im Testmodus (Umgebungsbanner, nie entschlüsseln).

Soll-Liste docs/mockups/redesign-2026-11/ (304 Dateien; der Doku-PR schreibt sie als LISTE.txt dazu, ein Name je Zeile):
  s1- (36):
    s1-bestaetigung-dunkel.dc.html s1-bestaetigung.dc.html s1-bestellung-dunkel.dc.html
    s1-bestellung-link-dunkel.dc.html s1-bestellung-link.dc.html s1-bestellung.dc.html
    s1-bestellungen-dunkel.dc.html s1-bestellungen.dc.html s1-einstellungen-dunkel.dc.html
    s1-einstellungen.dc.html s1-heute-dunkel.dc.html s1-heute.dc.html s1-hoefe-dunkel.dc.html s1-hoefe.dc.html
    s1-hofseite-dunkel.dc.html s1-hofseite.dc.html s1-kasse-dunkel.dc.html s1-kasse.dc.html
    s1-korb-dunkel.dc.html s1-korb.dc.html s1-mehr-neu-dunkel.dc.html s1-mehr-neu.dc.html
    s1-mein-hof-dunkel.dc.html s1-mein-hof.dc.html s1-meine-bestellungen-dunkel.dc.html
    s1-meine-bestellungen.dc.html s1-produkt-dunkel.dc.html s1-produkt-neu-dunkel.dc.html
    s1-produkt-neu.dc.html s1-produkt.dc.html s1-produkte-dunkel.dc.html s1-produkte.dc.html
    s1-region-dunkel.dc.html s1-region.dc.html s1-startseite-dunkel.dc.html s1-startseite.dc.html
  s2- (35):
    s2-abmelden-dunkel.dc.html s2-abmelden.dc.html s2-anmelden-dunkel.dc.html s2-anmelden.dc.html
    s2-auswertung-dunkel.dc.html s2-auswertung.dc.html s2-beitraege-dunkel.dc.html s2-beitraege.dc.html
    s2-druck.dc.html s2-hofdaten-zahlung-dunkel.dc.html s2-hofdaten-zahlung.dc.html
    s2-konto-hof-dunkel.dc.html s2-konto-hof.dc.html s2-kunden-dunkel.dc.html s2-kunden.dc.html
    s2-kundenkonto-dunkel.dc.html s2-kundenkonto.dc.html s2-meldungen-dunkel.dc.html s2-meldungen.dc.html
    s2-neuigkeiten-dunkel.dc.html s2-neuigkeiten.dc.html s2-passwort-dunkel.dc.html s2-passwort.dc.html
    s2-postfach-dunkel.dc.html s2-postfach.dc.html s2-registrieren-dunkel.dc.html s2-registrieren.dc.html
    s2-systemseiten-dunkel.dc.html s2-systemseiten.dc.html s2-teilen-dunkel.dc.html s2-teilen.dc.html
    s2-verkaeufe-dunkel.dc.html s2-verkaeufe.dc.html s2-whatsapp-plakat-dunkel.dc.html
    s2-whatsapp-plakat.dc.html
  s3- (41):
    s3-admin-akte-dunkel.dc.html s3-admin-akte.dc.html s3-admin-bestellungen-dunkel.dc.html
    s3-admin-bestellungen.dc.html s3-admin-betrieb-dunkel.dc.html s3-admin-betrieb.dc.html
    s3-admin-einstellungen-dunkel.dc.html s3-admin-einstellungen.dc.html s3-admin-freischalten-dunkel.dc.html
    s3-admin-freischalten.dc.html s3-admin-geld-dunkel.dc.html s3-admin-geld.dc.html
    s3-admin-heute-dunkel.dc.html s3-admin-heute.dc.html s3-admin-hoefe-dunkel.dc.html s3-admin-hoefe.dc.html
    s3-admin-postfach-dunkel.dc.html s3-admin-postfach.dc.html s3-admin-shell-dunkel.dc.html
    s3-admin-shell.dc.html s3-admin-startseite-dunkel.dc.html s3-admin-startseite.dc.html
    s3-admin-zugang-dunkel.dc.html s3-admin-zugang.dc.html s3-fehlerseiten-dunkel.dc.html
    s3-fehlerseiten.dc.html s3-mail-betrieb.dc.html s3-mail-hof-bestellung.dc.html s3-mail-hof-konto.dc.html
    s3-mail-kauf.dc.html s3-mail-neuigkeiten.dc.html s3-mail-sicherheit.dc.html s3-mail-storno.dc.html
    s3-mail-team.dc.html s3-mail-zugang.dc.html s3-problem-melden-dunkel.dc.html s3-problem-melden.dc.html
    s3-rechtstexte-dunkel.dc.html s3-rechtstexte.dc.html s3-widerruf-dunkel.dc.html s3-widerruf.dc.html
  t- (40):
    t-a-tarifzeile-dunkel.dc.html t-a-tarifzeile.dc.html t-b-produkte-dunkel.dc.html t-b-produkte.dc.html
    t-b2-zaehlweise-dunkel.dc.html t-b2-zaehlweise.dc.html t-b3-zustaende-dunkel.dc.html
    t-b3-zustaende.dc.html t-c-abholzeiten-dunkel.dc.html t-c-abholzeiten.dc.html t-d-packliste-dunkel.dc.html
    t-d-packliste.dc.html t-e-pause-urlaub-dunkel.dc.html t-e-pause-urlaub.dc.html
    t-f-konditionen-dunkel.dc.html t-f-konditionen.dc.html t-g-auswahl-dunkel.dc.html t-g-auswahl.dc.html
    t-h-hofladen-waehlen-dunkel.dc.html t-h-hofladen-waehlen.dc.html t-i-kuendigen-dunkel.dc.html
    t-i-kuendigen.dc.html t-j-abrechnung-dunkel.dc.html t-j-abrechnung.dc.html t-k-nachrichten-dunkel.dc.html
    t-k-nachrichten.dc.html t-l-kundenseite-dunkel.dc.html t-l-kundenseite.dc.html t-m-admin-dunkel.dc.html
    t-m-admin.dc.html t-n-region-dunkel.dc.html t-n-region.dc.html t-o-fuer-hoefe-dunkel.dc.html
    t-o-fuer-hoefe.dc.html t-p-meine-bestellungen-dunkel.dc.html t-p-meine-bestellungen.dc.html
    t-q-admin-gratiszeit-dunkel.dc.html t-q-admin-gratiszeit.dc.html t-r-admin-freischalten-dunkel.dc.html
    t-r-admin-freischalten.dc.html
  w- (40):
    w-a-tarifzeile-dunkel.dc.html w-a-tarifzeile.dc.html w-b-produkte-dunkel.dc.html w-b-produkte.dc.html
    w-b2-zaehlweise-dunkel.dc.html w-b2-zaehlweise.dc.html w-b3-zustaende-dunkel.dc.html
    w-b3-zustaende.dc.html w-c-abholzeiten-dunkel.dc.html w-c-abholzeiten.dc.html w-d-packliste-dunkel.dc.html
    w-d-packliste.dc.html w-e-pause-urlaub-dunkel.dc.html w-e-pause-urlaub.dc.html
    w-f-konditionen-dunkel.dc.html w-f-konditionen.dc.html w-g-auswahl-dunkel.dc.html w-g-auswahl.dc.html
    w-h-hofladen-waehlen-dunkel.dc.html w-h-hofladen-waehlen.dc.html w-i-kuendigen-dunkel.dc.html
    w-i-kuendigen.dc.html w-j-abrechnung-dunkel.dc.html w-j-abrechnung.dc.html w-k-nachrichten-dunkel.dc.html
    w-k-nachrichten.dc.html w-l-kundenseite-dunkel.dc.html w-l-kundenseite.dc.html w-m-admin-dunkel.dc.html
    w-m-admin.dc.html w-n-region-dunkel.dc.html w-n-region.dc.html w-o-fuer-hoefe-dunkel.dc.html
    w-o-fuer-hoefe.dc.html w-p-meine-bestellungen-dunkel.dc.html w-p-meine-bestellungen.dc.html
    w-q-admin-gratiszeit-dunkel.dc.html w-q-admin-gratiszeit.dc.html w-r-admin-freischalten-dunkel.dc.html
    w-r-admin-freischalten.dc.html
  w1- (36):
    w1-bestaetigung-dunkel.dc.html w1-bestaetigung.dc.html w1-bestellung-dunkel.dc.html
    w1-bestellung-link-dunkel.dc.html w1-bestellung-link.dc.html w1-bestellung.dc.html
    w1-bestellungen-dunkel.dc.html w1-bestellungen.dc.html w1-einstellungen-dunkel.dc.html
    w1-einstellungen.dc.html w1-heute-dunkel.dc.html w1-heute.dc.html w1-hoefe-dunkel.dc.html w1-hoefe.dc.html
    w1-hofseite-dunkel.dc.html w1-hofseite.dc.html w1-kasse-dunkel.dc.html w1-kasse.dc.html
    w1-korb-dunkel.dc.html w1-korb.dc.html w1-mehr-neu-dunkel.dc.html w1-mehr-neu.dc.html
    w1-mein-hof-dunkel.dc.html w1-mein-hof.dc.html w1-meine-bestellungen-dunkel.dc.html
    w1-meine-bestellungen.dc.html w1-produkt-dunkel.dc.html w1-produkt-neu-dunkel.dc.html
    w1-produkt-neu.dc.html w1-produkt.dc.html w1-produkte-dunkel.dc.html w1-produkte.dc.html
    w1-region-dunkel.dc.html w1-region.dc.html w1-startseite-dunkel.dc.html w1-startseite.dc.html
  w2- (35):
    w2-abmelden-dunkel.dc.html w2-abmelden.dc.html w2-anmelden-dunkel.dc.html w2-anmelden.dc.html
    w2-auswertung-dunkel.dc.html w2-auswertung.dc.html w2-beitraege-dunkel.dc.html w2-beitraege.dc.html
    w2-druck.dc.html w2-hofdaten-zahlung-dunkel.dc.html w2-hofdaten-zahlung.dc.html
    w2-konto-hof-dunkel.dc.html w2-konto-hof.dc.html w2-kunden-dunkel.dc.html w2-kunden.dc.html
    w2-kundenkonto-dunkel.dc.html w2-kundenkonto.dc.html w2-meldungen-dunkel.dc.html w2-meldungen.dc.html
    w2-neuigkeiten-dunkel.dc.html w2-neuigkeiten.dc.html w2-passwort-dunkel.dc.html w2-passwort.dc.html
    w2-postfach-dunkel.dc.html w2-postfach.dc.html w2-registrieren-dunkel.dc.html w2-registrieren.dc.html
    w2-systemseiten-dunkel.dc.html w2-systemseiten.dc.html w2-teilen-dunkel.dc.html w2-teilen.dc.html
    w2-verkaeufe-dunkel.dc.html w2-verkaeufe.dc.html w2-whatsapp-plakat-dunkel.dc.html
    w2-whatsapp-plakat.dc.html
  w3- (41):
    w3-admin-akte-dunkel.dc.html w3-admin-akte.dc.html w3-admin-bestellungen-dunkel.dc.html
    w3-admin-bestellungen.dc.html w3-admin-betrieb-dunkel.dc.html w3-admin-betrieb.dc.html
    w3-admin-einstellungen-dunkel.dc.html w3-admin-einstellungen.dc.html w3-admin-freischalten-dunkel.dc.html
    w3-admin-freischalten.dc.html w3-admin-geld-dunkel.dc.html w3-admin-geld.dc.html
    w3-admin-heute-dunkel.dc.html w3-admin-heute.dc.html w3-admin-hoefe-dunkel.dc.html w3-admin-hoefe.dc.html
    w3-admin-postfach-dunkel.dc.html w3-admin-postfach.dc.html w3-admin-shell-dunkel.dc.html
    w3-admin-shell.dc.html w3-admin-startseite-dunkel.dc.html w3-admin-startseite.dc.html
    w3-admin-zugang-dunkel.dc.html w3-admin-zugang.dc.html w3-fehlerseiten-dunkel.dc.html
    w3-fehlerseiten.dc.html w3-mail-betrieb.dc.html w3-mail-hof-bestellung.dc.html w3-mail-hof-konto.dc.html
    w3-mail-kauf.dc.html w3-mail-neuigkeiten.dc.html w3-mail-sicherheit.dc.html w3-mail-storno.dc.html
    w3-mail-team.dc.html w3-mail-zugang.dc.html w3-problem-melden-dunkel.dc.html w3-problem-melden.dc.html
    w3-rechtstexte-dunkel.dc.html w3-rechtstexte.dc.html w3-widerruf-dunkel.dc.html w3-widerruf.dc.html

══════════════════════════════════════════════════════════════════════
ENTSCHIEDEN (Stand 03.11.2026, Vorgaben V1–V92; alles hier ist Auftrag, keine Rückfrage)
══════════════════════════════════════════════════════════════════════

Maßstab
- Gültig sind die Mockups in docs/mockups/redesign-2026-11/. Sie gehen älteren Mockups derselben Route vor.
- Je Board gilt die Notiz über den Bildern (erster <p>). Ihre Sätze mit „Abweichung vom Code“ bzw. „Code: …“ sind die Änderungsliste, außer wo dieser Text etwas anderes festlegt (Frist, Rücktritt-Einstiege, Reply-To).
- Beispieldaten sind kein Bauauftrag: Namen, Daten, Fristen, Beträge, Bestellnummern, Zähler, Adressen der Beispielwelt (Stand Mi 3. März 2027). Die Mockups werden darin noch nachgezogen.
- Gebaut werden Aufbau, Wortlaut der Oberfläche, Zustände, Farben, Abstände.
- t-*/w-* (Tarif-Boards) sind Vorschlag (Tarife als Abrechnung: offen, nicht im Register). Gebaut wird daraus nur, was ein s1–s3-Board zeigt oder was der Code schon hat (Tarif-Zeile, „Deine Konditionen“, Packliste, /fuer-hoefe).
- Recht und Gesetz gehen dem Mockup vor (Register N2-Ergänzung 1.11.2026). In der Kasse bleiben KaufZusammenfassung unmittelbar über dem Kaufknopf (210), Gewährleistungs-Grafik dazwischen (211) und AGB- und Rücktrittssatz unter jedem Kaufknopf (215).
- Was ein Mockup nicht zeigt: nach DESIGN_SYSTEM „Zustände“.

N41 (Projekt E-014, Welle 1)
- a) Mindestbestellwert nach A3. Neu und daneben: mindestbestellwertHinweis(fehlendCents, hundertstel) in src/lib/konditionen.ts. „ab € 10,60“ über gebuehrJeStueckCents mit dem Satz des Hofs, nie als Literal.
  - MINDESTBESTELLWERT_SATZ bleibt unverändert (Meldung von /api/checkout, Geld-Tests).
  - Vor dem Stichtag gibt es keinen Mindestbestellwert (mindestbestellwertGrund bleibt dort null).
- b) Pause ohne Enddatum. Nur die freie Nachricht des Hofs. Kein „Nächste Abholung“ bei pausiertem Hof; im Mini-Warenkorb steht der Grund statt „Zur Kasse“ (V6).
- c) „Warenkorb · n“ im Kopf der Kundschaft nur bei gefülltem Warenkorb (V12).
- d) Web-Dialoge:
  - „Neu“ = Dropdown unter „+ Neu ▾“
  - Warenkorb = Blatt von rechts, max. 448 px, volle Höhe
  - alles andere = zentrierter Dialog, max. 560 px, genau ein Schließen-Element
  - Toasts nur im Inhaltsbereich
  - DESIGN_SYSTEM „Dialoge und Blätter“ (heute 480–820 px) wird angepasst.
- e) Zähler „Bestellungen“ = alles, was nicht abgeholt, storniert oder verfallen ist, inkl. „Bestätigung offen“: OPEN_STATUSES, eine Quelle. Überall dieselbe Zahl: Unterleiste, Seitenleiste, Chip „Noch offen · n“. „Noch zu packen“ in Heute zählt nur bestätigte und bezahlte, nicht gepackte Bestellungen mit Abholung heute; die nächste Abholung nennt ihre Zahl in ihrer Zeile (V40).
- f) Kaufknopf grün.

N42 (Projekt E-015, Welle 2)
- a) Hauptknopf im Hofbereich orange.
- b) Kundschaft grün, Hof-Eingänge orange:
  - Die Hof-Karte in /login bleibt orange.
  - Seiten in der KundeShell sind grün, auch wenn ein Hof sie öffnet (V52).
  - Gemeinsamer Baustein „Problem melden“ mit Farbe je Welt (V51).
- c) Wortliste vor Code:
  - Beitrags-Anlass „Hinweis“ statt „Mitteilung“. Nur das Etikett, Enum ANNOUNCEMENT bleibt. „Neuigkeit“ im Mail-Board ist ein Fehler im Board: Das Wort steht in der Wortliste unter „nicht“.
  - „Hofseite“ zusammen.
  - „Anmelde-Adresse“ statt „Login-E-Mail“.
  - Seite und Knopf „Hofdaten“ / „Hofdaten speichern“ / „Hofdaten gespeichert“ (V43, V49).
  - Papier = Bildschirm: „Zum Packen“, „Wartet auf Kunde“, „Bar bei Abholung“; in Mails „Bar-Bestellung bestätigt“ (V57).
  - „Bei Heute ansehen →“ statt „Im Dashboard ansehen →“.
  - „Tipp auf den Knopf“.
  - „Neuigkeiten“ statt „E-Mail-Updates“, Knopf „Zu <Hof>“.
  - Admin-Jahresansicht „Geld“ (N32).
  - „Stripe Live“ einheitlich.
  - Postfach nach N14: „Auf die meisten Nachrichten kannst du antworten.“ (V54)
- d) Beim Stilllegen „Hof“ statt „Hofladen“: „Deinen Hof dauerhaft schließen.“ (V55)
- e) Balken je Stand (V59):
  - Solange Einrichtungsschritte offen sind: „Richte deinen Hof fertig ein – Kundinnen sehen ihn noch nicht“.
  - Danach: „Dein Hof wird noch geprüft – Kundinnen sehen ihn noch nicht“, mit Halbgeviertstrich.
  - Schritte aus src/lib/einrichten.ts, keine zweite Zählung.
- g) Überall „Lastschrift einrichten“, Marke „Braucht Lastschrift“. Beim Einrichten ein Hinweis, kein Schritt; zählt nicht in „x von 5“ (V61, V71).

N43 Rücktritt (Projekt E-017; V73, V88)
- Nutzertexte sagen „Rücktritt“, „Rücktrittsrecht“, „vom Kauf zurücktreten“, nie „Widerruf“. Die Route /widerruf bleibt. Seitentitel und Überschriften heißen „Rücktrittsrecht“. Die übrigen Texte der Seite stehen im Mockup s3/w3-widerruf: „Wovon möchtest du zurücktreten?“, „Bitte prüfe deinen Rücktritt“, „Dein Rücktritt ist bei uns eingegangen“, „Von dieser Bestellung kannst du hier nicht mehr zurücktreten.“
- Wörtlich bleiben bis zur Entscheidung der Anwältin (V88; Recht vor Anfrage):
  - (1) die Beschriftung der Online-Funktion nach § 13a FAGG, wie N39 sie festlegt: die Einstiege „Vertrag widerrufen“ (Mails, Bestätigung, Bestellseite, Fuß jeder Kundenseite; WIDERRUF_TEXT.fussLink) und die Knöpfe „Vertrag widerrufen“ und „Widerruf bestätigen“. Das Mockup zeigt hier andere Wörter; der Code behält N39. Im PR unter „Offen für Recht“.
  - (2) Belehrung Teil A/B und Muster-Formular nach Anhang I FAGG (src/lib/widerruf.ts ab Z. 318, src/emails/belehrung-teil.tsx)
  - (3) die AGB (src/lib/rechtstexte/agb.ts)
  - (4) die Datenschutzerklärung als ganze Datei
  - (5) jeder Text zum Widerruf einer Einwilligung (Abo, Neuigkeiten, Datenschutz). Das ist kein Rücktritt; dort bleibt „widerrufen“.
- Bezeichner, Routen, Datenbankfelder bleiben.
- „Offen für Recht“: gemischte Begriffe auf einer Seite (Rücktritt in der Oberfläche, Widerruf in Belehrung und Knöpfen). Ein erklärender Satz nur mit Freigabe.

N44 Gründungszeit (Projekt E-018; V81)
- „Monate ohne Grundgebühr“ in Admin › Einstellungen › Gründungshöfe, Zielwert 12. Beginn am späteren Tag von Tarifstart und Freischaltung (gebaut: zusageEnde).
- Folge für das Geld (A2): Das Gründungs-Ende bestimmt auch den Einzugsbeginn der Bargebühr aus N38. Gründungshöfe zahlen sie ab dem Tag nach ihrem Gründungs-Ende (einzugAbFuer).
  - Höfe, die vor dem Tarifstart freigegeben sind: ab 1.2.2028 statt ab 1.2.2029 (bei 24 Monaten).
  - Am festen Datum heute (Art „bisher“, Standard 31.12.2027) wäre es der 1.1.2028.
  - Der Lauf ändert einzugAbFuer nicht.
- Code-Änderung:
  - GRUENDUNG_MONATE_STANDARD = 12
  - „Monate nur erhöhen“ gilt erst nach dem Festschreiben (gruendungFestAm gesetzt). Vorher ist 1 bis GRUENDUNG_MONATE_MAX frei.
  - Keine Zusage wird kürzer (K1): festschreibenListe nimmt den späteren Tag. Ein eigenes gruendungBis je Hof bleibt.
- Kein Senken nach dem Festschreiben (unverändert).
- Spalten-Default 24 bleibt (keine Migration); Kommentar an der Konstante: „Standard nur, wenn die Zeile fehlt; Produktion trägt den Wert in der Zeile.“
- Texte: „12 Monate ohne Grundgebühr ab der Freischaltung, frühestens ab Tarifstart“ (Zahl aus der Einstellung).
- Die Gründungsaktion bleibt: Freischaltung bis zum Stichtag „Aktion bis“, heute 31.3.2027. Kein Text sagt „Anmeldung bis“.
- Der Zähler der Gründungsplätze bleibt wie im Code (12 oder 100: offen).

Gebühr (V62, V63)
- Ab dem Stichtag „Hofpreis-Modell ab“ heißt es überall „Plattformgebühr“, auch im Admin. Bestellungen im Modell „bisher“ zeigen weiter „Servicegebühr“, immer über gebuehrBezeichnungFuer bzw. gebuehrHinweisFuer.
- Summen über einen Zeitraum: gebuehrWortFuerZeitraum(von, bis, stichtag).
  - ganz vor dem Stichtag → „Servicegebühr“
  - ganz ab dem Stichtag → „Plattformgebühr“
  - beides → „Gebühren“
  - maßgeblich ist createdAt der Bestellung (wie gebuehrModell)
- Akte: nach A1.
- Freischalt-Dialog: KONDITIONEN_DERZEIT ab dem Stichtag nach N38 (Wortlaut w3-admin-freischalten).
- Hofpreis-Stichtag nach Erreichen: „Seit diesem Tag gilt …“ ohne „Vorher bleibt alles wie heute.“
- Startseite „Beispiel“ ab dem Stichtag über bestellGebuehr (nur Anzeige, Wortlaut w1-startseite).
- Futter-Vorschau je Stichtag.
- Storno-Dialog je Modell der Bestellung. Der Hofpreis-Text beschreibt den Weg aus stornieren.ts (die Gebühr wird mit erstattet); beim Umsetzen gegen den Code belegen.

Rechtstexte (V62)
- Eine neue Vorlage neben infoseite-stil.ts für /agb, /datenschutz, /konditionen (nach s3/w3-rechtstexte):
  - Kicker, h1, Stand-Zeile direkt unter dem Titel, „Drucken/Speichern“
  - Inhaltsverzeichnis: ab 1024 px als Spalte, am Handy aufklappbar „Inhalt“
  - Abschnitte, Fuß „Stand: …“
- Die bestehenden Exporte von infoseite-stil.ts bleiben unverändert, denn /impressum nutzt sie (A001).
- Wortlaut von AGB und Datenschutz unverändert. Keine neuen Rechtssätze außer dem Konditionen-Abschnitt unten.
- /konditionen ab dem Stichtag: Abschnitt „Plattformgebühr und Abrechnung“:
  „6 % je Stück aufgerundet (Standard; ist für einen Hof ein anderer Satz eingetragen, zeigt die Seite für ihn diesen), Mindestbestellwert 10 € Warenwert, online behält Stripe die Gebühr ein (der Hof ist Händler), bar zieht Agrilo sie monatlich per SEPA-Lastschrift ein, fällig erst mit ‚Abgeholt‘; Gründungshöfe erst nach ihrer Laufzeit, bis dahin ohne Mandat.“
  - Aufbau nach w3-rechtstexte Bild 6, Zahlen aus konditionen.ts.
  - Darüber steht die Kennzeichnung „Entwurf – die Anwältin prüft den Wortlaut“, bis die Projektleitung sie entfernt (wie AGB 0.9).
  - Im PR unter „Offen für Recht“; im Morgenbericht unter „Für dich zu tun“: Freigabe vor dem Stichtag (N38: Rechtstexte nach Rückmeldung der Anwältin).

E-Mails (V68, V72, V78, V79, V86, V87)
- Fuß je Absender:
  - „Versandt von Agrilo im Auftrag eines Hofes.“ nur bei Bestellmails an die Kundin (Vertrag Kundin–Hof)
  - Konto-, Code-, Passwort-, Sicherheits-, Freischalt-, Lastschrift-, Team-Mails und Mails an den Hof: „Versandt von Agrilo.“
  - Betriebs-Mails und Postfach behalten ihren Fuß.
  - Beitrags-Mails: „Im Auftrag von <Hofname> · versandt von Agrilo“
- Anbieterzeile unter dem Fuß (außer Betriebs-Mails): „Agrilo · agrilo.at/impressum“ als Link. Keine Betreiberdaten im Code (A001, öffentliches Repo).
- „Offen für Recht“: ECG § 6, MedienG § 24/25, ob die Anschrift des Hofs in den Fuß der Beitrags-Mail gehört.
- Reply-To (V86):
  - nur die Hof-E-Mail aus dem Profil (farm.email), nur wenn sie gesetzt ist (!hofEmailFehlt(farm)); sonst kein Reply-To
  - nie die Anmelde-Adresse, nie hofKontaktEmail (src/lib/hof-kontakt.ts, Kopfkommentar)
  - nur bei Bestellmails an die Kundin
  - gelesen beim Versand aus Bestellung bzw. Hof des MailAuftrags, keine neue Spalte
  - die Option des Resend-SDK (resend ^6.12.4) per Typ prüfen
- Bar-Frist (V87):
  - „Bitte bestätige“ nennt die Frist aus fristVon (src/lib/fristen.ts), wie heute.
  - Der Satz „… nach spätestens zwei Stunden wieder frei.“ (Z. 105) entfällt; er nennt die Frist doppelt und unvollständig.
  - fristen.ts bleibt unverändert.
  - Fristen in Boards („bis Freitag, 18:00“) sind Beispieldaten.
- Knöpfe mindestens 44 px: ctaButton padding '13px 18px'.
- Abmeldung bleibt: Abmelde-Link, manageUrl und List-Unsubscribe/-Post in jeder Beitrags-Mail unverändert.
- Wörter nach N42 c und N43. Nach N38 keine Zeile „Servicegebühr“, sondern „Alle Preise inkl. Plattformgebühr (darin …)“ (gebaut; die alte Zeile nur bei bisher-Bestellungen). Mails nur hell.

Muster aus den Vorgaben (für alle Nummern; Wortlaute aus den Boards)
- V9 Tage immer mit Wochentag und Datum.
- V10 Unterleiste Kundschaft „Entdecken · [Warenkorb] · Bestellungen“ mit erhobenem grünem Mittelknopf 54 px; V28 nichts liegt unter dem Überstand.
- V12 Kopf Kundschaft im Web:
  - Reihenfolge: Höfe entdecken · So funktioniert’s · Für Höfe · Meine Bestellungen
  - Startseite ohne aktiven Punkt
  - „Anmelden“ als Umriss-Pille 44 px
- V13 Seitenleiste Hof:
  - „Abmelden“ unter Konto
  - Tarif-Datum mit geschütztem Leerzeichen
  - Theme-Symbol Sonne/Mond aus lucide
- V15 Bild-Platzhalter ohne Dateinamen, dunkel mit eigenem Verlauf, im Formular „Foto hinzufügen“.
- V16 Textlinks mit Trefferfläche ≥ 44 px.
- V17 Feldfehler orange mit aria-invalid; Karten-Ablehnung als orange Hinweiskarte; Speicherfehler mit „Nochmal“.
- V18 Pausierter Hof in Listen ausgegraut, gestrichelt, neutraler Text.
- V19 „Ausverkauft“ neutral.
- V21 Knopf „In den Korb“, sonst „Warenkorb“.
- V22 Hof-Marken:
  - „Zum Packen“ (orange)
  - „Bestätigung offen“ bzw. in der Packliste „Wartet auf Kunde“
  - Knopf „Als gepackt markieren“ (V40)
- V25 Hofseite ab 768 px Kacheln mit „In den Korb“.
- V26 „Meine Bestellungen“: „Abmelden“ in der Karte heißt „Ansicht beenden“.
- V29 Keine Mockup-Notizen in der Oberfläche.
- V36 Region: gebauter Stand; kein „← Zurück“ auf Seiten aus der Seitenleiste.
- V37 Restzeit unter einem Monat in Wochen bzw. Tagen.
- V44 Druck nur hell.
- V47 Web-Formulare: Knöpfe am Formularende, feste Leisten nur, wo der Code sie hat.
- V64 Admin › Höfe Standard „Braucht Blick“.
- V65 Freischalt-Dialog zeigt die Platzvergabe (gebaut).
- V67, V85 sind nur Beispieldaten.

Technik für alle Nummern
- Nur Tokens aus DESIGN_SYSTEM, keine Hexwerte, keine Palette-Klassen; jede Änderung hell und dunkel; data-design="neu" bleibt an jeder Shell.
- FOKUS_RAHMEN, Touch-Ziele ≥ 44 px über die Grundbausteine bzw. TREFFER_44, Text ≥ 4,5:1, Feldränder ≥ 3:1.
- Bausteine aus docs/ai/BAUSTEINE.md benutzen oder additiv erweitern; nach Änderung `pnpm bausteine`.
- Texte als Konstanten in src/lib/* (eine Quelle).

══════════════════════════════════════════════════════════════════════
UMSETZUNG
══════════════════════════════════════════════════════════════════════

§0 Zuordnung
- Modell:
  - Doku-PR und Regel-Inventur mit Sonnet; alle Nummern mit Opus
  - tester mit Sonnet; pruefer mit Opus, höchstens 22 Schritte je Aufruf
- Prüfdurchgänge:
  - voller Durchgang für 221 (Geschäftsregel, Geld-Anzeige), 227 (Kasse), 229 (Admin-Aktionen), 231 (Recht), 232 (Mails, Recht, Daten)
  - gezielt für die übrigen
- pnpm test:integration:
  - jede Nummer, die eine Server-Action, eine Abfrage oder eine Mail ändert
  - 221 ganz
  - im Sammel-PR ganz
- Bilder (Pflicht, 4a Punkt 6 b, Umsetzer selbst):
  - jede geänderte Route bei 390 und 1440 px, hell und dunkel, je Zustand des Boards
  - unter .nachtlauf/screens/<nr>/<board>-<bild>.png
  - Admin-Bilder hinter Passkey macht die Projektleitung
  - späteste Uhrzeit bei zeitabhängigen Bildern in der Lesemappe
- Lesemappe (alle):
  - CLAUDE.md §2, CODING_STANDARDS und TESTING_GUIDELINES ganz
  - DESIGN_SYSTEM nur „Farbtokens“, „Komponenten“, „Wortliste“, „Zustände“, „Dialoge und Blätter“ und die eigenen Routen
  - ARCHITECTURE §5, BAUSTEINE.md, Register N8, N38, N39, K2 und N41–N44
  - die Boards der Nummer
  - die Liste „Abweichung vom Code“ der Nummer (per Skript aus dem ersten <p> je Board: Sätze mit „Abweichung“ oder „Code:“, in den Bericht)

§1 Warteschlange (fest)
- Doku-PR (docs/lauf30, siehe Stand)
- Regel-Inventur (G4, nur lesen; Quellen und Form nach nachtlauf.md §4; höchstens 20 Vorschläge; Ergebnis im Morgenbericht unter „Regelvorschläge“)
- Welle 1, von docs/lauf30: 219
- Welle 2, vom Zwischenstand integration/lauf30 nach 219: 220 ∥ 221
- Welle 3, vom Zwischenstand nach 219, 220 und 221 (voller lokaler Lauf grün): 227 ∥ 222 ∥ 226, dann nach freien Plätzen 232, 231, 229, 230, 224, 223, 225, 228
- Höchstens drei Umsetzer gleichzeitig.
- Sammel-PR integration/lauf30 (Haltepunkt), Merge per Merge-Commit.
- Branches nacht/<datum>/<nr>-<kurz>.
- Priorität: 219 → 221 → 220 → 227 → 222 → 226 → 232 → 231 → 229 → 230 → 224 → 223 → 225 → 228. Nicht begonnene Nummern bleiben „offen“; die nächste Nacht setzt nach §7 fort.
- 219 nach zwei Runden nicht fertig: STOPP des Laufs. 220 nicht fertig: in Welle 3 nur 221-abhängige Nummern ohne Shell-Teil (227, 232, 231), mit Bericht.

Dateigrenzen (nie zwei Nummern an derselben Datei außerhalb dieser Grenzen)
- Nacheinander geteilt:
  - docs/ai/DESIGN_SYSTEM.md (je Nummer eigener Abschnitt)
  - DEVELOPMENT.md (je ein Eintrag)
  - docs/ai/BAUSTEINE.md (nur über `pnpm bausteine`)
- Bestandslisten ohne Konflikt:
  - 219 legt für jede spätere Nummer eine Datei tests/wortliste-offen/<nr>.ts an, mit den Fundstellen der neuen „nicht“-Wörter in Dateien dieser Nummer.
  - 221 legt tests/gebuehr-wort-offen/<nr>.ts an (Fundstellen „Servicegebühr“ ohne Bedingung).
  - Jede Nummer leert und löscht nur ihre eigene Datei; die Wachen lesen den Ordner.
  - Fundstellen in Dateien ohne Nummer oder mit wörtlichem Rechtstext kommen nicht in eine Offen-Datei, sondern in AUSNAHMEN bzw. AUSNAHME_DATEIEN mit Grund („Recht prüft“, „Einwilligung“): datenschutz/page.tsx, agb.ts, Belehrung und N39-Beschriftung in widerruf.ts, Betreff in src/emails/widerruf.tsx. Liste im Bericht von 219.
  - Im Sammel-PR sind beide Ordner leer.

Doku-PR (docs/lauf30, Sonnet, ohne Code)
1. Mockups:
   - Ordner gegen die Soll-Liste prüfen und die Prüfungen aus „Stand“ ausführen.
   - docs/mockups/redesign-2026-11/LISTE.txt (Anzahl in Zeile 1, dann ein Name je Zeile) dazulegen.
   - Die Dateien unverändert committen (Canvas-Exporte, ohne support.js lesbar; nicht umbauen).
   - Commit mit Präfix docs:.
2. docs/mockups/README.md:
   - Abschnitt „Redesign November 2026 (gilt vor älteren Mockups derselben Route)“: Board · Handy · Web · Route im Code · Arbeit · Nummer
   - t-/w-Boards: „Vorschlag (Tarife als Abrechnung offen) – gebaut nur, was s1–s3 zeigen“
   - t-n/w-n: „Vorschlag Preise vergleichen v2 (PR #329, offen) – nicht bauen“
   - Kasse: „Recht vor Mockup: Zusammenfassung unmittelbar über dem Kaufknopf, Gewährleistungs-Grafik, Sätze unter jedem Kaufknopf (210, 211, 215)“
   - widerruf/Mails: „Online-Rücktrittsfunktion: Wortlaut nach N39, bis die Anwältin entscheidet“
   - Fristen in Boards sind Beispieldaten (Regel src/lib/fristen.ts)
3. docs/entscheidungen.md, wörtlich (nächste freie Kennungen nach N40):
   - „### N41 · Redesign Welle 1 (3.11.2026; Projekt E-014): Mindestbestellwert als ‚Waren für 10 € (mit Plattformgebühr ab € 10,60). Dir fehlen noch Waren für € X.‘; Pause ohne Enddatum; ‚Warenkorb · n‘ nur bei gefülltem Warenkorb; Web-Dialoge: Neu = Dropdown, Warenkorb = Blatt rechts (≤ 448 px), sonst zentrierter Dialog ≤ 560 px; Zähler ‚Bestellungen‘ = alles nicht Abgeholte, Stornierte oder Verfallene; Kaufknopf grün.“
   - „### N42 · Redesign Welle 2 (3.11.2026; Projekt E-015): Hauptknopf im Hofbereich orange; Kundschaft grün, Hof-Eingänge orange; Wortliste vor Code (‚Hinweis‘ statt ‚Mitteilung‘, ‚Hofseite‘, ‚Anmelde-Adresse‘, Papier = Bildschirm); ‚Hof‘ statt ‚Hofladen‘ beim Stilllegen; Balken ‚Richte deinen Hof fertig ein …‘ bzw. ‚Dein Hof wird noch geprüft …‘; ‚Lastschrift einrichten‘.“
   - „### N43 · Rücktritt in Nutzertexten (3.11.2026; Projekt E-017; ergänzt N8 und N39): In Nutzertexten heißt es ‚Rücktritt‘ bzw. ‚Rücktrittsrecht‘, nie ‚Widerruf‘. Die Route /widerruf bleibt, der Titel lautet ‚Rücktrittsrecht‘. Wörtlich bleiben bis zur Entscheidung der Anwältin: die Beschriftung der Online-Funktion nach § 13a FAGG (Einstiege und Knöpfe, N39), die Belehrung und das Muster-Formular nach Anhang I FAGG, die AGB und die Datenschutzerklärung. Der Widerruf einer Einwilligung bleibt ‚Widerruf‘.“
   - „### N44 · Gründungszeit 12 Monate (3.11.2026; Projekt E-018; ändert K2): Gründungshöfe bekommen den Hofladen 12 statt 24 Monate ohne Grundgebühr, einstellbar im Feld ‚Monate ohne Grundgebühr‘ (Admin › Einstellungen). Beginn am späteren Tag von Tarifstart und Freischaltung. Die Laufzeit bestimmt auch den Einzugsbeginn der Bargebühr aus N38 (K2-Ergänzung 26.10.2026): Gründungshöfe zahlen sie ab dem Tag nach dem Gründungs-Ende, bei Freischaltung vor dem Tarifstart also ab 1.2.2028. Das feste Datum (Art ‚bisher‘) entfällt mit dem Festschreiben. ‚Monate nur erhöhen‘ gilt erst nach dem Festschreiben; vorher ist jeder Wert von 1 bis zum Höchstwert erlaubt.“
   - Bei N8 und N39 der Verweis auf N42/N43; bei K2 auf N44.
   - Antworten A1–A3 als Ergänzungen bei N41 (A3) bzw. N38 (A1).
   - Stand-Zeile: „Stand Lauf 30 (uttoranger, 3.11.2026): N41–N44 entschieden; Redesign nach den Mockups November 2026 in Nr. 219–232 (freigabe.md §34). Keine Migration, kein Paket, keine Variable. Nicht: Ab Hof, Willkommenszeit, Zahl der Gründungsplätze, Kartenquelle, Tarife als Abrechnung, Preise vergleichen v2 (PR #329), AGB 1.0, Impressum (A001).“
4. docs/nachtlauf.md §3: Zeilen 219–232 und „Sammel 30“.
5. docs/nachtlauf/status.md:
   - 211, 215–218 und „Sammel 29“ tragen „gemergt (#447)“
   - neu 219–232 und „Sammel 30“ mit „offen“
6. Commit- und PR-Texte über eine Datei, Präfix docs:.

Die Nummern

219 Bausteine und Wortliste – Opus, gezielt, von docs/lauf30
Grenze: src/components/ui/**, src/app/intern/bausteine/**, DESIGN_SYSTEM (Wortliste, Komponenten, Dialoge), tests/wortliste.test.ts, tests/wortliste-offen/**, Tests der Bausteine.
1. Wortliste (Tabelle bleibt vierspaltig):
   - Rücktritt (nicht: Widerruf, widerrufen, Widerrufsrecht), mit Ausnahmen nach N43 (1)–(5)
   - Anmelde-Adresse (nicht: Login-E-Mail)
   - Anlass „Hinweis“ (die Ausnahme „Mitteilung“ fällt weg)
   - Bar bei Abholung (nicht: Vor-Ort-Bestellung, Barzahlung vor Ort)
   - Hofseite (nicht: Hof-Seite)
   - Hofdaten (nicht: Hof-Profil)
   - Lastschrift einrichten / Braucht Lastschrift (nicht: Mandat erteilen)
   - Knopf (nicht: Button)
   - Neuigkeiten (nicht: E-Mail-Updates)
   - Geld im Admin (nicht: Finanzen)
   - Heute in Mails (nicht: Dashboard; Ausnahme „Nur im Dashboard“ für fremde Dienste in Admin › Betrieb)
   - Zeile „Servicegebühr“: „bis zum Stichtag Servicegebühr, ab ‚Hofpreis-Modell ab‘ Plattformgebühr (N38)“
   - Zeile „Aktion“: „12 Monate (einstellbar)“
   Fundstellen nach den Dateigrenzen in die Offen-Dateien (ohne 220/221, deren Wörter tragen sie selbst) bzw. in die Ausnahmen.
2. Bausteine, je additiv als Variante, mit Vorschau in /intern/bausteine und Render-Test:
   - Dialog zentriert ≤ 560 px mit einem Schließen-Element
   - SheetBlatt rechts für den Warenkorb
   - Marke „Ausverkauft“ neutral
   - Feldfehler orange mit aria-invalid
   - Textlink mit 44-px-Fläche
   - Bild-Platzhalter ohne Dateinamen
   - Hinweiskarte mit „Nochmal“
   - Hofkarte „pausiert“
   - Darstellung des „Problem melden“-Formulars mit Ton je Welt (Logik bleibt useMeldungFormular)
3. DESIGN_SYSTEM „Dialoge und Blätter“ nach N41 d.
Tests:
- wortliste.test.ts mit Ordner-Logik
- Gegenprobe je neuem Wort (schlägt im String an, nicht im Kommentar; nicht bei Einwilligung)
- Bausteine-Render-Test
- fokus-sichtbar, grundbausteine-groesse, design-tokens, palette-klassen grün

220 Shells und Navigation – Opus, gezielt, vom Zwischenstand nach 219
Grenze: src/components/shells/**, src/lib/bauern-navigation.ts, src/lib/admin-navigation.ts, src/lib/kunden-navigation.ts, src/server/queries/orders.ts (nur Export von OPEN_STATUSES, keine Abfrage ändern), src/components/shared/theme-umschalter.tsx, src/components/hofbereich/unterseiten-kopf.tsx, Tests dazu. Eigene Fundstellen der Wortliste stellt 220 selbst um.
Boards: s1/w1-mehr-neu, s3/w3-admin-shell, Köpfe und Unterleisten aller s1–s3-Boards.
1. KundeShell: Unterleiste V10/V28, Kopf V12, „Warenkorb · n“ nur gefüllt.
2. HofShell:
   - Unterleiste Heute · Bestellungen (Zähler nach N41 e) · Neu · Mein Hof · Mehr
   - Blätter „Mehr“ und „Neu“ nach s1-mehr-neu
   - Web-Seitenleiste mit „+ Neu ▾“ als Dropdown, „Abmelden“ unter Konto, Tarif-Zeile mit geschütztem Leerzeichen, Sonne/Mond
   - Der Balken gehört zu 228.
3. AdminShell:
   - Reiter als Pillen mit 44-px-Fläche, Zahlen an Heute, Höfe, Postfach, Punkt an Betrieb
   - Betriebsleiste „Stripe Live/Test“
   - Handy-Leiste mit Blatt „Mehr“
Tests: Zähler aus OPEN_STATUSES (exportiert) gleich in Unterleiste und Seitenleiste; nichts unter dem Überstand; Fokus und 44 px.

221 Gebühren-Texte und Gründungszeit – Opus, voller Durchgang, vom Zwischenstand nach 219 (parallel zu 220)
Grenze:
- src/lib/konditionen.ts, src/lib/gruendungshof.ts, src/lib/plattform-einstellung.ts, src/schemas/plattform-einstellung.ts, src/server/actions/plattform-einstellung.ts
- src/lib/servicegebuehr.ts (nur Bezeichnung und Texte), src/lib/plattformgebuehr.ts (nur Text-Helfer, keine Rechenfunktion, einzugAbFuer unverändert), src/lib/startseite.ts (beispielRechnung)
- src/lib/kasse.ts (mindestbestellwertGrund: neuer Parameter hundertstel und der neue Satz; den Aufruf in checkout-form.tsx stellt 227 um, bis dahin optionaler Parameter mit heutigem Verhalten)
- src/lib/admin-bestellung.ts, src/lib/admin-aufgaben.ts (Geld-Kachel), src/lib/finanzen.ts (Wörter inkl. Z. 471–472), src/lib/admin-rechte.ts (Wort), src/lib/admin-finanzen-seite.ts (Titel)
- tests/gebuehr-wort-wache.test.ts (neu), tests/gebuehr-wort-offen/**, Tests dazu
Seitendateien (storno-dialog, futter-formular, hof-akte-ansicht, geld/page) fasst 221 nicht an.
1. Gründungszeit nach N44:
   - Konstante 12
   - pruefeGruendungEingabe: monateNurMehr nur bei festAm ≠ null
   - Feldhilfe „Vor dem Festschreiben frei wählbar, danach nur mehr“
   - GRUENDUNG_TEXT „aktion“ nach V81 (Wortlaut s3/w3-admin-einstellungen, s2/w2-registrieren)
   - kein „Anmeldung bis“
2. Gebühren-Wort:
   - gebuehrWortFuerZeitraum nach „Gebühr“
   - SERVICEGEBUEHR_BEZEICHNUNG nur für bisher-Bestellungen
   - Admin-Texte über gebuehrBezeichnungFuer bzw. gebuehrWortFuerZeitraum
   - admin-rechte.ts Z. 40 nur, wenn das Recht auch die Karte „Plattformgebühr“ schützt (per git grep belegen); sonst lassen, im Bericht nennen
3. Konditionen:
   - Abschnitt „Plattformgebühr und Abrechnung“ nach „Rechtstexte“, als Funktion von jetzt, mit Entwurf-Kennzeichnung
   - KONDITIONEN_DERZEIT ab dem Stichtag
   - mindestbestellwertHinweis nach A3
   - Hofpreis-Stichtag-Satz nach Erreichen
4. Startseite: beispielRechnung ab dem Stichtag über bestellGebuehr.
5. Wache tests/gebuehr-wort-wache.test.ts:
   - Jede Zeichenkette mit „Servicegebühr“ unter src/ steht in einer festen Liste mit Grund („nur Modell bisher“, „AGB 0.9“) oder in tests/gebuehr-wort-offen/<nr>.ts.
   - Gegenprobe.
   - 221 testet nur seine Helfer und die Konditionen-Texte. Den Rendertest „kein Servicegebühr nach dem Stichtag“ schreibt jede Seiten-Nummer für ihre Seiten; der Sammel-PR prüft alle zusammen.
Tests (Pflicht):
- Rechenfunktionen unverändert: tests zu plattformgebuehr, plattformgebuehr-checkout, kasse, checkout-preis, checkout-totals ohne geänderte Erwartung; MINDESTBESTELLWERT_SATZ unverändert
- zusageEnde mit 12: 2027-02-01 → 2028-01-31 und 2027-03-12 → 2028-03-11
- einzugAbFuer mit gruendungBis 2028-01-31 → 1.2.2028 (nur Beleg, Funktion unverändert)
- Monate senken vor dem Festschreiben erlaubt, danach abgelehnt
- festschreibenListe mit 12 nie kürzer als bisher
- mindestbestellwertHinweis mit 6 % und mit abweichendem Satz
- gebuehrWortFuerZeitraum für alle drei Lagen

222 Hof-Alltag – Opus, gezielt, Welle 3
Boards: s1/w1-heute, -bestellungen, -bestellung, s2/w2-druck, t-d-packliste (nur Gebautes).
Grenze: src/app/(hof)/dashboard/**, src/app/(hof)/orders/**, src/app/(druck)/**, src/components/heute/**, src/components/hof-bestellungen/**, src/lib/heute.ts, src/lib/hof-bestellungen.ts, src/lib/bestellstatus.ts (nur Hof-Wörter), src/lib/storno.ts (nur Texte), eigene Offen-Dateien.
1. Heute: Reihenfolge nach s1-heute, „Noch zu packen“ nach V40, Marken V22, Leerzustände wie Board.
2. Bestellungen: Chips „Heute abholen · n“, „Noch offen · n“ (Standard, über das exportierte OPEN_STATUSES), „Erledigt“; Test: Chip und Navigation liefern dieselbe Zahl; Gruppen je Abholfenster.
3. Bestellung:
   - Betrag und Zusammensetzung mit den Helfern aus 221
   - Storno-Dialog nach „Gebühr“
   - Hauptaktion „Als gepackt markieren“
   - Dialoge zentriert ≤ 560 px im Web
   - Bar-Fristen über fristVon
4. Druck: Papier = Bildschirm (V57); „Servicegebühr“ nur bei bisher-Bestellungen; nur hell.
Rendertest: kein „Servicegebühr“ nach dem Stichtag auf Heute, Bestellung, Druck.
Nicht: Geld-Logik von Storno, Artikel fehlt, Erstattung (src/server/stornieren.ts, artikel-fehlt.ts).

223 Produkte und Produkt-Formulare – Opus, gezielt, Welle 3
Boards: s1/w1-produkte, -produkt-neu, t-b-produkte, t-b3-zustaende (nur Gebautes).
Grenze: src/app/(hof)/products/**, src/components/produkte/**, src/components/products/**, src/lib/produkte-hof.ts, eigene Offen-Dateien.
1. Liste nach Board; Schild nur bei Ausnahme; „Ausverkauft“ neutral.
2. „Was legst du an?“, Lebensmittel-, Futter-, Brennmaterial- und Familien-Formular nach Board:
   - Futter-Vorschau Z. 647 je Stichtag („Du bekommst € X · die Kundin zahlt € Y“)
   - „Foto hinzufügen“
   - Feldfehler V17
3. Rücktritts-Felder aus 214/218 bleiben, Wort „Rücktritt“.
Rendertest: Futter-Vorschau nach dem Stichtag ohne „Servicegebühr“.

224 Mein Hof, Einstellungen, Region – Opus, gezielt, Welle 3
Boards: s1/w1-mein-hof, -einstellungen, -region, s2/w2-hofdaten-zahlung, -konto-hof, t-a-tarifzeile, t-c-abholzeiten, t-f-konditionen (nur Gebautes).
Grenze: src/app/(hof)/farm-page/**, src/app/(hof)/settings/**, src/app/(hof)/region/**, src/components/mein-hof/**, src/components/farmer/** (ohne pending-approval-banner.tsx, das hat 228), src/components/hof-einstellungen/**, src/components/settings/**, src/components/konto/**, src/components/region/**, src/lib/hof-einstellungen.ts, src/lib/mein-hof.ts, src/lib/region.ts, eigene Offen-Dateien.
1. Mein Hof:
   - Kopf mit Zustandszeile und einer Aktion, „Noch 1 Punkt offen“
   - Vorschau wie im Code
   - Kundenansicht im Vollbild ohne Verkleinerung
2. Einstellungen: Punkte mit Text, „Urlaub und Pause“ (V8), Gründungstext aus 221.
3. Unterseiten:
   - Hofdaten (N42 c)
   - Zahlung „Bar bei Abholung · Braucht Lastschrift“ mit „Lastschrift einrichten“ für Höfe ohne Gründungszeit (Bedingung aus barMoeglich, keine neue Regel)
   - Konto: Anmelde-Adresse, Stilllegen mit „Hof“
   - Teilen-Hinweise
   - Konditionen-Unterseite (nur Gebautes)
4. Region: gebauter Stand, Karte technisch unverändert; PR #329 und w-n nicht.

225 Hof-Werkzeuge – Opus, gezielt, Welle 3
Boards: s2/w2-auswertung, -kunden, -verkaeufe, -postfach, -meldungen, -beitraege, -whatsapp-plakat, -teilen, s3/w3-problem-melden.
Grenze: src/app/(hof)/analytics/**, customers/**, sales/**, postfach/**, fehler-melden/**, meldungen/**, status/**, src/app/teilen/**, src/app/(public)/problem-melden/**, src/components/auswertung/**, hof-kunden/**, hof-verkaeufe/**, hof-hilfe/**, src/components/shared/meldung-form.tsx, src/components/teilen/**, src/lib/auswertung.ts, hof-kunden.ts, verkauf-eintragen.ts, postfach.ts (nur Z. 180 und Wörter), beitrag-anlass.ts, hof-hilfe.ts, eigene Offen-Dateien.
1. Auswertung: Gebühren-Karte mit gebuehrWortFuerZeitraum.
2. Kunden, Verkäufe nach Board. Der Kanal heißt weiter „Hofladen“. „Verkauf eintragen“ orange.
3. Postfach: Satz nach N14, „Senden“ orange.
4. Problem melden: Darstellung aus 219 für /fehler-melden (orange) und /problem-melden (grün).
5. Beiträge: Anlass „Hinweis“; WhatsApp, Plakat, /teilen mit „Zu Heute“.
Rendertest: Auswertung nach dem Stichtag ohne „Servicegebühr“.

226 Kundschaft: Finden – Opus, gezielt, Welle 3
Boards: s1/w1-startseite, -hoefe, -hofseite, -produkt, t-l-kundenseite, t-o-fuer-hoefe (nur Gebautes).
Grenze: src/app/page.tsx, src/components/startseite/**, src/app/(public)/hoefe/**, src/components/hoefe/**, src/app/(public)/[farmSlug]/page.tsx, src/app/(public)/[farmSlug]/hofseite-skelett.tsx, src/app/(public)/[farmSlug]/produkt/** (ohne not-found.tsx, das hat 231), src/components/farm/** (ohne cart-sheet.tsx), src/components/hofseite/**, src/components/produktdetail/**, src/app/(public)/fuer-hoefe/**, src/lib/hofseite-kunde.ts, hoefe-entdecken.ts, eigene Offen-Dateien.
1. Startseite nach Board, „Beispiel“ aus 221, Admin-Blöcke bleiben (N16).
2. /hoefe: Hofkarte, pausiert V18, Filter-Blatt; Karte technisch unverändert.
3. Hofseite: Reiter, Kacheln ab 768 px, Seitenspalte, Pause V6; Telefonnummer erst nach dem Kauf (E8).
4. Produktseite: Größen-Kacheln, „In den Korb · € X“ grün.
5. /fuer-hoefe: Gründungs- und Gebührentexte aus 221, kein Willkommens-Versprechen.
Rendertest: Hofseite, Produktseite, /fuer-hoefe nach dem Stichtag ohne „Servicegebühr“.

227 Kauf – Opus, voller Durchgang, Welle 3 (Sperrzone Kasse)
Boards: s1/w1-korb, -kasse, -bestaetigung, -bestellung-link, -meine-bestellungen, t-p-meine-bestellungen (Ausschnitt).
Grenze: src/components/farm/cart-sheet.tsx, src/app/(public)/[farmSlug]/checkout/** (nur Seiten-Komponenten), src/components/checkout/**, src/app/(public)/[farmSlug]/confirm/**, bestellung/**, bestaetigen/**, src/components/bestaetigung/**, src/app/(public)/bestellungen/**, src/components/bestellungen/**, src/lib/bestaetigung.ts, tests/kaufknopf-saetze.test.ts (nur die Mindestbestellwert-Erwartung auf den neuen Satz), eigene Offen-Dateien.
NIE: src/app/api/**, src/lib/kasse.ts (außer 221), src/lib/plattformgebuehr.ts, src/lib/reservierung.ts, src/lib/fristen.ts, Beträge, Idempotenz.
1. Warenkorb-Blatt rechts nach Board, Kaufsperre-Grund statt „Zur Kasse“.
2. Kasse:
   - Reihenfolge nach Board, Übersicht rechts ab 1024 px
   - Aufruf von mindestbestellwertGrund mit dem Satz des Hofs (A3)
   - Zahlung abgelehnt als orange Hinweiskarte
   - Kaufknopf grün
   - Reihenfolge Zusammenfassung → Grafik → Knopf → Sätze bleibt
3. Bestätigung:
   - Köpfe je Zustand nach Board
   - bar offen ohne Abholkarte, Schritte „Bestellt → Bestätigt → Gepackt → Abgeholt“
   - Frist über fristVon
   - Einstieg „Vertrag widerrufen“ bleibt (N43 (1))
4. Bestellung ansehen und Bar bestätigen nach Board, Frist über fristVon, Einstieg bleibt.
5. Meine Bestellungen nach Board, „Ansicht beenden“.
Tests:
- Rendertests je Kassen-Zustand: bar, online, abgelehnt, Mindestbestellwert, Betrieb ohne Rücktrittssatz
- Reihenfolge-Test aus 210/215 grün
- Gegenprobe: checkout-totals, checkout-preis, kasse, plattformgebuehr, plattformgebuehr-checkout ohne geänderte Erwartung
- kein „Servicegebühr“ nach dem Stichtag

228 Anmelden und Konto – Opus, gezielt, Welle 3
Boards: s2/w2-anmelden, -passwort, -registrieren, -kundenkonto, -neuigkeiten, -abmelden, -systemseiten.
Grenze: src/app/(auth)/**, src/components/anmelden/**, src/components/einrichten/**, src/lib/einrichten.ts, src/lib/farm-approval.ts, src/components/hofbereich/hof-balken.tsx, src/components/farmer/pending-approval-banner.tsx, src/app/account/**, src/app/konto/**, src/app/sicherheit/**, eigene Offen-Dateien.
1. Login: Hof-Karte orange in der KundeShell.
2. Registrieren:
   - nur die Fassung ohne Versprechen, Gründungssatz aus 221
   - eine h1 je Seite („Hof einrichten“; „Willkommen“ als h2)
   - Lastschrift als Hinweis
3. Systemseiten grün (V52). „Widerruf“ einer Einwilligung (Abos) bleibt.
4. Balken je Stand nach N42 e (Text, beide Darstellungen, Halbgeviertstrich).

229 Admin Teil 1 – Opus, voller Durchgang, Welle 3
Boards: s3/w3-admin-heute, -hoefe, -akte, -freischalten, -bestellungen.
Grenze: src/app/admin/page.tsx, src/app/admin/hoefe/**, src/app/admin/bestellungen/**, src/components/admin/** (ohne die Komponenten von 230, Liste im Bericht), src/lib/admin-hoefe-liste.ts, src/lib/admin-hof-akte.ts, eigene Offen-Dateien; optional src/app/admin/error.tsx (neu).
1. Heute: Kacheln, „Braucht dich“, Läuft/Kommt/Protokoll nach Board; Geld-Kachel mit gebuehrWortFuerZeitraum; Notbremse „In den Korb“.
2. Höfe: Standard „Braucht Blick“, Tarif-Spalte nicht.
3. Akte: Aktivität mit Wort aus 221; Knopf „Servicegebühr …“ nach A1; Karte „Plattformgebühr“ bleibt.
4. Freischalten-Dialoge: KONDITIONEN_DERZEIT aus 221.
5. Bestellungen:
   - „inkl. € … Plattformgebühr“ über gebuehrBezeichnungFuer
   - Rücktritts-Wörter (außer N43 (1))
   - „‹ Zur Liste“ nur am Handy
6. Optional, nur wenn trivial: src/app/admin/error.tsx über FehlerAnsicht und einen Eintrag in lib/fehlerseite.ts mit „Zu Heute“ (/admin), ohne neue Komponente. Routen-Wachen prüfen (tests nach „admin“ greppen). Sonst weglassen und im Bericht nennen.
Rendertest: Admin-Heute und Bestell-Detail nach dem Stichtag ohne „Servicegebühr“.
Nicht: Rechte, Passkey-Pflicht, Protokoll, Notfall-Storno-Logik.

230 Admin Teil 2 – Opus, gezielt, Welle 3
Boards: s3/w3-admin-postfach, -startseite, -geld, -betrieb, -einstellungen, -zugang.
Grenze: src/app/admin/postfach/**, startseite/**, geld/**, finanzen/**, betrieb/**, einstellungen/**, bestaetigen/**, einrichten/**, die Komponenten dieser Seiten (Liste im Bericht, getrennt von 229), eigene Offen-Dateien.
1. Geld: Kennzahl, Abgleich-Satz (page.tsx Z. 158), Jahresdiagramm und Titel mit gebuehrWortFuerZeitraum, Jahresansicht „Geld“.
2. Einstellungen: Feld „Monate ohne Grundgebühr“ mit Hilfe aus 221; Hofpreis-Stichtag „Seit diesem Tag gilt …“; keine Gruppe „Gratiszeit“.
3. Postfach, Startseite, Betrieb, Zugang nach Board, Logik unverändert.
Rendertest: Geld nach dem Stichtag ohne „Servicegebühr“.

231 Rechtstexte, Rücktrittsrecht, Fehlerseiten – Opus, voller Durchgang, Welle 3
Boards: s3/w3-rechtstexte, -widerruf, -fehlerseiten.
Grenze:
- eine neue Vorlage neben src/components/shared/infoseite-stil.ts (bestehende Exporte unverändert)
- src/components/rechtstexte/agb-ansicht.tsx (nur Rahmen, nie Wortlaut)
- src/app/(public)/agb/**, datenschutz/** (nur Rahmen), konditionen/**, widerruf/**
- src/lib/widerruf.ts (nur WIDERRUF_TEXT ohne fussLink, knopfWiderrufen und den Bestätigen-Knopf; nie BELEHRUNG)
- src/app/not-found.tsx, error.tsx, global-error.tsx, src/app/(hof)/error.tsx, src/app/(public)/[farmSlug]/not-found.tsx, src/app/(public)/[farmSlug]/produkt/[id]/not-found.tsx
- src/lib/fehlerseite.ts, src/components/shared/fehler-ansicht.tsx, nicht-gefunden-ansicht.tsx
- eigene Offen-Dateien
NIE: src/app/(public)/impressum/** (A001), src/lib/rechtstexte/agb.ts, docs/recht/**, der Wortlaut der Datenschutzerklärung.
1. Vorlage für /agb, /datenschutz, /konditionen (V62); Konditionen-Abschnitt aus 221 mit Entwurf-Kennzeichnung.
2. /widerruf: Titel „Rücktrittsrecht“, Texte nach Board, Ausnahmen N43 (1) und (2).
3. Fehlerseiten:
   - gemeinsamer Aufbau aus lib/fehlerseite.ts
   - 404 Produkt in denselben Aufbau
   - 500 im Hofbereich orange
   - „Nochmal versuchen“-Fassungen bleiben

232 E-Mails – Opus, voller Durchgang, Welle 3
Boards: s3/w3-mail-kauf, -storno, -zugang, -sicherheit, -neuigkeiten, -hof-bestellung, -hof-konto, -betrieb, -team.
Grenze: src/emails/**, src/lib/email.ts, src/server/mail-arten/**. Erlaubt sind Texte, Fuß-Art und ein optionales Feld antwortAn im Ergebnis des Renderers, das sendRaw bzw. versendeStapel als Resend-Option weitergibt. Warteschlange, Wege, Idempotenz und Protokoll bleiben unverändert. src/lib/hof-kontakt.ts nur lesen; tests/hof-kontakt-wache.test.ts; Tests der Mails; eigene Offen-Dateien.
1. EmailLayout:
   - Fuß-Arten als Typ: hof | agrilo | betrieb | postfach | beitrag(<Hof>)
   - Anbieterzeile als ein Baustein
   - ctaButton '13px 18px'
   - jede Vorlage wählt ihre Art (Liste im Test)
2. Reply-To nach V86.
3. Texte nach „E-Mails“:
   - Frist aus fristVon ohne den Zwei-Stunden-Satz
   - Wörter
   - Einstieg „Vertrag widerrufen“ bleibt (N43 (1))
   - Plattformgebühr
4. Abmeldung in Beitrags-Mails unverändert (Link, manageUrl, List-Unsubscribe/-Post).
5. Vorschau ohne Route und ohne Paket:
   - ein Vitest-Fall rendert jede Vorlage mit Beispieldaten nach .nachtlauf/mails/<art>.html (nicht committen)
   - Schalter MAIL_VORSCHAU nur im Test, nicht in .env.example, nicht in Vercel
   - die Vorlagen und die Bausteine aus src/server/mail-arten (RENDERER) wie im Versand, keine zweite Render-Kette
   - der Umsetzer fotografiert sie mit agent-browser bei 390 und 600 px
Tests:
- jede Vorlage mit Knopf-Padding ≥ 44 px
- Fuß-Art je Vorlage
- Reply-To nur bei Bestellmails an die Kundin und nur mit Profil-E-Mail; Hof ohne Hof-E-Mail → kein Reply-To; nie die Anmelde-Adresse
- Beitrags-Mail enthält Abmelde-Link und die Kopfzeilen
- kein „zwei Stunden“, kein „Dashboard“, kein „Vor-Ort“ in Mail-Texten
- mail-vorlagen.test.ts grün

§2 Regeln
- Es gelten die Regeln aus Lauf 29 (freigabe.md §33, §2).
- Geld: Keine Nummer ändert einen Betrag, eine Rechenfunktion (bestellGebuehr, gebuehrJeStueckCents, einzugAbFuer), einen Erstattungsweg, eine Frist (fristen.ts, Reservierung), einen Idempotenzschlüssel oder Stripe-Parameter. Anzeige-Rechnungen nur über die bestehenden Funktionen. Gegenprobe: Geld-Tests ohne geänderte Erwartung.
- Recht:
  - Belehrung, Muster-Formular, AGB, Datenschutz-Wortlaut, Impressum und die N39-Beschriftung bleiben.
  - Neue Rechtssätze nur der Konditionen-Abschnitt, mit Entwurf-Kennzeichnung.
  - Was ein Board als „Recht prüft“ markiert, steht im PR unter „Offen für Recht“.
- Daten:
  - Keine Migration, keine Datenänderung.
  - Seed nur mit erfundenen Beispieldaten für Bilder (@beispiel.at, Telefonnummern genullt).
  - Reply-To nie mit der Anmelde-Adresse.
- Sicherheit: keine Prüfung lockern (Rechte, Passkey, signierte Links, Abholcode nur Anzeige).
- Mails: kein Test verschickt echte Mails; keine neue Mail-Art.
- Design: siehe „Technik für alle Nummern“; Mockup-Abweichung ohne Begründung ist ein Blocker.
- Kein neues Paket, keine neue Variable (Ausnahme: MAIL_VORSCHAU nur im Test).

§3 Checkliste je PR
Wie Lauf 29 (§33, §3), mit „Migration: nein · Paket: nein · Variable: nein“, dazu:
- Liste „Abweichung vom Code erledigt“: je Board die Sätze aus der Notiz, je erledigt / bewusst nicht (Grund) / offen (Entscheidung)
- Bilder: Pfad und Liste je Route, Breite, Thema
- eigene Offen-Dateien gelöscht
- „Offen für Recht“, falls vorhanden

§4 Morgenbericht (morgenbericht-<datum>-lauf30.md)
Wie Lauf 29, dazu:
- Ganz oben: je Nummer, ob die Ausgangslage am Code bestätigt war; nicht begonnene Nummern; Ergebnis der Mockup-Prüfung (304 Dateien).
- Regelvorschläge aus der Regel-Inventur.
- Je Nummer Vorschau-Link und Bilder-Liste.
- „Für dich zu tun“:
  - Abnahme in der Vorschau und auf test.agrilo.at je Bereich; Admin-Bilder hinter Passkey.
  - Nach dem Merge, vorher lesend prüfen: gruendungMonate, gruendungFestAm, gruendungBisStandard, Höfe mit Gründungsplatz, und ob irgendwo „24 Monate“ oder „456 €“ zugesagt wurde (Postfach, Rundschreiben, Mails).
  - Danach „Monate ohne Grundgebühr“ = 12 speichern, die Liste „Zusagen festschreiben“ prüfen (jedes Ende nur später), festschreiben. Folge: Einzug der Bargebühr der Gründungshöfe ab dem Tag nach ihrem Ende.
  - „Offen für Recht“ gesammelt an die Anwältin; Konditionen-Abschnitt vor dem Stichtag freigeben.
  - A001 (Impressum) vor Stripe live; die Anbieterzeile verlinkt dorthin.
  - Merge per Merge-Commit: zuerst Doku-PR, dann Sammel-PR.

══════════════════════════════════════════════════════════════════════
NICHT (ausdrücklich draußen)
══════════════════════════════════════════════════════════════════════
- „Ab Hof“ als Verkaufskanal: Der Kanal heißt weiter „Hofladen“.
- Willkommenszeit (offen): Registrieren zeigt nur die Fassung ohne Versprechen.
- 12 oder 100 Gründungsplätze: wie im Code.
- Kartenquelle (offen): Karte technisch unverändert.
- Tarife Hoftor/Hofladen als Abrechnung (offen): nur, was der Code schon hat; nicht Urlaubsmodus (Hofladen), Kündigen, Abrechnung, Gratiszeit-Gruppe, Vorprüfung, Tarif-Spalte und -Reiter, Mandat mit Endziffern.
- Preise vergleichen v2 (PR #329, t-n/w-n).
- Impressum: Betreiberangaben und Seite nicht anfassen, siehe A001; keine Betreiberdaten duplizieren; infoseite-stil.ts nicht ändern.
- AGB 1.0 (eigener /fix), Wortlaut der Datenschutzerklärung.
- Belehrung, Muster-Formular und N39-Beschriftung (Einstiege, Knöpfe) – bis die Anwältin entscheidet.
- Bar-Frist ändern (fristen.ts); „bis Vortag 18:00“ wäre eine eigene Entscheidung (Reservierung, N24).
- „Dieselbe Bestellung nochmal aufgeben“ in der Abholbereit-Mail (offene Ausnahme laut DESIGN_SYSTEM „E-Mails“): bleibt.
- Lastschrift-Knopf in der Ankündigungs-Mail nur bei Bedarf (lib/email.ts ab Z. 837, offen).
- Die Fassungen von „Nochmal versuchen“ vereinheitlichen (Wortliste offen).
- Ausnahmen für Mockups in der Telefonnummern-Wache.
- Schema, Migration, Spalten-Default gruendungMonate; Stripe, Webhook, /api/**; Gate 9.
- 209 (form.watch), 212-Profil, Monatsabrechnung, CSP mit Nonces, Stripe live.

══════════════════════════════════════════════════════════════════════
FERTIG, WENN
══════════════════════════════════════════════════════════════════════
Doku-PR
- 304 Dateien gleich der Soll-Liste, LISTE.txt dabei.
- telefonnummern-wache grün ohne neue Ausnahme.
- Register N41–N44, status.md und nachtlauf.md §3 nachgezogen.

Je Nummer
- `pnpm typecheck && pnpm lint && pnpm test` grün (voller Lauf vor jedem Push, G10); test:integration nach §0.
- wortliste.test.ts grün mit den neuen Zeilen; eigene Datei in tests/wortliste-offen/ gelöscht.
- gebuehr-wort-wache.test.ts grün; eigene Datei in tests/gebuehr-wort-offen/ gelöscht; Rendertest „kein ‚Servicegebühr‘ nach dem Stichtag“ für die eigenen Seiten.
- Bilder je Route bei 390 und 1440 px, hell und dunkel, je Zustand des Boards; jede sichtbare Abweichung mit Grund im Bericht.
- fokus-sichtbar, grundbausteine-groesse, design-tokens, palette-klassen, keine-emojis, telefonnummern-wache grün; keine neue Hexfarbe.
- Geld-Tests ohne geänderte Erwartung; MINDESTBESTELLWERT_SATZ unverändert.
- 231 und 232:
  - `git diff <Basis> -- src/lib/rechtstexte/agb.ts 'src/app/(public)/impressum' docs/recht src/components/shared/infoseite-stil.ts` ist leer
  - BELEHRUNG und die N39-Texte (fussLink, knopfWiderrufen, Bestätigen-Knopf) sind per Test gleich dem Stand auf main
- 232: Mail-Bilder 390/600 aus .nachtlauf/mails; jede Vorlage hat ihre Fuß-Art; Knöpfe 44 px; Reply-To-Tests grün.
- PR-Text: Bericht nach CLAUDE.md §4, Liste „Abweichung vom Code erledigt“ je Board, weggelassene Teile mit Grund, „Offen für Recht“, „Gestapelt auf #…“.

Sammel-PR
- Alle fertigen Nummern per --no-ff; nach jedem Merge der volle Lauf.
- Integration ganz grün; Regel 3 auf frischer DB ohne Unterschied (keine neue Migration).
- Beide Offen-Ordner leer; kein „Servicegebühr“ in Seiten mit Stichtag in der Vergangenheit.

Woran die Projektleitung den Erfolg nach dem Merge erkennt
- Vorschau-URL je PR (Morgenbericht): jede Route wie ihr Board, hell und dunkel, 390 und 1440.
- test.agrilo.at nach dem Nachziehen von staging:
  - Kasse bar und online (Privat und Betrieb) mit Mindestbestellwert-Satz, Grafik und Sätzen unter dem Kaufknopf
  - Bestellmail mit neuem Fuß; Reply-To nur bei einem Hof mit Profil-E-Mail
  - /widerruf mit Titel „Rücktrittsrecht“ und N39-Knöpfen
- Datenbank, nur lesend: kein neues Feld.
  - Nach deinem Speichern: PlattformEinstellung.gruendungMonate = 12.
  - Nach dem Festschreiben: gruendungFestAm gesetzt; Gründungshöfe mit Farm.gruendungBis = 2028-01-31 (vor dem Tarifstart freigeschaltet) bzw. Freischaltung + 12 Monate − 1 Tag.
- Sentry nach dem Deploy ohne neue Issues auf den umgebauten Routen.
===ENDE===

Hinweis der Schaltzentrale (Entscheidungen der Projektleitung im Chat vom 3.11.2026 nach dem Stand-Check; sie gehen dem Text oben vor und gehören als „Ergänzung Ort und Mockups“ direkt hinter §34 in freigabe.md, und in den Morgenbericht):

1. Ort: Der Lauf läuft als Cloud-Sitzung auf Linux, nicht lokal. „Ort: lokal“ im Text ist damit überholt.
2. Mockups: Sie liegen schon auf `origin/docs/lauf30`, Commit `6ce5aa98` (von main `056a321e`), zusammen mit `LISTE.txt`. Hol diesen Branch und arbeite darauf weiter; lege ihn nicht neu an und erzwinge keinen Push. Der Punkt 1 des Doku-PR ist damit erledigt, die Punkte 2 bis 6 fehlen noch. Nimm im Doku-PR als Hinweis mit auf, dass der Commit ausnahmsweise von Windows aus ohne vollen grünen Lauf entstand (nur Mockups, CI prüft ihn; Ausnahme der Projektleitung).
3. Geprüft vor dem Commit: alle 304 Namen gleich der Soll-Liste, Telefonnummern-Wache grün, nur erlaubte Skripte, keine externen Verweise außer Google Fonts. Lass die Telefonnummern-Wache und den Abgleich mit LISTE.txt hier noch einmal laufen.
4. Abweichung von „unverändert committen“: Die Projektleitung hat freigegeben, zwei Orte der Beispielwelt vor dem Commit gegen Orte aus dem Seed zu tauschen (22 Dateien, sonst keine Änderung). In der Auswahl „Welches Neukirchen?“ steht deshalb ein anderes Neukirchen. Nenne die alten Orte nirgends, weder in Commits noch in PRs, Berichten oder Doku; such sie auch nicht in der Git-Historie.
5. E-Mail-Adressen in den Mockups: Subdomains von beispiel.at (z. B. `kontakt@hof-am-moos.beispiel.at`) sind von der Schaltzentrale als erfunden und harmlos eingestuft und bleiben stehen. Das ist kein STOPP-Grund; nenn es im Morgenbericht als zu bestätigenden Punkt.
6. agent-browser: Die Projektleitung erlaubt, ihn nur in diesem Container als Werkzeug zu installieren, nicht als Projektabhängigkeit: keine Änderung an package.json, pnpm-lock.yaml oder pnpm-workspace.yaml. Sieh dir dazu `.claude/skills/agent-browser` an (zum Beispiel `pnpm add -g agent-browser` und danach `agent-browser install`; `npm install` blockt der Hook). Prüfe nachher mit einem Bild einer lokalen Seite, dass es läuft. Klappt das nicht, gilt die Freigabe: STOPP, Grund in den Morgenbericht, mit dem, was fertig ist (Doku-PR). Es gibt dann keinen Lauf ohne Bilder.
7. Postgres: Starte das lokale Postgres im Container und nutze je Worktree eine Wegwerf-DB auf localhost für `TEST_DATABASE_URL`, wie in Lauf 29. Nie eine Adresse aus der Umgebung.
8. Stand-Check: Prüfe alle übrigen Punkte aus „Stand“ hier auf Linux. Ist er rot, gilt die Freigabe: STOPP, nichts reparieren.
9. Impressum: PR #448 (Impressum) ist offen und kann während des Laufs auf main landen. Lauf 30 fasst das Impressum nicht an; er bringt nur `src/lib/pilotbetrieb.ts` mit, falls du origin/main hineinholst.
10. Kein `git stash`. Diese Sitzung meldet sich nicht automatisch bei der Schaltzentrale. Deshalb gehört der Morgenbericht in den Sammel-PR, oder in den Doku-PR, falls kein Sammel-PR entsteht. Setz Morgenbericht-Pfad, PR-Nummern und offene Punkte in den PR-Text und in deine letzte Nachricht.
