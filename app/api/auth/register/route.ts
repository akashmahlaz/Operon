import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { collections } from "@/lib/db-collections"

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    const existing = await collections.users().findOne({ email })
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    await collections.users().insertOne({
      name,
      email,
      passwordHash,
      createdAt: new Date(),
    })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    console.error("[register]", err)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
