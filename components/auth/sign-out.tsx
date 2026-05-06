"use client"
import { useRouter } from "next/navigation"
import { clearOperonSession } from "@/lib/operon-api"

export function SignOut() {
  const router = useRouter()

  return <button onClick={() => { clearOperonSession(); router.push("/") }}>Sign Out</button>
}