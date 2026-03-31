"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-provider";

export function AuthToolbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, loading, logout } = useAuth();

  if (loading) {
    return <span className="mutedText">Loading session...</span>;
  }

  if (!isAuthenticated) {
    return (
      <Link href="/login" className="button buttonSecondary">
        {pathname === "/login" ? "Sign in page" : "Sign in"}
      </Link>
    );
  }

  return (
    <div className="authToolbar">
      <span className="userChip">
        {user?.name} ({user?.role})
      </span>
      <button
        type="button"
        onClick={() => {
          void logout();
        }}
        className="button buttonSecondary"
      >
        Logout
      </button>
    </div>
  );
}
