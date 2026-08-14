import Link from "next/link";
import { LoginForm } from "@/components/navigation/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <p className="text-sm font-medium text-primary">Personal Finance</p>

          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            Welcome back
          </h1>
        </div>

        <LoginForm />

        <p className="text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link
            className="font-medium text-primary underline-offset-4 hover:underline"
            href="/signup"
          >
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
