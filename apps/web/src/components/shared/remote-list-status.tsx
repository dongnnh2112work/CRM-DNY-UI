"use client";

import { Button, Typography } from "antd";
import { useT } from "@/lib/use-t";

export function RemoteListStatus({
  loaded,
  total,
  onLoadMore,
  loading,
}: {
  loaded: number;
  total: number;
  onLoadMore: () => void;
  loading?: boolean;
}) {
  const t = useT();
  if (total <= 0) return null;
  const hasMore = loaded < total;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 8,
        padding: "0 16px 12px",
      }}
    >
      <Typography.Text type="secondary">
        {t("common.loadedOf", { loaded: String(loaded), total: String(total) })}
      </Typography.Text>
      {hasMore ? (
        <Button size="small" loading={loading} onClick={onLoadMore}>
          {t("common.loadMore")}
        </Button>
      ) : null}
    </div>
  );
}
