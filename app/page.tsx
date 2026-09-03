import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSeasonStandings } from "@/lib/queries";

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

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Weeks</h3>
        <table>
          <thead>
            <tr>
              <th>Week</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.id}>
                <td>{w.label || `Week ${w.weekNumber}`}</td>
                <td>
                  <span className={`badge ${statusBadge(w.status)}`}>{w.status}</span>
                </td>
                <td>
                  <Link href={`/weeks/${w.id}`}>View →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function statusBadge(status: string) {
  if (status === "final") return "covered";
  if (status === "in_progress" || status === "drafting") return "pending";
  return "push";
}
