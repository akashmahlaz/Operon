"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2, ArrowRight } from "lucide-react"
import { motion } from "framer-motion"
import { signIn } from "next-auth/react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function SignUpForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Registration failed")
        return
      }

      // Auto sign-in after registration
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })
      if (result?.error) {
        setError("Account created but sign-in failed. Please log in manually.")
      } else {
        router.push("/dashboard/chat")
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    setError("")
    setLoading(true)
    try {
      await signIn("google", { redirectTo: "/dashboard/chat" })
    } catch {
      setLoading(false)
      setError("Google sign-in failed. Please try again.")
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-100"
    >
      {/* Glass card */}
      <div className="rounded-2xl border border-white/60 bg-white/70 backdrop-blur-xl shadow-[0_8px_60px_rgba(0,0,0,0.04)] p-8 sm:p-10">
        {/* Header */}
        <div className="text-center mb-8">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-[28px] sm:text-[32px] font-extrabold text-gray-900 tracking-tight"
            style={{ fontFamily: "var(--font-heading, inherit)" }}
          >
            Create your account
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-[14px] text-gray-500 mt-2"
          >
            Start automating everything with one message
          </motion.p>
        </div>

        {/* OAuth */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mb-7"
        >
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
        </motion.div>

        {/* Divider */}
        <div className="relative flex items-center mb-7">
          <div className="flex-1 h-px bg-gray-200/80" />
          <span className="px-4 text-[11px] text-gray-400 uppercase tracking-widest font-medium">
            or
          </span>
          <div className="flex-1 h-px bg-gray-200/80" />
        </div>

        {/* Form */}
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-[13px] font-medium text-gray-600">
              Full name
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              className="h-11 rounded-xl border-gray-200/80 bg-white/80 text-[14px] placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-gray-300 focus-visible:border-gray-300"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-[13px] font-medium text-gray-600">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="h-11 rounded-xl border-gray-200/80 bg-white/80 text-[14px] placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-gray-300 focus-visible:border-gray-300"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-[13px] font-medium text-gray-600">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Min 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="h-11 rounded-xl border-gray-200/80 bg-white/80 text-[14px] pr-10 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-gray-300 focus-visible:border-gray-300"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50/80 border border-red-200/60 px-3.5 py-2.5 text-[13px] text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full h-11 bg-gray-900 text-white text-[14px] font-semibold rounded-xl overflow-hidden transition-all duration-500 shadow-[inset_0_0_12px_rgba(255,255,255,0.15)] hover:shadow-[inset_0_0_20px_rgba(255,255,255,0.3)] active:scale-[0.98] disabled:opacity-60"
          >
            <span className="absolute inset-0 bg-linear-to-r from-gray-900 via-blue-900 to-blue-700 opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-xl" />
            <span className="relative z-10 flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                <>
                  Create account
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </span>
          </button>
        </form>

        {/* Terms */}
        <p className="text-center text-[11px] text-gray-400 leading-relaxed mt-5">
          By signing up, you agree to our{" "}
          <Link href="/terms" className="underline hover:text-gray-600">Terms</Link>
          {" "}&{" "}
          <Link href="/privacy" className="underline hover:text-gray-600">Privacy Policy</Link>.
        </p>
      </div>

      {/* Sign in link */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="text-center text-[13px] text-gray-500 mt-6"
      >
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-gray-900 hover:underline">
          Sign in
        </Link>
      </motion.p>
    </motion.div>
  )
}
