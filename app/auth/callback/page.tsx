"use client";

import { useEffect } from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { saveOperonSession, type OperonAuthResponse } from "@/lib/operon-api";

function AuthCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const token = params.get("token");
    const expiresAt = Number(params.get("expires_at") ?? "0");
    if (!token || !expiresAt) {
      router.replace("/login?error=OAuthCallback");
      return;
    }
    const name = params.get("name");
    const auth: OperonAuthResponse = {
      access_token: token,
      expires_at: expiresAt,
      user: {
        id: params.get("user_id") ?? undefined,
        email: params.get("email"),
        name,
        display_name: name,
        image: params.get("image"),
      },
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

export default function RustAuthCallbackPage() {
  return (
    <Suspense
      fallback={(
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Signing you in...
        </div>
      )}
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
