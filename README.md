# CIO Toolkit Dashboard (v6)

18 PPIs from the Excel "CIO Toolkit Final PPIs", grouped by domain, with a detailed view behind each PPI. All numbers are sample data.

- `data/kpis.json` is generated from the Excel: `powershell -NoProfile -File tools\build-kpis.ps1 "<path to xlsx>"`. PPI names, domains and owners come from there. The script renames only three owners: "Finance / CIO office" and "CIO office" become "CIO Office", and "Cloud / FinOps lead" becomes "FinOps Lead".
- `data/sequence.json` sets the display order. `data/kpi-data.json` holds the sample numbers.
- `models.js` turns the numbers into the card value, status and detail blocks. `components/` draws them.
- Tests: serve this folder and open `tests/browser.html`, `tests/e2e.html`, `tests/overflow.html`; each prints PASS/FAIL.

For real use: replace `kpi-data.json` with real feeds, and put the page behind sign-in. Status labels (On track, Watch, At risk) are sample values set in `models.js`; real thresholds need to be agreed with the PPI owners.
