"use client";

import { useActivePlayer } from "@/lib/useActivePlayer";

export function PlayerSelector({ players }: { players: Array<{ id: string; name: string }> }) {
  const { playerId, setPlayerId } = useActivePlayer();
  return (
    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
      <span className="muted" style={{ fontSize: "0.85rem" }}>
        Acting as:
      </span>
      <select value={playerId ?? ""} onChange={(e) => setPlayerId(e.target.value)}>
        <option value="" disabled>
          Select your name…
        </option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
