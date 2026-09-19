"use client";

import { App, Button, Descriptions, Popconfirm, Space, Typography } from "antd";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApiHydrate } from "@/components/api-hydrator";
import { EntityDocuments } from "@/components/documents/entity-documents";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/page-loading";
import { StatusBadge } from "@/components/shared/status-badge";
import { ds } from "@/lib/design-tokens";
import { formatDisplayDate } from "@/lib/format-date";
import { formatVndDisplay } from "@/lib/format-vnd";
import { apiErrorMessage } from "@/lib/http/message";
import { unwrapList } from "@/lib/http/paging";
import { useOrders } from "@/lib/orders-store";
import type { OrderAttachment, VatInvoice } from "@/lib/types";
import { useT } from "@/lib/use-t";
import { useUsers } from "@/lib/users-store";
import { resolveContractNumber } from "@/lib/vat-helpers";
import { useVat } from "@/lib/vat-store";
import { documentsApi, type ApiDocument } from "@/modules/documents/api";
import {
  encodeVatFileType,
  isVatDocumentForInvoice,
  mapApiDocumentToAttachment,
  mergeAttachments,
} from "@/modules/documents/map-to-ui";
import { vatApi } from "@/modules/vat/api";
import { mapApiVatToUi } from "@/modules/vat/map-to-ui";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function mapVatDocs(docs: ApiDocument[], invoiceId: string, userName: Map<string, string>) {
  return docs
    .filter((d) => d?.id && isVatDocumentForInvoice(d, invoiceId))
    .map((d) => {
      try {
        return mapApiDocumentToAttachment(d, userName.get(d.uploadedByUserId));
      } catch {
        return null;
      }
    })
    .filter((row): row is OrderAttachment => row != null);
}

