"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PageLoading } from "@/components/shared/page-loading";
import { isAwaitingAccess } from "@/lib/access-gate";
import { useSession } from "@/lib/session/session-provider";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status, user } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const waiting = status === "authenticated" && Boolean(user) && isAwaitingAccess(user);

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login");
    }
  }, [status, router, pathname]);

  useEffect(() => {
    if (waiting) router.replace("/pending-approval");
  }, [waiting, router]);

  if (status === "loading") return <PageLoading />;
  if (status !== "authenticated") return <PageLoading />;
  if (!user) return <PageLoading />;
  if (waiting) return <PageLoading />;
  return <>{children}</>;
}
