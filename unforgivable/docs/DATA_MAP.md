# Data Map: UNFORGIVABLE LEAGUE 2026 SPREADSHEET 1.0

Phase 0 discovery. Snapshot taken **2026-11-19** from sheet ID
`1SnXHm4OFNAHo5xmJ9R1t6Wu4fxHuqT_rXRkCG0f6oyo` (last modified 2026-11-19 08:38 UTC). I exported the workbook as .xlsx
and read both the cached values and the formulas.

> **Privacy:** `League Info` B4:F19 holds every GM's phone number and email. The app will **not** import that range.
> The discovery output is gitignored. Only GM first names and Sleeper usernames show up below.

---

## 1. Summary of what I found

1. **Joins use the Sleeper player ID.** `PlayerDB!A`, `Players!A`, `RosterState!A`, every `*Processed` tab, `Transaction Log!H`
   and `DraftDB!F` all carry it. The team tabs and `Rosters` only have player names, so I join those on name as a fallback
   and use them only for reconciliation.
2. **Sleeper roster ID 1–12 is the stable team key.** The workbook refers to teams in four different ways (details in §3).
3. **`PlayerDB` + `RosterState` are the live source of truth for contracts and roster status.** The team tabs are partly
   hand-maintained and run behind. Seven of 12 teams reconcile to the cent today. The other five differ only by stale or
   pending rows (§6).
4. **The sheet's rules differ from the 2020 charter in many places.** The biggest ones:
   - One **14% raise for every contract type** (the charter has 20% and 5%).
   - A **$500 cap** with no listed yearly increase (the charter has $525 + 5%/yr).
   - **Superflex with no kicker**.
   - **Cap dollars can be traded**.

   Full list in [`RULE_CONFLICTS.md`](./RULE_CONFLICTS.md).
5. **The commissioner's automation is in `TEST` mode** (`RosterState!B4`; `Transaction Log` column N = `Yes` on every row).
   The processed tabs are real but might get re-run.
6. **Every team tab has the same layout, `Hoss` included.** Its extra columns are empty in the export (§5).

---

## 2. Authoritative source per entity

| Entity | Authoritative tab | Notes |
|---|---|---|
| Player identity (name, pos, NFL team, age, exp, bye, injury) | `Players` (A:K, ~7.5k rows, Sleeper feed) | `PlayerDB` B:F just XLOOKUP into `Players` |
| Contract (salary, type, years) | `PlayerDB` H:J | Hand-entered by the commish. `TBD` = no contract (free agent) |
| Effective current-season salary (prorations) | `PlayerDB` O / S / AB | O = waiver-prorated, S = taxi-prorated, AB = IR-discounted (§4.1) |
| Owner | `PlayerDB!G` (formula from `Players!K`) | Most teams use the GM's preferred name. Mark and Mike & Aaron use their **Sleeper team name with a trailing space** (`"Kyler Island "`, `"Ultimate Price "`) |
| Roster status (Active / Taxi / IR / FA) | `RosterState!E` "Location" | Bot snapshot of Sleeper. Newest status, refreshed often (last 2026-11-19 02:34) |
| Taxi history ("ever activated") | `PlayerDB!K` ACTIVATED? | `No` = still taxi-eligible. `Yes` = can never go back to taxi |
| Team cap totals (what the league enforces) | Team tab H4:U6, `Rosters` row 2 | H4 = current salary, I4 = contract years, H5 = dead money, H6 = available cap |
| Dead money | Team tab "Dead Money Penalties" block (rows 66–98) | `DropDeadMoneyProcessed` is the audit log of drops that went through the bot |
| Traded cap ("Salary Adjustments") | Team tab W27:Y39, total Y40 | Not in the charter (§4.6) |
| Draft picks | `Draft Picks` A20:E (detailed list) | One row per pick: current owner, year, round, **original team**. No slot numbers for future picks |
| Rookie salary scale | `Rookie Draft` (2019–2026 boards, "Rookie Cost") | The scale has been the same every year since 2020 (§4.4) |
| Historical drafts | `DraftDB` (Sleeper-sourced, 2019–2026, rookie + auction, with roster ID) | `Auction Draft` / `Rookie Draft` are display copies |
| League settings | `Commish Dashboard` Y19:Z33 (`League Info` H12:I17 mirrors them) | Year 2026, cap $500, contract cap 80, raise 14%, 25 / 10 / 5 roster spots, 4 rookie rounds |
| Starting lineup requirements | `Commish Dashboard` AG1:AH14 | QB1, RB2, WR2, TE1, FLEX2, SF1, K0, DST0, DL1, LB1, DB1, IDP-flex 0 |
| Franchise tag values | `League Info` K12:N18 | Next-year tag by position, plus a 150% calculator |
| Next-season projection | `Annual Rollover Preview` | Row-level diffs the bot would apply on Jan 15 |
| Transaction history | `Transaction Log` (138 rows since 2026-10-15) + `*Processed` tabs | Phase-1 bot log. `Status` ∈ Detected / complete / failed |

