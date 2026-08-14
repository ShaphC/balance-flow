"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (loading) return;

    setError("");

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      setLoading(false);

      // Don't expose Supabase's internal wording to the user.
      if (error.message.toLowerCase().includes("invalid login credentials")) {
        setError("Invalid email or password.");
      } else {
        setError(
          "We couldn't sign you in. Please check your information and try again.",
        );
      }

      return;
    }

    router.push("/cash-flow");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2">
        <label
          htmlFor="login-email"
          className="text-sm font-medium text-foreground"
        >
          Email
        </label>

        <input
          id="login-email"
          required
          autoComplete="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={loading}
          className="
            h-11 w-full rounded-xl border
            border-input bg-background px-4
            text-foreground outline-none
            placeholder:text-muted-foreground
            transition
            focus:border-ring focus:ring-2 focus:ring-ring/20
            disabled:cursor-not-allowed disabled:opacity-60
          "
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="login-password"
          className="text-sm font-medium text-foreground"
        >
          Password
        </label>

        <input
          id="login-password"
          required
          autoComplete="current-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          disabled={loading}
          className="
            h-11 w-full rounded-xl border
            border-input bg-background px-4
            text-foreground outline-none
            placeholder:text-muted-foreground
            transition
            focus:border-ring focus:ring-2 focus:ring-ring/20
            disabled:cursor-not-allowed disabled:opacity-60
          "
        />
      </div>

      {error && (
        <div
          role="alert"
          className="
            rounded-xl border border-destructive/20
            bg-destructive/10 px-4 py-3
            text-sm text-destructive
          "
        >
          {error}
        </div>
      )}

      <Button
        type="submit"
        className="h-11 w-full rounded-xl"
        disabled={loading}
      >
        {loading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
