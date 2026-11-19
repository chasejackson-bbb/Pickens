# Rule Conflicts: 2020 Charter vs. Spreadsheet

**The spreadsheet wins** wherever the two disagree. The "Value used" column is what `rules.config.ts` will hold.
Check each row against the updated charter when it arrives. Rows marked ❓ are open questions in
[`DATA_MAP.md` §8](./DATA_MAP.md#8-questions-for-you).

| # | Rule | 2020 charter | Spreadsheet (2026) | Evidence | Value used |
|---|---|---|---|---|---|
| 1 | Salary cap | $525 in 2020, +5% every Jan 15 (≈ $703 by 2026) | **$500**. "Yearly Cap Increase" is blank | `Commish Dashboard!Z21`, `League Info!I14`, `I17` | $500, flat ❓ |
| 2 | Raise: standard contracts | 20%/yr | **14%** | `Commish Dashboard!Z23`; all 87 Standard ADVANCE rows ×1.14 | 14% |
| 3 | Raise: drafted rookie contracts | 5%/yr | **14%** | 93 Rookie ADVANCE rows ×1.14; Jeanty $45 → $51.30 | 14% ❓ |
| 4 | Raise: player held on IR into next season | 5% | **14%**, no IR exception | Rollover preview treats IR players like everyone else | 14% ❓ |
| 5 | Raise: Extension contracts | (same as standard: 20%) | 14% | 69 Extension ADVANCE rows ×1.14 | 14% |
| 6 | Starting lineup | QB, 2 RB, 2 WR, 2 FLEX, TE, K, 2 IDP (11) | QB, 2 RB, 2 WR, TE, 2 FLEX, **1 Superflex**, **no K**, no DST, **DL + LB + DB** (12) | `Commish Dashboard!AG1:AH14` | Sheet lineup (informational) |
| 7 | Contract-year cap scope | Current + remaining years for every contract | **Active roster only** in the current season (IR and taxi excluded); future seasons add taxi | Team tab I4 vs L4 formulas | Current: Active only. Future: Active + taxi ❓ |
| 8 | Trade deadline | Thursday of Week 12 | "Kickoff of NFL Week 13 … finalized by kickoff of Week 14" | `League Info!B26:D26` | Week 13 kickoff ❓ |
| 9 | Trade freeze end | Jan 15 | **End of Week 17** (end of regular season) | `League Info!B28:D28` | End of Week 17 ❓ |
| 10 | Waiver-add extension cutoff | Added before ~Nov 25 | Added before the **trade deadline**; later adds get `Waiver NE` | `League Info!D26`; `PlayerDB` row 2 dropdown | Trade deadline ❓ |
| 11 | Off-season end (for dead-money timing) | Mid-August | Rookie Draft ~Aug 10, Auction ~Aug 24; "cuts after this date pay full year salary". Extensions due Monday 5 pm before kickoff | `League Info!B23:D25` | Configurable date, default Auction day ❓ |
| 12 | In-season dead money, next-year portion | % of next season's salary | `salary × 1.14 × pct(yearsLeft − 1)`. Next season's salary is the **escalated** salary. Same % table | Team tabs J69:J98; 5 verified `DropDeadMoneyProcessed` rows | Sheet formula (consistent with charter) |
| 13 | In-season dead money, current portion | Full current-season salary | Full **effective (prorated)** salary, so waiver adds owe only their prorated amount | Bourne $1 → $0.71; Minshew $9 → $4.76 | Effective salary |
| 14 | Mid-season taxi activation | Counts against the cap once activated | Counts at `H × (17 − weeksOnTaxi)/17` (prorated for weeks active) | `PlayerDB!S`; David Bailey 0.706 | Prorated |
| 15 | Proration basis | "by the week acquired" | 17 weeks: `H × (17 − week)/17` | `PlayerDB!L,O` | 17 weeks |
| 16 | Franchise tag cost | max(avg top-5 at position, 1.5 × previous salary) | max(avg top-5 at position **× 1.14**, 1.5 × current salary). Positions grouped DL = DE/DT/DL and DB = DB/S | `League Info!K12:N18` | Sheet formula |
| 17 | Traded cap dollars | Not in the 2020 charter | Teams trade current-season cap ("Salary Adjustments"); hits available cap for the current year only | Team tabs W25:Y41, `Rosters` row 3 | Current season only ❓ |
| 18 | Over-cap penalty | Must be under both caps | **$10 per day** over the cap after the extension deadline | `League Info!D25` | Informational |
| 19 | Rookie slot salaries | Charter table | R1: 45, 43, 38, 35, 31, 29, 24, 22, 20, 18, 17, 16. R2: 15×6, 13×6. R3: 10×6, 8×6. R4: 7×12. **4 rounds** (2020 had a 5th at $5) | `Rookie Draft` 2020–2026 | Sheet table. "Adjust rookie contract value lower starting in 2026" is still only a suggestion (`League Info!B32`) |
| 20 | Off-season cap enforcement | Caps lifted Jan 15 → mid-Aug | Labels say "Offseason Salary Cap / Contract Cap" | `Commish Dashboard!Y21:Y22` | Charter behaviour until confirmed ❓ |

## Rules that agree (charter = sheet)

- Contract-year cap = **80**
- Roster = **25 active, 10 taxi, 5 IR**
- Max contract length **5**. Drafted rookies get **3 years**
- Before-off-season dead-money table: **5→125%, 4→100%, 3→75%, 2→50%, 1→25%**, current season only
- In-season dead-money table for next season: **5→100%, 4→75%, 3→50%, 2→25%, 1→0%** (the sheet gets this by applying
  the same table at yearsLeft − 1)
- Taxi drops carry **no** dead money
- IR: pay for weeks played plus **25%** of weekly salary for weeks on IR (sheet: `H − 0.75 × weekly × weeksMissed`)
- An activated taxi player can **never** return to taxi (`PlayerDB!K`, Commish Dashboard alerts)
