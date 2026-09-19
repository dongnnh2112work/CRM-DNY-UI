"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PageLoading } from "@/components/shared/page-loading";

/** Render children after mount so SSR HTML cannot mismatch (antd + localStorage + browser tooling). */
export function ClientOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <PageLoading />;
  }

  return children;
}
