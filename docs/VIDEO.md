# ReleaseGuard: video ukázka

**[Přehrát MP4 — 1:04, bez zvuku](https://raw.githubusercontent.com/OmegaCatt/releaseguard/main/docs/videos/releaseguard.mp4)** · [Soubor na GitHubu](https://github.com/OmegaCatt/releaseguard/blob/main/docs/videos/releaseguard.mp4)

Sedm úspěšných kontrol, vložená chyba ceny, detail a hlášení chyby.

## Co ve videu uvidíte

- Sedm úspěšných kontrol ukázkového e-shopu.
- Záměrně vložená chyba ceny a její zachycení skutečnou kontrolou.
- Detail s očekávanou/skutečnou cenou, screenshotem a staženým hlášením chyby.

Video zachycuje skutečnou aplikaci nad izolovanými fiktivními daty. Má rozlišení **1920 × 1080**, **25 snímků/s**, přibližně **3.1 MB** a české titulky přímo v obrazu. Pohyb myši i kliknutí jsou viditelné. **Neobsahuje zvukovou stopu.**

Ukázka nepotřebuje instalaci aplikace. Pro vlastní vyzkoušení pokračujte [návodem ke spuštění](../README.md#spuštění-krok-za-krokem-windows).

## Jak byl záznam ověřen

Při pořizování proběhl skutečný HTTP/browser scénář s kontrolami výsledků. AI API nebylo volané. Ověřeno celé dekódování výsledného MP4, H.264/yuv420p, rozlišení, absence audio stopy, samostatné přehrání/posun a obrazové snímky titulkových úseků a kliknutí. Jde o ověření konkrétní ukázky; záznam neměří obecnou přesnost AI ani produkční připravenost aplikace.

[Metadata záznamu](videos/releaseguard-recording.json) obsahují kontrolované výsledky, zdrojový commit `d7f8f61e04fb8b7dbf57ee0e77469db81e66b81c` a otisky nahrávacích skriptů. SHA-256 MP4: `909252b2254868c3ff1b57c2324d9a7b038c59f6088400f16b17b5c7dfc6fc96`. Časy kroků v metadatech jsou orientační; titulky jsou přímo v obrazu.

Scénář: [scripts/record-demo.mjs](../scripts/record-demo.mjs). Nahrávací vrstva: [scripts/recording.mjs](../scripts/recording.mjs). Při vývojovém zopakování je potřeba Playwright a plný FFmpeg s libx264 (`PORTFOLIO_FFMPEG`); běžné přehrání videa je nevyžaduje.

## English

**[Watch the silent Full HD demo (1:04)](https://raw.githubusercontent.com/OmegaCatt/releaseguard/main/docs/videos/releaseguard.mp4).** Czech captions are burned into the image; the pointer and actual clicks are visible. Recorded from the real application using isolated fictional data, with result assertions and no AI API calls. Full decoding, playback, seeking and absence of audio were verified. [Run the application locally](../README.md#spuštění-krok-za-krokem-windows).
