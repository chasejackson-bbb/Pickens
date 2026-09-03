"use client";

import { useState } from "react";
import { postJson } from "@/lib/fetcher";

export function AdminClient({
  initialPlayers,
  aliases,
}: {
  initialPlayers: Array<{ id: string; name: string; active: boolean; sortOrder: number }>;
  aliases: Array<{ id: string; alias: string; canonical: string }>;
}) {
  const [players, setPlayers] = useState(initialPlayers);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  async function addPlayer() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const p = await postJson("/api/players", { name: newName.trim(), sortOrder: players.length });
      setPlayers([...players, p]);
      setNewName("");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    const updated = await postJson("/api/players", { id, active: !active }, "PATCH");
    setPlayers(players.map((p) => (p.id === id ? updated : p)));
  }

  async function rename(id: string, name: string) {
    const updated = await postJson("/api/players", { id, name }, "PATCH");
    setPlayers(players.map((p) => (p.id === id ? updated : p)));
  }

  return (
    <div>
      <h1>Admin</h1>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Players</h3>
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          No login is required to play -- this just controls who shows up in the "acting as" picker
          and the standings. Deactivating a player keeps their history but hides them from new picks.
        </p>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id}>
                <td>
                  <input
                    defaultValue={p.name}
                    onBlur={(e) => e.target.value !== p.name && rename(p.id, e.target.value)}
                  />
                </td>
                <td>{p.active ? "Yes" : "No"}</td>
                <td>
                  <button className="secondary" onClick={() => toggleActive(p.id, p.active)}>
                    {p.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
          <input placeholder="New player name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button disabled={busy} onClick={addPlayer}>
            Add player
          </button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Team name aliases</h3>
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Maps informal names/nicknames to the 32 canonical NFL teams (used for the legacy import
          and for matching whatever naming convention The Odds API returns). Add new ones from The
          Odds API's "team-aliases" endpoint if a nickname ever comes up that isn't covered.
        </p>
        <table>
          <thead>
            <tr>
              <th>Alias</th>
              <th>Canonical team</th>
            </tr>
          </thead>
          <tbody>
            {aliases.map((a) => (
              <tr key={a.id}>
                <td>{a.alias}</td>
                <td>{a.canonical}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
