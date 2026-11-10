# Aktuální rozsah a kontrola 10. 11. 2026

Aktuální funkce, technologie, API, způsob použití, firemní zavedení a omezení jsou v [README](../README.md). Znovu prošlo 9 Node testů a odpovídající skutečný browser průchod desktop/mobil. Jde o fiktivní portfolio projekt. Výsledky a případné opravy jsou v [QA](QA.md).

Předchozí ověřený kód 1912f3c: [úspěšné GitHub Actions](https://github.com/OmegaCatt/releaseguard/actions/runs/42687352375). Nový commit této revize má vlastní CI; aktuální stav je v hlavním protokolu portfolia. Níže uvedené historické plány nejsou seznam nehotových funkcí.

<details>
<summary>Historická projektová rozhodnutí a průběžné etapy</summary>

# Etapa 9. 11. 2026

9 automatických testů prošlo včetně HTTP souběžného nákupu poslední zásoby a konfliktního idempotentního požadavku. Browser QA prošlo: čistý stav 7/7, duplicate 6/7, stock 5/7, validation 6/7, price 6/7; ověřeny screenshot, JUnit, Markdown report, obnovení historie, mobilní obchod a ruční nákup. V CI se připravuje složka qa-artifacts; upload používá actions/upload-artifact@v7 a sedmidenní retenci. Vzdálené spuštění nové verze dosud není ověřeno. Testovací plán a kontrakt jsou v docs/TEST_PLAN.md.

# Projektové rozhodnutí

ReleaseGuard doplňuje DataDesk, OfferLens, CompanyAtlas a Shop Ops Kit o samostatnou ukázku testování. Cílem je prokazatelně odhalit závady v API, SQL a webovém toku a vytvořit použitelný report chyby.

Zvolené hranice první verze: jediný fiktivní obchod, sedm deterministických kontrol, čtyři záměrné závady, místní server na loopbacku, historie na počítači uživatele. Každý test má vlastní databázi, aby byl výsledek reprodukovatelný. Žádné uživatelské účty, skutečná data, externí URL, placené API ani vzdálený běh prohlížeče.

Další možná rozšíření až po ověření jádra: porovnání dvou běhů, nové testy chybových toků a export JUnit pro CI. Rozšíření na testování libovolných webů by vyžadovalo samostatný bezpečnostní návrh kvůli SSRF a přístupu k místní síti.


</details>
