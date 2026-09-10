"use client";

import { App, Button, Popconfirm, Select, type TableColumnsType } from "antd";
import Link from "next/link";
import { useCallback, useMemo, useState, type Key } from "react";
import { BulkActionBar } from "@/components/shared/bulk-action-bar";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { UrlQuerySync } from "@/components/shared/url-query-sync";
import { useEmails } from "@/lib/emails-store";
import { getStatusMeta, getStatusOptions } from "@/lib/status-config";
import { isInDateRange, type DateRangeValue } from "@/lib/date-range";
import { matchesTableQuery } from "@/lib/table-search";
import type { EmailRecord, EmailStatus } from "@/lib/types";
import { useT } from "@/lib/use-t";

function compareText(a: string, b: string) {
  return a.localeCompare(b, "vi");
}

function emailDate(r: EmailRecord) {
  return r.sentAt ?? r.scheduledAt ?? "";
}

function recipientsLabel(r: EmailRecord) {
  if (!r.recipients?.length) return "—";
  if (r.recipients.length === 1) return r.recipients[0];
  return `${r.recipients[0]} +${r.recipients.length - 1}`;
}

export default function EmailsPage() {
  const t = useT();
  const { message } = App.useApp();
  const { emails, setStatus, deleteEmails } = useEmails();
  const [query, setQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeValue>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const applyUrlQuery = useCallback((q: string) => {
    setQuery(q);
    setSelectedRowKeys([]);
  }, []);

  const filtered = useMemo(() => {
    let list = [...emails];
    if (statusFilter !== "all") list = list.filter((e) => e.status === statusFilter);
    if (dateRange?.[0] || dateRange?.[1]) {
      list = list.filter((e) => isInDateRange(emailDate(e), dateRange));
    }
    if (query.trim()) {
      list = list.filter((e) =>
        matchesTableQuery(query, [
          e.subject,
          e.recipientCount,
          e.recipients,
          e.status,
          getStatusMeta("email", e.status).label,
          e.sentAt,
          e.scheduledAt,
          e.body,
        ]),
      );
    }
    return list;
  }, [emails, statusFilter, dateRange, query]);

  const selectedCount = selectedRowKeys.length;
  const clearSelection = () => setSelectedRowKeys([]);
  const hasActiveFilters =
    Boolean(query.trim()) || statusFilter !== "all" || Boolean(dateRange?.[0] || dateRange?.[1]);

  const bulkSetStatus = (status: EmailStatus) => {
    setStatus(selectedRowKeys.map(String), status);
    message.success(
      status === "sent"
        ? t("email.markedSent", { count: selectedCount })
        : t("email.markedFailed", { count: selectedCount }),
    );
    clearSelection();
  };

  const bulkDelete = () => {
    deleteEmails(selectedRowKeys.map(String));
    message.success(t("email.deletedN", { count: selectedCount }));
    clearSelection();
  };

  const columns: TableColumnsType<EmailRecord> = useMemo(
    () => [
      {
        title: t("email.subject"),
        dataIndex: "subject",
        sorter: (a, b) => compareText(a.subject, b.subject),
        render: (v, r) => <Link href={`/emails/new?id=${r.id}`}>{v}</Link>,
      },
      {
        title: t("email.recipients"),
        key: "recipients",
        ellipsis: true,
        sorter: (a, b) => a.recipientCount - b.recipientCount,
        render: (_, r) => recipientsLabel(r),
      },
      {
        title: t("common.status"),
        dataIndex: "status",
        sorter: (a, b) => compareText(a.status, b.status),
        render: (s: EmailStatus) => <StatusBadge module="email" status={s} />,
      },
      {
        title: t("email.sendAt"),
        dataIndex: "sentAt",
        key: "date",
        sorter: (a, b) => compareText(emailDate(a), emailDate(b)),
        render: (_, r) => r.sentAt ?? r.scheduledAt ?? "—",
      },
    ],
    [t],
  );

  return (
    <>
      <UrlQuerySync onQuery={applyUrlQuery} />
      <PageHeader
        breadcrumbs={[{ title: t("nav.emails") }]}
        searchPlaceholder={t("common.searchTable")}
        onSearch={(v) => {
          setQuery(v);
          clearSelection();
        }}
        searchValue={query}
        dateRange={dateRange}
        onDateRangeChange={(v) => {
          setDateRange(v);
          clearSelection();
        }}
        primaryAction={{ label: t("email.newCta"), href: "/emails/new" }}
      >
        <Select
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            clearSelection();
          }}
          style={{ width: 180 }}
          options={[{ value: "all", label: t("common.allStatuses") }, ...getStatusOptions("email")]}
        />
      </PageHeader>
      <DataTable<EmailRecord>
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        columnManagerKey="emails"
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onSelectedRowKeysChange={setSelectedRowKeys}
        emptyDescription={
          hasActiveFilters && emails.length > 0 ? t("common.noResults") : t("email.empty")
        }
        emptyAction={
          hasActiveFilters && emails.length > 0
            ? undefined
            : { label: t("common.composeEmail"), href: "/emails/new" }
        }
        bulkToolbar={
          <BulkActionBar count={selectedCount}>
            <Popconfirm
              title={t("email.markSentN", { count: selectedCount })}
              okText={t("common.confirm")}
              cancelText={t("common.cancel")}
              onConfirm={() => bulkSetStatus("sent")}
            >
              <Button size="small">{t("email.markSent")}</Button>
            </Popconfirm>
            <Popconfirm
              title={t("email.markFailedN", { count: selectedCount })}
              okText={t("common.confirm")}
              cancelText={t("common.cancel")}
              onConfirm={() => bulkSetStatus("failed")}
            >
              <Button size="small">{t("email.markFailed")}</Button>
            </Popconfirm>
            <Popconfirm
              title={t("email.deleteN", { count: selectedCount })}
              description={t("common.applyCurrentPage")}
              okText={t("common.delete")}
              cancelText={t("common.cancel")}
              okButtonProps={{ danger: true }}
              onConfirm={bulkDelete}
            >
              <Button size="small" danger>
                {t("common.delete")}
              </Button>
            </Popconfirm>
          </BulkActionBar>
        }
      />
    </>
  );
}
