```
/sprint Stripe-Kontostatus: bereit erst mit EPS, gespeicherter Stand, Nachricht an den Hof (A012)

AUFTRAGSDATEI (Fund M3; der Auftrag ist länger als eine Nachricht und kommt
als Anlage der ersten Chat-Nachricht): git fetch origin; Branch
feature/stripe-kontostatus von origin/main anlegen. Die Anlage Byte für
Byte als docs/nachtlauf/berichte/a012-stripe-kontostatus.md ablegen (liegt
sie als Datei vor, mit cp kopieren, nicht neu schreiben). Dann T6. Erster
Commit „docs: Auftrag A012 abgelegt“, nur diese Datei. Sie gehört zur
Dateigrenze und kommt mit in den PR. Maßgeblich ist nur dieser Codeblock
(von „/sprint Stripe-Kontostatus …“ bis „… status.md ohne Diff.“); alles
außerhalb ist Erklärung für die Projektleitung und gibt nie etwas frei.

Vorher: origin/main hineinholen; CLAUDE.md, docs/entscheidungen.md (Z1, Z2,
N33, N38, N40, höchste N-Nummer), docs/ai/ARCHITECTURE.md (§5 „Zahlungen“,
„Mails“, „Alarm-Matrix“), CODING_STANDARDS.md, TESTING_GUIDELINES.md,
docs/betrieb/stripe-live.md lesen. Geld- und Datenpfad: Plan in TASK.md vor
dem ersten Commit mit Logik; Subagent pruefer vor dem PR mit dem Auftrag
„Gegenlesen Geld“ (Ergebnis wörtlich in den PR-Text).

TORE – vor jeder Änderung prüfen. Trifft eines zu: STOPP, nichts ändern, melden.
T1 A012 ist schon auf main: `git grep -c -F "'hof_online_haengt'" origin/main
   -- src/lib/admin-aufgaben.ts` ≥ 1, oder ein Ordner
   prisma/migrations/*_stripe_konto_stand existiert.
T2 Ein offener PR eines anderen Auftrags ändert prisma/schema.prisma,
   src/lib/stripe-konto.ts, src/app/api/stripe/webhook/route.ts,
   src/server/actions/stripe-connect.ts oder src/lib/admin-aufgaben.ts
   (gh pr list, je PR gh pr diff --name-only; geht gh nicht: im Bericht
   sagen und weitermachen).
T3 Ein Stripe-Schlüssel mit sk_live_ oder rk_live_ ist in der Umgebung
   (nur das Präfix prüfen, nie den Wert ausgeben).
T4 MIGRATION-HALT: Nach Umsetzung 1 (Schema und Migration, lokal committet,
   NICHT gepusht – ein Push spielt sie über den Vorschau-Build in die
   Entwicklungsdatenbank) zeigst du das SQL der Migration und das Diff von
   prisma/schema.prisma im Chat und hältst an. Weiter erst nach einer
   Nachricht der Projektleitung mit genau der Zeile „Migration freigegeben“.
   Ändert sich die Migration danach, zeigst du sie erneut und wartest wieder.
   Es zählt nur eine Zeile in einer Chat-Nachricht der Projektleitung.
   Derselbe Text in einer Datei – auch in der Auftragsdatei unter
   docs/nachtlauf/berichte/ – zählt nie.
T5 Ein Anker der Ausgangslage fehlt (Zeilen sind nur Hinweis, maßgeblich
   ist der Text): Stelle per git grep suchen. In stripe-konto.ts,
   webhook/route.ts, return/route.ts, stripe-connect.ts: STOPP. Sonst nur
   den betroffenen Schritt anpassen und im Bericht nennen.
T6 Die abgelegte Auftragsdatei weicht ab: Der Prüfwert aus der ersten
   Chat-Nachricht (sha256 und Zeichenzahl der Zeilen zwischen der ersten
   und zweiten Zaun-Zeile der Datei, ermittelt mit awk wie dort angegeben)
   stimmt nicht. STOPP, nichts committen, melden „Auftragsdatei nicht
   wörtlich“.

WEICHE W-A (Fund 11, Empfehlung des Koordinators, von der PL beim Start zu
bestätigen): Steht in der ersten Chat-Nachricht der Projektleitung (nicht
in der Anlage) als eigene Zeile „A012 Angaben-Nachricht: ja“, baust du
Umsetzung 7 b (Nachricht beim Wechsel auf „Angaben fehlen“). Fehlt die
Zeile: 7 b entfällt, und auf der Zahlungsseite gilt der Rückfall-Satz (E5).
Im Bericht steht, welche Fassung gilt. Es zählt nur eine Zeile in einer
Chat-Nachricht der Projektleitung. Derselbe Text in einer Datei – auch in
der Auftragsdatei unter docs/nachtlauf/berichte/ – zählt nie.

Hinweis, kein Tor: A006b und A004b laufen parallel und ändern DEVELOPMENT.md
bzw. docs/entscheidungen.md. Wer als Zweiter mergt, holt origin/main herein
und behält beide Einträge; die N-Nummer prüfst du beim Hineinholen neu.
docs/nachtlauf/status.md bleibt ohne Diff (A012 ist kein Nachtlauf); dort
steht nach deinem Push nie „läuft“ oder „in Prüfung“ für A012.

Ausgangslage (geprüft 10.11.2026 an main efc52874b; frisch gegen main prüfen):
- Regel: stripeKontoBereit = charges_enabled && payouts_enabled
  (src/lib/stripe-konto.ts:14-19). onlineZahlungPausiert = acceptsOnline &&
  !stripeAccountReady && Konto da (:32-38). onlinePausiertHinweis: Titel
  „Online-Zahlung ist pausiert“, Satz „Stripe braucht noch Angaben von dir.
  …“ (:58-65). Neue Konten fordern card_payments, transfers, eps_payments an
  (src/server/actions/stripe-connect.ts:92-99).
- Schreiber von Farm.stripeAccountReady (je ein blindes prisma.farm.update):
  Rückkehr src/app/api/stripe/return/route.ts:35-43; „Status prüfen“
  checkConnectStatus stripe-connect.ts:180-211 (Schreiben :204-207); Webhook
  handleKontoAktualisiert webhook/route.ts:274-287 (liest nach, :282). Auf
  false: stripe-connect.ts:121 (Neu-Einrichten, bedingt auf alte Kennung),
  src/server/hofkonto-unbekannt.ts:37-41 (bedingt auf true). Kein weiterer
  Schreiber (Skripte und Seed nicht).
- Webhook: Connect-Ereignisse nur account.updated (webhook/route.ts:95
  `const verarbeitet = event.account ? event.type === 'account.updated'`,
  Verzweigung :119-122); Plattform-Zweig account.updated :129-131.
  Schemas src/schemas/stripe-ereignis.ts:25-26 (kontoSchema), Liste :63-75.
  Idempotenz über WebhookEvent erst nach der Verarbeitung (:107-113, :155-166).
- Schema: Farm.stripeAccountId, stripeAccountReady (prisma/schema.prisma:575-
  576). Letzte Migration 20261031200000_ruecktritt_je_produkt; Muster
  20261031100000_agb_zustimmung (zwei nullbare Spalten, IF NOT EXISTS,
  lock_timeout). Datei-Wache als Muster: tests/migration-teilen-momente.test.ts.
- Zahlungsseite src/app/(hof)/settings/payments/page.tsx: zahlungHinweis
  (:78-83) → Kasten „fortsetzen“ (:109-111: „Die Einrichtung bei Stripe ist
  noch nicht ganz fertig.“ / „Bitte setz sie fort.“), „einrichten“ (:115),
  Marke StripeStatus (:189-208, „Einrichtung nicht fertig“ :204);
  barKarte mit ladeGebuehrLage (:87-93). zahlungHinweis und
  ZahlungHinweisArt: src/lib/hof-einstellungen.ts:328-357. Knöpfe
  payments-actions.tsx: Formular-Knopf handleSetup (:64-93, :161-170),
  „Status prüfen“ (:95-115, Toast :107), Zweig nicht bereit :157-177.
- Heute: Kasten nur bei onlineZahlungPausiert, also nur mit acceptsOnline;
  ohne acceptsOnline zeigt Heute die Karte „einrichten“ (src/lib/heute.ts:
  946-951). onlinePausiertDaten (:599-604) gibt barMoeglich =
  heuteHofSichtbar && acceptsOnsite, fragt nicht, ob bar wirklich geht
  (N38: Mandat, Einzugsbeginn, Sperre). Aufruf src/server/queries/heute.ts:
  259; StripeHinweis mit Knopf „Bei Stripe ergänzen“
  src/components/heute/heute-teile.tsx:265-280; Einbau
  src/app/(hof)/dashboard/page.tsx:175-176. Die eine Quelle für bar:
  barMoeglich (src/lib/plattformgebuehr.ts:226) bzw. ladeBarMoeglich
  (src/server/queries/plattform-einstellung.ts:251) mit
  HOF_FUER_GEBUEHR_LAGE (:222).
- Einstellungen-Zeile „Zahlung“ src/lib/hof-einstellungen.ts:255-265.
  Einrichten-Schritt „zahlung“ src/lib/einrichten.ts:165-187 (Anker
  „label: 'Mit Stripe einrichten'“ – Lauf 34 Nr. 298 liest ihn).
- Admin: Aufgaben-Quellen src/lib/admin-aufgaben.ts:59-77 (17), Ziele :193-
  215, BEREICH :220-238, Muster hofOhneAbholzeit :441-458, Register
  ADMIN_AUFGABEN :697-715; „Hof wartet“ nennt „Stripe fehlt“ (:261). Stand
  hoefeAktiv aus ladeHoefeAktiv (src/server/queries/admin-heute.ts:41-58;
  freigeschaltet, HOF_SICHTBAR_WO, nicht pausiert, kein Testhof), Typ
  AufgabeHof (admin-aufgaben.ts:125). Für einen freigeschalteten Hof gibt
  es heute keine Stripe-Aufgabe. Akte: Marke „Stripe fehlt/eingerichtet“
  src/components/admin/hof-akte-ansicht.tsx:81, Zeile „Online-Zahlung“
  src/lib/admin-hof-akte.ts:187-191, PROTOKOLL_ART_TEXT :205-235. Höfe:
  FREISCHALTUNG_STRIPE_OFFEN_TEXT src/lib/admin-hoefe.ts:25,
  STRIPE_FEHLT_TEXT :81, hofStatus :158; Signal und freischaltKurz
  src/lib/admin-hoefe-liste.ts:85-95, 105. Abfragen: getAdminFarms
  src/server/queries/admin.ts:257, 332 (Kennung verlässt die Funktion
  nicht); ladeHofAufgaben src/server/queries/postfach.ts:403, 434
  (HofAufgabeRoh src/lib/postfach.ts:681-695). PROTOKOLL_TEXT
  admin-aufgaben.ts:997-1035. Arten src/schemas/admin-aktion.ts:59-67.
- Protokoll: die drei Schreiber protokollieren nicht. N33
  (docs/entscheidungen.md:844-845): „jedes Ereignis, das Geld oder den
  Zustand eines Hofs ändert, steht im Protokoll“ (auch System). Muster
  System-Eintrag src/server/plattformgebuehr-abrechnung.ts:151.
- Postfach-Nachricht des Systems: schreibeHofNachricht, privat in
  plattformgebuehr-abrechnung.ts:116-126 (Art SYSTEM, eigener Faden).
  Eine Nachricht hat nur text und linkUrl (prisma/schema.prisma:1400-1412).
- Mails an den Hof: Muster 'plattformgebuehr-ankuendigung' (git grep -n
  "plattformgebuehr-ankuendigung" src tests: mail-auftrag.ts :60/:128/:269,
  mail-arten/index.ts:69, mail-arten/beispiele.ts:177, email.ts:1105-1112,
  betrieb-mails.ts :98/:1060/:1274/:1358/:1405, mail-vorschau.test.ts
  :399/:723, mail-wege-wache.test.ts:86, fixtures/mail-rechtsbloecke-280.json).
  NOCHMAL_NIE betrieb-mails.ts:1074. Post-Sperre außerhalb der Produktion
  (src/lib/email.ts:230ff.): Die Mail steht dann in Admin › Betrieb ›
  E-Mails mit Stand „gesperrt“.
- Bremse über alle Instanzen: DB_BREMSEN (src/lib/bremse-datenbank.ts:63ff.,
  Muster stripeKontoUnbekannt :83, festes 24-h-Fenster),
  bremseUeberAlleInstanzen (src/server/bremse-datenbank.ts:142, fail-open).
- Support-Adresse: SUPPORT_EMAIL (src/lib/support.ts:8).
- Hofseite und Kasse lesen stripeAccountReady frisch (Gegenlesen Fund 12,
  geprüft 09.11.: [farmSlug]/page.tsx force-dynamic, /api/checkout:534).
- Doku: ARCHITECTURE.md:449 („schreibt nur stripeKontoBereit … Zahlungen UND
  Auszahlungen“); Alarm-Matrix :405-417 (feste Tabelle mit Wache).
  stripe-live.md §2 :56 nennt nur card_payments und transfers; §3 Endpunkt B
  :79 nur account.updated. testumgebung.md:85: kein Connect-Endpunkt für
  test.agrilo.at. Register: höchste Nummer N48 (entscheidungen.md:1001),
  danach „---“ (:1007).

Entschieden (Projektleitung 09.11.2026, F055; Funde nach Entscheidung des
Koordinators 09.11.2026):
E1 Bereit-Regel (E-036): stripeKontoBereit(konto) ist true genau dann, wenn
   charges_enabled === true, payouts_enabled === true und
   capabilities.card_payments, capabilities.transfers und
   capabilities.eps_payments je === 'active'. capabilities null oder ein
   fehlender Schlüssel = nicht bereit. Folge (gewollt): Fehlt nur EPS, ist
   online ganz aus, auch Karte; im Hofpreis-Modell lehnt Stripe ohne EPS
   ohnehin jeden Zahlungsvorgang ab.
E2 Grober Stand, rein in stripe-konto.ts: stripeKontoStand(konto) → die
   erste Stufe, die zutrifft:
   1 bereit         – E1.
   2 gesperrt       – requirements.disabled_reason beginnt mit 'rejected.'
                      oder ist 'platform_paused'.
   3 angaben_fehlen – details_submitted !== true, ODER
                      requirements.currently_due nicht leer, ODER
                      requirements.past_due nicht leer, ODER
                      disabled_reason === 'requirements.past_due'.
   4 eps_fehlt      – charges_enabled und payouts_enabled true,
                      card_payments und transfers 'active', eps_payments
                      weder 'active' noch 'pending' (fehlt oder 'inactive').
   5 pruefung       – requirements.pending_verification nicht leer, ODER
                      disabled_reason ∈ {'requirements.pending_verification',
                      'under_review', 'listed'}, ODER card_payments,
                      transfers oder eps_payments === 'pending'.
   6 unklar         – sonst.
   Bekannte Grenze (DEVELOPMENT.md): Anforderungen mit der Endung „.support“
   kann der Hof im Formular nicht lösen; er sieht trotzdem „Angaben fehlen“,
   Heute hat dafür keine Aufgabe. Vorschlag im Bericht.
E3 Speichern: zwei nullbare Spalten an Farm, ohne Default, in EINER
   Migration: stripeKontoStand TEXT (nur Werte aus STRIPE_KONTO_STAENDE,
   geprüft beim Schreiben) und stripeKontoGelesenAm TIMESTAMP(3). Kein
   Backfill. Gespeichert wird nur der grobe Stand, nie disabled_reason,
   Listen oder Kennungen aus requirements.
E4 Anzeige, rein: stripeAnzeige({ stripeKontoDa, stripeAccountReady,
   stripeKontoStand }) → 'kein_konto' | Stand: ohne Konto 'kein_konto';
   bereit → 'bereit'; sonst der gespeicherte Stand, wenn er gültig und nicht
   'bereit' ist; sonst (NULL, unbekannt, 'bereit' bei nicht bereit)
   'angaben_fehlen' (= heutiges Verhalten). Abfragen geben stripeKontoDa
   (boolean) und die Anzeige weiter, nie die Kennung. Für den Hof:
   hofStufe(anzeige): eps_fehlt und unklar → 'noch_nicht'; sonst gleich.
   Das Wort EPS steht in keinem Hof-Text der Stufen; den genauen Grund sieht
   nur das Team (E8).
E5 Wortlaute für den Hof (wörtlich; [BAR] siehe unten):
   Zahlungsseite, Kasten (Titel / Text) und Marke:
   - pruefung: „Stripe prüft deine Angaben.“ / „Du musst nichts tun, wir
     melden uns. Das dauert meist nur kurz, manchmal ein paar Werktage.
     Sobald die Online-Zahlung aktiv ist, siehst du es hier.“ Ohne
     Startzeile W-A zusätzlich am Ende: „Braucht Stripe noch etwas von dir,
     steht es hier und auf Heute.“ Marke „Stripe prüft“.
   - noch_nicht: „Stripe hat die Online-Zahlung noch nicht ganz
     freigegeben.“ / „Du musst nichts tun, wir kümmern uns darum und melden
     uns.“ Marke „Noch nicht freigegeben“.
   - gesperrt: „Online-Zahlung ist bei Stripe gesperrt.“ / „Online bezahlen
     geht bei dir deshalb gerade nicht. Schreib uns bitte an
     ${SUPPORT_EMAIL}, wir helfen dir weiter.“ Marke „Bei Stripe gesperrt“.
   - angaben_fehlen und kein_konto: unverändert (Kasten „einrichten“ bzw.
     „fortsetzen“ nach ?stripe=, Marke „Einrichtung nicht fertig“).
   - Der Stand geht vor ?stripe=pending; „geschafft“ nur bei bereit.
     ?stripe=neu mit Konto geht jedem Stand vor (wie heute); ?stripe=error
     ebenso.
   Heute (Titel · Satz · Knopf):
   - angaben_fehlen: „Stripe braucht noch Angaben von dir“ · „Erst danach
     können Kunden online bezahlen. [BAR]“ · „Bei Stripe ergänzen“.
   - pruefung: „Stripe prüft deine Angaben“ · „Du musst nichts tun, wir
     melden uns. [BAR]“ · „Zahlung ansehen“.
   - noch_nicht: „Online-Zahlung noch nicht freigegeben“ · „Stripe hat die
     Online-Zahlung noch nicht ganz freigegeben. Du musst nichts tun, wir
     kümmern uns darum und melden uns. [BAR]“ · „Zahlung ansehen“.
   - gesperrt: „Online-Zahlung ist bei Stripe gesperrt“ · „Online bezahlen
     geht bei dir deshalb gerade nicht. Schreib uns bitte an
     ${SUPPORT_EMAIL}, wir helfen dir weiter. [BAR]“ · „Zahlung ansehen“.
   [BAR] = „Bis dahin können Kunden nur bar bei Abholung bestellen.“, wenn
   bar bei diesem Hof jetzt wirklich geht: heuteHofSichtbar(hof) UND
   acceptsOnsite UND ladeBarMoeglich(hof, jetzt) (dieselbe Quelle wie Kasse
   und Zahlungsseite). Sonst und wenn das Laden scheitert: „Bis dahin können
   Kunden bei dir nicht bestellen.“
   Einstellungen-Zeile „Zahlung“: pruefung „Stripe prüft deine Angaben · du
   musst nichts tun“; noch_nicht „Stripe hat noch nicht ganz freigegeben ·
   wir kümmern uns darum“; gesperrt „Online-Zahlung bei Stripe gesperrt ·
   schreib uns“; übrige unverändert.
   Einrichten-Schritt „zahlung“ bei pruefung, noch_nicht, gesperrt: text =
   Kasten-Titel und -Text der Zahlungsseite, textKurz = Marke, Link
   „Zahlung ansehen“ auf /settings/payments, Zustand 'offen'. Bei
   angaben_fehlen und kein_konto unverändert („Mit Stripe einrichten“).
   Knöpfe der Zahlungsseite: Der Formular-Knopf (handleSetup) steht NUR bei
   kein_konto, angaben_fehlen und „neu einrichten“ (Z2). „Status prüfen“
   steht immer, wenn ein Konto da ist und nicht neu eingerichtet wird. Toast
   nach „Status prüfen“ bei nicht bereit: der bisherige Satz nur bei
   angaben_fehlen; sonst kein Toast (der Kasten sagt es).
E6 Nachrichten an den Hof: Postfach-Nachricht (nur Text, Link
   /settings/payments; eine Nachricht hat keine Überschrift) und Mail
   (Überschrift = Betreff, Knopf „Zahlung ansehen“ auf /settings/payments)
   mit demselben Text:
   - aktiv, Betreff „Online-Zahlung ist aktiv“: „Stripe hat dein Konto
     freigegeben. Ab sofort können Kunden bei dir online bezahlen.“ – nur bei
     heuteHofSichtbar (freigeschaltet, nicht pausiert, nicht gesperrt);
     sonst: „Stripe hat dein Konto freigegeben. Sobald dein Hof online ist,
     können Kunden dort auch online bezahlen.“
   - angaben (nur W-A), Betreff „Stripe braucht noch Angaben von dir“:
     „Stripe braucht noch Angaben von dir. Öffne Einstellungen › Zahlung und
     tippe auf ‚Einrichtung fortsetzen‘.“
   Bedingung, für Postfach und Mail dieselbe (W9): Hof da, hofSichtbar,
   acceptsOnline true und bei aktiv stripeAccountReady true bzw. bei angaben
   stripeKontoStand 'angaben_fehlen' – frisch gelesen nach dem Wechsel; der
   Renderer prüft sie vor dem Versand erneut (sonst verworfen). Höchstens
   eine Nachricht je Hof und Anlass im festen 24-Stunden-Fenster (eigene
   Bremse, Merkmal `<anlass>:<farmId>`; scheitert die Bremse, wird
   geschickt).
E7 Schreiben (eine zentrale Funktion, Weg A aus Fund 4): Jeder Schreiber
   merkt sich gelesenAm = new Date() VOR accounts.retrieve und übergibt
   Konto und Zeit. Jedes Schreiben ist ein bedingtes updateMany mit
   id, stripeAccountId = gelesene Kennung und (stripeKontoGelesenAm IS NULL
   ODER < gelesenAm); es setzt stripeAccountReady, stripeKontoStand und
   stripeKontoGelesenAm. Erst der Wechsel-Fall (Bedingung zusätzlich
   stripeAccountReady = !neu, bei W-A zusätzlich der alte Stand), dann der
   Fall ohne Wechsel mit der Bedingung stripeAccountReady = neu (sonst wie
   oben). Ergeben beide count 0, liest die Funktion stripeAccountId und
   stripeKontoGelesenAm des Hofs einmal nach: andere Kennung oder
   gelesenAm ≥ eigenes → fertig (ein Neuerer war da); sonst beide Schritte
   genau einmal wiederholen, danach aufgeben (Bericht im Server-Protokoll
   mit Hof-ID, ohne Kennung). count 0 nach diesem Ablauf = ein anderer
   Schreiber war neuer: nichts tun, keine Nachricht. Nur bei
   count 1 im Wechsel-Fall folgt der Nachlauf (wirft nie, nach dem
   Schreiben, ändert keine Antwort):
   - false → true: protokolliere({ wer: null, art: 'online_zahlung_aktiv',
     bezugArt: 'hof', bezugId, mitPasskey: false, grund: 'bereit' }) und
     Nachricht „aktiv“.
   - true → false: protokolliere(… art: 'online_zahlung_pausiert', grund:
     <grober Stand>), keine Nachricht.
   - (W-A) pruefung, eps_fehlt oder unklar → angaben_fehlen bei weiter nicht
     bereit: Nachricht „angaben“, kein Protokoll (Bereit-Wert unverändert).
   Bloße Wechsel des Stands ohne Wechsel des Bereit-Werts: kein Protokoll.
E8 Admin: stripeGrundAdmin(anzeige): kein_konto „Stripe fehlt“ ·
   angaben_fehlen „Stripe: Angaben fehlen“ · pruefung „Stripe prüft“ ·
   eps_fehlt „Stripe: EPS nicht aktiv“ · unklar „Stripe: nicht
   freigegeben, Grund unklar“ · gesperrt „Stripe: gesperrt“ · bereit
   „Stripe eingerichtet“. Steht in der Akte (Marke und Zeile
   „Online-Zahlung“), im Signal der Hofliste, in freischaltKurz und im Satz
   von „Hof wartet auf Freischaltung“. Fund 19: FREISCHALTUNG_STRIPE_OFFEN_TEXT
   = „Stripe ist noch nicht fertig – Freischalten erst danach möglich.“,
   STRIPE_FEHLT_TEXT (Marke und Filter) = „Stripe nicht fertig“; Kennung
   'stripe-fehlt' bleibt.
   Neue Aufgaben-Quelle 'hof_online_haengt' (W1): je Hof aus hoefeAktiv mit
   Konto, acceptsOnline und Anzeige eps_fehlt, unklar oder gesperrt eine
   Aufgabe. Bereich „Höfe“, Titel „Online-Zahlung eines Hofs hängt bei
   Stripe“ (fest, ohne Daten), Bezug { kennung: Hof-ID, text: Hofname },
   Satz je Stand:
   - eps_fehlt: „Bei Stripe ist EPS nicht aktiv. Im Stripe-Dashboard beim
     Konto des Hofs nachsehen und EPS anfordern.“
   - unklar: „Stripe gibt die Online-Zahlung nicht frei, nennt aber keine
     offene Angabe. Im Stripe-Dashboard nachsehen.“
   - gesperrt: „Stripe hat das Konto abgelehnt oder gesperrt. Im
     Stripe-Dashboard nachsehen und den Hof anschreiben.“
   seit wie hofOhneAbholzeit (das Spätere aus approvedAt und Wochenbeginn),
   Ziel 24 Stunden, wasTun 'hofAnsehen', Ziel adminHofHref. Die Aufgabe
   verschwindet von selbst, sobald der Stand nicht mehr passt. Wartende Höfe
   stehen unter „Hof wartet auf Freischaltung“ mit dem Grund. Keine
   zusätzliche Sentry-Warnung. Alarm-Matrix (Konstante und Tabelle) bleibt.
E9 Webhook (Fund 10, feste Lösung): Der Connect-Zweig verarbeitet zusätzlich
   capability.updated. Hof über event.account suchen (Stripe-Doku „Connect
   webhooks“: jedes Ereignis eines verbundenen Kontos trägt `account`; das
   Capability-Objekt trägt `account`), Konto nachlesen, E7; idempotent wie
   account.updated. Ohne event.account wird capability.updated nicht
   verarbeitet (200 ohne Wirkung).
E10 Register: neuer Eintrag mit der ersten freien N-Nummer auf main beim
   Start (am 10.11.: N49), nach N48 vor „---“, wörtlich (F = die Nummer;
   den Satz in eckigen Klammern nur bei W-A):
   „### N<F> · Stripe-Kontostatus: bereit erst mit EPS (<Datum>)
   - **Entscheidung (uttoranger, im Chat, 9.11.2026; F055, E-036, E-047):**
     „Ein Hof gilt erst als ‚bereit‘ für Online-Zahlung, wenn bei seinem
     Stripe-Konto auch EPS aktiv ist.“ „Die Zahlungsseite des Hofs bekommt
     einen eigenen Zustand ‚Stripe prüft deine Angaben. Du musst nichts tun,
     wir melden uns.‘ statt ‚Bitte setz sie fort‘, wenn der Hof bei Stripe
     alles abgeschickt hat und Stripe nur noch prüft. Dazu bekommt der Hof
     eine Nachricht, sobald die Online-Zahlung aktiv ist.“
   - **Regel:** Bereit heißt: Zahlungen und Auszahlungen frei, Karte,
     Überweisung und EPS bei Stripe aktiv (`stripeKontoBereit`). Gespeichert
     wird dazu nur ein grober Stand des Stripe-Kontos und wann er gelesen
     wurde. Der Hof sieht „Stripe prüft“, „Angaben fehlen“ (nur dann ein Weg
     zurück ins Stripe-Formular), „Noch nicht freigegeben“ oder „bei Stripe
     gesperrt“; das Team sieht den genauen Grund in der Akte und bekommt
     für einen verkaufenden Hof, dessen Online-Zahlung bei Stripe hängt,
     eine Aufgabe in Heute. Wird ein Hof bereit, bekommt er eine Nachricht
     im Postfach und per E-Mail[; ebenso, wenn Stripe nach der Prüfung doch
     noch Angaben braucht], höchstens eine je Anlass und Tag.
   - **Verhältnis zu anderen Einträgen:** ergänzt Z1 (die Notbremse
     „pausiert“ nennt jetzt den Grund) und setzt N33 für den Wechsel des
     Bereit-Werts um (System-Einträge „Online-Zahlung aktiv/pausiert“).
   - **Umsetzung:** Auftrag A012 (/sprint); eine Migration (zwei nullbare
     Spalten an Farm).“

Umsetzung (Branch feature/stripe-kontostatus, ein PR, Präfix feat:):
1. Schema und Migration (dann T4): Farm bekommt `stripeKontoStand String?`
   und `stripeKontoGelesenAm DateTime?` unter „// Stripe Connect“. Migration
   prisma/migrations/20261110120000_stripe_konto_stand/migration.sql nach
   Regel 3 (prisma migrate diff gegen das Schema von origin/main), Kopf wie
   20261031100000_agb_zustimmung, mit SET lock_timeout = '5s' und
   ADD COLUMN IF NOT EXISTS. Kein UPDATE, kein Default, kein Index.
   Migrationsfolge auf einer Wegwerf-DB im lokalen Postgres prüfen
   (CLAUDE.md §1). Vor dem Halt nur Schema, Migration und Test d)
   (Datei-Wache) schreiben und committen; der Arbeitsbaum ist beim Halt
   sauber. Die übrigen Tests (zuerst rot) erst nach der Freigabe. Commit,
   nicht pushen, zeigen, warten.
2. src/lib/stripe-konto.ts (rein): E1 (stripeKontoBereit mit erweitertem
   Eingabetyp, Kopfkommentar nachziehen), STRIPE_KONTO_STAENDE,
   stripeKontoStand (E2), stripeAnzeige und hofStufe (E4), die Texte aus E5,
   E6 und E8 als Konstanten bzw. Funktionen (eine Quelle; onlinePausiertHinweis
   wird zu einer Funktion je Stufe mit barMoeglich), stripeGrundAdmin,
   ANGABEN_NACHRICHT (true nur bei W-A). Prüfe in node_modules/stripe, ob
   Stripe.Account['capabilities'] eps_payments, card_payments, transfers
   kennt und welche API-Version Stripe.API_VERSION trägt (in den Bericht).
3. Neu src/server/stripe-konto-stand.ts: schreibeStripeKontoStand({ farmId,
   stripeAccountId, konto, gelesenAm }) nach E7, gibt { bereit, stand }
   zurück; dazu der Nachlauf meldeStripeKontoWechsel(farmId, anlass,
   gelesenAm) nach E6: Bedingung frisch prüfen, dann Bremse
   (DB_BREMSEN.stripeKontoNachricht = { zweck: 'stripe-konto-nachricht',
   max: 1, fensterMs: TAG_MS }), dann Postfach-Nachricht, dann Mail-Auftrag
   (stelleEinOhneRisiko). Neu src/server/postfach-system.ts:
   schreibeSystemNachricht(farmId, text, linkUrl) nach dem Muster
   plattformgebuehr-abrechnung.ts:116-126 (Art SYSTEM, eigener Faden, wirft
   nie); plattformgebuehr-abrechnung.ts selbst bleibt ohne Diff.
4. Schreiber umstellen, sonst nichts an ihnen ändern:
   a) return/route.ts: gelesenAm vor retrieve, statt farm.update die
      zentrale Funktion; Weiterleitung wie bisher (success/pending nach
      bereit).
   b) checkConnectStatus: ebenso; gibt { ready, stufe } zurück.
   c) webhook handleKontoAktualisiert(kontoId: string) (Name bleibt –
      Lauf 34 Nr. 304 sucht den Anker „async function
      handleKontoAktualisiert“): Hof suchen, gelesenAm, nachlesen (wie
      bisher mit timeout und maxNetworkRetries), zentrale Funktion.
      account.updated übergibt data.object.id, capability.updated
      event.account (E9). Zeile :95 und Verzweigung :119-122 um
      capability.updated nur für event.account erweitern; Kommentare
      nachziehen. Zeile :95 wird zu `event.account ? (event.type ===
      'account.updated' || event.type === 'capability.updated') :
      istVerarbeiteterStripeTyp(event.type) && event.type !==
      'capability.updated'` (ohne account wie ein fremder Typ: 200
      { received: true }, vermerkt, keine Prüfung, kein Sentry).
   d) src/schemas/stripe-ereignis.ts: 'capability.updated' mit
      faehigkeitSchema = z.object({ id: kennungSchema, account:
      verweisSchema }); Kommentar der Liste nachziehen.
   e) stripe-connect.ts:121 (Neu-Einrichten) setzt zusätzlich
      stripeKontoStand: null, stripeKontoGelesenAm: null; bleibt bedingt
      wie bisher.
      hofkonto-unbekannt.ts: (1) wie bisher bedingt auf
      stripeAccountReady: true → false, bei count 1 protokolliere(…
      'online_zahlung_pausiert', grund: 'konto_unbekannt'); (2) danach
      unabhängig davon updateMany({ where: { id: farmId, stripeAccountId },
      data: { stripeKontoStand: null } }) – damit gilt die Anzeige
      ‚angaben_fehlen‘ und der Weg ‚Bei Stripe ergänzen‘ → ‚Einrichtung
      fortsetzen‘ → ‚neu einrichten‘ greift. Beide werfen nie.
5. Hof-Anzeigen (E4, E5): Abfragen liefern stripeAnzeige
   (settings/payments/page.tsx Select :32-44; queries/heute.ts :200-201;
   queries/einstellungen.ts :41-42; queries/einrichten.ts :54 – dort
   stripeAccountId nur als boolean lesen). zahlungHinweis bekommt die
   Anzeige und die Arten 'pruefung', 'noch-nicht', 'gesperrt'; Kasten,
   Marke (StripeStatus) und Knöpfe (PaymentsActions bekommt formularOffen)
   nach E5. onlinePausiertDaten bekommt barMoeglich von außen (W5) und gibt
   { barMoeglich, stufe } zurück; queries/heute.ts lädt ladeBarMoeglich nur,
   wenn der Kasten steht (HOF_FUER_GEBUEHR_LAGE in den Select), Fehler →
   false. StripeHinweis(barMoeglich, stufe) mit Titel, Satz, Knopf nach E5.
   Einstellungen-Zeile und Einrichten-Schritt nach E5. Der Satz
   „Kasten nur mit acceptsOnline“ bleibt: Ohne acceptsOnline bleibt die
   Karte „einrichten“; das wird hier nicht umgebaut.
6. Admin (E8): admin-aktion.ts zwei Arten 'online_zahlung_aktiv',
   'online_zahlung_pausiert' im System-Block (Nr. 198); Texte in
   PROTOKOLL_ART_TEXT (admin-hof-akte.ts) „Online-Zahlung aktiv (Stripe)“ /
   „Online-Zahlung pausiert (Stripe)“ und in PROTOKOLL_TEXT
   (admin-aufgaben.ts) dieselben. Quelle 'hof_online_haengt' ans Ende von
   AUFGABE_QUELLEN, mit AUFGABE_ZIEL_MS (24 * STUNDE_MS), BEREICH 'Höfe',
   ADMIN_AUFGABEN. AufgabeHof bekommt stripeAnzeige und onlineAn;
   ladeHoefeAktiv liest dafür stripeAccountId (nur als boolean weiter),
   stripeAccountReady, stripeKontoStand, acceptsOnline im BESTEHENDEN
   Select – keine neue Abfrage in ladeAufgabenStand. HofAufgabeRoh,
   SignalHof und die Akte bekommen stripeAnzeige über getAdminFarms bzw.
   ladeHofAufgaben; die Texte nach E8; freischaltSperre bleibt an
   stripeBereit gebunden.
7. Mails (E6): a) Neue Art 'online-zahlung' (Vorrang wichtig, Bezug
   { farmId, anlass: 'aktiv' | 'angaben' }, Schlüssel
   `online-zahlung:<farmId>:<anlass>:<gelesenAm.getTime()>`, Name „Online-
   Zahlung (Stripe)“) nach dem Muster 'plattformgebuehr-ankuendigung' in
   jeder Datei, in der diese Art steht, AUSSER NOCHMAL_ERLAUBT und
   passtNochmal (betrieb-mails.ts:1060, :1358): stattdessen in NOCHMAL_NIE
   (Fund 14; die Nachricht steht im Postfach). Adresse: hofInhaber
   (adresseQuelle). Vorlage neu src/emails/online-zahlung.tsx nach
   src/emails/freischaltung.tsx, Fuß 'plattform' (FUSS_JE_VORLAGE),
   Builder in email.ts, Renderer in mail-arten/hof.ts (lädt email.ts nur
   per await import, schwere-module-Wache). Beispiel in MAIL_BEISPIELE
   (anlass aktiv), zwei Fälle in FAELLE (aktiv, angaben).
   b) Nur bei W-A: der Wechsel nach angaben_fehlen aus E7 schreibt
   Nachricht und Mail mit anlass 'angaben'. Ohne W-A: ANGABEN_NACHRICHT
   false, der Zweig schreibt nur den Stand.
   tests/fixtures/mail-rechtsbloecke-280.json: nur die neuen Schlüssel
   (MAIL_RECHT_SCHNAPPSCHUSS=1 pnpm vitest run tests/mail-vorschau.test.ts
   -t Rechtsblöcke, dann jede Änderung an bestehenden Schlüsseln
   zurücknehmen; git diff zeigt nur hinzugefügte Zeilen). Ändert sich ein
   bestehender Schlüssel: anhalten, melden.
8. Doku: ARCHITECTURE.md:449 neu fassen (Regel E1, Stand und gelesenAm,
   zentrale Funktion, bedingtes Schreiben, capability.updated, Protokoll
   je Wechsel, Aufgabe 'hof_online_haengt' in Heute statt Sentry). Alarm-
   Matrix unverändert. stripe-live.md: §2 :56 „card_payments, transfers und
   eps_payments; die App fordert genau diese an“; §3 Endpunkt B :79
   „account.updated und capability.updated“ mit Satz, wozu. :63 und
   Endpunkt A ohne Diff (Lauf 34 Nr. 289 ändert dort). DEVELOPMENT.md:
   Fachregel (E1–E7), Grenze „.support“, Bestand ohne Backfill (alter Wert
   gilt bis zum nächsten Schreiber). Register nach E10. pnpm bausteine.
9. Prüfen statt bauen (Fund 12): im Bericht bestätigen, dass Hofseite,
   Kasse und /api/checkout stripeAccountReady weiter frisch lesen.

Tests (zuerst schreiben, rot sehen, dann bauen; Stripe immer gemockt; vor
der Migrations-Freigabe nur d), siehe Umsetzung 1):
a) tests/stripe-konto.test.ts: E1 – alle fünf Bedingungen → true; je eine
   fehlt, 'inactive' oder 'pending' → false; capabilities null → false; der
   alte Fall nur charges+payouts → false (Testname anpassen). E2 je Stufe
   mindestens ein Fall, dazu: EPS 'pending' bei sonst fertigem Konto →
   pruefung; EPS fehlt bzw. 'inactive' → eps_fehlt; disabled_reason
   'requirements.past_due' bei leeren Listen → angaben_fehlen;
   'platform_paused' und 'rejected.fraud' → gesperrt; nichts davon →
   unklar. E4 – kein Konto, NULL+bereit, NULL+nicht bereit, 'bereit'
   gespeichert bei nicht bereit, unbekannter Text. E5/E6/E8 wörtlich; kein
   „EPS“ in Hof-Texten der Stufen; gesperrt nennt SUPPORT_EMAIL.
b) tests/integration/stripe-konto.int.test.ts (echtes Postgres): bestehende
   Fälle mit vollständigem Kontoobjekt; nicht bereit → bereit: Spalten,
   genau ein Protokoll online_zahlung_aktiv, eine Postfach-Nachricht (Link
   /settings/payments), ein MailAuftrag 'online-zahlung'; dasselbe noch
   einmal (neue Ereignis-Kennung) → nichts dazu. bereit → nicht bereit (EPS
   inactive): Stand eps_fehlt, ein Protokoll online_zahlung_pausiert mit
   Grund 'eps_fehlt', keine Nachricht. Fund 4 (11 c): zwei Schreiber mit
   verschiedenen Ständen und gelesenAm t1 < t2, in beiden Reihenfolgen des
   Schreibens → am Ende der Stand von t2, höchstens ein MailAuftrag. Ein
   älterer Schreiber schreibt zwischen Wechsel-Fall und Fall ohne Wechsel
   des neueren (Haken in der Attrappe bzw. zwei Verbindungen) → am Ende der
   neuere Stand, die Protokolleinträge wechseln sich ab (aktiv, pausiert),
   kein Wechsel ohne Eintrag. Stand pruefung, Konto unbekannt → Stand NULL,
   Anzeige angaben_fehlen, kein Protokoll (Bereit-Wert unverändert). Bremse:
   aktiv → pausiert → aktiv binnen 24 h → eine Nachricht, ein Auftrag, drei
   Protokolleinträge. acceptsOnline false → Protokoll ja, keine Nachricht.
   capability.updated mit event.account → derselbe Weg (retrieve mit der
   Kennung aus event.account); ohne event.account → nichts geändert, 200.
   W-A: pruefung → angaben_fehlen → eine Nachricht 'angaben' (bzw. keine
   bei ANGABEN_NACHRICHT false); NULL → angaben_fehlen → keine.
   hof_online_haengt über ladeAufgabenStand: verkaufender Hof mit
   eps_fehlt → Aufgabe; pausiert, stillgelegt, Testhof → keine. Beide
   Spalten nullbar ohne Default (information_schema).
c) tests/webhook.test.ts, tests/webhook-ereignis-schema.test.ts,
   tests/stripe-ereignis.test.ts mit tests/stripe-ereignis-beispiele.ts:
   Liste der Typen mit capability.updated; Connect-Ereignisse laufen nur
   durch account.updated und capability.updated; ungültiges
   capability.updated → 200 ohne Verarbeitung; Antworten wie vorher.
   Ebenso nachziehen: tests/hofkonto-unbekannt-einrichten.test.ts,
   tests/stripe-konto-land.test.ts (Kontoobjekte mit capabilities).
   tests/webhook-ereignis-schema.test.ts: it.each stellt capability.updated
   mit { account: 'acct_1' } zu (eine Tabelle Zusatzfelder je Typ);
   BEHANDLUNG['capability.updated'] = farm.findFirst; neuer Fall
   ‚capability.updated ohne account → 200, kein findFirst, kein Sentry‘.
   tests/stripe-ereignis.test.ts: Länge 12, Testname ‚Lauf 26 plus
   account.updated und capability.updated‘.
d) Neu tests/migration-stripe-konto-stand.test.ts nach
   tests/migration-teilen-momente.test.ts: nur zwei ADD COLUMN IF NOT EXISTS
   (TEXT, TIMESTAMP(3)), nullbar, ohne DEFAULT, lock_timeout, nichts
   Verbotenes; schema.prisma sagt dasselbe; Gegenprobe.
e) tests/admin-aufgaben.test.ts: 'hof_online_haengt' je Stand eps_fehlt,
   unklar, gesperrt genau eine Aufgabe (Titel, Satz, Bereich, Ziel 24 h,
   adminHofHref); bereit, kein_konto, pruefung, angaben_fehlen, onlineAn
   false → keine; VOLL und ERLEDIGT ergänzt; kein „@“, keine acct_-Kennung
   in Titel, Bezug, Satz. hof_wartet nennt den Grund.
   tests/admin-heute.test.ts: Attrappe von farm.findMany um die neuen
   Felder ergänzen (nur Vorbereitung).
f) Hofseiten: tests/hof-einstellungen.test.ts (zahlungHinweis neue Arten,
   Vorrang des Stands vor ?stripe=pending, Zeile je Stufe); PaymentsActions
   per renderToStaticMarkup (neu tests/zahlung-knoepfe.test.ts):
   Formular-Knopf nur bei kein_konto, angaben_fehlen, neu einrichten –
   Gegenprobe pruefung, noch_nicht, gesperrt ohne ihn, „Status prüfen“ da;
   tests/heute-seite.test.ts (Hinweis je Stufe; „Bei Stripe ergänzen“ nur
   bei angaben_fehlen; [BAR]: Hof ohne Mandat nach dem Einzugsbeginn und
   Hof mit gesperrter Barzahlung → zweite Fassung); tests/einrichten.test.ts
   (Schritt je Stufe; angaben_fehlen unverändert).
   tests/stripe-pflicht.test.ts bleibt grün.
g) Admin: tests/admin-hoefe.test.ts, tests/admin-hoefe-liste.test.ts,
   tests/hof-akte.test.ts, tests/farm-approval.test.ts,
   tests/postfach-eingang.test.ts – neue Texte (Fund 19), Grund je Stand,
   Kennung 'stripe-fehlt' unverändert. tests/admin-protokoll-seite.test.ts
   deckt die neuen Arten.
h) Mails: tests/mail-vorschau.test.ts (zwei Fälle, Fuß), Fixture (nur
   neue Schlüssel), tests/mail-wege-wache.test.ts; Renderer verwirft bei
   Hof fehlt, stillgelegt, nicht bereit (aktiv), Stand nicht
   angaben_fehlen (angaben), acceptsOnline false; Art in NOCHMAL_NIE.
i) Wachen grün: geld-number, geld-fliesskomma, decrement, wortliste,
   schwere-module, admin-schrift-wache, migrationen-wache, bausteine.
Voller Lauf vor dem Push; pnpm test:integration.

Nicht:
- Keine Änderung an Kasse, /api/checkout, Storno, Erstattung, Beträgen,
  Gebühren, Monatsabrechnung; am Auszahlungs-Link (stripe-connect.ts:255)
  nichts – Vorschlag in den Bericht: Knopf auch bei pruefung, eps_fehlt,
  unklar zeigen (nur Ansicht, Fund 18).
- Kein Backfill, kein UPDATE in der Migration, kein zweites Schema-Feld
  außer den zwei aus E3; keine Anzeige von stripeKontoGelesenAm.
- Keine Kennung, kein disabled_reason, keine requirements-Liste in
  Datenbank, Protokoll, Sentry, Mail oder Text.
- Keine zusätzliche Sentry-Warnung; Alarm-Matrix unverändert.
- docs/betrieb/handbuch.md und docs/betrieb/testumgebung.md ohne Diff (Lauf
  34 Nr. 302 bzw. 289 ändern dort); stripe-live.md nur §2 und Endpunkt B.
- plattformgebuehr-abrechnung.ts ohne Diff; die fünf Kopien des
  Postfach-Musters nicht umstellen (Vorschlag in den Bericht).
- Keine weiteren Webhook-Ereignisse; Plattform-Endpunkt A unverändert.
- Keine Zählung, Liste oder Adresse von Webhook-Endpunkten aus Stripe in
  Bericht, PR oder Datei (eine Adresse trägt ein Geheimnis).
- Kein Live-Schlüssel, kein schreibender Stripe-Aufruf außer im Mock.
  ONLINE_ZAHLUNG_EINRICHTEN_SATZ und das Label „Mit Stripe einrichten“
  bleiben wörtlich.
- Nicht mergen.

Dateigrenze: die in Umsetzung 1–9 und Tests a)–i) genannten Dateien, neu
nur docs/nachtlauf/berichte/a012-stripe-kontostatus.md (diese
Auftragsdatei), prisma/migrations/20261110120000_stripe_konto_stand/,
src/server/stripe-konto-stand.ts, src/server/postfach-system.ts,
src/emails/online-zahlung.tsx, tests/migration-stripe-konto-stand.test.ts,
tests/zahlung-knoepfe.test.ts. TASK.md bleibt lokal (.gitignore). Jede
weitere Datei: im Bericht mit Grund nennen.

Fertig, wenn:
- Die Migration ist mit „Migration freigegeben“ freigegeben und erst danach
  gepusht.
- Der PR mit feat: ist offen; TASK.md-Plan liegt lokal (TASK.md ist in
  .gitignore) und steht im Chat; kein Halt dafür; CI grün
  (einschließlich Job integration); Ergebnis des Gegenlesens „Geld“ steht
  wörtlich im PR-Text.
- Alle Tests oben grün; je Zustand (kein Konto, angaben_fehlen, pruefung,
  noch_nicht, gesperrt, bereit) ein Bild der Zahlungsseite und von Heute
  aus der lokalen Prüf-Datenbank (agent-browser, Stand per Seed gesetzt).
  Geht agent-browser nicht: Bilder entfallen, im Bericht und PR als „nicht
  geprüft (kein Prüf-Browser)“ nennen; Code und Tests wie geplant.
- Im PR steht eine Schritt-für-Schritt-Anleitung, mit der die
  Projektleitung denselben Ablauf in der Vorschau mit einem neuen Testhof
  im Stripe-Testmodus durchgeht (nur Testdaten); mit dem Hinweis, dass die
  Mail dort in Admin › Betrieb › E-Mails mit Stand „gesperrt“ (Post-Sperre)
  steht und die Zeile zählt, nicht die Zustellung. Diesen Durchgang
  behauptest du nicht als erledigt.
- Der PR-Text nennt: welche Fassung von W-A gilt; die Abweichungen von
  Mockups und Boards (Heute-Titel „Stripe braucht noch Angaben von dir“
  statt „Online-Zahlung ist pausiert“, Freischalt-Satz und Filterwort aus
  Fund 19; entschieden vom Koordinator am 09.11.2026); die neuen
  Rechtsblock-Schlüssel; Typen und API-Version aus Schritt 2; die
  N-Nummer.
- DEVELOPMENT.md, ARCHITECTURE.md, stripe-live.md, Register und
  BAUSTEINE.md sind nachgezogen. docs/nachtlauf/status.md ohne Diff.
```
