
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { operonGoogleOAuthUrl } from "@/lib/operon-api"

export default function SignIn() {
  const router = useRouter()

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    const token = localStorage.getItem("operon_token")
    if (token) router.replace("/dashboard/chat")
  }, [router])

  return <button onClick={() => { window.location.href = operonGoogleOAuthUrl() }}>Sign in</button>
}
