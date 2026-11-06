/**
 * AGB Fassung 1.0 als Daten (Register N45, A005) — gilt ab dem Stichtag
 * „Hofpreis-Modell ab“ und für jede Bestellung im Hofpreis-Modell. Die
 * frühere Fassung 0.9 steht eingefroren in agb-0-9.ts; welche gilt,
 * entscheidet nur agb-fassung.ts.
 *
 * Quelle ist docs/recht/agb.md (Fassung 1.0, Wortlaut aus A005, veröffentlicht
 * vor der anwaltlichen Prüfung, Variante A; die Prüfung folgt als 1.1). Der
 * Wortlaut ist von dort wörtlich übernommen, Absatz für Absatz. Änderungen am
 * Wortlaut macht nur die Projektleitung, nie ein Lauf — zuerst in der
 * Markdown-Datei; tests/agb-text.test.ts und tests/agb-wortgleich.test.ts
 * vergleichen bei jedem Lauf.
 *
 * Was von der Quelle abweicht, ist technisch und ändert kein Wort:
 *  - Name und Domain stehen als MARKE und PRODUKTION_HOST (Register M1).
 *  - Die Platzhalter „[Betreiber laut Impressum …]", „[E-Mail laut
 *    Impressum]" und „[Tag des Inkrafttretens]" sind Stücke (BETREIBER,
 *    E_MAIL, INKRAFTTRETEN); gefüllt werden sie aus dem Impressum bzw. dem
 *    Stichtag (src/lib/rechtstexte/stuecke.ts).
 *  - Links sind Daten (`link`), kein Markdown.
 *  - Anhang 1 und 2 sind nicht abgetippt: Die Blöcke 'belehrung' und
 *    'formular' zeichnen das gesetzliche Muster aus BELEHRUNG in
 *    src/lib/widerruf.ts (mit dessen Platzhaltern statt Hofangaben).
 *  - „Kurz erklärt" ist kein Teil der AGB und steht als Einleitung darüber.
 *
 * Als wörtlicher Rechtstext steht die Datei in den Ausnahmen der Wachen, die
 * jeden Text unter src/ lesen. Die Wörter der Seite drumherum stehen als
 * AGB_SEITE_TEXT in agb-einbindung.ts, wo die Wachen sie lesen.
 */
import { MARKE } from '@/lib/marke'
import { PRODUKTION_HOST } from '@/lib/umgebung'
import { BETREIBER, E_MAIL, INKRAFTTRETEN, fett, inkrafttretenText, link, type AgbKontext } from '@/lib/rechtstexte/stuecke'
import {
  absatz,
  aufzaehlung,
  hinweis,
  tabelle,
  type AgbAnhang,
  type AgbFassungDaten,
  type AgbKurzErklaert,
  type AgbTeil,
} from '@/lib/rechtstexte/agb-bloecke'

const AGB_1_0_TITEL = `Allgemeine Geschäftsbedingungen (AGB) von ${MARKE}`

/**
 * Der Stand-Vermerk: „Fassung 1.0 – gilt ab <Tag>“ (formatDatumLang). Ohne geladenen
 * Stichtag (nur in der Mail-Datei) „… gilt ab dem Stichtag auf <Domain>/konditionen“.
 */
function vermerk(kontext: AgbKontext): string {
  return kontext.inkrafttreten ? `Fassung 1.0 – gilt ab ${inkrafttretenText(kontext)}` : `Fassung 1.0 – gilt ab dem ${inkrafttretenText(kontext)}`
}

const AGB_1_0_KURZ_ERKLAERT: AgbKurzErklaert = {
  titel: 'Kurz erklärt',
  zusatz: 'kein Teil der AGB',
  punkte: [
    [`${MARKE} ist ein Marktplatz: Du kaufst `, fett('direkt beim Hof'), `. ${MARKE} verkauft nichts, liefert nichts und nimmt kein Geld für Waren entgegen.`],
    ['Du bestellst online, zahlst online oder bar und holst ', fett('am Hof'), ' ab.'],
    ['Der Preis, den du siehst, ist der Preis, den du zahlst – online und bar gleich. Darin steckt die ', fett('Plattformgebühr'), `, mit der der Hof die Nutzung von ${MARKE} bezahlt. An ${MARKE} zahlst du nichts.`],
    ['Ob du eine Ware ', fett('zurückgeben'), ' kannst, hängt von der Ware ab: Schnell verderbliche Lebensmittel sind vom Gesetz ausgenommen, haltbare Waren nicht. Bis zum Beginn deines Abholtermins kannst du jede Bestellung stornieren; bei Online-Zahlung bekommst du dann alles zurück.'],
    ['Höfe sind ', fett('Unternehmen'), `. Für Ware, Angaben, Hygiene und Beleg ist der Hof verantwortlich; ${MARKE} für die Plattform.`],
    ['Höfe zahlen eine Plattformgebühr von ', fett('6 %'), `, die im Preis enthalten ist, und nutzen ${MARKE} im Tarif `, fett('Hoftor (0 €)'), ' oder ', fett('Hofladen (19 € im Monat, monatlich kündbar)'), '.'],
  ],
}

