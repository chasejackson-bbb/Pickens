# Pickens Pick'em

A weekly NFL against-the-spread draft pick'em for Blake, Jay, and Chase. Every week, the
group does a live snake draft picking NFL teams they think will cover the spread; picks are
scored automatically as games finish, and the app tracks weekly/season standings, an all-time
history going back to 2018, and who owes whom.

This replaces a manually-maintained Google Sheet used since 2019. That sheet's full history
(2018 postseason, 2019, 2022, 2024, 2025) has been imported -- see [Historical import](#historical-import).

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Prisma** + **SQLite** (swap `DATABASE_URL` for a Postgres URL to run hosted instead)
- **The Odds API** for weekly spreads and final scores
- No auth: one shared link, players pick their own name from a dropdown before acting (see
  [No login](#no-login-by-design))

## Getting started

```bash
npm install
cp .env.example .env      # then fill in ODDS_API_KEY (see below)
npm run db:migrate        # creates prisma/dev.db and applies the schema
npm run db:seed           # seeds Blake/Jay/Chase, the team-alias table, and default payout config
npm run import:legacy     # imports the full legacy spreadsheet history (idempotent, re-runnable)
npm run dev
```

Then open http://localhost:3000.

### The Odds API key

Live spreads and scores come from [The Odds API](https://the-odds-api.com/). Get a free key
there and set `ODDS_API_KEY` in your environment (never commit it). The app calls:

- `GET /v4/sports/americanfootball_nfl/odds` (`markets=spreads`) to pull the current slate of
  games and spreads when you click **Sync odds** on a week.
- `GET /v4/sports/americanfootball_nfl/scores` to pull final/live scores when you click
  **Sync scores**.

Both regular season and postseason games come from the same endpoint once the season is
underway -- there's no separate playoff endpoint to worry about. Lines typically post
5-7 days before kickoff, so a week's draft can't start until **Sync odds** returns games for
it; if it comes back empty, try again closer to game day.

Without a key set, any odds/scores call fails with a clear "add ODDS_API_KEY" error rather than
crashing. To exercise the whole draft → scoring flow without a real key (e.g. to demo it), set
`USE_MOCK_ODDS=1` -- this swaps in a small built-in fixture provider instead of calling the
real API.

### Deployment

No accounts/auth means hosting can be as light as you want:

- **Vercel/Netlify + hosted SQLite** (e.g. Turso) or a small **Postgres** (Neon, Supabase,
  Railway) -- just point `DATABASE_URL` at it and run `npm run db:deploy` (uses
  `prisma migrate deploy`, safe for production) instead of `db:migrate`.
- Set `ODDS_API_KEY` as a secret/environment variable on whatever platform you use -- never
  hardcode it.
- The draft board polls the server every 4 seconds (`useSWR` with `refreshInterval`) rather
  than using WebSockets/SSE, which is plenty for 3 people and needs no extra infrastructure.

## No login, by design

There's no accounts system. Anyone with the link can act as anyone -- the "acting as" dropdown
in the top-right of the draft board just remembers a chosen name in that browser's
`localStorage`. This is intentional (3 friends, trust-based) per the original brief; the server
still enforces turn order (only the player whose turn it is can submit the next pick), it just
doesn't verify *who's* sitting at the keyboard.

## Data model

See `prisma/schema.prisma` for the full model with inline comments. Highlights:

- `Player` — the roster. Add/rename/deactivate from **Admin** in the nav, or via
  `POST`/`PATCH /api/players` -- no code change needed.
- `Season` / `Week` — a `Week` has a `status` (`upcoming` → `drafting` → `in_progress` →
  `final`) and a `mechanic` (`ats` for normal cover/no-cover weeks; `bracket_wins` for the one
  legacy 2018-postseason week that scored differently -- see below).
- `Game` — one per matchup for a week, with the live spread (`homeSpread`, from the home
  team's perspective; the away team's is always `-homeSpread`) and final score.
- `Pick` — a player's team for a game, with the spread **locked at the moment of the pick**
  (this is what scoring uses, not whatever the line moves to afterward), the draft position it
  was made at, and its result. `gameId` and `lockedSpread` are nullable because most imported
  historical picks don't have that detail (see below).
- `TiebreakerGuess` / `TiebreakerConfig` — blind guesses for a player's stat (default: George
  Pickens' receiving yards), hidden from everyone (including the guesser) until any player hits
  **Reveal all guesses**. The target player/stat is editable per week for byes/injuries.
- `DraftOrder` — randomized at draft start, with a manual-override option.
- `Payout` / `PayoutConfig` — a simple ledger (owed/won/settled) plus a configurable pot
  structure. See [Payout structure](#payout-structure-needs-your-input).
- `TeamAlias` — maps every informal name/nickname/typo to one of the 32 canonical NFL teams.
  Seeded from `lib/teams.ts`, editable at runtime via `POST /api/team-aliases` without a
  redeploy.

### Picks-per-player rule

Default: `floor(available teams / active players)`, where "available teams" excludes anyone on
a bye that week. This is a plain function (`computePicksPerPlayer` in `lib/constants.ts`), not
a hardcoded number -- change the formula there if the group's rule changes. It's snapshotted
onto `Week.picksPerPlayer` when the draft order is set, so a mid-week roster change never
reshuffles an in-progress draft.

### Scoring

`lib/scoring.ts` is the whole rulebook: a pick's locked spread is compared against the actual
margin once its game is final --

- **Covered (1 pt):** margin beat the spread
- **Push (0.5 pt):** margin exactly matched the spread
- **Didn't cover (0 pt):** margin fell short

Auto-scored on **Sync scores**; a manual override (`POST /api/games/:id/override` for a bad
final score, or `POST /api/picks/:id/override` for a bad pick result) is always available for
a data-source error, and once a pick or game is manually overridden, future auto-syncs leave it
alone.

## Payout structure (needs your input)

The original spreadsheet never recorded dollar amounts -- only pick results -- **except** the
2019 sheets, which noted a **$20 weekly pot, winner-take-all, split evenly among co-winners on
a tie** (e.g. "Woodi 6.66 / Jay 6.66 / Chase 6.67"). That's what's seeded as the default
`PayoutConfig`. It does **not** account for a season pot or 2nd/3rd place payouts, even though
the sheet's "Stats" tab tracked 1st/2nd/3rd finishes every week (suggesting placement may have
mattered for something). **Confirm the real structure with the group** and edit it on the
**Payouts** page -- both a weekly pot and a season pot are supported, with either
winner-take-all or a configurable 1st/2nd/3rd split.

## Historical import

`npm run import:legacy` reads `data/historical/legacy-import.json` (parsed once from the
original workbook, see below) and seeds it into the database. It's idempotent -- safe to
re-run after fixing a team alias or a data issue.

**What's imported:** 2018 postseason, 2019 (regular season weeks 2-17 + the 2019-season
playoffs), 2022 (weeks 1-10, minus one week that was never played), 2024 (weeks 6-17, the only
weeks with pick-level detail in the sheet), 2025 (weeks 1-10, 12-18).

**What's deliberately excluded:**
- **Mike and Woodi's picks**, per instruction -- even in seasons where all 5 people played
  (2019, 2022), only Blake/Jay/Chase are imported. This means the app's recomputed weekly
  winners/placements for those years reflect only the 3 tracked players and will sometimes
  differ from the original sheet's "Stats" tab (which ranked all 5).
- **2020 and 2021** have no usable weekly data in the workbook and aren't imported, except the
  2019-season playoffs (the tab is confusingly named "Copy of 2020 Playoff Spread" because
  those games were *played* in Jan/Feb 2020) and the 2018-season playoffs (tab "Postseason").
- A handful of college-football rows embedded in the 2019 playoff sheet (a "National Title"
  tiebreaker-adjacent game) aren't NFL games and are skipped.

**Known data limitations, preserved rather than papered over:**
- The sheet never recorded the spread used for a historical pick, only the final result --
  so `lockedSpread` is `null` for nearly every imported pick. The one exception is the
  2019-season playoff sheet, which recorded real per-game spreads (e.g. "Texans -3"); those are
  imported with `lockedSpread` populated.
- No opponent/game data exists for historical regular-season picks, so `gameId` is `null` for
  all of them -- only the team and the result are known.
- The 2018 postseason sheet scored differently: 1 point per playoff game the picked team went
  on to win (not cover/no-cover). It's imported with `Week.mechanic = "bracket_wins"` so it's
  never accidentally averaged into ATS-style stats as if it were a normal week.
- A tiny number of historical picks have an out-of-spec result value in the source sheet
  (e.g. a single `2.0` where only `0`/`0.5`/`1` should appear) -- per the "import known results,
  don't recompute" instruction, these are kept as-is and flagged in the import script's console
  output for manual review.

**Validation:** every computed weekly point total was cross-checked against two independent
totals embedded in the original workbook -- the "Stats" tab (2024) and the "Summary" tab
(2025) -- and matched exactly for all weeks where those tabs had data. 2018's postseason total
also matched the sheet's own bracket total exactly. 2019 and 2022 don't have an independent
rollup in the workbook to cross-check against, so those rely on the parser alone (same parser,
same logic, validated elsewhere).

**"Buckaroos"?** Resolved to the **Tampa Bay Buccaneers**, not a Broncos joke. The 2025 sheets
include a "Remaining Teams" reference column listing all 32 team nicknames the league used;
every other entry in it maps 1:1 to a real team except "Buckaroos," which lines up with the one
otherwise-missing team (the Buccaneers). See the header comment in `lib/teams.ts` for the full
reasoning and the complete alias table.

To re-derive `legacy-import.json` from the original spreadsheet yourself (e.g. if the group
finds more history), the parsing logic and its cross-validation queries are described in detail
in this project's git history / PR description -- the short version is: each week is a sheet
with alternating (player name, points) column pairs, a `Total` row, and one or two tiebreaker
rows distinguished by whether they hold one value (the actual result) or several (guesses).

## Open items still worth a real decision

- **Payout amounts** -- see above, defaults are a best guess from thin evidence.
- **2020/2021** -- confirmed absent from the workbook; if the group has that data elsewhere, it
  can be imported the same way.
- **Odds API plan** -- the free tier comfortably covers a few draft nights + score syncs a week
  for 3 people; no need to pay unless usage patterns change.