---

## 3. Team identity crosswalk

The workbook names teams four different ways. The canonical key will be the **Sleeper roster ID**, taken from
`DraftDB!K` and matching the order of `RosterState!C` and the team tabs.

| Roster ID | Tab / preferred name (`PlayerDB!G`, `RosterState!D`) | Sleeper team name (`Rosters`, `Draft Picks`, `Commish Dashboard!Y`) | Sleeper username(s) seen (`DraftDB!J`, `Rookie Draft`, `League Info!C`) |
|---|---|---|---|
| 1 | Ben | BenKelley | BenKelley |
| 2 | Dan | Punt Team | dcstew |
| 3 | Vern | PNW Murder Hornets | VAndrus |
| 4 | Mark (`PlayerDB` says `Kyler Island `) | Kyler Island␠ | MarkGreen1, SVTMarkus, MarkkyG(?) |
| 5 | Paul | Jack's Smirking Revenge | pkibiger |
| 6 | **Tripod** (Blake, Jay, Chase) | The Tripod | bhelgerson (also JayDeNoma, Cjax99) |
| 7 | Brian | NorCal Kids | BrianCrofts |
| 8 | Rich | Wrecking Crewe | rroberge |
| 9 | Hoss | Turd&Dong | RyTyHos, TurdandDong |
| 10 | Geoff | The Sackos | GeoffShitShow, durrtay |
| 11 | Josh | JDWinningDaCrown | JDWinningDaCrown |
| 12 | Mike & Aaron (`PlayerDB` says `Ultimate Price `) | Ultimate Price␠ | GENOPHOBIA7, SwagDripper |

The importer will trim whitespace and map all four forms to the roster ID through an alias table in config. Historical
usernames from former owners (RachCity, CrisLorenzen, KrisElson) only appear in old draft boards. I'll keep them as text.

---

## 4. Column-by-column mapping

### 4.1 `PlayerDB` (header row 2, data from row 3; ~2,129 rows; ~608 rostered)