const AGB_1_0_TEILE: readonly AgbTeil[] = [
  {
    id: 'a',
    titel: 'Teil A – Für alle',
    punkte: [
      {
        nummer: 1,
        titel: 'Wer wir sind, wofür diese AGB gelten',
        bloecke: [
          absatz('1.1', `${MARKE} wird betrieben von `, fett(BETREIBER), ` („${MARKE}“, „wir“). Alle Angaben nach § 5 ECG stehen im `, link('Impressum', '/impressum'), '.'),
          absatz('1.2', `Diese AGB gelten für jede Nutzung von ${PRODUKTION_HOST} und der dazugehörigen Dienste durch `, fett('Kundinnen und Kunden'), ' (Teil B) und durch ', fett('Höfe'), ' (Teil C). Teil A und Teil D gelten für alle. Die Anhänge sind Teil der AGB.'),
          absatz('1.3', 'Die ', link('Konditionen für Höfe', '/konditionen'), ' (Plattformgebühr, Tarife, Abrechnung, Stichtage) sind Teil dieser AGB. Was wir mit einem Hof einzeln vereinbart haben und was in seinen Einstellungen unter „Deine Konditionen“ steht, geht diesen AGB vor. Im Übrigen gilt: zwingendes Gesetz vor diesen AGB, diese AGB vor den allgemeinen Konditionen, die Konditionen vor Hinweisen in der App.'),
          absatz('1.4', 'Die Punkte 8 bis 16 sind zugleich die ', fett('Kaufbedingungen'), ` für jeden Kaufvertrag, der über ${MARKE} zwischen einem Hof und einer Kundin oder einem Kunden zustande kommt. Jeder Hof bezieht sie mit der Nutzung von ${MARKE} in seine Verträge ein (Punkt 18.8). `, fett(`Eigene Geschäftsbedingungen eines Hofs gelten für Käufe über ${MARKE} nicht.`), ' Hinweise des Hofs zur Ware (etwa Pfand, Gebinde, Mindesthaltbarkeit, Abholung) stehen beim Angebot (Punkt 10.3). Für die Nutzung der Plattform selbst gelten ausschließlich diese AGB.'),
          absatz('1.5', 'Wir sprechen alle mit „du“ an. Das ist unser Stil, kein Zeichen von Unverbindlichkeit.'),
          absatz('1.6', fett('Begriffe.'), ' „Werktag“ ist Montag bis Freitag ohne gesetzliche Feiertage in Österreich. „Textform“ ist eine lesbare Erklärung ohne Unterschrift, etwa per E-Mail oder im Postfach der App. „Abholzeiten“ sind die Zeitfenster, die ein Hof anbietet; der „Abholtermin“ ist das Zeitfenster, das du für deine Bestellung gewählt hast.'),
        ],
      },
      {
        nummer: 2,
        titel: `Was ${MARKE} ist – und was nicht`,
        bloecke: [
          absatz('2.1', `${MARKE} ist eine `, fett('Vermittlungsplattform'), ' (Online-Marktplatz). Wir stellen Höfen Software bereit: Hofseite, Produktliste, Bestellung, Kasse, die Anbindung an unseren Zahlungsdienstleister und ein Postfach. Kundinnen und Kunden finden darüber Höfe in ihrer Nähe, bestellen und holen am Hof ab.'),
          absatz('2.2', fett('Der Kaufvertrag kommt ausschließlich zwischen dem Hof und der Kundin bzw. dem Kunden zustande.'), ` ${MARKE} ist nicht Vertragspartei des Kaufvertrags, weder Verkäuferin noch Käuferin, und weder Kommissionärin noch Handelsvertreterin des Hofs. Bestellungen nehmen wir für den Hof entgegen; Bestätigungen, Stornos und Erstattungen erklären wir als Bevollmächtigte `, fett('im Namen und auf Rechnung des Hofs'), ' (Punkt 18.8). Das sagen wir dir in der Kasse vor dem Bestellen noch einmal ausdrücklich (§ 4a Abs. 2 FAGG).'),
          absatz('2.3', `${MARKE} ist `, fett('kein Zahlungsdienstleister'), `. Online-Zahlungen wickelt der Zahlungsdienstleister Stripe ab; Empfänger der Zahlung ist der Hof (Punkt 11). Bargeld nimmt nur der Hof entgegen, nie ${MARKE}.`),
          absatz('2.4', `${MARKE} ist `, fett('kein Lebensmittelunternehmen'), ' und weder Herstellerin noch Händlerin der angebotenen Waren. Wir lagern nichts, verpacken nichts und liefern nichts.'),
          absatz('2.5', `Alle Höfe auf ${MARKE} handeln nach ihrer eigenen Erklärung gegenüber uns als `, fett('Unternehmer'), ' (land- und forstwirtschaftliche Betriebe oder Gewerbebetriebe). Deshalb gelten für Käufe das Konsumentenschutzgesetz und das Fern- und Auswärtsgeschäfte-Gesetz (§ 4a Abs. 1 Z 2 FAGG). Wir dürfen diese Erklärung prüfen und Nachweise verlangen; eine amtliche Prüfung nehmen wir nicht vor.'),
          absatz('2.6', fett('So sind die Pflichten verteilt'), ' (§ 4a Abs. 1 Z 4 FAGG):'),
          tabelle(['Der Hof', MARKE], [
            ['Angebot, Preis, Beschreibung, Pflichtangaben zu Lebensmitteln, Futtermitteln und Brennmaterial', 'Betrieb der Plattform (Hofseiten, Bestellung, Kasse, Postfach)'],
            ['Ware, Menge, Qualität, Hygiene, Kühlkette, Jugendschutz bei der Übergabe', 'Anbindung an den Zahlungsdienstleister Stripe'],
            ['Abholzeiten, Übergabe, Bestätigung bei Barzahlung', 'Weiterleitung von Rücktritten, Stornos und Reklamationen an den Hof'],
            ['Gewährleistung, Rücktritt, Reklamation, Rückzahlung', 'Hilfe bei Fragen zur Nutzung der Plattform'],
            ['Rechnung oder Beleg, Steuern, Registrierkasse', 'Abrechnung der Plattformgebühr mit dem Hof'],
          ]),
          absatz('2.7', 'Wir haben keinen Einfluss auf Verfügbarkeit, Beschaffenheit, Herkunft und Rechtmäßigkeit der Angebote und prüfen sie nicht vorab. Angaben zu Produkten, Siegeln, Herkunft, Betriebsnummern und Zertifikaten sind Angaben des Hofs. Wir übernehmen dafür keine Gewähr und keine Zusicherung. Wir entfernen Angebote, wenn wir von Rechtsverstößen erfahren (Punkt 5).'),
        ],
      },
      {
        nummer: 3,
        titel: 'Reihenfolge der Höfe und Angebote',
        bloecke: [
          absatz('3.1', 'Auf der Hofübersicht reihen wir Höfe nach ', fett('Entfernung'), ' zum gewählten Ort oder Standort. Ohne Ort stehen Höfe, die länger freigeschaltet sind, weiter vorne. Innerhalb eines Hofs stehen Produkte in der Reihenfolge, die der Hof festlegt.'),
          absatz('3.2', 'Filter (etwa Kategorie oder Suchtext) schränken die Liste ein, verändern aber die Reihenfolge nicht. ', fett('Es gibt keine bezahlte Platzierung.'), ` Gründungshöfe tragen ein Abzeichen, werden aber nicht anders gereiht. Abzeichen und Siegel sind Angaben des Hofs oder Hinweise auf seinen Tarif, keine Prüfung oder Empfehlung durch ${MARKE}. Ändert sich die Reihung, sagen wir es an der Stelle, an der die Liste steht, und Höfen vorab nach Punkt 32 (§ 4a Abs. 1 Z 1 FAGG, Art. 5 Verordnung (EU) 2019/1150).`),
        ],
      },
      {
        nummer: 4,
        titel: 'Zugang, Konto, Sicherheit',
        bloecke: [
          absatz('4.1', fett('Kundinnen und Kunden'), ' brauchen kein Konto. Deine Bestellungen findest du über einen Code, den wir an deine E-Mail-Adresse schicken, und über Links in unseren E-Mails. Gib diese Links und Codes nicht weiter. Wer sie hat, sieht deine Bestellung.'),
          absatz('4.2', fett('Höfe'), ' registrieren ein Konto mit Passwort oder Passkey. Nur volljährige, geschäftsfähige Personen dürfen ein Hofkonto anlegen, und nur für einen Betrieb, den sie vertreten dürfen. Du hältst deine Zugangsdaten geheim und meldest uns sofort, wenn jemand Fremdes Zugriff hat oder haben könnte.'),
          absatz('4.3', 'Alle Angaben müssen richtig und aktuell sein. Du darfst die Plattform nicht missbrauchen: keine automatisierten Abfragen, kein Umgehen von Sicherheitsmaßnahmen, keine Belastung der Systeme über den normalen Gebrauch hinaus, keine Nutzung fremder Zugangsdaten.'),
          absatz('4.4', 'Wir dürfen die Nutzung technisch begrenzen (etwa die Zahl der Bestellungen, Reservierungen oder Nachrichten je Zeitraum), um Missbrauch und Überlastung zu verhindern, und dürfen den Zugang bei begründetem Verdacht auf Missbrauch einschränken (Punkt 5.3).'),
        ],
      },
      {
        nummer: 5,
        titel: 'Inhalte, Verhalten, Melden, Maßnahmen',
        bloecke: [
          absatz('5.1', 'Was Höfe einstellen (Texte, Fotos, Beiträge, Nachrichten) und was Kundinnen und Kunden schreiben (Notizen, Nachrichten, Meldungen), muss ', fett('wahr, rechtmäßig und respektvoll'), ' sein. Verboten sind insbesondere irreführende Angaben, Verstöße gegen Lebensmittel-, Futtermittel-, Preisauszeichnungs- oder Wettbewerbsrecht, Inhalte, die Rechte Dritter verletzen (Urheberrecht, Marken, Persönlichkeitsrechte), Beleidigungen, Drohungen, Diskriminierung, Werbung für Dritte und Angebote, die nichts mit dem Zweck der Plattform zu tun haben.'),
          absatz('5.2', fett('Melden.'), ' Jede Person kann uns rechtswidrige oder verdächtige Inhalte melden – über „Problem melden“ in der App oder per E-Mail an ', fett(E_MAIL), '. Wir bestätigen den Eingang, prüfen die Meldung sorgfältig und sagen dir, was wir entschieden haben (Art. 16 Verordnung (EU) 2022/2065). Eine KI-gestützte Software hilft uns beim Sortieren der Meldungen; jede Entscheidung über eine Maßnahme trifft ein Mensch.'),
          absatz('5.3', fett('Maßnahmen.'), ' Verstößt ein Inhalt oder ein Verhalten gegen Gesetz oder diese AGB, können wir, je nach Schwere: einen Inhalt entfernen oder ausblenden, ein Angebot aus dem Shop nehmen, einen Hof für neue Bestellungen vorübergehend sperren, eine Bestellung im Namen des Hofs stornieren (Punkt 23), ein Hofkonto vorübergehend sperren oder im Wiederholungsfall kündigen, und Kundinnen oder Kunden von weiteren Bestellungen ausschließen. Wir begründen jede Maßnahme gegenüber der betroffenen Person spätestens mit der Maßnahme und nennen, worauf sie sich stützt; bei Gefahr im Verzug, etwa bei einem Verdacht auf gesundheitsgefährdende Ware oder Betrug, zunächst kurz und danach ausführlich (Art. 17 Verordnung (EU) 2022/2065; Art. 4 Verordnung (EU) 2019/1150). Gegen eine Maßnahme kannst du dich bei uns beschweren (Punkt 25.4 für Höfe, Punkt 33.1 für alle); der Weg zu den Gerichten steht dir offen.'),
          absatz('5.4', 'Bei einer technischen Störung, etwa beim Zahlungsdienstleister, dürfen wir neue Bestellungen auf der ganzen Plattform vorübergehend anhalten. Laufende Bestellungen bleiben bestehen.'),
          absatz('5.5', 'Nachrichten zwischen Nutzerinnen und Nutzern lesen wir nur, wenn sie an uns gerichtet oder uns gemeldet werden, wenn es zur Behebung einer Störung oder zur Abwehr von Missbrauch nötig ist oder wenn ein Gesetz oder eine Behörde es verlangt.'),
          absatz('5.6', fett('Kontaktstelle'), ' (Art. 11 und 12 Verordnung (EU) 2022/2065) für Behörden, die Europäische Kommission und alle Nutzerinnen und Nutzer: ', fett(E_MAIL), '. Wir kommunizieren auf Deutsch und Englisch.'),
        ],
      },
      {
        nummer: 6,
        titel: 'Rechte an Inhalten, Marke',
        bloecke: [
          absatz('6.1', 'Deine Inhalte bleiben deine. ', fett('Höfe'), ` räumen ${MARKE} das einfache, unentgeltliche, räumlich unbeschränkte Recht ein, ihre Inhalte für den Betrieb und die Bewerbung der Plattform zu nutzen: anzuzeigen, zu speichern, technisch zu bearbeiten (verkleinern, zuschneiden, Formate umwandeln), als Vorschaubild, Teilen-Bild und QR-Plakat aufzubereiten, in der Suche, auf der Startseite und in unseren Kanälen (Website, soziale Medien, Presse) zu zeigen. Höfe können der Nutzung in unseren Kanälen jederzeit in Textform widersprechen (Punkt 24.3); dann stellen wir sie für neue Veröffentlichungen ein. Das Recht endet, wenn du den Inhalt löschst, mit Ausnahme von Kopien in Sicherungen, in bereits verschickten E-Mails und in bereits erstellten Belegen (Art. 3 Abs. 1 lit. d und e Verordnung (EU) 2019/1150). `, fett('Inhalte von Kundinnen und Kunden'), ' (Notizen, Nachrichten, Meldungen) nutzen wir nur zur Abwicklung der Bestellung und zur Bearbeitung von Meldungen.'),
          absatz('6.2', 'Du versicherst, dass du die nötigen Rechte an deinen Inhalten hast, insbesondere an Fotos, auf denen Personen zu sehen sind, und an Siegeln und Marken, die du nennst.'),
          absatz('6.3', `„${MARKE}“ und das ${MARKE}-Zeichen sind unsere Kennzeichen. Höfe dürfen sie nur so nutzen, wie wir es bereitstellen (QR-Plakat, Teilen-Bild, Hinweis „Bestell online bei ${MARKE}“). Jede andere Nutzung braucht unsere Zustimmung in Textform.`),
        ],
      },
      {
        nummer: 7,
        titel: 'Verfügbarkeit und Weiterentwicklung',
        bloecke: [
          absatz('7.1', `Wir entwickeln ${MARKE} laufend weiter, bauen Funktionen aus und nehmen Wartungen vor. Eine bestimmte Verfügbarkeit sichern wir nicht zu; wir bemühen uns, Ausfälle kurz zu halten und geplante Wartungen anzukündigen. Funktionen, die als Test oder Vorschau gekennzeichnet sind, können sich ändern oder wegfallen.`),
          absatz('7.2', 'Wir dürfen Funktionen ändern, ergänzen oder einstellen. Änderungen, die Höfe wesentlich einschränken, kündigen wir mindestens 15 Tage vorher an; müssen Höfe dafür etwas Technisches anpassen, mindestens 30 Tage (Punkt 32.3).'),
          absatz('7.3', 'Höfe sichern ihre eigenen Daten (Produktlisten, Texte, Fotos, Auswertungen) selbst; einen Export deiner Daten bekommst du auf Anfrage (Punkt 25.2).'),
        ],
      },
    ],
  },
  {
    id: 'b',
    titel: 'Teil B – Für Kundinnen und Kunden',
    punkte: [
      {
        nummer: 8,
        titel: 'Wer bestellen darf',
        bloecke: [
          absatz('8.1', 'Bestellen dürfen volljährige Personen. Bestellst du für dich oder deinen Haushalt, bist du ', fett('Verbraucherin oder Verbraucher'), ', und es gelten alle Verbraucherrechte dieser AGB. Bestellst du für ein Unternehmen oder einen Betrieb, wählst du in der Kasse „Betrieb“; dann gilt Punkt 28.'),
          absatz('8.2', 'Alkoholische Getränke gibt der Hof nur nach dem Jugendschutzgesetz deines Bundeslands ab und prüft dafür bei der Übergabe dein Alter. Kannst du dich nicht ausweisen, darf der Hof die Übergabe dieser Waren verweigern; den Preis dafür bekommst du zurück.'),
        ],
      },
      {
        nummer: 9,
        titel: 'Bestellen und Vertragsschluss',
        bloecke: [
          absatz('9.1', 'Die Angebote auf einer Hofseite sind eine Einladung des Hofs, zu bestellen. Du legst Produkte in den Korb, wählst einen ', fett('Abholtermin'), ' aus den Abholzeiten des Hofs, gibst Name, E-Mail-Adresse und – wenn der Hof es braucht – Telefonnummer an und wählst die Zahlart.'),
          absatz('9.2', 'Produkte im Korb werden für kurze Zeit für dich reserviert (derzeit 15 Minuten). Ist die Reservierung abgelaufen, kann ein anderer die Ware kaufen; die Kasse sagt dir das. Je Bestellung gilt der Mindestbestellwert, der in der Kasse steht (derzeit 10 € Warenwert), und je Produkt eine Höchstmenge.'),
          absatz('9.3', 'Vor dem Absenden siehst du alles auf einer Seite: Produkte, Preise, Plattformgebühr, Gesamtbetrag, Abholtermin sowie den Hof als deinen Vertragspartner mit Name, Anschrift, Telefonnummer und E-Mail-Adresse. Eingaben kannst du bis dahin ändern.'),
          absatz('9.4', fett('Verbindlich bestellen.'), ' Bei ', fett('Barzahlung'), ' gibst du mit dem Knopf ', fett('„Zahlungspflichtig bestellen“'), ' eine verbindliche Bestellung an den Hof ab. Bei ', fett('Online-Zahlung'), ' prüfen wir mit „Weiter zur Zahlung“ zunächst nur deine Angaben und halten die Ware für dich; verbindlich bestellst du erst mit dem Knopf ', fett('„Jetzt bezahlen“'), ' (bzw. „Erneut bezahlen“), mit dem du die Zahlung auslöst (§ 8 Abs. 2 FAGG).'),
          absatz('9.5', 'Der ', fett('Kaufvertrag mit dem Hof'), ' kommt zustande:'),
          aufzaehlung(
            ['bei Online-Zahlung, sobald der Zahlungsdienstleister die Zahlung bestätigt hat und wir dir die Bestellung im Namen des Hofs per E-Mail bestätigt haben;'],
            ['bei Barzahlung, sobald du die Bestellung über den Link in unserer E-Mail bestätigt hast und wir dir die Bestellung danach im Namen des Hofs bestätigen.'],
          ),
          absatz('9.6', fett('Fristen.'), ' Schließt du die Online-Zahlung nicht innerhalb von 30 Minuten ab oder bestätigst du eine Barbestellung nicht innerhalb von 2 Stunden über den Link, spätestens aber bis zum Beginn des Abholtermins, erlischt deine Bestellung, und die Ware wird wieder frei. Darauf weist die Kasse hin.'),
          absatz('9.7', 'Den Vertragstext schicken wir dir per E-Mail: deine Bestellung, die Rücktrittsbelehrung mit den Angaben des Hofs, das Muster-Widerrufsformular und diese AGB in der geltenden Fassung als Datei im Anhang. Auf ', link('/agb', '/agb'), ' kannst du sie außerdem jederzeit abrufen, speichern und ausdrucken (§ 9 und § 11 ECG). Deine Bestellung kannst du außerdem über den Link in der E-Mail ansehen, solange wir sie speichern (Punkt 29.4). Vertragssprache ist Deutsch.'),
          absatz('9.8', 'Die bestellte Ware wird für dich bis zum Ende des Abholtermins reserviert.'),
        ],
      },
      {
        nummer: 10,
        titel: 'Preise und Plattformgebühr',
        bloecke: [
          absatz('10.1', 'Die Preise legt der Hof fest. Sie verstehen sich in Euro inklusive Umsatzsteuer und ', fett('inklusive Plattformgebühr'), '. Bei Produkten nach Gewicht oder Menge zeigen Hofseite und Kasse den Grundpreis und die bestellte Menge. Der Preis gilt für die bestellte Einheit. Für eine Bestellung gilt der Preis, der beim Absenden in der Kasse stand; spätere Preisänderungen des Hofs betreffen nur neue Bestellungen.'),
          absatz('10.2', 'Die ', fett('Plattformgebühr'), ` ist Teil des Preises, den der Hof dir verrechnet. Mit ihr bezahlt der Hof in der Regel die Nutzung von ${MARKE}; bei manchen Höfen ist sie für Barzahlungen vorübergehend erlassen und bleibt dann beim Hof (Punkt 19.8). Du zahlst sie in jedem Fall an den Hof, nicht an ${MARKE}, und sie ist `, fett('online und bar gleich hoch'), `. Die Kasse weist sie zur Information getrennt aus („Ware · Plattformgebühr · Gesamt“). Für die Nutzung der Plattform verlangt ${MARKE} von dir kein Entgelt.`),
          absatz('10.3', 'Weitere Kosten – etwa für eine Lieferung oder ein Pfand – gibt es nur, wenn der Hof sie beim Angebot ausdrücklich nennt und die Kasse sie vor dem Bestellen zeigt.'),
        ],
      },
      {
        nummer: 11,
        titel: 'Bezahlen',
        bloecke: [
          absatz('11.1', fett('Online'), ': Karte, Apple Pay, Google Pay oder EPS über unseren Zahlungsdienstleister ', fett('Stripe Payments Europe, Ltd.'), ` Du zahlst an den Hof; Stripe leitet die Zahlung an das Konto des Hofs weiter und behält die Plattformgebühr für ${MARKE} ein. Mit der Bestätigung deiner Zahlung durch Stripe hast du gegenüber dem Hof bezahlt. Deine Zahlungsdaten verarbeitet Stripe; wir sehen sie nicht. Bricht die Zahlung ab, erlischt die Bestellung nach Punkt 9.6; du kannst sie bis dahin über „Erneut versuchen“ abschließen. Geht eine Zahlung erst nach dem Erlöschen ein, erstatten wir sie automatisch; die Bestellung lebt dadurch nicht wieder auf.`),
          absatz('11.2', fett('Bar bei Abholung'), ': Du zahlst den Gesamtbetrag aus deiner Bestellung beim Hof. Der Hof gibt dir einen Beleg. Ein Hof kann die Barzahlung ausschließen oder vorübergehend nicht anbieten; dann steht in der Kasse nur die Online-Zahlung.'),
          absatz('11.3', 'Rückzahlungen erfolgen auf demselben Weg wie die Zahlung: online über Stripe auf dein Zahlungsmittel, bar durch den Hof.'),
        ],
      },
      {
        nummer: 12,
        titel: 'Abholung',
        bloecke: [
          absatz('12.1', 'Du holst die Ware zum gewählten Abholtermin am Hof ab. Der ', fett('Abholcode'), ' in deiner Bestellung hilft dem Hof, die Bestellung zu finden; er ist kein Ausweis und keine Berechtigung.'),
          absatz('12.2', 'Mit der Übergabe am Hof geht die Gefahr für die Ware auf dich über. Prüfe die Ware bei der Übergabe und sag dem Hof sofort, wenn etwas nicht passt. Deine gesetzlichen Gewährleistungsrechte bleiben davon unberührt.'),
          absatz('12.3', 'Fehlt bei der Abholung ein Artikel oder ist weniger da als bestellt, hast du die Wahl: Du nimmst den Rest, und der Hof passt die Bestellung an (bei Online-Zahlung bekommst du den Preis des fehlenden Teils zurück, bar zahlst du nur, was du bekommst), oder du lehnst die ganze Bestellung ab, wenn der Rest für dich keinen Sinn hat; dann bekommst du alles zurück bzw. zahlst nichts. Bei Ware nach Gewicht (etwa ein Stück Fleisch oder Käse) kann das tatsächliche Gewicht leicht abweichen: Ist die Ware leichter als bestellt, erstattet dir der Hof den Unterschied; ist sie schwerer, verlangt er nichts nach.'),
          absatz('12.4', fett('Nicht abgeholt.'), ' Holst du die Ware nicht bis zum Ende des Abholtermins ab, obwohl der Hof sie bereitgehalten hat, bist du mit der Annahme in Verzug (§ 1419 ABGB). Der Hof darf die Ware dann anderweitig verwenden. Den Warenpreis kann der Hof behalten bzw. verlangen; was er durch einen anderweitigen Verkauf der Ware erlöst oder sich erspart hat, muss er dir anrechnen. Dein Rücktrittsrecht nach Punkt 14 bleibt für Waren, die nicht vom Rücktritt ausgenommen sind, unberührt. Die Plattformgebühr fällt für nicht abgeholte Bestellungen nicht an; bei Online-Zahlung wird sie dir zurückgezahlt. Wer wiederholt bestellt und nicht abholt, kann von weiteren Bestellungen ausgeschlossen werden (Punkt 5.3).'),
        ],
      },
      {
        nummer: 13,
        titel: 'Stornieren vor der Abholung',
        bloecke: [
          absatz('13.1', 'Bis zum Beginn des Abholtermins kannst du eine Bestellung ', fett('stornieren'), ', ohne Angabe von Gründen und ohne Kosten: als Verbraucherin oder Verbraucher über die Rücktrittsfunktion auf ', link(`${PRODUKTION_HOST}/widerruf`, '/widerruf'), ', deren Link in jeder E-Mail zu deiner Bestellung steht, sonst mit einer Nachricht an den Hof, der die Bestellung dann storniert.'),
          absatz('13.2', `Der Hof kann vor der Abholung stornieren, wenn er aus einem sachlich gerechtfertigten Grund, den er nicht zu vertreten hat, nicht erfüllen kann (etwa Ernteausfall, Unwetter, kranke Tiere, verdorbene Ware) oder wenn ein Preis oder eine Menge offensichtlich falsch eingetragen war und du das erkennen konntest. Er muss dich darüber informieren. ${MARKE} darf eine Bestellung im Namen des Hofs stornieren, wenn der Hof nicht erreichbar ist, wenn du zu Recht darauf bestehst oder wenn eine technische Störung die Abwicklung verhindert (Punkt 23.2).`),
          absatz('13.3', 'Bei einem Storno vor der Abholung bekommst du bei Online-Zahlung ', fett('alles zurück'), ' – Warenpreis und Plattformgebühr. Bei Barzahlung ist nichts zu erstatten.'),
        ],
      },
      {
        nummer: 14,
        titel: 'Rücktritt vom Kaufvertrag (Widerruf im Fernabsatz)',
        bloecke: [
          absatz('14.1', 'Als Verbraucherin oder Verbraucher kannst du vom Kaufvertrag mit dem Hof ', fett('innerhalb von 14 Tagen'), ' ohne Angabe von Gründen zurücktreten. Die Frist beginnt mit dem Tag, an dem du die Ware erhalten hast (§ 11 FAGG). Die Rücktrittsbelehrung steht in Anhang 1 und – mit den Angaben deines Hofs ausgefüllt – in deiner Bestellbestätigung.'),
          absatz('14.2', fett('Kein Rücktrittsrecht'), ' besteht nach § 18 Abs. 1 FAGG insbesondere bei'),
          aufzaehlung(
            ['Waren, die ', fett('schnell verderben können'), ' oder deren Ablaufdatum schnell überschritten würde (Z 4) – zum Beispiel frisches Fleisch, frischer Fisch, Frischmilch, Joghurt, Topfen, Frischkäse, Brot und Gebäck, Beeren, Blattsalat und andere empfindliche Frischware;'],
            ['versiegelten Waren, die aus Gründen des Gesundheitsschutzes oder der Hygiene nicht zur Rückgabe geeignet sind, wenn die Versiegelung nach der Übergabe entfernt wurde (Z 5);'],
            ['Waren, die nach deinen Angaben angefertigt oder zugeschnitten wurden, etwa Fleisch nach Wunschzerlegung (Z 3);'],
            ['Waren, die nach der Übergabe untrennbar mit anderen Gütern vermischt wurden, etwa Hackschnitzel oder Pellets, die ins Lager gekippt wurden (Z 6).'],
          ),
          absatz(null, 'Ob eine Ausnahme greift, hängt von der konkreten Ware ab, nicht von ihrer Gruppe: Lagerfähiges Obst und Gemüse (etwa Äpfel, Kartoffeln, Kürbis), Eier innerhalb der Mindesthaltbarkeit, Hartkäse, Speck, Honig, Mehl, Nudeln, Brennholz und Futter in geschlossener Verpackung fallen in der Regel nicht unter diese Ausnahmen. Ob eine Ware nach Angabe des Hofs schnell verdirbt und deshalb vom Rücktritt ausgenommen ist, steht vor dem Bestellen beim Produkt und in der Kasse. Der Hof prüft das im Einzelfall nach dem Gesetz und begründet dir seine Entscheidung.'),
          absatz('14.3', 'Den Rücktritt erklärst du gegenüber dem ', fett('Hof'), ' (seine Angaben stehen in deiner Bestellung und in der Belehrung): über die Rücktrittsfunktion auf ', link(`${PRODUKTION_HOST}/widerruf`, '/widerruf'), ' (Knöpfe „Vertrag widerrufen“ und „Widerruf bestätigen“, § 13a FAGG), formlos per E-Mail oder Brief oder mit dem Muster-Formular in Anhang 2. Du kannst den Rücktritt auch an uns schicken; der Hof hat uns dafür bevollmächtigt (Punkt 18.8), wir leiten ihn an den Hof weiter und bestätigen dir den Eingang. Für die Frist reicht es, dass du die Erklärung rechtzeitig abschickst.'),
          absatz('14.4', 'Nach einem wirksamen Rücktritt erstattet der Hof alle Zahlungen für diese Ware – einschließlich der darin enthaltenen Plattformgebühr – unverzüglich und spätestens binnen 14 Tagen ab Eingang deines Rücktritts; bei Online-Zahlung läuft das über Stripe auf dein Zahlungsmittel. Der Hof darf die Rückzahlung verweigern, bis er die Ware zurückerhalten hat oder du nachgewiesen hast, dass du sie zurückgeschickt hast. Die Ware bringst du unverzüglich, spätestens binnen 14 Tagen, zum Hof zurück oder schickst sie ihm; die unmittelbaren Kosten der Rückgabe trägst du. Für einen Wertverlust haftest du nur, wenn er auf einen zur Prüfung der Ware nicht nötigen Umgang zurückgeht.'),
          absatz('14.5', 'Ein Rücktritt nach Punkt 14.1 ', fett('vor der Abholung'), ' wirkt wie ein Storno nach Punkt 13. Für Waren ohne Rücktrittsrecht (Punkt 14.2) kannst du nur bis zum Beginn des Abholtermins stornieren (Punkt 13.1); danach bleibt die Bestellung verbindlich, und holst du nicht ab, gilt Punkt 12.4.'),
        ],
      },
      {
        nummer: 15,
        titel: 'Gewährleistung, Reklamation, Produkthaftung',
        bloecke: [
          absatz('15.1', 'Für die Ware haftet der ', fett('Hof'), ` nach den gesetzlichen Gewährleistungsregeln (§§ 922 ff. ABGB, Verbrauchergewährleistungsgesetz). Für Schäden durch ein fehlerhaftes Produkt haftet, wer es hergestellt oder in Verkehr gebracht hat (Produkthaftungsgesetz). ${MARKE} übernimmt keine Gewährleistung und keine Garantie für Waren und ist weder Herstellerin noch Importeurin noch Händlerin.`),
          absatz('15.2', `Wende dich mit einer Reklamation an den Hof (Adresse, Telefonnummer und E-Mail-Adresse stehen in deiner Bestellung). Kommst du nicht weiter, hilft dir ${MARKE} über „Problem melden“ oder per E-Mail: Wir vermitteln und erinnern den Hof an seine Pflichten. Einen Anspruch gegen ${MARKE} auf Gewährleistung, Erstattung oder Schadenersatz für die Ware hast du nicht; wir können im Einzelfall für den Hof erstatten (Punkt 21.3).`),
        ],
      },
      {
        nummer: 16,
        titel: `Nachrichten von Höfen und von ${MARKE}`,
        bloecke: [
          absatz('16.1', 'Neuigkeiten eines Hofs (per E-Mail oder über einen Nachrichtendienst) bekommst du nur, wenn du dich dafür angemeldet hast. Du kannst dich jederzeit über den Link in jeder Nachricht oder beim Hof abmelden.'),
          absatz('16.2', 'E-Mails zu deiner Bestellung (Bestätigung, Erinnerung, Änderung, Storno, Rücktritt) sind Teil der Abwicklung und brauchen keine Einwilligung.'),
          absatz('16.3', 'Meldungen über „Problem melden“ bearbeiten wir in angemessener Zeit. Ein Anspruch auf eine bestimmte Antwortzeit oder auf eine bestimmte Lösung besteht nicht, soweit das Gesetz nichts anderes vorschreibt.'),
        ],
      },
    ],
  },
  {
    id: 'c',
    titel: 'Teil C – Für Höfe',
    punkte: [
      {
        nummer: 17,
        titel: 'Aufnahme und Hofkonto',
        bloecke: [
          absatz('17.1', 'Du registrierst deinen Betrieb mit richtigen Angaben (Betriebsname, Adresse, Telefonnummer, E-Mail-Adresse, Rechtsform oder Betriebsart, soweit vorgeschrieben Betriebsnummern) und erklärst, dass du als ', fett('Unternehmer'), ' anbietest (Punkt 2.5). Nach der Prüfung schalten wir dein Hofkonto frei; einen Anspruch auf Freischaltung gibt es nicht. Freischalten können wir erst, wenn dein Hof mindestens eine aktive Abholzeit, mindestens ein Produkt im Shop und ein fertig eingerichtetes Stripe-Konto hat (Punkt 21).'),
          absatz('17.2', 'Auf deiner Hofseite und in der Kasse stehen Betriebsname, Adresse, Telefonnummer und E-Mail-Adresse; die Kundschaft braucht sie für Rücktritte und Reklamationen. Du bist dafür verantwortlich, dass die Pflichtangaben für dein Unternehmen (etwa nach ECG, UGB, Gewerbeordnung, Preisauszeichnungsgesetz) dort oder in deinen Angeboten vollständig und richtig sind.'),
          absatz('17.3', 'Ein Hofkonto darf nur vom Betriebsinhaber oder von Personen genutzt werden, die der Betrieb dazu berechtigt hat. Für alles, was über dein Konto geschieht, bist du verantwortlich, auch wenn es ein Mitarbeiter oder ein Familienmitglied war.'),
          absatz('17.4', 'Übergibst du den Betrieb (etwa an die nächste Generation), kannst du das Hofkonto mit unserer Zustimmung in Textform auf den neuen Betriebsinhaber übertragen. Offene Beträge sind vorher zu begleichen; der neue Inhaber bestätigt diese AGB.'),
          absatz('17.5', 'Wir schulden dir keine bestimmte Zahl an Besuchen, Bestellungen oder Umsätzen. Ein Hof, den wir als ', fett('Testhof'), ' führen, dient nur der Erprobung der Plattform: Er erscheint in keiner Liste, Karte und Suche, seine Seite ist nur über einen direkten Link erreichbar, Hofseite, Produktseiten und Kasse sagen oben, dass es ein Testhof ist, und er bekommt keinen Gründungsplatz. Bestellungen bei einem Testhof sind Testbestellungen ohne Anspruch auf Ware.'),
        ],
      },
      {
        nummer: 18,
        titel: 'Deine Angebote und deine Pflichten',
        bloecke: [
          absatz('18.1', 'Du bietest nur Waren an, die du ', fett('selbst erzeugst oder rechtmäßig vertreibst'), ' und für die du alle Bewilligungen hast, und beschreibst sie richtig und vollständig: Bezeichnung, Preis, Menge oder Gewicht, Mindesthaltbarkeit, soweit vorgeschrieben, und bei Lebensmitteln alle Angaben, die vor dem Kauf vorgeschrieben sind (insbesondere Allergene, Zutaten, Herkunft, Art. 14 Verordnung (EU) 1169/2011). Du bist Lebensmittelunternehmer im Sinne des Lebensmittelrechts und allein für Hygiene, Kühlkette, Rückverfolgbarkeit und Kennzeichnung verantwortlich.'),
          absatz('18.2', fett('Futtermittel:'), ` Du bist für Registrierung und Kennzeichnung nach dem Futtermittelrecht verantwortlich (LFBIS-Nummer, Meldung an die zuständige Behörde). Die Nummern, die du einträgst, zeigt ${MARKE} so an, wie du sie angibst; wir prüfen sie nicht.`),
          absatz('18.3', fett('Brennmaterial:'), ' Angaben zu Holzart, Trocknung, Menge und Einheit müssen stimmen. ', fett('Alkohol:'), ' Du gibst alkoholische Getränke nur nach dem Jugendschutzgesetz deines Bundeslands ab und prüfst das Alter bei der Übergabe.'),
          absatz('18.4', 'Du pflegst ', fett('Abholzeiten'), ', die du einhalten kannst, und übergibst bestellte Ware zum Abholtermin in der bestellten Menge und Qualität. Kannst du eine Bestellung nicht erfüllen, stornierst du sie so früh wie möglich mit Angabe des Grunds (Punkt 13.2); bei Online-Zahlung erstattet Stripe der Kundschaft automatisch den vollen Betrag zu deinen Lasten.'),
          absatz('18.5', 'Du hältst alle Vorschriften ein, die für deine Waren und deinen Verkauf gelten (Lebensmittel-, Futtermittel-, Gewerbe-, Preisauszeichnungs-, Jugendschutz- und Steuerrecht), stellst Rechnungen oder Belege nach deinen steuerlichen Pflichten (Belegerteilung, Registrierkasse) selbst aus und führst Steuern und Abgaben auf deine Umsätze selbst ab. Du prüfst selbst, ob und in welchem Umfang du als landwirtschaftlicher Betrieb Direktvermarktung betreiben darfst.'),
          absatz('18.6', `Du erfüllst gegenüber der Kundschaft die gesetzlichen Pflichten eines Unternehmers im Fernabsatz: Rücktrittsrecht (Punkt 14), Gewährleistung (Punkt 15), Informationspflichten. Die Kaufbedingungen (Punkte 8 bis 16), die Rücktrittsbelehrung und die Abläufe dazu (Bestellbestätigung, Rücktrittsfunktion, Storno-Weg) geben wir verbindlich vor und halten sie nach bestem Wissen gesetzeskonform; Rechtsberatung für deinen Betrieb sind sie nicht. Du bist dafür verantwortlich, dass die Angaben zu deinen Waren stimmen und dass du erfüllst, was sich aus deiner Ware ergibt (etwa Ausnahmen vom Rücktritt, Rücksendekosten bei sperriger Ware, Pflichtangaben). Bei jedem Produkt gibst du an, ob es schnell verdirbt und deshalb vom Rücktritt ausgenommen ist, und bei sperriger Ware die geschätzten Kosten einer Rücksendung. ${MARKE} zeigt diese Angaben vor dem Bestellen, in der Belehrung der Bestellbestätigung und auf der Rücktrittsseite an und entscheidet nichts selbst. Nennst du bei sperriger Ware, die nicht per Post zurückgehen kann, beim Angebot keine geschätzten Rücksendekosten, trägst du sie bei einem Rücktritt selbst (§ 15 FAGG).`),
          absatz('18.7', `Du beantwortest Rücktritte, Reklamationen und Nachrichten der Kundschaft in angemessener Zeit, in der Regel binnen 3 Werktagen, und erstattest, was du schuldest, binnen der gesetzlichen Fristen. Nachrichten von ${MARKE} im Postfach liest du regelmäßig.`),
          absatz('18.8', fett('Einbeziehung und Vollmacht.'), ` Mit der Nutzung von ${MARKE} beziehst du die Kaufbedingungen (Punkte 8 bis 16) in jeden Kaufvertrag ein, der über ${MARKE} zustande kommt. Du bevollmächtigst ${MARKE}, in deinem Namen Bestellungen entgegenzunehmen und zu bestätigen, Stornos nach Punkt 23 zu erklären, Erstattungen nach diesen AGB über Stripe auszulösen (Punkt 21.4) und Rücktritte, Reklamationen und andere Erklärungen der Kundschaft für dich entgegenzunehmen (Empfangsvollmacht). Was bei ${MARKE} eingeht, gilt als bei dir eingegangen; wir leiten es dir unverzüglich weiter.`),
          absatz('18.9', `Die Daten der Kundschaft, die du über ${MARKE} bekommst, nutzt du nur zur Abwicklung der jeweiligen Bestellung, für deine gesetzlichen Pflichten und, mit Einwilligung, für Neuigkeiten (Punkt 26). Keine Weitergabe, kein Verkauf, keine unerbetene Werbung.`),
          absatz('18.10', `Bestellungen, die über ${MARKE} eingegangen sind, wickelst du über ${MARKE} ab. Du leitest sie nicht an ${MARKE} vorbei, um die Plattformgebühr zu umgehen; tust du es doch, schuldest du die Plattformgebühr für diese Bestellungen trotzdem. Verkäufe außerhalb von ${MARKE} bleiben dir frei; wir verlangen keine Exklusivität und keine Bestpreisgarantie.`),
          absatz('18.11', fett('Freistellung.'), ` Nimmt jemand ${MARKE} wegen deiner Angebote, Inhalte oder Waren oder wegen deines Verstoßes gegen Gesetz oder diese AGB in Anspruch (Kundschaft, Mitbewerber, Rechteinhaber, Behörden), hältst du ${MARKE} schad- und klaglos, einschließlich angemessener Kosten der Rechtsverteidigung, soweit du das zu vertreten hast. Wir informieren dich unverzüglich und stimmen die Verteidigung mit dir ab.`),
          absatz('18.12', fett('Rückruf.'), ' Musst du eine Ware zurückrufen, oder verlangt eine Behörde Maßnahmen zu einer Ware, sagst du uns das unverzüglich. Wir dürfen das Angebot ausblenden und betroffene Kundschaft in deinem Namen informieren.'),
        ],
      },
      {
        nummer: 19,
        titel: 'Plattformgebühr und Abrechnung',
        bloecke: [
          absatz('19.1', `Für die Nutzung von ${MARKE} zahlst du je Bestellung, die abgeholt wurde, eine `, fett('Plattformgebühr'), `. Sie beträgt den Prozentsatz vom Warenpreis, der in deinen Konditionen steht (Standard 6 %), wird je Stück auf den nächsten Cent aufgerundet und ist im Endpreis enthalten, den die Kundschaft zahlt (Punkt 10.2). Du legst den Warenpreis fest; ${MARKE} errechnet daraus den Endpreis. Unterm Strich reichst du nur weiter, was die Kundschaft bezahlt hat. Die Plattformgebühr versteht sich inklusive Umsatzsteuer, soweit sie anfällt.`),
          absatz('19.2', fett('Online'), ` behält Stripe die Plattformgebühr beim Bezahlen für ${MARKE} ein; dir fließt der volle Warenpreis zu. `, fett('Bar'), ' kassierst du den Endpreis; die darin enthaltene Plattformgebühr rechnen wir monatlich ab (Punkt 19.4).'),
          absatz('19.3', 'Fällig wird die Plattformgebühr mit „Abgeholt“. Für stornierte, nicht abgeholte und fehlende Waren und für Waren, die du nach einem Rücktritt zurücknimmst, fällt keine Plattformgebühr an: Online geht die einbehaltene Gebühr für diese Waren mit der Erstattung an die Kundschaft zurück. Bar fällt sie von selbst aus der Monatsabrechnung, wenn du Storno, fehlende Ware oder Rückgabe vor dem Abrechnungstag in der App einträgst; was du später einträgst oder in der App nicht eintragen kannst (etwa eine Teilmenge), schreiben wir dir auf Anfrage gut. Erstattest du aus Gewährleistung oder Kulanz, bleibt die Plattformgebühr geschuldet, auch wenn die Ware zurückgeht.'),
          absatz('19.4', fett('Monatsabrechnung.'), ' Am Abrechnungstag (Standard: der 3. jedes Monats, in deinen Konditionen änderbar) stellen wir dir für den Vormonat zwei Rechnungen aus: über die online schon einbehaltenen Gebühren (bereits bezahlt) und über die bar kassierten Gebühren, aufgeschlüsselt je Bestellnummer. Rechnungen stellen wir elektronisch über Stripe und schicken sie per E-Mail; du stimmst dem zu. Einwendungen gegen eine Abrechnung teilst du uns binnen 30 Tagen nach Zugang mit; danach gilt sie als anerkannt, worauf wir in der Rechnung hinweisen. Barbestellungen, die du bis zum Abrechnungstag weder als „abgeholt“ noch als „nicht abgeholt“ markiert hast, dürfen wir für die Abrechnung als abgeholt behandeln; offene Bestellungen siehst du laufend in der App und kannst die Markierung bis zum Abrechnungstag nachholen.'),
          absatz('19.5', fett('SEPA-Lastschrift.'), ' Für den Einzug erteilst du uns über das Formular von Stripe in der App ein SEPA-Lastschriftmandat. Mit ihm ziehen wir alle fälligen Beträge nach diesen AGB ein: die Gebühren aus Barbestellungen, die Grundgebühr für Hofladen und Beträge nach Punkt 21.3. Ohne gültiges Mandat bietet die Kasse bei deinem Hof nur die Online-Zahlung an, sobald der Einzug für deinen Hof beginnt (Punkt 19.8), soweit deine Konditionen nichts anderes sagen (etwa Zahlung per Überweisung). Die Vorabankündigung einer Lastschrift erhältst du mit der Rechnung per E-Mail; der Einzug erfolgt frühestens am Werktag nach Zugang der Rechnung. Du stimmst dieser verkürzten Frist zu und sorgst für Deckung auf dem Konto.'),
          absatz('19.6', fett('Fälligkeit und Verzug.'), ' Rechnungen sind mit Zugang fällig. Bleibt eine Rechnung 14 Tage nach Fälligkeit unbezahlt (in deinen Konditionen änderbar) oder wird eine Lastschrift zurückgebucht, nimmt dein Hof keine Barbestellungen mehr an, bis der Betrag bezahlt ist; Online-Zahlung und laufende Bestellungen bleiben. Im Verzug schuldest du die gesetzlichen Verzugszinsen zwischen Unternehmern (§ 456 UGB) und den Pauschalbetrag für Betreibungskosten nach § 458 UGB.'),
          absatz('19.7', `Gegen Forderungen von ${MARKE} kannst du nur mit Forderungen aufrechnen, die wir anerkannt haben oder die rechtskräftig festgestellt sind. Ein Zurückbehaltungsrecht steht dir nur wegen solcher Forderungen aus diesem Vertrag zu.`),
          absatz('19.8', fett('Gründungshöfe und Einzugsbeginn.'), ' Für Gründungshöfe beginnt der Einzug der Bar-Gebühren erst nach Ablauf ihrer Gründungslaufzeit (Punkt 20.3); bis dahin bleibt die im Preis enthaltene Gebühr aus Barbestellungen bei dir (erlassen), und ein Mandat ist nicht nötig. Für alle anderen Höfe beginnt der Einzug mit dem Stichtag auf ', link('/konditionen', '/konditionen'), ', außer in deinen Konditionen steht ein späterer Tag. Wir sagen dir 4 Wochen vor deinem Einzugsbeginn im Postfach und per E-Mail Bescheid; liegt er näher, sofort.'),
          absatz('19.9', fett('Änderungen.'), ' Den Prozentsatz, den Abrechnungstag und die Frist bis zur Sperre können wir für deinen Hof ändern. Jede Änderung zu deinem Nachteil kündigen wir mindestens 30 Tage vorher an; ein geänderter Prozentsatz gilt nur für Bestellungen ab dem angekündigten Tag (Punkt 32.3).'),
        ],
      },
      {
        nummer: 20,
        titel: 'Tarife',
        bloecke: [
          absatz('20.1', 'Es gibt zwei Tarife: ', fett('Hoftor'), ' (0 € im Monat; nach dem Tarifstart bis zu 3 Produkte und 1 Abholzeit pro Woche) und ', fett('Hofladen'), ' (19 € im Monat inkl. USt, monatlich zum Monatsende kündbar). Was welcher Tarif enthält, steht auf ', link('/konditionen', '/konditionen'), ' und in deinen Einstellungen unter „Deine Konditionen“, beides Teil dieser AGB.'),
          absatz('20.2', 'Ohne deine Wahl gilt Hoftor. Hofladen gibt es nur nach aktiver Wahl mit SEPA-Lastschriftmandat; es gibt keine automatische Umstellung und keine Abbuchung ohne deine Wahl. Die Grundgebühr rechnen wir monatlich im Voraus ab. Bleibt sie nach Mahnung mit 14 Tagen Frist unbezahlt, dürfen wir den Tarif auf Hoftor zurücksetzen.'),
          absatz('20.3', fett('Gründungshöfe.'), ' Höfe mit Gründungsplatz nutzen Hofladen für die Laufzeit, die in ihren Konditionen steht (derzeit 12 Monate ab dem späteren Tag von Tarifstart und Freischaltung), ohne Grundgebühr. Diese Zusage bleibt bestehen, auch wenn wir die Bedingungen für neue Höfe ändern. Danach wählst du deinen Tarif; ohne Wahl bleibt Hoftor.'),
          absatz('20.4', fett('Bis zum Tarifstart.'), ' Bis zum Tarifstart auf ', link('/konditionen', '/konditionen'), ' ist jeder Tarif kostenlos.'),
        ],
      },
      {
        nummer: 21,
        titel: 'Zahlungsabwicklung über Stripe',
        bloecke: [
          absatz('21.1', `Die Zahlungsabwicklung für Höfe auf ${MARKE} stellt Stripe Payments Europe, Ltd. bereit. Sie unterliegt dem `, fett('Stripe Connected Account Agreement'), ` einschließlich der Stripe-Nutzungsbedingungen (zusammen die „Stripe-Vereinbarung“, abrufbar unter stripe.com/legal/connect-account). Indem du diesen AGB zustimmst oder ${MARKE} als Hof weiter nutzt, stimmst du zu, an die Stripe-Vereinbarung gebunden zu sein, die Stripe von Zeit zu Zeit ändern kann. Voraussetzung dafür, dass ${MARKE} die Zahlungsabwicklung über Stripe ermöglicht, ist, dass du uns richtige und vollständige Angaben über dich und deinen Betrieb machst; du ermächtigst uns, diese Angaben und Transaktionsdaten im Zusammenhang mit der Zahlungsabwicklung an Stripe weiterzugeben. Stripe prüft deine Identität und dein Bankkonto, entscheidet allein über Freigabe, Sperre und Auszahlungen und kann Nachweise verlangen. Darauf haben wir keinen Einfluss; ${MARKE} haftet nicht für Entscheidungen, Verzögerungen oder Gebühren von Stripe. Du bietest über ${MARKE} nichts an, was die Stripe-Vereinbarung ausschließt.`),
          absatz('21.2', `Online-Zahlungen der Kundschaft gehen an dich als Zahlungsempfänger. Mit der Bestätigung der Zahlung durch Stripe ist die Schuld der Kundschaft dir gegenüber erfüllt. Stripe behält die Plattformgebühr für ${MARKE} ein und zahlt den Rest nach seinen Bedingungen auf dein Bankkonto aus. Die Entgelte von Stripe für die Zahlungsabwicklung trägt ${MARKE}, soweit die Konditionen nichts anderes sagen. ${MARKE} steht nicht dafür ein, dass Kundschaft abholt oder bar bezahlt.`),
          absatz('21.3', fett('Erstattungen und Rückgriff.'), ` Erstattungen bei Storno, Rücktritt, fehlenden Artikeln und nach Punkt 12.4 laufen über Stripe; der erstattete Betrag wird von deinem Stripe-Guthaben oder deiner nächsten Auszahlung abgezogen. Muss ${MARKE} wegen deiner Verkäufe etwas an Stripe oder an Kundschaft zahlen – Erstattungen, Rückbuchungen (Chargebacks) samt den Gebühren, die Stripe dafür berechnet, negative Salden, Entgelte oder Strafzahlungen von Kartenorganisationen –, ersetzt du uns das, außer wir haben es zu vertreten. Wir dürfen solche Beträge durch Rückholung früherer Überweisungen an dich über Stripe, durch Verrechnung mit Beträgen, die wir dir schulden, oder per SEPA-Lastschrift einziehen und stellen sie dir sonst in Rechnung; Punkt 19.6 gilt. Kommt dein Hof einer Reklamation nicht binnen 14 Tagen nach, obwohl wir dich erinnert haben, und nennt er uns keinen sachlichen Grund dagegen, darf ${MARKE} der Kundschaft in deinem Namen bis zur Höhe des Bestellwerts erstatten und den Betrag bei dir verrechnen.`),
          absatz('21.4', `Du bevollmächtigst ${MARKE}, Erstattungen nach diesen AGB über dein Stripe-Konto auszulösen: bei Storno, bei einem wirksamen Rücktritt, bei fehlenden Artikeln, für die Plattformgebühr nicht abgeholter Bestellungen, bei einer Stornierung nach Punkt 23 und in den Fällen von Punkt 21.3. Über jede Erstattung informieren wir dich.`),
          absatz('21.5', `Barzahlungen kassierst du selbst. ${MARKE} wickelt sie nicht ab, bewahrt kein Bargeld auf und haftet nicht dafür.`),
          absatz('21.6', 'Wir dürfen den Zahlungsdienstleister mit einer Ankündigung von mindestens 30 Tagen wechseln; du wirkst an der Einrichtung des neuen Kontos mit.'),
        ],
      },
      {
        nummer: 22,
        titel: 'Storno, Nichtabholung, Erstattungen durch dich',
        bloecke: [
          absatz('22.1', 'Du stornierst nur Bestellungen, die du nicht erfüllen kannst, und nennst den Grund (Punkt 13.2). Bei einem Storno nach Beginn des Abholtermins oder bei wiederholten Stornos dürfen wir deinen Hof prüfen und Maßnahmen nach Punkt 5.3 treffen.'),
          absatz('22.2', '„Abgeholt“ und „Nicht abgeholt“ markierst du wahrheitsgemäß. Markierst du eine abgeholte Bestellung als „nicht abgeholt“, schuldest du die Plattformgebühr trotzdem; Punkt 25.3 gilt. Die Zahl der nicht abgeholten Bestellungen zeigen wir in deiner Akte; fällt sie auf, fragen wir nach.'),
          absatz('22.3', 'Bar erstattest du selbst, was du nach Punkt 12 bis 15 schuldest, und vermerkst es in der Bestellung.'),
        ],
      },
      {
        nummer: 23,
        titel: `Eingriffe durch ${MARKE} bei Störungen`,
        bloecke: [
          absatz('23.1', 'Wir dürfen deinen Hof für neue Bestellungen vorübergehend sperren, wenn ein Rechtsverstoß, eine Gefahr für die Kundschaft, eine offene Rechnung nach Punkt 19.6 oder eine behördliche Anordnung vorliegt oder wenn du auf eine dringende Nachricht zu einer offenen Bestellung länger als 7 Tage nicht reagierst. Wir nennen dir den Grund (Punkt 5.3). Die Sperre endet, sobald der Grund weggefallen ist.'),
          absatz('23.2', 'Wir dürfen eine Bestellung in deinem Namen vor der Abholung stornieren, wenn du nicht erreichbar bist, die Kundin oder der Kunde berechtigt darauf besteht oder eine technische Störung die Abwicklung verhindert. Du bekommst eine Nachricht mit dem Grund.'),
          absatz('23.3', 'Bei einer Störung der Plattform oder des Zahlungsdienstleisters dürfen wir neue Bestellungen auf allen Höfen anhalten (Punkt 5.4). Für Verkäufe, die dadurch nicht zustande kommen, haften wir nur nach Punkt 30.'),
        ],
      },
      {
        nummer: 24,
        titel: 'Postfach, Zustellung',
        bloecke: [
          absatz('24.1', `${MARKE} schreibt dir über das `, fett('Postfach'), ' in der App: Neues zur Plattform, Hinweise zu deinen Angeboten, Abrechnung, Rechtliches. Du kannst jede Nachricht beantworten.'),
          absatz('24.2', 'Nachrichten, die den ', fett(`Betrieb deines Hofs auf ${MARKE}`), ' betreffen (etwa fehlende Pflichtangaben, Abrechnung, Sperren, Änderungen dieser AGB), schicken wir dir zusätzlich per E-Mail an die Adresse deines Kontos. Das ist Teil der Vertragsdurchführung und braucht keine Einwilligung. Werbung für Dritte verschicken wir nicht. Eine E-Mail an die Adresse deines Kontos gilt am folgenden Werktag als zugegangen; du hältst die Adresse aktuell.'),
          absatz('24.3', 'Für Erklärungen zu diesem Vertrag – auch für den Widerspruch nach Punkt 6.1 – genügt Textform (E-Mail oder Postfach).'),
        ],
      },
      {
        nummer: 25,
        titel: 'Reihenfolge, Daten, Beschwerden (Verordnung (EU) 2019/1150)',
        bloecke: [
          absatz('25.1', fett('Reihenfolge:'), ' Wie Höfe und Angebote gereiht werden, steht in Punkt 3. Du kannst die Reihung nicht kaufen, und wir bevorzugen keinen Hof – auch keinen, an dem wir beteiligt wären. Wir betreiben keinen eigenen Hof, der mit deinem im Wettbewerb steht; ein Testhof (Punkt 17.5) erscheint in keiner Liste.'),
          absatz('25.2', fett('Daten:'), ` Du siehst die Daten deiner eigenen Bestellungen (Name, E-Mail, Telefon und Notiz der Kundschaft, soweit angegeben), deine Auswertungen und deine Abrechnungen und bekommst sie auf Anfrage als Export. ${MARKE} sieht alle Daten, die beim Betrieb der Plattform anfallen, und nutzt sie für den Betrieb, die Abrechnung, die Pflichtmeldungen (Punkt 27) und die Verbesserung der Plattform; Näheres in der `, link('Datenschutzerklärung', '/datenschutz'), '. Nach dem Ende deiner Nutzung bleiben Bestell- und Abrechnungsdaten so lange gespeichert, wie das Gesetz es verlangt (Punkt 29.4); Zugriff darauf hast du dann nur noch über eine Anfrage.'),
          absatz('25.3', fett('Einschränkung, Sperre, Kündigung:'), ' Schränken wir dein Konto ein oder sperren es, nennen wir dir spätestens mit der Maßnahme die Gründe und die Tatsachen, auf die wir uns stützen (Punkt 5.3). Eine ordentliche Kündigung durch uns kündigen wir mindestens 30 Tage vorher per E-Mail an und begründen sie. Gründe für Einschränkung, Sperre oder Kündigung sind: Verstöße gegen Gesetz oder diese AGB, falsche Angaben bei der Registrierung oder zur Unternehmereigenschaft, Zahlungsverzug nach Punkt 19.6, wiederholte berechtigte Beschwerden der Kundschaft, Gefährdung von Kundschaft oder Plattform, behördliche oder gerichtliche Anordnungen, gesetzliche Pflichten (etwa Punkt 27.3), geschäftliche Gründe (etwa die Einstellung der Plattform oder eines Gebiets) und ein Hofkonto, das länger als 12 Monate nicht genutzt wurde. ', fett('Sofort kündigen'), ' dürfen wir, wenn ein Gesetz oder eine Behörde es verlangt, aus wichtigem Grund nach österreichischem Recht (etwa Betrug, Gesundheitsgefahr, schwerer Rechtsverstoß) oder bei wiederholten Verstößen gegen diese AGB; die Begründung erhältst du per E-Mail (Art. 4 Abs. 4 Verordnung (EU) 2019/1150).'),
          absatz('25.4', fett('Beschwerden:'), ' Beschwerden über Entscheidungen oder technische Probleme richtest du an ', fett(E_MAIL), ' oder über „Problem melden“. Wir antworten in angemessener Zeit, in der Regel binnen 14 Tagen, und begründen unsere Entscheidung. Als kleines Unternehmen sind wir zu einer eigenen Beschwerdestelle und zur Mediation nicht verpflichtet (Art. 11 Abs. 5 und Art. 12 Abs. 7 Verordnung (EU) 2019/1150); eine Mediation können wir im Einzelfall vereinbaren.'),
        ],
      },
      {
        nummer: 26,
        titel: 'Daten der Kundschaft, Datenschutz, Auftragsverarbeitung',
        bloecke: [
          absatz('26.1', `Für die Daten der Kundschaft, die du über ${MARKE} erhältst, bist du selbst Verantwortlicher im Sinne der DSGVO; ${MARKE} ist für den Betrieb der Plattform eigenständig verantwortlich. Du nutzt die Daten nur für die Abwicklung der Bestellung, für gesetzliche Pflichten und, bei Einwilligung, für Neuigkeiten, und löschst sie, sobald sie dafür nicht mehr nötig sind.`),
          absatz('26.2', `Vermutest du einen Datenschutzvorfall, der Daten aus ${MARKE} betrifft, sagst du uns sofort Bescheid, damit wir unsere Meldepflichten einhalten können.`),
          absatz('26.3', fett('Auftragsverarbeitung.'), ` Versendest du über ${MARKE} Neuigkeiten an Kundschaft, die sich dafür angemeldet hat, verarbeiten wir die Daten der Empfängerinnen und Empfänger in deinem Auftrag. Dafür gilt der Vertrag zur Auftragsverarbeitung in Anhang 3 (Art. 28 DSGVO).`),
        ],
      },
      {
        nummer: 27,
        titel: 'Steuern und Meldepflichten',
        bloecke: [
          absatz('27.1', `Die steuerliche Behandlung deiner Umsätze und der Plattformgebühr ist deine Sache; ${MARKE} gibt keine Steuerberatung.`),
          absatz('27.2', `${MARKE} ist nach dem Digitale Plattformen-Meldepflichtgesetz (DPMG, Umsetzung der Richtlinie „DAC 7“) verpflichtet, Angaben zu Anbietern und ihre Umsätze jährlich an das Finanzamt zu melden. Ausgenommen sind Anbieter mit weniger als 30 Verkäufen und höchstens 2 000 € Umsatz über die Plattform im Kalenderjahr. Du lieferst uns dafür die vorgeschriebenen Angaben (insbesondere Name, Anschrift, Steuernummer bzw. UID, bei natürlichen Personen das Geburtsdatum, bei Rechtsträgern die Firmenbuchnummer) und hältst sie aktuell. Welche Daten wir melden, sagen wir dir vor der ersten Meldung.`),
          absatz('27.3', 'Lieferst du die Angaben trotz zweier Erinnerungen nicht binnen 60 Tagen, müssen wir dein Hofkonto sperren oder deine Auszahlungen bzw. Gutschriften zurückhalten, soweit wir darauf Zugriff haben, bis sie vorliegen. Das verlangt das Gesetz.'),
        ],
      },
      {
        nummer: 28,
        titel: 'Käufe durch Unternehmen (Käuferart „Betrieb“)',
        bloecke: [
          absatz(null, `Kauft ein Unternehmen – etwa ein anderer Hof, ein Gasthaus oder ein Pferdebetrieb – über ${MARKE} ein, gelten die Punkte 8 bis 16 sinngemäß, aber `, fett('ohne die Verbraucherrechte'), ': kein Rücktrittsrecht nach FAGG, Gewährleistung nach UGB und ABGB zwischen Unternehmern, Untersuchungs- und Rügepflicht nach § 377 UGB. In der Kasse wählst du dafür „Betrieb“ als Käuferart und erklärst damit, als Unternehmer zu kaufen.'),
        ],
      },
      {
        nummer: 29,
        titel: 'Pausieren, Stilllegen, Kündigen, Konto schließen',
        bloecke: [
          absatz('29.1', 'Du kannst deinen Hof jederzeit ', fett('pausieren'), ' oder ', fett('stilllegen'), ' (deine Hofseite ist dann nicht sichtbar; offene Bestellungen erfüllst du noch) und wieder aktivieren.'),
          absatz('29.2', 'Den Tarif ', fett('Hofladen'), ' kannst du monatlich zum Monatsende kündigen; danach läuft dein Hof im Tarif Hoftor weiter.'),
          absatz('29.3', 'Dein ', fett('Hofkonto'), ' kannst du jederzeit kündigen (Anfrage über „Konto und Sicherheit“ oder per E-Mail). Die Kündigung wirkt mit Zugang. Offene Bestellungen und Erstattungen wickelst du noch ab; sobald keine mehr offen sind, schließen wir dein Konto: Deine Hofseite ist offline, die Anmeldung gesperrt, Abos sind beendet. Offene Beträge bleiben fällig, und dein SEPA-Lastschriftmandat gilt für die Schlussabrechnung weiter. 30 Tage lang kannst du das Konto wieder öffnen. Danach löschen wir Kontakt, Fotos und Texte deines Hofs oder machen sie unkenntlich.'),
          absatz('29.4', 'Bestellungen, Beträge und Abrechnungen bleiben gespeichert, solange Aufbewahrungspflichten gelten (insbesondere 7 Jahre nach § 132 BAO) oder sie zur Abwehr von Ansprüchen nötig sind. Alles Übrige löschen wir; Näheres in der ', link('Datenschutzerklärung', '/datenschutz'), '.'),
          absatz('29.5', 'Wir können den Nutzungsvertrag mit einem Hof mit einer Frist von 30 Tagen kündigen. Ohne Frist kündigen wir nur in den Fällen, in denen Punkt 25.3 eine sofortige Kündigung erlaubt. Stellen wir die Plattform ein, kündigen wir mindestens 30 Tage vorher an.'),
          absatz('29.6', fett('Fortgeltung.'), ' Nach dem Ende des Vertrags gelten die Punkte 18.11, 19, 21.3, 21.4, 26, 27, 29.4 und 30 weiter, solange daraus Ansprüche oder Pflichten entstehen können.'),
        ],
      },
    ],
  },
  {
    id: 'd',
    titel: 'Teil D – Für alle: Haftung, Änderungen, Streit',
    punkte: [
      {
        nummer: 30,
        titel: `Haftung von ${MARKE}`,
        bloecke: [
          absatz('30.1', `${MARKE} haftet unbeschränkt für Schäden an Leben, Körper oder Gesundheit, bei Vorsatz und krass grober Fahrlässigkeit, nach dem Produkthaftungsgesetz und soweit eine Haftung gesetzlich zwingend ist (etwa Art. 82 DSGVO).`),
          absatz('30.2', fett('Gegenüber Kundinnen und Kunden'), ' haften wir bei leichter Fahrlässigkeit nur für Schäden aus der Verletzung von Pflichten, deren Erfüllung die Nutzung der Plattform erst ermöglicht (wesentliche Pflichten), und nur für den vorhersehbaren, vertragstypischen Schaden. Im Übrigen ist die Haftung für leichte Fahrlässigkeit ausgeschlossen. Bei grober Fahrlässigkeit haften wir nach dem Gesetz. Punkt 30.1 bleibt unberührt.'),
          absatz('30.3', fett('Gegenüber Höfen'), ' ist die Haftung für leichte Fahrlässigkeit ausgeschlossen. Bei grober Fahrlässigkeit, die nicht krass grob ist, ersetzen wir keinen entgangenen Gewinn und keine mittelbaren Schäden, und unsere Haftung ist je Schadensfall auf die Plattformgebühren begrenzt, die in den 12 Monaten davor für Bestellungen bei deinem Hof angefallen sind, mindestens aber auf 500 €. Für Schäden aus Datenverlust haften wir nur, soweit du die Daten nicht zumutbar hättest sichern können (Punkt 7.3). Schadenersatzansprüche aus diesem Nutzungsvertrag verjähren für beide Seiten in 12 Monaten ab Kenntnis von Schaden und Schädiger, außer bei Vorsatz, krass grober Fahrlässigkeit und Schäden an Leben, Körper oder Gesundheit; Ansprüche auf Entgelte und nach den Punkten 18.11 und 21.3 verjähren nach dem Gesetz. Punkt 30.1 bleibt unberührt.'),
          absatz('30.4', `${MARKE} haftet nicht für Waren der Höfe, deren Beschreibung, Beschaffenheit oder Rechtmäßigkeit, für die Erfüllung von Kaufverträgen und für das Verhalten von Höfen oder Kundschaft. Für Inhalte, die Nutzerinnen und Nutzer einstellen, haften wir nur, wenn wir nach einem konkreten Hinweis auf einen Rechtsverstoß nicht unverzüglich handeln (§ 16 ECG, Art. 6 Verordnung (EU) 2022/2065). Die Punkte 30.1 bis 30.3 bleiben unberührt.`),
          absatz('30.5', 'Für Ausfälle und Störungen durch Ereignisse, die weder wir noch Personen, für die wir einzustehen haben, zu vertreten haben – etwa höhere Gewalt, großflächige Netz- oder Stromausfälle, Angriffe von außen trotz angemessener Schutzmaßnahmen –, haften wir nicht. Die Punkte 30.1 bis 30.3 bleiben unberührt.'),
        ],
      },
      {
        nummer: 31,
        titel: 'Datenschutz',
        bloecke: [
          absatz(null, 'Wie wir personenbezogene Daten verarbeiten, steht in der ', link('Datenschutzerklärung', '/datenschutz'), `. Höfe sind für die Daten ihrer Kundschaft, die sie über ${MARKE} erhalten, selbst Verantwortliche im Sinne der DSGVO (Punkt 26).`),
        ],
      },
      {
        nummer: 32,
        titel: 'Änderungen dieser AGB',
        bloecke: [
          absatz('32.1', 'Wir können diese AGB ändern, wenn sich das Gesetz, die Rechtsprechung, die Plattform oder unsere Kosten ändern oder eine Regelungslücke zu schließen ist.'),
          absatz('32.2', fett('Für Kundinnen und Kunden'), ' gilt für jede Bestellung die Fassung, die zum Zeitpunkt der Bestellung auf ', link('/agb', '/agb'), ' steht und die du mit der Bestellbestätigung erhältst. Eine Änderung wirkt nicht auf abgeschlossene Bestellungen zurück.'),
          absatz('32.3', fett('Für Höfe'), ' kündigen wir Änderungen mindestens ', fett('15 Tage'), ' vor dem Wirksamwerden über das Postfach und per E-Mail an (Art. 3 Abs. 2 Verordnung (EU) 2019/1150); bei Änderungen, die dich erheblich belasten (etwa an der Plattformgebühr oder an den Tarifen) oder die eine technische Anpassung von dir verlangen, mindestens 30 Tage. Du kannst bis zum Wirksamwerden kündigen (Punkt 29.3). Kündigst du nicht, gilt die neue Fassung ab dem Wirksamwerden; darauf und auf dein Kündigungsrecht weisen wir in der Ankündigung ausdrücklich hin. Stellst du in der Frist neue Produkte ein, verzichtest du damit auf den Rest der Frist; das gilt nicht für Änderungen an Plattformgebühr, Tarifen oder Abrechnung (Punkt 19.9) und nicht, wenn die Änderung eine technische Anpassung von dir verlangt. Kürzere Fristen gelten nur, wenn ein Gesetz oder eine Behörde die Änderung so verlangt, dass die Frist nicht eingehalten werden kann, oder wenn wir eine unvorhergesehene, unmittelbare Gefahr abwehren müssen (Betrug, Schadsoftware, Spam, Datenschutzverletzung, Sicherheitsrisiko; Art. 3 Abs. 4 Verordnung (EU) 2019/1150). Bestellungen, die vor dem Wirksamwerden eingegangen sind, bleiben von Änderungen unberührt.'),
          absatz('32.4', fett('Höfe, die schon vor dem ', INKRAFTTRETEN, ' dabei waren.'), ' Hast du einer früheren Fassung dieser AGB zugestimmt, kündigen wir dir diese Fassung über das Postfach und per E-Mail an. Sie gilt für dich ab dem ', INKRAFTTRETEN, ', frühestens aber 30 Tage nach dieser Ankündigung. Stimmst du ihr nach der Ankündigung in der App zu, verzichtest du damit auf den Rest dieser Frist. Bis dahin gelten für dich die bisherigen Bedingungen. Du kannst bis zum Inkrafttreten kündigen (Punkt 29.3).'),
        ],
      },
      {
        nummer: 33,
        titel: 'Streitbeilegung',
        bloecke: [
          absatz('33.1', 'Bei Problemen sprich uns zuerst an: ', fett(E_MAIL), ' oder „Problem melden“. Die meisten Fragen lösen wir so.'),
          absatz('33.2', fett('Verbraucherinnen und Verbraucher:'), ' Wir sind nicht verpflichtet, an Verfahren einer Verbraucherschlichtungsstelle teilzunehmen, und nehmen nicht teil (§ 19 AStG). Zuständig wären die ', fett('Internet Ombudsstelle'), ' (ombudsstelle.at) und die ', fett('Schlichtung für Verbrauchergeschäfte'), ' (verbraucherschlichtung.at). Beschwerden über einen Hof richtest du an den Hof. Höfe nehmen an einer Verbraucherschlichtung nicht teil, außer die Hofseite sagt etwas anderes.'),
          absatz('33.3', fett('Höfe:'), ' Streitigkeiten versuchen wir zuerst direkt zu klären (Punkt 25.4). Eine Mediation können beide Seiten vorschlagen; verpflichtet ist niemand.'),
        ],
      },
      {
        nummer: 34,
        titel: 'Anwendbares Recht, Gerichtsstand',
        bloecke: [
          absatz('34.1', 'Es gilt ', fett('österreichisches Recht'), ' unter Ausschluss des UN-Kaufrechts. Für Verbraucherinnen und Verbraucher mit gewöhnlichem Aufenthalt in einem anderen Staat gelten zusätzlich die zwingenden Verbraucherschutzvorschriften dieses Staates.'),
          absatz('34.2', `Für Klagen gegen Verbraucherinnen und Verbraucher gilt § 14 KSchG (Gericht am Wohnsitz oder Beschäftigungsort in Österreich). Für Streitigkeiten mit Höfen und anderen Unternehmern ist das sachlich zuständige Gericht am Sitz von ${MARKE} ausschließlich zuständig; wir dürfen auch am Sitz des Hofs klagen.`),
        ],
      },
      {
        nummer: 35,
        titel: 'Schluss',
        bloecke: [
          absatz('35.1', 'Ist eine Bestimmung dieser AGB unwirksam, bleiben die übrigen wirksam. Anstelle der unwirksamen Bestimmung gilt das Gesetz.'),
          absatz('35.2', `${MARKE} darf diesen Vertrag mit einem Hof samt allen Rechten und Pflichten auf einen Rechtsnachfolger übertragen, der die Plattform weiterführt; wir kündigen das 30 Tage vorher an, und du kannst zum Übergang kündigen.`),
          absatz('35.3', 'Diese AGB gibt es nur auf Deutsch. Du kannst sie auf ', link('/agb', '/agb'), ' jederzeit abrufen, speichern und ausdrucken (§ 11 ECG). Deine Zustimmung zu diesen AGB halten wir mit Zeitpunkt und Fassung fest.'),
        ],
      },
    ],
  },
]

