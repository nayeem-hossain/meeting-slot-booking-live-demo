"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ApiError } from "../../lib/api-client";
import { useAuth } from "../../components/auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const { login, register, isAuthenticated, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [managementMode, setManagementMode] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace("/bookings");
    }
  }, [isAuthenticated, loading, router]);

  if (!loading && isAuthenticated) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (mode === "register") {
        await register(name.trim(), email.trim(), password);
      } else {
        await login(email.trim(), password);
      }

      router.push("/bookings");
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        setError(submitError.message);
      } else if (submitError instanceof Error) {
        setError(submitError.message);
      } else {
        setError("Authentication failed.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card" style={{ maxWidth: 520, margin: "0 auto" }}>
      <h2 style={{ marginTop: 0 }}>{mode === "login" ? "Sign In" : "Create Account"}</h2>
      <p style={{ color: "var(--muted)" }}>
        {managementMode
          ? "Management access mode: use authorized moderator/admin credentials."
          : "Use your account to create and manage booking slots."}
      </p>

      <form onSubmit={handleSubmit} className="formGrid">
        {mode === "register" && (
          <label className="fieldLabel">
            Full Name
            <input
              className="input"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              required
            />
          </label>
        )}

        <label className="fieldLabel">
          Email
          <input
            className="input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="fieldLabel">
          Password
          <input
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
        </label>

        {error && <p className="errorText">{error}</p>}

        <button type="submit" className="button" disabled={submitting}>
          {submitting ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
        </button>
      </form>

      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          className="button buttonGhost"
          onClick={() => {
            setMode("login");
            setManagementMode((current) => !current);
            setError(null);
          }}
          disabled={submitting}
          style={{ marginRight: 8 }}
        >
          Management Login
        </button>
        <button
          type="button"
          className="button buttonSecondary"
          onClick={() => {
            const nextMode = mode === "login" ? "register" : "login";
            setMode(nextMode);
            if (nextMode === "register") {
              setManagementMode(false);
            }
          }}
          disabled={submitting}
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
        </button>
      </div>
    </section>
  );
}
