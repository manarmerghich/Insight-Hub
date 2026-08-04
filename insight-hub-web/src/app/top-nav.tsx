"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/import", label: "Import" },
  { href: "/dashboard", label: "Dashboard" },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="top-nav">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`top-nav__link${pathname?.startsWith(link.href) ? " top-nav__link--active" : ""}`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
