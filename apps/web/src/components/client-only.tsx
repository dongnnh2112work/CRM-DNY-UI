"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Render children after mount so SSR HTML cannot mismatch (antd + localStorage + browser tooling). */
export function ClientOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div style={{ minHeight: "100vh" }} aria-hidden />;
  }

  return children;
}
