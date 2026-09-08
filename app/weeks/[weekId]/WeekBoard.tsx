"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { fetcher, postJson } from "@/lib/fetcher";
import { getCurrentTurn, availableTeams } from "@/lib/draft";
import { NFL_TEAMS } from "@/lib/teams";
import { PlayerSelector } from "@/components/PlayerSelector";
import { useActivePlayer } from "@/lib/useActivePlayer";

type WeekResult = any; // shape mirrors lib/queries.ts#getWeekResult; kept loose to avoid duplicating server types on the client

export function WeekBoard({
  weekId,
  initial,
  players,
}: {
  weekId: string;
  initial: WeekResult;
  players: Array<{ id: string; name: string }>;
}) {
  const { data, mutate } = useSWR<WeekResult>(`/api/weeks/${weekId}`, fetcher, {
    fallbackData: initial,
    refreshInterval: 4000,
  });
  const router = useRouter();
  const { playerId } = useActivePlayer();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guessValue, setGuessValue] = useState("");
  const [windowFrom, setWindowFrom] = useState<string | null>(null);
  const [windowTo, setWindowTo] = useState<string | null>(null);

  if (!data) return <p>Loading…</p>;
  const { week, totals, winner } = data;
  const defaultWindow = getDefaultWeekWindow();
  const effectiveFrom = windowFrom ?? toLocalInputValue(week.windowStart) ?? defaultWindow.from;
  const effectiveTo = windowTo ?? toLocalInputValue(week.windowEnd) ?? defaultWindow.to;
  const playerById = new Map(players.map((p) => [p.id, p.name]));

  const weekTeams = [...new Set(week.games.flatMap((g: any) => [g.homeTeam, g.awayTeam]))] as string[];
  const pickedTeams = week.picks.map((p: any) => p.teamPicked);
  const pool = availableTeams(weekTeams, pickedTeams);
  const byeTeams = getByeTeams(weekTeams);

  const baseOrder: string[] = week.draftOrder ? JSON.parse(week.draftOrder.order) : [];
  const turn =
    week.status === "drafting" && week.picksPerPlayer
      ? getCurrentTurn(baseOrder, week.picks.length, week.picksPerPlayer)
      : null;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const myGuess = week.tiebreakerGuesses.find((g: any) => g.playerId === playerId);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <h1 style={{ marginBottom: 0 }}>
            {week.season.year} {week.label || `Week ${week.weekNumber}`}
          </h1>
          <span className="badge pending">{week.status}</span>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <PlayerSelector players={players} />
          {week.status !== "final" && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                if (!confirm("Delete this week and all its picks/games? This can't be undone."))
                  return;
                run(async () => {
                  await postJson(`/api/weeks/${weekId}`, {}, "DELETE");
                  router.push("/weeks");
                });
              }}
            >
              Delete week
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="card" style={{ borderColor: "var(--red)", color: "var(--red)" }}>
          {error}
        </div>
      )}

      {week.status === "upcoming" && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Setup</h3>
          <p className="muted">
            {week.games.length === 0
              ? "No games synced yet. Pull this week's spreads from The Odds API once lines are posted (usually 5-7 days before kickoff)."
              : `${week.games.length} games synced, ${weekTeams.length} teams in the pool (${byeTeams.length} on bye).`}
          </p>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            The Odds API doesn&apos;t know NFL week numbers -- it just returns every game with a
            posted line, which is often more than one week&apos;s worth. Set this week&apos;s
            kickoff window (defaults to the upcoming Thu-Tue) so the sync only pulls in{" "}
            <em>this</em> week&apos;s games.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.75rem" }}>
            <label style={{ fontSize: "0.85rem" }}>
              From
              <br />
              <input type="datetime-local" value={effectiveFrom} onChange={(e) => setWindowFrom(e.target.value)} />
            </label>
            <label style={{ fontSize: "0.85rem" }}>
              To
              <br />
              <input type="datetime-local" value={effectiveTo} onChange={(e) => setWindowTo(e.target.value)} />
            </label>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              disabled={busy}
              onClick={() =>
                run(() =>
                  postJson(`/api/weeks/${weekId}/sync-odds`, {
                    from: new Date(effectiveFrom).toISOString(),
                    to: new Date(effectiveTo).toISOString(),
                  })
                )
              }
            >
              Sync odds
            </button>
            {week.games.length > 0 && (
              <button
                disabled={busy}
                className="secondary"
                onClick={() => run(() => postJson(`/api/weeks/${weekId}/draft-order`, {}))}
              >
                Randomize draft order &amp; start draft
              </button>
            )}
          </div>
        </div>
      )}

      {week.status === "drafting" && (
        <>
          {turn ? (
            <div className="turn-banner">
              Pick {turn.overallPickNumber} (Round {turn.round}) — {playerById.get(turn.playerId) ?? "?"}&apos;s turn
            </div>
          ) : (
            <div className="turn-banner">Draft complete — waiting for games to kick off / finish.</div>
          )}
          <div className="card">
            <h3 style={{ marginTop: 0 }}>
              Matchups ({week.games.length}) — {pool.length} team{pool.length === 1 ? "" : "s"} left
            </h3>
            <table className="matchup-grid">
              <thead>
                <tr>
                  <th>Away Team</th>
                  <th>Spread</th>
                  <th>Home Team</th>
                  <th>Spread</th>
                </tr>
              </thead>
              <tbody>
                {week.games.map((g: any) => {
                  const canPick = !!turn && turn.playerId === playerId && !busy;
                  const awaySpread = g.homeSpread !== null ? -g.homeSpread : null;
                  const awayPicked = pickedTeams.includes(g.awayTeam);
                  const homePicked = pickedTeams.includes(g.homeTeam);
                  return (
                    <tr key={g.id}>
                      <MatchupTeamCell
                        team={g.awayTeam}
                        picked={awayPicked}
                        canPick={canPick}
                        onPick={() => run(() => postJson(`/api/weeks/${weekId}/pick`, { playerId, team: g.awayTeam }))}
                      />
                      <td className="matchup-spread">{formatSpread(awaySpread)}</td>
                      <MatchupTeamCell
                        team={g.homeTeam}
                        picked={homePicked}
                        canPick={canPick}
                        onPick={() => run(() => postJson(`/api/weeks/${weekId}/pick`, { playerId, team: g.homeTeam }))}
                      />
                      <td className="matchup-spread">{formatSpread(g.homeSpread)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {byeTeams.length > 0 && (
              <p className="muted" style={{ marginTop: "0.75rem", fontSize: "0.85rem" }}>
                Bye this week: {byeTeams.join(", ")}
              </p>
            )}
          </div>
        </>
      )}

      {(week.status === "in_progress" || week.status === "final") && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ marginTop: 0 }}>Games</h3>
            {week.status === "in_progress" && (
              <button disabled={busy} onClick={() => run(() => postJson(`/api/weeks/${weekId}/sync-scores`, {}))}>
                Sync scores
              </button>
            )}
          </div>
          <table>
            <thead>
              <tr>
                <th>Matchup</th>
                <th>Spread (home)</th>
                <th>Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {week.games.map((g: any) => (
                <tr key={g.id}>
                  <td>
                    {g.awayTeam} @ {g.homeTeam}
                  </td>
                  <td>{g.homeSpread ?? "—"}</td>
                  <td>
                    {g.finalHomeScore !== null ? `${g.finalAwayScore} - ${g.finalHomeScore}` : "—"}
                  </td>
                  <td>{g.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Picks</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Team</th>
              <th>Locked spread</th>
              <th>Result</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {week.picks.map((p: any) => (
              <tr key={p.id}>
                <td>{p.draftOrderPosition ?? "—"}</td>
                <td>{p.player.name}</td>
                <td>{p.teamPicked}</td>
                <td>{p.lockedSpread ?? "—"}</td>
                <td>
                  <span className={`badge ${p.result}`}>{p.result.replace("_", " ")}</span>
                  {p.manualOverride && <span className="muted"> (manual)</span>}
                </td>
                <td>{p.points ?? "—"}</td>
              </tr>
            ))}
            {week.picks.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No picks yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Weekly totals</h3>
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Points</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {totals
              .slice()
              .sort((a: any, b: any) => b.points - a.points)
              .map((t: any) => (
                <tr key={t.playerId}>
                  <td>{playerById.get(t.playerId) ?? "?"}</td>
                  <td>{t.points}</td>
                  <td>{winner.winnerIds.includes(t.playerId) && "🏆"}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {winner.tied && (
          <p className="muted">
            Tied {winner.tiebreakerApplied ? "— broken by tiebreaker above." : "— reveal the tiebreaker to break it."}
          </p>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>
          Tiebreaker — {week.tiebreakerConfig?.playerName ?? "George Pickens"} (
          {(week.tiebreakerConfig?.statType ?? "receiving_yards").replace("_", " ")})
        </h3>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="number"
            placeholder="Your guess"
            value={guessValue}
            onChange={(e) => setGuessValue(e.target.value)}
            style={{ width: "8rem" }}
          />
          <button
            disabled={busy || !playerId || guessValue === ""}
            onClick={() =>
              run(async () => {
                await postJson(`/api/weeks/${weekId}/tiebreaker`, { playerId, guessValue: Number(guessValue) });
                setGuessValue("");
              })
            }
          >
            {myGuess ? "Update guess" : "Submit guess"}
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              run(() => postJson(`/api/weeks/${weekId}/tiebreaker`, { reveal: true }, "PATCH"))
            }
          >
            Reveal all guesses
          </button>
        </div>
        <table style={{ marginTop: "0.75rem" }}>
          <thead>
            <tr>
              <th>Player</th>
              <th>Guess</th>
            </tr>
          </thead>
          <tbody>
            {week.tiebreakerGuesses.map((g: any) => (
              <tr key={g.id}>
                <td>{g.player.name}</td>
                <td>{g.revealed ? g.guessValue ?? "—" : "🔒 hidden"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getByeTeams(playingTeams: string[]) {
  if (playingTeams.length === 0) return [];
  const playing = new Set(playingTeams);
  return NFL_TEAMS.filter((t) => !playing.has(t));
}

// "YYYY-MM-DDTHH:mm" in local time, the format <input type="datetime-local"> needs.
function toLocalInputValue(date: string | Date | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Best-guess NFL week window: the upcoming Thursday through the following Tuesday, covering a
// standard Thu/Sun/Mon slate with room for MNF running past midnight. Just a starting point --
// the group adjusts it to match the actual week before syncing.
function getDefaultWeekWindow(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun, 4 = Thu
  const daysUntilThursday = (4 - day + 7) % 7;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + daysUntilThursday);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { from: toLocalInputValue(start)!, to: toLocalInputValue(end)! };
}

function formatSpread(spread: number | null) {
  if (spread === null) return "—";
  return spread > 0 ? `+${spread}` : `${spread}`;
}

function MatchupTeamCell({
  team,
  picked,
  canPick,
  onPick,
}: {
  team: string;
  picked: boolean;
  canPick: boolean;
  onPick: () => void;
}) {
  return (
    <td>
      <button
        disabled={picked || !canPick}
        onClick={onPick}
        className={`matchup-team-btn ${picked ? "picked" : ""} ${canPick && !picked ? "" : "secondary"}`}
      >
        {team}
      </button>
    </td>
  );
}
