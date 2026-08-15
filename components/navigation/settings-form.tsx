"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function SettingsForm() {
  const [privacy, setPrivacy] = useState(false);

  const { theme, setTheme } = useTheme();
  const supabase = createClient();

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const isDark = theme === "dark";

  return (
    <div className="space-y-4">
      {/* Appearance */}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-medium">Appearance</h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Choose between light and dark mode.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}

            <span className="ml-2">{isDark ? "Light" : "Dark"}</span>
          </Button>
        </div>
      </div>

      {/* Privacy */}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-medium">Test / Privacy Mode</h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Masks financial values for screen sharing and tester feedback.
              Stored data is never changed.
            </p>
          </div>

          <Button
            variant={privacy ? "default" : "outline"}
            onClick={() => setPrivacy((value) => !value)}
          >
            {privacy ? "On" : "Off"}
          </Button>
        </div>

        {privacy && (
          <p className="mt-4 rounded-xl bg-black/5 p-3 text-sm dark:bg-white/10">
            🔒 Privacy Mode is active.
          </p>
        )}
      </div>

      {/* Account */}

      <Button variant="outline" onClick={logout}>
        Log out
      </Button>
    </div>
  );
}
