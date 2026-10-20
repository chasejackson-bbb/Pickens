import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSeasonStandings, getPostseasonStandings, getWeeklyStandings, type WeeklyStandingRow } from "@/lib/queries";
import { playerColor } from "@/lib/playerColors";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: { season?: string } }) {
  const seasons = await prisma.season.findMany({ orderBy: { year: "desc" } });
  if (seasons.length === 0) {
    return (
      <div className="card">
        <h2>No seasons yet</h2>
        <p className="muted">Create a season and a week to get started, or run the legacy import.</p>
      </div>
    );
  }

  const selectedYear = searchParams.season ? Number(searchParams.season) : seasons[0].year;
  const season = seasons.find((s) => s.year === selectedYear) ?? seasons[0];
  const standings = await getSeasonStandings(season.id);
  const weeks = await prisma.week.findMany({
    where: { seasonId: season.id },
    orderBy: { weekNumber: "asc" },
    select: { id: true, weekNumber: true, label: true, status: true, isPostseason: true },
  });
  const hasPostseason = weeks.some((w) => w.isPostseason);
  const postseasonStandings = hasPostseason ? await getPostseasonStandings(season.id) : [];
  const weeklyStandings = await getWeeklyStandings(season.id);
  const weeklyStandingsByWeekId = new Map(weeklyStandings.map((w) => [w.weekId, w]));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>{season.year} Season Standings</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {seasons.map((s) => (
            <Link key={s.id} href={`/?season=${s.year}`}>
              <button className={s.year === season.year ? "" : "secondary"}>{s.year}</button>
            </Link>
          ))}
        </div>
      </div>

      <div className="card">
        <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
          Regular season only (weeks 1-18) -- this is what decides the $150 season-long pot. The
          postseason is scored separately below and isn&apos;t part of this total.
        </p>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr key={s.player.id}>
                <td>{i + 1}</td>
                <td>{s.player.name}</td>
                <td>
                  <strong>{s.points}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasPostseason && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Postseason (separate competition)</h3>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {postseasonStandings.map((s, i) => (
                <tr key={s.player.id}>
                  <td>{i + 1}</td>
                  <td>{s.player.name}</td>
                  <td>
                    <strong>{s.points}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Weeks</h3>
        <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
          1st/2nd/3rd are plain points for that week -- ties share a place. Not tiebreaker-aware; open a week to see
          its tiebreaker-resolved winner.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Week</th>
                <th>Status</th>
                <th>1st</th>
                <th>2nd</th>
                <th>3rd</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => {
                const standing = weeklyStandingsByWeekId.get(w.id);
                return (
                  <tr key={w.id}>
                    <td>{w.label || `Week ${w.weekNumber}`}</td>
                    <td>
                      <span className={`badge ${statusBadge(w.status)}`}>{w.status}</span>
                    </td>
                    <td>{formatPlacement(standing, 1)}</td>
                    <td>{formatPlacement(standing, 2)}</td>
                    <td>{formatPlacement(standing, 3)}</td>
                    <td>
                      <Link href={`/weeks/${w.id}`}>View →</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function formatPlacement(standing: WeeklyStandingRow | undefined, place: number) {
  const row = standing?.placements.find((p) => p.place === place);
  if (!row) return <span className="muted">—</span>;
  return (
    <span>
      {row.players.map((p, i) => (
        <span key={p.id}>
          {i > 0 && " & "}
          <span
            style={{
              background: playerColor(p.name).fill,
              color: playerColor(p.name).ink,
              padding: "0.1rem 0.5rem",
              borderRadius: 999,
              fontWeight: 600,
            }}
          >
            {p.name}
          </span>
        </span>
      ))}{" "}
      <span className="muted">({row.points})</span>
    </span>
  );
}

function statusBadge(status: string) {
  if (status === "final") return "covered";
  if (status === "in_progress" || status === "drafting") return "pending";
  return "push";
}
