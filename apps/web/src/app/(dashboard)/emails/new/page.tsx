"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Soạn thư local đã bỏ — backend chỉ gửi theo mẫu. */
export default function ComposeEmailRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/emails?tab=templates");
  }, [router]);
  return null;
}
