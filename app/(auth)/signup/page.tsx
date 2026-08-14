import Link from "next/link";
import { SignupForm } from "@/components/navigation/signup-form";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <p className="text-sm font-medium text-primary">Personal Finance</p>

          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            Create your account
          </h1>
        </div>

        <SignupForm />

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            className="font-medium text-primary underline-offset-4 hover:underline"
            href="/login"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
