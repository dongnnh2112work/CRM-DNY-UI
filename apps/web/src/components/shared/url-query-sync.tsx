"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function UrlQuerySyncInner({ onQuery }: { onQuery: (q: string) => void }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams.get("q");
    if (q != null) onQuery(q);
  }, [onQuery, searchParams]);

  return null;
}

/** Applies `?q=` from the URL into list search state (header search lands here). */
export function UrlQuerySync({ onQuery }: { onQuery: (q: string) => void }) {
  return (
    <Suspense fallback={null}>
      <UrlQuerySyncInner onQuery={onQuery} />
    </Suspense>
  );
}