| Col | Header | → Model field | Notes |
|---|---|---|---|
| A | SLEEPER ID | `Player.sleeperId` (PK) | Number. No duplicates found |
| B | PLAYER | `Player.name` | XLOOKUP from `Players` |
| C | Exp | `Player.yearsExp` | 0 = rookie. Taxi eligibility uses it (rookies / 2nd-year) |
| D | TEAM | `Player.nflTeam` | |
| E | POS | `Player.position` | QB RB WR TE DE DT DL LB DB S CB … Tag grouping: DL = DE+DT+DL, DB = DB+S |
| F | AGE | `Player.age` | |
| G | OWNER | `Contract.teamId` via alias table | `Free Agent` or blank = unowned |
| H | SALARY | `Contract.baseSalary` | Full contract salary (unprorated). Number or `TBD` |
| I | CONTRACT | `Contract.type` | `Standard`, `Rookie`, `Extension`, `Franchise Tag`, `Waiver`, `TBD`. Row 2 AC:AI also lists `Waiver NE` (= waiver add after the deadline, **N**ot **E**xtendable); none are in use yet |
| J | YEARS LEFT | `Contract.yearsLeft` | **Includes the current season** (5 = this year + 4 more) |
| K | ACTIVATED? | `Contract.everActivated` | `Yes`/`No` (one `yes` lowercase) |
| L | WEEKLY PAY | derived = H/17 | **17-week** proration basis |
| M | WAIVER WIRE PICKUP? | `Contract.acquiredVia = 'waiver'` | |
| N | WEEKS ON WAIVERS | `Contract.waiverWeek` | Week of acquisition (weeks *not* owned) |
| O | DISCOUNTED SALARY | derived | `H × (17 − N) / 17` |
| P | TAXI CHECK | (Sleeper says on taxi) | |
| Q | PLACED ON TAXI | `Contract.onTaxi` (processed) | |
| R | WEEKS ON TAXI | `Contract.taxiWeeks` | Set when a taxi player is activated mid-season |
| S | DISCOUNTED SALARY | derived | `H × (17 − R) / 17`: pays only the weeks active |
| T / U / V | IR CHECK / PLACED ON IR? / BACK FROM IR? | `Contract.onIR` | |
| W | WEEKS MISSED | derived = (Y−X)+(AA−Z) | Up to two IR stints |
| X–AA | WEEK PLACED / RETURNED (×2) | `IrStint[]` | |
| AB | DISCOUNTED SALARY | derived | `H − 0.75 × (H/17) × W` |
| AC–AI | (row 1/2: dropdown lists) | ignore | |

**Effective current-season salary.** This is what the team tab shows and what counts against the cap:
`AB` if on IR (or has IR weeks) → else `S` if activated from taxi → else `O` if a waiver add → else `H`.
Calculating it this way reproduces the team-tab totals exactly for the 7 teams whose tabs are current.

### 4.2 `RosterState` (bot snapshot; metadata rows 1–4, header row 6, data from row 7)

Columns: Player ID, Name, Roster ID, Owner, **Location** (`Active` / `Taxi` / `IR` / `Free Agent`), then copies of the
PlayerDB fields (H, I, J, K, P, Q, R, T, U, X–AA) and Snapshot Time. Today's counts: 292 Active, 100 Taxi, 31 IR.
→ `Contract.rosterStatus`. Join on Player ID.

### 4.3 Team tabs (`Ben` … `Mike & Aaron`, identical layout)

