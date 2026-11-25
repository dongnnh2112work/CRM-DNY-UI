"use client";

import { Button, Typography } from "antd";
import { listFooterMode } from "@/lib/list-footer";
import { useT } from "@/lib/use-t";

export function RemoteListStatus({
  loaded,
  total,
  visible,
  onLoadMore,
  loading,
}: {
  loaded: number;
  total: number;
  /** Rows currently shown after search or filters. */
  visible?: number;
  onLoadMore: () => void;
  loading?: boolean;
}) {
  const t = useT();
  if (total <= 0 && loaded <= 0) return null;
  const hasMore = loaded < total;
  const shown = visible ?? loaded;
  const filtered = listFooterMode(shown, loaded) === "filtered";
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
        {filtered
          ? t("common.loadedFiltered", {
              visible: String(shown),
              loaded: String(loaded),
              total: String(total),
            })
          : t("common.loadedOf", { loaded: String(loaded), total: String(total) })}
      </Typography.Text>
      {hasMore ? (
        <Button size="small" loading={loading} onClick={onLoadMore}>
          {t("common.loadMore")}
        </Button>
      ) : null}
    </div>
  );
}
