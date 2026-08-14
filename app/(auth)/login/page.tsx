import Link from "next/link";
import { LoginForm } from "@/components/navigation/login-form";
export default function LoginPage() { return <main className="flex min-h-screen items-center justify-center p-6"><div className="w-full max-w-sm space-y-6"><div><p className="text-sm text-[var(--muted)]">Personal finance</p><h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1></div><LoginForm /><p className="text-center text-sm text-[var(--muted)]">No account? <Link className="underline" href="/signup">Create one</Link></p></div></main>; }