const AGB_1_0_ANHAENGE: readonly AgbAnhang[] = [
  {
    anker: 'anhang-1',
    titel: 'Anhang 1: Rücktrittsbelehrung (Widerrufsbelehrung) für Verbraucherinnen und Verbraucher',
    bloecke: [
      hinweis(true, 'Dein Vertragspartner ist der Hof, bei dem du bestellt hast. In deiner Bestellbestätigung steht diese Belehrung mit Name, Anschrift, Telefonnummer und E-Mail-Adresse des Hofs ausgefüllt. Die Belehrung folgt dem gesetzlichen Muster (Anhang I Teil A FAGG) und ist deshalb in der Sie-Form gehalten.'),
      { art: 'belehrung' },
      hinweis(true, 'Ende des gesetzlichen Musters.'),
      hinweis(false, fett('Hinweise (kein Teil des Musters):'), ' Waren, die du am Hof abgeholt hast, kannst du dort auch zurückgeben; dann entstehen dir keine Rücksendekosten. Bei sperriger Ware, die nicht per Post zurückgehen kann (etwa Brennholz, Heu, Großgebinde), nennt dir der Hof die geschätzten Rücksendekosten beim Angebot, bevor du bestellst. Nennt er keine, trägst du keine Rücksendekosten. Kein Rücktrittsrecht besteht nach § 18 Abs. 1 FAGG insbesondere bei Waren, die schnell verderben können oder deren Ablaufdatum schnell überschritten würde (Z 4), bei versiegelten Waren, die aus Gründen des Gesundheitsschutzes oder der Hygiene nicht zur Rückgabe geeignet sind, wenn ihre Versiegelung nach der Lieferung entfernt wurde (Z 5), bei Waren, die nach deinen Angaben angefertigt oder eindeutig auf deine persönlichen Bedürfnisse zugeschnitten wurden (Z 3), und bei Waren, die nach der Übergabe untrennbar mit anderen Gütern vermischt wurden (Z 6). Welche Waren das bei deiner Bestellung sind, sagt dir der Hof; Beispiele stehen in Punkt 14.2.'),
    ],
  },
  {
    anker: 'anhang-2',
    titel: 'Anhang 2: Muster-Widerrufsformular',
    bloecke: [
      { art: 'formular' },
      hinweis(true, `Hinweis (kein Teil des Musters): Die Angaben des Hofs stehen in deiner Bestellung. Nenne am besten auch deine Bestellnummer. Du kannst das Formular auch an ${MARKE} schicken (`, E_MAIL, '); wir leiten es an den Hof weiter (Punkt 14.3).'),
    ],
  },
  {
    anker: 'anhang-3',
    titel: 'Anhang 3: Vertrag zur Auftragsverarbeitung (Art. 28 DSGVO) für Hof-Neuigkeiten',
    bloecke: [
      absatz('1.', fett('Parteien und Gegenstand.'), ` Der Hof (Verantwortlicher) beauftragt ${MARKE} (Auftragsverarbeiter), die Daten von Personen zu verarbeiten, die sich für Neuigkeiten des Hofs angemeldet haben, um diese Neuigkeiten im Namen des Hofs zu versenden, die Anmeldung und Abmeldung zu verwalten und den Nachweis der Einwilligung zu speichern. Dieser Anhang gilt, solange der Hof die Funktion „Neuigkeiten“ nutzt, und endet mit der Löschung der Daten nach Punkt 9.`),
      absatz('2.', fett('Datenarten und Betroffene.'), ' E-Mail-Adresse (und Telefonnummer, soweit Neuigkeiten über einen Nachrichtendienst gehen), Zeitpunkt und Nachweis der Anmeldung, Zustell- und Abmeldeinformationen; Betroffene sind Kundinnen und Kunden des Hofs, die sich angemeldet haben.'),
      absatz('3.', fett('Weisungen.'), ` ${MARKE} verarbeitet die Daten nur nach dokumentierter Weisung des Hofs, auch bei einer Übermittlung in ein Land außerhalb der EU bzw. des EWR – außer das Recht der EU oder Österreichs verpflichtet ${MARKE} zu einer Verarbeitung; dann sagt ${MARKE} das dem Hof vorher, soweit das Gesetz es nicht verbietet (Art. 28 Abs. 3 lit. a DSGVO). Weisungen gibt der Hof über die Funktionen der App (Neuigkeit anlegen, versenden, Abmeldungen einsehen). Hält ${MARKE} eine Weisung für rechtswidrig, sagt es dem Hof Bescheid und darf die Ausführung aussetzen. Für die Zulässigkeit des Versands (Einwilligung nach § 174 TKG 2021 und Art. 6 DSGVO) ist der Hof verantwortlich; die Anmeldung über ${MARKE} dokumentiert die Einwilligung.`),
      absatz('4.', fett('Vertraulichkeit.'), ` Personen, die bei ${MARKE} Zugriff haben, sind zur Vertraulichkeit verpflichtet.`),
      absatz('5.', fett('Sicherheit.'), ` ${MARKE} trifft angemessene technische und organisatorische Maßnahmen (Art. 32 DSGVO): verschlüsselte Übertragung und Speicherung, Zugriff nur für berechtigte Personen mit Mehrfaktor-Anmeldung, Protokollierung, regelmäßige Sicherungen, Trennung der Daten je Hof.`),
      absatz('6.', fett('Weitere Auftragsverarbeiter.'), ` Der Hof stimmt den in der Datenschutzerklärung genannten Dienstleistern für Hosting, Datenbank und E-Mail-Versand zu. ${MARKE} kündigt einen Wechsel oder eine Ergänzung mindestens 30 Tage vorher an; der Hof kann widersprechen und die Funktion dann nicht weiter nutzen. ${MARKE} verpflichtet weitere Auftragsverarbeiter vertraglich mindestens gleichwertig und haftet dem Hof für deren Pflichten wie für eigene (Art. 28 Abs. 4 DSGVO).`),
      absatz('7.', fett('Unterstützung.'), ` ${MARKE} unterstützt den Hof mit geeigneten Maßnahmen bei Anfragen Betroffener (Auskunft, Löschung, Widerspruch), bei der Sicherheit der Verarbeitung, bei Datenschutzvorfällen, bei einer Datenschutz-Folgenabschätzung und bei einer vorherigen Konsultation der Datenschutzbehörde (Art. 32 bis 36 DSGVO). Einen Datenschutzvorfall, der diese Daten betrifft, meldet ${MARKE} dem Hof unverzüglich, in der Regel binnen 48 Stunden nach Kenntnis.`),
      absatz('8.', fett('Nachweise.'), ` ${MARKE} stellt dem Hof auf Anfrage die Informationen bereit, die zum Nachweis der Pflichten nach Art. 28 DSGVO nötig sind, und ermöglicht Überprüfungen einschließlich Inspektionen durch den Hof oder einen von ihm beauftragten Prüfer in angemessenem Umfang nach Ankündigung; der Hof trägt dabei seine eigenen Kosten.`),
      absatz('9.', fett('Löschung.'), ` Endet die Nutzung der Funktion oder der Vertrag mit dem Hof, löscht ${MARKE} die Daten nach Punkt 1 nach Wahl des Hofs binnen 30 Tagen oder gibt sie ihm vorher heraus und löscht danach vorhandene Kopien, soweit kein Gesetz die Aufbewahrung verlangt.`),
      absatz('10.', fett('Ort der Verarbeitung.'), ' Die Verarbeitung erfolgt in der EU bzw. im EWR, soweit die Datenschutzerklärung für einen Dienstleister nichts anderes nennt. Eine Übermittlung in ein Drittland erfolgt nur mit geeigneten Garantien nach Kapitel V DSGVO.'),
      absatz('11.', fett('Haftung.'), ' Für dieses Verhältnis gilt Punkt 30; Art. 82 DSGVO bleibt unberührt.'),
    ],
  },
]

export const AGB_1_0: AgbFassungDaten = {
  kennung: '1.0',
  titel: AGB_1_0_TITEL,
  vermerk,
  kurzErklaert: AGB_1_0_KURZ_ERKLAERT,
  teile: AGB_1_0_TEILE,
  anhaenge: AGB_1_0_ANHAENGE,
}
