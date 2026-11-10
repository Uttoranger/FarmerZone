<!-- Auftrag A006b: wörtliche Nachricht der Projektleitung vom 10.11.2026, von der Schaltzentrale unverändert abgelegt, weil sie für einen Cloud-Start zu lang ist. Die letzte Zeile „A006b freigegeben“ gehört zur Nachricht (Tor T1). Diese Datei gehört in keinen PR. -->

/fix Datenschutzerklärung: Hof-Daten, SEPA-Lastschrift, Drittländer, Protokoll, Server-Logs (A006b)

Vorher: origin/main hineinholen; CLAUDE.md, docs/entscheidungen.md,
docs/ai/CODING_STANDARDS.md und docs/ai/TESTING_GUIDELINES.md lesen.

TORE – vor jeder Änderung prüfen. Trifft eines zu: STOPP, nichts ändern, melden.
T1 Die Startnachricht der Projektleitung enthält nicht die Zeile
   „A006b freigegeben“.
T2 src/app/(public)/datenschutz/page.tsx auf origin/main enthält schon
   data-abschnitt="sepa-lastschrift" oder den Satzanfang „Bucht deine Bank
   eine Lastschrift zurück“ (die Neufassung ist schon da).
T3 Ein offener PR eines anderen Auftrags ändert
   src/app/(public)/datenschutz/page.tsx (gh pr list, dann gh pr diff
   --name-only je PR; geht gh nicht: im Bericht sagen und weitermachen).
   Ein offener PR des alten A006 zählt als anderer Auftrag (STOPP,
   Meldung „alten A006-PR schließen“).
T4 Das Kunden-Konto ist weg: src/app/account/profile/page.tsx fehlt oder
   `export async function deleteCustomerAccount` steht nicht mehr in
   src/server/actions/subscriptions.ts (Abschnitt 9 und 10 wären falsch).

WEICHEN – kein STOPP; welche Fassung gilt, steht im Bericht.
W1 Web Analytics. Prüfe: grep -rnE "<(Analytics|AnalyticsGefiltert)\b" src/app
   - Treffer (Stand 10.11.: src/app/layout.tsx:141) → AN: Eintrag Vercel im
     Anhang wie A006, mit dem Satz zu Web Analytics, und Ä8 (Punkt zur
     Reichweitenmessung in 3; außer bei „Ä8 nein“).
   - kein Treffer → AUS: Ä4 (Titel ohne „Reichweitenmessung“, Satz entfällt),
     Ä8 entfällt, und Testanpassung (d).
   Ob das Projekt in Vercel Analytics abgeschaltet hat, siehst du nicht und
   spielt hier keine Rolle; es zählt, ob der Code das Skript einbindet.
W2 Rückbuchung. Prüfe: steht 'geklaert' in ABRECHNUNG_STAENDE
   (src/lib/plattformgebuehr.ts) und „nachforderung“ unter src/?
   - beides nein (Stand 10.11.) → Ä3 wie im Anhang.
   - nur eines von beiden → Ä3 wie im Anhang; im Bericht nennen, was
     gefunden wurde.
   - beides ja (Lauf 34 Nr. 290 ist schon auf main) → statt Ä3 wörtlich der Satz
     von Recht zu 290: „Bucht deine Bank eine Lastschrift zurück, nimmt
     dein Hof sofort keine Barbestellungen mehr an, bis der zurückgebuchte
     Betrag bezahlt ist; danach geht es von selbst wieder. Das entscheidet
     die App nach einer festen Regel (AGB Punkt 19.6). Hast du anders
     bezahlt oder war die Rückbuchung nicht berechtigt, schreib uns – dann
     prüft ein Mensch und kann die Sperre aufheben.“
W3 Neue Mails aus Lauf 34 (296 „bar-erinnerung“, 297 „nicht-abgeholt“) –
   ob schon gebaut oder nicht: Ä2 deckt beide, nichts zu tun.

Ausgangslage (geprüft 10.11.2026, main efc52874b):
- src/app/(public)/datenschutz/page.tsx (354 Zeilen): 14 Einträge in
  ABSCHNITTE (Z. 31-46), davon die letzten vier ohne Nummer;
  DATENSCHUTZ_STAND = 'Oktober 2026' (Z. 23), nicht exportiert. Zahlen
  aus Konstanten (Z. 18-20; Importe Z. 6-12). Kopfkommentar Z. 25-30 nennt
  N43 (4). Section-Baustein ohne data-Attribute (Z. 56-65). Rahmen:
  RechtstextVorlage mit Verzeichnis, Druck und Stand (Z. 70-76).
- Abschnitt 4 heute (Z. 148-186): Stripe, Resend („Bestellbestätigung,
  Abholhinweis“, Z. 157), Supabase, Vercel, Sentry, Cloudflare, Vercel Web
  Analytics als eigener Eintrag (Z. 179-184). Keine Drittland-Grundlage
  außer „Standardvertragsklauseln“ bei Vercel.
- Abschnitt 9 und 10 verlinken /account/profile (Z. 250, 272). Das Konto
  gibt es (Register E8: „Die bestehenden Seiten unter /account bleiben“):
  Anmeldung mit Code, Abos, Geräte, Konto löschen
  (src/app/account/profile/page.tsx, profile-client.tsx:243-262,
  src/server/actions/subscriptions.ts:128-153). Das bleibt so.
- Es fehlen: Hof-Daten, SEPA/Monatsabrechnung (N38), Admin-Protokoll (N33),
  DPMG, Rollen, Drittland-Grundlagen, Rechtsgrundlage der Server-Logs.
- Web Analytics: @vercel/analytics in package.json:45,
  src/components/shared/analytics-gefiltert.tsx, eingebunden in
  src/app/layout.tsx:141. Weiche W1.
- Fakten, auf denen der Text beruht (nur lesen, nicht ändern):
  - IBAN, Kontoinhaber und Mandatstext liegen nie in unserer DB, nur
    Farm.stripeKundeId, sepaZahlungsmittelId (prisma/schema.prisma:700-701)
    und sepaMandatAm (:630).
  - An Stripe beim Kunden: Hofname, E-Mail des Kontos, farmId
    (src/server/plattformgebuehr-abrechnung.ts:81-84); je Rechnung
    Positionen mit Text (:323-324).
  - Bank und letzte 4 Stellen kommen live (ladeMandatAnzeige,
    plattformgebuehr-abrechnung.ts:619-631), nichts gespeichert.
  - Nach einer Rückbuchung (Stand zurueckgebucht, :579) sperrt
    abrechnungSperrtBar immer (src/lib/plattformgebuehr.ts:571); kein Code
    hebt das auf. Das baut Lauf 34 Nr. 290 (Nachforderung und Notweg) und
    ersetzt dann den Satz aus Ä3 (Tor T3 von 290).
  - Stripe-Konto des Hofs: beim Anlegen Land, E-Mail des Hofs, Adresse der
    Hofseite (src/server/actions/stripe-connect.ts:85-104).
  - Stufe 2 „Konto schließen“ läuft nicht (ENDGUELTIG_FREIGEGEBEN = false,
    src/lib/konto-schliessen.ts:56).
  - Sitzung: 7 Tage, täglich verlängert (src/lib/auth.ts:1016-1017),
    höchstens SITZUNG_HOECHSTENS_TAGE = 30 ab Anmeldung
    (src/lib/sitzung-dauer.ts:14).
  - Aufbewahrung: SITZUNGEN_NACH_ABLAUF_TAGE 7, CODES_NACH_ABLAUF_TAGE 1,
    MAIL_PROTOKOLL_AUFBEWAHREN_TAGE 90 (src/lib/betrieb.ts:209, 211, 220);
    ADMIN_PROTOKOLL_JAHRE 5 (src/server/admin-protokoll.ts:31; die Datei
    lädt Prisma und Sentry).
  - Mail-Protokoll ohne Adresse, nur HMAC (prisma/schema.prisma:1606-1616).
  - Missbrauchsschutz: Zähler je Zweck mit HMAC und Server-Geheimnis
    (src/lib/bremse-datenbank.ts:241-247), abgelaufene Zeilen werden
    gelöscht (src/server/bremse-datenbank.ts:411).
  - Käuferart und Betriebsnummer der Bestellung (prisma/schema.prisma:985-986).
  - Stripe Link: im Code nirgends eingeschaltet oder genannt (Zahlarten
    kommen aus dem Stripe-Dashboard; Link ist dort aus, E-045). Der Text
    nennt Link nicht.
