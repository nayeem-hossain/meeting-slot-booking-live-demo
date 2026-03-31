"use client";

import Link from "next/link";
import { useAuth } from "./auth-provider";
import { AppRole } from "../lib/types";

interface RoleGuardProps {
  allowRoles?: AppRole[];
  children: React.ReactNode;
}

export function RoleGuard({ allowRoles, children }: RoleGuardProps) {
  const { loading, isAuthenticated, user } = useAuth();

  if (loading) {
    return (
      <section className="card">
        <h2>Checking access</h2>
        <p className="helperText">Evaluating your session and permissions.</p>
      </section>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <section className="card">
        <h2>Sign in required</h2>
        <p className="helperText">
          Please sign in to access this page.
        </p>
        <Link href="/login" className="button">
          Go to Login
        </Link>
      </section>
    );
  }

  if (allowRoles && !allowRoles.includes(user.role)) {
    return (
      <section className="card">
        <h2>Access denied</h2>
        <p className="helperText">
          Your role ({user.role}) does not have permission to view this page.
        </p>
      </section>
    );
  }

  return <>{children}</>;
}
