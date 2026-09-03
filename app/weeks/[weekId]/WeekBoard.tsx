"use client";

import { useState } from "react";
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
  const { playerId } = useActivePlayer();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guessValue, setGuessValue] = useState("");

  if (!data) return <p>Loading…</p>;
  const { week, totals, winner } = data;
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
        <PlayerSelector players={players} />
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
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button disabled={busy} onClick={() => run(() => postJson(`/api/weeks/${weekId}/sync-odds`, {}))}>
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
            <h3 style={{ marginTop: 0 }}>Available teams ({pool.length})</h3>
            <div className="team-pool">
              {pool.map((team) => {
                const canPick = !!turn && turn.playerId === playerId;
                return (
                  <button
                    key={team}
                    disabled={busy || !canPick}
                    className={canPick ? "" : "secondary"}
                    onClick={() =>
                      run(() => postJson(`/api/weeks/${weekId}/pick`, { playerId, team }))
                    }
                  >
                    {team}
                  </button>
                );
              })}
            </div>
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
