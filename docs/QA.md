# Ověření jednoduchého spuštění - 12. 11. 2026

README začíná návodem pro netechnického zájemce: stažení a rozbalení ZIP, otevření PowerShellu ve složce, přesný příkaz, adresa v prohlížeči a ukončení Ctrl+C. Vývojové testy jsou oddělené, volitelné AI/PDF požadavky popsané samostatně.

Ověřena nová kopie sledovaných zdrojů bez místních env souborů, uživatelských databází a předem instalovaného node_modules. Místní HTTP server vrátil 200 a správnou stránku aplikace. Pro zachování běžících služeb byla zvolena náhodná loopback adresa; hodnoty běžných portů v README odpovídají vstupním serverovým skriptům. ReleaseGuard doinstaloval runtime závislosti přes npm; CompanyAtlas použil nový Python venv a instalaci requirements.txt. Ostatní aplikace nepotřebují runtime balíčky pro základní ukázku.

Znovu prošlo **10 Node testů**. Běžné pracovní průchody mají samostatné prohlížečové regrese v tomto repozitáři. Toto ověření nenahrazuje kontrolu instalátoru Node/Python na každém počítači ani nepředstavuje obecnou záruku správnosti.

# Regrese UX-1b – rychlé zavření a reload

První Linux main CI odhalilo závod: potvrzení úvodu v události close se někdy nestihlo zapsat před reloadem. Nyní se zapisuje synchronně v Escape/cancel a tlačítkách před zavřením; close je záložní cesta. Původní neúspěšný běh zůstává v Actions. Browser test stále provádí okamžitý reload, očekávání nebylo oslabeno ani přidán čekací čas.

# UX-1 až UX-7 – 11. 11. 2026

Nová skutečná HTTP regrese vytvořila objednávku za 258 000 haléřů, načetla ji podle ID, ověřila sklad 6, zavřela server a znovu jej spustila se stejným souborem historie: objednávka již neexistovala a sklad se obnovil na 8. Browser samostatně prošel nákupní formulář.

Místně ověřené unit testy: **10 Node**.

Objednávky testovaného obchodu skutečně vznikají přes HTTP v paměťové SQLite databázi, mění sklad a dají se během běhu načíst přes GET /api/store/orders/:id. Po restartu serveru zmizí. Seznam, editace, expedice a trvalá evidence firemních objednávek nejsou implementované. Na disk se ukládá historie testovacích běhů a jejich protokoly, nikoli objednávky obchodu.

Všech sedm aplikací má první přístupný dialog a stálé ovládání nápovědy v hlavičce. Playwright ověřuje skutečný první vstup, obě části, GitHub odkaz, Tab/Shift+Tab, Escape, návrat fokusu, potvrzení po reloadu a mobil. CompanyAtlas čeká s přihlášením na zavření úvodu; hlavička se testuje po přihlášení. Legacy pracovní průchody pokračují po skutečném zavření úvodu. Aktuální commit, CI a přesný rozsah ověření této etapy jsou vedené v hlavním Portfolio_PROGRESS.md; starší zápisy níže jsou historické.

# Opakované ověření 10. 11. 2026

**9 Node testů prošlo.** Znovu spuštěné prohlížečové QA ověřilo skutečný pracovní postup na dočasných fiktivních podkladech, desktop i mobil a JavaScript chyby. Nová kontrola zopakovala běžné i připravené chybové toky. Původní počet testů zůstává beze změny.

Ověřený předchozí commit 1912f3c: [GitHub Actions](https://github.com/OmegaCatt/releaseguard/actions/runs/42687352375); dostupnost jeho artefaktů byla ověřena. Aktuální revize dokumentace/oprav je kontrolována novým CI. Jeho přesný commit a výsledek jsou v hlavním Portfolio_PROGRESS.md. Staré věty o čekající publikaci v rozbaleném archivu platily jen pro dobu daného zápisu.

<details>
<summary>Historické výsledky, původní metriky a omezení</summary>

## Ověřený vzdálený běh

GitHub Actions úspěšně ověřily kód `a57fa90`: [výsledek kontroly](https://github.com/OmegaCatt/releaseguard/actions/runs/42673166802). První pokus selhal na infrastruktuře GitHubu ještě před vytvořením jobu. Druhý pokus stejného commitu prošel; artefakt `releaseguard-qa-evidence` byl skutečně nahrán.

# Ověření 9. 11. 2026

9 automatických testů prošlo včetně HTTP souběžného nákupu poslední zásoby a konfliktního idempotentního požadavku. Browser QA prošlo: čistý stav 7/7, duplicate 6/7, stock 5/7, validation 6/7, price 6/7; ověřeny screenshot, JUnit, Markdown report, obnovení historie, mobilní obchod a ruční nákup. V CI se připravuje složka qa-artifacts; upload používá actions/upload-artifact@v7 a sedmidenní retenci. Druhý vzdálený pokus stejného kódu úspěšně prošel; viz odkaz v úvodu. Testovací plán a kontrakt jsou v docs/TEST_PLAN.md.

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


</details>
