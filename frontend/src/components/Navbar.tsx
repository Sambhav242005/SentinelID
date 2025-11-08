import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="flex justify-center gap-6 p-4 bg-gray-900 border-b border-gray-700">
      <Link href="/register" className="hover:text-blue-400">Register</Link>
      <Link href="/aliases" className="hover:text-blue-400">Aliases</Link>
      <Link href="/leak-check" className="hover:text-blue-400">Leak Check</Link>
      <Link href="/incident-correlation" className="hover:text-blue-400">Incidents</Link>
    </nav>
  );
}
