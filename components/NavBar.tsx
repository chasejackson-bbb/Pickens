import Link from "next/link";

export function NavBar() {
  return (
    <nav className="nav">
      <span className="brand">🏈 Pickens Pick&apos;em</span>
      <Link href="/">Standings</Link>
      <Link href="/weeks">Weeks</Link>
      <Link href="/history">All-Time</Link>
      <Link href="/payouts">Payouts</Link>
      <Link href="/admin">Admin</Link>
    </nav>
  );
}
