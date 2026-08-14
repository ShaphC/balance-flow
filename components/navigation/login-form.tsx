"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <form onSubmit={submit} className="space-y-4">
      {/* Email */}
      <input
        required
        autoComplete="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
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

      {/* Password */}
      <div className="relative">
        <input
          required
          autoComplete="current-password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          disabled={loading}
          className="
            h-11 w-full rounded-xl border
            border-input bg-background
            pl-4 pr-12
            text-foreground outline-none
            placeholder:text-muted-foreground
            transition
            focus:border-ring focus:ring-2 focus:ring-ring/20
            disabled:cursor-not-allowed disabled:opacity-60
          "
        />

        <button
          type="button"
          aria-label={showPassword ? "Hide password" : "Show password"}
          disabled={loading}
          onPointerDown={() => setShowPassword(true)}
          onPointerUp={() => setShowPassword(false)}
          onPointerLeave={() => setShowPassword(false)}
          onPointerCancel={() => setShowPassword(false)}
          className="
            absolute right-3 top-1/2
            flex size-8 -translate-y-1/2
            items-center justify-center
            rounded-lg text-muted-foreground
            transition-colors
            hover:bg-muted hover:text-foreground
            focus:outline-none
            focus:ring-2 focus:ring-ring/40
            disabled:pointer-events-none
          "
        >
          {showPassword ? (
            <EyeOff className="size-4" />
          ) : (
            <Eye className="size-4" />
          )}
        </button>
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
