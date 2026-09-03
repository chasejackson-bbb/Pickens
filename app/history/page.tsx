import { getAllTimeStats, getFavoriteTeams } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const stats = await getAllTimeStats();
  const favorites = await getFavoriteTeams();
  const ranked = [...stats].sort((a, b) => b.totalPoints - a.totalPoints);

  return (
    <div>
      <h1>All-Time Stats</h1>
      <p className="muted">Career totals across every imported and played season (2018 postseason onward).</p>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Total points</th>
              <th>Weeks played</th>
              <th>Weeks won</th>
              <th>1st</th>
              <th>2nd</th>
              <th>3rd</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((s) => (
              <tr key={s.player.id}>
                <td>
                  <strong>{s.player.name}</strong>
                </td>
                <td>{s.totalPoints}</td>
                <td>{s.weeksPlayed}</td>
                <td>{s.weeksWon}</td>
                <td>{s.firsts}</td>
                <td>{s.seconds}</td>
                <td>{s.thirds}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Most-picked teams</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
          {Object.entries(favorites).map(([name, teams]) => (
            <div key={name}>
              <h4 style={{ marginBottom: "0.4rem" }}>{name}</h4>
              <ol style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.88rem" }}>
                {teams.slice(0, 5).map((t) => (
                  <li key={t.team}>
                    {t.team} ({t.count})
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
