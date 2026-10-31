# ReleaseGuard project instructions

Use fictional data only. Keep the local server bound to loopback. Do not accept arbitrary test URLs, execute uploaded code, or add external credentials. Preserve the distinction between product failures and browser/environment errors. Each test case must use an isolated SQLite store; injected faults should be detectable through HTTP, SQL, or visible browser behavior rather than hardcoded result cards.

Before publishing changes, run `node --test` and `node scripts/qa.mjs`. Update `docs/QA.md` with observed results and limitations. Never claim universal correctness from a passing suite. Keep the UI plain, accessible, and free of AI-themed decoration.