- Bestehende Tests mit Erwartungen an diese Seite:
  - tests/rechtstext-vorlage.test.ts:173-178 (Testname „… die 14
    Abschnitte …“, abschnitte(14), toHaveLength(14));
  - tests/altrouten-datenschutz.test.ts:130-204 („Fakten wie gebaut“),
    darunter :185 toContain('Vercel Web Analytics'),
    :191 /gespeichert\. \S+ speichert keine/, :202 'Stand: Oktober 2026';
    weiter: 'Anmeldung mit Code', GERAETE_COOKIE und '400 Tage',
    BESTELLUNGEN_COOKIE, '30 Minuten', BESTELLUNGEN_PFAD, „Technisch
    notwendige Daten“ vor „Weitere Cookies“, Abschnitt 8 nennt
    „Abschnitt 2“, IP-Adresse zur Sitzung, /Cloudflare[^.]*DNS/,
    /Cloudflare[^.]*E-Mail/, /Betreiber von \S+ \(Kontaktdaten/,
    text-brand-text, kein text-primary. Alle bleiben mit dem Anhang grün.
  - tests/wortliste.test.ts:184-187 (Datei als ganze Ausnahme, N43 (4)).
  - tests/hof-anmeldung.test.ts:120-133 (die Seite liest keine
    Kopfzeilen, keine Cookies, keine Sitzung, kein '@/lib/auth').
  - Ohne Anpassung, nur zur Kenntnis: tests/kunden-kopf.test.ts:274, 369-370
    (KundeShellMitSitzung), tests/shells.test.ts:558-585,
    tests/ladeansichten.test.ts:681 („Problem melden“ hier erlaubt),
    tests/sitemap.test.ts:154, tests/bausteine-267.test.ts:102,
    tests/schwere-module.test.ts (kein statischer Import schwerer Module).
- Bekannt und keine Folge dieses Auftrags: tests/keine-emojis.test.ts ist
  unter Node mit Unicode unter 17 (node -p process.versions.unicode) an
  src/app/(druck)/orders/today/print/page.tsx rot. Kein STOPP; im Bericht
  und im PR nennen.

Entschieden (Projektleitung; Wortlaut freigegeben 05.11.2026 im Chat
(E-020, F024, F025, F026); Änderungen Ä1-Ä8 mit der Startnachricht):
- E1 Variante A für die Datenschutzerklärung: Sie wird ohne vorherige
  Rückmeldung der Anwältin veröffentlicht; Registereintrag schlägst du nur
  vor (Schritt 9), Kennung = erste freie N-Nummer auf main beim Öffnen des
  PR, nie N45 oder eine andere bestehende. N43 (4) gilt für die
  Datenschutzerklärung nur noch für den Absatz zum Rücktritt (mit Ä1:
  dessen Text, die Zwischenüberschrift lautet neu). ja
- E2 Konto schließen: Fassung B (Löschung vorerst nur auf Anfrage, von
  Hand). ja
- E3 KI-Sichtung: c – Anthropic wird NICHT genannt; es gibt keinen Eintrag
  anthropic in 4, und in 12 kommt kein Absatz zur KI-Sichtung dazu.
  Abschnitt 12 selbst bleibt (bisheriger Text).
- E4 Keine Kennzeichnung „Entwurf“ auf der Seite. ja
- Ä1 ja · Ä2 ja · Ä3 ja · Ä5 ja · Ä6 ja · Ä7 ja · Ä8 ja (Vorgabe; steht
  in der Startnachricht „Ä<n> nein“, gilt dort der Wortlaut „A006:“ aus
  dem Anhang, und bei Ä6, Ä7 oder Ä8 kommt der zugehörige Pflichtpunkt
  unter „Offen für Recht“ in den Bericht, Schritt 8).
- Ä4 folgt immer der Weiche W1; eine Zeile „Ä4 nein“ wird ignoriert und
  im Bericht genannt. Ä8 gilt nur bei W1 = AN.
- Der Wortlaut im Anhang ist verbindlich. Du übernimmst ihn wörtlich,
  formulierst nicht um und ergänzt nichts.

Bestätigt (Projektleitung, 05.11.2026; „nein“ bzw. leer = Ersatzfassung im Anhang):
  AV-Verträge angenommen: Supabase ja · Vercel ja · Resend ja · Sentry ja · Cloudflare ja · Anthropic nein
  B1 Rolle Stripe wie in Fassung „ja“: nein
  B2 Aktiv im DPF-Register: Stripe nein · Vercel nein · Resend nein · Sentry nein · Cloudflare nein · Anthropic nein
  B4 Region der Vercel-Funktionen: unbekannt
  B5 Resend: nur-versand-eu
  B6 Sentry speichert in der EU (Frankfurt): ja
  B7 UK-Angemessenheitsbeschluss für OSMF nennen: nein
  B8 Vercel-Logs höchstens 30 Tage: nein
  B9 Stripe mailt Rechnungen und SEPA-Vorabankündigung: nein
  B10 Stripe.js setzt __stripe_mid/__stripe_sid: ja

Umsetzung:
1. Branch fix/datenschutz-a006b von origin/main. Ein PR, Präfix fix:.
2. Struktur. ABSCHNITTE bekommt diese 18 Einträge (Anker in Klammern),
   Text = „<Nummer>. <Titel>“ wie heute (z. B. „1. Verantwortliche Stelle
   und Rollen“). Bestehende Anker bleiben:
    1 Verantwortliche Stelle und Rollen (verantwortliche-stelle)
    2 Welche Daten wir verarbeiten (daten)
    3 Zweck und Rechtsgrundlage (zweck)
    4 Empfänger und Dienstleister, Übermittlung in Drittländer (dienstleister)
    5 Speicherdauer (speicherdauer)
    6 Deine Rechte (Art. 15–22 DSGVO) (rechte)
    7 Beschwerderecht (beschwerderecht)
    8 Cookies (cookies)
    9 Newsletter und Neuigkeiten von Höfen (neuigkeiten)
   10 Kunden-Konto (Anmeldung mit Code) (kunden-konto)
   11 Standort, Karte und Umkreissuche (standortsuche)
   12 Fehler- und Wunschmeldungen (meldungen)
   13 Postfach (postfach)
   14 Daten der Höfe (hof-daten)
   15 SEPA-Lastschrift und Monatsabrechnung der Höfe (sepa-lastschrift)
   16 Meldung an das Finanzamt (DPMG) (dpmg)
   17 Protokoll im Admin-Bereich (admin-protokoll)
   18 Server-Logs und Schutz vor Missbrauch (server-logs)
   - Alter Anker: In Abschnitt 11 steht vor dem bisherigen Text zur
     Umkreissuche ein leeres Element mit id="umkreissuche" (kein h2). Im
     Verzeichnis erscheint es nicht.
   - Jede <section> trägt data-abschnitt="<anker>" (Section-Baustein der
     Seite erweitern, keine neue Komponente).
   - Jeder Eintrag in 4 trägt data-dienstleister="<hoefe|stripe|supabase|
     vercel|resend|sentry|cloudflare|osm|behoerden>" (E3 = c: kein
     anthropic).
   - Wo eine Grundlage steht, trägt der Eintrag zusätzlich
     data-drittland-grundlage: nach B2 überall "scc" (stripe, supabase,
     vercel, resend, sentry, cloudflare); osm keine (B7 nein); hoefe und
     behoerden keine.
   - Der Satz aus Ä3 (bzw. W2) steht im Quelltext als zusammenhängender
     Text; die Wortfolge „Bucht deine Bank eine Lastschrift zurück“ steht
     auf EINER Zeile von page.tsx, ohne {…} oder Zeilenumbruch darin
     (Tor T3 und Schritt 8 von Lauf 34 Nr. 290 suchen sie wörtlich). Der
     Satz und der Rest des Punkts „Wenn der Einzug scheitert“ stehen im
     selben <li>.
   - Bausteine: RechtstextVorlage, INFOSEITE_ABSCHNITT, INFOSEITE_LINK wie
     heute. Keine neue Komponente, nur Tokens, beide Themes.
   - Kopfkommentar Z. 25-30: Die Titel und der Wortlaut kommen von der
     Projektleitung (A006b); N43 (4) gilt nur noch für den Absatz zum
     Rücktritt. Keine N-Nummer im Kommentar, die es im Register noch nicht
     gibt.
   - Keine neuen Exporte aus page.tsx (Next.js lässt in einer Seite nur
     default, metadata u. Ä. zu; ein weiterer Export bricht den Build).
