# Testovací plán obchodu

| Požadavek | Riziko | Důkaz |
|---|---|---|
| Platný katalog | Web zobrazuje neplatnou cenu nebo sklad | CAT-API-01 porovnává typy; CAT-UI-01 cenu z API a stránky |
| Jen kladné množství | Záporná/nulová objednávka mění sklad | ORD-API-01 očekává HTTP 400 a nula SQL řádků |
| Opakování stejného požadavku | Dvojí objednávka při opakování | ORD-API-02 kontroluje stejné ID, jeden SQL řádek a jeden odečet |
| Stejný klíč s jiným obsahem | Nová objednávka se tváří jako původní | Jednotková regrese očekává 409 a žádný další odečet |
| Cena a sklad odpovídají objednávce | Nesoulad finančních a skladových dat | ORD-DB-01 porovnává SQL stav před a po transakci |
| Sklad nesmí být přečerpán | Souběžní kupující získají stejný poslední kus | HTTP regrese odešle souběžně dvě objednávky všech osmi kusů; právě jedna vrátí 201, druhá 409, sklad zůstane 0 |
| Nákup přes web | Formulář ukáže úspěch bez odpovídající objednávky | ORD-UI-01 porovnává potvrzení, API a SQL |

`pnpm qa` ověřuje čistý běh i všechny čtyři vložené závady. CI se považuje za úspěšné, když kontrolní sada správně odhalí očekávané závady. Samotné červené políčko bez správného počtu a příčiny chyby nestačí. Chyba prohlížečového prostředí se posuzuje samostatně.

## Kontrakt místního obchodu

- `GET /api/store/products`: 200, objekt `products`, položky `id`, `title`, `priceCents` (kladné celé haléře), `stock` (nezáporné celé kusy).
- `POST /api/store/orders`: JSON `productId`, `quantity` (1–10), `email`, `idempotencyKey` (8–80 písmen/číslic/pomlček).
- 201: nová objednávka; 200: opakování stejného obsahu se stejným klíčem; 400: neplatný vstup; 404: produkt neexistuje; 409: nedostatek zásob nebo klíč použitý pro jiný obsah.
- Úspěšná odpověď obsahuje `order` s `id`, `productId`, `quantity`, `totalCents`, `email` a příznak `replayed`.
- Testovací parametr `run` je interní identifikátor izolované databáze vytvořené runnerem. Není přístupovým tokenem pro produkční systém.

Toto je dokumentovaný kontrakt fiktivní aplikace, nikoli tvrzení o pokrytí cizího e-shopu nebo produkční připravenosti.
