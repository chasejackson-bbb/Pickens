import Link from "next/link";
import { PickensMark } from "./PickensMark";

export function NavBar() {
  return (
    <nav className="nav">
      <Link href="/" className="brand">
        <PickensMark size={24} />
        <span className="brand-word">PICKENS</span>
      </Link>
      <Link href="/">Standings</Link>
      <Link href="/weeks">Weeks</Link>
      <Link href="/history">All-Time</Link>
      <Link href="/payouts">Payouts</Link>
      <Link href="/admin">Admin</Link>
    </nav>
  );
}