3. Zahlen aus Konstanten:
   - SITZUNGEN_NACH_ABLAUF_TAGE, CODES_NACH_ABLAUF_TAGE,
     MAIL_PROTOKOLL_AUFBEWAHREN_TAGE (src/lib/betrieb.ts);
   - SITZUNG_HOECHSTENS_TAGE (src/lib/sitzung-dauer.ts);
   - MARKE und DATENSCHUTZ_EMAIL wie heute.
   - ADMIN_PROTOKOLL_JAHRE: NICHT importieren (src/server/admin-protokoll.ts
     lädt Prisma und Sentry in die öffentliche Seite). Die Zahl steht als
     Literal 5 in einer Konstante der Seite mit Kommentar „= ADMIN_PROTOKOLL_JAHRE“;
     der neue Test vergleicht sie mit der Konstante. Die Konstante nicht
     verschieben.
4. DATENSCHUTZ_STAND = 'November 2026'.
5. Wortlaut genau nach dem Anhang. Wörtlich unverändert bleiben:
   - 7 und 8;
   - in 2 der Text des Absatzes zum Rücktritt („Widerrufst du einen Kauf
     über …“ bis „… wie die Daten der Bestellung.“); nur die
     Zwischenüberschrift darüber ändert Ä1;
   - in 2, 6, 9, 10, 11, 12 und 13 alles außer den im Anhang genannten
     Stellen (auch beide Links auf /account/profile in 9 und 10);
   - in 11 die beiden bisherigen Abschnitte, hintereinander.
6. Tests – neu: tests/datenschutz-struktur.test.ts (Struktur und
   Kopplung an den Code, nicht Wortlaut; nach TESTING_GUIDELINES, ohne DB):
   - 18 h2 in dieser Reihenfolge; h2-id = Anker; Verzeichnis = ABSCHNITTE
     (aus dem HTML gelesen); id="umkreissuche" existiert und ist kein h2;
   - jede section mit data-abschnitt;
   - data-dienstleister in 4 genau wie in Schritt 2, ohne anthropic;
     data-drittland-grundlage="scc" genau bei den sechs Diensten;
   - kein Treffer im HTML für
     /\[B\d+\]|\{[A-Z_]+\}|<BESTAETIGT|\[GRUNDLAGE\]|\[ANTHROPIC|Ä\d|A006:/;
   - Stand-Zeile enthält den Wert von DATENSCHUTZ_STAND, gelesen aus dem
     Quelltext der Seite (/const DATENSCHUTZ_STAND = '([^']+)'/), nicht
     doppelt eingetippt;
   - die Zahlen aus Schritt 3 stehen im Text und stimmen mit den
     Konstanten überein; das Literal für das Admin-Protokoll ist gleich
     ADMIN_PROTOKOLL_JAHRE. Den Wert im Test aus dem Quelltext lesen
     (/export const ADMIN_PROTOKOLL_JAHRE = (\d+)/ in
     src/server/admin-protokoll.ts), nicht importieren (die Datei lädt
     Prisma und Sentry);
   - Web Analytics folgt dem Code: Der Text enthält „Vercel Web Analytics“
     genau dann, wenn eine Datei unter src/app (ohne Kommentare)
     /<(Analytics|AnalyticsGefiltert)\b/ enthält – derselbe Umfang wie W1;
   - Rückbuchung: der Quelltext enthält die Wortfolge „Bucht deine Bank
     eine Lastschrift zurück“ auf einer Zeile; im HTML enthält das <li>
     mit dieser Wortfolge auch „Mensch“. Nicht mehr festlegen (290 ersetzt
     den Satz später);
   - kein Treffer für /Stripe Link|Link von Stripe|Link by Stripe/i
     (Prüfliste Nr. 9);
   - Gegenprobe je Prüfung an einem kleinen, falschen HTML-Stück.
   Bestehende Tests – genau diese Anpassungen sind erlaubt:
   (a) tests/rechtstext-vorlage.test.ts:173-177: im Testnamen „14
       Abschnitte“ → „18 Abschnitte“; RECHTSTEXT_TEXT.abschnitte(14) →
       (18); toHaveLength(14) → (18).
   (b) tests/altrouten-datenschutz.test.ts:
       - :191 /gespeichert\. \S+ speichert keine/ →
         /speichert sie\. \S+ speichert keine/;
       - :202 'Stand: Oktober 2026' → 'Stand: November 2026'
         (gleicher Wert wie DATENSCHUTZ_STAND; die Seite exportiert ihn
         nicht, siehe Schritt 2).
   (c) tests/wortliste.test.ts:186: Der Eintrag für
       src/app/(public)/datenschutz/page.tsx bleibt in AUSNAHME_DATEIEN;
       nur grund wird zu: 'Rechtstext, Wortlaut nur durch die
       Projektleitung (A006b); der Absatz zum Rücktritt bleibt nach N43 (4);
       „Widerruf“ steht dort und für die Einwilligung (N43 (5))'.
   (d) nur bei W1 = AUS: tests/altrouten-datenschutz.test.ts:185
       (expect(t).toContain('Vercel Web Analytics')) entfällt; :186 bleibt.
       Die Kopplung im neuen Test ersetzt sie, gelockert wird nichts.
   Sonst ändert kein bestehender Test seine Erwartung, und keine Prüfung
   wird gelockert. Jede Anpassung begründest du im PR. Wird ein anderer
   Test rot (außer der bekannten Ausnahme keine-emojis): STOPP und melden.
