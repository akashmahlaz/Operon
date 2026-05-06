"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OperonWordmark } from "@/components/brand";
import { operonGoogleOAuthUrl, operonLogin } from "@/lib/operon-api";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(searchParams.get("error") ?? "");
  const [loading, setLoading] = useState(false);

  async function handleCredentialsSignIn(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await operonLogin(email, password);
      router.push("/dashboard/coding");
      router.refresh();
    } catch {
      setError("Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError("");
    setLoading(true);
    try {
      window.location.href = operonGoogleOAuthUrl();
    } catch {
      setLoading(false);
      setError("Google sign-in failed. Please try again.");
    }
  }

  return (
    <div className="w-full max-w-100 rounded-2xl border border-white/60 bg-white/75 p-8 shadow-[0_8px_60px_rgba(0,0,0,0.04)] backdrop-blur-xl sm:p-10">
      <div className="mb-6 flex justify-center">
        <OperonWordmark height={28} />
      </div>
      <div className="mb-8 text-center">
        <h1 className="font-heading text-[28px] font-extrabold tracking-tight text-gray-900 sm:text-[32px]">
          Welcome back
        </h1>
        <p className="mt-2 text-[14px] text-gray-500">
          Sign in to continue to Operon
        </p>
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={handleGoogleSignIn}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200/80 bg-white text-[13px] font-medium text-gray-700 transition-all duration-200 hover:border-gray-300 hover:shadow-sm disabled:opacity-60"
      >
        <svg className="size-4" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Continue with Google
      </button>

      <div className="my-7 flex items-center">
        <div className="h-px flex-1 bg-gray-200/80" />
        <span className="px-4 text-[11px] font-medium uppercase tracking-widest text-gray-400">
          or
        </span>
        <div className="h-px flex-1 bg-gray-200/80" />
      </div>

      <form onSubmit={handleCredentialsSignIn} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-[13px] font-medium text-gray-600">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            className="h-11 rounded-xl border-gray-200/80 bg-white/80 text-[14px] placeholder:text-gray-400 focus-visible:border-gray-300 focus-visible:ring-1 focus-visible:ring-gray-300"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-[13px] font-medium text-gray-600">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
            className="h-11 rounded-xl border-gray-200/80 bg-white/80 text-[14px] placeholder:text-gray-400 focus-visible:border-gray-300 focus-visible:ring-1 focus-visible:ring-gray-300"
          />
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200/60 bg-red-50/80 px-3.5 py-2.5 text-[13px] text-red-600">
            {error === "MissingCSRF" ? "Your sign-in session expired. Please try again." : error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="group relative h-11 w-full overflow-hidden rounded-xl bg-gray-900 text-[14px] font-semibold text-white shadow-[inset_0_0_12px_rgba(255,255,255,0.15)] transition-all duration-500 hover:shadow-[inset_0_0_20px_rgba(255,255,255,0.3)] active:scale-[0.98] disabled:opacity-60"
        >
          <span className="absolute inset-0 rounded-xl bg-linear-to-r from-gray-900 via-blue-900 to-blue-700 opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
          <span className="relative z-10 flex items-center justify-center gap-2">
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Signing in
              </>
            ) : (
              <>
                Sign in
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </span>
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] text-gray-500">
        New to Operon?{" "}
        <Link href="/signup" className="font-semibold text-gray-900 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