export default function VatDetailPage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { message } = App.useApp();
  const { ready: hydrateReady } = useApiHydrate();
  const { getById, updateInvoice, upsertInvoice } = useVat();
  const { orders } = useOrders();
  const { users, currentUser } = useUsers();
  const cached = getById(id);
  const [invoice, setInvoice] = useState<VatInvoice | null>(cached ?? null);
  const [attachments, setAttachments] = useState<OrderAttachment[]>([]);
  const [loading, setLoading] = useState(!cached);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (cached) setInvoice(cached);
  }, [cached]);

  useEffect(() => {
    if (!id || !hydrateReady) return;
    let cancelled = false;

    const load = async () => {
      try {
        const apiInvoice = await vatApi.get(id);
        if (cancelled) return;
        if (!apiInvoice?.id) {
          if (!cached) setInvoice(null);
          return;
        }
        const order = orders.find((o) => o.id === apiInvoice.orderId);
        const mapped = mapApiVatToUi(apiInvoice, order?.orderNumber, order?.contractNumber);
        setInvoice(mapped);
        upsertInvoice(mapped);

        const docsResult = await documentsApi.list({ orderId: apiInvoice.orderId, pageSize: 100 });
        if (cancelled) return;
        const userName = new Map(users.map((u) => [u.id, u.name]));
        setAttachments((prev) =>
          mergeAttachments(mapVatDocs(unwrapList(docsResult), apiInvoice.id, userName), prev),
        );
      } catch (err) {
        if (!cancelled && !cached) {
          message.error(apiErrorMessage(err, t("common.notFoundVat")));
          setInvoice(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, hydrateReady]);

  if (!hydrateReady || (loading && !invoice)) return <PageLoading />;
  if (!invoice) {
    return (
      <EmptyState
        description={t("common.notFoundVat")}
        action={{ label: t("common.back"), href: "/vat" }}
      />
    );
  }

  const contractNumber = resolveContractNumber(invoice, orders);
  const order = orders.find((o) => o.id === invoice.orderId);
  const uploaderName = currentUser?.name ?? "Admin";
  const isDraft = invoice.status === "draft";

  const issueInvoice = async () => {
    setActing(true);
    try {
      const today = todayIso();
      await vatApi.issue(invoice.id, today);
      const next = { ...invoice, status: "issued" as const, issueDate: today };
      setInvoice(next);
      updateInvoice(invoice.id, next);
      message.success(t("vat.issuedN", { count: 1 }));
    } catch (err) {
      message.error(apiErrorMessage(err, t("vat.noDrafts")));
    } finally {
      setActing(false);
    }
  };

  const cancelInvoice = async () => {
    setActing(true);
    try {
      await vatApi.cancel(invoice.id);
      const next = { ...invoice, status: "cancelled" as const };
      setInvoice(next);
      updateInvoice(invoice.id, next);
      message.success(t("vat.cancelledN", { count: 1 }));
    } catch (err) {
      message.error(apiErrorMessage(err, t("vat.noDrafts")));
    } finally {
      setActing(false);
    }
  };

  return (
    <>
      <PageHeader breadcrumbs={[{ title: t("nav.vat"), href: "/vat" }, { title: invoice.invoiceNumber }]}>
        <Space wrap>
          <Button onClick={() => router.push(`/orders/${invoice.orderId}`)}>{t("vat.viewOrder")}</Button>
          {isDraft ? (
            <>
              <Popconfirm
                title={t("vat.issueN", { count: 1 })}
                description={t("vat.issueBody")}
                okText={t("status.vat.issued")}
                cancelText={t("common.close")}
                onConfirm={issueInvoice}
              >
                <Button type="primary" loading={acting} disabled={acting}>
                  {t("vat.issueDraftOnly")}
                </Button>
              </Popconfirm>
              <Popconfirm
                title={t("vat.cancelN", { count: 1 })}
                description={t("vat.cancelBody")}
                okText={t("vat.cancelOk")}
                cancelText={t("common.close")}
                onConfirm={cancelInvoice}
              >
                <Button loading={acting} disabled={acting}>
                  {t("vat.cancelDraftOnly")}
                </Button>
              </Popconfirm>
            </>
          ) : null}
        </Space>
      </PageHeader>
      <div style={{ padding: 16 }}>
        <Space align="center" size="middle" style={{ marginBottom: 16 }} wrap>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {invoice.invoiceNumber}
          </Typography.Title>
          <StatusBadge module="vat" status={invoice.status} />
        </Space>

        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} style={{ marginBottom: 24 }}>
          <Descriptions.Item label={t("vat.invoiceNo")}>{invoice.invoiceNumber}</Descriptions.Item>
          <Descriptions.Item label={t("common.contractNo")}>
            {contractNumber != null ? contractNumber : "—"}
          </Descriptions.Item>
          <Descriptions.Item label={t("common.order")}>
            <Link href={`/orders/${invoice.orderId}`}>
              {invoice.orderNumber || order?.orderNumber || invoice.orderId}
            </Link>
          </Descriptions.Item>
          <Descriptions.Item label={t("vat.customerName")}>{invoice.customerName}</Descriptions.Item>
          <Descriptions.Item label={t("common.taxCode")}>{invoice.taxCode || "—"}</Descriptions.Item>
          <Descriptions.Item label={t("vat.issueDate")}>{formatDisplayDate(invoice.issueDate)}</Descriptions.Item>
          <Descriptions.Item label={t("vat.goodsAmount")}>{formatVndDisplay(invoice.amount)}</Descriptions.Item>
          <Descriptions.Item label={t("vat.taxRate")}>{invoice.taxRate}%</Descriptions.Item>
          <Descriptions.Item label={t("vat.taxAmount")}>{formatVndDisplay(invoice.taxAmount)}</Descriptions.Item>
          <Descriptions.Item label={t("vat.total")}>{formatVndDisplay(invoice.totalAmount)}</Descriptions.Item>
          {(invoice.lines ?? []).some((line) => line.description || line.amount) ? (
            <Descriptions.Item label={t("vat.invoiceContent")} span={{ xs: 1, sm: 2 }}>
              {(invoice.lines ?? [])
                .filter((line) => line.description || line.amount)
                .map((line, i) => (
                  <div key={`${line.description}-${i}`}>
                    {line.description || "—"} · {formatVndDisplay(line.amount)}
                  </div>
                ))}
            </Descriptions.Item>
          ) : null}
        </Descriptions>

        <Typography.Title level={5} style={{ fontSize: ds.fontSize.body, marginBottom: 12 }}>
          {t("vat.files")}
        </Typography.Title>
        <EntityDocuments
          orderId={invoice.orderId}
          fileType={encodeVatFileType(invoice.id)}
          attachments={attachments}
          onChange={setAttachments}
          uploaderName={uploaderName}
          intro={t("vat.docsIntro")}
          emptyDescription={t("vat.docsEmpty")}
        />
      </div>
    </>
  );
}
