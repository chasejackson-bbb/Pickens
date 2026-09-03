"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewWeekForm({ seasons }: { seasons: Array<{ id: string; year: number }> }) {
  const router = useRouter();
  const [seasonId, setSeasonId] = useState(seasons[0]?.id ?? "");
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [weekNumber, setWeekNumber] = useState(1);
  const [label, setLabel] = useState("");
  const [isPostseason, setIsPostseason] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      let targetSeasonId = seasonId;
      if (targetSeasonId === "__new__") {
        const res = await fetch("/api/seasons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ year: newYear }),
        });
        const season = await res.json();
        if (!res.ok) throw new Error(season.error);
        targetSeasonId = season.id;
      }

      const res = await fetch("/api/weeks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seasonId: targetSeasonId,
          weekNumber,
          label: label || undefined,
          isPostseason,
        }),
      });
      const week = await res.json();
      if (!res.ok) throw new Error(week.error);
      router.push(`/weeks/${week.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
      <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
        {seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.year}
          </option>
        ))}
        <option value="__new__">+ New season…</option>
      </select>
      {seasonId === "__new__" && (
        <input
          type="number"
          value={newYear}
          onChange={(e) => setNewYear(Number(e.target.value))}
          style={{ width: "6rem" }}
        />
      )}
      <input
        type="number"
        value={weekNumber}
        onChange={(e) => setWeekNumber(Number(e.target.value))}
        style={{ width: "5rem" }}
        title="Week number"
      />
      <input
        placeholder="Label (optional, e.g. Postseason)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <label style={{ display: "flex", gap: "0.35rem", alignItems: "center", fontSize: "0.85rem" }}>
        <input type="checkbox" checked={isPostseason} onChange={(e) => setIsPostseason(e.target.checked)} />
        Postseason
      </label>
      <button onClick={submit} disabled={busy}>
        {busy ? "Creating…" : "Create week"}
      </button>
      {error && <span style={{ color: "var(--red)" }}>{error}</span>}
    </div>
  );
}