7. DEVELOPMENT.md: Eintrag „Datenschutzerklärung Hof-Daten/SEPA (A006b)“
   (beide Seiten behalten, falls A004b, A011 oder A012 vorher mergen):
   - was und warum (Variante A; Prüfliste Recht Teil 7; Weichen W1/W2 mit
     der gewählten Fassung);
   - Merksatz: „Die Erklärung sagt nur, was der Code tut. Ändern sich
     Speicherung, Löschung, ein Dienstleister oder eine Region, ändert sich
     der Abschnitt im selben PR.“
   - offene technische Punkte: Rücklastschrift ohne Ausweg bis Lauf 34
     Nr. 290 (290 ersetzt dann den Satz aus Ä3); bis 290 hebt die Sperre
     nur ein Eingriff der PL in der Datenbank auf (kein Weg in der App);
     keine Löschfrist für abgemeldete Neuigkeiten-Abos (Zeile bleibt
     ausgeschaltet stehen, src/server/abo-anmeldung.ts:158-165) und für
     Kunden-Konten (gelöscht nur über „Konto löschen“,
     src/server/actions/subscriptions.ts:146-150); Stufe 2 nicht freigegeben
     (src/lib/konto-schliessen.ts:56); Stripe-Kennungen fehlen in
     ENDGUELTIG_LOESCHEN; keine Löschung nach Ablauf der Aufbewahrung;
     Web Analytics hängt am Code (Test koppelt).
8. Im Bericht (CLAUDE.md §4): je E3, B1-B10, Ä1-Ä8, W1 und W2, welche
   Fassung du genommen hast, und eine Tabelle „Prüfliste Recht Teil 7“
   mit den Punkten 1-9 und dem Abschnitt, der sie erfüllt (Nr. 5: „nicht
   umgesetzt, Kunden-Konto besteht laut Code und E8 – Frage an Recht“;
   Nr. 6: „Erinnerung (296) gefasst unter ‚Bestätigungslink bei
   Barzahlung‘; wörtlich ‚(auch als Erinnerung)‘ erst, wenn 296 gebaut
   ist – Recht entscheidet“).
   Dieselbe Tabelle in den PR-Text, damit Recht dort abhakt.
   Abschnitt „Offen für Recht“ in Bericht und PR-Text, Pflicht:
   - bei W1 = AN: „Einwilligung nach § 165 Abs. 3 TKG für Vercel Web
     Analytics (A24) – Empfehlung Recht: im Code entfernen (eigener /fix
     entfernt <AnalyticsGefiltert />; dann W1 = AUS, Ä4 greift, Ä8
     entfällt). Ist Analytics nur im Vercel-Projekt aus, beschreibt der
     Text mehr, als passiert (A24: unschädlich).“
   - bei „Ä6 nein“: „Neuigkeiten per WhatsApp verschickt der Hof selbst
     und sieht Name und Telefonnummer (status-posts.ts,
     whatsapp-tap-client.tsx); die Erklärung sagt in 1 und 9 ‚wir
     verschicken‘ und in 9 ‚Abmelde-Link in jeder Nachricht‘.“
   - bei „Ä7 nein“: „Speicherdauer fehlt für Neuigkeiten-Abos nach der
     Abmeldung (Zeile bleibt, abo-anmeldung.ts:158-165) und für das
     Kunden-Konto.“
   - bei „Ä8 nein“ und W1 = AN: „Abschnitt 4 nennt Web Analytics ohne
     Zweck und Rechtsgrundlage (Art. 13 Abs. 1 lit. c).“
   - immer: „B7 = nein: Grundlage für OSM (UK) bleibt ungenannt; Recht
     prüft, ob der Satz zum Angemessenheitsbeschluss doch hinein soll.“
   - immer, als Sammelpunkt (keine Änderung im Lauf): (a) Abschnitt 2
     „Session-Cookies (für Warenkorbfunktion …)“, der Warenkorb liegt aber
     in localStorage (Abschnitt 5); (b) Sentry „nicht wer betroffen war“,
     als Nutzerkennung geht aber die Hof-ID mit
     (src/lib/sentry-hygiene.ts:58-60); (c) Order.teilenKanal (Kanal des
     geteilten Links, prisma/schema.prisma:978-980) wird nirgends genannt;
     (d) AGB 25.2 nennt den Zweck „Verbesserung der Plattform“,
     Abschnitt 3 nicht.
9. Register: selbst nichts eintragen. Im PR-Text unter „Für das Register
   (Vorschlag)“, mit F = erste freie N-Nummer auf main beim Öffnen des PR
   (am 10.11. wäre das N49; A012 legt selbst einen Eintrag an, und
   Nachtlauf 34 Abschnitt A belegt die nächste freie Nummer – die PL
   vergibt die Nummer beim Eintragen neu, wenn sie inzwischen belegt ist):
   „N<F> · Datenschutzerklärung, Fassung November 2026 (Variante A) (<Datum>):
   - Die Datenschutzerklärung ist neu gefasst (1–18): Hof-Daten,
     SEPA-Lastschrift und Monatsabrechnung, DPMG, Admin-Protokoll,
     Server-Logs, Rollen und Drittland-Grundlagen.
   - Sie wird ohne vorherige Rückmeldung der Anwältin veröffentlicht; Recht
     hat sie vor dem Merge an der Prüfliste (F056, Teil 7) geprüft; die
     Anwältin prüft nach.
   - Ändert für die Datenschutzerklärung die Reihenfolge ‚nach Rückmeldung
     der Anwältin‘ aus N38 und N33 (Datenschutz-Teil von N33 damit
     erledigt).
   - Ändert N43 (4) für die Datenschutzerklärung: Sie bleibt nicht mehr als
     ganze Datei wörtlich. Bis zur Entscheidung der Anwältin bleibt nur der
     Text des Absatzes zum Rücktritt wörtlich; seine Zwischenüberschrift
     heißt ‚Bei einem Rücktritt (Widerruf)‘. Neuer Wortlaut kommt nur von
     der Projektleitung.
   - Web Analytics steht in der Erklärung genau dann, wenn der Code es
     einbindet (Test).
   - N36 (Freigabe der Löschliste) und E8 (bestehende Seiten unter
     /account) bleiben unverändert.
   - Umsetzung: A006b.“
