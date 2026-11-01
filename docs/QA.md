# Ověření ReleaseGuard

## Kontrola dokumentace, 1. 11. 2026

README byl doplněn o postup použití, skutečně použité technologie a návrh firemního zavedení. Jde jen o dokumentaci; aplikace nadále testuje pouze svůj fiktivní obchod. Před zveřejněním změn znovu prošlo `node --test` (7/7) a `node scripts/qa.mjs` (zdravý běh 7/7, vložená závada ceny, screenshot, hlášení, historie, mobilní rozložení a ruční nákup). Tyto výsledky neprokazují pokrytí cizích aplikací ani úplnou bezchybnost.

Aktualizováno 31. 10. 2026. Místní Windows, Node.js 24.22.1, Playwright 1.62.1, Microsoft Edge.

## Automatické kontroly

- Po doplnění JUnit XML exportu a rozklikávacího technického přehledu prošlo `node --test` 7/7. Prohlížečová regrese skutečně stáhla XML s výsledkem 7 testů, 1 selháním a 0 chybami prostředí, otevřela technický přehled a znovu prošla zdravým i vadným scénářem. XML převádí selhání produktu na `failure` a chyby prostředí na `error`.

- `node --test`: 6/6 testů prošlo. Kontrolují přesnou cenu v haléřích, izolaci transakcí, idempotenci, validaci, vyprodání, skutečné rozdíly vložených závad, místní server, `Host`, `Origin`, chybný JSON a zákaz čtení zdrojového souboru přes HTTP.
- Prohlížečový průchod `node scripts/qa.mjs`: čistý běh 7/7, závada ceny 6/7, uložený screenshot a trace, stažené Markdown hlášení, načtení historie po obnovení stránky, mobilní šířka 390 px bez horizontálního přetečení, ruční nákup ve fiktivním obchodě.
- Ručně spuštěné zbývající závady: duplicitní objednávka 6/7, nesoulad skladu 5/7, chybějící validace 6/7. Všechny výsledky byly bez chyby prostředí.

## Přesnost a bezpečnostní hranice

Testy používají oddělené SQLite databáze. Porovnávají HTTP stavové kódy, viditelný text na webu i skutečné řádky a zásoby v SQL. Opakované volání se stejným klíčem musí vrátit původní objednávku. Webový test ceny porovnává viditelný text s číselnou hodnotou API; při odlišnosti vznikne screenshot a trace. Prohlížečové testy jsou skutečné a jejich dostupnost závisí na místní instalaci Playwright browseru nebo Edge.

Místní server je svázaný s loopbackem, používá seznam povolených statických cest, omezení JSON na 16 KB, kontrolu `Host`/`Origin` a nepřijímá cizí cílové URL. Všechny vstupy v rozhraní se zobrazují jako text. Nejde o produkční autentizaci ani komplexní bezpečnostní audit. Fiktivní nákup nepoužívá platbu nebo skutečné zákaznické záznamy.
