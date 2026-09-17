"use client";

import { useMemo, useState } from "react";
import type { StatsPick } from "@/lib/statsData";
import {
  applyScopeFilters,
  filterByPlayer,
  computeSituationalCoverage,
  computeTeamCoverage,
  computeSpreadBucketCoverage,
  computeDraftPositionCoverage,
  computeMostPickedTeams,
  computeFavoriteUnderdogSplit,
  computeHomeAwaySplit,
  computeExtremeSpreads,
  computeStreak,
  computeHeadToHead,
  tally,
  coverPct,
  pushPct,
  decidedCount,
  type Tally,
} from "@/lib/stats";
import { NFL_TEAMS } from "@/lib/teams";
import { playerColor } from "@/lib/playerColors";
import { BarChart, LineChart } from "@/components/charts";

interface Player {
  id: string;
  name: string;
}

function fmtPct(v: number | null): string {
  return v === null ? "—" : `${v.toFixed(1)}%`;
}

/** "W-L" (plus a push count when there is one), used as the small caption under a rate. */
function wl(t: Tally): string {
  return t.push > 0 ? `${t.covered}-${t.noCover}-${t.push}P` : `${t.covered}-${t.noCover}`;
}

function playerBadgeStyle(name: string) {
  const c = playerColor(name);
  return { background: c.fill, color: c.ink, padding: "0.1rem 0.55rem", borderRadius: 999, fontWeight: 600 as const };
}

/** Every pair of players, restricted to pairs that include the focused player when one is set. */
function pairsFor(players: Player[], focusId: string | null): Array<[Player, Player]> {
  const pairs: Array<[Player, Player]> = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      if (focusId && players[i].id !== focusId && players[j].id !== focusId) continue;
      pairs.push([players[i], players[j]]);
    }
  }
  return pairs;
}

