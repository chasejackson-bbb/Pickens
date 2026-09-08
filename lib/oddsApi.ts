import { normalizeTeam } from "./teams";

// The Odds API (https://the-odds-api.com/). Two endpoints cover everything this app needs:
//   - GET /v4/sports/americanfootball_nfl/odds  -> upcoming/live games + spread markets
//   - GET /v4/sports/americanfootball_nfl/scores -> live + recently completed final scores
// Both regular season and postseason games come back from the same sport key
// ("americanfootball_nfl") once the season is underway; there's no separate playoff endpoint.
//
// Lines typically post 5-7 days out for the upcoming week (early in the week after MNF), so a
// week's draft can't start until this returns non-empty data for it -- check before scheduling
// a draft night.

const BASE_URL = "https://api.the-odds-api.com/v4/sports/americanfootball_nfl";

export interface OddsApiEvent {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: Array<{
    key: string;
    markets: Array<{
      key: string;
      outcomes: Array<{ name: string; point?: number; price?: number }>;
    }>;
  }>;
}

export interface OddsApiScoreEvent {
  id: string;
  commence_time: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores?: Array<{ name: string; score: string }> | null;
}

export interface NormalizedGame {
  oddsApiEventId: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  homeSpread: number | null;
}

export interface NormalizedScore {
  oddsApiEventId: string;
  homeTeam: string;
  awayTeam: string;
  completed: boolean;
  finalHomeScore: number | null;
  finalAwayScore: number | null;
}

export class OddsApiConfigError extends Error {}

function requireApiKey(): string {
  const key = process.env.ODDS_API_KEY;
  if (!key) {
    throw new OddsApiConfigError(
      "ODDS_API_KEY is not set. Get a free key at https://the-odds-api.com/ and add it to your environment (see .env.example)."
    );
  }
  return key;
}

function averageHomeSpread(event: OddsApiEvent): number | null {
  const points: number[] = [];
  for (const bm of event.bookmakers ?? []) {
    const market = bm.markets.find((m) => m.key === "spreads");
    if (!market) continue;
    const homeOutcome = market.outcomes.find((o) => o.name === event.home_team);
    if (homeOutcome?.point !== undefined) points.push(homeOutcome.point);
  }
  if (points.length === 0) return null;
  const avg = points.reduce((a, b) => a + b, 0) / points.length;
  return Math.round(avg * 2) / 2; // snap to nearest half-point, matching standard spread ticks
}

export interface WeekWindow {
  from: string; // ISO 8601
  to: string; // ISO 8601
}

// The Odds API requires exactly YYYY-MM-DDTHH:MM:SSZ for commenceTimeFrom/To -- no fractional
// seconds -- and rejects the .SSSZ milliseconds that Date#toISOString() (and therefore any
// ordinary ISO string built from a JS Date) always includes.
function toOddsApiTimestamp(iso: string): string {
  return new Date(iso).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Pull spreads for games kicking off within [window.from, window.to]. A window is required --
 * The Odds API's /odds endpoint has no "week number" concept, it just returns every game with
 * a posted line (often more than one week's worth at once), so without a kickoff window a sync
 * pulls in extra games from adjacent weeks. The Odds API supports this natively via
 * commenceTimeFrom/commenceTimeTo query params.
 */
export async function fetchWeekSpreads(window: WeekWindow): Promise<NormalizedGame[]> {
  if (process.env.USE_MOCK_ODDS === "1") return mockSpreads(window);
  const key = requireApiKey();
  const params = new URLSearchParams({
    apiKey: key,
    regions: "us",
    markets: "spreads",
    oddsFormat: "american",
    dateFormat: "iso",
    commenceTimeFrom: toOddsApiTimestamp(window.from),
    commenceTimeTo: toOddsApiTimestamp(window.to),
  });
  const url = `${BASE_URL}/odds?${params.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`The Odds API request failed (${res.status}): ${await res.text()}`);
  }
  const events: OddsApiEvent[] = await res.json();
  return events.map((e) => ({
    oddsApiEventId: e.id,
    homeTeam: normalizeTeam(e.home_team) ?? e.home_team,
    awayTeam: normalizeTeam(e.away_team) ?? e.away_team,
    kickoff: e.commence_time,
    homeSpread: averageHomeSpread(e),
  }));
}

export async function fetchScores(daysFrom = 3): Promise<NormalizedScore[]> {
  if (process.env.USE_MOCK_ODDS === "1") return mockScores();
  const key = requireApiKey();
  const url = `${BASE_URL}/scores?apiKey=${key}&daysFrom=${daysFrom}&dateFormat=iso`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`The Odds API scores request failed (${res.status}): ${await res.text()}`);
  }
  const events: OddsApiScoreEvent[] = await res.json();
  return events.map((e) => {
    const homeTeam = normalizeTeam(e.home_team) ?? e.home_team;
    const awayTeam = normalizeTeam(e.away_team) ?? e.away_team;
    const homeScore = e.scores?.find((s) => s.name === e.home_team)?.score;
    const awayScore = e.scores?.find((s) => s.name === e.away_team)?.score;
    return {
      oddsApiEventId: e.id,
      homeTeam,
      awayTeam,
      completed: e.completed,
      finalHomeScore: homeScore !== undefined ? Number(homeScore) : null,
      finalAwayScore: awayScore !== undefined ? Number(awayScore) : null,
    };
  });
}

// --- Mock provider ------------------------------------------------------------
// Lets the whole draft/scoring flow be exercised end-to-end without a live API key.
// Enable with USE_MOCK_ODDS=1.

function mockSpreads(window?: WeekWindow): NormalizedGame[] {
  // Anchor kickoffs to the requested window (not real "now") so a mock sync actually returns
  // games for whatever week is being tested. Event IDs stay simple/stable ("mock-0".."mock-5")
  // rather than window-derived, so mockScores() (which has no window to work from -- it mimics
  // the real API's "all recent scores" response) still matches them up correctly; this is a
  // local demo fixture, not production data, so reuse across separate test weeks is harmless.
  const anchor = window ? new Date(window.from).getTime() : Date.now();
  const pairs: Array<[string, string, number]> = [
    ["Kansas City Chiefs", "Baltimore Ravens", -2.5],
    ["Philadelphia Eagles", "Dallas Cowboys", -3],
    ["Buffalo Bills", "Miami Dolphins", -6.5],
    ["San Francisco 49ers", "Seattle Seahawks", -4],
    ["Detroit Lions", "Green Bay Packers", -1.5],
    ["New York Jets", "New England Patriots", -3.5],
  ];
  const games = pairs.map(([home, away, homeSpread], i) => ({
    oddsApiEventId: `mock-${i}`,
    homeTeam: home,
    awayTeam: away,
    kickoff: new Date(anchor + (i + 1) * 6 * 60 * 60 * 1000).toISOString(),
    homeSpread,
  }));
  if (!window) return games;
  const from = new Date(window.from).getTime();
  const to = new Date(window.to).getTime();
  return games.filter((g) => {
    const t = new Date(g.kickoff).getTime();
    return t >= from && t <= to;
  });
}

function mockScores(): NormalizedScore[] {
  const spreads = mockSpreads();
  return spreads.map((g, i) => ({
    oddsApiEventId: g.oddsApiEventId,
    homeTeam: g.homeTeam,
    awayTeam: g.awayTeam,
    completed: true,
    finalHomeScore: 20 + i,
    finalAwayScore: 17 + i,
  }));
}
