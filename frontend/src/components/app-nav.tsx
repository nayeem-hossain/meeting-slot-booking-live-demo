"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-provider";

export function AppNav() {
  const pathname = usePathname();
  const { isAuthenticated, loading } = useAuth();

  const links = [
    { href: "/", label: "Overview" },
    { href: "/bookings", label: "Bookings" }
  ];

  return (
    <nav className="appNav">
      {links.map((link) => {
        const active = link.href === "/"
          ? pathname === "/"
          : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`navLink${active ? " navLinkActive" : ""}`}
          >
            {link.label}
          </Link>
        );
      })}

      {!loading && !isAuthenticated && (
        <Link href="/login" className={`navLink${pathname.startsWith("/login") ? " navLinkActive" : ""}`}>
          Login
        </Link>
      )}
    </nav>
  );
}