export function StatsBoard({ picks, seasons, players }: { picks: StatsPick[]; seasons: number[]; players: Player[] }) {
  const latestSeason = seasons[0] ?? new Date().getFullYear();
  const [allTime, setAllTime] = useState(false);
  const [seasonYear, setSeasonYear] = useState<number>(latestSeason);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [team, setTeam] = useState<string | null>(null);
  const [weekMinStr, setWeekMinStr] = useState("");
  const [weekMaxStr, setWeekMaxStr] = useState("");

  const weekMin = weekMinStr === "" ? null : Number(weekMinStr);
  const weekMax = weekMaxStr === "" ? null : Number(weekMaxStr);
  const seasonYears = allTime ? seasons : [seasonYear];

  const scopedPicks = useMemo(
    () => applyScopeFilters(picks, { seasonYears, team, weekMin, weekMax }),
    [picks, seasonYears, team, weekMin, weekMax]
  );
  // Head-to-head deliberately ignores the team filter -- see lib/stats.ts computeHeadToHead.
  const h2hPicks = useMemo(
    () => applyScopeFilters(picks, { seasonYears, team: null, weekMin, weekMax }),
    [picks, seasonYears, weekMin, weekMax]
  );
  const playerScopedPicks = useMemo(() => filterByPlayer(scopedPicks, playerId), [scopedPicks, playerId]);
  const playersToShow = playerId ? players.filter((p) => p.id === playerId) : players;

  if (seasons.length === 0) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>No stats yet</h2>
        <p className="muted">
          Spread-performance stats start from the 2026 season onward -- earlier imported seasons don&apos;t carry
          per-pick spread data. Once 2026 has some decided picks, they&apos;ll show up here.
        </p>
      </div>
    );
  }

  const situational = computeSituationalCoverage(scopedPicks);
  const situationalBars = [
    { label: "Home favorite", t: situational.home_favorite },
    { label: "Home underdog", t: situational.home_underdog },
    { label: "Away favorite", t: situational.away_favorite },
    { label: "Away underdog", t: situational.away_underdog },
  ];

  const teamCoverage = computeTeamCoverage(scopedPicks);
  const spreadBuckets = computeSpreadBucketCoverage(scopedPicks);
  const overallTally = tally(scopedPicks);
  const draftPositions = computeDraftPositionCoverage(playerScopedPicks);
  const h2hPairs = pairsFor(players, playerId);

  return (
    <div>
      <h1 style={{ marginBottom: "0.25rem" }}>Stats</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Spread performance and draft behavior -- separate from the season standings on the home page.
      </p>

      <div className="card">
        <div className="stats-filters">
          <div className="stats-filter">
            <label>Season</label>
            <div className="stats-toggle-group">
              <button className={!allTime ? "" : "secondary"} onClick={() => setAllTime(false)}>
                {seasonYear}
              </button>
              <button className={allTime ? "" : "secondary"} onClick={() => setAllTime(true)}>
                All-Time
              </button>
            </div>
          </div>
          {!allTime && seasons.length > 1 && (
            <div className="stats-filter">
              <label>Season year</label>
              <select value={seasonYear} onChange={(e) => setSeasonYear(Number(e.target.value))}>
                {seasons.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="stats-filter">
            <label>Player</label>
            <select value={playerId ?? ""} onChange={(e) => setPlayerId(e.target.value || null)}>
              <option value="">All players</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="stats-filter">
            <label>Team</label>
            <select value={team ?? ""} onChange={(e) => setTeam(e.target.value || null)}>
              <option value="">All teams</option>
              {NFL_TEAMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="stats-filter">
            <label>Week range</label>
            <div className="stats-filter-week-range">
              <input
                type="number"
                min={1}
                placeholder="From"
                value={weekMinStr}
                onChange={(e) => setWeekMinStr(e.target.value)}
              />
              <span className="muted">–</span>
              <input
                type="number"
                min={1}
                placeholder="To"
                value={weekMaxStr}
                onChange={(e) => setWeekMaxStr(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* --- Section A: league-wide spread performance -------------------------------------- */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>League-Wide Spread Performance</h3>
        <p className="muted" style={{ fontSize: "0.85rem", marginTop: "-0.5rem" }}>
          Always all three players combined -- the player filter only narrows the draft-behavior stats below.
        </p>

        <div className="stat-tile-grid" style={{ marginBottom: "1.5rem" }}>
          <div className="stat-tile">
            <div className="stat-tile-label">Picks in scope</div>
            <div className="stat-tile-value">{scopedPicks.length}</div>
            <div className="stat-tile-sub">{decidedCount(overallTally)} decided</div>
          </div>
          <div className="stat-tile">
            <div className="stat-tile-label">Overall cover %</div>
            <div className="stat-tile-value">{fmtPct(coverPct(overallTally))}</div>
            <div className="stat-tile-sub">{wl(overallTally)}</div>
          </div>
          <div className="stat-tile">
            <div className="stat-tile-label">Push rate</div>
            <div className="stat-tile-value">{fmtPct(pushPct(overallTally))}</div>
            <div className="stat-tile-sub">
              {overallTally.push} of {decidedCount(overallTally)} decided
            </div>
          </div>
        </div>

        <div className="stats-section-title">Cover % by situation</div>
        <BarChart data={situationalBars.map((s) => ({ label: s.label, value: coverPct(s.t), sublabel: wl(s.t) }))} />

        <div className="stats-section-title">Cover % by spread size</div>
        <BarChart
          data={[
            ...spreadBuckets.map((b) => ({
              label: `Favorite ${b.label}`,
              value: coverPct(b.favorite),
              sublabel: wl(b.favorite),
              color: "var(--green)",
            })),
            ...spreadBuckets.map((b) => ({
              label: `Underdog ${b.label}`,
              value: coverPct(b.underdog),
              sublabel: wl(b.underdog),
              color: "var(--amber)",
            })),
          ]}
        />

        <div className="stats-section-title">Per-team cover %</div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Team</th>
                <th>Picks</th>
                <th>Overall</th>
                <th>Home</th>
                <th>Away</th>
              </tr>
            </thead>
            <tbody>
              {teamCoverage.map((row) => (
                <tr key={row.team}>
                  <td>{row.team}</td>
                  <td>{row.overall.covered + row.overall.push + row.overall.noCover + row.overall.pending}</td>
                  <td>
                    {fmtPct(coverPct(row.overall))} <span className="muted">({wl(row.overall)})</span>
                  </td>
                  <td>{fmtPct(coverPct(row.home))}</td>
                  <td>{fmtPct(coverPct(row.away))}</td>
                </tr>
              ))}
              {teamCoverage.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    No picks in this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Section B: draft & player behavior --------------------------------------------- */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Draft &amp; Player Behavior</h3>

        <div className="stats-section-title">Cover % by draft position</div>
        <LineChart
          points={draftPositions.map((d) => ({
            x: d.position,
            label: `#${d.position}`,
            y: coverPct(d.tally),
            sublabel: wl(d.tally),
          }))}
        />

        <div className="stats-section-title">Favorite vs. underdog, home vs. away</div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Favorite</th>
                <th>Underdog</th>
                <th>Home</th>
                <th>Away</th>
              </tr>
            </thead>
            <tbody>
              {playersToShow.map((pl) => {
                const pPicks = filterByPlayer(scopedPicks, pl.id);
                const fd = computeFavoriteUnderdogSplit(pPicks);
                const ha = computeHomeAwaySplit(pPicks);
                return (
                  <tr key={pl.id}>
                    <td>
                      <span style={playerBadgeStyle(pl.name)}>{pl.name}</span>
                    </td>
                    <td>
                      {fmtPct(coverPct(fd.favorite))} <span className="muted">({wl(fd.favorite)})</span>
                    </td>
                    <td>
                      {fmtPct(coverPct(fd.underdog))} <span className="muted">({wl(fd.underdog)})</span>
                    </td>
                    <td>
                      {fmtPct(coverPct(ha.home))} <span className="muted">({wl(ha.home)})</span>
                    </td>
                    <td>
                      {fmtPct(coverPct(ha.away))} <span className="muted">({wl(ha.away)})</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="stats-section-title">Cover % by spread size, per player</div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Player</th>
                {spreadBuckets.map((b) => (
                  <th key={`fav-${b.label}`}>Fav {b.label}</th>
                ))}
                {spreadBuckets.map((b) => (
                  <th key={`dog-${b.label}`}>Dog {b.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {playersToShow.map((pl) => {
                const pBuckets = computeSpreadBucketCoverage(filterByPlayer(scopedPicks, pl.id));
                return (
                  <tr key={pl.id}>
                    <td>
                      <span style={playerBadgeStyle(pl.name)}>{pl.name}</span>
                    </td>
                    {pBuckets.map((b) => (
                      <td key={`fav-${pl.id}-${b.label}`}>{fmtPct(coverPct(b.favorite))}</td>
                    ))}
                    {pBuckets.map((b) => (
                      <td key={`dog-${pl.id}-${b.label}`}>{fmtPct(coverPct(b.underdog))}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="stats-section-title">Most-picked teams</div>
        <div className="stats-subgrid">
          {playersToShow.map((pl) => {
            const rows = computeMostPickedTeams(filterByPlayer(scopedPicks, pl.id)).slice(0, 6);
            return (
              <div key={pl.id} className="stat-tile">
                <div style={{ marginBottom: "0.5rem" }}>
                  <span style={playerBadgeStyle(pl.name)}>{pl.name}</span>
                </div>
                {rows.length === 0 ? (
                  <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                    No picks in this filter.
                  </p>
                ) : (
                  <table>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.team}>
                          <td>{r.team}</td>
                          <td>{r.count}x</td>
                          <td>{fmtPct(coverPct(r.tally))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>

        <div className="stats-section-title">Largest &amp; smallest spread picked</div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Largest spread</th>
                <th>Smallest spread</th>
              </tr>
            </thead>
            <tbody>
              {playersToShow.map((pl) => {
                const { largest, smallest } = computeExtremeSpreads(filterByPlayer(scopedPicks, pl.id));
                return (
                  <tr key={pl.id}>
                    <td>
                      <span style={playerBadgeStyle(pl.name)}>{pl.name}</span>
                    </td>
                    <td>
                      {largest ? (
                        <>
                          {largest.team} {largest.spread > 0 ? `+${largest.spread}` : largest.spread}{" "}
                          <span className="muted">
                            ({largest.seasonYear} wk {largest.weekNumber})
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {smallest ? (
                        <>
                          {smallest.team} {smallest.spread > 0 ? `+${smallest.spread}` : smallest.spread}{" "}
                          <span className="muted">
                            ({smallest.seasonYear} wk {smallest.weekNumber})
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="stats-section-title">Streaks (per pick, pushes/pending skipped)</div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Current streak</th>
                <th>Longest streak</th>
              </tr>
            </thead>
            <tbody>
              {playersToShow.map((pl) => {
                const { current, longest } = computeStreak(filterByPlayer(scopedPicks, pl.id));
                const fmtStreak = (s: { type: "covered" | "no_cover"; length: number } | null) =>
                  s ? (
                    <span className={`badge ${s.type}`}>
                      {s.length} {s.type === "covered" ? "cover" : "no-cover"}
                      {s.length === 1 ? "" : "s"}
                    </span>
                  ) : (
                    "—"
                  );
                return (
                  <tr key={pl.id}>
                    <td>
                      <span style={playerBadgeStyle(pl.name)}>{pl.name}</span>
                    </td>
                    <td>{fmtStreak(current)}</td>
                    <td>{fmtStreak(longest)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="stats-section-title">Head-to-head weekly record</div>
        <p className="muted" style={{ fontSize: "0.82rem", marginTop: "-0.5rem" }}>
          Real weekly point totals, weeks both players had picks -- not affected by the team filter.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Matchup</th>
                <th>Record</th>
                <th>Weeks compared</th>
              </tr>
            </thead>
            <tbody>
              {h2hPairs.map(([a, b]) => {
                const result = computeHeadToHead(h2hPicks, a.id, b.id);
                return (
                  <tr key={`${a.id}-${b.id}`}>
                    <td>
                      <span style={playerBadgeStyle(a.name)}>{a.name}</span> vs{" "}
                      <span style={playerBadgeStyle(b.name)}>{b.name}</span>
                    </td>
                    <td>
                      {result.aWins}-{result.bWins}
                      {result.ties > 0 ? `-${result.ties}` : ""}
                    </td>
                    <td>{result.weeksCounted}</td>
                  </tr>
                );
              })}
              {h2hPairs.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">
                    Not enough players in scope to compare.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
