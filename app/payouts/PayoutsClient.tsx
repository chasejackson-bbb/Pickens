"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher, postJson } from "@/lib/fetcher";

export function PayoutsClient({
  seasons,
  players,
  initialPayouts,
  initialConfig,
}: {
  seasons: Array<{ id: string; year: number }>;
  players: Array<{ id: string; name: string }>;
  initialPayouts: any[];
  initialConfig: any;
}) {
  const { data: payouts, mutate } = useSWR<any[]>("/api/payouts", fetcher, { fallbackData: initialPayouts });
  const [config, setConfig] = useState(initialConfig);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [scope, setScope] = useState<"week" | "season">("season");
  const [playerId, setPlayerId] = useState(players[0]?.id ?? "");
  const [seasonId, setSeasonId] = useState(seasons[0]?.id ?? "");
  const [amountOwed, setAmountOwed] = useState(0);
  const [amountWon, setAmountWon] = useState(0);
  const [note, setNote] = useState("");

  async function saveConfig() {
    setBusy(true);
    setError(null);
    try {
      const updated = await postJson("/api/payouts/config", config, "PUT");
      setConfig(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function addEntry() {
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/payouts", {
        scope,
        playerId,
        seasonId: scope === "season" ? seasonId : undefined,
        amountOwed,
        amountWon,
        note: note || undefined,
      });
      setNote("");
      await mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setBusy(false);
    }
  }

  async function toggleSettled(id: string, settled: boolean) {
    await postJson("/api/payouts", { id, settled: !settled }, "PATCH");
    await mutate();
  }

  const net = new Map<string, number>();
  for (const p of players) net.set(p.id, 0);
  for (const entry of payouts ?? []) {
    net.set(entry.playerId, (net.get(entry.playerId) ?? 0) + entry.amountWon - entry.amountOwed);
  }

  return (
    <div>
      <h1>Payouts</h1>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Pot configuration</h3>
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          $15/week, $150 for the season-long pot. The season pot is decided by regular-season
          standings through the week below -- the postseason is a separate competition and isn&apos;t
          part of it.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <label>
            Weekly pot ($)
            <br />
            <input
              type="number"
              value={config.weeklyPotAmount}
              onChange={(e) => setConfig({ ...config, weeklyPotAmount: Number(e.target.value) })}
              style={{ width: "6rem" }}
            />
          </label>
          <label>
            Season pot ($)
            <br />
            <input
              type="number"
              value={config.seasonPotAmount}
              onChange={(e) => setConfig({ ...config, seasonPotAmount: Number(e.target.value) })}
              style={{ width: "6rem" }}
            />
          </label>
          <label>
            Season ends at week
            <br />
            <input
              type="number"
              value={config.seasonEndsAtWeek ?? 18}
              onChange={(e) => setConfig({ ...config, seasonEndsAtWeek: Number(e.target.value) })}
              style={{ width: "6rem" }}
            />
          </label>
          <label>
            Structure
            <br />
            <select value={config.structure} onChange={(e) => setConfig({ ...config, structure: e.target.value })}>
              <option value="winner_take_all">Winner take all</option>
              <option value="split_123">Split 1st/2nd/3rd</option>
            </select>
          </label>
          {config.structure === "split_123" && (
            <>
              <label>
                1st %
                <br />
                <input
                  type="number"
                  step="0.05"
                  value={config.splitFirst}
                  onChange={(e) => setConfig({ ...config, splitFirst: Number(e.target.value) })}
                  style={{ width: "5rem" }}
                />
              </label>
              <label>
                2nd %
                <br />
                <input
                  type="number"
                  step="0.05"
                  value={config.splitSecond}
                  onChange={(e) => setConfig({ ...config, splitSecond: Number(e.target.value) })}
                  style={{ width: "5rem" }}
                />
              </label>
              <label>
                3rd %
                <br />
                <input
                  type="number"
                  step="0.05"
                  value={config.splitThird}
                  onChange={(e) => setConfig({ ...config, splitThird: Number(e.target.value) })}
                  style={{ width: "5rem" }}
                />
              </label>
            </>
          )}
          <button disabled={busy} onClick={saveConfig}>
            Save
          </button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Running balance</h3>
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const n = net.get(p.id) ?? 0;
              return (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td style={{ color: n > 0 ? "var(--green)" : n < 0 ? "var(--red)" : undefined }}>
                    {n > 0 ? `+$${n}` : n < 0 ? `-$${Math.abs(n)}` : "$0"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Record a payout entry</h3>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <select value={scope} onChange={(e) => setScope(e.target.value as any)}>
            <option value="season">Season</option>
            <option value="week">Week</option>
          </select>
          <select value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {scope === "season" && (
            <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.year}
                </option>
              ))}
            </select>
          )}
          <input
            type="number"
            placeholder="Owed"
            value={amountOwed}
            onChange={(e) => setAmountOwed(Number(e.target.value))}
            style={{ width: "6rem" }}
          />
          <input
            type="number"
            placeholder="Won"
            value={amountWon}
            onChange={(e) => setAmountWon(Number(e.target.value))}
            style={{ width: "6rem" }}
          />
          <input placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
          <button disabled={busy} onClick={addEntry}>
            Add
          </button>
        </div>
        {error && <p style={{ color: "var(--red)" }}>{error}</p>}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Ledger</h3>
        <table>
          <thead>
            <tr>
              <th>Scope</th>
              <th>Player</th>
              <th>Owed</th>
              <th>Won</th>
              <th>Note</th>
              <th>Settled</th>
            </tr>
          </thead>
          <tbody>
            {(payouts ?? []).map((entry) => (
              <tr key={entry.id}>
                <td>{entry.scope === "season" ? entry.season?.year : entry.week?.label || entry.week?.weekNumber}</td>
                <td>{entry.player.name}</td>
                <td>${entry.amountOwed}</td>
                <td>${entry.amountWon}</td>
                <td className="muted">{entry.note}</td>
                <td>
                  <button className="secondary" onClick={() => toggleSettled(entry.id, entry.settled)}>
                    {entry.settled ? "✅ Settled" : "Mark settled"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
