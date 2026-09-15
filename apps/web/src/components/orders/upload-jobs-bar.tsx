"use client";

import { Progress, Typography } from "antd";
import { ds } from "@/lib/design-tokens";
import { useT } from "@/lib/use-t";

export type UploadJob = {
  id: string;
  name: string;
  percent: number;
  phase: "upload" | "saving";
};

export function UploadJobsBar({ jobs }: { jobs: UploadJob[] }) {
  const t = useT();
  if (!jobs.length) return null;
  return (
    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      {jobs.map((job) => (
        <div key={job.id}>
          <Typography.Text style={{ fontSize: ds.fontSize.bodySm }}>
            {job.phase === "saving" ? t("docs.savingStorage", { name: job.name }) : t("docs.uploading", { name: job.name })}
          </Typography.Text>
          <Progress percent={job.percent} size="small" status={job.phase === "saving" ? "active" : "normal"} />
        </div>
      ))}
    </div>
  );
}
