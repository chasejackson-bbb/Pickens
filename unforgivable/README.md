# Unforgivable League: Cap & Trade Planner

A private planner for The Tripod's three co-owners. It reads the league's Google Sheet (read-only) and supports lookups,
multi-year cap planning and trade modeling.

**Status: Phase 0 (data discovery) is done and awaiting review.** See:

- [`docs/DATA_MAP.md`](docs/DATA_MAP.md): tab-by-tab data map, joins, reconciliation preview, open questions
- [`docs/RULE_CONFLICTS.md`](docs/RULE_CONFLICTS.md): where the 2020 charter and the sheet disagree

## Discovery scripts

Both scripts are read-only. Their output contains league members' contact info, so it's written to gitignored folders.

```bash
# From an .xlsx export (File → Download → Microsoft Excel): values + formulas for every tab
pip install openpyxl
python3 scripts/discovery/dump_xlsx.py league.xlsx discovery-output
```

```bash
# Through the Sheets API with an OAuth access token (spreadsheets.readonly scope)
GOOGLE_ACCESS_TOKEN=ya29... node scripts/discovery/dump_sheets_api.mjs 15 discovery-output
```

Setup, Google OAuth, Supabase and Vercel instructions come in Phase 1.
