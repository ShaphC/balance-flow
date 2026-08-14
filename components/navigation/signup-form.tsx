"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function SignupForm() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (loading) return;

    setError("");
    setMessage("");

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (password.length < 8) {
      setError("Your password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    });

    if (error) {
      setLoading(false);

      setError(
        "We couldn't create your account. Please check your information and try again.",
      );

      return;
    }

    setLoading(false);
    setMessage("Account created. Check your email to confirm your account.");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2">
        <label
          htmlFor="signup-email"
          className="text-sm font-medium text-foreground"
        >
          Email
        </label>

        <input
          id="signup-email"
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
          htmlFor="signup-password"
          className="text-sm font-medium text-foreground"
        >
          Password
        </label>

        <input
          id="signup-password"
          required
          minLength={8}
          autoComplete="new-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
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

      {message && (
        <div
          role="status"
          className="
            rounded-xl border border-primary/20
            bg-primary/10 px-4 py-3
            text-sm text-foreground
          "
        >
          {message}
        </div>
      )}

      <Button
        type="submit"
        className="h-11 w-full rounded-xl"
        disabled={loading}
      >
        {loading ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
