"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-provider";

export function AppNav() {
  const pathname = usePathname();
  const { isAuthenticated, user, loading } = useAuth();

  const links = [
    { href: "/", label: "Overview" },
    { href: "/bookings", label: "Bookings" }
  ];

  const isModeratorOrAdmin = user?.role === "ADMIN" || user?.role === "MODERATOR";

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

      {!loading && isAuthenticated && user?.role === "ADMIN" && (
        <Link
          href="/admin"
          className={`navLink${pathname.startsWith("/admin") ? " navLinkActive" : ""}`}
        >
          Admin
        </Link>
      )}

      {!loading && isAuthenticated && isModeratorOrAdmin && (
        <Link
          href="/moderator"
          className={`navLink${pathname.startsWith("/moderator") ? " navLinkActive" : ""}`}
        >
          Moderator
        </Link>
      )}

      {!loading && !isAuthenticated && (
        <Link href="/login" className={`navLink${pathname.startsWith("/login") ? " navLinkActive" : ""}`}>
          Login
        </Link>
      )}
    </nav>
  );
}
