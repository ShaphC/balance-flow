import Link from "next/link";
import { SignupForm } from "@/components/navigation/signup-form";
export default function SignupPage(){return <main className="flex min-h-screen items-center justify-center p-6"><div className="w-full max-w-sm space-y-6"><div><p className="text-sm text-[var(--muted)]">Personal finance</p><h1 className="text-3xl font-semibold tracking-tight">Create your account</h1></div><SignupForm/><p className="text-center text-sm text-[var(--muted)]">Already have an account? <Link className="underline" href="/login">Sign in</Link></p></div></main>}
