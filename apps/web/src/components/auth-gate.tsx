"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PageLoading } from "@/components/shared/page-loading";
import { useSession } from "@/lib/session/session-provider";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login");
    }
  }, [status, router, pathname]);

  if (status === "loading") return <PageLoading />;
  if (status !== "authenticated") return <PageLoading />;
  return <>{children}</>;
}
