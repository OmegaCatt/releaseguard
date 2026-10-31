# Projektové rozhodnutí

ReleaseGuard doplňuje DataDesk, OfferLens, CompanyAtlas a Shop Ops Kit o samostatnou ukázku testování. Cílem je prokazatelně odhalit závady v API, SQL a webovém toku a vytvořit použitelný report chyby.

Zvolené hranice první verze: jediný fiktivní obchod, sedm deterministických kontrol, čtyři záměrné závady, místní server na loopbacku, historie na počítači uživatele. Každý test má vlastní databázi, aby byl výsledek reprodukovatelný. Žádné uživatelské účty, skutečná data, externí URL, placené API ani vzdálený běh prohlížeče.

Další možná rozšíření až po ověření jádra: porovnání dvou běhů, nové testy chybových toků a export JUnit pro CI. Rozšíření na testování libovolných webů by vyžadovalo samostatný bezpečnostní návrh kvůli SSRF a přístupu k místní síti.