| Range | Content |
|---|---|
| H3, J3, M3, P3, S3 | Season headers (2026–2030) |
| H4 / J4 / M4 / P4 / S4 | Total salary per season |
| I4 / L4 / O4 / R4 / U4 | Contract years per season |
| H5 / J5 | Dead money (current / next) |
| H6, J6, M6, P6, S6 | Available cap. Current year = `500 − H4 − H5 − Y40` (Y40 = traded-cap adjustments); later years skip Y40 |
| I6, L6 … | Contract-year space (80 − years) |
| H7 | Roster spots to fill = `35 − count(active + taxi)` |
| B17:U41 | **Active roster** (25 rows): name, NFL team, bye, age, pos, contract, then salary/years per season (projected with `×1.14`) |
| B45:J49 | **IR** (5 rows): H = IR-discounted salary, J = weeks missed |
| B54:U63 | **Taxi** (10 rows) |
| B64 | **Every tab has `Terrance Ferguson` here** (Ben's taxi rookie), outside every block. Looks like a leftover. Ignore it |
| B69:M98 | **Dead Money Penalties**: player, salary (G), current dead (H), years left (I), next-year dead (J), "Play in 2026?" (M) |
| W7:AB15 | Dead-money calculator + % table |
| W16:Y22 | Extension calculator (final salary × 1.14ⁿ) |
| W25:Y41 | **Salary Adjustments** (traded cap): description + amount, Y40 total, Y41 "traded cap gained" |

### 4.4 Other tabs

| Tab | Use | Mapping |
|---|---|---|
| `Draft Picks` A3:M15 | Count grid (team × 2027–2029 × round) | Display check only |
| `Draft Picks` A20:E | **Pick list** | `DraftPick{season=B, round=C, originalTeam=D, currentTeam=A}` (Sleeper team names) |
| `Rookie Draft` | 8 past boards: Round, Pick, Player, Team, Pos, Owner (username), Rookie Cost | Slot salary table: R1 45/43/38/35/31/29/24/22/20/18/17/16, R2 15×6 then 13×6, R3 10×6 then 8×6, R4 7×12 (2020 also had a R5 at 5) |
| `DraftDB` | Sleeper draft results 2019–2026 | Draft history on player detail |
| `Auction Draft` | Auction results 2021–2026 | Acquisition history |
| `Draft Contract Preview`, `DraftContractImports` | Bot import status | Not needed |
| `Annual Rollover Preview` | 468 rows: `CONTRACT ADVANCE` (249), `EXPIRE` (140), `SEASONAL RESET` (75), `CLEANUP` (3). "Current Value" / "Proposed Value" are pipe-joined `salary \| type \| years` | Phase 4 acceptance oracle. **Every ADVANCE row is exactly ×1.14, whatever the type** |
| `AnnualRolloverHistory` | Header only | — |
| `DropDeadMoneyProcessed` | 35 drops: player, owner, pre-drop location, result text (`Current $x; Next $y; Play 2026=Yes`), pre-drop JSON snapshot | Dead-money unit-test fixtures (§7) |
| `DropDeadMoneyReversals`, `DropDeadMoneyReviewStatus` | 2 reversals, 3 acknowledged | Exclude reversed events |
| `IRPlacementProcessed`, `IRRemovalProcessed`, `TaxiActivationProcessed`, `WaiverProcessed` | Bot audit logs | Player transaction history |
| `Transaction Log` | Event ID, Season, Week, Date, Type (Contract Change / Waiver Acquisition / Placed on IR / Drop / Removed from IR / Taxi Activation / Trade), Owner, Player, Player ID, From, To, Details, Status | Player detail → history |
| `Rosters` | Per-team columns: cap space (row 2), trade cap gained (row 3), ACTIVE / IR / TAXI / DRAFT PICKS blocks as display strings (`"5 yr STD $19.49"`) | Reconciliation only |
| `Commish Dashboard` | Alerts, current IR list (with expected return week), settings, team-name map, lineup requirements | Settings + team map |
| `League Info` | Settings mirror, franchise tag table, key dates, rule-change suggestions, **PII** (not imported) | Tag values, dates |

---

## 5. Team-tab layout consistency

All 12 tabs export at `A1:BJ100`, and the labels and formulas in the cells I checked (header, totals, the start of each
block) match `Tripod` exactly. `Hoss` is "narrower" (A1:AF100) only in the Sheets API's detected data range, because its
helper columns AG:AM are empty. The layout is the same, so one parser handles all 12.

Formula problems in the team tabs (they matter for future-season totals, not the current one):

- **2027 salary (J4)** sums active rows only (`J17:J41`), but **2027 years (L4)** also adds taxi (`L54:L63`). Taxi players'
  2027 salaries aren't counted.
- **2028 salary (M4)** adds `P54:P63`, which is the 2029 column for taxi players. It should probably be `M54:M63`. 2029 and
  2030 have similar offsets.
- **IR players drop out of every future season** (IR rows have no projection columns).
- **Current contract years (I4)** count Active rows only. IR and taxi years are excluded (`W45:W49` resolves to blank).
- **The franchise tag formula** in `League Info` reads `PlayerDB!H3:H114`. The cached values match the full table, so
  either the range is broader in the live sheet or the cache is stale. I'll compute it over all rows.

---

## 6. Reconciliation preview (current season, engine calculation vs team tab)

Engine = effective salary (§4.1) for players `RosterState` puts at Active or IR. Years = Active only.

| Team | Tab salary H4 | Engine | Tab years I4 | Engine | Explanation |
|---|---:|---:|---:|---:|---|
| Ben | 436.14 | 398.19 | 54 | 48 | Tab still lists **Justin Jefferson** ($37.48, 5 yrs, Extension). `PlayerDB` says FA / TBD. Also Nick Bolton (dropped 10/24) |
| Dan | 464.69 | 464.69 | 39 | 39 | ✓ |
| Mark | 520.43 | 520.43 | 47 | 49 | Salary matches. Years: Aidan Hutchinson's IR move is pending (Commish Dashboard "Players Added to IR") |
| Vern | 447.70 | 445.28 | 53 | 49 | Tab still has Byron Young (FA) and CJ Daniels |
| Tripod | 576.66 | 576.66 | 46 | 46 | ✓ |
| Paul | 280.19 | 281.88 | 49 | 51 | Jalen Pitre ($1.69, 2 yrs) is in `PlayerDB` but not on the tab |
| Brian | 474.12 | 474.12 | 32 | 32 | ✓ |
| Rich | 530.96 | 530.96 | 38 | 38 | ✓ |
| Hoss | 526.83 | 526.30 | 51 | 50 | Tab still has Xavier Watts (dropped) |
| Geoff | 374.54 | 374.54 | 40 | 40 | ✓ |
| Josh | 418.90 | 426.90 | 40 | 43 | Caleb Downs ($8, 3 yrs, Rookie) is in `PlayerDB` but not on the tab |
| Mike & Aaron | 545.13 | 545.13 | 39 | 39 | ✓ (available cap is **−$1.60**: over the cap) |

Per your spec, the app will display the tab numbers as official and put a warning on these five team pages.

---

## 7. Rules inferred from the sheet (verified against data)

| Rule | Sheet formula / evidence | Verified on |
|---|---|---|
| Annual raise | `× (1 + 'Commish Dashboard'!Z23)` = **1.14**, every contract type | All 249 ADVANCE rows in `Annual Rollover Preview` |
| Contract-year cap | 80, Active players only in the current season | Team tabs I4/I6 |
| Salary cap | $500 (`Z21`). "Yearly Cap Increase" is **blank** | Team tabs H6 |
| Waiver proration | `H × (17 − week) / 17` | Karlaftis $1 wk 7 → 0.588. Minshew $9 → dead $4.76 |
| Taxi activation proration | `H × (17 − weeksOnTaxi) / 17` | David Bailey $1, 5 wks → 0.706 |
| IR discount | `H − 0.75 × (H/17) × weeksMissed` | Lamar Jackson $79.69, 4 wks → 65.63. Jordan Mason $1.48, 5 wks → 1.154 |
| Dead money, cut before season ("Play in 2026?" = No) | current = `pct(yearsLeft) × salary`; no future hit. pct: 5→125%, 4→100%, 3→75%, 2→50%, 1→25% | Tripod: Jerome Ford 11.82 → 2.955 |
| Dead money, cut in season ("Yes") | current = full **effective** salary; next = `salary × 1.14 × pct(yearsLeft − 1)` | All 30 non-taxi rows of `DropDeadMoneyProcessed`, e.g. Isaiah Davis 1.14/2y → next 0.32; Nick Cross 1.30/3y → 0.74; Mitchell Evans 1.14/5y → 1.30; Moehrig 1.30/4y → 1.11 |
| Taxi drop | No dead money | 11 taxi drops |
| Franchise tag | max(avg of top-5 salaries at the position × 1.14, 1.5 × current salary) | `League Info` L13:N18 (QB 79.68, RB 111.46, WR 85.10, TE 43.17, DL 6.64, LB 14.95, DB 14.43) |
| Rookie contract | 3 years at the slot salary, then ×1.14/yr | 2026 picks show yrs=3. Jeanty (2025 1.01, $45) → $51.30 |
| Roster | 25 active / 10 taxi / 5 IR, 4 rookie rounds | `Commish Dashboard` Z29:Z33 |

---

## 8. Questions for you

**Data and joins**
1. **Justin Jefferson.** Ben's tab shows him on a 5-yr $37.48 Extension, but `PlayerDB` has him as a Free Agent with
   `TBD`. Was he cut (and should there be dead money), or is the `PlayerDB` row wrong? This is the largest
   reconciliation gap ($37.95).
2. When the team tab and `PlayerDB`/`RosterState` disagree, should the **planner start from `PlayerDB`** (newest per-player
   data), with the tab totals shown as the official current-season figure? That's my recommendation.
3. `RosterState` mode is **TEST** and `Transaction Log` is all test-mode. Can I treat those tabs as accurate history, or
   only as hints?

**Cap rules**
4. **Salary cap growth.** The sheet uses $500 with "Yearly Cap Increase" blank. For 2027–2030 projections, should the cap
   stay at **$500**, or grow by some rate?
5. **Traded cap ("Salary Adjustments", Y27:Y39).** Teams trade cap dollars (e.g. Tripod "CMC trade w/ Paul" −100 → +$100
   space). Questions:
   - Does it apply **only to the current season**? The formulas only use it for 2026.
   - Should the Trade Machine let you include cap dollars?
   - The league-wide total is **−$9**, not $0. Received: Tripod 100, Rich 59, Mark 55, M&A 50, Hoss 40 = 304. Paid:
     Paul 166, Geoff 59, Josh 40, Ben 15, Dan 15 = 295. Known discrepancy, or should I ignore it?
6. **Off-season caps.** The charter says caps lift Jan 15 – mid-August, but the sheet labels them "Offseason Salary Cap"
   and "Offseason Contract Cap". Are teams allowed over $500 / 80 during the off-season?
7. **Do IR players' years count** against the 80-year cap? The sheet excludes them in the current season.
8. **The $10/day fine** for being over the cap at the extension deadline (`League Info` D25). Should the app show it?

**Contracts**
9. **One 14% raise for everything.** The charter's 20% standard, 5% rookie and 5% IR-held raises are all replaced by 14% in
   the sheet. Can you confirm 14% applies to rookie contracts and to players held on IR?
10. **The extension salary formula.** The team-tab calculator projects `final salary × 1.14` for each added year. Is an
    extension just "keep escalating 14%/yr for N more years"? And what are the current extension limits (once for
    Standard, twice for Rookie, max 5 years total)?
11. **`Waiver NE`.** Does it mean "waiver add after the trade deadline, can't be extended"? `League Info` says waiver adds
    after the **trade deadline** can't be extended (the charter says ~Nov 25).
12. Should a **waiver extension be based on the full bid (H) or the prorated salary (O)**? The charter says full bid.
13. **Franchise tag eligibility.** Is it still "only after an Extension contract expires"? Lamar Jackson is the one current
    tag.

**Calendar**
14. **Trade deadline.** `League Info` says "Kickoff of NFL Week 13 … finalized by kickoff of the first game of Week 14", and
    trades **reopen at the end of Week 17** (end of the regular season), not Jan 15. What exact dates should the freeze use
    for 2026 and later?
15. **The off-season end date** for dead-money timing ("cut before/after"). Is it the Rookie Draft (~Aug 10), the Auction
    (~Aug 24), or the extension deadline (Monday before kickoff)?

**Rosters**
16. **The lineup is Superflex, with 0 K and 0 DST, and IDP is DL/LB/DB × 1** (the charter has QB, 2RB, 2WR, 2FLEX, TE, K, 2IDP).
    The planner only enforces roster counts (25 / 10 / 5). Do you also want positional depth warnings?
17. **Taxi eligibility.** Rookies and 2nd-year players (`Exp` ≤ 1) who have never been activated. Can Extension or Waiver
    contracts sit on taxi? Several do today (Schwesinger and Campbell are on 5-yr Extensions).

**Project setup**
18. **Repo location.** I put this project in `unforgivable/` inside the existing **Pickens** repo, on branch
    `claude/busy-edison-q303ci`, so it doesn't disturb the pick'em app. Would you rather have a separate repository? A
    separate Vercel project can point at the subfolder either way.
