# Sign-off — dict-links-manager

External dictionary links are now user-manageable: Settings → Dictionary popup → Links tab (surface tabs mirror the popup toolbar: audio/image/translate/links). CRUD + drag/keyboard reorder + `{term}`/`{lang}` templates + http/https validation; edits are per-language-profile and the word popup renders the stored list (unsafe/malformed URLs dropped). Controls on this surface are 40px; popup toolbar stays 32px.

Verified: 4 npm gates green, 578 suites / 6905 unit tests, 13/13 real-Chrome checks (see verify review).

VERDICT: SIGN_OFF