10. Vor dem PR: pnpm typecheck, pnpm lint, pnpm test und pnpm
    pruefen:doku, je Befehl einzeln; pruefen:doku läuft auch, wenn
    pnpm test nur an keine-emojis rot ist. Vorschau /datenschutz hell und dunkel, bei 390 px und
    1440 px; Verzeichnis springt, Drucken geht; je Breite ein Bild in den
    PR.

Nicht:
- Keine Migration, kein Paket, keine Variable, keine neue Route.
- Kein Eingriff in Web Analytics (layout.tsx, analytics-gefiltert.tsx,
  analytics-filter.ts, package.json bleiben ohne Diff).
- Keine Änderung an Impressum (läuft als A004b), AGB, Konditionen,
  /widerruf, Mails, SEPA-, Stripe- oder Abrechnungslogik, /account.
- docs/nachtlauf/status.md, docs/nachtlauf/**, docs/entscheidungen.md und
  docs/ai/** ohne Diff (BAUSTEINE.md ändert sich nicht, weil unter src/
  kein neuer Export entsteht; meldet pnpm bausteine doch einen
  Unterschied: nicht committen, im Bericht nennen).
- ENDGUELTIG_* nicht anfassen.
- Keine echten Namen, Anschriften oder E-Mail-Adressen. Nur MARKE,
  DATENSCHUTZ_EMAIL und „Kontaktdaten siehe Impressum“; die Firmenanschrift
  von Stripe bleibt wie heute.
- Kein Umformulieren. Ein Fehler im Text gehört im Bericht unter „Offen für
  Recht“ gemeldet, nicht geändert.
- Nicht auf main committen, nicht mergen.

Dateigrenze: src/app/(public)/datenschutz/page.tsx; neu
tests/datenschutz-struktur.test.ts; tests/rechtstext-vorlage.test.ts,
tests/altrouten-datenschutz.test.ts, tests/wortliste.test.ts (nur (a)-(d));
DEVELOPMENT.md.

Fertig, wenn:
- Der PR mit fix: ist offen, die CI grün (bis auf die bekannte Ausnahme
  keine-emojis, falls die CI unter Unicode < 17 läuft), die Vorschau gebaut.
- /datenschutz zeigt 18 Abschnitte, ohne Platzhalter, mit Stand November
  2026, ohne „Entwurf“.
- tests/datenschutz-struktur.test.ts ist grün; nur die erlaubten
  Testanpassungen sind drin.
- DEVELOPMENT.md ist ergänzt; Registervorschlag, Prüflisten-Tabelle und die
  gewählten Fassungen (E3, B1-B10, Ä1-Ä8, W1, W2) und „Offen für Recht“
  stehen im PR-Text.

ANHANG – WORTLAUT (verbindlich; {…} = Konstante; [Ä…] und „A006:“ sind
Markierungen dieses Auftrags und kommen nie auf die Seite)

1. Verantwortliche Stelle und Rollen
Verantwortlich für die Datenverarbeitung auf dieser Plattform ist der Betreiber von {MARKE} (Kontaktdaten siehe Impressum).
Kontakt für Datenschutzanfragen: {DATENSCHUTZ_EMAIL} (mailto wie heute)
Wer wofür verantwortlich ist:
• {MARKE} ist verantwortlich für den Betrieb der Plattform: Konten, Bestellabwicklung auf der Plattform, E-Mails, Sicherheit und die Abrechnung mit den Höfen.
• Der Hof, bei dem du bestellst, bekommt deine Bestelldaten (Name, E-Mail-Adresse, Telefonnummer, Bestellung, Abholtermin, Notiz). Für ihre Nutzung, etwa zur Übergabe, für seine Buchhaltung oder bei einer Reklamation, ist er selbst verantwortlich. Dein Kaufvertrag ist mit dem Hof.
• [Ä6] Neuigkeiten von Höfen per E-Mail verschicken wir im Auftrag des Hofs. Hier ist der Hof verantwortlich, und wir verarbeiten deine Daten nur nach seinen Vorgaben. Per WhatsApp schickt der Hof sie selbst (Abschnitt 9).
    A006: „Neuigkeiten von Höfen verschicken wir im Auftrag des Hofs. Hier ist der Hof verantwortlich, und wir verarbeiten deine Daten nur nach seinen Vorgaben (Abschnitt 9).“
• Stripe wickelt Zahlungen ab und ist dabei für einen Teil der Verarbeitung selbst verantwortlich (Abschnitt 4).

2. Welche Daten wir verarbeiten – nur diese Stellen:
(a) Liste „Bei einer Bestellung“, neuer letzter Punkt: „Käuferart (privat oder Betrieb) und, wenn du als Betrieb Futter kaufst, die Betriebsnummer, die du angibst“
(b) Absatz „Zahlungsdaten:“ ersetzen: „Zahlungsdaten: Karten- und Kontodaten gibst du direkt in ein Formular von Stripe ein. Stripe verarbeitet und speichert sie. {MARKE} speichert keine Karten- oder Kontonummern, sondern nur die Kennung der Zahlung bei Stripe, den Betrag und den Stand (bezahlt, erstattet). Mit der Kennung können wir eine Zahlung bei Stripe wiederfinden, etwa für eine Erstattung.“
(c) Punkt „Server-Logs (IP-Adresse, Zeitstempel) für Betrieb und Sicherheit“ ersetzen: „Server-Logs (IP-Adresse, Zeitpunkt, aufgerufene Adresse) für Betrieb und Sicherheit – Näheres in Abschnitt 18“
(d) B10 ja – „Weitere Cookies“, neuer letzter Punkt: „Cookies von Stripe (etwa __stripe_mid, __stripe_sid): nur wenn du online bezahlst oder als Hof die Lastschrift einrichtest. Stripe setzt sie zur Betrugsabwehr; Näheres in der Datenschutzerklärung von Stripe.“
(e) [Ä1] Zwischenüberschrift „Bei einem Widerruf:“ ersetzen: „Bei einem Rücktritt (Widerruf):“ – der Absatz darunter bleibt Wort für Wort.
    A006: keine Änderung (Zwischenüberschrift „Bei einem Widerruf:“ bleibt).

3. Zweck und Rechtsgrundlage
• Abwicklung und Bestätigung von Bestellungen, Kommunikation zwischen Hof und Kundschaft, Konten der Höfe und Abrechnung mit den Höfen. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertrag).
• Erfüllung gesetzlicher Pflichten, etwa Aufbewahrung nach § 132 BAO oder Meldungen nach dem DPMG (Abschnitt 16). Rechtsgrundlage: Art. 6 Abs. 1 lit. c DSGVO (rechtliche Verpflichtung).
• Betrieb und Sicherheit der Plattform, Schutz vor Missbrauch, Fehlersuche und Nachvollziehbarkeit von Eingriffen des Teams. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren, funktionierenden Dienst).
• [Ä8, nur bei W1 = AN] Reichweitenmessung mit Vercel Web Analytics: Wir zählen, wie oft welche Seite aufgerufen wird, ohne Cookies und ohne dich wiederzuerkennen, um zu sehen, was genutzt wird. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer Reichweitenmessung ohne Cookies).
    A006 bzw. W1 = AUS: kein solcher Punkt.
• Neuigkeiten von Höfen: Rechtsgrundlage des Hofs ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO); wir handeln dabei in seinem Auftrag (Abschnitt 9).
• Die freiwillige E-Mail-Adresse bei Meldungen: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).
Bei einzelnen Funktionen steht die Rechtsgrundlage zusätzlich im jeweiligen Abschnitt.

4. Empfänger und Dienstleister, Übermittlung in Drittländer
Wir geben Daten nur weiter, soweit es für den jeweiligen Zweck nötig ist. Dienstleister, die in unserem Auftrag arbeiten, haben mit uns einen Vertrag zur Auftragsverarbeitung (Art. 28 DSGVO). Sitzt ein Dienstleister außerhalb der EU bzw. des EWR oder greift er von dort zu, nennen wir unten die Grundlage dafür.
[hoefe] Höfe: Der Hof, bei dem du bestellst, bekommt die Daten deiner Bestellung (Abschnitt 1).
[stripe] Stripe (Zahlungsabwicklung): Stripe Payments Europe Ltd., 1 Grand Canal Street Lower, Dublin 2, Irland. Stripe verarbeitet Zahlungen der Kundschaft, die Lastschrift und die Rechnungen der Höfe sowie die Stripe-Konten der Höfe.
  B1 ja: „Für die Zahlungsabwicklung und für seine eigenen gesetzlichen Pflichten (etwa gegen Geldwäsche und Betrug) ist Stripe selbst verantwortlich.“
  B1 nein: „Stripe verarbeitet diese Daten teils als eigener Verantwortlicher, teils in unserem Auftrag; Näheres in der Datenschutzerklärung von Stripe.“
  „Stripe kann Daten an Stripe, Inc. in den USA übermitteln. Grundlage: [GRUNDLAGE].“
[supabase] Supabase (Datenbank): Supabase, Inc., USA. Die Datenbank liegt auf Servern in Frankfurt am Main (EU). Für einen Zugriff aus den USA, etwa durch den Support, gelten Standardvertragsklauseln der EU-Kommission (Art. 46 Abs. 2 lit. c DSGVO).
[vercel] W1 = AN (wie A006): Vercel (Hosting, Bild-Speicher, Reichweitenmessung): Vercel Inc., USA. Hosting der Webanwendung, Speicher für Fotos der Höfe und Bildschirmfotos aus Meldungen, technische Protokolle (Abschnitt 18). Vercel Web Analytics zählt Seitenaufrufe ohne Cookies: Es werden keine Kennungen auf deinem Gerät gespeichert und keine Profile über den Tag hinaus gebildet.
  [Ä4] W1 = AUS: Vercel (Hosting, Bild-Speicher): Vercel Inc., USA. Hosting der Webanwendung, Speicher für Fotos der Höfe und Bildschirmfotos aus Meldungen, technische Protokolle (Abschnitt 18).
  B4 ist ein Ort: „Die Anwendung läuft auf Servern in <B4>.“ (bei „unbekannt“ weglassen)
  „Grundlage für die Übermittlung in die USA: [GRUNDLAGE].“
[resend] Resend (E-Mail-Versand): Resend, Inc., USA. [Ä2] Versand der E-Mails der Plattform, etwa Bestellbestätigung, Bestätigungslink bei Barzahlung, Abholhinweis und andere Nachrichten zum Stand deiner Bestellung, Anmeldecode, Neuigkeiten von Höfen sowie Nachrichten und Rechnungshinweise an Höfe. Dabei gehen die Empfänger-Adresse und der Inhalt der E-Mail an Resend.
    A006: „Versand der E-Mails der Plattform, etwa Bestellbestätigung, Abholhinweis, Anmeldecode und Rechnungshinweise.“
  B5 versand-und-protokolle-eu: „Versendet wird über Server in Irland (EU).“
  B5 nur-versand-eu: „Versendet wird über Server in Irland (EU); Versandprotokolle kann Resend auch in den USA speichern.“
  B5 unbekannt: weglassen.
  „Grundlage für einen Zugriff aus den USA: [GRUNDLAGE].“
[sentry] Sentry (Fehlerdiagnose): Functional Software, Inc., USA. „Technische Fehlerberichte“ + (B6 ja: „, gespeichert auf Servern in der EU (Frankfurt am Main)“) + „. Vor dem Versand entfernen wir personenbezogene Inhalte (IP-Adressen, E-Mail-Adressen, Telefonnummern, Cookies, Zugangsdaten). Übermittelt wird, was technisch schiefging, nicht wer betroffen war. Grundlage für einen Zugriff aus den USA: [GRUNDLAGE].“
[cloudflare] Cloudflare (DNS und E-Mail-Empfang): Cloudflare, Inc., USA. DNS der Domain und Empfang der E-Mails an unsere Kontaktadressen, mit Weiterleitung an den Betreiber. Grundlage: [GRUNDLAGE].
[anthropic] entfällt (E3 = c).
[osm] OpenStreetMap Foundation (Karten und Ortssuche): Vereinigtes Königreich. Kartenkacheln und Ortssuche (Abschnitt 11).
  B7 ja: „Grundlage: Angemessenheitsbeschluss der EU-Kommission für das Vereinigte Königreich.“ (sonst weglassen)
[behoerden] Finanzverwaltung: Soweit ein Gesetz es verlangt, geben wir Daten an Behörden, etwa an das Finanzamt (Abschnitt 16).
[GRUNDLAGE] je Dienst nach B2:
  ja → beim ersten Vorkommen auf der Seite: „EU-US Data Privacy Framework (Angemessenheitsbeschluss der EU-Kommission vom 10. Juli 2023) und Standardvertragsklauseln“, danach „EU-US Data Privacy Framework und Standardvertragsklauseln“
  nein → „Standardvertragsklauseln der EU-Kommission (Art. 46 Abs. 2 lit. c DSGVO)“

5. Speicherdauer
• Bestellungen und die Daten dazu (auch ein Rücktritt vom Kauf): 7 Jahre ab Ende des Kalenderjahres, wegen der Aufbewahrungspflicht nach § 132 BAO. Darüber hinaus nur, solange ein Streit über die Bestellung offen ist.
• Monatsabrechnungen und Rechnungen der Höfe: 7 Jahre ab Ende des Kalenderjahres (§ 132 BAO).
• Hofkonto: solange es besteht. Nach dem Schließen gilt Abschnitt 14.
• Postfach eines Hofs: solange das Hofkonto besteht (Abschnitt 13).
• [Ä7] Anmeldung zu Neuigkeiten (E-Mail-Adresse und, wenn angegeben, Telefonnummer): solange du angemeldet bist. Meldest du dich ab, bleibt der Eintrag ausgeschaltet gespeichert, bis du dein Kunden-Konto löschst (Abschnitt 10) oder uns bittest, ihn zu löschen.
• [Ä7] Kunden-Konto: bis du es löschst (Abschnitt 10) oder uns bittest, es zu löschen.
    A006: keine dieser beiden Zeilen.
• Sitzungen samt IP-Adresse: bis {SITZUNGEN_NACH_ABLAUF_TAGE} Tage nach ihrem Ablauf.
• Anmeldecodes: {CODES_NACH_ABLAUF_TAGE} Tag nach Ablauf.
• Versandprotokoll der E-Mails (Empfänger nur als Prüfwert, dazu ob die Mail zugestellt, abgewiesen oder als Spam gemeldet wurde): {MAIL_PROTOKOLL_AUFBEWAHREN_TAGE} Tage.
• Protokoll im Admin-Bereich: {ADMIN_PROTOKOLL_JAHRE} Jahre (Abschnitt 17).
• Erledigte Fehler- und Wunschmeldungen: 90 Tage nach ihrer Bearbeitung (Abschnitt 12).
• Server-Logs: B8 ja „höchstens 30 Tage“ / B8 nein „so lange, wie unser Hosting-Dienstleister sie für den Betrieb vorhält, in der Regel wenige Tage“ + „ (Abschnitt 18)“
• Warenkorb im Browser (localStorage): bis du ihn löschst.

6. Deine Rechte – neuer letzter Punkt: „Widerruf einer Einwilligung: Eine Einwilligung kannst du jederzeit für die Zukunft widerrufen. Was bis dahin geschehen ist, bleibt rechtmäßig.“

9. Newsletter und Neuigkeiten von Höfen – nach dem ersten Absatz: [Ä6] „Verantwortlich für die Neuigkeiten ist der Hof. Per E-Mail verschicken wir sie in seinem Auftrag und verwalten deine Anmeldung und Abmeldung nach seinen Vorgaben. Hast du Neuigkeiten per WhatsApp gewählt, sieht der Hof deinen Namen und deine Telefonnummer und schickt die Neuigkeiten selbst über sein WhatsApp. Wird eine Neuigkeiten-Mail abgewiesen oder als Spam gemeldet, melden wir die Adresse ab.“
    A006: „Verantwortlich für die Neuigkeiten ist der Hof. Wir verschicken sie in seinem Auftrag und verwalten deine Anmeldung und Abmeldung nach seinen Vorgaben. Wird eine Neuigkeiten-Mail abgewiesen oder als Spam gemeldet, melden wir die Adresse ab.“
   [Ä6] In der Liste zum Widerruf den Punkt „Über den Abmelde-Link in jeder Nachricht“ ersetzen: „Über den Abmelde-Link in jeder E-Mail“.
    A006: keine Änderung (Punkt bleibt „Über den Abmelde-Link in jeder Nachricht“).

10. Kunden-Konto – den Satz „Dabei wird deine E-Mail-Adresse gespeichert sowie ein temporärer Sitzungs-Cookie gesetzt (gültig 7 Tage).“ ersetzen: „Dabei wird deine E-Mail-Adresse gespeichert sowie ein Sitzungs-Cookie gesetzt. Er gilt 7 Tage und verlängert sich, solange du die Seite nutzt, höchstens aber {SITZUNG_HOECHSTENS_TAGE} Tage ab der Anmeldung.“

11. Standort, Karte und Umkreissuche – bisheriger Text von „Standortsuche und Kartendarstellung“, dann (mit id="umkreissuche") der bisherige Text von „Umkreissuche auf der Hofübersicht“, dann neuer Absatz:
„Die Karten und die Ortssuche kommen von der OpenStreetMap Foundation (Vereinigtes Königreich), die für die Auslieferung der Kacheln Dienstleister einsetzen kann. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO: Wir haben ein berechtigtes Interesse daran, Höfe auf einer Karte zu zeigen, ohne einen Kartendienst mit Werbung oder Konto zu verwenden. Auf der öffentlichen Hofübersicht lädt die Karte erst, wenn du die Kartenansicht öffnest. Auf deinem Gerät wird dabei nichts gespeichert.“

12. Fehler- und Wunschmeldungen – bisheriger Text, unverändert (E3 = c: kein Absatz zur KI-Sichtung).

13. Postfach – den Satz „Die Nachrichten bleiben gespeichert, solange das Hofkonto besteht, und werden mit dem Hof gelöscht.“ ersetzen: „Die Nachrichten bleiben gespeichert, solange das Hofkonto besteht; nach dem Schließen gilt Abschnitt 14.“

14. Daten der Höfe
Für Höfe, die {MARKE} nutzen, verarbeiten wir zusätzlich:
• Konto: E-Mail-Adresse zur Anmeldung, Name, Telefonnummer, Passwort (nur als Prüfwert (Hash), nie im Klartext), auf Wunsch ein Passkey (nur der öffentliche Schlüssel), die angemeldeten Geräte (Gerät und Browser, nie Ort oder IP-Adresse) und die Sitzungen (mit IP-Adresse, Abschnitt 5).
• Hofprofil: Hofname, Name der Inhaberin oder des Inhabers, Anschrift, Standort auf der Karte, Telefon, E-Mail-Adresse des Hofs, Texte, Fotos, Produkte, Abholzeiten und, wenn du sie angibst, die LFBIS- bzw. BAES-Nummer. Was auf der Hofseite steht, ist öffentlich. Name, Anschrift und E-Mail-Adresse des Hofs stehen außerdem in den Bestellbestätigungen an die Kundschaft, weil das Gesetz diese Angaben verlangt.
• Zustimmung zu den AGB: welche Fassung du angenommen hast und wann.
• Online-Zahlung: Dein Stripe-Konto für Auszahlungen richtest du bei Stripe ein. Beim Anlegen geben wir Stripe das Land, die E-Mail-Adresse des Hofs und die Adresse deiner Hofseite. Welche weiteren Angaben nötig sind (etwa zu deiner Person und deinem Konto für Auszahlungen), gibt Stripe dir vor und verarbeitet sie selbst. [Ä5] Wir speichern nur die Kennung des Kontos und den Stand der Einrichtung (etwa ob es fertig eingerichtet ist). Ohne Stripe-Konto können wir deinen Hof nicht freischalten.
    A006: „Wir speichern nur die Kennung des Kontos und ob es fertig eingerichtet ist.“
• Verwaltung: Freischaltung, Gründungsplatz, Konditionen (etwa Prozentsatz der Plattformgebühr, Abrechnungstag), eine Sperre durch das Team mit Grund sowie das Pausieren, Stilllegen und Schließen.
• Nachrichten im Postfach (Abschnitt 13) und deine Meldungen (Abschnitt 12).
Zweck: dein Hofkonto führen, deinen Hof zeigen, Bestellungen vermitteln und mit dir abrechnen. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertrag). Für die Aufbewahrung von Abrechnungen gilt lit. c (§ 132 BAO), für Sicherheit, Geräte-Hinweise und das Protokoll lit. f.
Konto schließen: Schließt du dein Hofkonto, ist deine Hofseite sofort offline, die Anmeldung ist gesperrt und Neuigkeiten-Abos enden. 30 Tage lang kannst du das rückgängig machen. Danach sollen Kontakt, Fotos, Texte, Beiträge, Nachrichten, Geräte und Anmeldedaten des Hofs gelöscht oder unkenntlich gemacht werden; Bestellungen, Beträge und Abrechnungen bleiben, solange die Aufbewahrungspflicht gilt (Abschnitt 5). Dieses Löschen läuft noch nicht von selbst. Bis dahin bleiben die Daten gespeichert; wir verwenden sie weiter für die Schlussabrechnung und für gesetzliche Pflichten. Möchtest du die Löschung vorher, schreib an {DATENSCHUTZ_EMAIL}. Wir bearbeiten deine Anfrage von Hand und antworten dir innerhalb eines Monats.

15. SEPA-Lastschrift und Monatsabrechnung der Höfe
Für Barbestellungen ziehen wir die Plattformgebühr einmal im Monat per SEPA-Lastschrift ein, ab dem Einzugsbeginn deines Hofs (AGB Punkt 19).
• Lastschrift einrichten: Den Auftrag (Mandat) erteilst du in einem Formular von Stripe in der App. Deine IBAN, Name und E-Mail-Adresse des Kontoinhabers und die Bestätigung des Mandats nimmt Stripe direkt auf. Zur Bestätigung gehören Zeitpunkt, IP-Adresse und Browser, als Nachweis für die Bank. Stripe speichert diese Daten.
• Was wir speichern: keine IBAN und keine Kontodaten, nur die Kennung deines Hofs als Kunde bei Stripe und die Kennung des Zahlungsmittels, den Zeitpunkt, zu dem das Mandat gültig wurde, und je Monat die Beträge, die Zahl der Bestellungen, den Stand der Abrechnung (offen, bezahlt, gescheitert, zurückgebucht) und die Kennungen der Rechnungen. Unter „Deine Konditionen“ zeigen wir Bank und letzte vier Stellen deiner IBAN. Diese Angaben holen wir beim Öffnen der Seite bei Stripe und speichern sie nicht.
• An Stripe geben wir dafür den Namen deines Hofs, die E-Mail-Adresse deines Kontos und je Rechnung die Bestellnummern mit der Gebühr.
• Rechnung und Ankündigung: Stripe erstellt die Monatsrechnungen; du findest sie unter „Deine Konditionen“. (B9 ja: „Stripe schickt sie dir außerdem per E-Mail und kündigt darin die Lastschrift an.“) Vor dem ersten Einzug bekommst du eine Nachricht im Postfach und eine E-Mail.
• Wenn der Einzug scheitert: Stripe versucht es erneut, und du bekommst eine Nachricht. Bleibt ein Betrag länger offen, als in deinen Konditionen steht (Vorgabe 14 Tage), nimmt dein Hof keine Barbestellungen mehr an, bis der Betrag bezahlt ist; danach geht es von selbst wieder. [Ä3] Bucht deine Bank eine Lastschrift zurück, nimmt dein Hof sofort keine Barbestellungen mehr an, bis ein Mensch aus unserem Team es mit dir geklärt hat – schreib uns dazu an die Adresse in Abschnitt 1. Beides geschieht nach dieser festen Regel automatisch. Wir bewerten dabei nicht deine Person oder deine Zahlungsfähigkeit und fragen keine Auskunftei. Schreibst du uns, sieht sich ein Mensch die Sperre an.
    A006 (statt des [Ä3]-Satzes): „Bucht deine Bank eine Lastschrift zurück, nimmt dein Hof sofort keine Barbestellungen mehr an, bis wir es mit dir geklärt haben.“
    W2 = ja (290 schon auf main): statt des [Ä3]-Satzes der Satz von Recht aus der Weiche W2.
• Ohne Mandat bietet die Kasse bei deinem Hof ab dem Einzugsbeginn nur Online-Bezahlen an, außer deine Konditionen sehen eine Überweisung vor. Das Mandat ist also nicht gesetzlich vorgeschrieben, aber Bedingung für Barbestellungen.
Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Abrechnung nach den AGB), für die Aufbewahrung der Rechnungen lit. c (§ 132 BAO). Die Kennungen bewahren wir auf, solange das Mandat gilt, und danach so lange wie die Rechnungen, die damit eingezogen wurden (Abschnitt 5).

16. Meldung an das Finanzamt (DPMG)
Als Betreiber einer Plattform müssen wir nach dem Digitale Plattformen-Meldepflichtgesetz (DPMG) einmal im Jahr Angaben zu Höfen, die über {MARKE} verkaufen, und zu ihren Umsätzen an das Finanzamt melden. Ausgenommen sind Höfe mit weniger als 30 Verkäufen und höchstens 2.000 € Umsatz über die Plattform im Kalenderjahr.
Gemeldet werden insbesondere Name, Anschrift, Steuernummer bzw. UID, bei natürlichen Personen das Geburtsdatum, bei Unternehmen die Firmenbuchnummer, die Umsätze und die Gebühren je Quartal sowie das Konto für Auszahlungen, soweit das Gesetz es verlangt.
Diese Angaben erheben wir noch nicht. Wir fragen dich rechtzeitig vor Ende des ersten Kalenderjahres, für das wir melden müssen, danach und sagen dir vorher, was wir melden.
Rechtsgrundlage: Art. 6 Abs. 1 lit. c DSGVO in Verbindung mit dem DPMG. Die Angaben sind gesetzlich vorgeschrieben. Fehlen sie trotz zweier Erinnerungen, müssen wir dein Hofkonto sperren oder Auszahlungen zurückhalten, bis sie vorliegen (AGB 27.3). Speicherdauer: so lange, wie das DPMG es vorschreibt.

17. Protokoll im Admin-Bereich
Wir halten Eingriffe des Teams fest: etwa das Anzeigen der vollen E-Mail-Adresse einer Kundin, das Sperren eines Hofs, einen Storno im Namen eines Hofs oder eine geänderte Kondition. Ebenso halten wir Ereignisse fest, die Geld oder den Zustand eines Hofs ändern, etwa ein gültiges Mandat oder eine zurückgebuchte Lastschrift.
Gespeichert werden: wer es war (oder „System“), was geschah, auf welchen Hof oder welche Bestellung es sich bezieht (nur als Kennung), ein kurzer Grund und ob mit Passkey bestätigt wurde. Adressen, Telefonnummern und Inhalte speichern wir dort nicht.
Zweck: Eingriffe nachvollziehbar machen und Missbrauch erkennen. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO. Wir ändern die Einträge nicht und löschen sie nach {ADMIN_PROTOKOLL_JAHRE} Jahren.

18. Server-Logs und Schutz vor Missbrauch
Bei jedem Aufruf entstehen bei unserem Hosting-Dienstleister technische Protokolle: IP-Adresse, Zeitpunkt, aufgerufene Adresse, Browser-Kennung und ob die Anfrage geklappt hat. Wir nutzen sie nur, um Fehler zu finden und Angriffe abzuwehren. Speicherdauer siehe Abschnitt 5.
Um Anmeldungen, Codes, Bestellungen und Meldungen vor Missbrauch zu schützen, zählen wir Anfragen je Absender für kurze Zeit. Dafür speichern wir deine IP-Adresse oder E-Mail-Adresse nicht im Klartext, sondern nur als gekürzten Prüfwert, den wir mit einem geheimen Schlüssel bilden. Wir löschen ihn täglich, sobald das Zeitfenster vorbei ist.
Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren Betrieb). Du kannst dem widersprechen (Abschnitt 6). Ohne diese Protokolle können wir die Plattform aber nicht sicher betreiben.

A006b freigegeben
