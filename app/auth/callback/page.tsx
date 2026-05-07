"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { saveOperonSession, type OperonAuthResponse } from "@/lib/operon-api";

export default function RustAuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const token = params.get("token");
    const expiresAt = Number(params.get("expires_at") ?? "0");
    if (!token || !expiresAt) {
      router.replace("/login?error=OAuthCallback");
      return;
    }
    const auth: OperonAuthResponse = {
      access_token: token,
      expires_at: expiresAt,
      user: {},
    };
    saveOperonSession(auth);
    router.replace("/dashboard/coding");
  }, [params, router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Signing you in...
    </div>
  );
}
