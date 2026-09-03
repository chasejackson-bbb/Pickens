import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { NewWeekForm } from "./NewWeekForm";

export const dynamic = "force-dynamic";

export default async function WeeksPage() {
  const seasons = await prisma.season.findMany({ orderBy: { year: "desc" } });
  const weeks = await prisma.week.findMany({
    orderBy: [{ seasonId: "desc" }, { weekNumber: "asc" }],
    include: { season: true, _count: { select: { picks: true, games: true } } },
  });

  return (
    <div>
      <h1>Weeks</h1>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Start a new week</h3>
        <NewWeekForm seasons={seasons.map((s) => ({ id: s.id, year: s.year }))} />
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Season</th>
              <th>Week</th>
              <th>Status</th>
              <th>Games</th>
              <th>Picks</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.id}>
                <td>{w.season.year}</td>
                <td>{w.label || `Week ${w.weekNumber}`}</td>
                <td>
                  <span className="badge pending">{w.status}</span>
                </td>
                <td>{w._count.games}</td>
                <td>{w._count.picks}</td>
                <td>
                  <Link href={`/weeks/${w.id}`}>Open →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
