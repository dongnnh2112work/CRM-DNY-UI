"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageLoading } from "@/components/shared/page-loading";

/** Create flow lives on the services list Modal — keep route for old bookmarks. */
export default function NewServicePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/services");
  }, [router]);

  return <PageLoading />;
}
