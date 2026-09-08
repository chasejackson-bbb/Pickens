import Link from "next/link";
import { PickensHelmet } from "./PickensHelmet";

export function NavBar() {
  return (
    <nav className="nav">
      <Link href="/" className="brand">
        <PickensHelmet size={40} />
        <span className="brand-word">Pickens</span>
      </Link>
      <Link href="/">Standings</Link>
      <Link href="/weeks">Weeks</Link>
      <Link href="/history">All-Time</Link>
      <Link href="/payouts">Payouts</Link>
      <Link href="/admin">Admin</Link>
    </nav>
  );
}
